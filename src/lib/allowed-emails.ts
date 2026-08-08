const DEFAULT_ALLOWED = "urbangentryjon@gmail.com";

export function getAllowedAdminEmails(): string[] {
  const raw =
    process.env.ALLOWED_ADMIN_EMAILS?.trim() ||
    process.env.ALLOWED_AI_EMAILS?.trim() ||
    DEFAULT_ALLOWED;

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}
