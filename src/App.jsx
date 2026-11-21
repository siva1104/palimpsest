import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Scissors,
  Brain,
  Calendar as CalendarIcon,
  BarChart3,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  TrendingUp,
  Edit3,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Play,
  AudioWaveform,
  Pencil,
  Share2,
  Settings,
  X,
} from "lucide-react";
import palimpsestLogo from "./assets/logo.webp";
import {
  INITIAL_BRAND_PROFILE,
  SAMPLE_RECORDINGS,
  INITIAL_CALENDAR_ITEMS,
} from "./data/mockStudioData";
import {
  uploadProjectMedia,
  getTranscriptionStatus,
  getProjects,
  renameProject,
  generateClips,
  regenerateCopy,
  getBrandProfile,
  updateBrandProfile,
  learnFromEdit,
  getCalendar,
  scheduleCalendarItem,
  updateCalendarItem,
  getPerformanceInsights,
  updateCalendarMetrics,
  recalibratePerformance,
} from "./services/api";

const TRANSCRIPTION_STAGES = [
  { key: "extracting_audio", label: "Extracting audio" },
  { key: "transcribing_audio", label: "Transcribing audio" },
  { key: "combining_segments", label: "Combining transcript segments" },
  { key: "transcript_ready", label: "Transcript ready" },
];

// Strictly 3 steps in the upload & project creation wizard
const WIZARD_STEPS = [1, 2, 3];

// Left Sidebar Navigation Items in exact workflow sequence
const SIDEBAR_NAV_ITEMS = [
  { id: "video", label: "Video", icon: Play },
  { id: "clips", label: "Clip Selection", icon: Scissors },
  { id: "copy", label: "Platform Copy", icon: Edit3 },
  { id: "memory", label: "Brand Memory", icon: Brain },
  { id: "calendar", label: "Content Calendar", icon: CalendarIcon },
  { id: "performance", label: "Performance Loop", icon: BarChart3 },
  { id: "platforms", label: "Connected Platforms", icon: Share2 },
];

const PLATFORM_META = {
  youtube_shorts: {
    name: "YouTube Shorts",
    badge: "bg-red-50 text-red-700 border-red-200",
    activeBtn: "bg-[#2563EB] text-white border-[#2563EB] shadow-xs",
  },
  instagram: {
    name: "Instagram Reels",
    badge: "bg-pink-50 text-pink-700 border-pink-200",
    activeBtn: "bg-[#2563EB] text-white border-[#2563EB] shadow-xs",
  },
  tiktok: {
    name: "TikTok",
    badge: "bg-gray-100 text-gray-800 border-gray-200",
    activeBtn: "bg-[#2563EB] text-white border-[#2563EB] shadow-xs",
  },
  linkedin: {
    name: "LinkedIn",
    badge: "bg-[#EFF6FF] text-[#2563EB] border-blue-200",
    activeBtn: "bg-[#2563EB] text-white border-[#2563EB] shadow-xs",
  },
};

function extractTitleOnlyFromFile(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function extractYouTubeVideoId(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const regExp =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

function MiniCircularProgress({ score }) {
  const radius = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg className="w-3.5 h-3.5 -rotate-90 shrink-0" viewBox="0 0 14 14">
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke="#A7F3D0"
        strokeWidth="2"
      />
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlatformLogo({ platformId, className = "w-5 h-5" }) {
  if (platformId === "youtube_shorts") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <path
          d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
          fill="#FF0000"
        />
        <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FFFFFF" />
      </svg>
    );
  }
  if (platformId === "instagram") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <defs>
          <radialGradient
            id="igGrad"
            cx="30%"
            cy="107%"
            r="150%"
            fx="30%"
            fy="107%"
          >
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#igGrad)" />
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="4.5"
          stroke="#FFFFFF"
          strokeWidth="1.8"
        />
        <circle
          cx="12"
          cy="12"
          r="3.8"
          stroke="#FFFFFF"
          strokeWidth="1.8"
        />
        <circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" />
      </svg>
    );
  }
  if (platformId === "tiktok") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#000000" />
        <path
          d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }
  if (platformId === "linkedin") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#0A66C2" />
        <path
          d="M7.12 9.88H4.18v9.48h2.94V9.88zm.19-2.93c0-.95-.7-1.71-1.67-1.71-.98 0-1.66.76-1.66 1.71 0 .93.67 1.71 1.63 1.71h.02c.99 0 1.68-.78 1.68-1.71zm12.51 6.99c0-2.91-1.55-4.26-3.62-4.26-1.67 0-2.42.92-2.84 1.56v-1.36H10.4c.04.89 0 9.48 0 9.48h2.95v-5.3c0-.28.02-.57.1-.77.23-.57.74-1.15 1.61-1.15 1.14 0 1.59.86 1.59 2.13v5.09h2.95v-5.42z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }
  return null;
}

