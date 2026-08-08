import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth configuration (no Prisma / Node-only imports).
 * Imported by src/middleware.ts to decode the session JWT, and spread
 * into the full config in src/lib/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as string) ?? "BUYER";
        session.user.wilayaCode = (token.wilayaCode as number | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
