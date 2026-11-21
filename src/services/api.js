const API_BASE = `${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")}/api`;

async function request(path, options = {}) {
  const { timeoutMs = 270_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`
      );
    }
    throw new Error(
      err?.message || "Unable to connect to Palimpsest server (http://localhost:5000)."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// MODULE 1: Media Ingestion & Projects
export async function uploadProjectMedia(file, projectName, jobId = "") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("projectName", projectName);
  if (jobId) {
    formData.append("jobId", jobId);
  }

  return request("/projects/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getTranscriptionStatus(jobId) {
  return request(`/projects/status/${encodeURIComponent(jobId)}`, {
    timeoutMs: 5000,
  });
}

export async function getProjects() {
  return request("/projects");
}

export async function renameProject(projectId, projectName) {
  return request(`/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectName }),
  });
}

// MODULE 2: AI Clip Selection
export async function generateClips(projectId) {
  return request(`/projects/${projectId}/clips`, {
    method: "POST",
  });
}

// MODULE 3: Platform Copy Regeneration
export async function regenerateCopy(clipId, payload) {
  return request(`/clips/${clipId}/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// MODULE 4: Brand-Voice Memory
export async function getBrandProfile() {
  return request("/brand");
}

export async function updateBrandProfile(brandProfile) {
  return request("/brand", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brandProfile),
  });
}

export async function learnFromEdit(payload) {
  return request("/brand/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// MODULE 5: Content Calendar
export async function getCalendar() {
  return request("/calendar");
}

export async function scheduleCalendarItem(item) {
  return request("/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
}

export async function updateCalendarItem(id, updates) {
  return request(`/calendar/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

// MODULE 6: Performance Feedback Loop
export async function getPerformanceInsights() {
  return request("/performance");
}

export async function updateCalendarMetrics(id, metrics) {
  return request(`/calendar/${id}/metrics`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics }),
  });
}

export async function recalibratePerformance() {
  return request("/performance/recalibrate", {
    method: "POST",
  });
}
