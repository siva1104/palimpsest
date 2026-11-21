import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Groq free-tier limit is 25 MB; use 24 MB threshold to leave safe multipart overhead
const GROQ_MAX_FILE_BYTES = 24 * 1024 * 1024;
const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";
const CHUNK_TARGET_SECONDS = 600; // 10-minute chunks when splitting >25MB FLAC
const CHUNK_OVERLAP_SECONDS = 2; // 2-second overlap to prevent clipped words at boundaries
const PER_CHUNK_TIMEOUT_MS = 60_000; // 60s strict timeout per Groq Whisper request
const MAX_RETRIES_PER_CHUNK = 2;

/**
 * Resolve FFmpeg executable path from env, ffmpeg-static, or system PATH.
 */
export function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {
    // fallback to root node_modules or system PATH
  }
  const rootStaticExe = path.resolve(
    process.cwd(),
    "..",
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
  if (fs.existsSync(rootStaticExe)) {
    return rootStaticExe;
  }
  const localStaticExe = path.resolve(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
  if (fs.existsSync(localStaticExe)) {
    return localStaticExe;
  }
  return "ffmpeg";
}

/**
 * Format seconds into [MM:SS] or MM:SS
 */
export function formatTimestamp(seconds) {
  const safeSec = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Parse media duration in seconds from FFmpeg stderr output ("Duration: HH:MM:SS.xx")
 */
function parseDurationFromFfmpegLog(stderrText) {
  const match = stderrText.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Run FFmpeg with a timeout and collect stderr logs.
 */
function runFfmpeg(args, timeoutMs = 120_000) {
  const ffmpegBin = resolveFfmpegPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { windowsHide: true });
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
      reject(new Error(`FFmpeg timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Failed to launch FFmpeg (${ffmpegBin}): ${err.message}. Ensure ffmpeg or ffmpeg-static is installed.`
        )
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        const tail = stderr.split("\n").slice(-6).join(" ").trim();
        reject(new Error(`FFmpeg exited with code ${code}: ${tail}`));
      } else {
        resolve({ stderr });
      }
    });
  });
}

/**
 * Extract 16 kHz, mono, compressed FLAC audio from an uploaded video/audio file.
 */
export async function extractAudioToFlac(inputPath, outputFlacPath) {
  const start = Date.now();
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "flac",
    "-compression_level",
    "8",
    outputFlacPath,
  ];

  const { stderr } = await runFfmpeg(args, 180_000);
  if (!fs.existsSync(outputFlacPath)) {
    throw new Error("FFmpeg completed but output FLAC file was not created.");
  }

  const stats = fs.statSync(outputFlacPath);
  if (stats.size === 0) {
    throw new Error("Extracted audio track is empty (0 bytes). Does the video contain an audio track?");
  }

  const durationSec = parseDurationFromFfmpegLog(stderr) || 0;
  const extractionDurationMs = Date.now() - start;

  return {
    flacPath: outputFlacPath,
    sizeBytes: stats.size,
    sizeMB: Number((stats.size / (1024 * 1024)).toFixed(2)),
    durationSec,
    extractionDurationMs,
  };
}

/**
 * Split a FLAC file exceeding 25 MB into overlapping 16 kHz mono FLAC chunks.
 */
