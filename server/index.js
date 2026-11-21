import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { readDB, writeDB } from "./store.js";
import {
  transcribeMediaPipeline,
  sampleVideoFramesForGemini,
} from "./transcribe.js";

const app = express();
const PORT = process.env.PORT || 5000;

const CONFIRMED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

const configuredModel = process.env.GEMINI_MODEL?.trim();
const MODEL = CONFIRMED_MODELS.includes(configuredModel)
  ? configuredModel
  : "gemini-3.8-flash";

if (configuredModel && !CONFIRMED_MODELS.includes(configuredModel)) {
  console.warn(
    `[Config Warning] GEMINI_MODEL="${configuredModel}" is not in confirmed models list. Defaulting primary model to "${MODEL}".`
  );
}

const FALLBACK_MODELS = [
  MODEL,
  ...CONFIRMED_MODELS.filter((m) => m !== MODEL),
];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json());

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

function getMimeType(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const map = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
  };
  return map[ext] || file.mimetype || "video/mp4";
}

const PER_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 60_000; // Max 60s per API request
const OVERALL_TRANSCRIPT_TIMEOUT_MS =
  Number(process.env.GEMINI_OVERALL_TIMEOUT_MS) || 4 * 60 * 1000; // 4 minutes overall limit

function extractHttpStatus(err) {
  if (err?.isTimeout) return "TIMEOUT";
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.statusCode === "number") return err.statusCode;
  if (typeof err?.code === "number") return err.code;
  const msg = String(err?.message || "");
  if (
    err?.name === "AbortError" ||
    msg.includes("RequestTimeoutError") ||
    msg.includes("timed out") ||
    msg.includes("ETIMEDOUT")
  ) {
    return "TIMEOUT";
  }
  const codeMatch =
    msg.match(/"code"\s*:\s*(\d{3})/) ||
    msg.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  return codeMatch ? Number(codeMatch[1]) : "UNKNOWN";
}

