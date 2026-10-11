/**
 * Workspace UI Invariants Test Suite (Shard F4 / Sprints 8 & 9)
 *
 * Enforces universal UI and semantic invariants across all QCET workspace views:
 * 3. 'Của tôi' Scope-vs-Status Exclusivity: Present in ScopeSwitcher, strictly absent in StatusFilter
 * 4. Dashboard Cockpit Deduplication: Band 1 (5 primary KPI cards) vs Band 2 (Action Queue)
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkspaceQuery } from "../src/lib/workspace-query";
import {
  getExecutiveStatCardData,
  getStatCardData,
} from "../src/components/dashboard/executive-stat-strip";
import type { DashboardStats } from "../src/types/dashboard";
import type { ExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";

describe("Workspace UI Invariants - Quality, Semantics & Zero-Emoji Suite", () => {

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
  });
});
