import type { NextAuthConfig } from "next-auth";
import type { UserType } from "@/types";

export type AppJWT = {
  id: string;
  email?: string | null;
  name?: string | null;
  type: UserType;
  primary: boolean;
  orgId?: string | null;
  orgIds?: string[];
  projIds?: string[];
};

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as typeof token & AppJWT;
      if (user) {
        t.id = user.id!;
        t.type = user.type;
        t.primary = user.primary;
        t.orgId = user.orgId ?? null;
        t.orgIds = user.orgIds ?? [];
        t.projIds = user.projIds ?? [];
      }
      if (trigger === "update" && session?.orgId !== undefined) {
        t.orgId = session.orgId;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as typeof token & AppJWT;
      session.user.id = t.id;
      session.user.email = (t.email as string) || "";
      session.user.name = (t.name as string) || "";
      session.user.type = t.type;
      session.user.primary = !!t.primary;
      session.user.orgId = t.orgId;
      session.user.orgIds = t.orgIds;
      session.user.projIds = t.projIds;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isAuthPage = pathname.startsWith("/login");
      const isDashboard = pathname.startsWith("/dashboard");
      const isApiProtected =
        pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

      if (isDashboard || isApiProtected) return isLoggedIn;
      if (isAuthPage) return true;
      return true;
    },
  },
} satisfies NextAuthConfig;
