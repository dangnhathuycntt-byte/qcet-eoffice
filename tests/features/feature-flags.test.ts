import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NextRequest } from "next/server";
import {
  isFeatureEnabled,
  getAllFeatureFlags,
  getPublicFeatureFlags,
  setFeatureFlagOverride,
  resetFeatureFlagOverrides,
  getFeatureFlagOverrides,
  FEATURE_FLAGS,
  toSnakeCaseUpper,
  parseBooleanFlag,
  getEnvVariableNamesForFlag,
  FeatureFlagKey,
} from "@/features/flags";
import { getPublicRuntimeConfig, assertZeroSecrets } from "@/config/runtime";
import { sendPushNotificationToUser } from "@/lib/push-service";
import { GET as googleAuthRoute } from "@/app/api/auth/google/route";
import { GET as nextAuthRoute } from "@/app/api/auth/[...nextauth]/route";
import { GET as exportExcelRoute } from "@/app/api/documents/export-excel/route";
import { flushOfflineMutations } from "@/lib/offline-sync";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";

describe("Feature Flags & Operational Kill Switches (Task 4)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetFeatureFlagOverrides();
    // Clean up any test-modified environment variables
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith("FEATURE_FLAG_") ||
        key.startsWith("FEATURE_") ||
        key.startsWith("NEXT_PUBLIC_FEATURE_")
      ) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    resetFeatureFlagOverrides();
    process.env = { ...originalEnv };
  });

  describe("1. Flag Definitions & Default States", () => {
    it("defines all mandatory operational flags with correct metadata", () => {
      const expectedFlags: FeatureFlagKey[] = [
        "pushNotifications",
        "externalGoogleLogin",
        "offlineMutations",
        "largeExcelExport",
        "taskWorkspaceV2",
        "mobileAgenda",
        "newExecutiveDashboard",
        "uxTasksV5",
        "uxCalendarV5",
        "uxNotificationsV5",
        "uxDocumentsV5",
        "uxOrgV5",
      ];

      for (const flag of expectedFlags) {
        assert.ok(flag in FEATURE_FLAGS, `Flag ${flag} must be defined in FEATURE_FLAGS`);
        const def = FEATURE_FLAGS[flag];
        assert.strictEqual(def.key, flag);
        assert.ok(typeof def.description === "string" && def.description.length > 0);
        assert.strictEqual(typeof def.defaultValue, "boolean");
        assert.strictEqual(typeof def.isKillSwitch, "boolean");
        assert.strictEqual(typeof def.isPublic, "boolean");
      }
    });

    it("evaluates default states accurately in the absence of overrides", () => {
      // Kill switches are enabled by default for normal operational capability
      assert.strictEqual(isFeatureEnabled("pushNotifications"), true);
      assert.strictEqual(isFeatureEnabled("externalGoogleLogin"), true);
      assert.strictEqual(isFeatureEnabled("offlineMutations"), true);
      assert.strictEqual(isFeatureEnabled("largeExcelExport"), true);

      // Phased rollout features are disabled by default
      assert.strictEqual(isFeatureEnabled("taskWorkspaceV2"), false);
      assert.strictEqual(isFeatureEnabled("mobileAgenda"), false);
      assert.strictEqual(isFeatureEnabled("newExecutiveDashboard"), false);

      // V5.1 migration-boundary rollout flags are disabled by default
      assert.strictEqual(isFeatureEnabled("uxTasksV5"), false);
      assert.strictEqual(isFeatureEnabled("uxCalendarV5"), false);
      assert.strictEqual(isFeatureEnabled("uxNotificationsV5"), false);
      assert.strictEqual(isFeatureEnabled("uxDocumentsV5"), false);
      assert.strictEqual(isFeatureEnabled("uxOrgV5"), false);
    });

    it("returns false safely for invalid or non-existent feature flags without throwing", () => {
      // @ts-expect-error - testing invalid runtime input
      assert.strictEqual(isFeatureEnabled("nonExistentFeature"), false);
      // @ts-expect-error - testing empty input
      assert.strictEqual(isFeatureEnabled(""), false);
      // @ts-expect-error - testing null input
      assert.strictEqual(isFeatureEnabled(null), false);
      // @ts-expect-error - testing undefined input
      assert.strictEqual(isFeatureEnabled(undefined), false);
    });
  });

  describe("2. String Transformation & Boolean Flag Parsing", () => {
    it("toSnakeCaseUpper correctly formats camelCase keys", () => {
      assert.strictEqual(toSnakeCaseUpper("pushNotifications"), "PUSH_NOTIFICATIONS");
      assert.strictEqual(toSnakeCaseUpper("externalGoogleLogin"), "EXTERNAL_GOOGLE_LOGIN");
      assert.strictEqual(toSnakeCaseUpper("offlineMutations"), "OFFLINE_MUTATIONS");
      assert.strictEqual(toSnakeCaseUpper("largeExcelExport"), "LARGE_EXCEL_EXPORT");
      assert.strictEqual(toSnakeCaseUpper("taskWorkspaceV2"), "TASK_WORKSPACE_V2");
      assert.strictEqual(toSnakeCaseUpper("mobileAgenda"), "MOBILE_AGENDA");
      assert.strictEqual(toSnakeCaseUpper("newExecutiveDashboard"), "NEW_EXECUTIVE_DASHBOARD");
      assert.strictEqual(toSnakeCaseUpper("uxTasksV5"), "UX_TASKS_V5");
      assert.strictEqual(toSnakeCaseUpper("uxCalendarV5"), "UX_CALENDAR_V5");
      assert.strictEqual(toSnakeCaseUpper("uxNotificationsV5"), "UX_NOTIFICATIONS_V5");
      assert.strictEqual(toSnakeCaseUpper("uxDocumentsV5"), "UX_DOCUMENTS_V5");
      assert.strictEqual(toSnakeCaseUpper("uxOrgV5"), "UX_ORG_V5");
    });

    it("parseBooleanFlag parses varied truthy and falsy representations", () => {
      // Truthy
      assert.strictEqual(parseBooleanFlag(true), true);
      assert.strictEqual(parseBooleanFlag("true"), true);
      assert.strictEqual(parseBooleanFlag("TRUE"), true);
      assert.strictEqual(parseBooleanFlag("1"), true);
      assert.strictEqual(parseBooleanFlag("yes"), true);
      assert.strictEqual(parseBooleanFlag("on"), true);
      assert.strictEqual(parseBooleanFlag("enabled"), true);

      // Falsy
      assert.strictEqual(parseBooleanFlag(false), false);
      assert.strictEqual(parseBooleanFlag("false"), false);
      assert.strictEqual(parseBooleanFlag("FALSE"), false);
      assert.strictEqual(parseBooleanFlag("0"), false);
      assert.strictEqual(parseBooleanFlag("no"), false);
      assert.strictEqual(parseBooleanFlag("off"), false);
      assert.strictEqual(parseBooleanFlag("disabled"), false);

      // Undefined/Invalid
      assert.strictEqual(parseBooleanFlag("invalid"), undefined);
      assert.strictEqual(parseBooleanFlag(""), undefined);
      assert.strictEqual(parseBooleanFlag(null), undefined);
      assert.strictEqual(parseBooleanFlag(undefined), undefined);
    });

    it("getEnvVariableNamesForFlag generates canonical candidate environment variable names", () => {
      const candidates = getEnvVariableNamesForFlag("pushNotifications");
      assert.ok(candidates.includes("FEATURE_FLAG_PUSH_NOTIFICATIONS"));
      assert.ok(candidates.includes("FEATURE_PUSH_NOTIFICATIONS"));
      assert.ok(candidates.includes("FEATURE_FLAG_pushNotifications"));
      assert.ok(candidates.includes("NEXT_PUBLIC_FEATURE_FLAG_PUSH_NOTIFICATIONS"));
    });
  });

  describe("3. Environment Variable Overrides", () => {
    it("disables pushNotifications when FEATURE_FLAG_PUSH_NOTIFICATIONS=false", () => {
      assert.strictEqual(isFeatureEnabled("pushNotifications"), true);
      process.env.FEATURE_FLAG_PUSH_NOTIFICATIONS = "false";
      assert.strictEqual(isFeatureEnabled("pushNotifications"), false);
    });

    it("disables externalGoogleLogin when FEATURE_EXTERNAL_GOOGLE_LOGIN=0", () => {
      assert.strictEqual(isFeatureEnabled("externalGoogleLogin"), true);
      process.env.FEATURE_EXTERNAL_GOOGLE_LOGIN = "0";
      assert.strictEqual(isFeatureEnabled("externalGoogleLogin"), false);
    });

    it("enables taskWorkspaceV2 rollout when FEATURE_FLAG_TASK_WORKSPACE_V2=true", () => {
      assert.strictEqual(isFeatureEnabled("taskWorkspaceV2"), false);
      process.env.FEATURE_FLAG_TASK_WORKSPACE_V2 = "true";
      assert.strictEqual(isFeatureEnabled("taskWorkspaceV2"), true);
    });

    it("enables mobileAgenda when NEXT_PUBLIC_FEATURE_FLAG_MOBILE_AGENDA=1", () => {
      assert.strictEqual(isFeatureEnabled("mobileAgenda"), false);
      process.env.NEXT_PUBLIC_FEATURE_FLAG_MOBILE_AGENDA = "1";
      assert.strictEqual(isFeatureEnabled("mobileAgenda"), true);
    });

    it("enables newExecutiveDashboard when FEATURE_FLAG_newExecutiveDashboard=enabled", () => {
      assert.strictEqual(isFeatureEnabled("newExecutiveDashboard"), false);
      process.env.FEATURE_FLAG_newExecutiveDashboard = "enabled";
      assert.strictEqual(isFeatureEnabled("newExecutiveDashboard"), true);
    });

    it("enables V5 migration-boundary rollout flags via their canonical env names", () => {
      // Canonical camelCase key -> UPPER_SNAKE env name mapping (§38.3 UX_*_V5).
      assert.strictEqual(isFeatureEnabled("uxTasksV5"), false);
      process.env.FEATURE_FLAG_UX_TASKS_V5 = "true";
      assert.strictEqual(isFeatureEnabled("uxTasksV5"), true);

      assert.strictEqual(isFeatureEnabled("uxCalendarV5"), false);
      process.env.FEATURE_FLAG_UX_CALENDAR_V5 = "true";
      assert.strictEqual(isFeatureEnabled("uxCalendarV5"), true);

      assert.strictEqual(isFeatureEnabled("uxNotificationsV5"), false);
      process.env.NEXT_PUBLIC_FEATURE_FLAG_UX_NOTIFICATIONS_V5 = "1";
      assert.strictEqual(isFeatureEnabled("uxNotificationsV5"), true);

      assert.strictEqual(isFeatureEnabled("uxDocumentsV5"), false);
      process.env.FEATURE_UX_DOCUMENTS_V5 = "on";
      assert.strictEqual(isFeatureEnabled("uxDocumentsV5"), true);

      assert.strictEqual(isFeatureEnabled("uxOrgV5"), false);
      process.env.FEATURE_FLAG_uxOrgV5 = "enabled";
      assert.strictEqual(isFeatureEnabled("uxOrgV5"), true);
    });
  });

  describe("4. Runtime In-Memory Overrides", () => {
    it("allows hot overriding and takes precedence over environment variables and defaults", () => {
      process.env.FEATURE_FLAG_PUSH_NOTIFICATIONS = "true";

      // Hot kill switch override
      setFeatureFlagOverride("pushNotifications", false);
      assert.strictEqual(isFeatureEnabled("pushNotifications"), false);

      // Verify getFeatureFlagOverrides reflects active overrides
      const overrides = getFeatureFlagOverrides();
      assert.strictEqual(overrides.pushNotifications, false);

      // Removing single override reverts to environment variable
      setFeatureFlagOverride("pushNotifications", undefined);
      assert.strictEqual(isFeatureEnabled("pushNotifications"), true);
    });

    it("resetFeatureFlagOverrides clears all overrides simultaneously", () => {
      setFeatureFlagOverride("pushNotifications", false);
      setFeatureFlagOverride("taskWorkspaceV2", true);

      assert.strictEqual(isFeatureEnabled("pushNotifications"), false);
      assert.strictEqual(isFeatureEnabled("taskWorkspaceV2"), true);

      resetFeatureFlagOverrides();

      assert.strictEqual(isFeatureEnabled("pushNotifications"), true);
      assert.strictEqual(isFeatureEnabled("taskWorkspaceV2"), false);
      assert.deepStrictEqual(getFeatureFlagOverrides(), {});
    });
  });

  describe("5. Dictionary Resolvers & Safe Client Exposure", () => {
    it("getAllFeatureFlags evaluates every flag accurately", () => {
      setFeatureFlagOverride("taskWorkspaceV2", true);
      const allFlags = getAllFeatureFlags();

      assert.strictEqual(allFlags.pushNotifications, true);
      assert.strictEqual(allFlags.externalGoogleLogin, true);
      assert.strictEqual(allFlags.offlineMutations, true);
      assert.strictEqual(allFlags.largeExcelExport, true);
      assert.strictEqual(allFlags.taskWorkspaceV2, true);
      assert.strictEqual(allFlags.mobileAgenda, false);
      assert.strictEqual(allFlags.newExecutiveDashboard, false);
      assert.strictEqual(allFlags.uxTasksV5, false);
      assert.strictEqual(allFlags.uxCalendarV5, false);
      assert.strictEqual(allFlags.uxNotificationsV5, false);
      assert.strictEqual(allFlags.uxDocumentsV5, false);
      assert.strictEqual(allFlags.uxOrgV5, false);
    });

    it("getPublicFeatureFlags provides zero secrets and conforms to runtime-config whitelist", () => {
      const publicFlags = getPublicFeatureFlags();

      // All keys must be defined
      assert.strictEqual(typeof publicFlags.pushNotifications, "boolean");
      assert.strictEqual(typeof publicFlags.externalGoogleLogin, "boolean");
      assert.strictEqual(typeof publicFlags.offlineMutations, "boolean");
      assert.strictEqual(typeof publicFlags.largeExcelExport, "boolean");
      assert.strictEqual(typeof publicFlags.taskWorkspaceV2, "boolean");
      assert.strictEqual(typeof publicFlags.mobileAgenda, "boolean");
      assert.strictEqual(typeof publicFlags.newExecutiveDashboard, "boolean");
      assert.strictEqual(typeof publicFlags.uxTasksV5, "boolean");
      assert.strictEqual(typeof publicFlags.uxCalendarV5, "boolean");
      assert.strictEqual(typeof publicFlags.uxNotificationsV5, "boolean");
      assert.strictEqual(typeof publicFlags.uxDocumentsV5, "boolean");
      assert.strictEqual(typeof publicFlags.uxOrgV5, "boolean");

      // Verify zero secrets scanner passes on public flags
      assert.doesNotThrow(() => assertZeroSecrets(publicFlags as unknown as Record<string, unknown>));
    });

    it("integrates seamlessly with getPublicRuntimeConfig", () => {
      setFeatureFlagOverride("pushNotifications", false);
      setFeatureFlagOverride("newExecutiveDashboard", true);

      const runtimeConfig = getPublicRuntimeConfig();

      assert.strictEqual(runtimeConfig.features.pushNotifications, false);
      assert.strictEqual(runtimeConfig.features.newExecutiveDashboard, true);
      assert.strictEqual(runtimeConfig.features.webPush, false); // Disabled because pushNotifications is killed

      assert.doesNotThrow(() => assertZeroSecrets(runtimeConfig as unknown as Record<string, unknown>));
    });
  });

  describe("6. Operational Kill Switch Integration", () => {
    it("push-service aborts sending when pushNotifications is killed", async () => {
      setFeatureFlagOverride("pushNotifications", false);

      const result = await sendPushNotificationToUser("any-user-id", {
        title: "Thông báo test",
        body: "Nội dung kiểm tra kill switch",
        tag: "test",
        data: {
          linkHref: "/tasks",
          event: "GIAO_VIEC",
        },
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.sentCount, 0);
      assert.strictEqual(result.failedCount, 0);
      assert.strictEqual(result.revokedCount, 0);
    });

    it("auth/google route redirects with error when externalGoogleLogin is killed", async () => {
      setFeatureFlagOverride("externalGoogleLogin", false);

      const req = new NextRequest("http://localhost:3000/api/auth/google");
      const res = await googleAuthRoute(req);

      assert.strictEqual(res.status, 307); // Redirect
      const location = res.headers.get("location");
      assert.ok(location?.includes("/login?error=oauth_not_configured"));
    });

    it("auth Google signin route redirects with error when externalGoogleLogin is killed", async () => {
      setFeatureFlagOverride("externalGoogleLogin", false);

      const req = new NextRequest("http://localhost:3000/api/auth/google");
      const res = await googleAuthRoute(req);

      assert.strictEqual(res.status, 307); // Redirect
      const location = res.headers.get("location");
      assert.ok(location?.includes("/login?error=oauth_not_configured"));
    });

    it("documents/export-excel route returns 503 when largeExcelExport is killed", async () => {
      setFeatureFlagOverride("largeExcelExport", false);

      const originalFindUnique = prisma.user.findUnique;
      (prisma.user.findUnique as any) = async () => ({
        id: "test-admin-id",
        email: "admin@cdktcnqn.edu.vn",
        name: "Quản trị viên",
        role: "BAN_GIAM_HIEU",
        isActive: true,
      });

      try {
        const sessionToken = signSessionToken({
          id: "test-admin-id",
          email: "admin@cdktcnqn.edu.vn",
          name: "Quản trị viên",
          role: "BAN_GIAM_HIEU",
        });

        const req = new NextRequest("http://localhost:3000/api/documents/export-excel?type=VAN_BAN_DEN&year=2026", {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
          },
        });

        const res = await exportExcelRoute(req);
        assert.strictEqual(res.status, 503);

        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.code, "FEATURE_DISABLED");
        assert.ok(body.error.includes("vô hiệu hóa bởi cấu hình vận hành"));
      } finally {
        prisma.user.findUnique = originalFindUnique;
      }
    });

    it("offline-sync aborts flush when offlineMutations is killed", async () => {
      setFeatureFlagOverride("offlineMutations", false);

      const result = await flushOfflineMutations();
      assert.deepStrictEqual(result, { succeeded: 0, failed: 0 });
    });
  });

  describe("7. Architectural Invariant Assertion", () => {
    it("confirms feature flag is orthogonal to user authorization", () => {
      // Invariant: An enabled feature flag does not grant authorization.
      // E.g., largeExcelExport enabled still requires a valid authenticated session.
      assert.strictEqual(isFeatureEnabled("largeExcelExport"), true);

      // Call without session token
      const req = new NextRequest("http://localhost:3000/api/documents/export-excel?type=VAN_BAN_DEN");
      return exportExcelRoute(req).then((res) => {
        assert.strictEqual(res.status, 401, "Enabled feature flag MUST NOT bypass 401 Unauthorized check");
      });
    });
  });

  describe("8. V5 Migration-Boundary Rollout Flags (C17 / T92)", () => {
    const V5_FLAGS: FeatureFlagKey[] = [
      "uxTasksV5",
      "uxCalendarV5",
      "uxNotificationsV5",
      "uxDocumentsV5",
      "uxOrgV5",
    ];

    it("registers exactly one rollout flag per migration boundary (no per-component flags)", () => {
      for (const flag of V5_FLAGS) {
        const def = FEATURE_FLAGS[flag];
        assert.ok(def, `Flag ${flag} must be defined`);
        assert.strictEqual(def.key, flag);
        assert.strictEqual(def.defaultValue, false, `${flag} must default OFF`);
        assert.strictEqual(def.isKillSwitch, false, `${flag} is a rollout flag, not a kill switch`);
        assert.strictEqual(def.isPublic, true, `${flag} must be client-safe (isPublic)`);
        assert.ok(def.description.length > 0);
      }
    });

    it("keeps rollout flags distinct from operational kill switches", () => {
      const operational: FeatureFlagKey[] = [
        "pushNotifications",
        "externalGoogleLogin",
        "offlineMutations",
        "largeExcelExport",
      ];
      for (const key of operational) {
        assert.strictEqual(FEATURE_FLAGS[key].isKillSwitch, true);
        assert.strictEqual(FEATURE_FLAGS[key].defaultValue, true);
      }
      for (const key of V5_FLAGS) {
        assert.strictEqual(FEATURE_FLAGS[key].isKillSwitch, false);
      }
    });

    it("exposes all V5 rollout flags through getPublicFeatureFlags", () => {
      const publicFlags = getPublicFeatureFlags();
      for (const flag of V5_FLAGS) {
        assert.strictEqual(typeof publicFlags[flag], "boolean");
      }
    });

    it("is not read anywhere in the server authorization / policy layer (Feature Flag != Permission)", () => {
      const flagTokens = [
        "isFeatureEnabled",
        "FEATURE_FLAGS",
        "features/flags",
        "getPublicFeatureFlags",
        "getAllFeatureFlags",
      ];
      const scanRoots = [
        resolve(process.cwd(), "src/server/authorization"),
        resolve(process.cwd(), "src/server/policies"),
      ];
      const offenders: string[] = [];

      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            const content = readFileSync(full, "utf8");
            if (flagTokens.some((token) => content.includes(token))) {
              offenders.push(full);
            }
          }
        }
      };

      for (const root of scanRoots) {
        if (existsSync(root)) walk(root);
      }

      assert.deepStrictEqual(
        offenders,
        [],
        `Authorization/policy modules must never read feature flags: ${offenders.join(", ")}`
      );
    });
  });
});
