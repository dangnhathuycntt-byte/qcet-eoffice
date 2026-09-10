import { ForbiddenError } from '@/server/api/errors';

export interface CsrfOptions {
  allowedOrigins?: string[];
}

export interface CsrfValidationResult {
  isValid: boolean;
  reason?: string;
}

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

const ALLOWED_SEC_FETCH_SITES = new Set(['same-origin', 'same-site', 'none']);

const WEBHOOK_HEADERS = [
  'x-webhook-signature',
  'x-webhook-secret',
  'x-hub-signature-256',
  'x-hub-signature',
  'x-qcet-webhook-token',
];

/**
 * Determines whether the HTTP method is considered safe from CSRF (read-only / idempotent).
 */
export function isSafeMethod(method: string): boolean {
  return SAFE_HTTP_METHODS.has(method.toUpperCase());
}

/**
 * Checks if the request explicitly uses Bearer authentication.
 * Bearer tokens cannot be automatically attached by a browser in cross-origin requests,
 * making them inherently immune to ambient-credential CSRF attacks.
 */
export function hasBearerAuth(request: Request): boolean {
  const auth = request.headers.get('authorization');
  if (!auth) return false;
  return auth.trim().toLowerCase().startsWith('bearer ');
}

/**
 * Checks if the request contains webhook authentication / signature headers.
 */
export function hasWebhookHeader(request: Request): boolean {
  return WEBHOOK_HEADERS.some((header) => Boolean(request.headers.get(header)?.trim()));
}

/**
 * Checks if the request contains any cookie headers (ambient credentials).
 */
export function hasCookies(request: Request): boolean {
  const cookie = request.headers.get('cookie');
  return Boolean(cookie && cookie.trim().length > 0);
}

/**
 * Parses and validates an HTTP/HTTPS Origin or Referer URL string into standard `<scheme>://<host>[:<port>]`.
 * Returns null for malformed URLs, non-HTTP protocols, or empty values.
 */
