/**
 * Telemetry Ingestion API Endpoint for QCET E-Office.
 *
 * Ingests client errors, Web Vitals, and runtime diagnostic events.
 *
 * Invariants:
 * - Validates schema with Zod and enforces payload size & batch limits.
 * - All incoming event payloads are sanitized server-side via sanitizeLogContext() before logging.
 * - Strictly prevents information leakage in error responses (adheres to Rule 30.4 & 30.6).
 * - Returns 204 No Content upon successful ingestion.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { serverLogger } from "@/telemetry/server";
import { sanitizeLogContext } from "@/telemetry/sanitize";
import {
  MAX_PAYLOAD_BYTES,
  MAX_BATCH_EVENTS,
  parseTelemetryEvents,
  type IngestedTelemetryEvent,
} from "@/telemetry/schemas";

export async function POST(request: Request): Promise<Response> {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body", code: "BODY_READ_ERROR" },
      { status: 400 }
    );
  }

  // 1. Guard against payload bloat
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Payload too large. Maximum allowed size is ${MAX_PAYLOAD_BYTES} bytes.`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 }
    );
  }

  if (!rawBody.trim()) {
    return new Response(null, { status: 204 });
  }

  // 2. JSON Parse
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON telemetry payload", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  // 3. Zod Schema Validation
  let events: IngestedTelemetryEvent[];
  try {
    events = parseTelemetryEvents(rawJson);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const isBatchOverflow = err.issues.some((issue) =>
        issue.message.includes(`limit of ${MAX_BATCH_EVENTS}`)
      );
      return NextResponse.json(
        {
          error: isBatchOverflow
            ? `Batch limit exceeded (maximum ${MAX_BATCH_EVENTS} events)`
            : "Invalid telemetry payload structure",
          code: isBatchOverflow ? "BATCH_LIMIT_EXCEEDED" : "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Validation failed", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  // 4. Server-side log sanitization and dispatching
  for (const event of events) {
    const sanitizedPayload = sanitizeLogContext(event.payload);
    const logMetadata = {
      eventId: event.id,
      type: event.type,
      route: event.route,
      device: event.device,
      appVersion: event.appVersion,
      clientTimestamp: event.timestamp,
      payload: sanitizedPayload,
    };

    switch (event.type) {
      case "error":
        serverLogger.warn(
          `[CLIENT-ERROR] route=${event.route || "unknown"}`,
          logMetadata
        );
        break;
      case "web-vital":
        serverLogger.info(
          `[WEB-VITAL] metric=${event.payload.name || "unknown"} route=${event.route || "unknown"}`,
          logMetadata
        );
        break;
      case "csp-report":
        serverLogger.warn(
          `[CSP-TELEMETRY] route=${event.route || "unknown"}`,
          logMetadata
        );
        break;
      case "runtime":
      case "custom":
      default:
        serverLogger.debug(
          `[CLIENT-TELEMETRY] type=${event.type}`,
          logMetadata
        );
        break;
    }
  }

  return new Response(null, { status: 204 });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
