import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * Redirects non-admin visitors to /maintenance when maintenance mode is on.
 *
 * This runs in server components rather than middleware: the flag lives in
 * PostgreSQL and the edge runtime cannot reach Prisma. Call it at the top of
 * every public page.
 */
export async function assertNotInMaintenance() {
  const { maintenanceMode } = await getSettings("general");
  if (!maintenanceMode) return;

  const session = await auth();
  if (session?.user?.role === "ADMIN") return;

  redirect("/maintenance");
}
