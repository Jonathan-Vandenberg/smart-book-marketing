import { getDb } from "@/lib/db";
import { resolvePlatformApiConnected } from "@/lib/integrations";
import type { Platform } from "@/lib/types";

function mapPlatform(row: Record<string, unknown>): Platform {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    handle: (row.handle as string | null) ?? null,
    tier: row.tier as number,
    automationLevel: row.automation_level as string,
    category: row.category as string,
    apiConnected: Boolean(row.api_connected),
    profileUrl: (row.profile_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export function listPlatforms(): Platform[] {
  const rows = getDb()
    .prepare("SELECT * FROM platforms ORDER BY tier ASC, name ASC")
    .all();
  const platforms = rows.map((row) => mapPlatform(row as Record<string, unknown>));

  for (const platform of platforms) {
    const connected = resolvePlatformApiConnected(platform.slug);
    if (connected !== platform.apiConnected) {
      updatePlatformApiConnected(platform.id, connected);
      platform.apiConnected = connected;
    }
  }

  return platforms;
}

export function getPlatformBySlug(slug: string): Platform | null {
  const row = getDb().prepare("SELECT * FROM platforms WHERE slug = ?").get(slug);
  return row ? mapPlatform(row as Record<string, unknown>) : null;
}

export function getPlatformById(id: number): Platform | null {
  const row = getDb().prepare("SELECT * FROM platforms WHERE id = ?").get(id);
  return row ? mapPlatform(row as Record<string, unknown>) : null;
}

export function updatePlatformApiConnected(id: number, connected: boolean) {
  getDb()
    .prepare("UPDATE platforms SET api_connected = ? WHERE id = ?")
    .run(connected ? 1 : 0, id);
}

export function updatePlatformNotes(id: number, notes: string) {
  getDb().prepare("UPDATE platforms SET notes = ? WHERE id = ?").run(notes, id);
}
