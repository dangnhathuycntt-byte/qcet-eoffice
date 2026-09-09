/**
 * Runtime configuration interface and helpers for QCET E-Office.
 * Enforces strict boundary between server secrets and client-safe runtime configuration.
 */

import { getPublicFeatureFlags, isFeatureEnabled } from "@/features/flags";

export interface PublicRuntimeFeatures {
  googleAuth: boolean;
  webPush: boolean;
  academicCalendarSync: boolean;
  offlineSupport: boolean;
  pushNotifications: boolean;
  externalGoogleLogin: boolean;
  offlineMutations: boolean;
  largeExcelExport: boolean;
  taskWorkspaceV2: boolean;
  mobileAgenda: boolean;
  newExecutiveDashboard: boolean;
  [key: string]: boolean;
}

export interface PublicRuntimeConfig {
  environment: "development" | "production" | "test";
  features: PublicRuntimeFeatures;
  version: string;
  buildId: string;
  appUrl?: string;
  referenceDate?: string;
}

const FORBIDDEN_SECRET_KEY_PATTERNS = [
  /SECRET/i,
  /(?<!PUBLIC_)PRIVATE/i,
  /PASSWORD/i,
  /DATABASE/i,
  /JWT/i,
  /TOKEN/i,
  /CREDENTIAL/i,
];

/**
 * Scans an object recursively to assert that zero secrets or sensitive keys are present.
 * Throws a SecurityError if any secret pattern or database connection string is detected.
 */
export function assertZeroSecrets(config: Record<string, unknown>): void {
  function scan(obj: unknown, path: string = ""): void {
    if (!obj || typeof obj !== "object") {
      if (typeof obj === "string") {
        if (/^postgres(ql)?:\/\//i.test(obj)) {
          throw new Error(
            `[QCET-SECURITY] Database connection string leaked in runtime config at '${path}'`
          );
        }
        if (/BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY/i.test(obj)) {
          throw new Error(
            `[QCET-SECURITY] Private cryptographic key leaked in runtime config at '${path}'`
          );
        }
      }
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => scan(item, `${path}[${index}]`));
      return;
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = path ? `${path}.${key}` : key;
      for (const pattern of FORBIDDEN_SECRET_KEY_PATTERNS) {
        if (pattern.test(key)) {
          throw new Error(
            `[QCET-SECURITY] Forbidden secret key pattern matched '${key}' at path '${currentPath}'`
          );
        }
      }
      scan(value, currentPath);
    }
  }

  scan(config);
}

/**
 * Generates the safe public runtime configuration.
 * Never includes server-only secrets (DATABASE_URL, AUTH_SECRET, VAPID_PRIVATE_KEY, etc.).
 */
export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  const environment =
    (process.env.NODE_ENV as "development" | "production" | "test") || "development";

  const version = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
  const buildId =
    process.env.BUILD_ID ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "development";

  const publicFlags = getPublicFeatureFlags();

  const googleAuth =
    isFeatureEnabled("externalGoogleLogin") &&
    Boolean(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  const webPush =
    isFeatureEnabled("pushNotifications") &&
    Boolean(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

  const offlineSupport = isFeatureEnabled("offlineMutations");

  const config: PublicRuntimeConfig = {
    environment,
    features: {
      ...publicFlags,
      googleAuth,
      webPush,
      academicCalendarSync: true,
      offlineSupport,
    },
    version,
    buildId,
  };

  if (process.env.NEXT_PUBLIC_APP_URL) {
    config.appUrl = process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.NEXT_PUBLIC_REFERENCE_DATE) {
    config.referenceDate = process.env.NEXT_PUBLIC_REFERENCE_DATE;
  }

  // Pre-flight validation ensuring no secrets were accidentally attached
  assertZeroSecrets(config as unknown as Record<string, unknown>);

  return config;
}
