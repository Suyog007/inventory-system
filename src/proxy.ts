import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Match all routes except _next internals, api/auth (NextAuth handles),
  // api/webhooks (HMAC-authed externally), api/cron (bearer-token authed),
  // and static files.
  matcher: [
    "/((?!api/auth|api/webhooks|api/cron|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
