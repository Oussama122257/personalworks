import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe auth instance (JWT decoding only — no database access).
const { auth } = NextAuth(authConfig);

const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard/admin",
  seller: "/dashboard/seller",
  wilaya_manager: "/dashboard/manager",
  accountant: "/dashboard/accountant",
  agent: "/dashboard/agent",
  buyer: "/",
};

const SEGMENT_ROLE: Record<string, string> = {
  admin: "admin",
  seller: "seller",
  manager: "wilaya_manager",
  accountant: "accountant",
  agent: "agent",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = user.role ?? "buyer";
  const home = ROLE_HOME[role] ?? "/";

  // Buyers have no dashboard: send them to the storefront.
  if (role === "buyer") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // /dashboard root → the user's own dashboard.
  const segment = pathname.split("/")[2];
  if (!segment) {
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  const requiredRole = SEGMENT_ROLE[segment];
  if (!requiredRole) {
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  // Wrong area for this role → redirect to their correct dashboard.
  if (requiredRole !== role) {
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
