/**
 * Privacy-First Telemetry Sanitizer for QCET E-Office.
 *
 * Implements strict data sanitization for client and server logging:
 * - Redacts passwords, tokens, auth headers, private keys, database URLs, and session secrets.
 * - Sanitizes sensitive PII (emails, phone numbers, citizen IDs).
 * - Sanitizes query parameters in URLs containing tokens or credentials.
 * - Safely serializes Error instances, stripping secrets from messages and stack traces.
 * - Detects and breaks circular object graphs using WeakSet.
 * - Immutably produces clean log payloads without mutating original structures.
 */

export interface SanitizeOptions {
  /** Maximum recursion depth for nested objects/arrays. Default: 10 */
  maxDepth?: number;
  /** Whether to redact email addresses found in strings. Default: true */
  maskEmails?: boolean;
  /** Whether to redact phone numbers found in strings. Default: true */
  maskPhones?: boolean;
  /** Additional sensitive key patterns to redact */
  customSensitiveKeys?: string[];
}

/**
 * Common sensitive key name stems that indicate confidential or credential fields.
 */
const SENSITIVE_KEY_STEMS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "bearer",
  "authorization",
  "auth_token",
  "authtoken",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "id_token",
  "idtoken",
  "jwt",
  "cookie",
  "set_cookie",
  "setcookie",
  "api_key",
  "apikey",
  "private_key",
  "privatekey",
  "secret_key",
  "secretkey",
  "database_url",
  "databaseurl",
  "db_url",
  "dburl",
  "db_password",
  "dbpassword",
  "redis_url",
  "redisurl",
  "mongo_url",
  "mongourl",
  "connection_string",
  "connectionstring",
  "conn_str",
  "session_token",
  "sessiontoken",
  "session_secret",
  "sessionsecret",
  "session_id",
  "sessionid",
  "credit_card",
  "creditcard",
  "card_number",
  "cardnumber",
  "cvv",
  "cvc",
  "cccd",
  "cmnd",
  "citizen_id",
  "citizenid",
  "identity_card",
  "id_card",
  "idcard",
  "ssn",
  "x_auth_token",
  "x_api_key",
];

/**
 * Regex for testing URL query parameter names that must be redacted.
 */
const SENSITIVE_QUERY_PARAM_REGEX =
  /(token|secret|password|passwd|auth|api[-_]?key|key|code|session|jwt|ticket|credential|sig|signature)/i;

/**
 * Database URL detection regex (Postgres, MySQL, MongoDB, Redis, etc.)
 */
const DATABASE_URL_REGEX =
  /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|sqlite):\/\/[^\s"'>]+/gi;

/**
 * Bearer token regex
 */
const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9_\-.]+/gi;

/**
 * JWT token structure regex (header.payload.signature)
 */
const JWT_REGEX =
  /\beyJ[A-Za-z0-9-_]{8,}\.eyJ[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]+/g;

/**
 * PEM Private Key block regex
 */
const PRIVATE_KEY_REGEX =
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/gi;

/**
 * Email pattern regex for string masking
 */
const EMAIL_REGEX =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Vietnamese phone number pattern regex (+84 or 0 followed by 9 digits)
 */
