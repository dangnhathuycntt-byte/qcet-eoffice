import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatNumber,
  getStatCardData,
  getExecutiveStatCardData,
  getStatCardsForView,
  type WorkboxFilter,
} from "../src/components/dashboard/executive-stat-strip";
import type { DashboardStats } from "../src/types/dashboard";

describe("ExecutiveStatStrip Helpers", () => {
  const mockStats: DashboardStats = {
    totalSchoolTasks: 304,
    schoolTasksInProgress: 212,
    schoolTasksCompleted: 92,
    totalStaffTasks: 920,
    staffTasksInProgress: 580,
    staffTasksCompleted: 290,
    needsReviewTasksCount: 42,
    overdueTasksCount: 5,
    averageSchoolProgressPercent: 74,
  };

  test("getStatCardData returns 4 formatted cards with proper metadata", () => {
    const cards = getStatCardData(mockStats);
    assert.equal(cards.length, 4);
    assert.equal(cards[0].value, "304");
    assert.equal(cards[1].value, "920");
    assert.equal(cards[2].value, "47"); // 42 needs review + 5 overdue
    assert.equal(cards[3].value, "74%");
  });

  test("getStatCardData assigns matching WorkboxFilter key to each card", () => {
    const cards = getStatCardData(mockStats);
    assert.equal(cards[0].filterKey, "ALL");
    assert.equal(cards[1].filterKey, "MY_ACTION");
    assert.equal(cards[2].filterKey, "URGENT_OVERDUE");
    assert.equal(cards[3].filterKey, "COMPLETED");
  });

  test("getStatCardData provides accurate titles and breakdown subtexts in Vietnamese", () => {
    const cards = getStatCardData(mockStats);

    // Card 1: Nhiệm vụ cấp Trường
    assert.equal(cards[0].title, "Nhiệm vụ cấp Trường");
    assert.ok(cards[0].subtext?.includes("212 đang làm"));
    assert.ok(cards[0].subtext?.includes("92 hoàn thành"));

    // Card 2: Công việc Đơn vị
    assert.equal(cards[1].title, "Công việc Đơn vị");
    assert.ok(cards[1].subtext?.includes("580 đang làm"));
    assert.ok(cards[1].subtext?.includes("290 hoàn thành"));

    // Card 3: Cần xử lý & Trễ hạn
    assert.equal(cards[2].title, "Cần xử lý & Trễ hạn");
    assert.ok(cards[2].badge !== undefined);
    assert.ok(cards[2].subtext?.includes("42"));
    assert.ok(cards[2].subtext?.includes("5"));

    // Card 4: Tiến độ trung bình toàn trường
    assert.equal(cards[3].title, "Tiến độ trung bình toàn trường");
    assert.equal(cards[3].progress, 74);
  });

  test("stat cards contain zero decorative emojis in titles, subtexts, and badges", () => {
    const cards = getStatCardData(mockStats);
    const emojiRegex = /\p{Extended_Pictographic}/u;

    cards.forEach((card) => {
      assert.equal(
        emojiRegex.test(card.title),
        false,
        `Card title "${card.title}" must not contain emojis`
      );
      assert.equal(
        emojiRegex.test(card.subtext),
        false,
        `Card subtext "${card.subtext}" must not contain emojis`
      );
      if (card.badge) {
        assert.equal(
          emojiRegex.test(card.badge.label),
          false,
          `Card badge "${card.badge.label}" must not contain emojis`
        );
      }
    });
  });

  test("stat cards use standardized executive Lucide icon names", () => {
    const cards = getStatCardData(mockStats);
    assert.equal(cards[0].iconName, "Layers");
    assert.equal(cards[1].iconName, "Clock");
    assert.equal(cards[2].iconName, "AlertTriangle");
    assert.equal(cards[3].iconName, "CheckCircle2");
  });

  test("stat cards provide consistent unique IDs for executive workboxes", () => {
    const cards = getStatCardData(mockStats);
    assert.deepEqual(
      cards.map((c) => c.id),
      ["school-tasks", "unit-tasks", "urgent-tasks", "overall-progress"]
    );
  });

  test("formatNumber formats integers correctly", () => {
    assert.equal(formatNumber(0), "0");
    assert.equal(formatNumber(304), "304");
    assert.equal(formatNumber(920), "920");
    assert.ok(formatNumber(1500).includes("1") && formatNumber(1500).includes("500"));
  });

  test("handles zeroed or empty stats without crashing", () => {
    const emptyStats: DashboardStats = {
      totalSchoolTasks: 0,
      schoolTasksInProgress: 0,
      schoolTasksCompleted: 0,
      totalStaffTasks: 0,
      staffTasksInProgress: 0,
      staffTasksCompleted: 0,
      needsReviewTasksCount: 0,
      overdueTasksCount: 0,
      averageSchoolProgressPercent: 0,
    };

    const cards = getStatCardData(emptyStats);
    assert.equal(cards.length, 4);
    assert.equal(cards[0].value, "0");
    assert.equal(cards[1].value, "0");
    assert.equal(cards[2].value, "0");
    assert.equal(cards[3].value, "0%");
    assert.equal(cards[3].progress, 0);
  });

  test("integrates triage queue into urgent card when pendingTriageCount is present and > 0", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 2,
    };
    const cards = getStatCardData(stats);
    assert.equal(cards.length, 4, "Must maintain exactly 4 cards");
    const urgentCard = cards.find((c) => c.id === "urgent-tasks")!;
    assert.ok(urgentCard, "urgent-tasks card must exist");
    assert.ok(
      urgentCard.subtext.includes("2 chờ tiếp nhận"),
      "urgent card must include triage count in subtext"
    );
  });

  test("integrates escalated review into urgent card when escalatedReviewCount is present and > 0", () => {
    const stats: DashboardStats = {
      ...mockStats,
      escalatedReviewCount: 3,
    };
    const cards = getStatCardData(stats);
    assert.equal(cards.length, 4, "Must maintain exactly 4 cards");
    const urgentCard = cards.find((c) => c.id === "urgent-tasks")!;
    assert.ok(urgentCard, "urgent-tasks card must exist");
    assert.ok(
      urgentCard.subtext.includes("3 quá hạn"),
      "urgent card must include escalated count in subtext"
    );
    assert.ok(
      urgentCard.badge?.label.includes("quá hạn"),
      "urgent card badge must indicate overdue/escalated"
    );
  });

  test("strictly maintains 4 cards when both triage and escalated counts are > 0", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 2,
      escalatedReviewCount: 3,
    };
    const cards = getStatCardData(stats);
    assert.equal(cards.length, 4, "should always strictly maintain 4 cards");
    const urgentCard = cards.find((c) => c.id === "urgent-tasks")!;
    assert.ok(urgentCard.subtext.includes("chờ tiếp nhận"));
    assert.ok(urgentCard.subtext.includes("quá hạn"));
  });

  test("omits triage and escalated text from urgent card when counts are 0 or absent", () => {
    const cards = getStatCardData(mockStats);
    const urgentCard = cards.find((c) => c.id === "urgent-tasks")!;
    assert.equal(
      urgentCard.subtext.includes("chờ tiếp nhận"),
      false,
      "triage text must not appear when count is 0/absent"
    );
    assert.equal(
      urgentCard.subtext.includes("quá hạn"),
      false,
      "escalated text must not appear when count is 0/absent"
    );
  });

  test("all cards contain zero decorative emojis even with triage and escalated counts", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 5,
      escalatedReviewCount: 7,
    };
    const cards = getStatCardData(stats);
    const emojiRegex = /\p{Extended_Pictographic}/u;
    assert.equal(cards.length, 4, "always 4 cards");
    cards.forEach((card) => {
      assert.equal(
        emojiRegex.test(card.title),
        false,
        `Card title "${card.title}" must not contain emojis`
      );
      assert.equal(
        emojiRegex.test(card.subtext),
        false,
        `Card subtext "${card.subtext}" must not contain emojis`
      );
      if (card.badge) {
        assert.equal(
          emojiRegex.test(card.badge.label),
          false,
          `Card badge "${card.badge.label}" must not contain emojis`
        );
      }
    });
  });

  test("urgent card uses tabular-nums compatible values when integrating triage and escalated", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 12,
      escalatedReviewCount: 8,
    };
    const cards = getStatCardData(stats);
    const urgentCard = cards.find((c) => c.id === "urgent-tasks")!;
    // Values should be numeric strings (formatted by formatNumber)
    assert.equal(urgentCard.value, formatNumber(42 + 5 + 12 + 8));
  });

  test("toggle logic switches between selected filterKey and ALL", () => {
    const cards = getStatCardData(mockStats);
    const getNextFilter = (active: WorkboxFilter | undefined, target: WorkboxFilter): WorkboxFilter =>
      active === target ? "ALL" : target;

    // Initially ALL, click card 2 (URGENT_OVERDUE) -> URGENT_OVERDUE
    assert.equal(getNextFilter("ALL", cards[2].filterKey!), "URGENT_OVERDUE");

    // Already URGENT_OVERDUE, click card 2 again -> toggles back to ALL
    assert.equal(getNextFilter("URGENT_OVERDUE", cards[2].filterKey!), "ALL");

    // From URGENT_OVERDUE, click card 1 (MY_ACTION) -> switches to MY_ACTION
    assert.equal(getNextFilter("URGENT_OVERDUE", cards[1].filterKey!), "MY_ACTION");
  });
});