export async function splitAudioIntoChunksIfNeeded(flacPath, sizeBytes, durationSec) {
  if (sizeBytes <= GROQ_MAX_FILE_BYTES) {
    return [
      {
        index: 0,
        path: flacPath,
        offsetSec: 0,
        overlapSec: 0,
        sizeBytes,
        isTemporaryChunk: false,
      },
    ];
  }

  const estimatedTotalSec = durationSec > 0 ? durationSec : Math.ceil((sizeBytes / (1024 * 1024)) * 30);
  // Target ~18 MB per chunk to stay well under Groq's 25 MB free-tier limit
  const targetRatio = (18 * 1024 * 1024) / sizeBytes;
  const chunkWindowSec = Math.max(
    60,
    Math.min(CHUNK_TARGET_SECONDS, Math.floor(estimatedTotalSec * targetRatio))
  );
  const stepSec = Math.max(30, chunkWindowSec - CHUNK_OVERLAP_SECONDS);

  console.log(
    `[Audio Split] Extracted FLAC is ${(sizeBytes / (1024 * 1024)).toFixed(
      2
    )} MB (> 24 MB threshold). Splitting into ${chunkWindowSec}s chunks with ${CHUNK_OVERLAP_SECONDS}s overlap...`
  );

  const chunks = [];
  let index = 0;
  for (let startSec = 0; startSec < estimatedTotalSec; startSec += stepSec) {
    const chunkPath = `${flacPath}.chunk-${index}.flac`;
    const actualDuration = Math.min(chunkWindowSec, estimatedTotalSec - startSec + CHUNK_OVERLAP_SECONDS);
    if (actualDuration <= 1) break;

    await runFfmpeg(
      [
        "-y",
        "-ss",
        String(startSec),
        "-t",
        String(actualDuration),
        "-i",
        flacPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "flac",
        "-compression_level",
        "8",
        chunkPath,
      ],
      120_000
    );

    if (fs.existsSync(chunkPath)) {
      const chunkStats = fs.statSync(chunkPath);
      if (chunkStats.size > 0) {
        chunks.push({
          index,
          path: chunkPath,
          offsetSec: startSec,
          overlapSec: index === 0 ? 0 : CHUNK_OVERLAP_SECONDS,
          sizeBytes: chunkStats.size,
          isTemporaryChunk: true,
        });
      }
    }
    index++;
    if (startSec + actualDuration >= estimatedTotalSec) break;
  }

  if (chunks.length === 0) {
    throw new Error("Failed to split oversized FLAC audio into chunks.");
  }

  return chunks;
}

/**
 * Call Groq Audio Transcriptions API (whisper-large-v3-turbo, verbose_json) with timeout and limited retries.
 */
async function transcribeChunkWithGroq(chunk, groqApiKey, requestedLanguage = null) {
  const audioBuffer = fs.readFileSync(chunk.path);
  const fileName = path.basename(chunk.path);

  let lastError = null;

  for (let retry = 0; retry <= MAX_RETRIES_PER_CHUNK; retry++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PER_CHUNK_TIMEOUT_MS);
    const attemptStart = Date.now();

    try {
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: "audio/flac" });
      formData.append("file", audioBlob, fileName);
      formData.append("model", GROQ_MODEL);
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "segment");
      formData.append("timestamp_granularities[]", "word");
      formData.append("temperature", "0");

      if (requestedLanguage && requestedLanguage.trim()) {
        formData.append("language", requestedLanguage.trim());
      }

      console.log(
        `[Groq Whisper] Transcribing chunk #${chunk.index} (${(
          chunk.sizeBytes /
          (1024 * 1024)
        ).toFixed(2)} MB, offset=${chunk.offsetSec}s, retry=${retry}/${MAX_RETRIES_PER_CHUNK}) with model="${GROQ_MODEL}"...`
      );

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - attemptStart;

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        let parsedMsg = errBody;
        try {
          const parsed = JSON.parse(errBody);
          parsedMsg = parsed?.error?.message || errBody;
        } catch {
          // keep raw text
        }

        const httpErr = new Error(
          `Groq Whisper HTTP ${response.status}: ${parsedMsg || response.statusText}`
        );
        httpErr.status = response.status;

        // Do NOT retry permanent errors (400, 401, 403, 413)
        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 413
        ) {
          httpErr.isPermanent = true;
          throw httpErr;
        }
        throw httpErr;
      }

      const data = await response.json();
      console.log(
        `[Groq Whisper] Chunk #${chunk.index} succeeded in ${(elapsedMs / 1000).toFixed(
          2
        )}s (language="${data.language || "auto"}", segments=${
          data.segments?.length || 0
        }, words=${data.words?.length || 0})`
      );
      return data;
    } catch (err) {
      lastError = err;
      const isAbort = err?.name === "AbortError";
      const status = isAbort ? "TIMEOUT" : err?.status || "NETWORK_ERROR";

      console.error(
        `[Groq Whisper Error] chunk=#${chunk.index} | status=${status} | retry=${retry}/${MAX_RETRIES_PER_CHUNK} | message=${
          isAbort
            ? `Groq request timed out after ${PER_CHUNK_TIMEOUT_MS / 1000}s`
            : err.message
        }`
      );

      if (err?.isPermanent) {
        throw err;
      }

      if (retry < MAX_RETRIES_PER_CHUNK) {
        const delayMs = 1500 * Math.pow(2, retry); // 1500ms, 3000ms
        console.warn(
          `[Groq Whisper Retry] Retrying chunk #${chunk.index} in ${delayMs}ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `Groq Whisper transcription failed on chunk #${chunk.index} after ${MAX_RETRIES_PER_CHUNK} retries: ${
      lastError?.message || "Unknown error"
    }`
  );
}

/**
 * Optional local faster-whisper fallback (via Python CLI if installed locally).
 * Not a mandatory deployment dependency.
 */
async function tryLocalFasterWhisperFallback(flacPath) {
  console.log(
    `[Faster-Whisper Fallback] Checking if local faster-whisper Python package is installed...`
  );

  const pyScript = `
import sys, json
try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.stderr.write("FASTER_WHISPER_NOT_INSTALLED")
    sys.exit(2)

audio_path = sys.argv[1]
model = WhisperModel("base", device="cpu", compute_type="int8")
segments_gen, info = model.transcribe(audio_path, word_timestamps=True)
segments = []
words = []
full_text_parts = []
for idx, seg in enumerate(segments_gen):
    text = seg.text.strip()
    if text:
        full_text_parts.append(text)
    segments.append({
        "id": idx,
        "start": round(seg.start, 2),
        "end": round(seg.end, 2),
        "text": text
    })
    if seg.words:
        for w in seg.words:
            words.append({
                "word": w.word.strip(),
                "start": round(w.start, 2),
                "end": round(w.end, 2)
            })
print(json.dumps({
    "text": " ".join(full_text_parts),
    "language": getattr(info, "language", "unknown"),
    "duration": getattr(info, "duration", 0),
    "segments": segments,
    "words": words
}))
`.trim();

  return new Promise((resolve, reject) => {
    const proc = spawn("python", ["-c", pyScript, flacPath], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Local faster-whisper fallback timed out after 180s."));
    }, 180_000);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Python not available for faster-whisper fallback: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        if (stderr.includes("FASTER_WHISPER_NOT_INSTALLED")) {
          reject(
            new Error(
              "Optional local faster-whisper is not installed (pip install faster-whisper)."
            )
          );
        } else {
          reject(
            new Error(
              `Local faster-whisper exited with code ${code}: ${stderr.trim()}`
            )
          );
        }
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse faster-whisper output: ${e.message}`));
      }
    });
  });
}

