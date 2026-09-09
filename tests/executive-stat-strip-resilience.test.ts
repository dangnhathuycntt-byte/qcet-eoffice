import { test } from "node:test";
import assert from "node:assert/strict";
import { getStatCardData } from "../src/components/dashboard/executive-stat-strip";
import type { DashboardStats } from "../src/types/dashboard";

test("getStatCardData always returns exactly 4 cards even with triage and escalated items", () => {
  const statsWithQueues: DashboardStats = {
    totalSchoolTasks: 45,
    schoolTasksInProgress: 30,
    schoolTasksCompleted: 15,
    totalStaffTasks: 120,
    staffTasksInProgress: 80,
    staffTasksCompleted: 40,
    needsReviewTasksCount: 5,
    overdueTasksCount: 3,
    averageSchoolProgressPercent: 68,
    pendingTriageCount: 4,
    escalatedReviewCount: 2,
  };

  const cards = getStatCardData(statsWithQueues);
  assert.equal(cards.length, 4, "Must strictly maintain 4 cards to prevent layout shift");

  // Check correct filterKey mapping
  assert.equal(cards[0].filterKey, "ALL");
  assert.equal(cards[1].filterKey, "MY_ACTION");
  assert.equal(cards[2].filterKey, "URGENT_OVERDUE");
  assert.equal(cards[3].filterKey, "COMPLETED");

  // Check that urgent card integrates triage and escalated information
  const urgentCard = cards[2];
  assert.ok(urgentCard.subtext.includes("chờ tiếp nhận") || urgentCard.subtext.includes("quá hạn"));
});
