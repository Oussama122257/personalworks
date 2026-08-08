import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      wilayaCode: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    wilayaCode?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    wilayaCode?: number | null;
  }
}
