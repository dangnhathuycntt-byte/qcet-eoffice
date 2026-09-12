/**
 * Content Security Policy (CSP) Violation Reporting Endpoint.
 *
 * Receives CSP violation reports sent by browsers (both legacy report-uri
 * format and modern Reporting API format). Sanitizes sensitive URL parameters,
 * script samples, and headers before safe logging.
 *
 * Invariant: Returns 204 No Content for all successfully parsed violation reports.
 */

import { extractViolations } from "@/lib/security/csp-report";

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB protection against body bloat

/**
 * Handles incoming CSP violation reports.
 */
export async function POST(request: Request): Promise<Response> {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
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
