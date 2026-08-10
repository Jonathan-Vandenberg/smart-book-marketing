import { getEnv } from "@/lib/store";

const BUFFER_API = "https://api.buffer.com";

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function bufferGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphqlResponse<T>> {
  const token = getEnv("BUFFER_ACCESS_TOKEN");
  if (!token) {
    return { errors: [{ message: "BUFFER_ACCESS_TOKEN not configured" }] };
  }

  const res = await fetch(BUFFER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { errors: [{ message: err.slice(0, 200) }] };
  }

  return (await res.json()) as GraphqlResponse<T>;
}

async function getOrganizationId(): Promise<string | null> {
  const configured = getEnv("BUFFER_ORGANIZATION_ID");
  if (configured) return configured;

  const result = await bufferGraphql<{
    account: { organizations: Array<{ id: string }> };
  }>(`query { account { organizations { id } } }`);

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Buffer account query failed");
  }

  return result.data?.account.organizations[0]?.id ?? null;
}

type BufferChannel = { id: string; service: string };

async function resolveChannels(channelIds?: string[]): Promise<BufferChannel[]> {
  const orgId = await getOrganizationId();
  if (!orgId) return [];

  const result = await bufferGraphql<{
    channels: Array<{ id: string; service: string }>;
  }>(
    `query Channels($organizationId: String!) {
      channels(input: { organizationId: $organizationId }) { id service }
    }`,
    { organizationId: orgId },
  );

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Buffer channels query failed");
  }

  const all = result.data?.channels ?? [];
  if (channelIds?.length) {
    const wanted = new Set(channelIds);
    return all.filter((c) => wanted.has(c.id));
  }

  const configured = getEnv("BUFFER_CHANNEL_IDS");
  if (configured) {
    const wanted = new Set(
      configured
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
    return all.filter((c) => wanted.has(c.id));
  }

  return all;
}

function metadataForService(service: string): Record<string, unknown> | undefined {
  switch (service) {
    case "facebook":
      return { facebook: { type: "post" } };
    case "instagram":
      return { instagram: { type: "post" } };
    default:
      return undefined;
  }
}

export async function publishToBuffer(
  text: string,
  channelIds?: string[],
  mode: "addToQueue" | "shareNow" = "addToQueue",
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = getEnv("BUFFER_ACCESS_TOKEN");
  if (!token) {
    return { ok: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }

  let channels: BufferChannel[];
  try {
    channels = await resolveChannels(channelIds);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Buffer channel lookup failed";
    return { ok: false, error: message };
  }

  if (channels.length === 0) {
    return {
      ok: false,
      error: "No Buffer channels connected — link accounts in publish.buffer.com, then retry",
    };
  }

  const created: string[] = [];
  const failures: string[] = [];

  for (const { id: channelId, service } of channels) {
    const metadata = metadataForService(service);
    const result = await bufferGraphql<{
      createPost:
        | { post?: { id?: string } }
        | { message?: string };
    }>(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id } }
          ... on MutationError { message }
        }
      }`,
      {
        input: {
          text,
          channelId,
          schedulingType: "automatic",
          mode,
          ...(metadata ? { metadata } : {}),
        },
      },
    );

    if (result.errors?.length) {
      failures.push(result.errors[0]?.message ?? "GraphQL error");
      continue;
    }

    const payload = result.data?.createPost;
    if (payload && "message" in payload && payload.message) {
      failures.push(payload.message);
      continue;
    }

    const postId = payload && "post" in payload ? payload.post?.id : undefined;
    if (postId) created.push(postId);
  }

  if (created.length > 0) {
    return { ok: true, id: created[0] };
  }

  return { ok: false, error: failures[0] ?? "Buffer publish failed" };
}

export async function listBufferChannels(): Promise<
  Array<{ id: string; name: string; service: string }>
> {
  const orgId = await getOrganizationId();
  if (!orgId) return [];

  const result = await bufferGraphql<{
    channels: Array<{ id: string; name: string; service: string }>;
  }>(
    `query Channels($organizationId: String!) {
      channels(input: { organizationId: $organizationId }) {
        id
        name
        service
      }
    }`,
    { organizationId: orgId },
  );

  return result.data?.channels ?? [];
}

/** Map Buffer channel service id → marketing platform slug. */
export function bufferServiceToPlatformSlug(service: string): string {
  switch (service) {
    case "twitter":
      return "x";
    default:
      return service;
  }
}

/** Platform slugs with an active channel in Buffer (empty if token missing or API fails). */
export async function getBufferConnectedPlatformSlugs(): Promise<Set<string>> {
  if (!getEnv("BUFFER_ACCESS_TOKEN")) return new Set();

  try {
    const channels = await listBufferChannels();
    return new Set(channels.map((c) => bufferServiceToPlatformSlug(c.service)));
  } catch {
    return new Set();
  }
}