/**
 * Normalize text for overlap duplicate detection across chunk boundaries.
 */
function normalizeForOverlap(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge chunk transcription responses, preserving original timestamps and removing overlap duplicates.
 */
export function mergeChunkTranscriptions(chunkResults) {
  const mergedSegments = [];
  const mergedWords = [];
  let detectedLanguage = null;
  let totalAudioDurationSec = 0;

  for (const { chunk, data } of chunkResults) {
    const offsetSec = chunk.offsetSec || 0;
    const overlapCutoffSec = chunk.index > 0 ? offsetSec + (chunk.overlapSec || 0) * 0.6 : 0;

    if (!detectedLanguage && data.language) {
      detectedLanguage = data.language;
    }

    const chunkDuration = Number(data.duration) || 0;
    if (offsetSec + chunkDuration > totalAudioDurationSec) {
      totalAudioDurationSec = offsetSec + chunkDuration;
    }

    const rawSegments = Array.isArray(data.segments) ? data.segments : [];
    for (const seg of rawSegments) {
      const segText = String(seg.text || "").trim();
      if (!segText) continue;

      const absStart = Number(((Number(seg.start) || 0) + offsetSec).toFixed(2));
      const absEnd = Number(((Number(seg.end) || absStart) + offsetSec).toFixed(2));

      // Avoid duplicated segments at overlapping chunk boundaries
      if (chunk.index > 0 && mergedSegments.length > 0) {
        const prevSeg = mergedSegments[mergedSegments.length - 1];
        if (absEnd <= prevSeg.end + 0.25) {
          continue;
        }
        if (absStart < overlapCutoffSec || absStart < prevSeg.end - 0.3) {
          const normCurrent = normalizeForOverlap(segText);
          const normPrev = normalizeForOverlap(prevSeg.text);
          if (
            normCurrent &&
            normPrev &&
            (normPrev.includes(normCurrent) || normCurrent.includes(normPrev))
          ) {
            continue;
          }
        }
      }

      mergedSegments.push({
        id: mergedSegments.length + 1,
        start: absStart,
        end: absEnd,
        startTime: formatTimestamp(absStart),
        endTime: formatTimestamp(absEnd),
        text: segText,
      });
    }

    const rawWords = Array.isArray(data.words) ? data.words : [];
    for (const w of rawWords) {
      const wordText = String(w.word || "").trim();
      if (!wordText) continue;

      const absStart = Number(((Number(w.start) || 0) + offsetSec).toFixed(2));
      const absEnd = Number(((Number(w.end) || absStart) + offsetSec).toFixed(2));

      if (chunk.index > 0 && mergedWords.length > 0) {
        const prevWord = mergedWords[mergedWords.length - 1];
        if (absStart < prevWord.end - 0.15) {
          if (normalizeForOverlap(wordText) === normalizeForOverlap(prevWord.word)) {
            continue;
          }
        }
      }

      mergedWords.push({
        word: wordText,
        start: absStart,
        end: absEnd,
      });
    }

    // Fallback if Groq returns top-level text without segments array
    if (rawSegments.length === 0 && data.text?.trim()) {
      const text = data.text.trim();
      mergedSegments.push({
        id: mergedSegments.length + 1,
        start: offsetSec,
        end: offsetSec + chunkDuration,
        startTime: formatTimestamp(offsetSec),
        endTime: formatTimestamp(offsetSec + chunkDuration),
        text,
      });
    }
  }

  // Build both raw continuous transcript and [MM:SS] Speaker formatted transcript for the studio UI
  const fullText = mergedSegments.map((s) => s.text).join(" ").trim();
  const formattedTranscript = mergedSegments
    .map((s) => `[${s.startTime}] Speaker: ${s.text}`)
    .join("\n");

  return {
    fullText,
    formattedTranscript,
    segments: mergedSegments,
    words: mergedWords,
    language: detectedLanguage || "unknown",
    audioDurationSec: Number(totalAudioDurationSec.toFixed(2)),
  };
}

/**
 * Complete Video/Audio -> FFmpeg FLAC -> Groq Whisper (whisper-large-v3-turbo) pipeline.
 */
export async function transcribeMediaPipeline(inputMediaPath, options = {}) {
  const pipelineStart = Date.now();
  const onStage = typeof options.onStage === "function" ? options.onStage : () => {};
  const groqApiKey = process.env.GROQ_API_KEY?.trim();

  const tempFlacPath = `${inputMediaPath}.16khz-mono.flac`;
  let chunks = [];

  try {
    // STAGE 1: Extracting audio (16 kHz, mono, compressed FLAC)
    onStage("extracting_audio", "Extracting audio");
    console.log(`[Stage 1/4] Extracting 16 kHz mono FLAC audio from ${path.basename(inputMediaPath)}...`);

    const audioInfo = await extractAudioToFlac(inputMediaPath, tempFlacPath);
    console.log(
      `[Stage 1/4] Audio extracted in ${(audioInfo.extractionDurationMs / 1000).toFixed(
        2
      )}s | size=${audioInfo.sizeMB} MB (${audioInfo.sizeBytes} bytes) | duration=${formatTimestamp(
        audioInfo.durationSec
      )}`
    );

    // Check extracted audio size against Groq's 25 MB limit and split if needed
    chunks = await splitAudioIntoChunksIfNeeded(
      tempFlacPath,
      audioInfo.sizeBytes,
      audioInfo.durationSec
    );

    // STAGE 2: Transcribing audio with Groq whisper-large-v3-turbo (or optional faster-whisper fallback)
    onStage("transcribing_audio", "Transcribing audio");
    console.log(
      `[Stage 2/4] Transcribing ${chunks.length} audio chunk(s) using Groq "${GROQ_MODEL}" (response_format="verbose_json")...`
    );

    const transcribeStart = Date.now();
    const chunkResults = [];
    let providerUsed = `groq/${GROQ_MODEL}`;

    try {
      if (!groqApiKey) {
        throw new Error("GROQ_API_KEY is missing in server/.env.");
      }

      for (const chunk of chunks) {
        const data = await transcribeChunkWithGroq(
          chunk,
          groqApiKey,
          options.language || null
        );
        chunkResults.push({ chunk, data });
      }
    } catch (groqErr) {
      console.error(`[Groq Whisper Failed] ${groqErr.message}`);
      // Attempt optional local faster-whisper fallback if available
      try {
        const localData = await tryLocalFasterWhisperFallback(tempFlacPath);
        providerUsed = "local/faster-whisper";
        chunkResults.length = 0;
        chunkResults.push({
          chunk: { index: 0, offsetSec: 0, overlapSec: 0 },
          data: localData,
        });
        console.log(`[Faster-Whisper Fallback] Succeeded locally.`);
      } catch (fallbackErr) {
        console.warn(`[Faster-Whisper Fallback Skipped] ${fallbackErr.message}`);
        throw groqErr;
      }
    }

    const transcriptionDurationMs = Date.now() - transcribeStart;

    // STAGE 3: Combining transcript segments
    onStage("combining_segments", "Combining transcript segments");
    console.log(`[Stage 3/4] Combining transcript segments and preserving timestamps...`);

    const merged = mergeChunkTranscriptions(chunkResults);
    if (!merged.formattedTranscript) {
      throw new Error("Transcription completed but no spoken words were detected in the audio.");
    }

    // STAGE 4: Transcript ready
    const totalProcessingDurationMs = Date.now() - pipelineStart;
    const totalProcessingDurationSec = Number(
      (totalProcessingDurationMs / 1000).toFixed(2)
    );

    onStage("transcript_ready", "Transcript ready");
    console.log(
      `[Stage 4/4] Transcript ready in ${totalProcessingDurationSec}s | provider="${providerUsed}" | language="${merged.language}" | segments=${merged.segments.length} | words=${merged.words.length}`
    );

    return {
      provider: providerUsed,
      transcript: merged.formattedTranscript,
      fullTranscript: merged.fullText,
      segments: merged.segments,
      words: merged.words,
      language: merged.language,
      durationFormatted: formatTimestamp(
        merged.audioDurationSec || audioInfo.durationSec
      ),
      audioSizeMB: audioInfo.sizeMB,
      chunkCount: chunks.length,
      extractionDurationMs: audioInfo.extractionDurationMs,
      transcriptionDurationMs,
      processingDurationMs: totalProcessingDurationMs,
      processingDurationSec: totalProcessingDurationSec,
    };
  } finally {
    // Clean up temporary FLAC files
    for (const chunk of chunks) {
      if (chunk.isTemporaryChunk && fs.existsSync(chunk.path)) {
        try {
          fs.unlinkSync(chunk.path);
        } catch {
          // ignore cleanup error
        }
      }
    }
    if (fs.existsSync(tempFlacPath)) {
      try {
        fs.unlinkSync(tempFlacPath);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

/**
 * Optional helper for Module 2 (Clip Selection): Sample up to 3 representative JPEG frames from a local video
 * using FFmpeg so Gemini can inspect visual context alongside the Whisper transcript.
 */
export async function sampleVideoFramesForGemini(videoPath, count = 3) {
  if (!videoPath || !fs.existsSync(videoPath)) return [];
  const ext = path.extname(videoPath).toLowerCase();
  if (![".mp4", ".mov"].includes(ext)) return [];

  const framePaths = [];
  try {
    // Extract up to `count` frames spaced every 4 seconds at 512px width
    const pattern = `${videoPath}.frame-%d.jpg`;
    await runFfmpeg(
      [
        "-y",
        "-i",
        videoPath,
        "-vf",
        "fps=1/4,scale=512:-1",
        "-frames:v",
        String(count),
        "-q:v",
        "6",
        pattern,
      ],
      20_000
    );

    for (let i = 1; i <= count; i++) {
      const fp = `${videoPath}.frame-${i}.jpg`;
      if (fs.existsSync(fp)) {
        framePaths.push(fp);
      }
    }

    const inlineParts = framePaths.map((fp) => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: fs.readFileSync(fp).toString("base64"),
      },
    }));

    return inlineParts;
  } catch (err) {
    console.warn(`[Frame Sampling Skipped] ${err.message}`);
    return [];
  } finally {
    for (const fp of framePaths) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        // ignore
      }
    }
  }
}
