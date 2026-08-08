import { getEnv } from "@/lib/store";

export async function publishToBuffer(text: string, profileIds?: string[]): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = getEnv("BUFFER_ACCESS_TOKEN");
  if (!token) {
    return { ok: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }

  const body: Record<string, unknown> = {
    text,
    shorten: true,
  };
  if (profileIds?.length) {
    body.profile_ids = profileIds;
  }

  const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 200) };
  }

  const data = (await res.json()) as { updates?: Array<{ id?: string }> };
  return { ok: true, id: data.updates?.[0]?.id };
}
