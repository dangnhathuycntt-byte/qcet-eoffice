"use client";

import { useReportWebVitals } from "next/web-vitals";
import { clientTelemetry } from "@/telemetry/client";
import {
  getMetricRating,
  type WebVitalName,
  type MetricRating,
} from "@/telemetry/web-vitals";

export interface NextWebVitalMetricPayload {
  id: string;
  name: string;
  startTime: number;
  value: number;
  label?: string;
  rating?: MetricRating;
  navigationType?: string;
}

export const SUPPORTED_WEB_VITALS: ReadonlyArray<WebVitalName> = [
  "LCP",
  "INP",
  "CLS",
  "FCP",
  "TTFB",
];

/**
 * Normalizes and dispatches a Next.js web vital metric to clientTelemetry.
 */
export function recordNextWebVital(
  metric: NextWebVitalMetricPayload | Record<string, unknown>
): boolean {
  if (!metric || typeof metric !== "object") return false;

  const rawName = String(metric.name || "").toUpperCase() as WebVitalName;
  if (!SUPPORTED_WEB_VITALS.includes(rawName)) {
    return false;
  }

  const rawValue = Number(metric.value);
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return false;
  }

  // Format value: CLS has 4 decimal precision; timing metrics have 1 decimal precision
  const value =
    rawName === "CLS"
      ? Math.round(rawValue * 10000) / 10000
      : Math.round(rawValue * 10) / 10;

  const rating =
    (metric.rating as MetricRating) || getMetricRating(rawName, value);

  return clientTelemetry.recordWebVital({
    id: metric.id || `vital-${rawName.toLowerCase()}-${Date.now()}`,
    name: rawName,
    value,
    rating,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
  });
}

/**
 * Root-level Web Vitals reporter component.
 * Captures Core Web Vitals and diagnostic metrics and forwards to clientTelemetry.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    recordNextWebVital(metric as NextWebVitalMetricPayload);
  });

  return null;
}
