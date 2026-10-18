import { z } from "zod";
import { FORBIDDEN_SERVER_SECRETS } from "@qcet/shared/config/server-secret-names";

/**
 * List of known forbidden secret names that must NEVER be leaked to the client.
 * Danh sách nằm ở @qcet/shared để mã web không chứa tên biến bí mật server.
 */
export { FORBIDDEN_SERVER_SECRETS };

/**
 * Zod schema for client environment variables.
 * Enforces that only safe NEXT_PUBLIC_* variables and NODE_ENV are accepted,
 * and strictly rejects any server secrets, private keys, or connection strings.
 */
export const ClientEnvSchema = z
  .object({
    NODE_ENV: z
      .preprocess((val) => {
        if (!val || val === "undefined" || val === "") {
          return "development";
        }
        return val;
      }, z.enum(["development", "production", "test"]))
      .default("development"),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
    NEXT_PUBLIC_REFERENCE_DATE: z.string().optional(),
    NEXT_PUBLIC_APP_VERSION: z.string().optional(),
    NEXT_PUBLIC_ENABLE_SW: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Deep inspection of values: verify values do not contain database URLs or private keys
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        if (/^postgres(ql)?:\/\//i.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Client environment key '${key}' contains database connection string`,
            path: [key],
          });
        }
        if (/BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY/i.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Client environment key '${key}' contains private cryptographic key`,
            path: [key],
          });
        }
      }
    }
  });

export type ClientEnv = z.infer<typeof ClientEnvSchema>;

/**
 * Static client source map.
 * Next.js bundlers (Webpack / Turbopack) only inline process.env.NEXT_PUBLIC_*
 * when referenced statically as member expressions. Dynamic access fails in browser runtime.
 */
export const clientSource = {
  get NODE_ENV() {
    return process.env.NODE_ENV;
  },
  get NEXT_PUBLIC_APP_URL() {
    return process.env.NEXT_PUBLIC_APP_URL;
  },
  get NEXT_PUBLIC_GOOGLE_CLIENT_ID() {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  },
  get NEXT_PUBLIC_VAPID_PUBLIC_KEY() {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  },
  get NEXT_PUBLIC_REFERENCE_DATE() {
    return process.env.NEXT_PUBLIC_REFERENCE_DATE;
  },
  get NEXT_PUBLIC_APP_VERSION() {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  },
  get NEXT_PUBLIC_ENABLE_SW() {
    return process.env.NEXT_PUBLIC_ENABLE_SW;
  },
};

/**
 * Validates client environment variables.
 * If rawEnv is explicitly provided, validates it directly through ClientEnvSchema
 * (rejecting any unrecognized or secret keys).
 * Otherwise uses clientSource with static process.env.NEXT_PUBLIC_* references.
 */
export function validateClientEnv(rawEnv?: Record<string, unknown>): ClientEnv {
  if (rawEnv) {
    for (const secretKey of FORBIDDEN_SERVER_SECRETS) {
      if (secretKey in rawEnv) {
        throw new Error(
          `[QCET-ENV] Client environment validation failed:\n  - [${secretKey}]: Server secret key '${secretKey}' forbidden in client environment`
        );
      }
    }
  }

  const source = rawEnv ?? clientSource;

  const result = ClientEnvSchema.safeParse(source);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join(".") || "ROOT"}]: ${issue.message}`)
      .join("\n");
    throw new Error(`[QCET-ENV] Client environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}

let _cachedClientEnv: ClientEnv | null = null;

/**
 * Returns validated client environment singleton.
 */
export function getClientEnv(): ClientEnv {
  if (!_cachedClientEnv) {
    _cachedClientEnv = validateClientEnv();
  }
  return _cachedClientEnv;
}

/**
 * Client environment accessor proxy.
 */
export const clientEnv: ClientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop) {
    if (process.env.NODE_ENV === "test") {
      return (validateClientEnv() as any)[prop];
    }
    const env = getClientEnv();
    return Reflect.get(env, prop);
  },
});
