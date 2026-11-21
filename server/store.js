import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("db.json");

const DEFAULT_DB = {
  projects: [],
  brandProfile: {
    tone: "Direct, authoritative, zero-fluff practitioner",
    vocabulary: ["clarity", "practical", "real results", "playbook", "proof"],
    style: "Short punchy sentences. Conversational hooks. No cheesy sales hype.",
    learnedRules: [
      {
        id: "rule-1",
        rule: "Open with a bold claim or contrarian observation in the first 10 words.",
        preferenceType: "Writing Style",
        patternCount: 2,
        updatedAt: "Baseline",
      },
    ],
  },
  calendarItems: [],
  performanceInsights: {
    topAngle: "Myth-Busting",
    summary:
      "Myth-Busting clips generate 3.4x higher saves & shares than Behind-the-Scenes posts.",
  },
};

export function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return structuredClone(DEFAULT_DB);
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

export function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
