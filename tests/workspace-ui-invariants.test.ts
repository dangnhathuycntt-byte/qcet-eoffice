/**
 * Workspace UI Invariants Test Suite (Shard F4 / Sprints 8 & 9)
 *
 * Enforces universal UI and semantic invariants across all QCET workspace views:
 * 3. 'Của tôi' Scope-vs-Status Exclusivity: Present in ScopeSwitcher, strictly absent in StatusFilter
 * 4. Dashboard Cockpit Deduplication: Band 1 (5 primary KPI cards) vs Band 2 (Action Queue)
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseWorkspaceQuery,
  DEFAULT_WORKSPACE_FILTER_STATE,
} from "../src/lib/workspace-query";
import { ScopeSwitcher } from "../src/components/workspace/scope-switcher";
import { DEFAULT_STATUS_OPTIONS } from "../src/components/workspace/status-filter";
import {
  getExecutiveStatCardData,
  getStatCardData,
} from "../src/components/dashboard/executive-stat-strip";
import { getActionCardData } from "../src/components/dashboard/executive-action-center";
import type { DashboardStats } from "../src/types/dashboard";
import type { ExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";

describe("Workspace UI Invariants - Quality, Semantics & Zero-Emoji Suite", () => {
  describe("Invariant 3: 'Của tôi' Scope-vs-Status Exclusivity", () => {
    test("'Của tôi' is strictly defined in ScopeSwitcher and absent from StatusFilter options", () => {
      // 1. Render ScopeSwitcher and assert 'Của tôi' is present as a scope tab
      const scopeMarkup = renderToStaticMarkup(
        React.createElement(ScopeSwitcher, {
          activeScope: "school",
          onScopeChange: () => {},
        })
      );
      assert.ok(
        scopeMarkup.includes('id="scope-tab-my"'),
        "ScopeSwitcher must render 'my' scope tab"
      );
      assert.ok(
        scopeMarkup.includes("Của tôi"),
        "ScopeSwitcher must display 'Của tôi' label"
      );

      // 2. DEFAULT_STATUS_OPTIONS check
      const statusValues = DEFAULT_STATUS_OPTIONS.map((s) => s.id);
      assert.ok(
        !statusValues.includes("my"),
        "DEFAULT_STATUS_OPTIONS must NOT contain 'my'"
      );
      assert.ok(
        !statusValues.includes("my_tasks"),
        "DEFAULT_STATUS_OPTIONS must NOT contain 'my_tasks'"
      );

      const statusLabels = DEFAULT_STATUS_OPTIONS.map((s) => s.label);
      assert.ok(
        !statusLabels.includes("Của tôi"),
        "DEFAULT_STATUS_OPTIONS labels must NOT include 'Của tôi'"
      );
      assert.ok(
        !statusLabels.includes("Cá nhân"),
        "DEFAULT_STATUS_OPTIONS labels must NOT include 'Cá nhân'"
      );
    });

    test("query parser preserves orthogonal separation of scope and status", () => {
      // Case A: scope=my with status=in_progress
      const parsedA = parseWorkspaceQuery(
        new URLSearchParams("scope=my&status=in_progress")
      );
      assert.equal(parsedA.scope, "my", "scope=my must parse as scope='my'");
      assert.equal(
        parsedA.status,
        "IN_PROGRESS",
        "Orthogonal status must be parsed as IN_PROGRESS"
      );

      // Case B: legacy alias s=cua_toi
      const parsedB = parseWorkspaceQuery(new URLSearchParams("s=cua_toi"));
      assert.equal(parsedB.scope, "my", "s=cua_toi must normalize to scope='my'");
      assert.equal(
        parsedB.status,
        DEFAULT_WORKSPACE_FILTER_STATE.status,
        "Status must remain default ALL when only scope is passed"
      );

      // Case C: invalid status=my does NOT pollute status (falls back to default ALL)
      const parsedC = parseWorkspaceQuery(new URLSearchParams("status=my"));
      assert.equal(
        parsedC.status,
        "ALL",
        "Invalid status 'my' must not be recognized as a valid lifecycle status"
      );
    });
  });

  describe("Invariant 4: Dashboard Cockpit & Metric Strip Deduplication", () => {
    const dummyStats: DashboardStats = {
      totalSchoolTasks: 395,
      schoolTasksInProgress: 200,
      schoolTasksCompleted: 105,
      schoolTasksNotStarted: 75,
      totalStaffTasks: 280,
      staffTasksInProgress: 140,
      staffTasksCompleted: 110,
      staffTasksNotStarted: 30,
      needsReviewTasksCount: 9,
      overdueTasksCount: 1,
      averageSchoolProgressPercent: 78,
      completionRate: 27,
    };

    const dummyExecutiveStats: ExecutiveActionStats = {
      pendingSchoolApprovalCount: 9,
      overdueTasksCount: 1,
      blockedTasksCount: 2,
      strategicActiveCount: 15,
    };

    test("Band 1 (ExecutiveStatStrip): returns exactly 5 primary KPI cards for executive view", () => {
      const cards = getExecutiveStatCardData(dummyStats, dummyExecutiveStats);

      assert.equal(cards.length, 5, "Band 1 executive strip must have exactly 5 cards");

      const cardIds = cards.map((c) => c.id);
      assert.deepEqual(cardIds, [
        "school-tasks",
        "pending-approval",
        "blocked-overdue",
        "strategic-active",
        "overall-progress",
      ]);

      // Card 1: Tổng nhiệm vụ
      assert.equal(cards[0].title, "Tổng nhiệm vụ");
      assert.equal(cards[0].value, "395");

      // Card 2: Chờ duyệt
      assert.equal(cards[1].title, "Chờ duyệt");
      assert.equal(cards[1].value, "9");

      // Card 3: Trễ / vướng
      assert.equal(cards[2].title, "Trễ / vướng");
      assert.equal(cards[2].value, "3"); // 1 overdue + 2 blocked

      // Card 4: Trọng tâm
      assert.equal(cards[3].title, "Trọng tâm");
      assert.equal(cards[3].value, "15");

      // Card 5: Tiến độ toàn trường
      assert.equal(cards[4].title, "Tiến độ toàn trường");
      assert.equal(cards[4].value, "78%");
    });

    test("cards in Band 1 and Band 2 have distinct, non-colliding semantic purviews", () => {
      const band1Cards = getExecutiveStatCardData(dummyStats, dummyExecutiveStats);
      const band2Cards = getActionCardData(dummyExecutiveStats);

      // Band 1 answers macro institutional status
      assert.equal(band1Cards.length, 5);
      // Band 2 answers micro action queues
      assert.equal(band2Cards.length, 3);

      // In Band 1, school-tasks and overall-progress provide macro situational awareness
      assert.ok(band1Cards.some((c) => c.id === "school-tasks"));
      assert.ok(band1Cards.some((c) => c.id === "overall-progress"));

      // Band 2 only focuses on action queues
      const band2Keys = band2Cards.map((c) => c.filterKey);
      assert.deepEqual(band2Keys, ["PENDING_APPROVAL", "BLOCKED_OVERDUE", "STRATEGIC"]);
    });
  });
});
