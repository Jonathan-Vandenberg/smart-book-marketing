import jwt from "jsonwebtoken";
import { getEnv } from "@/lib/store";

export type GhostPublishInput = {
  title: string;
  html: string;
  status?: "published" | "draft";
  tags?: string[];
};

export type GhostPublishResult = {
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
};

export type GhostWebhookPost = {
  id?: string;
  title?: string;
  url?: string;
  slug?: string;
};

function createAdminToken(apiKey: string): string {
  const [id, secret] = apiKey.split(":");
  if (!id || !secret) {
    throw new Error("GHOST_ADMIN_API_KEY must be id:secret");
  }

  return jwt.sign({}, Buffer.from(secret, "hex"), {
    keyid: id,
    algorithm: "HS256",
    expiresIn: "5m",
    audience: "/admin/",
  });
}

/** Convert agent plain-text / light markdown to Ghost HTML. */
export function bodyToGhostHtml(body: string): string {
  if (/<[a-z][\s\S]*>/i.test(body)) {
    return body;
  }

  const blocks = body.trim().split(/\n\n+/);
  return blocks
    .map((block) => {
      const line = block.trim();
      if (!line) return "";
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h2>${escapeHtml(line.slice(2))}</h2>`;
      const inner = escapeHtml(line).replace(/\n/g, "<br>");
      return `<p>${inner}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isGhostConfigured(): boolean {
  return Boolean(getEnv("GHOST_URL") && getEnv("GHOST_ADMIN_API_KEY"));
}

export async function publishToGhost(input: GhostPublishInput): Promise<GhostPublishResult> {
  const baseUrl = getEnv("GHOST_URL")?.replace(/\/$/, "");
  const apiKey = getEnv("GHOST_ADMIN_API_KEY");

  if (!baseUrl || !apiKey) {
    return { ok: false, error: "GHOST_URL and GHOST_ADMIN_API_KEY not configured" };
  }

  let token: string;
  try {
    token = createAdminToken(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Ghost API key";
    return { ok: false, error: message };
  }

  const res = await fetch(`${baseUrl}/ghost/api/admin/posts/?source=html`, {
    method: "POST",
    headers: {
      Authorization: `Ghost ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      posts: [
        {
          title: input.title,
          html: input.html,
          status: input.status ?? "published",
          tags: input.tags?.map((name) => ({ name })),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  }

  const data = (await res.json()) as {
    posts?: Array<{ id?: string; url?: string; slug?: string }>;
  };
  const post = data.posts?.[0];
  const url = post?.url ?? (post?.slug ? `${baseUrl}/${post.slug}/` : undefined);

  return { ok: true, id: post?.id, url };
}

export function parseGhostWebhookPayload(body: unknown): GhostWebhookPost | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const post = record.post as Record<string, unknown> | undefined;
  const current = (post?.current ?? record) as Record<string, unknown>;
  if (!current.title && !current.url && !current.slug) return null;
  return {
    id: current.id as string | undefined,
    title: current.title as string | undefined,
    url: current.url as string | undefined,
    slug: current.slug as string | undefined,
  };
}