describe("ExecutiveStatStrip Label Accuracy", () => {
  test("getStatCardData produces accurate MECE subtexts and card 4 progress format", () => {
    const mockStats: DashboardStats = {
      totalSchoolTasks: 304,
      schoolTasksInProgress: 212,
      schoolTasksCompleted: 92,
      schoolTasksNotStarted: 0,
      totalStaffTasks: 920,
      staffTasksInProgress: 580,
      staffTasksCompleted: 290,
      staffTasksNotStarted: 50,
      needsReviewTasksCount: 42,
      overdueTasksCount: 5,
      averageSchoolProgressPercent: 74,
      completionRate: 30,
    };

    const cards = getStatCardData(mockStats);

    // Card 1: Nhiệm vụ cấp Trường
    assert.equal(cards[0].id, "school-tasks");
    assert.equal(cards[0].title, "Nhiệm vụ cấp Trường");
    assert.equal(cards[0].value, "304");
    assert.equal(cards[0].subtext, "212 đang làm · 0 chưa làm · 92 hoàn thành");

    // Card 2: Công việc Đơn vị
    assert.equal(cards[1].id, "unit-tasks");
    assert.equal(cards[1].title, "Công việc Đơn vị");
    assert.equal(cards[1].value, "920");
    assert.equal(cards[1].subtext, "580 đang làm · 50 chưa làm · 290 hoàn thành");

    // Card 3: Cần xử lý & Trễ hạn
    assert.equal(cards[2].id, "urgent-tasks");
    assert.equal(cards[2].title, "Cần xử lý & Trễ hạn");
    assert.ok(cards[2].subtext.includes("42 cần duyệt · 5 trễ hạn"));

    // Card 4: Tiến độ trung bình toàn trường
    assert.equal(cards[3].id, "overall-progress");
    assert.equal(cards[3].title, "Tiến độ trung bình toàn trường");
    assert.equal(cards[3].value, "74%");
    assert.equal(cards[3].subtext, "Hoàn tất 92/304 (30%)");
    assert.equal(cards[3].progress, 74);
  });

  test("Card 4 calculates completionRate fallback when completionRate is undefined", () => {
    const mockStats: DashboardStats = {
      totalSchoolTasks: 100,
      schoolTasksInProgress: 50,
      schoolTasksCompleted: 25,
      totalStaffTasks: 50,
      staffTasksInProgress: 30,
      staffTasksCompleted: 20,
      needsReviewTasksCount: 2,
      overdueTasksCount: 1,
      averageSchoolProgressPercent: 45,
    };

    const cards = getStatCardData(mockStats);
    assert.equal(cards[3].subtext, "Hoàn tất 25/100 (25%)");
  });
});

