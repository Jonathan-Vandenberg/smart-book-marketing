import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { getEnv } from "@/lib/store";

const BLOG_IMAGES_BUCKET = "blog-images";

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    getEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      (getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

/** Upload cover image bytes to the shared blog-images bucket (same as -mom). */
export async function uploadBlogCoverImage(
  imageBuffer: Buffer,
  contentType: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase storage not configured");
  }

  const ext = contentType === "image/png" ? "png" : "jpg";
  const filename = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BLOG_IMAGES_BUCKET)
    .upload(filename, imageBuffer, { contentType, upsert: false });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}
