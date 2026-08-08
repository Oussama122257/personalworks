import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe auth instance (JWT decoding only — no database access).
const { auth } = NextAuth(authConfig);

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  SELLER: "/dashboard/seller",
  WILAYA_MANAGER: "/dashboard/manager",
  ACCOUNTANT: "/dashboard/accountant",
  AGENT: "/dashboard/agent",
  ERP_MANAGER: "/dashboard/erp",
  LOGISTICS_MANAGER: "/dashboard/logistics",
  SUPPORT: "/dashboard/support",
  BUYER: "/",
};

const SEGMENT_ROLE: Record<string, string> = {
  admin: "ADMIN",
  seller: "SELLER",
  manager: "WILAYA_MANAGER",
  accountant: "ACCOUNTANT",
  agent: "AGENT",
  erp: "ERP_MANAGER",
  logistics: "LOGISTICS_MANAGER",
  support: "SUPPORT",
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

  const role = user.role ?? "BUYER";
  const home = ROLE_HOME[role] ?? "/";

  // Roles without a dashboard are sent to the storefront.
  if (home === "/") {
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
