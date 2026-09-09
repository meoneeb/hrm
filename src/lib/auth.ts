import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { authConfig } from "@/lib/auth.config";
import type { UserType } from "@/types";

declare module "next-auth" {
  interface User {
    type: UserType;
    primary: boolean;
    orgId?: string | null;
    orgIds?: string[];
    projIds?: string[];
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      type: UserType;
      primary: boolean;
      orgId?: string | null;
      orgIds?: string[];
      projIds?: string[];
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        await dbConnect();
        const user = await User.findOne({ email, active: true });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passHash);
        if (!ok) return null;

        const orgIds = (user.orgIds ?? []).map(String);
        const orgId =
          user.orgId
            ? String(user.orgId)
            : orgIds[0] || null;

        return {
          id: String(user._id),
          email: user.email,
          name: user.name,
          type: user.type,
          primary: !!user.primary,
          orgId,
          orgIds,
          projIds: (user.projIds ?? []).map(String),
        };
      },
    }),
  ],
});
