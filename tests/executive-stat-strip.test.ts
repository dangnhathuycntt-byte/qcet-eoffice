import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, getStatCardData, type WorkboxFilter } from "../src/components/dashboard/executive-stat-strip";
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
    assert.equal(cards[0].filterKey, "URGENT_OVERDUE");
    assert.equal(cards[1].filterKey, "MY_ACTION");
    assert.equal(cards[2].filterKey, "ASSIGNED_BY_ME");
    assert.equal(cards[3].filterKey, "COMPLETED");
  });

  test("getStatCardData provides accurate titles and breakdown subtexts in Vietnamese", () => {
    const cards = getStatCardData(mockStats);

    // Card 1: Nhiệm vụ cấp Trường
    assert.equal(cards[0].title, "Nhiệm vụ cấp Trường");
    assert.ok(cards[0].subtext?.includes("212 đang làm"));
    assert.ok(cards[0].subtext?.includes("92 hoàn thiện"));

    // Card 2: Công việc Đơn vị
    assert.equal(cards[1].title, "Công việc Đơn vị");
    assert.ok(cards[1].subtext?.includes("580 đang làm"));
    assert.ok(cards[1].subtext?.includes("290 hoàn thiện"));

    // Card 3: Cần xử lý & Trễ hạn
    assert.equal(cards[2].title, "Cần xử lý & Trễ hạn");
    assert.ok(cards[2].badge !== undefined);
    assert.ok(cards[2].subtext?.includes("42"));
    assert.ok(cards[2].subtext?.includes("5"));

    // Card 4: Tỷ lệ hoàn thành toàn trường
    assert.equal(cards[3].title, "Tỷ lệ hoàn thành toàn trường");
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

  test("renders triage queue card when pendingTriageCount is present and > 0", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 2,
    };
    const cards = getStatCardData(stats);
    const triageCard = cards.find((c) => c.id === "triage-queue");
    assert.ok(triageCard, "triage-queue card must exist when pendingTriageCount > 0");
    assert.equal(triageCard!.title, "Chờ tiếp nhận");
    assert.equal(triageCard!.value, "2");
    assert.equal(triageCard!.iconName, "Clock");
    assert.ok(
      triageCard!.subtext.length > 0,
      "triage card must have non-empty subtext"
    );
  });

  test("renders escalated review card when escalatedReviewCount is present and > 0", () => {
    const stats: DashboardStats = {
      ...mockStats,
      escalatedReviewCount: 3,
    };
    const cards = getStatCardData(stats);
    const escalatedCard = cards.find((c) => c.id === "escalated-reviews");
    assert.ok(escalatedCard, "escalated-reviews card must exist when escalatedReviewCount > 0");
    assert.equal(escalatedCard!.title, "Quá hạn thẩm định");
    assert.equal(escalatedCard!.value, "3");
    assert.equal(escalatedCard!.iconName, "AlertTriangle");
    assert.ok(
      escalatedCard!.subtext.length > 0,
      "escalated card must have non-empty subtext"
    );
  });

  test("renders both triage and escalated cards when both counts are > 0", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 2,
      escalatedReviewCount: 3,
    };
    const cards = getStatCardData(stats);
    const triageCard = cards.find((c) => c.id === "triage-queue");
    const escalatedCard = cards.find((c) => c.id === "escalated-reviews");
    assert.ok(triageCard, "triage-queue card must be present");
    assert.ok(escalatedCard, "escalated-reviews card must be present");
    assert.equal(cards.length, 6, "should have 4 base cards + 2 new cards");
  });

  test("omits triage and escalated cards when counts are 0 or absent", () => {
    const cards = getStatCardData(mockStats);
    const triageCard = cards.find((c) => c.id === "triage-queue");
    const escalatedCard = cards.find((c) => c.id === "escalated-reviews");
    assert.equal(triageCard, undefined, "triage-queue card must not appear when count is 0/absent");
    assert.equal(escalatedCard, undefined, "escalated-reviews card must not appear when count is 0/absent");
  });

  test("triage and escalated cards contain zero decorative emojis", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 5,
      escalatedReviewCount: 7,
    };
    const cards = getStatCardData(stats);
    const emojiRegex = /\p{Extended_Pictographic}/u;
    const newCards = cards.filter(
      (c) => c.id === "triage-queue" || c.id === "escalated-reviews"
    );
    assert.equal(newCards.length, 2, "both new cards must exist");
    newCards.forEach((card) => {
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

  test("triage and escalated cards use tabular-nums compatible values", () => {
    const stats: DashboardStats = {
      ...mockStats,
      pendingTriageCount: 12,
      escalatedReviewCount: 8,
    };
    const cards = getStatCardData(stats);
    const triageCard = cards.find((c) => c.id === "triage-queue")!;
    const escalatedCard = cards.find((c) => c.id === "escalated-reviews")!;
    // Values should be numeric strings (formatted by formatNumber)
    assert.equal(triageCard.value, "12");
    assert.equal(escalatedCard.value, "8");
  });

  test("toggle logic switches between selected filterKey and ALL", () => {
    const cards = getStatCardData(mockStats);
    const getNextFilter = (active: WorkboxFilter | undefined, target: WorkboxFilter): WorkboxFilter =>
      active === target ? "ALL" : target;

    // Initially ALL, click card 0 (URGENT_OVERDUE) -> URGENT_OVERDUE
    assert.equal(getNextFilter("ALL", cards[0].filterKey!), "URGENT_OVERDUE");

    // Already URGENT_OVERDUE, click card 0 again -> toggles back to ALL
    assert.equal(getNextFilter("URGENT_OVERDUE", cards[0].filterKey!), "ALL");

    // From URGENT_OVERDUE, click card 1 (MY_ACTION) -> switches to MY_ACTION
    assert.equal(getNextFilter("URGENT_OVERDUE", cards[1].filterKey!), "MY_ACTION");
  });
});
