import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveMetricStrip } from "../src/components/workspace/components/adaptive-metric-strip";

describe("AdaptiveMetricStrip Component", () => {
  const metrics = {
    totalTasks: 24,
    urgentOverdueCount: 2,
    waitingApprovalCount: 5,
    completedRate: 68,
    labelScope: "Khoa CNTT",
  };

  test("renders all 4 metric values with font-mono tabular-nums", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("24"), "Renders total tasks");
    assert.ok(html.includes("2"), "Renders urgent overdue");
    assert.ok(html.includes("5"), "Renders waiting approval");
    assert.ok(html.includes("68%"), "Renders completion rate");
    assert.ok(html.includes("font-mono"), "Enforces font-mono for numbers");
    assert.ok(html.includes("tabular-nums"), "Enforces tabular-nums");
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });

  test("zero dark theme classes in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );
    assert.ok(!html.includes("dark:"), "Must follow light-only standard without dark: variants");
  });

  test("renders school scope specific indicators", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
      })
    );

    assert.ok(html.includes("Tiến độ chung"), "Shows overall school progress");
    assert.ok(html.includes("Quá hạn"), "Shows school overdue");
    assert.ok(html.includes("Đang chờ duyệt"), "Shows school waiting approval");
    assert.ok(html.includes("Toàn trường") || html.includes("toàn trường"), "Shows school scope context");
  });

  test("renders unit scope specific indicators", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("Tiến độ khoa"), "Shows faculty progress");
    assert.ok(html.includes("Quá hạn đơn vị"), "Shows unit overdue indicator");
    assert.ok(html.includes("Chờ phân công/duyệt"), "Shows unit triage indicator");
    assert.ok(html.includes("Đã nghiệm thu"), "Shows acceptance metric indicator");
    assert.ok(html.includes("Khoa CNTT"), "Shows department label");
  });

  test("renders my scope specific indicators", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "my",
      })
    );

    assert.ok(html.includes("Việc cần làm ngay"), "Shows personal urgent action");
    assert.ok(html.includes("Đang thực hiện"), "Shows personal in-progress indicator");
    assert.ok(html.includes("Chờ phản hồi"), "Shows personal feedback waiting indicator");
    assert.ok(html.includes("Hoàn tất kỳ này"), "Shows personal term completion indicator");
  });

  test("renders accessible button cards and filter attributes when onMetricClick is provided", () => {
    const dummyFn = () => {};
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
        onMetricClick: dummyFn,
      })
    );

    assert.ok(html.includes('role="button"'), "Card should have role=button when clickable");
    assert.ok(html.includes('data-metric-status="ALL"'), "Has ALL filter target");
    assert.ok(html.includes('data-metric-status="OVERDUE"'), "Has OVERDUE filter target");
    assert.ok(html.includes('data-metric-status="NEEDS_REVIEW"'), "Has NEEDS_REVIEW filter target");
    assert.ok(html.includes('data-metric-status="COMPLETED"'), "Has COMPLETED filter target");
  });

  test("handles zero overdue and waiting metrics gracefully", () => {
    const zeroMetrics = {
      totalTasks: 10,
      urgentOverdueCount: 0,
      waitingApprovalCount: 0,
      completedRate: 100,
      labelScope: "Phòng Đào tạo",
    };

    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics: zeroMetrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("Tiến độ đúng hạn"), "Shows on-schedule state when 0 overdue");
    assert.ok(html.includes("text-muted-foreground"), "Uses muted style when no pending items");
  });
});
