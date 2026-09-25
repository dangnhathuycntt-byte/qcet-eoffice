import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/features/flags";
import { isVerifiedGoogleWorkspaceIdentity } from "@/lib/google-oauth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // 0. Operational kill switch check
        if (!isFeatureEnabled("externalGoogleLogin")) {
          return "/login?error=oauth_not_configured";
        }

        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        // 1. Require Google's verified-email and hosted-domain claims. An email
        // suffix alone does not prove Workspace membership.
        if (!isVerifiedGoogleWorkspaceIdentity({
          email,
          email_verified: (profile as any)?.email_verified,
          hd: (profile as any)?.hd,
        })) {
          return `/login?error=domain_not_allowed&email=${encodeURIComponent(email)}`;
        }

        // 2. Verify user exists in database (pre-provisioned)
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
              type: account.type || "oauth",
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

        // 6. Synchronize avatar from Google Workspace profile picture
        const googleAvatar = (profile?.picture as string) || (user.image as string);
        if (googleAvatar && dbUser.avatarUrl !== googleAvatar) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { avatarUrl: googleAvatar },
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
          session.user.role = source.role;
          session.user.departmentId = source.departmentId;
          session.user.title = source.title;
          session.user.isActive = source.isActive;
        }
      }
      return session;
    },
  },
});
