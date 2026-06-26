import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no DB calls here.
// Used by both src/auth.ts (full, with Credentials) and src/middleware.ts (Edge).
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false; // NextAuth will redirect to signIn page
      }

      // ADMIN-only paths
      const adminOnlyPaths = ["/settings", "/api/channels"];
      const isAdminOnly = adminOnlyPaths.some((p) =>
        nextUrl.pathname.startsWith(p),
      );
      if (isAdminOnly && auth?.user?.role !== "ADMIN") {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: "ADMIN" | "STAFF" };
        if (u.id) token.id = u.id;
        if (u.role) token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "STAFF";
      }
      return session;
    },
  },
  providers: [], // Credentials added in src/auth.ts (Node-only)
};
