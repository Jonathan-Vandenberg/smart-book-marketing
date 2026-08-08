import { auth } from "@/lib/auth";
import { isAllowedAdminEmail } from "@/lib/allowed-emails";
import { getEnv } from "@/lib/store";

export async function requireAdmin(request?: Request) {
  const session = await auth();
  const email = session?.user?.email;

  if (isAllowedAdminEmail(email)) {
    return { email: email! };
  }

  if (request) {
    const secret = getEnv("DASHBOARD_SECRET");
    const header = request.headers.get("authorization");
    if (secret && header === `Bearer ${secret}`) {
      return { email: "automation@internal" };
    }
  }

  return null;
}
