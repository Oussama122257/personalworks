import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export type Guarded =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

/** Require an authenticated session holding one of the given roles. */
export async function requireRole(roles: string[]): Promise<Guarded> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (roles.length > 0 && !roles.includes(session.user.role)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
