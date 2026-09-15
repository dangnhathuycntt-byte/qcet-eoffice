import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-compatible Auth.js configuration.
 * Does NOT import Prisma, bcrypt, or Node-specific modules so it can run inside Edge Runtime / Middleware.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          hd: process.env.AUTH_ALLOWED_DOMAINS || "cdktcnqn.edu.vn",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET || "qcet_dev_fallback_secret_key_2026_super_safe_32_chars",
};
