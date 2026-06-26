import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-helpers";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || user.deletedAt) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
    Google({
      // Picks up AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET env vars automatically.
      // Configure them in .env after creating an OAuth client at console.cloud.google.com.
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google sign-in policy: ONLY allow if a User with this email already
    // exists in our DB. Admin must invite the email first via /settings/users.
    // No auto-create. This prevents random Google accounts from getting access.
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const existing = await db.user.findUnique({
          where: { email: user.email },
        });
        if (!existing || existing.deletedAt) return false;
        // Patch our app's id + role onto the user object so jwt callback picks them up
        user.id = existing.id;
        user.role = existing.role;
        user.name = user.name ?? existing.name ?? undefined;
        return true;
      }
      return true; // Credentials provider already validated in authorize()
    },
  },
});