function isTransientError(err, statusCode) {
  if (err?.isTimeout || statusCode === "TIMEOUT" || statusCode === 408) {
    return true;
  }
  if (
    statusCode === 503 ||
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 504
  ) {
    return true;
  }
  const msg = String(err?.message || "");
  return (
    msg.includes("UNAVAILABLE") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("DEADLINE_EXCEEDED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("socket hang up") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

function isPermanentError(err, statusCode) {
  if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
    return true;
  }
  const msg = String(err?.message || "");
  return (
    msg.includes("API_KEY_INVALID") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("INVALID_ARGUMENT") ||
    msg.includes("UNAUTHENTICATED")
  );
}

// Single Gemini generateContent call enforced with strict AbortController + SDK timeout
async function callGeminiWithTimeout(params, candidateModel, timeoutMs, taskLabel, retryCount, maxRetriesPerModel) {
  const controller = new AbortController();
  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      const timeoutErr = new Error(
        `Model "${candidateModel}" timed out after ${(timeoutMs / 1000).toFixed(1)}s`
      );
      timeoutErr.isTimeout = true;
      timeoutErr.status = "TIMEOUT";
      reject(timeoutErr);
    }, timeoutMs);
  });

  const requestConfig = {
    ...(params.config || {}),
    abortSignal: controller.signal,
    httpOptions: {
      ...(params.config?.httpOptions || {}),
      timeout: timeoutMs,
      // Disable SDK's hidden 5-attempt internal retry loop so our explicit timeout & retry logic is in full control
      retryOptions: {
        attempts: 1,
      },
    },
  };

  try {
    const requestPromise = ai.models.generateContent({
      ...params,
      model: candidateModel,
      config: requestConfig,
    });
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Helper: try FALLBACK_MODELS with strict per-request timeout, overall timeout, and exponential backoff
async function generateWithRetry(params, options = {}) {
  const maxRetriesPerModel = options.maxRetriesPerModel ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1500;
  const perRequestTimeoutMs = Math.min(
    options.perRequestTimeoutMs ?? PER_REQUEST_TIMEOUT_MS,
    60_000
  );
  const overallTimeoutMs = options.overallTimeoutMs ?? OVERALL_TRANSCRIPT_TIMEOUT_MS;
  const taskLabel = options.taskLabel || "generation";

  const overallStartTime = Date.now();
  const overallDeadline = overallStartTime + overallTimeoutMs;

  const attemptedModels = [];
  let lastError = null;
  let lastStatus = "UNKNOWN";

  for (let modelIdx = 0; modelIdx < FALLBACK_MODELS.length; modelIdx++) {
    const candidateModel = FALLBACK_MODELS[modelIdx];

    for (let retryCount = 0; retryCount <= maxRetriesPerModel; retryCount++) {
      const now = Date.now();
      const remainingOverallMs = overallDeadline - now;
      if (remainingOverallMs <= 0) {
        const totalElapsedSec = ((now - overallStartTime) / 1000).toFixed(2);
        const deadlineMsg = `Overall ${taskLabel} time limit of ${(
          overallTimeoutMs / 1000
        ).toFixed(0)}s exceeded after ${totalElapsedSec}s. Attempted models: [${attemptedModels.join(
          ", "
        )}]`;
        console.error(`[Gemini Overall Timeout][${taskLabel}] ${deadlineMsg}`);
        throw new Error(deadlineMsg);
      }

      const effectiveRequestTimeoutMs = Math.min(perRequestTimeoutMs, remainingOverallMs);
      const attemptStart = Date.now();
      const elapsedSoFarSec = ((attemptStart - overallStartTime) / 1000).toFixed(1);

      console.log(
        `[Gemini][${taskLabel}] Attempting model="${candidateModel}" (retry ${retryCount}/${maxRetriesPerModel}, timeout=${(
          effectiveRequestTimeoutMs / 1000
        ).toFixed(0)}s, elapsed=${elapsedSoFarSec}s)`
      );

      try {
        const response = await callGeminiWithTimeout(
          params,
          candidateModel,
          effectiveRequestTimeoutMs,
          taskLabel,
          retryCount,
          maxRetriesPerModel
        );

        const attemptDurationSec = ((Date.now() - attemptStart) / 1000).toFixed(2);
        const totalDurationSec = ((Date.now() - overallStartTime) / 1000).toFixed(2);
        console.log(
          `[Gemini Success][${taskLabel}] model="${candidateModel}" succeeded in ${attemptDurationSec}s (total=${totalDurationSec}s, retriesUsed=${retryCount})`
        );

        return {
          response,
          modelUsed: candidateModel,
          retriesUsed: retryCount,
          totalDurationSec,
        };
      } catch (err) {
        lastError = err;
        const statusCode = extractHttpStatus(err);
        lastStatus = statusCode;
        const rawMessage = err?.message || String(err);
        const attemptDurationSec = ((Date.now() - attemptStart) / 1000).toFixed(2);

        if (statusCode === "TIMEOUT" || err?.isTimeout) {
          console.error(
            `[Gemini Timeout][${taskLabel}] model="${candidateModel}" TIMED OUT after ${attemptDurationSec}s (limit=${(
              effectiveRequestTimeoutMs / 1000
            ).toFixed(0)}s, retry=${retryCount}/${maxRetriesPerModel})`
          );
        } else {
          console.error(
            `[Gemini Error][${taskLabel}] model="${candidateModel}" | status=${statusCode} | duration=${attemptDurationSec}s | retry=${retryCount}/${maxRetriesPerModel} | error=${rawMessage}`
          );
        }

        // Permanent errors (invalid API key, permission denied, malformed request): do NOT retry
        if (isPermanentError(err, statusCode)) {
          console.error(
            `[Gemini Permanent Error][${taskLabel}] Aborting immediately on model="${candidateModel}" (status=${statusCode}).`
          );
          throw new Error(
            `Gemini request failed with permanent error on model "${candidateModel}" (HTTP ${statusCode}): ${rawMessage}`
          );
        }

        // Invalid model name (404): do NOT retry this model; log and move to next fallback model
        const isNotFound =
          statusCode === 404 ||
          rawMessage.includes("NOT_FOUND") ||
          rawMessage.includes("not found");

        if (isNotFound) {
          attemptedModels.push(`${candidateModel} (HTTP 404)`);
          const nextModel = FALLBACK_MODELS[modelIdx + 1];
          if (nextModel) {
            console.warn(
              `[Gemini Fallback][${taskLabel}] Invalid/unavailable model "${candidateModel}" (HTTP 404). Transitioning "${candidateModel}" -> "${nextModel}"`
            );
          }
          break;
        }

        // Check if error is transient (503, 429, network error, or timeout)
        if (!isTransientError(err, statusCode)) {
          throw new Error(
            `Gemini non-retryable error on model "${candidateModel}" (status ${statusCode}): ${rawMessage}`
          );
        }

        if (retryCount < maxRetriesPerModel) {
          const nextRetry = retryCount + 1;
          const delayMs = baseDelayMs * Math.pow(2, retryCount); // 1500ms, 3000ms
          if (Date.now() + delayMs >= overallDeadline) {
            attemptedModels.push(`${candidateModel} (${statusCode} - overall deadline reached)`);
            break;
          }
          console.warn(
            `[Gemini Retry][${taskLabel}] model="${candidateModel}" | reason=${statusCode} | retry=${nextRetry}/${maxRetriesPerModel} in ${delayMs}ms (exponential backoff)...`
          );
          await new Promise((r) => setTimeout(r, delayMs));
        } else {
          attemptedModels.push(`${candidateModel} (${statusCode} after ${retryCount} retries)`);
          const nextModel = FALLBACK_MODELS[modelIdx + 1];
          if (nextModel) {
            console.warn(
              `[Gemini Fallback][${taskLabel}] Retries exhausted for model="${candidateModel}" (reason=${statusCode}, retries=${retryCount}). Transitioning "${candidateModel}" -> "${nextModel}"`
            );
          } else {
            console.error(
              `[Gemini Exhausted][${taskLabel}] Final fallback model="${candidateModel}" failed after ${retryCount} retries (reason=${statusCode}).`
            );
          }
        }
      }
    }
  }

  const totalElapsedSec = ((Date.now() - overallStartTime) / 1000).toFixed(2);
  throw new Error(
    `Transcript extraction failed across all eligible Gemini models after ${totalElapsedSec}s [${attemptedModels.join(
      ", "
    )}]. Last error (${lastStatus}): ${lastError?.message || "Service unavailable"}`
  );
}

// Helper: clean JSON parsing from Gemini
async function generateJSON(prompt, temperature = 0.3, taskLabel = "json") {
  const { response } = await generateWithRetry(
    {
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature,
      },
    },
    { taskLabel }
  );
  const raw = (response.text || "{}")
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(raw);
}