export function parseHttpOrigin(urlOrOrigin: string): string | null {
  try {
    const parsed = new URL(urlOrOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.origin || parsed.origin === 'null') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalizes a URL or domain string (e.g. from environment variables) into standard `<scheme>://<host>[:<port>]`.
 */
export function normalizeOrigin(urlOrOrigin: string): string | null {
  try {
    const withProto = urlOrOrigin.includes('://') ? urlOrOrigin : `https://${urlOrOrigin}`;
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.origin || parsed.origin === 'null') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resolves all trusted origins for the given request based on request URL,
 * Host header, X-Forwarded-Host, configured APP_URLs, and optional custom origins.
 */
export function getAllowedOrigins(request: Request, options?: CsrfOptions): Set<string> {
  const allowed = new Set<string>();

  // 1. From request.url
  try {
    const reqUrl = new URL(request.url);
    if (reqUrl.origin && reqUrl.origin !== 'null') {
      allowed.add(reqUrl.origin.toLowerCase());
    }
  } catch {
    // ignore
  }

  // 2. Protocol resolution
  let proto = 'http';
  try {
    const p = new URL(request.url).protocol.replace(':', '');
    if (p) proto = p;
  } catch {
    // default http
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (forwardedProto) {
    proto = forwardedProto;
  }
  proto = proto.toLowerCase();

  // 3. Host header
  const host = request.headers.get('host')?.trim();
  if (host) {
    allowed.add(`${proto}://${host.toLowerCase()}`);
  }

  // 4. X-Forwarded-Host header
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  if (forwardedHost) {
    allowed.add(`${proto}://${forwardedHost.toLowerCase()}`);
  }

  // 5. Configured environment variables (APP_URL, NEXT_PUBLIC_APP_URL, NEXTAUTH_URL)
  const envUrls = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
  ];
  for (const envUrl of envUrls) {
    if (envUrl) {
      const normalized = normalizeOrigin(envUrl);
      if (normalized && normalized !== 'null') {
        allowed.add(normalized);
      }
    }
  }

  // 6. Explicit options.allowedOrigins
  if (options?.allowedOrigins) {
    for (const customOrigin of options.allowedOrigins) {
      const normalized = normalizeOrigin(customOrigin);
      if (normalized && normalized !== 'null') {
        allowed.add(normalized);
      }
    }
  }

  return allowed;
}

/**
 * Validates whether an incoming HTTP request satisfies CSRF protection rules.
 *
 * Evaluation Order:
 * 1. Safe methods (GET, HEAD, OPTIONS, TRACE) bypass check.
 * 2. Non-ambient credentials (Bearer auth, webhook headers) bypass check.
 * 3. Sec-Fetch-Site check: allow 'same-origin', 'same-site', 'none'. Reject 'cross-site'.
 * 4. Origin check: match against Host, X-Forwarded-Host, or configured APP_URL.
 * 5. Referer check: fallback if Origin is absent.
 * 6. Ambient credential check: if no Origin/Referer, reject if cookies are present; pass if no cookies.
 */
export function validateCsrf(
  request: Request,
  options?: CsrfOptions
): CsrfValidationResult {
  // 1. Safe HTTP methods bypass CSRF check
  if (isSafeMethod(request.method)) {
    return { isValid: true };
  }

  // 2. Ambient credential check (Bearer auth / webhook signatures bypass CSRF)
  if (hasBearerAuth(request) || hasWebhookHeader(request)) {
    return { isValid: true };
  }

  const allowedOrigins = getAllowedOrigins(request, options);

  // 3. Sec-Fetch-Site (Fetch Metadata) check
  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite) {
    if (secFetchSite === 'cross-site') {
      return {
        isValid: false,
        reason: 'Cross-site request rejected by Sec-Fetch-Site policy',
      };
    }

    if (!ALLOWED_SEC_FETCH_SITES.has(secFetchSite)) {
      return {
        isValid: false,
        reason: `Invalid Sec-Fetch-Site header value: ${secFetchSite}`,
      };
    }

    // Verify Origin if explicitly supplied
    const origin = request.headers.get('origin')?.trim();
    if (origin) {
      const normalizedOrigin = parseHttpOrigin(origin);
      if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
        return {
          isValid: false,
          reason: `Origin '${origin}' does not match allowed origins`,
        };
      }
    }

    return { isValid: true };
  }

  // 4. Origin header check (when Sec-Fetch-Site is not present)
  const origin = request.headers.get('origin')?.trim();
  if (origin) {
    const normalizedOrigin = parseHttpOrigin(origin);
    if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
      return {
        isValid: false,
        reason: `Origin '${origin}' does not match allowed origins`,
      };
    }
    return { isValid: true };
  }

  // 5. Referer header fallback (when Origin is absent)
  const referer = request.headers.get('referer')?.trim();
  if (referer) {
    const normalizedReferer = parseHttpOrigin(referer);
    if (!normalizedReferer) {
      return {
        isValid: false,
        reason: 'Malformed Referer header',
      };
    }
    if (!allowedOrigins.has(normalizedReferer)) {
      return {
        isValid: false,
        reason: `Referer origin '${normalizedReferer}' does not match allowed origins`,
      };
    }
    return { isValid: true };
  }

  // 6. Missing Origin and Referer
  if (hasCookies(request)) {
    return {
      isValid: false,
      reason: 'Missing Origin and Referer headers on authenticated state-changing request',
    };
  }

  // Request does not use cookies or browser ambient credentials
  return { isValid: true };
}

/**
 * Asserts that the request satisfies CSRF protection rules.
 * Throws ForbiddenError (403, CSRF_VALIDATION_FAILED) if invalid.
 */
export function assertCsrfProtection(request: Request, options?: CsrfOptions): void {
  const result = validateCsrf(request, options);
  if (!result.isValid) {
    throw new ForbiddenError(
      result.reason || 'Access forbidden: CSRF validation failed',
      'CSRF_VALIDATION_FAILED'
    );
  }
}

/**
 * Alias for assertCsrfProtection.
 */
export const assertCsrf = assertCsrfProtection;

/**
 * Standard HTTP security and hardening headers.
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-XSS-Protection': '0',
    'X-DNS-Prefetch-Control': 'off',
  };
}

/**
 * Applies HTTP security and hardening headers to a Response.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = getSecurityHeaders();
  try {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  } catch {
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
}
