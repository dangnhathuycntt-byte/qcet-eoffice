import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        // 1. Verify email domain belongs to cdktcnqn.edu.vn
        if (!email.endsWith("@cdktcnqn.edu.vn")) {
          return "/login?error=domain_not_allowed";
        }

        // 2. Verify user exists in database
        const dbUser = await prisma.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        // 3. Reject non-existing users (do not auto-create accounts or elevate privileges)
        if (!dbUser) {
          return "/login?error=account_not_found";
        }

        // 4. Reject deactivated users
        if (!dbUser.isActive) {
          return "/login?error=account_disabled";
        }

        // 5. Link Google account if not yet linked
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

        // 6. Update avatar if user doesn't have one
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

    async session({ session, user, token }: any) {
      if (session.user) {
        const source = user || token;
        if (source) {
          session.user.id = source.id || (source.sub as string) || session.user.id;
          (session.user as any).role = source.role;
          (session.user as any).departmentId = source.departmentId;
          (session.user as any).title = source.title;
          (session.user as any).isActive = source.isActive;
        }
      }
      return session;
    },
  },
});