app.get("/", (_, res) => res.send("Palimpsest API Server is running."));

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.get("/api/models", async (_, res) => {
  try {
    const pager = await ai.models.list();
    const names = [];
    for await (const m of pager) {
      if (m.name?.includes("gemini")) names.push(m.name);
    }
    res.json({ models: names });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// MODULE 1: MEDIA INGESTION & GROQ WHISPER TRANSCRIPTION
// ============================================================================
const transcriptionJobs = new Map();

app.get("/api/projects/status/:jobId", (req, res) => {
  const job = transcriptionJobs.get(req.params.jobId);
  if (!job) {
    return res.json({
      stageKey: "extracting_audio",
      stageLabel: "Extracting audio",
    });
  }
  res.json(job);
});

app.get("/api/projects", (_, res) => {
  const db = readDB();
  res.json({ projects: db.projects });
});

app.patch("/api/projects/:id", (req, res) => {
  const db = readDB();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });

  if (req.body.projectName?.trim()) {
    project.projectName = req.body.projectName.trim();
  }
  writeDB(db);
  res.json({ project });
});

app.post("/api/projects/upload", upload.single("file"), async (req, res) => {
  const requestStartTime = Date.now();
  const jobId = req.body.jobId?.trim() || `job-${requestStartTime}`;

  const updateJobStage = (stageKey, stageLabel) => {
    transcriptionJobs.set(jobId, {
      jobId,
      stageKey,
      stageLabel,
      updatedAt: new Date().toISOString(),
    });
  };

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No media file uploaded." });
    }

    const projectName =
      req.body.projectName?.trim() ||
      req.file.originalname.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");

    // Run independent FFmpeg (16 kHz mono FLAC) + Groq Whisper (whisper-large-v3-turbo) pipeline
    const result = await transcribeMediaPipeline(req.file.path, {
      language: req.body.language || null,
      onStage: updateJobStage,
    });

    const db = readDB();
    const newProject = {
      id: `proj-${Date.now()}`,
      projectName,
      fileName: req.file.originalname,
      localFilePath: req.file.path,
      format: path.extname(req.file.originalname).replace(".", "").toUpperCase(),
      videoUrl: `https://palimpsest-api.onrender.com/uploads/${req.file.filename}`,
      duration: result.durationFormatted || req.body.duration || "00:00",
      transcript: result.transcript,
      fullTranscript: result.fullTranscript,
      segments: result.segments,
      words: result.words,
      language: result.language,
      processingDurationMs: result.processingDurationMs,
      processingDurationSec: result.processingDurationSec,
      transcriptionProvider: result.provider,
      clips: [],
      createdAt: new Date().toISOString(),
    };

    db.projects.unshift(newProject);
    writeDB(db);

    res.json({
      project: newProject,
      transcription: {
        provider: result.provider,
        fullTranscript: result.fullTranscript,
        transcript: result.transcript,
        segments: result.segments,
        words: result.words,
        language: result.language,
        audioSizeMB: result.audioSizeMB,
        chunkCount: result.chunkCount,
        extractionDurationMs: result.extractionDurationMs,
        transcriptionDurationMs: result.transcriptionDurationMs,
        processingDurationMs: result.processingDurationMs,
        processingDurationSec: result.processingDurationSec,
      },
    });
  } catch (err) {
    const failedTotalSec = ((Date.now() - requestStartTime) / 1000).toFixed(2);
    updateJobStage("error", err.message || "Failed to transcribe media.");
    console.error(
      `[Upload/Transcription Failed] totalDuration=${failedTotalSec}s | error=${err.message}`
    );
    res.status(500).json({
      error: err.message || "Failed to extract text from video.",
    });
  } finally {
    setTimeout(() => transcriptionJobs.delete(jobId), 60_000);
  }
});

