import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        // 1. Verify user exists in database
        const dbUser = await prisma.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        // 2. Reject non-existing users (do not auto-create accounts with business permissions)
        if (!dbUser) {
          return "/login?error=account_not_found";
        }

        // 3. Reject deactivated users
        if (!dbUser.isActive) {
          return "/login?error=account_disabled";
        }

        // 4. Link Google account if not yet linked
        const isLinked = dbUser.accounts.some(
          (acc) => acc.provider === "google" && acc.providerAccountId === account.providerAccountId
        );

        if (!isLinked) {
          await prisma.account.create({
            data: {
              userId: dbUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          });
        }

        // 5. Update avatar if user doesn't have one
        if (!dbUser.avatarUrl && profile?.picture) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { avatarUrl: profile.picture as string },
          });
        }

        return true;
      }
      return false;
    },

    async jwt({ token, user }) {
      if (token?.email) {
        const email = (token.email as string).toLowerCase().trim();
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              departmentId: true,
              title: true,
              isActive: true,
            },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.departmentId = dbUser.departmentId;
            token.title = dbUser.title;
            token.isActive = dbUser.isActive;
          }
        } catch {
          // Gracefully fallback
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || session.user.id;
        (session.user as any).role = token.role;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).title = token.title;
        (session.user as any).isActive = token.isActive;
      }
      return session;
    },
  },
});
