import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttentionBadge } from "../src/components/workspace/attention-badge";
import { ActionQueueShell } from "../src/components/workspace/action-queue-shell";
import { parseZoneParam } from "@qcet/contracts/types/workspace";
import { resolveBreadcrumb } from "../src/lib/navigation/active-matcher";

describe("Shared Workspace Primitives (F3) - Comprehensive Suite", () => {

  describe("7. AttentionBadge - WCAG 2.2 SC 1.4.1 (No Color Alone)", () => {
    test("combines icon, text label, and numeric count", () => {
      const markup = renderToStaticMarkup(
        React.createElement(AttentionBadge, {
          level: "urgent",
          label: "Trễ hạn cấp bách",
          count: 3,
        })
      );

      assert.ok(markup.includes('role="status"'), "has role status");
      assert.ok(markup.includes("Trễ hạn cấp bách"), "includes visible text");
      assert.ok(markup.includes("3"), "includes numeric count");
      assert.ok(markup.includes("svg"), "includes SVG icon");
    });

    test("renders button with min-h-[44px] when asButton is true", () => {
      const markup = renderToStaticMarkup(
        React.createElement(AttentionBadge, {
          level: "warning",
          label: "Cần xem xét",
          asButton: true,
        })
      );

      assert.ok(markup.includes("<button"), "renders as button");
      assert.ok(markup.includes("min-h-[44px]"), "provides 44px touch target");
    });
  });

  describe("8. ActionQueueShell - Structure & Touch Targets", () => {
    test("collapsible button provides 44x44px touch boundary", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ActionQueueShell, {
          totalCount: 5,
          children: React.createElement("div", null, "Item 1"),
        })
      );

      assert.ok(
        markup.includes('aria-labelledby="action-queue-title"'),
        "has accessible label"
      );
      assert.ok(
        markup.includes("min-h-[44px]") && markup.includes("min-w-[44px]"),
        "collapse trigger satisfies 44x44px touch target"
      );
      assert.ok(
        markup.includes("5 việc cần xử lý"),
        "displays attention badge count"
      );
    });

    test("renders informative empty state without fabricated metrics when empty", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ActionQueueShell, {
          isEmpty: true,
          totalCount: 0,
        })
      );

      assert.ok(
        markup.includes("Không có việc tồn đọng"),
        "displays clear empty title"
      );
      assert.ok(
        markup.includes("Hoàn thành"),
        "displays completed badge"
      );
    });
  });
});


/* ===== merged from tests/workspace-zone-fallback.test.ts ===== */

test("parseZoneParam defaults to 'dashboard' when param is null or undefined (Bàn làm việc Cockpit)", () => {
  assert.equal(parseZoneParam(null), "dashboard");
  assert.equal(parseZoneParam(undefined), "dashboard");
  assert.equal(parseZoneParam(""), "dashboard");
  assert.equal(parseZoneParam("tasks"), "tasks");
  assert.equal(parseZoneParam("calendar"), "calendar");
});

test("resolveBreadcrumb for root path '/' resolves to 'Tổng quan'", () => {
  const crumbs = resolveBreadcrumb("/");
  assert.deepEqual(crumbs, ["QCET E-Office", "Tổng quan"]);
});
