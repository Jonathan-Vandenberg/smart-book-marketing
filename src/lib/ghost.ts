import jwt from "jsonwebtoken";
import { getEnv } from "@/lib/store";

export type GhostPublishInput = {
  title: string;
  html: string;
  status?: "published" | "draft";
  tags?: string[];
  slug?: string;
  featureImage?: string;
  customExcerpt?: string;
  metaDescription?: string;
  metaTitle?: string;
  /** JSON-LD + optional scripts injected before closing body on this post. */
  codeInjectionFoot?: string;
};

export type GhostPostMeta = {
  id: string;
  title: string;
  slug: string;
  url?: string;
  updatedAt?: string;
};

export type GhostPostFull = GhostPostMeta & {
  html: string;
  customExcerpt?: string | null;
};

export type GhostPostSeoRecord = GhostPostMeta & {
  customExcerpt?: string | null;
  excerpt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  codeInjectionFoot?: string | null;
  featureImage?: string | null;
  publishedAt?: string | null;
  tags: string[];
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

type GhostAdminAuth = { baseUrl: string; token: string };

async function getGhostAdminAuth(): Promise<GhostAdminAuth | null> {
  const config = getGhostAdminConfig();
  if (!config) return null;
  try {
    return { baseUrl: config.baseUrl, token: createAdminToken(config.apiKey) };
  } catch {
    return null;
  }
}

async function ghostAdminRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response | null> {
  const auth = await getGhostAdminAuth();
  if (!auth) return null;
  return fetch(`${auth.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Ghost ${auth.token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

/** Relative internal link path for Ghost posts on this blog. */
export function ghostPostHref(slug: string): string {
  return `/${slug}/`;
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
/** List published posts (metadata only — for link candidate selection). */
export async function listPublishedGhostPosts(limit = "all"): Promise<GhostPostMeta[]> {
  const params = new URLSearchParams({
    filter: "status:published",
    order: "published_at desc",
    limit,
    fields: "id,title,slug,url,updated_at",
  });

  const res = await ghostAdminRequest(`/ghost/api/admin/posts/?${params}`);
  if (!res?.ok) return [];

  const data = (await res.json()) as {
    posts?: Array<{
      id?: string;
      title?: string;
      slug?: string;
      url?: string;
      updated_at?: string;
    }>;
  };

  return (data.posts ?? [])
    .filter((p): p is { id: string; title: string; slug: string; url?: string; updated_at?: string } =>
      Boolean(p.id && p.title && p.slug)
    )
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      url: p.url,
      updatedAt: p.updated_at,
    }));
}

/** Fetch a single post with HTML (for backlink injection). */
export async function fetchGhostPost(id: string): Promise<GhostPostFull | null> {
  const res = await ghostAdminRequest(`/ghost/api/admin/posts/${id}/?formats=html`);
  if (!res?.ok) {
    const errText = res ? await res.text().catch(() => "") : "no response";
    console.warn(`[ghost] fetchGhostPost ${id} failed:`, errText.slice(0, 200));
    return null;
  }

  const data = (await res.json()) as {
    posts?: Array<{
      id?: string;
      title?: string;
      slug?: string;
      url?: string;
      html?: string;
      updated_at?: string;
      custom_excerpt?: string | null;
    }>;
  };

  const post = data.posts?.[0];
  if (!post?.id || !post.title || !post.slug) return null;

  const html = post.html?.trim();
  if (!html) {
    console.warn(`[ghost] fetchGhostPost ${id}: no html in response`);
    return null;
  }

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    url: post.url,
    html,
    updatedAt: post.updated_at,
    customExcerpt: post.custom_excerpt,
  };
}

/** Update an existing Ghost post HTML (backlink injection). */
export async function updateGhostPostHtml(input: {
  id: string;
  html: string;
  updatedAt: string;
}): Promise<GhostPublishResult> {
  const res = await ghostAdminRequest(`/ghost/api/admin/posts/${input.id}/?source=html`, {
    method: "PUT",
    body: JSON.stringify({
      posts: [
        {
          id: input.id,
          html: input.html,
          updated_at: input.updatedAt,
        },
      ],
    }),
  });

  if (!res) {
    return { ok: false, error: "GHOST_URL and GHOST_ADMIN_API_KEY not configured" };
  }
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  }

  const data = (await res.json()) as {
    posts?: Array<{ id?: string; url?: string; slug?: string }>;
  };
  const post = data.posts?.[0];
  const config = getGhostAdminConfig();
  const url = post?.url ?? (post?.slug && config ? `${config.baseUrl}/${post.slug}/` : undefined);

  return { ok: true, id: post?.id ?? input.id, url };
}

/** List published posts with SEO fields (for backfill). */
type GhostPostSeoApiRow = {
  id?: string;
  title?: string;
  slug?: string;
  url?: string;
  updated_at?: string;
  custom_excerpt?: string | null;
  excerpt?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  codeinjection_foot?: string | null;
  feature_image?: string | null;
  published_at?: string | null;
  tags?: Array<{ name?: string; slug?: string }>;
};

export async function listPublishedGhostPostsForSeo(limit = "all"): Promise<GhostPostSeoRecord[]> {
  const params = new URLSearchParams({
    filter: "status:published",
    order: "published_at desc",
    limit,
    include: "tags",
    fields:
      "id,title,slug,url,updated_at,custom_excerpt,excerpt,meta_title,meta_description,codeinjection_foot,feature_image,published_at",
  });

  const res = await ghostAdminRequest(`/ghost/api/admin/posts/?${params}`);
  if (!res?.ok) return [];

  const data = (await res.json()) as {
    posts?: GhostPostSeoApiRow[];
  };

  const config = getGhostAdminConfig();

  return (data.posts ?? [])
    .filter(
      (p): p is GhostPostSeoApiRow & { id: string; title: string; slug: string } =>
        Boolean(p.id && p.title && p.slug)
    )
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      url: p.url ?? (config ? `${config.baseUrl}/${p.slug}/` : undefined),
      updatedAt: p.updated_at,
      customExcerpt: p.custom_excerpt,
      excerpt: p.excerpt,
      metaTitle: p.meta_title,
      metaDescription: p.meta_description,
      codeInjectionFoot: p.codeinjection_foot,
      featureImage: p.feature_image,
      publishedAt: p.published_at,
      tags: (p.tags ?? [])
        .map((t: { name?: string; slug?: string }) => t.slug || t.name)
        .filter((t): t is string => Boolean(t)),
    }));
}

/** Update SEO metadata without changing post HTML. */
export async function updateGhostPostSeo(input: {
  id: string;
  updatedAt: string;
  metaTitle?: string;
  metaDescription?: string;
  codeInjectionFoot?: string;
  featureImage?: string;
}): Promise<GhostPublishResult> {
  const payload: Record<string, unknown> = {
    id: input.id,
    updated_at: input.updatedAt,
  };

  if (input.metaTitle) payload.meta_title = input.metaTitle;
  if (input.metaDescription) payload.meta_description = input.metaDescription;
  if (input.codeInjectionFoot !== undefined) payload.codeinjection_foot = input.codeInjectionFoot;
  if (input.featureImage) payload.feature_image = input.featureImage;

  const res = await ghostAdminRequest(`/ghost/api/admin/posts/${input.id}/`, {
    method: "PUT",
    body: JSON.stringify({ posts: [payload] }),
  });

  if (!res) {
    return { ok: false, error: "GHOST_URL and GHOST_ADMIN_API_KEY not configured" };
  }
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  }

  const data = (await res.json()) as {
    posts?: Array<{ id?: string; url?: string; slug?: string }>;
  };
  const post = data.posts?.[0];
  const config = getGhostAdminConfig();
  const url = post?.url ?? (post?.slug && config ? `${config.baseUrl}/${post.slug}/` : undefined);

  return { ok: true, id: post?.id ?? input.id, url };
}

export async function fetchLatestPublishedPost(): Promise<GhostArticle | null> {
  const config = getGhostAdminConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    filter: "status:published",
    order: "published_at desc",
    limit: "1",
    fields: "id,title,url,slug,custom_excerpt,excerpt,published_at",
  });

  const res = await ghostAdminRequest(`/ghost/api/admin/posts/?${params}`);
  if (!res?.ok) return null;

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

  const postPayload: Record<string, unknown> = {
    title: input.title,
    html: input.html,
    status: input.status ?? "published",
    tags: input.tags?.map((name) => ({ name })),
  };

  if (input.slug) postPayload.slug = input.slug;
  if (input.featureImage) postPayload.feature_image = input.featureImage;
  if (input.customExcerpt) postPayload.custom_excerpt = input.customExcerpt;
  if (input.metaDescription) postPayload.meta_description = input.metaDescription;
  if (input.metaTitle) postPayload.meta_title = input.metaTitle;
  if (input.codeInjectionFoot) postPayload.codeinjection_foot = input.codeInjectionFoot;

  const res = await ghostAdminRequest("/ghost/api/admin/posts/?source=html", {
    method: "POST",
    body: JSON.stringify({ posts: [postPayload] }),
  });

  if (!res) {
    const message = "Invalid Ghost API key or missing configuration";
    return { ok: false, error: message };
  }

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

/** Update Ghost site settings (code injection, etc.). */
export async function updateGhostSettings(
  updates: Array<{ key: string; value: string }>
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghostAdminRequest("/ghost/api/admin/settings/", {
    method: "PUT",
    body: JSON.stringify({ settings: updates }),
  });

  if (!res) return { ok: false, error: "Ghost not configured" };
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  }
  return { ok: true };
}

export async function getGhostSetting(key: string): Promise<string | null> {
  const res = await ghostAdminRequest("/ghost/api/admin/settings/");
  if (!res?.ok) return null;

  const data = (await res.json()) as {
    settings?: Array<{ key?: string; value?: string }>;
  };

  const match = data.settings?.find((s) => s.key === key);
  return match?.value ?? null;
}

/** Create or update the /llms/ page (llms.txt content for AI assistants). */
export async function upsertGhostLlmsPage(html: string): Promise<{ ok: boolean; error?: string }> {
  const params = new URLSearchParams({
    filter: "slug:llms",
    limit: "1",
    fields: "id,updated_at",
  });

  const listRes = await ghostAdminRequest(`/ghost/api/admin/pages/?${params}`);
  if (!listRes?.ok) {
    return { ok: false, error: "Could not list Ghost pages" };
  }

  const listData = (await listRes.json()) as {
    pages?: Array<{ id?: string; updated_at?: string }>;
  };
  const existing = listData.pages?.[0];

  const pagePayload = {
    title: "LLMs",
    slug: "llms",
    html,
    status: "published",
  };

  if (existing?.id) {
    const res = await ghostAdminRequest(`/ghost/api/admin/pages/${existing.id}/?source=html`, {
      method: "PUT",
      body: JSON.stringify({
        pages: [{ id: existing.id, ...pagePayload, updated_at: existing.updated_at }],
      }),
    });
    if (!res?.ok) {
      const err = res ? await res.text() : "Ghost request failed";
      return { ok: false, error: err.slice(0, 300) };
    }
    return { ok: true };
  }

  const res = await ghostAdminRequest("/ghost/api/admin/pages/?source=html", {
    method: "POST",
    body: JSON.stringify({ pages: [pagePayload] }),
  });

  if (!res?.ok) {
    const err = res ? await res.text() : "Ghost request failed";
    return { ok: false, error: err.slice(0, 300) };
  }
  return { ok: true };
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
