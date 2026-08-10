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

export type GhostArticle = {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  publishedAt: string | null;
};

function getGhostAdminConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = getEnv("GHOST_URL")?.replace(/\/$/, "");
  const apiKey = getEnv("GHOST_ADMIN_API_KEY");
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

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

  const lines = body.trim().split("\n");
  const html: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let paragraphLines: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const tag = listOrdered ? "ol" : "ul";
    html.push(`<${tag}>`);
    for (const item of listItems) {
      html.push(`<li>${inlineMarkdown(item)}</li>`);
    }
    html.push(`</${tag}>`);
    listItems = [];
    listOrdered = false;
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ");
    html.push(`<p>${inlineMarkdown(text)}</p>`);
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }

    const bullet = line.match(/^[*\-]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);

    if (bullet) {
      flushParagraph();
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(bullet[1]);
      continue;
    }

    if (numbered) {
      flushParagraph();
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(numbered[1]);
      continue;
    }

    flushList();

    if (line.startsWith("### ")) {
      flushParagraph();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      html.push(`<h2>${inlineMarkdown(line.slice(2))}</h2>`);
      continue;
    }

    paragraphLines.push(line);
  }

  flushList();
  flushParagraph();
  return html.join("\n");
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isGhostConfigured(): boolean {
  return Boolean(getGhostAdminConfig());
}

/** Most recently published blog post (for social promo drafts). */
export async function fetchLatestPublishedPost(): Promise<GhostArticle | null> {
  const config = getGhostAdminConfig();
  if (!config) return null;

  let token: string;
  try {
    token = createAdminToken(config.apiKey);
  } catch {
    return null;
  }

  const params = new URLSearchParams({
    filter: "status:published",
    order: "published_at desc",
    limit: "1",
    fields: "id,title,url,slug,custom_excerpt,excerpt,published_at",
  });

  const res = await fetch(`${config.baseUrl}/ghost/api/admin/posts/?${params}`, {
    headers: {
      Authorization: `Ghost ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    posts?: Array<{
      id?: string;
      title?: string;
      url?: string;
      slug?: string;
      custom_excerpt?: string | null;
      excerpt?: string | null;
      published_at?: string | null;
    }>;
  };

  const post = data.posts?.[0];
  if (!post?.title) return null;

  const url =
    post.url ??
    (post.slug ? `${config.baseUrl}/${post.slug}/` : undefined);
  if (!url) return null;

  const excerpt = (post.custom_excerpt || post.excerpt || "").replace(/<[^>]+>/g, "").trim() || null;

  return {
    id: post.id ?? post.slug ?? url,
    title: post.title,
    url,
    excerpt,
    publishedAt: post.published_at ?? null,
  };
}

export async function publishToGhost(input: GhostPublishInput): Promise<GhostPublishResult> {
  const config = getGhostAdminConfig();
  if (!config) {
    return { ok: false, error: "GHOST_URL and GHOST_ADMIN_API_KEY not configured" };
  }
  const baseUrl = config.baseUrl;
  const apiKey = config.apiKey;

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
