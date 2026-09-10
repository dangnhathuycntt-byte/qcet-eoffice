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

/**
 * Normalizes and validates incoming Web Vital metric data.
 */
export function normalizeWebVital(
  metric: Partial<WebVitalMetric> & { name: WebVitalName; value: number }
): WebVitalMetric {
  if (!metric.name || !(metric.name in WEB_VITAL_THRESHOLDS)) {
    throw new Error(`Invalid or unsupported Web Vital metric name: ${metric.name}`);
  }

  const rawValue = Number(metric.value);
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    throw new Error(`Web Vital metric '${metric.name}' has invalid value: ${metric.value}`);
  }

  // Format value: CLS has 4 decimal precision; timing metrics have 1 decimal precision
  const value =
    metric.name === "CLS"
      ? Math.round(rawValue * 10000) / 10000
      : Math.round(rawValue * 10) / 10;

  const rating = metric.rating || getMetricRating(metric.name, value);
  const route =
    metric.route ||
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const device = metric.device || getDeviceCategory();
  const timestamp = metric.timestamp || Date.now();

  return {
    name: metric.name,
    value,
    rating,
    delta: metric.delta !== undefined ? Math.round(Number(metric.delta) * 10) / 10 : undefined,
    id: metric.id || `vital-${metric.name.toLowerCase()}-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    navigationType: metric.navigationType,
    route,
    device,
    appVersion: metric.appVersion || process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    timestamp,
  };
}

export interface WebVitalsObserverOptions {
  onReport?: (metric: WebVitalMetric) => void;
  route?: string;
  appVersion?: string;
}

/**
 * Initializes browser performance observers to collect real Web Vitals.
 * Returns a teardown function to safely disconnect observers.
 */
export function initWebVitals(options: WebVitalsObserverOptions = {}): () => void {
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined" ||
    !options.onReport
  ) {
    return () => {};
  }

  const observers: PerformanceObserver[] = [];
  const onReport = options.onReport;
  const route = options.route || window.location.pathname;
  const appVersion = options.appVersion;

  // 1. TTFB via Navigation Timing
  try {
    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const ttfb = nav.responseStart - nav.requestStart;
      if (ttfb >= 0) {
        onReport(
          normalizeWebVital({
            name: "TTFB",
            value: ttfb,
            navigationType: nav.type,
            route,
            appVersion,
          })
        );
      }
    }
  } catch {
    // Gracefully ignore navigation timing errors
  }

  // 2. FCP via Paint Timing
  try {
    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntriesByName("first-contentful-paint")) {
        onReport(
          normalizeWebVital({
            name: "FCP",
            value: entry.startTime,
            id: entry.name,
            route,
            appVersion,
          })
        );
      }
    });
    fcpObserver.observe({ type: "paint", buffered: true });
    observers.push(fcpObserver);
  } catch {
    // Unsupported entryType
  }

  // 3. LCP via Largest Contentful Paint
  try {
    let largestLcpValue = 0;
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        if (lastEntry.startTime > largestLcpValue) {
          largestLcpValue = lastEntry.startTime;
          onReport(
            normalizeWebVital({
              name: "LCP",
              value: lastEntry.startTime,
              id: (lastEntry as PerformanceEntry & { id?: string }).id || undefined,
              route,
              appVersion,
            })
          );
        }
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    observers.push(lcpObserver);
  } catch {
    // Unsupported entryType
  }

  // 4. CLS via Layout Shift
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as (PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
      })[]) {
        if (!entry.hadRecentInput && typeof entry.value === "number") {
          clsValue += entry.value;
        }
      }
      onReport(
        normalizeWebVital({
          name: "CLS",
          value: clsValue,
          route,
          appVersion,
        })
      );
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    observers.push(clsObserver);
  } catch {
    // Unsupported entryType
  }

  // Teardown
  return () => {
    observers.forEach((obs) => {
      try {
        obs.disconnect();
      } catch {
        // Safe disconnect
      }
    });
  };
}
