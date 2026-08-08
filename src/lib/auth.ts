import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

// Sessions use the JWT strategy: it is required for Credentials login and lets
// the edge middleware read the role without a database round-trip. Users are
// persisted in the `Profile` table via Prisma — Google sign-ins are upserted
// in the signIn callback below (the stock @auth/prisma-adapter expects a
// `User` model with different fields, so persistence is done explicitly).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email ou téléphone", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!identifier || !password) return null;

        const profile = await prisma.profile.findFirst({
          where: {
            OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
          },
        });
        if (!profile?.passwordHash || !profile.isActive) return null;

        const valid = await bcrypt.compare(password, profile.passwordHash);
        if (!valid) return null;

        return {
          id: profile.id,
          email: profile.email,
          name: profile.fullName,
          image: profile.avatarUrl,
          role: profile.role,
          wilayaCode: profile.wilayaCode,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const profile = await prisma.profile.upsert({
          where: { email: user.email.toLowerCase() },
          update: {
            avatarUrl: user.image ?? undefined,
          },
          create: {
            email: user.email.toLowerCase(),
            fullName: user.name ?? user.email,
            avatarUrl: user.image,
            role: "buyer",
          },
        });
        if (!profile.isActive) return false;
        user.id = profile.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      // On login, fetch the role from the Profile table and attach it.
      if (user) {
        const profile = await prisma.profile.findFirst({
          where: user.id
            ? { id: user.id }
            : { email: user.email?.toLowerCase() ?? "" },
        });
        if (profile) {
          token.id = profile.id;
          token.role = profile.role;
          token.wilayaCode = profile.wilayaCode;
        }
      }
      return token;
    },
  },
});
