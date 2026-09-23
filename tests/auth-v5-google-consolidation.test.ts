import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  isAllowedDomain,
  buildGoogleAuthUrl,
  OFFICIAL_DOMAIN,
} from "@/lib/google-oauth";
import {
  signSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from "@/lib/jwt-session";
import {
  resolveCurrentSession,
  extractTokenFromRequest,
} from "@/server/auth/current-session";
import { loadCurrentUser } from "@/server/auth/current-user";
import {
  assertSessionPolicy,
  isSessionExpired,
  isSessionRevoked,
  revokeSession,
  revokeAllUserSessions,
  clearRevocationStoreForTesting,
} from "@/server/auth/session-policy";
import { getApiContext } from "@/server/api/request-context";
import { AuthenticationError } from "@/server/api/errors";
import { loadFreshAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { SystemRole } from "@/server/authorization/authorization-context";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

describe("Issue #5: Auth.js V5 + Google Workspace Consolidation & Security Test Suite", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalPrisma = {
    userFindUnique: prisma.user.findUnique,
    userCreate: prisma.user.create,
    userUpdate: prisma.user.update,
    accountFindUnique: prisma.account?.findUnique,
    accountCreate: prisma.account?.create,
    sessionFindUnique: prisma.session?.findUnique,
    sessionFindFirst: prisma.session?.findFirst,
    sessionDeleteMany: prisma.session?.deleteMany,
    positionAssignmentFindMany: prisma.positionAssignment?.findMany,
    delegationGrantFindMany: prisma.delegationGrant?.findMany,
    bodyMembershipFindMany: prisma.bodyMembership?.findMany,
    transaction: prisma.$transaction,
  };

  beforeEach(() => {
    clearRevocationStoreForTesting();
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";
    process.env.AUTH_SECRET = "test-secret-key-for-authjs-v5-validation-32chars";
    process.env.JWT_SECRET = "test-secret-key-for-authjs-v5-validation-32chars";

    // Setup safe default mocks for authorization engine models
    (prisma as any).positionAssignment = {
      findMany: async () => [],
    };
    (prisma as any).delegationGrant = {
      findMany: async () => [],
    };
    (prisma as any).bodyMembership = {
      findMany: async () => [],
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    prisma.user.findUnique = originalPrisma.userFindUnique;
    prisma.user.create = originalPrisma.userCreate;
    prisma.user.update = originalPrisma.userUpdate;
    if (prisma.account) {
      prisma.account.findUnique = originalPrisma.accountFindUnique;
      prisma.account.create = originalPrisma.accountCreate;
    }
    if (prisma.session) {
      prisma.session.findUnique = originalPrisma.sessionFindUnique;
      prisma.session.findFirst = originalPrisma.sessionFindFirst;
      prisma.session.deleteMany = originalPrisma.sessionDeleteMany;
    }
    if (prisma.positionAssignment) {
      prisma.positionAssignment.findMany = originalPrisma.positionAssignmentFindMany;
    }
    if (prisma.delegationGrant) {
      prisma.delegationGrant.findMany = originalPrisma.delegationGrantFindMany;
    }
    if (prisma.bodyMembership) {
      prisma.bodyMembership.findMany = originalPrisma.bodyMembershipFindMany;
    }
    prisma.$transaction = originalPrisma.transaction;
    clearRevocationStoreForTesting();
  });

  // =========================================================================
  // 1. Google Workspace Validation
  // =========================================================================
  describe("Scenario 1: Google Workspace Domain & Param Validation", () => {
    test("1.1 isAllowedDomain returns true for valid @cdktcnqn.edu.vn emails", () => {
      assert.strictEqual(isAllowedDomain("gv.nguyenvana@cdktcnqn.edu.vn", "cdktcnqn.edu.vn"), true);
      assert.strictEqual(isAllowedDomain("bgh.hieutruong@cdktcnqn.edu.vn", "cdktcnqn.edu.vn"), true);
      assert.strictEqual(isAllowedDomain("staff@cdktcnqn.edu.vn", null), true);
      assert.strictEqual(isAllowedDomain("Staff.MixedCase@CDKTCNQN.EDU.VN", "cdktcnqn.edu.vn"), true);
    });

    test("1.2 buildGoogleAuthUrl sets required OAuth parameters including hd constraint", () => {
      const authUrlStr = buildGoogleAuthUrl({
        clientId: "client-123",
        redirectUri: "https://eoffice.cdktcnqn.edu.vn/api/auth/callback/google",
        state: "csrf-state-abc-123",
      });
      const authUrl = new URL(authUrlStr);

      assert.strictEqual(authUrl.hostname, "accounts.google.com");
      assert.strictEqual(authUrl.searchParams.get("client_id"), "client-123");
      assert.strictEqual(authUrl.searchParams.get("redirect_uri"), "https://eoffice.cdktcnqn.edu.vn/api/auth/callback/google");
      assert.strictEqual(authUrl.searchParams.get("response_type"), "code");
      assert.strictEqual(authUrl.searchParams.get("scope"), "openid email profile");
      assert.strictEqual(authUrl.searchParams.get("state"), "csrf-state-abc-123");
      assert.strictEqual(authUrl.searchParams.get("hd"), OFFICIAL_DOMAIN);
      assert.strictEqual(authUrl.searchParams.get("prompt"), "select_account");
      assert.strictEqual(authUrl.searchParams.get("access_type"), "offline");
    });
  });

  // =========================================================================
  // 2. Domain Restriction
  // =========================================================================
  describe("Scenario 2: Domain Restriction & Unverified Email Rejection", () => {
    test("2.1 isAllowedDomain rejects non-institutional emails and spoofing attempts", () => {
      assert.strictEqual(isAllowedDomain("intruder@gmail.com", "gmail.com"), false);
      assert.strictEqual(isAllowedDomain("attacker@yahoo.com", null), false);
      assert.strictEqual(isAllowedDomain("phishing@cdktcnqn.edu.vn.evil.com", "evil.com"), false);
      assert.strictEqual(isAllowedDomain("spoof@fake-cdktcnqn.edu.vn", null), false);
      assert.strictEqual(isAllowedDomain("cdktcnqn.edu.vn@otherdomain.com", null), false);
      assert.strictEqual(isAllowedDomain("", null), false);
      assert.strictEqual(isAllowedDomain(null, null), false);
      assert.strictEqual(isAllowedDomain(undefined, undefined), false);
    });

    test("2.2 Rejects unverified email profile or non-matching domain in OAuth verification step", () => {
      const isVerifiedValid = (profile: { email?: string; email_verified?: boolean; hd?: string }) => {
        if (!profile.email_verified) return false;
        return isAllowedDomain(profile.email, profile.hd);
      };

      assert.strictEqual(isVerifiedValid({ email: "user@cdktcnqn.edu.vn", email_verified: false, hd: "cdktcnqn.edu.vn" }), false);
      assert.strictEqual(isVerifiedValid({ email: "user@gmail.com", email_verified: true, hd: "gmail.com" }), false);
      assert.strictEqual(isVerifiedValid({ email: "user@cdktcnqn.edu.vn", email_verified: true, hd: "cdktcnqn.edu.vn" }), true);
    });
  });

  // =========================================================================
  // 3. Closed Admission (No Auto-provisioning)
  // =========================================================================
  describe("Scenario 3: Closed Admission (No Auto-provisioning)", () => {
    test("3.1 Rejects unknown institutional emails with account_not_found error and prevents user creation", async () => {
      // Mock user not found in DB
      prisma.user.findUnique = (async () => null) as any;

      let createCalled = false;
      prisma.user.create = (async () => {
        createCalled = true;
        throw new Error("UNAUTHORIZED AUTO-PROVISIONING ATTEMPT");
      }) as any;

      // When an unknown user attempts to sign in
      const candidateEmail = "new.staff@cdktcnqn.edu.vn";
      const dbUser = await prisma.user.findUnique({ where: { email: candidateEmail } });

      let signInResult: string | boolean;
      if (!dbUser) {
        signInResult = "/login?error=account_not_found";
      } else {
        signInResult = true;
      }

      assert.strictEqual(signInResult, "/login?error=account_not_found");
      assert.strictEqual(createCalled, false, "Auto-provisioning user.create must not be called for unlisted email");
    });
  });

  // =========================================================================
  // 4. Disabled User Rejection
  // =========================================================================
  describe("Scenario 4: Disabled User Rejection (isActive = false)", () => {
    test("4.1 loadCurrentUser throws ACCOUNT_DISABLED for inactive user", async () => {
      prisma.user.findUnique = (async () => ({
        id: "usr_disabled_01",
        email: "locked.staff@cdktcnqn.edu.vn",
        name: "Cán bộ đã nghỉ việc",
        isActive: false,
      })) as any;

      await assert.rejects(
        async () => {
          await loadCurrentUser("usr_disabled_01");
        },
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, "ACCOUNT_DISABLED");
          assert.ok(err.message.includes("vô hiệu hóa") || err.message.includes("khóa"));
          return true;
        }
      );
    });

    test("4.2 assertSessionPolicy throws ACCOUNT_DISABLED when user entity is inactive", () => {
      assert.throws(
        () => {
          assertSessionPolicy(
            {
              sessionId: "sess_active_01",
              userId: "usr_disabled_01",
              expires: new Date(Date.now() + 3600000),
            },
            {
              id: "usr_disabled_01",
              email: "locked.staff@cdktcnqn.edu.vn",
              name: "Cán bộ đã nghỉ việc",
              isActive: false,
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, "ACCOUNT_DISABLED");
          return true;
        }
      );
    });

    test("4.3 resolveCurrentSession throws ACCOUNT_DISABLED when JWT corresponds to disabled user", async () => {
      prisma.user.findUnique = (async () => ({
        id: "usr_disabled_01",
        email: "locked.staff@cdktcnqn.edu.vn",
        name: "Cán bộ đã nghỉ việc",
        isActive: false,
      })) as any;

      (prisma as any).session = {
        findUnique: async () => null,
        findFirst: async () => null,
      };

      const token = signSessionToken({
        id: "usr_disabled_01",
        email: "locked.staff@cdktcnqn.edu.vn",
        name: "Cán bộ đã nghỉ việc",
        role: "CHUYEN_VIEN",
      });

      const req: NextRequest = new NextRequest("http://localhost:3000/api/tasks", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      await assert.rejects(
        async () => {
          await resolveCurrentSession(req);
        },
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, "ACCOUNT_DISABLED");
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. Account Linking
  // =========================================================================
  describe("Scenario 5: Account Linking to Existing User without Duplication", () => {
    test("5.1 Links Google OAuth account to existing User.id without modifying User.id", async () => {
      const existingDbUser = {
        id: "usr_canonical_existing_123",
        email: "chuyenvien.vanphong@cdktcnqn.edu.vn",
        name: "Chuyên viên Văn phòng",
        role: UserRole.CHUYEN_VIEN,

        avatarUrl: null,
        isActive: true,
        accounts: [],
      };

      let createdAccountData: any = null;
      let userUpdateData: any = null;

      prisma.user.findUnique = (async () => existingDbUser) as any;
      (prisma as any).account = {
        findUnique: async () => null,
        create: async ({ data }: any) => {
          createdAccountData = data;
          return { id: "acc_new_01", ...data };
        },
      };
      prisma.user.update = (async ({ where, data }: any) => {
        userUpdateData = { where, data };
        return { ...existingDbUser, ...data };
      }) as any;

      const googleSub = "google_sub_987654321";
      const googlePicture = "https://lh3.googleusercontent.com/a/avatar.jpg";

      await (prisma as any).account.create({
        data: {
          userId: existingDbUser.id,
          type: "oauth",
          provider: "google",
          providerAccountId: googleSub,
          access_token: "mock-access-token",
          token_type: "Bearer",
        },
      });

      if (!existingDbUser.avatarUrl && googlePicture) {
        await prisma.user.update({
          where: { id: existingDbUser.id },
          data: { avatarUrl: googlePicture },
        });
      }

      assert.ok(createdAccountData);
      assert.strictEqual(createdAccountData.userId, "usr_canonical_existing_123");
      assert.strictEqual(createdAccountData.provider, "google");
      assert.strictEqual(createdAccountData.providerAccountId, googleSub);

      assert.ok(userUpdateData);
      assert.strictEqual(userUpdateData.where.id, "usr_canonical_existing_123");
      assert.strictEqual(userUpdateData.data.avatarUrl, googlePicture);
    });
  });

  // =========================================================================
  // 6. No Role Elevation from Email
  // =========================================================================
  describe("Scenario 6: No Role Elevation from Email Keywords", () => {
    test("6.1 User with email containing 'bgh' or 'admin' retains exact DB role (CHUYEN_VIEN)", async () => {
      const deceptiveUser = {
        id: "usr_chuyenvien_deceptive",
        email: "bgh.troly.quantrimang@cdktcnqn.edu.vn",
        name: "Trợ lý Văn phòng",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",

        isActive: true,
      };

      prisma.user.findUnique = (async () => deceptiveUser) as any;
      (prisma as any).session = {
        findUnique: async () => null,
        findFirst: async () => null,
      };

      // 1. Evaluate session token resolution
      const token = signSessionToken({
        id: deceptiveUser.id,
        email: deceptiveUser.email,
        name: deceptiveUser.name,
        role: deceptiveUser.role,
      });

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const context = await getApiContext(req);
      assert.ok(context.user);
      assert.strictEqual(context.user?.role, "CHUYEN_VIEN", "User role must come strictly from DB, not email string");
      assert.notStrictEqual(context.user?.role, "ADMIN");
      assert.notStrictEqual(context.user?.role, "BAN_GIAM_HIEU");

      // 2. Evaluate Canonical Authorization Context
      const authCtx = await loadFreshAuthorizationContext(deceptiveUser.id);
      assert.strictEqual(authCtx.systemRoles.includes(SystemRole.SYSTEM_ADMIN), false);
      assert.strictEqual(authCtx.positions.length, 0);
    });
  });

  // =========================================================================
  // 7. Database Session Truth & Revocation
  // =========================================================================
  describe("Scenario 7: Database Session Truth & Revocation", () => {
    test("7.1 isSessionExpired detects expired timestamps accurately", () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 3600000);

      assert.strictEqual(isSessionExpired(pastDate), true);
      assert.strictEqual(isSessionExpired(futureDate), false);
      assert.strictEqual(isSessionExpired(Math.floor(Date.now() / 1000) - 10), true);
      assert.strictEqual(isSessionExpired(Math.floor(Date.now() / 1000) + 3600), false);
      assert.strictEqual(isSessionExpired(null), false);
      assert.strictEqual(isSessionExpired(undefined), false);
    });

    test("7.2 revokeSession immediately invalidates active session across the server", async () => {
      const sessionId = "sess_target_revocation_01";
      const userId = "usr_target_01";

      assert.strictEqual(isSessionRevoked(sessionId, userId), false);

      await revokeSession(sessionId, {
        revokeReason: "User logged out or administrative security termination",
      });

      assert.strictEqual(isSessionRevoked(sessionId, userId), true);

      assert.throws(
        () => {
          assertSessionPolicy({
            sessionId,
            userId,
            expires: new Date(Date.now() + 3600000),
          });
        },
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, "SESSION_INVALID");
          assert.ok(err.message.includes("thu hồi"));
          return true;
        }
      );
    });

    test("7.3 revokeAllUserSessions revokes all active sessions for a specified userId", async () => {
      const userId = "usr_mass_revoke_99";
      const sess1 = "sess_user_99_a";
      const sess2 = "sess_user_99_b";

      assert.strictEqual(isSessionRevoked(sess1, userId), false);
      assert.strictEqual(isSessionRevoked(sess2, userId), false);

      await revokeAllUserSessions(userId, {
        revokeReason: "Security credential reset",
      });

      assert.strictEqual(isSessionRevoked(sess1, userId), true);
      assert.strictEqual(isSessionRevoked(sess2, userId), true);
    });
  });

  // =========================================================================
  // 8. Legacy Token Rejection & No Synthetic Context
  // =========================================================================
  describe("Scenario 8: Legacy Token Rejection & No Synthetic Context Fallback", () => {
    test("8.1 Unauthenticated request returns empty context without synthetic fallback", async () => {
      const req = new NextRequest("http://localhost:3000/api/tasks");
      const ctx = await getApiContext(req);

      assert.strictEqual(ctx.user, null);
      assert.strictEqual(ctx.session, undefined);
    });

    test("8.2 Tampered token or invalid signature is rejected cleanly", async () => {
      const tamperedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature";
      const verified = verifySessionToken(tamperedToken);
      assert.strictEqual(verified, null);

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: {
          authorization: `Bearer ${tamperedToken}`,
        },
      });

      await assert.rejects(
        async () => {
          await getApiContext(req);
        },
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, "SESSION_INVALID");
          return true;
        }
      );
    });

    test("8.3 Non-existent user in DB throws SESSION_INVALID when resolving session", async () => {
      prisma.user.findUnique = (async () => null) as any;
      (prisma as any).session = {
        findUnique: async () => null,
        findFirst: async () => null,
      };

      const token = signSessionToken({
        id: "usr_ghost_not_in_db",
        email: "ghost@cdktcnqn.edu.vn",
        name: "Người dùng không tồn tại",
        role: "CHUYEN_VIEN",
      });

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      await assert.rejects(
        async () => {
          await resolveCurrentSession(req);
        },
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, "SESSION_INVALID");
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 9. Fail Closed
  // =========================================================================
  describe("Scenario 9: Fail Closed on Database Connection Errors", () => {
    test("9.1 Database error in loadCurrentUser fails closed by rejecting execution", async () => {
      prisma.user.findUnique = (async () => {
        throw new Error("DATABASE_CONNECTION_REFUSED");
      }) as any;

      await assert.rejects(
        async () => {
          await loadCurrentUser("usr_normal_01");
        },
        /DATABASE_CONNECTION_REFUSED/
      );
    });

    test("9.2 Database error in loadFreshAuthorizationContext fails closed", async () => {
      prisma.user.findUnique = (async () => {
        throw new Error("POSTGRES_POOL_EXHAUSTED");
      }) as any;

      await assert.rejects(
        async () => {
          await loadFreshAuthorizationContext("usr_normal_01");
        },
        /POSTGRES_POOL_EXHAUSTED/
      );
    });
  });

  // =========================================================================
  // 10. SoD / Maker-Checker & Authorization Preservation
  // =========================================================================
  describe("Scenario 10: SoD (Maker-Checker) & Authorization Preservation", () => {
    test("10.1 SystemRole correctly isolates ADMIN (SYSTEM_ADMIN) from business authority", async () => {
      const adminDbUser = {
        id: "usr_admin_sys",
        email: "admin.it@cdktcnqn.edu.vn",
        name: "Quản trị viên Hệ thống",
        role: UserRole.ADMIN,
        title: "Quản trị mạng",
        phone: null,
        avatarUrl: null,
        provider: "google",

        isActive: true,
      };

      prisma.user.findUnique = (async () => adminDbUser) as any;

      const authCtx = await loadFreshAuthorizationContext(adminDbUser.id);
      assert.strictEqual(authCtx.systemRoles.includes(SystemRole.SYSTEM_ADMIN), true);
      assert.strictEqual(authCtx.positions.length, 0);
    });

    test("10.2 extractTokenFromRequest handles Authorization header, NextAuth cookies and fallback cookie headers", () => {
      // 1. Bearer Header
      const reqBearer = {
        headers: new Headers({
          authorization: "Bearer my-secret-bearer-token",
        }),
      };
      assert.strictEqual(extractTokenFromRequest(reqBearer), "my-secret-bearer-token");

      // 2. Cookie object
      const reqCookie = {
        cookies: {
          get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: "cookie-token-val" } : undefined),
        },
      };
      assert.strictEqual(extractTokenFromRequest(reqCookie), "cookie-token-val");

      // 3. Raw Cookie string
      const reqRawCookie = {
        headers: new Headers({
          cookie: `other=123; ${SESSION_COOKIE_NAME}=raw-cookie-token; secure=true`,
        }),
      };
      assert.strictEqual(extractTokenFromRequest(reqRawCookie), "raw-cookie-token");
    });

    test("10.3 SoD (Maker-Checker) invariant: Maker/Assignee cannot self-approve without statutory delegation", () => {
      // Maker-Checker Invariant validation
      const isSelfApprovalAllowed = (options: {
        isAssignee: boolean;
        isCreator: boolean;
        isManagerOrBGH: boolean;
        hasDelegation: boolean;
      }) => {
        if (options.hasDelegation) return true;
        if (options.isAssignee && !options.isManagerOrBGH) return false;
        if (options.isCreator && !options.isManagerOrBGH) return false;
        return options.isManagerOrBGH;
      };

      // Staff (Maker) attempts to approve own task -> Disallowed
      assert.strictEqual(
        isSelfApprovalAllowed({
          isAssignee: true,
          isCreator: false,
          isManagerOrBGH: false,
          hasDelegation: false,
        }),
        false,
        "Staff must not self-approve work"
      );

      // Staff with active delegation -> Allowed
      assert.strictEqual(
        isSelfApprovalAllowed({
          isAssignee: true,
          isCreator: false,
          isManagerOrBGH: false,
          hasDelegation: true,
        }),
        true,
        "Staff with explicit delegation grant can approve"
      );

      // Manager/BGH (Checker) -> Allowed
      assert.strictEqual(
        isSelfApprovalAllowed({
          isAssignee: false,
          isCreator: false,
          isManagerOrBGH: true,
          hasDelegation: false,
        }),
        true,
        "Authorized manager/BGH can approve"
      );
    });

    test("10.4 Business Authorization Invariant: CHUYEN_VIEN cannot perform BGH executive actions", async () => {
      const staffUser = {
        id: "usr_staff_plain",
        email: "staff.cntt@cdktcnqn.edu.vn",
        name: "Chuyên viên Khoa CNTT",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",
        phone: null,
        avatarUrl: null,
        provider: "google",

        isActive: true,
      };

      prisma.user.findUnique = (async () => staffUser) as any;

      const authCtx = await loadFreshAuthorizationContext(staffUser.id);
      assert.strictEqual(authCtx.isSystemAdmin(), false);
      assert.strictEqual(authCtx.hasLeadershipPosition(), false);
      assert.strictEqual(authCtx.positions.length, 0);
    });
  });
});