const VN_PHONE_REGEX =
  /(?:\+84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b/g;

/**
 * Determines whether an object key name represents sensitive or credential data.
 * Safe against false positives like "author" or "authority".
 */
export function isSensitiveKey(key: string, customKeys?: string[]): boolean {
  if (!key || typeof key !== "string") return false;

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Check custom keys first if supplied
  if (customKeys && customKeys.length > 0) {
    for (const custom of customKeys) {
      const normCustom = custom.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized === normCustom || normalized.includes(normCustom)) {
        return true;
      }
    }
  }

  // Exact or normalized match against known sensitive stems
  for (const stem of SENSITIVE_KEY_STEMS) {
    const normStem = stem.replace(/[^a-z0-9]/g, "");
    if (normalized === normStem) {
      return true;
    }
    // Match compound keys such as userPassword, clientSecret, databaseUrl, jwtToken
    if (normalized.includes(normStem)) {
      // Exclude safe words that contain substrings
      if (
        normStem === "auth" &&
        (normalized.includes("author") || normalized.includes("authority"))
      ) {
        continue;
      }
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes URLs by replacing values of sensitive query parameters with [REDACTED].
 */
export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const keysToRedact: string[] = [];
    parsed.searchParams.forEach((_, paramKey) => {
      if (SENSITIVE_QUERY_PARAM_REGEX.test(paramKey)) {
        keysToRedact.push(paramKey);
      }
    });
    for (const paramKey of keysToRedact) {
      parsed.searchParams.set(paramKey, "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    // If not a valid full URL, perform regex replacement on query-like substrings
    return trimmed.replace(
      /([?&](?:token|secret|password|passwd|auth|api[-_]?key|key|code|session|jwt|ticket|credential|sig|signature)[^=]*=)[^&#\s]*/gi,
      "$1[REDACTED]"
    );
  }
}

/**
 * Sanitizes string values: redacts database URLs, bearer tokens, JWTs, private keys,
 * sensitive URL query params, and optionally emails / phone numbers.
 */
export function sanitizeString(
  str: string,
  options: SanitizeOptions = {}
): string {
  if (typeof str !== "string") return str;
  if (!str) return "";

  let result = str;

  // 1. Redact PEM Private Keys
  result = result.replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]");

  // 2. Redact Database connection URLs
  result = result.replace(DATABASE_URL_REGEX, "[REDACTED_DATABASE_URL]");

  // 3. Redact Bearer tokens
  result = result.replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED_TOKEN]");

  // 4. Redact raw JWT tokens
  result = result.replace(JWT_REGEX, "[REDACTED_JWT]");

  // 5. Redact sensitive query parameters if string looks like a URL
  if (result.includes("?") && result.includes("=")) {
    result = sanitizeUrl(result);
  }

  // 6. Mask or redact emails if enabled (default true)
  if (options.maskEmails !== false) {
    result = result.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
  }

  // 7. Mask or redact phone numbers if enabled (default true)
  if (options.maskPhones !== false) {
    result = result.replace(VN_PHONE_REGEX, "[REDACTED_PHONE]");
  }

  return result;
}

/**
 * Recursively sanitizes any log context, payload, or error object.
 * Guarantee: never mutates input structures and protects against circular references.
 */
export function sanitizeLogContext<T = any>(
  context: T,
  options: SanitizeOptions = {}
): any {
  const maxDepth = options.maxDepth ?? 10;
  const seen = new WeakSet<object>();

  function traverse(node: unknown, depth: number): unknown {
    if (node === null || node === undefined) {
      return node;
    }

    if (depth > maxDepth) {
      return "[MAX_DEPTH_EXCEEDED]";
    }

    // Primitives
    if (typeof node === "string") {
      return sanitizeString(node, options);
    }
    if (
      typeof node === "number" ||
      typeof node === "boolean" ||
      typeof node === "bigint"
    ) {
      return node;
    }
    if (typeof node === "function") {
      return `[Function: ${node.name || "anonymous"}]`;
    }
    if (typeof node === "symbol") {
      return node.toString();
    }

    // Circular reference protection for non-primitive objects
    if (typeof node === "object") {
      if (seen.has(node)) {
        return "[CIRCULAR_REFERENCE]";
      }
      seen.add(node);
    }

    // Date
    if (node instanceof Date) {
      return node.toISOString();
    }

    // Error instances
    if (node instanceof Error) {
      const sanitizedErr: Record<string, unknown> = {
        name: node.name,
        message: sanitizeString(node.message, options),
      };
      if (node.stack) {
        sanitizedErr.stack = sanitizeString(node.stack, options);
      }
      if ("code" in node) {
        sanitizedErr.code = (node as { code?: unknown }).code;
      }
      if ("cause" in node && node.cause) {
        sanitizedErr.cause = traverse(node.cause, depth + 1);
      }
      return sanitizedErr;
    }

    // Arrays
    if (Array.isArray(node)) {
      return node.map((item) => traverse(item, depth + 1));
    }

    // Map instances
    if (node instanceof Map) {
      const sanitizedMap: Record<string, unknown> = {};
      node.forEach((val, key) => {
        const keyStr = String(key);
        if (isSensitiveKey(keyStr, options.customSensitiveKeys)) {
          sanitizedMap[keyStr] = "[REDACTED]";
        } else {
          sanitizedMap[keyStr] = traverse(val, depth + 1);
        }
      });
      return sanitizedMap;
    }

    // Set instances
    if (node instanceof Set) {
      const sanitizedSet: unknown[] = [];
      node.forEach((val) => {
        sanitizedSet.push(traverse(val, depth + 1));
      });
      return sanitizedSet;
    }

    // Standard objects
    const obj = node as Record<string, unknown>;
    const sanitizedObj: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (isSensitiveKey(key, options.customSensitiveKeys)) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = traverse(val, depth + 1);
      }
    }

    return sanitizedObj;
  }

  return traverse(context, 0) as T;
}
