/**
 * Content Security Policy (CSP) Violation Reporting Endpoint.
 *
 * Receives CSP violation reports sent by browsers (both legacy report-uri
 * format and modern Reporting API format). Sanitizes sensitive URL parameters,
 * script samples, and headers before safe logging.
 *
 * Invariant: Returns 204 No Content for all successfully parsed violation reports.
 */

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB protection against body bloat
const SENSITIVE_QUERY_PARAMS = /(token|secret|password|passwd|auth|api[-_]?key|key|code|session|jwt|ticket|credential|sig|signature)/i;

export interface SanitizedCspViolation {
  documentUri?: string;
  referrer?: string;
  blockedUri?: string;
  violatedDirective?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  disposition?: string;
  statusCode?: number;
  lineNumber?: number;
  columnNumber?: number;
  sourceFile?: string;
  sample?: string;
}

/**
 * Sanitizes a URL string by replacing sensitive query parameter values with [REDACTED].
 */
export function sanitizeCspUrl(rawUrl: unknown): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "";
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const keysToRedact: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (SENSITIVE_QUERY_PARAMS.test(key)) {
        keysToRedact.push(key);
      }
    });
    for (const key of keysToRedact) {
      parsed.searchParams.set(key, "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    // Relative or invalid URL fallback: regex replace sensitive params
    return trimmed.replace(
      /([?&](?:token|secret|password|passwd|auth|api[-_]?key|key|code|session|jwt|ticket|credential|sig|signature)[^=]*=)[^&#\s]*/gi,
      "$1[REDACTED]"
    );
  }
}

/**
 * Sanitizes a script or code sample snippet by truncating and removing control characters.
 */
export function sanitizeSample(sample: unknown, maxLength = 120): string {
  if (!sample || typeof sample !== "string") {
    return "";
  }
  const clean = sample.replace(/[\x00-\x1F\x7F]/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

/**
 * Extracts and sanitizes violation records from legacy or modern CSP report payloads.
 */
export function extractViolations(data: unknown): SanitizedCspViolation[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  // Modern Reporting API format: array of report objects
  if (Array.isArray(data)) {
    const violations: SanitizedCspViolation[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const body = (item.body && typeof item.body === "object") ? item.body : item;

      violations.push({
        documentUri: sanitizeCspUrl(body.documentURL || body["document-uri"] || item.url),
        referrer: sanitizeCspUrl(body.referrer),
        blockedUri: sanitizeCspUrl(body.blockedURL || body["blocked-uri"]),
        effectiveDirective: String(body.effectiveDirective || body["effective-directive"] || ""),
        violatedDirective: String(body.violatedDirective || body["violated-directive"] || ""),
        disposition: String(body.disposition || "report"),
        statusCode: typeof body.statusCode === "number" ? body.statusCode : undefined,
        lineNumber: typeof body.lineNumber === "number" ? body.lineNumber : undefined,
        columnNumber: typeof body.columnNumber === "number" ? body.columnNumber : undefined,
        sourceFile: sanitizeCspUrl(body.sourceFile || body["source-file"]),
        sample: sanitizeSample(body.sample || body["script-sample"]),
      });
    }
    return violations;
  }

  const record = data as Record<string, unknown>;

  // Legacy CSP report-uri format: { "csp-report": { ... } }
  const rawReport = (record["csp-report"] && typeof record["csp-report"] === "object")
    ? (record["csp-report"] as Record<string, unknown>)
    : record;

  return [
    {
      documentUri: sanitizeCspUrl(rawReport["document-uri"] || rawReport.documentURL),
      referrer: sanitizeCspUrl(rawReport.referrer),
      blockedUri: sanitizeCspUrl(rawReport["blocked-uri"] || rawReport.blockedURL),
      effectiveDirective: String(rawReport["effective-directive"] || rawReport.effectiveDirective || ""),
      violatedDirective: String(rawReport["violated-directive"] || rawReport.violatedDirective || ""),
      disposition: String(rawReport.disposition || "report"),
      statusCode: typeof rawReport["status-code"] === "number" ? (rawReport["status-code"] as number) : undefined,
      lineNumber: typeof rawReport["line-number"] === "number" ? (rawReport["line-number"] as number) : undefined,
      columnNumber: typeof rawReport["column-number"] === "number" ? (rawReport["column-number"] as number) : undefined,
      sourceFile: sanitizeCspUrl(rawReport["source-file"] || rawReport.sourceFile),
      sample: sanitizeSample(rawReport["script-sample"] || rawReport.sample),
    },
  ];
}

/**
 * Handles incoming CSP violation reports.
 */
export async function POST(request: Request): Promise<Response> {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to read request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guard against excessive payload sizes
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Gracefully accept empty bodies (e.g. testing or probe)
  if (!rawBody.trim()) {
    return new Response(null, { status: 204 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON report payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const violations = extractViolations(parsed);

  for (const violation of violations) {
    const directive = violation.effectiveDirective || violation.violatedDirective || "unknown-directive";
    const blocked = violation.blockedUri || "unknown-resource";
    const doc = violation.documentUri || "unknown-doc";

    // Safe sanitized diagnostic logging
    console.warn(
      `[CSP-VIOLATION] directive=${directive} blocked=${blocked} doc=${doc} disp=${violation.disposition || "report"}`
    );
  }

  return new Response(null, { status: 204 });
}

/**
 * Handle OPTIONS preflight for cross-origin or browser reporting probes.
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