describe("Executive 5-KPI Strip Variant", () => {
  const mockStats: DashboardStats = {
    totalSchoolTasks: 50,
    schoolTasksInProgress: 30,
    schoolTasksCompleted: 15,
    schoolTasksNotStarted: 5,
    totalStaffTasks: 120,
    staffTasksInProgress: 80,
    staffTasksCompleted: 35,
    staffTasksNotStarted: 5,
    needsReviewTasksCount: 4,
    overdueTasksCount: 3,
    averageSchoolProgressPercent: 68,
    completionRate: 30,
  };

  test("getExecutiveStatCardData returns exactly 5 core KPIs", () => {
    const cards = getExecutiveStatCardData(mockStats);
    assert.equal(cards.length, 5);

    const titles = cards.map((c) => c.title);
    assert.deepEqual(titles, [
      "Tổng nhiệm vụ",
      "Chờ duyệt",
      "Trễ / vướng",
      "Trọng tâm",
      "Tiến độ toàn trường",
    ]);
  });

  test("cards format values and percentages correctly", () => {
    const cards = getExecutiveStatCardData(mockStats);
    assert.equal(cards[0].value, "50");
    assert.equal(cards[1].value, "4");
    assert.equal(cards[4].value, "68%");
  });

  test("isExecutive={true} without executiveStats correctly yields 5-KPI configuration", () => {
    const cards = getStatCardsForView(mockStats, true, undefined);
    assert.equal(cards.length, 5);

    const titles = cards.map((c) => c.title);
    assert.deepEqual(titles, [
      "Tổng nhiệm vụ",
      "Chờ duyệt",
      "Trễ / vướng",
      "Trọng tâm",
      "Tiến độ toàn trường",
    ]);

    // Fallback mappings when executiveStats is absent
    const pendingApprovalCard = cards.find((c) => c.id === "pending-approval");
    assert.equal(pendingApprovalCard?.value, "4"); // stats.needsReviewTasksCount

    const blockedOverdueCard = cards.find((c) => c.id === "blocked-overdue");
    assert.equal(blockedOverdueCard?.value, "3"); // stats.overdueTasksCount

    const strategicCard = cards.find((c) => c.id === "strategic-active");
    assert.equal(strategicCard?.value, "0");

    const overallProgressCard = cards.find((c) => c.id === "overall-progress");
    assert.equal(overallProgressCard?.value, "68%");
  });

  test("isExecutive={false} without executiveStats correctly yields 4-KPI non-executive configuration", () => {
    const cards = getStatCardsForView(mockStats, false, undefined);
    assert.equal(cards.length, 4);

    const titles = cards.map((c) => c.title);
    assert.deepEqual(titles, [
      "Nhiệm vụ cấp Trường",
      "Công việc Đơn vị",
      "Cần xử lý & Trễ hạn",
      "Tiến độ trung bình toàn trường",
    ]);
  });
});