// ============================================================================
// MODULE 2: AI CLIP SELECTION WITH REASONS (GEMINI + SAMPLED VIDEO FRAMES)
// ============================================================================
app.post("/api/projects/:id/clips", async (req, res) => {
  try {
    const db = readDB();
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });

    const { brandProfile, performanceInsights } = db;
    const rulesText = brandProfile.learnedRules
      .map((r) => `- (${r.preferenceType}, reinforced ${r.patternCount}x): ${r.rule}`)
      .join("\n");

    const sampledFrames = await sampleVideoFramesForGemini(project.localFilePath, 3);

    const prompt = `You are an expert short-form video strategist for Palimpsest.
Analyze this timestamped transcript${
      sampledFrames.length > 0 ? " and the attached sampled video frames" : ""
    } and extract the 3 highest-potential short-form clips (30-60 seconds each).

PROJECT TITLE: ${project.projectName}
DETECTED LANGUAGE: ${project.language || "en"}
PERFORMANCE LOOP WINNER (prioritize this angle when ranking): ${performanceInsights.topAngle}
BRAND VOICE:
- Tone: ${brandProfile.tone}
- Style: ${brandProfile.style}
- Vocabulary: ${brandProfile.vocabulary.join(", ")}
- Learned Edit Rules:
${rulesText}

TRANSCRIPT:
${project.transcript}

Return ONLY valid JSON with this exact structure:
{
  "clips": [
    {
      "id": "clip-1",
      "rank": 1,
      "title": "Short punchy clip title",
      "startTime": "MM:SS",
      "endTime": "MM:SS",
      "engagementScore": 96,
      "patternTag": "Myth-Busting | Tactical Framework | Case Proof | Contrarian Take",
      "quote": "Exact verbatim quote from the transcript",
      "reason": "Clear 1-2 sentence explanation of why this moment was selected and how it aligns with audience retention.",
      "platforms": {
        "youtube_shorts": { "hook": "...", "caption": "..." },
        "instagram": { "hook": "...", "caption": "..." },
        "tiktok": { "hook": "...", "caption": "..." },
        "linkedin": { "hook": "...", "caption": "..." }
      }
    }
  ]
}`;

    const contentsPayload =
      sampledFrames.length > 0 ? [...sampledFrames, prompt] : prompt;
    const parsed = await generateJSON(contentsPayload, 0.4, "clip-selection");
    const clips = (parsed.clips || []).map((c, idx) => ({
      ...c,
      id: `clip-${Date.now()}-${idx + 1}`,
      rank: idx + 1,
    }));

    project.clips = clips;
    writeDB(db);

    res.json({ clips });
  } catch (err) {
    console.error("Clip Selection Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate clips." });
  }
});

