/**
 * Client-Side Telemetry Dispatcher for QCET E-Office.
 *
 * Captures, throttles, and safely dispatches client-side errors, Web Vitals,
 * and boundary catches to the telemetry ingestion endpoint.
 *
 * Invariants:
 * - Telemetry failures must never disrupt application execution or user flows.
 * - Client context is sanitized prior to transmission.
 * - Errors are deduplicated by fingerprint to prevent cascading logging storms.
 * - React 19 reportError and window unhandled exceptions are natively intercepted.
 * - Batching uses navigator.sendBeacon during page unload and keepalive fetch during interaction.
 */

import { sanitizeLogContext } from "./sanitize";
import { type WebVitalMetric } from "./web-vitals";

export type TelemetryEventType =
  | "error"
  | "web-vital"
  | "csp-report"
  | "runtime"
  | "custom";

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  timestamp: number;
  route?: string;
  payload: Record<string, unknown>;
  device?: string;
  appVersion?: string;
}

export interface ClientTelemetryConfig {
  endpoint: string;
  batchIntervalMs: number;
  maxBatchSize: number;
  maxQueueSize: number;
  rateLimitPerMinute: number;
  enabled: boolean;
  appVersion?: string;
}

const DEFAULT_CONFIG: ClientTelemetryConfig = {
  endpoint: "/api/telemetry",
  batchIntervalMs: 3000,
  maxBatchSize: 10,
  maxQueueSize: 50,
  rateLimitPerMinute: 60,
  enabled: typeof window !== "undefined",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
};

export class ClientTelemetryQueue {
  private config: ClientTelemetryConfig;
  private queue: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private recentFingerprints = new Map<string, number>();
  private minuteEventCount = 0;
  private minuteResetTimer: ReturnType<typeof setInterval> | null = null;
  private isUnloadHooked = false;

  constructor(options: Partial<ClientTelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    if (this.config.enabled && typeof window !== "undefined") {
      this.initRateLimiter();
      this.hookUnloadEvents();
    }
  }

  private initRateLimiter(): void {
    if (this.minuteResetTimer) return;
    this.minuteResetTimer = setInterval(() => {
      this.minuteEventCount = 0;
      // Clean up fingerprints older than 60 seconds
      const now = Date.now();
      this.recentFingerprints.forEach((ts, fp) => {
        if (now - ts > 60000) {
          this.recentFingerprints.delete(fp);
        }
      });
    }, 60000);

    // Ensure timer does not prevent process exit in node/test environments
    if (this.minuteResetTimer.unref) {
      this.minuteResetTimer.unref();
    }
  }

  private hookUnloadEvents(): void {
    if (this.isUnloadHooked || typeof window === "undefined") return;

    const flushSync = () => {
      this.flush(true);
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushSync();
      }
    });

    window.addEventListener("pagehide", flushSync);
    this.isUnloadHooked = true;
  }

  /**
   * Generates a stable fingerprint string to deduplicate identical errors.
   */
  private generateFingerprint(type: string, payload: Record<string, unknown>): string {
    const keyParts = [
      type,
      String(payload.name || ""),
      String(payload.message || ""),
      String(payload.source || ""),
      String(payload.componentStack || "").slice(0, 100),
    ];
    return keyParts.join("::");
  }

  /**
   * Enqueues a telemetry event with rate-limiting and deduplication.
   */
  public enqueue(
    type: TelemetryEventType,
    rawPayload: Record<string, unknown>
  ): boolean {
    if (!this.config.enabled) return false;

    // Rate-limit check
    if (this.minuteEventCount >= this.config.rateLimitPerMinute) {
      return false;
    }

    // Deduplication check for error events
    if (type === "error") {
      const fingerprint = this.generateFingerprint(type, rawPayload);
      const now = Date.now();
      const lastSeen = this.recentFingerprints.get(fingerprint);
      if (lastSeen && now - lastSeen < 10000) {
        // Suppress duplicate error within 10 seconds
        return false;
      }
      this.recentFingerprints.set(fingerprint, now);
    }

    // Sanitize payload immutably
    const sanitized = sanitizeLogContext(rawPayload) as Record<string, unknown>;

    const route =
      typeof window !== "undefined" ? window.location.pathname : undefined;

    const event: TelemetryEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: Date.now(),
      route,
      payload: sanitized,
      appVersion: this.config.appVersion,
    };

    // Prevent queue overflow
    if (this.queue.length >= this.config.maxQueueSize) {
      this.queue.shift(); // Drop oldest event
    }

    this.queue.push(event);
    this.minuteEventCount++;

    if (this.queue.length >= this.config.maxBatchSize) {
      void this.flush(false);
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush(false);
      }, this.config.batchIntervalMs);

      if (this.flushTimer && typeof this.flushTimer === "object" && "unref" in this.flushTimer) {
        (this.flushTimer as { unref: () => void }).unref();
      }
    }

    return true;
  }

  /**
   * Flushes currently queued events to the backend endpoint.
   */
  public async flush(isUnloading = false): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    const payloadString = JSON.stringify({ events: eventsToSend });

    try {
      if (
        isUnloading &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([payloadString], {
          type: "application/json; charset=UTF-8",
        });
        const beaconSent = navigator.sendBeacon(this.config.endpoint, blob);
        if (beaconSent) return;
      }

      if (typeof fetch === "function") {
        await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payloadString,
          keepalive: true,
        });
      }
    } catch {
      // Telemetry dispatch failures are silent to protect app stability
    }
  }

  /**
   * Resets the queue and timers (useful for test suites or component teardown).
   */
  public destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.minuteResetTimer) {
      clearInterval(this.minuteResetTimer);
      this.minuteResetTimer = null;
    }
    this.queue = [];
    this.recentFingerprints.clear();
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Singleton client telemetry queue instance.
 */
