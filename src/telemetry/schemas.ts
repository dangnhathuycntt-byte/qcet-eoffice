import { z } from "zod";

export const MAX_PAYLOAD_BYTES = 128 * 1024; // 128 KB
export const MAX_BATCH_EVENTS = 50;

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

  // Check if it's a single event object
  if (data && typeof data === "object") {
    const single = SingleTelemetryEventSchema.parse(data);
    return [single];
  }

  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      message: "Invalid telemetry payload format",
      path: [],
    },
  ]);
}
