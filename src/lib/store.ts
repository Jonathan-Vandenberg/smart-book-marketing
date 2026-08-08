import fs from "node:fs";
import path from "node:path";

export type AgentRunRecord = {
  agent: string;
  status: "ok" | "error" | "skipped";
  message: string;
  at: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RUNS_FILE = path.join(DATA_DIR, "agent-runs.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function appendAgentRun(record: Omit<AgentRunRecord, "at">) {
  ensureDataDir();
  const runs = getAgentRuns();
  const entry: AgentRunRecord = { ...record, at: new Date().toISOString() };
  runs.unshift(entry);
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs.slice(0, 200), null, 2));
  return entry;
}

export function getAgentRuns(): AgentRunRecord[] {
  ensureDataDir();
  if (!fs.existsSync(RUNS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RUNS_FILE, "utf8")) as AgentRunRecord[];
  } catch {
    return [];
  }
}

export function getEnv(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function agentsEnabled(): boolean {
  return getEnv("AGENTS_ENABLED", "true") === "true";
}
