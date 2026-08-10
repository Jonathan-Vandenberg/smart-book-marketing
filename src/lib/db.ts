import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "marketing.db");

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      handle TEXT,
      tier INTEGER NOT NULL DEFAULT 1,
      automation_level TEXT NOT NULL DEFAULT 'manual',
      category TEXT NOT NULL DEFAULT 'social',
      api_connected INTEGER NOT NULL DEFAULT 0,
      profile_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id),
      pillar TEXT,
      title TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      published_at TEXT,
      external_url TEXT,
      agent_source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_drafts_status ON content_drafts(status);
    CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON content_drafts(scheduled_at);
  `);

  const cols = database.prepare("PRAGMA table_info(content_drafts)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "article_url")) {
    database.exec("ALTER TABLE content_drafts ADD COLUMN article_url TEXT");
  }
}

function seedPlatforms(database: Database.Database) {
  const count = database.prepare("SELECT COUNT(*) as c FROM platforms").get() as { c: number };
  if (count.c > 0) return;

  const seedPath = path.join(process.cwd(), "config", "platforms.seed.json");
  if (!fs.existsSync(seedPath)) return;

  const seeds = JSON.parse(fs.readFileSync(seedPath, "utf8")) as Array<{
    slug: string;
    name: string;
    handle?: string;
    tier?: number;
    automationLevel?: string;
    category?: string;
  }>;

  const insert = database.prepare(`
    INSERT INTO platforms (slug, name, handle, tier, automation_level, category)
    VALUES (@slug, @name, @handle, @tier, @automationLevel, @category)
  `);

  const tx = database.transaction((rows: typeof seeds) => {
    for (const row of rows) {
      insert.run({
        slug: row.slug,
        name: row.name,
        handle: row.handle ?? null,
        tier: row.tier ?? 1,
        automationLevel: row.automationLevel ?? "manual",
        category: row.category ?? "social",
      });
    }
  });

  tx(seeds);
}

function ensureGhostPlatform(database: Database.Database) {
  const row = database.prepare("SELECT id FROM platforms WHERE slug = 'ghost'").get();
  if (row) return;
  database
    .prepare(
      `INSERT INTO platforms (slug, name, handle, tier, automation_level, category)
       VALUES ('ghost', 'Ghost Blog', 'blog.smartbookplanner.com', 1, 'high', 'blog')`,
    )
    .run();
}

function ensureFacebookPlatform(database: Database.Database) {
  const row = database.prepare("SELECT id FROM platforms WHERE slug = 'facebook'").get();
  if (row) return;
  database
    .prepare(
      `INSERT INTO platforms (slug, name, handle, tier, automation_level, category)
       VALUES ('facebook', 'Facebook', 'Smart Book Planner', 1, 'medium', 'social')`,
    )
    .run();
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    migrate(db);
    seedPlatforms(db);
    ensureGhostPlatform(db);
    ensureFacebookPlatform(db);
  }
  return db;
}
