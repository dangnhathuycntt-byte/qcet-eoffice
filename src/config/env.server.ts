import { z } from "zod";

/**
 * Development & testing fallback values.
 * In production, these fallbacks are NEVER used; explicit secure values are strictly required.
 */
export const DEV_AUTH_SECRET_FALLBACK =
  "qcet_dev_fallback_secret_key_2026_super_safe_32_chars";
export const DEV_DATABASE_URL_FALLBACK =
  "postgresql://localhost:5432/qcet_eoffice?schema=public";

/**
 * Detects whether we are in a Next.js build phase or explicit CI/Docker build bypass.
 * In Docker builds (`RUN npm run build`), NODE_ENV=production is set but runtime secrets
 * are intentionally not present during static compilation.
 */
export function isBuildPhase(env: Record<string, unknown> = process.env): boolean {
  return (
    env.NEXT_PHASE === "phase-production-build" ||
    env.SKIP_ENV_VALIDATION === "true"
  );
}

/**
 * Zod schema for server environment configuration.
 * Enforces strict validation and fail-fast behavior in production.
 * Uses immutable transform without mutating input objects in superRefine.
 */
export const ServerEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z
      .union([z.string(), z.number()])
      .default(3001)
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
    DATABASE_URL: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional().default("mailto:admin@cdktcnqn.edu.vn"),
    AUTH_ALLOWED_DOMAINS: z.string().optional().default("cdktcnqn.edu.vn"),
    NEXTAUTH_URL: z.string().optional(),
    UPLOADS_DIR: z.string().optional(),
    PRIVATE_STORAGE_DIR: z.string().optional(),
    TEMP_STORAGE_DIR: z.string().optional(),
  })
  .transform((raw) => {
    // Resolve aliases and development fallbacks immutably
    const isProduction = raw.NODE_ENV === "production";
    const authSecret =
      raw.AUTH_SECRET ||
      raw.JWT_SECRET ||
      (!isProduction ? DEV_AUTH_SECRET_FALLBACK : undefined);
    const databaseUrl =
      raw.DATABASE_URL ||
      (!isProduction ? DEV_DATABASE_URL_FALLBACK : undefined);
    const vapidPublicKey =
      raw.VAPID_PUBLIC_KEY || raw.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    return {
      ...raw,
      AUTH_SECRET: authSecret,
      DATABASE_URL: databaseUrl,
      VAPID_PUBLIC_KEY: vapidPublicKey,
    };
  })
  .superRefine((data, ctx) => {
    const isProduction = data.NODE_ENV === "production";

    if (isProduction) {
      // DATABASE_URL is strictly required in production
      if (!data.DATABASE_URL || data.DATABASE_URL.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL is required in production",
          path: ["DATABASE_URL"],
        });
      }

      // AUTH_SECRET (or JWT_SECRET) is strictly required and must be >= 32 chars in production
      if (!data.AUTH_SECRET || data.AUTH_SECRET.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "AUTH_SECRET (or JWT_SECRET) is required in production",
          path: ["AUTH_SECRET"],
        });
      } else if (data.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `AUTH_SECRET must be at least 32 characters in production (received ${data.AUTH_SECRET.length})`,
          path: ["AUTH_SECRET"],
        });
      }

      // If Google Client ID is configured, secret must also be provided
      if (data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is provided in production",
          path: ["GOOGLE_CLIENT_SECRET"],
        });
      }

      // If VAPID private key is set, public key must also be provided
      if (data.VAPID_PRIVATE_KEY && !data.VAPID_PUBLIC_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "VAPID_PUBLIC_KEY is required when VAPID_PRIVATE_KEY is provided in production",
          path: ["VAPID_PUBLIC_KEY"],
        });
      }
    } else {
      if (data.AUTH_SECRET && data.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `AUTH_SECRET must be at least 32 characters (received ${data.AUTH_SECRET.length})`,
          path: ["AUTH_SECRET"],
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * Startup validation helper that validates server environment.
 * Throws immediately with clear error messages if required server secrets are missing in production.
 * In Docker or CI builds, bypasses missing runtime secrets if NEXT_PHASE or SKIP_ENV_VALIDATION is present.
 */
export function validateServerEnv(
  rawEnv: Record<string, unknown> = process.env
): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "[QCET-ENV] Server environment configuration must never be accessed or imported in browser runtime."
    );
  }

  // During Docker or Next.js production build phase, synthesize build placeholders if runtime secrets are absent
  const isBuilding = isBuildPhase(rawEnv);
  const effectiveEnv = isBuilding
    ? {
        ...rawEnv,
        DATABASE_URL:
          (rawEnv.DATABASE_URL as string) ||
          "postgresql://build-placeholder:5432/qcet_build?schema=public",
        AUTH_SECRET:
          (rawEnv.AUTH_SECRET as string) ||
          (rawEnv.JWT_SECRET as string) ||
          "qcet_build_placeholder_secret_key_2026_min_32_chars",
      }
    : rawEnv;

  const result = ServerEnvSchema.safeParse(effectiveEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join(".") || "ROOT"}]: ${issue.message}`)
      .join("\n");
    const errorMessage = `[QCET-ENV] Server environment startup validation failed:\n${errorDetails}`;
    throw new Error(errorMessage);
  }
  return result.data;
}

let _cachedServerEnv: ServerEnv | null = null;

/**
 * Returns validated server environment configuration singleton.
 */
export function getServerEnv(): ServerEnv {
  if (!_cachedServerEnv) {
    _cachedServerEnv = validateServerEnv(process.env);
  }
  return _cachedServerEnv;
}

/**
 * Reset cached server environment (primarily for testing).
 */
export function resetServerEnv(): void {
  _cachedServerEnv = null;
}

/**
 * Lazy proxy to access server environment variables.
 */
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop) {
    const env = getServerEnv();
    return Reflect.get(env, prop);
  },
});

// Fail-fast on server startup when in production, skipping during Next.js/Docker build phase
if (
  typeof window === "undefined" &&
  process.env.NODE_ENV === "production" &&
  !isBuildPhase()
) {
  validateServerEnv(process.env);
}
