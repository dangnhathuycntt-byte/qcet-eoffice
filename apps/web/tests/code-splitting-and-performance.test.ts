import test from "node:test";
import assert from "node:assert/strict";
import { clientTelemetry } from "../src/telemetry/client.js";
import { recordNextWebVital, SUPPORTED_WEB_VITALS } from "../src/components/telemetry/web-vitals-reporter.js";
import {
  useDashboardNav,
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "../src/components/dashboard/dashboard-context.js";
import { useTaskFilters, useTaskMutations } from "../src/components/workspace/unified-adaptive-workspace.js";

test("Phase 14 & Phase 15: Component and Context Decomposition exports verified", () => {
  assert.equal(typeof useDashboardNav, "function", "useDashboardNav hook must be exported");
  assert.equal(typeof useDashboardData, "function", "useDashboardData hook must be exported");
  assert.equal(typeof useDashboardActions, "function", "useDashboardActions hook must be exported");
  assert.equal(typeof useDashboardModal, "function", "useDashboardModal hook must be exported");

  assert.equal(typeof useTaskFilters, "function", "useTaskFilters sub-hook must be exported");
  assert.equal(typeof useTaskMutations, "function", "useTaskMutations sub-hook must be exported");
});

test("Phase 17: WebVitalsReporter maps web vitals metrics to clientTelemetry", () => {
  clientTelemetry.setEnabled(true);
  const initialLength = clientTelemetry.getQueueLength();

  // Test supported web vitals
  assert.ok(SUPPORTED_WEB_VITALS.includes("LCP"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("INP"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("CLS"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("FCP"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("TTFB"));

  // 1. Record valid LCP
  const lcpSuccess = recordNextWebVital({
    id: "vital-lcp-test-1",
    name: "LCP",
    startTime: 1200,
    value: 1540.24,
    navigationType: "navigate",
  });
  assert.equal(lcpSuccess, true, "LCP metric should be accepted");

  // 2. Record valid INP
  const inpSuccess = recordNextWebVital({
    id: "vital-inp-test-1",
    name: "INP",
    startTime: 2000,
    value: 85.6,
  });
  assert.equal(inpSuccess, true, "INP metric should be accepted");

  // 3. Record valid CLS
  const clsSuccess = recordNextWebVital({
    id: "vital-cls-test-1",
    name: "CLS",
    startTime: 3000,
    value: 0.02456,
  });
  assert.equal(clsSuccess, true, "CLS metric should be accepted");

  // 4. Reject invalid metric name
  const invalidSuccess = recordNextWebVital({
    id: "vital-unknown",
    name: "UNKNOWN_METRIC",
    startTime: 100,
    value: 50,
  });
  assert.equal(invalidSuccess, false, "Unknown metric should be rejected");

  // 5. Reject invalid negative value
  const negativeSuccess = recordNextWebVital({
    id: "vital-negative",
    name: "LCP",
    startTime: 100,
    value: -10,
  });
  assert.equal(negativeSuccess, false, "Negative value should be rejected");

  assert.equal(
    clientTelemetry.getQueueLength(),
    initialLength + 3,
    "Queue length should increase by exactly 3 accepted metrics"
  );
});
