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

const MAX_PAYLOAD_BYTES = 128 * 1024; // 128 KB
const MAX_BATCH_EVENTS = 50;

/**
 * Zod schema for individual telemetry event.
 */
export const SingleTelemetryEventSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["error", "web-vital", "csp-report", "runtime", "custom"]),
  timestamp: z.number().optional(),
  route: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  device: z.string().optional(),
  appVersion: z.string().optional(),
});

export type IngestedTelemetryEvent = z.infer<typeof SingleTelemetryEventSchema>;

/**
 * Zod schema for batch container payload.
 */
export const TelemetryBatchSchema = z.object({
  events: z
    .array(SingleTelemetryEventSchema)
    .min(1, "Batch must contain at least 1 event")
    .max(MAX_BATCH_EVENTS, `Batch exceeds limit of ${MAX_BATCH_EVENTS} events`),
});

/**
 * Combined parser accepting either a batch container, an array of events, or a single event.
 */
export function parseTelemetryEvents(data: unknown): IngestedTelemetryEvent[] {
  // Check if it's a raw array
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Events array must not be empty",
          path: [],
        },
      ]);
    }
    if (data.length > MAX_BATCH_EVENTS) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `Batch exceeds limit of ${MAX_BATCH_EVENTS} events`,
          path: [],
        },
      ]);
    }
    const parsedArray = z.array(SingleTelemetryEventSchema).parse(data);
    return parsedArray;
  }

  // Check if it's a container { events: [...] }
  if (data && typeof data === "object" && "events" in data) {
    const parsedBatch = TelemetryBatchSchema.parse(data);
    return parsedBatch.events;
  }

  // Otherwise try single event
  const singleEvent = SingleTelemetryEventSchema.parse(data);
  return [singleEvent];
}

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