// ============================================================================
// MODULE 3: PLATFORM-SPECIFIC COPY REGENERATION
// ============================================================================
app.post("/api/clips/:clipId/copy", async (req, res) => {
  try {
    const { projectId, platform, clipTitle, quote } = req.body;
    const db = readDB();
    const { brandProfile } = db;

    const rulesText = brandProfile.learnedRules
      .map((r) => `- (${r.preferenceType}, ${r.patternCount}x): ${r.rule}`)
      .join("\n");

    const prompt = `Rewrite the hook and caption for ${platform} based on this clip.
CLIP TITLE: ${clipTitle}
VERBATIM QUOTE: "${quote}"

STRICTLY FOLLOW THIS BRAND-VOICE MEMORY:
- Tone: ${brandProfile.tone}
- Style: ${brandProfile.style}
- Preferred Vocabulary: ${brandProfile.vocabulary.join(", ")}
- Learned Edit Rules:
${rulesText}

Return ONLY valid JSON:
{
  "hook": "Scroll-stopping platform-native hook",
  "caption": "Platform-native caption matching brand voice"
}`;

    const parsed = await generateJSON(prompt, 0.6);

    // Update stored clip if project exists
    if (projectId) {
      const project = db.projects.find((p) => p.id === projectId);
      const clip = project?.clips.find((c) => c.id === req.params.clipId);
      if (clip && clip.platforms) {
        clip.platforms[platform] = {
          hook: parsed.hook || "",
          caption: parsed.caption || "",
        };
        writeDB(db);
      }
    }

    res.json({ hook: parsed.hook, caption: parsed.caption });
  } catch (err) {
    console.error("Copy Regeneration Error:", err);
    res.status(500).json({ error: err.message || "Failed to regenerate copy." });
  }
});

// ============================================================================
// MODULE 4: BRAND-VOICE MEMORY & EDIT-DIFF LEARNING
// ============================================================================
app.get("/api/brand", (_, res) => {
  const db = readDB();
  res.json({ brandProfile: db.brandProfile });
});

app.put("/api/brand", (req, res) => {
  const db = readDB();
  db.brandProfile = { ...db.brandProfile, ...req.body };
  writeDB(db);
  res.json({ brandProfile: db.brandProfile });
});

app.post("/api/brand/learn", async (req, res) => {
  try {
    const {
      projectId,
      clipId,
      platform,
      originalHook,
      editedHook,
      originalCaption,
      editedCaption,
    } = req.body;

    const db = readDB();

    // Save the edited copy back to the clip
    if (projectId && clipId) {
      const project = db.projects.find((p) => p.id === projectId);
      const clip = project?.clips.find((c) => c.id === clipId);
      if (clip && clip.platforms) {
        clip.platforms[platform] = {
          hook: editedHook,
          caption: editedCaption,
        };
      }
    }

    const prompt = `Compare the AI's original draft against the creator's edited version for ${platform}.
Extract ONE clear, reusable brand-voice rule that explains what the creator prefers.

ORIGINAL HOOK: ${originalHook}
EDITED HOOK: ${editedHook}
ORIGINAL CAPTION: ${originalCaption}
EDITED CAPTION: ${editedCaption}

Return ONLY valid JSON:
{
  "rule": "Concise 1-sentence actionable rule for future copy",
  "preferenceType": "Tone | Vocabulary | Writing Style"
}`;

    const parsed = await generateJSON(prompt, 0.2);

    if (parsed.rule) {
      const existing = db.brandProfile.learnedRules.find(
        (r) => r.rule.toLowerCase() === parsed.rule.toLowerCase()
      );
      if (existing) {
        existing.patternCount += 1;
        existing.updatedAt = "Just now";
      } else {
        db.brandProfile.learnedRules.unshift({
          id: `rule-${Date.now()}`,
          rule: parsed.rule,
          preferenceType: parsed.preferenceType || "Writing Style",
          patternCount: 1,
          updatedAt: "Just now",
        });
      }
    }

    writeDB(db);
    res.json({
      learnedRule: parsed,
      brandProfile: db.brandProfile,
    });
  } catch (err) {
    console.error("Brand Learn Error:", err);
    res.status(500).json({ error: err.message || "Failed to learn from edit." });
  }
});

