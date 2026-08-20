import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AgentRunRecord = {
  agent: string;
  status: "ok" | "error" | "skipped";
  message: string;
  at: string;
};

export type BlogJobRecord = {
  id: string;
  status: "running" | "ok" | "error" | "skipped";
  message?: string;
  startedAt: string;
  finishedAt?: string;
  publish?: { title?: string; url?: string; slug?: string };
  dedupe?: { kept: number; deleted: number; deletedCount?: number };
  backlinkedSlugs?: string[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const RUNS_FILE = path.join(DATA_DIR, "agent-runs.json");
const BLOG_JOBS_FILE = path.join(DATA_DIR, "blog-jobs.json");

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

function readBlogJobs(): BlogJobRecord[] {
  ensureDataDir();
  if (!fs.existsSync(BLOG_JOBS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(BLOG_JOBS_FILE, "utf8")) as BlogJobRecord[];
  } catch {
    return [];
  }
}

function writeBlogJobs(jobs: BlogJobRecord[]) {
  ensureDataDir();
  fs.writeFileSync(BLOG_JOBS_FILE, JSON.stringify(jobs.slice(0, 50), null, 2));
}

export function createBlogJob(): BlogJobRecord {
  const job: BlogJobRecord = {
    id: randomUUID(),
    status: "running",
    startedAt: new Date().toISOString(),
  };
  const jobs = readBlogJobs();
  jobs.unshift(job);
  writeBlogJobs(jobs);
  return job;
}

export function updateBlogJob(id: string, patch: Partial<Omit<BlogJobRecord, "id">>) {
  const jobs = readBlogJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return null;
  jobs[idx] = { ...jobs[idx], ...patch };
  writeBlogJobs(jobs);
  return jobs[idx];
}

export function getBlogJob(id: string): BlogJobRecord | null {
  return readBlogJobs().find((j) => j.id === id) ?? null;
}
