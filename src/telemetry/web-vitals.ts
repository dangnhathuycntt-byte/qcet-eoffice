/**
 * Web Vitals Telemetry Collector for QCET E-Office.
 *
 * Tracks Core Web Vitals (LCP, INP, CLS) and diagnostic metrics (TTFB, FCP, FID)
 * categorized by route, device type, and application version.
 * Adheres to official Chrome Web Vitals thresholds.
 */

export type WebVitalName = "LCP" | "INP" | "CLS" | "TTFB" | "FCP" | "FID";

export type MetricRating = "good" | "needs-improvement" | "poor";

export type DeviceCategory = "mobile" | "tablet" | "desktop";

export interface WebVitalMetric {
  name: WebVitalName;
  value: number;
  rating: MetricRating;
  delta?: number;
  id?: string;
  navigationType?: string;
  route?: string;
  device?: DeviceCategory;
  appVersion?: string;
  timestamp: number;
}

export interface WebVitalThreshold {
  good: number;
  needsImprovement: number;
}

/**
 * Standard Web Vitals rating thresholds (in ms, except CLS which is a unitless score).
 */
export const WEB_VITAL_THRESHOLDS: Record<WebVitalName, WebVitalThreshold> = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  TTFB: { good: 800, needsImprovement: 1800 },
  FCP: { good: 1800, needsImprovement: 3000 },
  FID: { good: 100, needsImprovement: 300 },
};

/**
 * Calculates metric rating based on thresholds.
 */
export function getMetricRating(
  name: WebVitalName,
  value: number
): MetricRating {
  const threshold = WEB_VITAL_THRESHOLDS[name];
  if (!threshold || !Number.isFinite(value) || value < 0) {
    return "poor";
  }

  if (value <= threshold.good) {
    return "good";
  }
  if (value <= threshold.needsImprovement) {
    return "needs-improvement";
  }
  return "poor";
}

/**
 * Detects current client device category based on window viewport or navigator.
 */
export function getDeviceCategory(): DeviceCategory {
  if (typeof window === "undefined") {
    return "desktop";
  }

  const width = window.innerWidth || 1024;
  if (width < 768) {
    return "mobile";
  }
  if (width < 1024) {
    return "tablet";
  }
  return "desktop";
}