export default function App() {
  // "wizard" = 3-Step Upload & Project Creation flow (Step 1, Step 2, Step 3)
  // "studio" = Main Studio App Shell (2-column layout: Connected Logo+Sidebar on left, Project Header + Content on right)
  const [viewMode, setViewMode] = useState("wizard");
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState("video");
  const [toast, setToast] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Step 1 & Step 2: Lightweight title-only metadata read before full load
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [isFetchingYtTitle, setIsFetchingYtTitle] = useState(false);
  const [pendingUpload, setPendingUpload] = useState({
    file: null,
    youtubeId: null,
    youtubeUrl: null,
    fileName: SAMPLE_RECORDINGS[0].fileName,
    extractedTitle: SAMPLE_RECORDINGS[0].extractedTitle,
    format: SAMPLE_RECORDINGS[0].format,
    fileSize: SAMPLE_RECORDINGS[0].fileSize,
    duration: SAMPLE_RECORDINGS[0].duration,
    sampleId: SAMPLE_RECORDINGS[0].id,
  });

  // Step 2: Project Title state & inline edit state
  const [projectTitleInput, setProjectTitleInput] = useState(
    SAMPLE_RECORDINGS[0].extractedTitle
  );
  const [isStep2Editing, setIsStep2Editing] = useState(false);
  const step2TitleInputRef = useRef(null);

  // Step 3: "Checking Video" real backend upload & transcription state
  const [isCheckingVideo, setIsCheckingVideo] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [transcriptionStageKey, setTranscriptionStageKey] =
    useState("extracting_audio");

  // Projects State
  const [projects, setProjects] = useState(() =>
    SAMPLE_RECORDINGS.map((rec) => ({
      ...rec,
      projectTitle: rec.extractedTitle,
      videoUrl: null,
    }))
  );
  const [activeProjectId, setActiveProjectId] = useState(
    SAMPLE_RECORDINGS[0].id
  );
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState(
    SAMPLE_RECORDINGS[0].extractedTitle
  );

  // Clip Selection & Platform Copy State
  const [selectedClipId, setSelectedClipId] = useState(
    SAMPLE_RECORDINGS[0].clips[0].id
  );
  const [activePlatform, setActivePlatform] = useState("youtube_shorts");
  const [draftHook, setDraftHook] = useState("");
  const [draftCaption, setDraftCaption] = useState("");
  const [lastEditDiff, setLastEditDiff] = useState(null);

  // Brand-Voice Memory (localStorage persisted)
  const [brandProfile, setBrandProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("palimpsest_brand_v2");
      return saved ? JSON.parse(saved) : INITIAL_BRAND_PROFILE;
    } catch {
      return INITIAL_BRAND_PROFILE;
    }
  });
  const [newVocab, setNewVocab] = useState("");

  // Content Calendar & Performance Feedback Loop (localStorage persisted)
  const [calendarItems, setCalendarItems] = useState(() => {
    try {
      const saved = localStorage.getItem("palimpsest_calendar_v2");
      return saved ? JSON.parse(saved) : INITIAL_CALENDAR_ITEMS;
    } catch {
      return INITIAL_CALENDAR_ITEMS;
    }
  });
  const [scheduleDate, setScheduleDate] = useState("2026-11-25");

  const [boostedPattern, setBoostedPattern] = useState("Myth-Busting");
  const [loopSummary, setLoopSummary] = useState(
    'Top pattern: "Myth-Busting" averages 14,800 views & 310 shares (3.4x higher share-to-view ratio).'
  );

  // Connected Platforms State (showing Profile, Name, and ID for all platforms)
  const [connectedPlatforms, setConnectedPlatforms] = useState([
    {
      id: "youtube_shorts",
      name: "YouTube Shorts",
      profileName: "Siva1104",
      accountId: "@siva1104_yt",
      connected: true,
    },
    {
      id: "instagram",
      name: "Instagram Reels",
      profileName: "Siva1104",
      accountId: "@siva1104.ig",
      connected: true,
    },
    {
      id: "tiktok",
      name: "TikTok",
      profileName: "Siva1104",
      accountId: "@siva1104_tt",
      connected: false,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      profileName: "Siva1104",
      accountId: "in/siva1104",
      connected: true,
    },
  ]);

  const [isGeneratingClips, setIsGeneratingClips] = useState(false);

  // Hydrate on App Load from Express + Gemini Server (with local fallback)
  useEffect(() => {
    async function hydrate() {
      try {
        const [brandRes, calRes, perfRes, projRes] = await Promise.all([
          getBrandProfile(),
          getCalendar(),
          getPerformanceInsights(),
          getProjects(),
        ]);
        if (brandRes.brandProfile) setBrandProfile(brandRes.brandProfile);
        if (calRes.calendarItems?.length) {
          setCalendarItems(calRes.calendarItems);
        }
        if (perfRes.performanceInsights) {
          setBoostedPattern(perfRes.performanceInsights.topAngle);
          setLoopSummary(perfRes.performanceInsights.summary);
        }
        if (projRes.projects?.length) {
          const normalized = projRes.projects.map((p) => ({
            ...p,
            projectTitle: p.projectName || p.projectTitle || p.fileName,
            clips: p.clips?.length ? p.clips : SAMPLE_RECORDINGS[0].clips,
          }));
          setProjects(normalized);
          setActiveProjectId(normalized[0].id);
          if (normalized[0].clips?.[0]) {
            setSelectedClipId(normalized[0].clips[0].id);
          }
        }
      } catch (err) {
        console.error("Hydration failed, using local fallback:", err);
      }
    }
    hydrate();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("palimpsest_brand_v2", JSON.stringify(brandProfile));
      updateBrandProfile(brandProfile).catch(() => {});
    } catch {
      // ignore storage errors
    }
  }, [brandProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "palimpsest_calendar_v2",
        JSON.stringify(calendarItems)
      );
    } catch {
      // ignore storage errors
    }
  }, [calendarItems]);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeClip =
    activeProject.clips.find((c) => c.id === selectedClipId) ||
    activeProject.clips[0];

  useEffect(() => {
    if (activeProject) {
      setProjectTitleDraft(activeProject.projectTitle);
    }
  }, [activeProject]);

  useEffect(() => {
    if (activeClip && activeClip.platforms[activePlatform]) {
      setDraftHook(activeClip.platforms[activePlatform].hook);
      setDraftCaption(activeClip.platforms[activePlatform].caption);
    }
  }, [activeClip, activePlatform]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Reset & Return to Step 1 (Upload Video)
  const handleResetToStep1 = () => {
    setIsCheckingVideo(false);
    setIsStep2Editing(false);
    setIsEditingProjectTitle(false);
    setViewMode("wizard");
    setCurrentStep(1);
  };

  // ==========================================================================
  // STEP 1: UPLOAD VIDEO OR YOUTUBE LINK (READ ONLY TITLE FIRST -> AUTO STEP 2)
  // ==========================================================================
  const handleStep1FileReadTitleOnly = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toUpperCase();
    if (!["MP4", "MOV", "MP3", "WAV"].includes(ext)) {
      showToast("Supported formats: MP4, MOV, MP3, and WAV.");
      return;
    }

    const extractedTitle = extractTitleOnlyFromFile(file.name);
    const sizeMB = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    setPendingUpload({
      file,
      youtubeId: null,
      youtubeUrl: null,
      fileName: file.name,
      extractedTitle,
      format: ext,
      fileSize: sizeMB,
      duration: "24:18",
      sampleId: null,
    });
    setProjectTitleInput(extractedTitle);
    setIsStep2Editing(false);

    // Immediately advance to Step 2
    setCurrentStep(2);
  };

  const handleYouTubeLinkImport = async (e) => {
    if (e) e.preventDefault();
    const videoId = extractYouTubeVideoId(youtubeUrlInput);
    if (!videoId) {
      showToast("Please enter a valid YouTube link.");
      return;
    }

    setIsFetchingYtTitle(true);
    let fetchedTitle = `YouTube Video (${videoId})`;
    try {
      const res = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) {
          fetchedTitle = data.title;
        }
      }
    } catch {
      // fallback to clean videoId title if offline
    }
    setIsFetchingYtTitle(false);

    setPendingUpload({
      file: null,
      youtubeId: videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      fileName: `youtube.com/watch?v=${videoId}`,
      extractedTitle: fetchedTitle,
      format: "YOUTUBE",
      fileSize: "Stream",
      duration: "24:18",
      sampleId: null,
    });
    setProjectTitleInput(fetchedTitle);
    setIsStep2Editing(false);
    setCurrentStep(2);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleStep1FileReadTitleOnly(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleStep1FileReadTitleOnly(file);
    }
  };

  // ==========================================================================
  // STEP 2 -> STEP 3: Real Upload + Video-to-Text Extraction
  // ==========================================================================
  const handleCreateProjectAndContinue = async () => {
    const projectName = projectTitleInput.trim();
    if (!projectName) {
      showToast("Please enter a project title.");
      return;
    }

    const uploadedFile = pendingUpload.file;
    if (!uploadedFile || !(uploadedFile instanceof File)) {
      showToast("Please upload a real MP4, MOV, MP3, or WAV file first.");
      return;
    }

    const jobId = `job-${Date.now()}`;
    setIsStep2Editing(false);
    setExtractionError(null);
    setTranscriptionStageKey("extracting_audio");
    setCurrentStep(3);
    setIsCheckingVideo(true);

    const pollInterval = setInterval(async () => {
      try {
        const status = await getTranscriptionStatus(jobId);
        if (status?.stageKey && status.stageKey !== "error") {
          setTranscriptionStageKey(status.stageKey);
        }
      } catch {
        // ignore transient poll error while upload completes
      }
    }, 350);

    try {
      console.log("Sending file to backend:", uploadedFile.name);
      const { project } = await uploadProjectMedia(
        uploadedFile,
        projectName,
        jobId
      );
      clearInterval(pollInterval);
      setTranscriptionStageKey("transcript_ready");
      console.log("Backend returned project:", project);

      const newProj = {
        ...project,
        projectTitle: project.projectName || projectName,
        videoUrl: project.videoUrl,
        transcript: project.transcript || "",
        clips: project.clips || [],
        youtubeId: null,
      };

      setIsCheckingVideo(false);
      setProjects((prev) => [newProj, ...prev]);
      setActiveProjectId(newProj.id);

      setViewMode("studio");
      setActiveTab("video");
      showToast(
        `Transcript ready${
          project.processingDurationSec
            ? ` in ${project.processingDurationSec}s`
            : ""
        }! Now click Generate Clips.`
      );
    } catch (err) {
      clearInterval(pollInterval);
      console.error("Upload/Extraction Error:", err);
      const errorMessage =
        err?.message || "Failed to extract transcript from video.";
      setExtractionError(errorMessage);
      setIsCheckingVideo(false);
      showToast(`Extraction failed: ${errorMessage}`);
    }
  };

  // VIDEO TAB -> CLIP SELECTION: Real AI Clip Generation
  const handleGenerateClips = async () => {
    if (!activeProject?.id) {
      showToast("No active project found.");
      return;
    }

    setIsGeneratingClips(true);
    try {
      const { clips } = await generateClips(activeProject.id);
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProject.id ? { ...p, clips } : p))
      );
      if (clips[0]) setSelectedClipId(clips[0].id);
      setActiveTab("clips");
      showToast(`Generated ${clips.length} ranked clips!`);
    } catch (err) {
      console.error("Clip generation failed:", err);
      showToast(`Clip generation failed: ${err.message}`);
    } finally {
      setIsGeneratingClips(false);
    }
  };

  const handleSaveProjectTitle = async () => {
    const cleaned = projectTitleDraft.trim();
    if (!cleaned) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id ? { ...p, projectTitle: cleaned } : p
      )
    );
    setProjectTitleInput(cleaned);
    setIsEditingProjectTitle(false);
    try {
      await renameProject(activeProject.id, cleaned);
    } catch {
      // local state already updated
    }
    showToast("Project title updated.");
  };

  // ==========================================================================
  // SAVE EDIT & UPDATE BRAND-VOICE MEMORY (POST /api/brand/learn)
  // ==========================================================================
  const handleSaveEditAndLeaveTrace = async () => {
    if (!activeClip) return;
    const original = activeClip.platforms[activePlatform];
    const hookChanged = original.hook.trim() !== draftHook.trim();
    const captionChanged = original.caption.trim() !== draftCaption.trim();

    setProjects((prev) =>
      prev.map((p) =>
        p.id !== activeProject.id
          ? p
          : {
              ...p,
              clips: p.clips.map((c) =>
                c.id !== activeClip.id
                  ? c
                  : {
                      ...c,
                      platforms: {
                        ...c.platforms,
                        [activePlatform]: {
                          hook: draftHook,
                          caption: draftCaption,
                        },
                      },
                    }
              ),
            }
      )
    );

    try {
      const { brandProfile: updatedBrand, learnedRule } = await learnFromEdit({
        projectId: activeProject.id,
        clipId: activeClip.id,
        platform: activePlatform,
        originalHook: original.hook,
        editedHook: draftHook,
        originalCaption: original.caption,
        editedCaption: draftCaption,
      });
      if (updatedBrand) {
        setBrandProfile(updatedBrand);
      }
      if (learnedRule?.rule) {
        setLastEditDiff({
          platform: PLATFORM_META[activePlatform].name,
          detectedRule: learnedRule.rule,
          prefType: learnedRule.preferenceType || "Writing Style",
        });
      }
      showToast("Trace saved to Brand-Voice Memory.");
      return;
    } catch (err) {
      console.error("Backend learnFromEdit fallback:", err);
    }

    let detectedRule = `Prefer creator's edited ${PLATFORM_META[activePlatform].name} hook cadence and phrasing.`;
    let prefType = "Writing Style";

    if (!draftCaption.includes("#") && original.caption.includes("#")) {
      detectedRule = `Remove hashtags on ${PLATFORM_META[activePlatform].name} for a clean editorial finish.`;
      prefType = "Vocabulary";
    } else if (draftCaption.length < original.caption.length - 12) {
      detectedRule = `Tighten ${PLATFORM_META[activePlatform].name} captions by trimming secondary filler.`;
      prefType = "Tone";
    } else if (draftHook.endsWith("?") && !original.hook.endsWith("?")) {
      detectedRule = `Frame ${PLATFORM_META[activePlatform].name} hooks as direct questions.`;
      prefType = "Writing Style";
    } else if (hookChanged || captionChanged) {
      detectedRule = `Adopt custom ${PLATFORM_META[activePlatform].name} voice: "${draftHook.slice(0, 44)}${draftHook.length > 44 ? "..." : ""}"`;
      prefType = "Tone";
    }

    setLastEditDiff({
      platform: PLATFORM_META[activePlatform].name,
      detectedRule,
      prefType,
    });

    setBrandProfile((prev) => {
      const existingIdx = prev.learnedRules.findIndex(
        (r) => r.rule === detectedRule
      );
      if (existingIdx > -1) {
        const updated = [...prev.learnedRules];
        updated[existingIdx] = {
          ...updated[existingIdx],
          patternCount: updated[existingIdx].patternCount + 1,
          updatedAt: "Just now",
        };
        return { ...prev, learnedRules: updated };
      }
      return {
        ...prev,
        learnedRules: [
          {
            id: `rule-${Date.now()}`,
            rule: detectedRule,
            preferenceType: prefType,
            patternCount: 1,
            updatedAt: "Just now",
          },
          ...prev.learnedRules,
        ],
      };
    });

    showToast("Trace saved to Brand-Voice Memory.");
  };

  // ==========================================================================
  // REGENERATE COPY (POST /api/clips/:clipId/copy)
  // ==========================================================================
  const handleRegenerateWithMemory = async () => {
    if (!activeClip) return;
    try {
      const { hook, caption } = await regenerateCopy(activeClip.id, {
        projectId: activeProject.id,
        platform: activePlatform,
        clipTitle: activeClip.title,
        quote: activeClip.quote,
      });
      if (hook) setDraftHook(hook);
      if (caption) setDraftCaption(caption);
      showToast("Regenerated copy using Brand-Voice Memory.");
      return;
    } catch (err) {
      console.error("Backend regenerateCopy fallback:", err);
    }

    const topRule =
      brandProfile.learnedRules[0]?.rule ||
      "Open with a bold contrarian observation.";
    const signatureWord = brandProfile.vocabulary[0] || "clarity";

    const regeneratedHooks = {
      youtube_shorts: `The Truth About ${activeClip.title}`,
      instagram: `Stop falling for this myth: ${activeClip.title}.`,
      tiktok: `Here is what nobody tells you about ${activeClip.title.toLowerCase()}:`,
      linkedin: `${activeClip.quote.split(".")[0]}.`,
    };

    setDraftHook(regeneratedHooks[activePlatform]);
    setDraftCaption(
      `${activeClip.quote}\n\n[Applied Memory Trace (${signatureWord}): ${topRule}]`
    );
    showToast("Regenerated copy using Brand-Voice Memory.");
  };

  // ==========================================================================
  // CONTENT CALENDAR & PERFORMANCE FEEDBACK LOOP
  // ==========================================================================
  const handleScheduleClip = async () => {
    if (!activeClip) return;
    const payload = {
      clipTitle: activeClip.title,
      patternTag: activeClip.patternTag,
      platform: activePlatform,
      date: scheduleDate,
      status: "Scheduled",
      hook: draftHook,
      caption: draftCaption,
    };

    try {
      const res = await scheduleCalendarItem(payload);
      if (res.calendarItems) {
        setCalendarItems(res.calendarItems);
      }
    } catch {
      const newItem = {
        id: `cal-${Date.now()}`,
        ...payload,
        metrics: { views: 0, likes: 0, comments: 0, shares: 0 },
      };
      setCalendarItems((prev) => [newItem, ...prev]);
    }

    showToast(`Scheduled "${activeClip.title}" for ${scheduleDate}.`);
    setActiveTab("calendar");
  };

  const handleUpdateFutureRecommendations = async () => {
    try {
      const res = await recalibratePerformance();
      if (res.performanceInsights) {
        setBoostedPattern(res.performanceInsights.topAngle);
        setLoopSummary(res.performanceInsights.summary);
      }
      if (res.projects?.length) {
        const normalized = res.projects.map((p) => ({
          ...p,
          projectTitle: p.projectName || p.projectTitle || p.fileName,
          clips: p.clips?.length ? p.clips : SAMPLE_RECORDINGS[0].clips,
        }));
        setProjects(normalized);
      }
      showToast(
        `Recalibrated clip rankings around "${
          res.performanceInsights?.topAngle || boostedPattern
        }".`
      );
      return;
    } catch (err) {
      console.error("Backend recalibrate fallback:", err);
    }

    const published = calendarItems.filter((i) => i.status === "Published");
    if (published.length === 0) return;

    const scored = [...published].map((item) => ({
      ...item,
      weightedScore:
        item.metrics.views +
        item.metrics.likes * 5 +
        item.metrics.comments * 12 +
        item.metrics.shares * 20,
    }));

    scored.sort((a, b) => b.weightedScore - a.weightedScore);
    const winner = scored[0];

    setBoostedPattern(winner.patternTag);
    setLoopSummary(
      `Top Performer: "${winner.clipTitle}" (${winner.metrics.views.toLocaleString()} views, ${winner.metrics.shares} shares). Prioritizing "${winner.patternTag}".`
    );

    setProjects((prev) =>
      prev.map((p) => {
        const recalibrated = [...p.clips]
          .map((clip) => {
            const isWinner = clip.patternTag === winner.patternTag;
            const newScore = isWinner
              ? Math.min(99, clip.engagementScore + 3)
              : clip.engagementScore;
            return {
              ...clip,
              engagementScore: newScore,
            };
          })
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .map((clip, idx) => ({
            ...clip,
            rank: idx + 1,
          }));
        return { ...p, clips: recalibrated };
      })
    );

    showToast(`Recalibrated clip rankings around "${winner.patternTag}".`);
  };

  const publishedItems = calendarItems.filter((i) => i.status === "Published");

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-gray-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#111827] text-white px-3.5 py-2.5 rounded-lg shadow-lg border border-gray-800 flex items-center gap-2 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* =====================================================================
          VIEW MODE 1: 3-STEP CENTERED WIZARD FLOW (STEPS 1 TO 3)
      ====================================================================== */}
      {viewMode === "wizard" && (
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-40 w-full h-[76px] bg-white border-b border-[#E5E7EB]">
            <div className="relative w-full px-6 h-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToStep1}
                className="shrink-0 focus:outline-none cursor-pointer z-10"
                aria-label="Palimpsest Home"
              >
                <img
                  src={palimpsestLogo}
                  alt="Palimpsest"
                  className="h-12 sm:h-14 w-auto object-contain"
                />
              </button>

              <nav
                aria-label="Wizard Progress"
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center py-1 px-2"
              >
                {WIZARD_STEPS.map((stepNum, idx) => {
                  const isActive = currentStep === stepNum;
                  const isCompleted = currentStep > stepNum;
                  return (
                    <React.Fragment key={stepNum}>
                      <button
                        type="button"
                        onClick={() => {
                          if (stepNum === 3) {
                            handleCreateProjectAndContinue();
                          } else {
                            setCurrentStep(stepNum);
                          }
                        }}
                        className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                          isActive
                            ? "bg-[#2563EB] text-white shadow-xs"
                            : isCompleted
                            ? "bg-[#059669] text-white"
                            : "bg-gray-100 text-gray-600 border border-[#E5E7EB] hover:bg-gray-200/70"
                        }`}
                      >
                        Step {stepNum}
                      </button>
                      {idx < WIZARD_STEPS.length - 1 && (
                        <div
                          className={`w-8 sm:w-12 h-0.5 mx-1.5 rounded-full transition-colors ${
                            currentStep > stepNum
                              ? "bg-[#059669]"
                              : "bg-gray-200"
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={handleResetToStep1}
                title="Reset and return to Step 1"
                aria-label="Reset and return to Step 1"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border border-[#E5E7EB] flex items-center justify-center transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 w-full px-6 py-8 flex items-center justify-center">
            {/* STEP 1 CARD — HEADING: "Upload Video or Podcast" */}
            {currentStep === 1 && (
              <div className="max-w-xl w-full">
                <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 space-y-6">
                  <div className="text-center space-y-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold">
                      Step 1 of 3
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                      Upload Video or Podcast
                    </h1>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Drop your recording below. We read only the video or audio title first and immediately advance to Step 2.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`rounded-xl border-2 border-dashed p-10 text-center transition-all ${
                      isDragging
                        ? "border-[#2563EB] bg-[#EFF6FF]/50"
                        : "border-gray-300 hover:border-[#2563EB] bg-[#F9FAFB]"
                    }`}
                  >
                    <label className="cursor-pointer flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white shadow-sm flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          Supports MP4, MOV, MP3, and WAV
                        </p>
                      </div>

                      <input
                        type="file"
                        accept=".mp4,.mov,.mp3,.wav,video/mp4,video/quicktime,audio/mpeg,audio/wav"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* OR Divider */}
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-[#E5E7EB]" />
                    <span className="shrink-0 mx-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      OR PASTE YOUTUBE LINK
                    </span>
                    <div className="flex-grow border-t border-[#E5E7EB]" />
                  </div>

                  {/* YouTube Link Input Bar */}
                  <form
                    onSubmit={handleYouTubeLinkImport}
                    className="flex items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center">
                        <PlatformLogo
                          platformId="youtube_shorts"
                          className="w-4 h-4"
                        />
                      </span>
                      <input
                        type="text"
                        value={youtubeUrlInput}
                        onChange={(e) => setYoutubeUrlInput(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] focus:bg-white focus:border-[#2563EB] text-xs sm:text-sm font-medium text-gray-900 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isFetchingYtTitle}
                      className="h-[42px] px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    >
                      {isFetchingYtTitle ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Get Video</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* STEP 2 CARD — HEADING: "Create Project" */}
            {currentStep === 2 && (
              <div className="max-w-xl w-full">
                <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 space-y-6">
                  <div className="text-center space-y-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      Step 2 of 3
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                      Create Project
                    </h1>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="step2-project-title"
                        className="text-xs font-semibold uppercase tracking-wider text-gray-500"
                      >
                        Project Title
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsStep2Editing(true);
                          setTimeout(
                            () => step2TitleInputRef.current?.focus(),
                            20
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#EFF6FF] hover:bg-blue-100 text-[#2563EB] text-xs font-semibold transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                    </div>

                    <input
                      id="step2-project-title"
                      ref={step2TitleInputRef}
                      type="text"
                      value={projectTitleInput}
                      onChange={(e) => setProjectTitleInput(e.target.value)}
                      onFocus={() => setIsStep2Editing(true)}
                      placeholder="Enter project title..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold text-gray-900 transition focus:outline-none ${
                        isStep2Editing
                          ? "border-[#2563EB] bg-white ring-2 ring-blue-600/15"
                          : "border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white"
                      }`}
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateProjectAndContinue}
                      className="flex-1 py-2.5 px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Create Project & Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 CARD — HEADING: "Checking Video" */}
            {currentStep === 3 && (
              <div className="max-w-xl w-full">
                <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold">
                        {isCheckingVideo ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : extractionError ? (
                          <X className="w-3 h-3 text-red-600" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                        )}
                        Step 3 of 3
                      </span>
                      <span
                        className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          extractionError
                            ? "bg-red-50 text-red-700"
                            : isCheckingVideo
                            ? "bg-[#EFF6FF] text-[#2563EB]"
                            : "bg-[#ECFDF5] text-[#059669]"
                        }`}
                      >
                        {extractionError
                          ? "Error"
                          : TRANSCRIPTION_STAGES.find(
                              (s) => s.key === transcriptionStageKey
                            )?.label || "Extracting audio"}
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                      Checking Video
                    </h1>
                  </div>

                  {/* 4 Real Processing Stages */}
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-2.5">
                    {TRANSCRIPTION_STAGES.map((stage, idx) => {
                      const activeIndex = TRANSCRIPTION_STAGES.findIndex(
                        (s) => s.key === transcriptionStageKey
                      );
                      const isCompleted =
                        !extractionError &&
                        (idx < activeIndex ||
                          (!isCheckingVideo &&
                            transcriptionStageKey === "transcript_ready"));
                      const isCurrent =
                        !extractionError &&
                        isCheckingVideo &&
                        idx === activeIndex;

                      return (
                        <div
                          key={stage.key}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                            isCurrent
                              ? "bg-[#EFF6FF] text-[#2563EB] border border-blue-200"
                              : isCompleted
                              ? "bg-[#ECFDF5] text-[#059669]"
                              : "text-gray-500"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                            ) : isCurrent ? (
                              <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                            )}
                            <span>{stage.label}</span>
                          </div>
                          <span className="text-[11px] font-mono">
                            {isCompleted
                              ? "Done"
                              : isCurrent
                              ? "In progress"
                              : "Pending"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {extractionError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left space-y-1.5">
                      <p className="text-xs font-bold text-red-800">
                        Transcript Extraction Failed
                      </p>
                      <p className="text-xs text-red-700 break-words leading-relaxed">
                        {extractionError}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setExtractionError(null);
                        setCurrentStep(2);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>

                    {extractionError ? (
                      <button
                        type="button"
                        onClick={handleCreateProjectAndContinue}
                        className="flex-1 py-2.5 px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Extraction</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isCheckingVideo}
                        onClick={() => {
                          setViewMode("studio");
                          setActiveTab("video");
                        }}
                        className={`flex-1 py-2.5 px-5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          isCheckingVideo
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                        }`}
                      >
                        <span>Continue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* =====================================================================
          VIEW MODE 2: APP SHELL (2 COLUMNS: CONNECTED LOGO+SIDEBAR + RIGHT MAIN AREA)
      ====================================================================== */}
      {viewMode === "studio" && (
        <div className="min-h-screen flex flex-col md:flex-row bg-[#F9FAFB]">
          {/* =================================================================
              1. LEFT SIDEBAR (260px, 100vh, white bg, border-right #E5E7EB, flex-col justify-between)
              - HEADER: Palimpsest logo inside sidebar
              - NAV: Video, Clip Selection, Platform Copy, Brand Memory, Content Calendar, Performance Loop, Connected Platforms
              - BOTTOM: Profile card ("Siva1104", Pro Plan)
          ================================================================== */}
          <aside className="w-full md:w-[260px] md:h-screen md:sticky md:top-0 bg-white border-b md:border-b-0 md:border-r border-[#E5E7EB] flex flex-col justify-between shrink-0 z-40">
            <div>
              {/* SIDEBAR HEADER — LOGO IS INSIDE SIDEBAR */}
              <div className="h-[76px] border-b border-[#F3F4F6] px-[16px] flex items-center">
                <button
                  type="button"
                  onClick={handleResetToStep1}
                  className="flex items-center focus:outline-none cursor-pointer"
                  aria-label="Palimpsest"
                >
                  <img
                    src={palimpsestLogo}
                    alt="Palimpsest"
                    className="h-12 sm:h-14 w-auto object-contain"
                  />
                </button>
              </div>

              {/* SIDEBAR NAV (padding 12px, gap 4px) */}
              <nav className="p-[12px] flex flex-col gap-[4px]">
                {SIDEBAR_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full h-[36px] px-3 rounded-[8px] text-[13px] font-medium flex items-center gap-2.5 transition text-left cursor-pointer ${
                        isActive
                          ? "bg-[#2563EB] text-white shadow-2xs"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* SIDEBAR BOTTOM: Profile Card */}
            <div className="p-[12px] border-t border-[#F3F4F6]">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`w-full border rounded-[10px] p-2.5 flex items-center justify-between transition text-left cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-[#EFF6FF] border-blue-200"
                    : "bg-[#F9FAFB] hover:bg-gray-100 border-[#E5E7EB]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-[36px] h-[36px] rounded-full bg-gradient-to-tr from-[#2563EB] to-blue-400 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    S
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111827] truncate leading-tight">
                      Siva1104
                    </p>
                    <p className="text-[11px] text-[#6B7280] truncate leading-tight mt-0.5">
                      Pro Plan
                    </p>
                  </div>
                </div>
                <Settings className="w-4 h-4 text-[#6B7280] shrink-0" />
              </button>
            </div>
          </aside>

          {/* =================================================================
              2. RIGHT MAIN AREA (flex-1, bg #F9FAFB, flex-col)
          ================================================================== */}
          <div className="flex-1 min-w-0 bg-[#F9FAFB] flex flex-col">
            {/* PROJECT HEADER CARD AT THE TOP (white card, border #E5E7EB, radius 12px, padding 20px 24px, margin 16px 24px 0 24px) */}
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] py-[18px] px-[24px] mt-[16px] mx-[24px] flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  PROJECT
                </div>

                {/* Title row: "Why Boosting Instagram Posts Wastes Money" 18px bold #111827 + Edit pencil icon 12px ghost button */}
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {isEditingProjectTitle ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={projectTitleDraft}
                        onChange={(e) => setProjectTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveProjectTitle();
                        }}
                        className="px-2.5 py-1 text-[16px] font-bold bg-white border border-[#2563EB] rounded-md focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveProjectTitle}
                        className="h-7 px-2.5 bg-[#059669] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-[18px] font-bold text-[#111827] leading-tight">
                        {activeProject.projectTitle}
                      </h1>
                      <button
                        type="button"
                        onClick={() => setIsEditingProjectTitle(true)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 transition cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Meta row (margin-top 8px, gap 8px) */}
                <div className="mt-[8px] flex flex-wrap items-center gap-[8px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-semibold inline-flex items-center gap-1">
                    <AudioWaveform className="w-3 h-3" />
                    {brandProfile.learnedRules.length} Voice Traces
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Top Angle: {boostedPattern}
                  </span>
                </div>
              </div>

              {/* Right Side of Project Header: "New Video Project" Action Button */}
              <button
                type="button"
                onClick={handleResetToStep1}
                className="h-[36px] px-4 rounded-[8px] bg-[#111827] hover:bg-gray-800 text-white text-[12px] font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Video Project</span>
              </button>
            </div>

            {/* CONTENT AREA (padding 20px 24px) */}
            <div className="px-[24px] py-[20px] flex-1">
              {/* =============================================================
                  VIEW 1: VIDEO (LOADED VIDEO & TRANSCRIPT — NO PAGE SCROLL)
              ============================================================== */}
              {activeTab === "video" && (
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 h-[calc(100vh-175px)] min-h-[420px] flex flex-col justify-between gap-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1 min-h-0">
                    <div className="lg:col-span-6 flex flex-col min-h-0 space-y-2">
                      <h2 className="text-sm font-bold text-gray-900 shrink-0">
                        Video
                      </h2>
                      <div className="rounded-xl overflow-hidden bg-gray-950 flex-1 min-h-0 border border-gray-800 flex items-center justify-center">
                        {activeProject.youtubeId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${activeProject.youtubeId}?rel=0`}
                            title={activeProject.projectTitle}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full border-0"
                          />
                        ) : (
                          <video
                            src={activeProject.videoUrl || undefined}
                            controls
                            playsInline
                            className="w-full h-full object-contain"
                            poster="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><rect width='800' height='500' fill='%230f172a'/><circle cx='400' cy='230' r='44' fill='%232563eb' fill-opacity='0.25' stroke='%233b82f6' stroke-width='2.5'/><polygon points='390,210 390,250 422,230' fill='%23ffffff'/><text x='400' y='315' font-family='sans-serif' font-size='18' font-weight='bold' fill='%23f8fafc' text-anchor='middle'>Video Preview</text></svg>"
                          />
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-6 flex flex-col min-h-0 space-y-2">
                      <h2 className="text-sm font-bold text-gray-900 shrink-0">
                        Transcript
                      </h2>
                      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
                        {activeProject.transcript
                          .split("\n")
                          .map((line, index) => {
                            const match = line.match(
                              /^(\[\d{2}:\d{2}\])\s*(.*)$/
                            );
                            return (
                              <div
                                key={index}
                                className="p-3 rounded-lg bg-white border border-[#E5E7EB] flex items-start gap-2.5 text-xs sm:text-sm"
                              >
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] shrink-0">
                                  {match ? match[1] : `[0${index}:00]`}
                                </span>
                                <p className="text-gray-700 leading-relaxed">
                                  {match ? match[2] : line}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E5E7EB] flex justify-center shrink-0">
                    <button
                      type="button"
                      disabled={isGeneratingClips}
                      onClick={handleGenerateClips}
                      className="h-10 px-7 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      {isGeneratingClips && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      <span>
                        {isGeneratingClips
                          ? "Generating Clips..."
                          : "Generate Clips"}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* =============================================================
                  VIEW 2: CLIP SELECTION (LONG CLIP CARDS)
              ============================================================== */}
              {activeTab === "clips" && (
                <div className="space-y-4">
                  <h2 className="text-[18px] font-bold text-gray-900">
                    Ranked Short-Form Clips & Selection Rationale
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {activeProject.clips.map((clip) => (
                      <div
                        key={clip.id}
                        className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 min-h-[440px] hover:shadow-md transition-shadow flex flex-col justify-between gap-5"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-[#111827] text-white text-[11px] font-semibold">
                              Rank #{clip.rank}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-semibold inline-flex items-center gap-1.5">
                              <MiniCircularProgress
                                score={clip.engagementScore}
                              />
                              {clip.engagementScore}/100
                            </span>
                          </div>

                          <h3 className="text-[16px] font-bold text-gray-900 leading-snug">
                            {clip.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-500" />
                              {clip.startTime} - {clip.endTime}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-medium">
                              {clip.patternTag}
                            </span>
                          </div>

                          <blockquote className="text-[13px] italic text-[#4B5563] bg-[#F9FAFB] border-l-[3px] border-[#2563EB] p-3.5 rounded-r-lg leading-relaxed">
                            "{clip.quote}"
                          </blockquote>

                          <div className="bg-[#ECFDF5]/60 border border-emerald-200 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#059669] block">
                              Why Selected
                            </span>
                            <p className="text-[12px] text-gray-700 leading-relaxed">
                              {clip.reason}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClipId(clip.id);
                            setActiveTab("copy");
                          }}
                          className="w-full h-10 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-[13px] font-semibold flex items-center justify-center transition-all hover:-translate-y-0.5 cursor-pointer"
                        >
                          Generate & Edit Copy →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =============================================================
                  VIEW 3: PLATFORM COPY
              ============================================================== */}
              {activeTab === "copy" && activeClip && (
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[18px] font-bold text-[#111827]">
                      Platform Copy
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab("memory")}
                      className="h-8 px-3 rounded-full bg-[#ECFDF5] hover:bg-emerald-100 text-[#059669] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>
                        Brand Memory ({brandProfile.learnedRules.length} Traces) →
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#111827] text-white text-[11px] font-semibold">
                      Rank #{activeClip.rank}
                    </span>
                    <select
                      value={activeClip.id}
                      onChange={(e) => setSelectedClipId(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-xs font-semibold text-gray-900 focus:outline-none"
                    >
                      {activeProject.clips.map((c) => (
                        <option key={c.id} value={c.id}>
                          Rank #{c.rank}: {c.title} ({c.startTime} - {c.endTime}
                          )
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(PLATFORM_META).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActivePlatform(key)}
                        className={`h-9 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition cursor-pointer ${
                          activePlatform === key
                            ? meta.activeBtn
                            : "bg-white text-gray-700 border-[#E5E7EB] hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-5 h-5 rounded bg-white p-0.5 flex items-center justify-center shrink-0">
                          <PlatformLogo
                            platformId={key}
                            className="w-full h-full"
                          />
                        </span>
                        <span className="truncate">{meta.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1.5">
                        {PLATFORM_META[activePlatform].name} Hook
                      </label>
                      <input
                        type="text"
                        value={draftHook}
                        onChange={(e) => setDraftHook(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] focus:border-[#2563EB] text-sm font-semibold text-gray-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1.5">
                        Caption / Description
                      </label>
                      <textarea
                        rows={5}
                        value={draftCaption}
                        onChange={(e) => setDraftCaption(e.target.value)}
                        className="w-full p-3.5 rounded-lg border border-[#E5E7EB] focus:border-[#2563EB] text-sm text-gray-800 leading-relaxed focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEditAndLeaveTrace}
                        className="h-9 px-4 rounded-full bg-[#059669] hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Save Edit & Leave Trace
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateWithMemory}
                        className="h-9 px-3.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="h-9 font-mono px-3 rounded-lg border border-[#E5E7EB] text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleScheduleClip}
                        className="h-9 px-4 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        Schedule
                      </button>
                    </div>
                  </div>

                  {lastEditDiff && (
                    <div className="p-3 rounded-lg bg-[#ECFDF5] border border-emerald-200 text-xs text-[#059669] font-medium">
                      Trace Learned ({lastEditDiff.platform}):{" "}
                      {lastEditDiff.detectedRule}
                    </div>
                  )}
                </div>
              )}

              {/* =============================================================
                  VIEW 4: BRAND MEMORY (DEDICATED VIEW)
              ============================================================== */}
              {activeTab === "memory" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[18px] font-bold text-[#111827]">
                      Brand-Voice Memory
                    </h2>
                    <span className="h-6 px-3 rounded-full bg-[#ECFDF5] text-[#059669] text-xs font-semibold inline-flex items-center">
                      {brandProfile.learnedRules.length} Active Traces
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    {/* Left: Baseline Brand Voice Profile */}
                    <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-[12px] p-5 space-y-4">
                      <h3 className="text-sm font-bold text-[#111827]">
                        Baseline Voice Profile
                      </h3>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1">
                          Tone
                        </label>
                        <input
                          type="text"
                          value={brandProfile.tone}
                          onChange={(e) =>
                            setBrandProfile({
                              ...brandProfile,
                              tone: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1">
                          Writing Style
                        </label>
                        <textarea
                          rows={3}
                          value={brandProfile.style}
                          onChange={(e) =>
                            setBrandProfile({
                              ...brandProfile,
                              style: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1.5">
                          Preferred Vocabulary
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {brandProfile.vocabulary.map((word) => (
                            <span
                              key={word}
                              className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold inline-flex items-center gap-1"
                            >
                              {word}
                              <button
                                type="button"
                                onClick={() =>
                                  setBrandProfile({
                                    ...brandProfile,
                                    vocabulary:
                                      brandProfile.vocabulary.filter(
                                        (w) => w !== word
                                      ),
                                  })
                                }
                                className="hover:text-red-600 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newVocab}
                            onChange={(e) => setNewVocab(e.target.value)}
                            placeholder="Add signature word..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newVocab.trim()) return;
                              setBrandProfile({
                                ...brandProfile,
                                vocabulary: [
                                  ...brandProfile.vocabulary,
                                  newVocab.trim(),
                                ],
                              });
                              setNewVocab("");
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-semibold cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Learned Edit Traces */}
                    <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-[12px] p-5 space-y-3">
                      <h3 className="text-sm font-bold text-[#111827]">
                        Learned Edit Traces
                      </h3>
                      <div className="space-y-2.5">
                        {brandProfile.learnedRules.map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-[#ECFDF5] text-[#059669] text-[11px] font-semibold">
                                  {item.preferenceType}
                                </span>
                                <span className="text-xs text-[#6B7280]">
                                  Reinforced {item.patternCount}x •{" "}
                                  {item.updatedAt}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm font-medium text-gray-800">
                                {item.rule}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setBrandProfile({
                                  ...brandProfile,
                                  learnedRules:
                                    brandProfile.learnedRules.filter(
                                      (r) => r.id !== item.id
                                    ),
                                })
                              }
                              className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  VIEW 5: CONTENT CALENDAR (VISUAL MONTHLY CALENDAR GRID)
              ============================================================== */}
              {activeTab === "calendar" && (
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-[18px] font-bold text-[#111827]">
                        November 2026
                      </h2>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669]">
                          Published:{" "}
                          {
                            calendarItems.filter(
                              (i) => i.status === "Published"
                            ).length
                          }
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                          Scheduled:{" "}
                          {
                            calendarItems.filter(
                              (i) => i.status === "Scheduled"
                            ).length
                          }
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Draft:{" "}
                          {
                            calendarItems.filter((i) => i.status === "Draft")
                              .length
                          }
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="h-8 font-mono px-2.5 rounded-lg border border-[#E5E7EB] text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleScheduleClip}
                        className="h-8 px-3.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Schedule Active Clip</span>
                      </button>
                    </div>
                  </div>

                  {/* 7-Column Monthly Calendar Grid */}
                  <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-7 bg-[#F9FAFB] border-b border-[#E5E7EB] text-center">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="py-2 text-[11px] font-bold uppercase tracking-wider text-[#6B7280] border-r last:border-r-0 border-[#E5E7EB]"
                          >
                            {day}
                          </div>
                        )
                      )}
                    </div>

                    <div className="grid grid-cols-7 divide-x divide-y divide-[#E5E7EB] bg-white">
                      {Array.from({ length: 35 }, (_, idx) => {
                        const dayNum = idx + 1;
                        const isNov = dayNum <= 30;
                        const dateStr = isNov
                          ? `2026-11-${String(dayNum).padStart(2, "0")}`
                          : `2026-12-${String(dayNum - 30).padStart(2, "0")}`;
                        const dayPosts = calendarItems.filter(
                          (item) => item.date === dateStr
                        );
                        const isToday = dateStr === "2026-11-21";

                        return (
                          <div
                            key={dateStr}
                            className={`min-h-[116px] p-2 flex flex-col justify-between group transition ${
                              isNov
                                ? "bg-white hover:bg-gray-50/60"
                                : "bg-[#F9FAFB]/70 text-gray-400"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span
                                  className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                                    isToday
                                      ? "bg-[#2563EB] text-white"
                                      : isNov
                                      ? "text-gray-800"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {isNov ? dayNum : dayNum - 30}
                                </span>

                                {isNov && (
                                  <button
                                    type="button"
                                    title={`Schedule "${activeClip?.title}" on ${dateStr}`}
                                    onClick={async () => {
                                      if (!activeClip) return;
                                      const payload = {
                                        clipTitle: activeClip.title,
                                        patternTag: activeClip.patternTag,
                                        platform: activePlatform,
                                        date: dateStr,
                                        status: "Scheduled",
                                        hook: draftHook,
                                        caption: draftCaption,
                                      };
                                      try {
                                        const res =
                                          await scheduleCalendarItem(payload);
                                        if (res.calendarItems) {
                                          setCalendarItems(res.calendarItems);
                                        }
                                      } catch {
                                        const newItem = {
                                          id: `cal-${Date.now()}`,
                                          ...payload,
                                          metrics: {
                                            views: 0,
                                            likes: 0,
                                            comments: 0,
                                            shares: 0,
                                          },
                                        };
                                        setCalendarItems((prev) => [
                                          newItem,
                                          ...prev,
                                        ]);
                                      }
                                      showToast(
                                        `Scheduled "${activeClip.title}" on ${dateStr}`
                                      );
                                    }}
                                    className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#2563EB] hover:text-white flex items-center justify-center transition cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                {dayPosts.map((post) => (
                                  <div
                                    key={post.id}
                                    className="p-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] space-y-1 text-[10px]"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="inline-flex items-center gap-1 font-semibold text-gray-700 truncate">
                                        <PlatformLogo
                                          platformId={post.platform}
                                          className="w-3 h-3 shrink-0"
                                        />
                                        <span className="truncate">
                                          {PLATFORM_META[post.platform]?.name}
                                        </span>
                                      </span>
                                      <select
                                        value={post.status}
                                        onChange={async (e) => {
                                          const newStatus = e.target.value;
                                          setCalendarItems((prev) =>
                                            prev.map((i) =>
                                              i.id === post.id
                                                ? {
                                                    ...i,
                                                    status: newStatus,
                                                  }
                                                : i
                                            )
                                          );
                                          try {
                                            await updateCalendarItem(post.id, {
                                              status: newStatus,
                                            });
                                          } catch {
                                            // local state updated
                                          }
                                        }}
                                        className={`px-1 py-0.5 rounded text-[9px] font-bold border focus:outline-none ${
                                          post.status === "Published"
                                            ? "bg-[#ECFDF5] text-[#059669] border-emerald-200"
                                            : post.status === "Scheduled"
                                            ? "bg-[#EFF6FF] text-[#2563EB] border-blue-200"
                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                        }`}
                                      >
                                        <option value="Draft">Draft</option>
                                        <option value="Scheduled">
                                          Scheduled
                                        </option>
                                        <option value="Published">
                                          Published
                                        </option>
                                      </select>
                                    </div>
                                    <p className="font-semibold text-gray-900 truncate">
                                      {post.clipTitle}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  VIEW 6: PERFORMANCE FEEDBACK LOOP
              ============================================================== */}
              {activeTab === "performance" && (
                <div className="space-y-4">
                  <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#059669]">
                        Winning Pattern: {boostedPattern}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 mt-0.5">
                        {loopSummary}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateFutureRecommendations}
                      className="h-9 px-4 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Update Future Recommendations
                    </button>
                  </div>

                  {/* Summary Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Total Views",
                        value: publishedItems.reduce(
                          (acc, i) => acc + i.metrics.views,
                          0
                        ),
                      },
                      {
                        label: "Total Likes",
                        value: publishedItems.reduce(
                          (acc, i) => acc + i.metrics.likes,
                          0
                        ),
                      },
                      {
                        label: "Total Comments",
                        value: publishedItems.reduce(
                          (acc, i) => acc + i.metrics.comments,
                          0
                        ),
                      },
                      {
                        label: "Total Shares",
                        value: publishedItems.reduce(
                          (acc, i) => acc + i.metrics.shares,
                          0
                        ),
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="bg-white border border-[#E5E7EB] rounded-[12px] p-4"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                          {stat.label}
                        </span>
                        <span className="font-mono text-lg font-bold text-[#111827] mt-1 block">
                          {stat.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                            <th className="py-2.5 px-3">Published Clip</th>
                            <th className="py-2.5 px-3">Pattern</th>
                            <th className="py-2.5 px-3">Platform</th>
                            <th className="py-2.5 px-3">Views</th>
                            <th className="py-2.5 px-3">Likes</th>
                            <th className="py-2.5 px-3">Comments</th>
                            <th className="py-2.5 px-3">Shares</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {publishedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-[#F9FAFB]">
                              <td className="py-3 px-3 font-semibold text-gray-900">
                                {item.clipTitle}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[10px] font-medium">
                                  {item.patternTag}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1.5 ${
                                    PLATFORM_META[item.platform]?.badge
                                  }`}
                                >
                                  <PlatformLogo
                                    platformId={item.platform}
                                    className="w-3.5 h-3.5 shrink-0"
                                  />
                                  <span>
                                    {PLATFORM_META[item.platform]?.name}
                                  </span>
                                </span>
                              </td>
                              {["views", "likes", "comments", "shares"].map(
                                (metric) => (
                                  <td key={metric} className="py-3 px-3">
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.metrics[metric]}
                                      onChange={(e) => {
                                        const val = Number(e.target.value) || 0;
                                        const updatedMetrics = {
                                          ...item.metrics,
                                          [metric]: val,
                                        };
                                        setCalendarItems((prev) =>
                                          prev.map((i) =>
                                            i.id === item.id
                                              ? {
                                                  ...i,
                                                  metrics: updatedMetrics,
                                                }
                                              : i
                                          )
                                        );
                                        updateCalendarMetrics(
                                          item.id,
                                          updatedMetrics
                                        ).catch(() => {});
                                      }}
                                      className="font-mono w-20 px-2.5 py-1 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-gray-900 focus:border-[#2563EB] focus:outline-none"
                                    />
                                  </td>
                                )
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  VIEW 7: CONNECTED PLATFORMS (LONG CARDS WITH REAL LOGOS)
              ============================================================== */}
              {activeTab === "platforms" && (
                <div className="space-y-4">
                  <h2 className="text-[18px] font-bold text-[#111827]">
                    Connected Platforms
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {connectedPlatforms.map((plat) => (
                      <div
                        key={plat.id}
                        className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 min-h-[410px] hover:shadow-md transition-shadow flex flex-col justify-between gap-6"
                      >
                        <div className="space-y-5">
                          {/* Top Row: Real Platform Logo + Platform Tag + Connection Status */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1.5 ${
                                PLATFORM_META[plat.id]?.badge
                              }`}
                            >
                              <PlatformLogo
                                platformId={plat.id}
                                className="w-3.5 h-3.5 shrink-0"
                              />
                              <span>{plat.name}</span>
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                plat.connected
                                  ? "bg-[#ECFDF5] text-[#059669]"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {plat.connected ? "Connected" : "Disconnected"}
                            </span>
                          </div>

                          {/* Centered Profile Avatar with Real Platform Logo Badge */}
                          <div className="py-3 flex flex-col items-center text-center space-y-2">
                            <div className="relative">
                              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#2563EB] to-blue-400 text-white font-bold text-xl flex items-center justify-center shadow-sm">
                                {plat.profileName.charAt(0).toUpperCase()}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white p-1 shadow-md border border-[#E5E7EB] flex items-center justify-center">
                                <PlatformLogo
                                  platformId={plat.id}
                                  className="w-full h-full"
                                />
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] pt-1">
                              Profile
                            </span>
                          </div>

                          {/* Name & ID Details */}
                          <div className="space-y-2.5">
                            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#6B7280]">
                                Name
                              </span>
                              <span className="text-xs font-bold text-[#111827] truncate">
                                {plat.profileName}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#6B7280]">
                                ID
                              </span>
                              <span className="font-mono text-xs font-semibold text-[#2563EB] truncate">
                                {plat.accountId}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setConnectedPlatforms((prev) =>
                              prev.map((p) =>
                                p.id === plat.id
                                  ? { ...p, connected: !p.connected }
                                  : p
                              )
                            );
                            showToast(
                              `${plat.name} ${
                                plat.connected ? "disconnected" : "connected"
                              }.`
                            );
                          }}
                          className={`w-full h-10 rounded-full text-[13px] font-semibold transition cursor-pointer ${
                            plat.connected
                              ? "bg-[#F3F4F6] hover:bg-gray-200 text-gray-700"
                              : "bg-[#2563EB] hover:bg-blue-700 text-white"
                          }`}
                        >
                          {plat.connected ? "Disconnect" : "Connect"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =============================================================
                  VIEW 8: PROFILE (Siva1104 • Pro Plan)
              ============================================================== */}
              {activeTab === "profile" && (
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#2563EB] to-blue-400 text-white flex items-center justify-center font-bold text-sm">
                      S
                    </div>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#111827]">
                        Siva1104
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        Pro Plan • Palimpsest Creator Studio
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E5E7EB]">
                    <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                        Active Voice Traces
                      </span>
                      <span className="text-base font-bold text-gray-900 mt-0.5 block">
                        {brandProfile.learnedRules.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                        Connected Platforms
                      </span>
                      <span className="text-base font-bold text-gray-900 mt-0.5 block">
                        {connectedPlatforms.filter((p) => p.connected).length} /{" "}
                        {connectedPlatforms.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                        Top Performing Angle
                      </span>
                      <span className="text-base font-bold text-[#2563EB] mt-0.5 block">
                        {boostedPattern}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
