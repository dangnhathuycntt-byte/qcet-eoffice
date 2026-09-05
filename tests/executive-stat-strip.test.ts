import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, getStatCardData } from "../src/components/dashboard/executive-stat-strip";
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

  test("getStatCardData provides accurate titles and breakdown subtexts in Vietnamese", () => {
    const cards = getStatCardData(mockStats);

    // Card 1: Nhiệm vụ cấp Trường
    assert.equal(cards[0].title, "Nhiệm vụ cấp Trường");
    assert.ok(cards[0].subtext?.includes("212 đang làm"));
    assert.ok(cards[0].subtext?.includes("92 xong"));

    // Card 2: Công việc Đơn vị
    assert.equal(cards[1].title, "Công việc Đơn vị");
    assert.ok(cards[1].subtext?.includes("580 đang làm"));
    assert.ok(cards[1].subtext?.includes("290 xong"));

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
});