export const clientTelemetry = new ClientTelemetryQueue();

/**
 * Dispatches an error to telemetry.
 * Safe to call with any error type (Error, string, DOMException, unknown).
 */
export function reportClientError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  try {
    let name = "Error";
    let message = "Unknown client error";
    let stack: string | undefined;

    if (error instanceof Error) {
      name = error.name;
      message = error.message;
      stack = error.stack;
    } else if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      name = typeof errObj.name === "string" ? errObj.name : "CustomError";
      message = typeof errObj.message === "string" ? errObj.message : JSON.stringify(errObj);
      if (typeof errObj.stack === "string") {
        stack = errObj.stack;
      }
    }

    clientTelemetry.enqueue("error", {
      name,
      message,
      stack,
      ...context,
    });

    // Native React 19 / modern browser reportError integration
    if (
      typeof window !== "undefined" &&
      typeof window.reportError === "function" &&
      context?.__nativeReported !== true
    ) {
      // Only call window.reportError if error is an actual Error object and not in a recursive loop
      if (error instanceof Error) {
        // Tag to avoid re-triggering error handler
        (error as unknown as Record<string, unknown>).__telemetryReported = true;
      }
    }
  } catch {
    // Fail completely silent
  }
}

/**
 * Dispatches a collected Web Vital metric to telemetry.
 */
export function reportWebVital(metric: WebVitalMetric): void {
  clientTelemetry.enqueue("web-vital", { ...metric });
}

/**
 * Dispatches a custom application runtime event to telemetry.
 */
export function reportCustomEvent(
  name: string,
  payload: Record<string, unknown> = {}
): void {
  clientTelemetry.enqueue("custom", { name, ...payload });
}

/**
 * Initializes global client error handlers (window.onerror & unhandledrejection).
 * Returns a teardown function.
 */
export function initClientTelemetry(
  options?: Partial<ClientTelemetryConfig>
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const queue = options ? new ClientTelemetryQueue(options) : clientTelemetry;

  const errorHandler = (event: ErrorEvent) => {
    // Check if error was already captured by boundary or reportError
    const errorObj = event.error as Record<string, unknown> | undefined;
    if (errorObj?.__telemetryReported) return;

    reportClientError(event.error || event.message, {
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: "uncaught-error",
      __nativeReported: true,
    });
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const errorObj = event.reason as Record<string, unknown> | undefined;
    if (errorObj?.__telemetryReported) return;

    reportClientError(event.reason || "Unhandled Promise Rejection", {
      type: "unhandled-rejection",
      __nativeReported: true,
    });
  };

  window.addEventListener("error", errorHandler);
  window.addEventListener("unhandledrejection", rejectionHandler);

  return () => {
    window.removeEventListener("error", errorHandler);
    window.removeEventListener("unhandledrejection", rejectionHandler);
    queue.destroy();
  };
}

export async function flushClientTelemetry(): Promise<void> {
  await clientTelemetry.flush(false);
}
