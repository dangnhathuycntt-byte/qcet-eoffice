/**
 * QCET E-Office - PWA Client Telemetry Dispatcher
 *
 * Lightweight, privacy-first event dispatcher for PWA lifecycle and offline operations:
 * - pwa.install.offer
 * - pwa.install.accept
 * - push.permission.granted
 * - sw.update.detected
 * - sync.conflict
 *
 * Institutional Invariant: 0% emojis, zero external tracking beacons, server truth aligned.
 */

export type PWATelemetryEventName =
  | "pwa.install.offer"
  | "pwa.install.accept"
  | "pwa.install.dismiss"
  | "push.permission.granted"
  | "push.permission.denied"
  | "sw.update.detected"
  | "sw.update.applied"
  | "offline.enter"
  | "offline.exit"
  | "sync.queued"
  | "sync.success"
  | "sync.conflict"
  | "sync.flush.start"
  | "sync.flush.completed"
  | "storage.persist.granted"
  | "storage.persist.denied"
  | "storage.cleared";

const SENSITIVE_KEY_PATTERNS = [
  "title",
  "name",
  "password",
  "token",
  "secret",
  "auth",
  "credential",
  "cookie",
  "content",
  "body",
  "payload",
];

/**
 * Sanitizes metadata to guarantee privacy.
 * Never logs sensitive document/task titles, credentials, or personal data.
 */
export function sanitizeTelemetryMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) =>
      lowerKey.includes(pattern)
    );

    if (isSensitive) {
      continue; // Omit sensitive operational titles and credentials
    }

    // Recursively sanitize if nested object
    if (val && typeof val === "object" && !Array.isArray(val)) {
      clean[key] = sanitizeTelemetryMetadata(val as Record<string, unknown>);
    } else {
      clean[key] = val;
    }
  }

  return clean;
}

/**
 * Masks raw user identifiers to preserve staff privacy in telemetry logs.
 * Example: 'usr_staff_12345' -> 'user_usr_staf...'
 */
export function maskUserId(userId?: string | null): string | null {
  if (!userId || typeof userId !== "string") {
    return null;
  }
  const clean = userId.trim();
  if (!clean) {
    return null;
  }
  if (clean.startsWith("user_") && clean.endsWith("...")) {
    return clean;
  }
  return `user_${clean.slice(0, 8)}...`;
}

export interface PWATelemetryRecord {
  id: string;
  event: PWATelemetryEventName | string;
  timestamp: number;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

type TelemetryListener = (record: PWATelemetryRecord) => void;

const MAX_HISTORY_LENGTH = 100;
const historyBuffer: PWATelemetryRecord[] = [];
const listeners = new Set<TelemetryListener>();

/**
 * Dispatches a lightweight PWA telemetry event.
 */
export function recordTelemetry(
  event: PWATelemetryEventName | string,
  metadata?: Record<string, unknown>,
  userId?: string | null
): PWATelemetryRecord {
  const sanitized = sanitizeTelemetryMetadata(metadata);
  const maskedUserId = maskUserId(userId);

  const record: PWATelemetryRecord = {
    id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    event,
    timestamp: Date.now(),
    userId: maskedUserId,
    metadata: sanitized,
  };

  historyBuffer.push(record);
  if (historyBuffer.length > MAX_HISTORY_LENGTH) {
    historyBuffer.shift();
  }

  // Notify registered subscribers
  for (const listener of listeners) {
    try {
      listener(record);
    } catch (err) {
      console.warn("[PWA Telemetry] Listener error:", err);
    }
  }

  // Dispatch browser DOM CustomEvent if in browser context
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent("qcet:telemetry", { detail: record })
      );
    } catch {
      // Ignore event dispatch failure
    }
  }

  return record;
}

/**
 * Returns recent telemetry history records (shallow copy).
 */
export function getTelemetryHistory(): PWATelemetryRecord[] {
  return [...historyBuffer];
}

/**
 * Clears the in-memory telemetry history buffer (useful for testing).
 */
export function clearTelemetryHistory(): void {
  historyBuffer.length = 0;
}

export const getTelemetryEvents = getTelemetryHistory;
export const getTelemetryLog = getTelemetryHistory;
export const clearTelemetryLog = clearTelemetryHistory;
export const clearTelemetryEvents = clearTelemetryHistory;

/**
 * Subscribes to PWA telemetry events.
 */
export function subscribeTelemetry(listener: TelemetryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
