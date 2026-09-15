/**
 * Canonical Security Headers Configuration for QCET E-Office.
 * Implements Defense in Depth:
 * - Content-Security-Policy-Report-Only (Step 1 of rollout per plan to avoid breaking Next.js hydration & static optimization)
 * - Strict-Transport-Security (HSTS in production)
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - X-Frame-Options: DENY
 * - Permissions-Policy (restricted device hardware APIs)
 * - X-DNS-Prefetch-Control: on
 * - X-XSS-Protection: 0 (modern standard)
 */

export interface CSPOptions {
  reportOnly?: boolean;
  reportUri?: string;
  allowEval?: boolean;
  allowInlineStyles?: boolean;
  extraScriptSrc?: string[];
  extraStyleSrc?: string[];
  extraImgSrc?: string[];
  extraConnectSrc?: string[];
  extraFontSrc?: string[];
}

export interface SecurityHeadersOptions {
  reportOnly?: boolean;
  enableHsts?: boolean;
  cspOptions?: CSPOptions;
  dnsPrefetchControl?: "on" | "off";
  permissionsPolicy?: string;
  referrerPolicy?: string;
  frameOptions?: "DENY" | "SAMEORIGIN";
}

/**
 * Builds the canonical Content Security Policy directive string.
 */
export function buildContentSecurityPolicy(options: CSPOptions = {}): string {
  const reportUri = options.reportUri ?? "/api/csp-report";

  // Script sources: 'self', Next.js eval/inline required for dev/hydration, Google OAuth
  const scriptSources = [
    "'self'",
    "'unsafe-eval'",
    "'unsafe-inline'",
    "https://accounts.google.com",
    ...(options.extraScriptSrc || []),
  ];

  // Style sources: 'self', inline styles (Tailwind, Next.js), Google Fonts, Google Identity Services
  const styleSources = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com",
    ...(options.extraStyleSrc || []),
  ];

  // Image sources: 'self', data:, blob:, Google accounts/avatars, Unsplash
  const imgSources = [
    "'self'",
    "data:",
    "blob:",
    "https://accounts.google.com",
    "https://lh3.googleusercontent.com",
    "https://images.unsplash.com",
    ...(options.extraImgSrc || []),
  ];

  // Font sources: 'self', Google Fonts gstatic, data:
  const fontSources = [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
    ...(options.extraFontSrc || []),
  ];

  // Connect sources: 'self', Google OAuth accounts
  const connectSources = [
    "'self'",
    "https://accounts.google.com",
    ...(options.extraConnectSrc || []),
  ];

  // Frame sources: 'self', Google Identity Services FedCM / OAuth iframes
  const frameSources = [
    "'self'",
    "https://accounts.google.com",
  ];

  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${Array.from(new Set(scriptSources)).join(" ")}`,
    `style-src ${Array.from(new Set(styleSources)).join(" ")}`,
    `frame-src ${Array.from(new Set(frameSources)).join(" ")}`,
    `img-src ${Array.from(new Set(imgSources)).join(" ")}`,
    `font-src ${Array.from(new Set(fontSources)).join(" ")}`,
    `connect-src ${Array.from(new Set(connectSources)).join(" ")}`,
    `report-uri ${reportUri}`,
  ];

  return directives.join("; ");
}

/**
 * Generates the canonical security headers dictionary.
 *
 * @param isProduction Whether the application is running in production mode.
 * @param options Customization options for CSP, HSTS, and specific policies.
 */
export function getSecurityHeaders(
  isProduction: boolean = process.env.NODE_ENV === "production",
  options: SecurityHeadersOptions = {}
): Record<string, string> {
  const isReportOnly = options.reportOnly ?? options.cspOptions?.reportOnly ?? true;
  const cspHeaderName = isReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const headers: Record<string, string> = {
    [cspHeaderName]: buildContentSecurityPolicy({
      reportOnly: isReportOnly,
      ...options.cspOptions,
    }),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": options.referrerPolicy || "strict-origin-when-cross-origin",
    "X-Frame-Options": options.frameOptions || "DENY",
    "Permissions-Policy":
      options.permissionsPolicy ||
      "camera=(), microphone=(), geolocation=(), payment=()",
    "X-DNS-Prefetch-Control": options.dnsPrefetchControl || "on",
    "X-XSS-Protection": "0",
  };

  // Enable Strict-Transport-Security in production or when explicitly requested
  if (isProduction || options.enableHsts) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}

/**
 * Generates security headers formatted for Next.js configuration `headers()` array.
 */
export function getNextSecurityHeaders(
  isProduction: boolean = process.env.NODE_ENV === "production",
  options: SecurityHeadersOptions = {}
): Array<{ key: string; value: string }> {
  const headers = getSecurityHeaders(isProduction, options);
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

/**
 * Applies HTTP security headers to a web standard Response instance.
 */
export function applySecurityHeaders(
  response: Response,
  isProduction: boolean = process.env.NODE_ENV === "production",
  options: SecurityHeadersOptions = {}
): Response {
  const headers = getSecurityHeaders(isProduction, options);

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