// ============================================================================
// MODULE 5: CONTENT CALENDAR
// ============================================================================
app.get("/api/calendar", (_, res) => {
  const db = readDB();
  res.json({ calendarItems: db.calendarItems });
});

app.post("/api/calendar", (req, res) => {
  const db = readDB();
  const newItem = {
    id: `cal-${Date.now()}`,
    clipTitle: req.body.clipTitle,
    patternTag: req.body.patternTag || "General",
    platform: req.body.platform,
    date: req.body.date,
    status: req.body.status || "Scheduled",
    hook: req.body.hook || "",
    caption: req.body.caption || "",
    metrics: { views: 0, likes: 0, comments: 0, shares: 0 },
  };
  db.calendarItems.unshift(newItem);
  writeDB(db);
  res.json({ item: newItem, calendarItems: db.calendarItems });
});

app.patch("/api/calendar/:id", (req, res) => {
  const db = readDB();
  const item = db.calendarItems.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Calendar item not found." });

  if (req.body.date) item.date = req.body.date;
  if (req.body.status) item.status = req.body.status;
  writeDB(db);
  res.json({ item, calendarItems: db.calendarItems });
});

// ============================================================================
// MODULE 6: PERFORMANCE FEEDBACK LOOP
// ============================================================================
app.get("/api/performance", (_, res) => {
  const db = readDB();
  res.json({ performanceInsights: db.performanceInsights });
});

app.patch("/api/calendar/:id/metrics", (req, res) => {
  const db = readDB();
  const item = db.calendarItems.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Calendar item not found." });

  item.metrics = { ...item.metrics, ...req.body.metrics };
  writeDB(db);
  res.json({ item, calendarItems: db.calendarItems });
});

app.post("/api/performance/recalibrate", async (req, res) => {
  try {
    const db = readDB();
    const published = db.calendarItems.filter((i) => i.status === "Published");

    if (published.length === 0) {
      return res.json({
        performanceInsights: db.performanceInsights,
        projects: db.projects,
      });
    }

    const prompt = `Analyze these published short-form posts and determine which content patternTag performs best based on views, likes, comments, and shares.

PUBLISHED POSTS:
${JSON.stringify(published, null, 2)}

Return ONLY valid JSON:
{
  "topAngle": "Winning patternTag",
  "summary": "1-sentence data-backed insight explaining why this angle won and how future clip rankings will prioritize it."
}`;

    const parsed = await generateJSON(prompt, 0.2);

    db.performanceInsights = {
      topAngle: parsed.topAngle || db.performanceInsights.topAngle,
      summary: parsed.summary || db.performanceInsights.summary,
    };

    // Re-rank clips in active projects based on the winning pattern
    db.projects.forEach((proj) => {
      if (!proj.clips?.length) return;
      proj.clips = proj.clips
        .map((c) => ({
          ...c,
          engagementScore:
            c.patternTag === db.performanceInsights.topAngle
              ? Math.min(99, c.engagementScore + 4)
              : c.engagementScore,
        }))
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .map((c, idx) => ({ ...c, rank: idx + 1 }));
    });

    writeDB(db);
    res.json({
      performanceInsights: db.performanceInsights,
      projects: db.projects,
    });
  } catch (err) {
    console.error("Recalibrate Error:", err);
    res.status(500).json({ error: err.message || "Failed to recalibrate." });
  }
});

app.listen(PORT, () => {
  console.log(`Palimpsest backend running on http://localhost:${PORT}`);
});
