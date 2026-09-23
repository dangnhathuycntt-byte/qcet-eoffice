import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getActionCardData,
  ExecutiveActionCenter,
} from "../src/components/dashboard/executive-action-center";
import {
  getDepartmentCardData,
  getDepartmentTasksUrl,
  sortDepartmentsByProgress,
  sortDepartmentsByOverdue,
} from "../src/components/dashboard/department-progress-matrix";
import { parseDateOnly } from "../src/components/dashboard/upcoming-deadlines-widget";
import { getActorInitials } from "../src/components/dashboard/activity-feed-widget";
import {
  extractExecutiveActionItems,
  type ExecutiveActionItem,
  type ExecutiveActionStats,
} from "../src/lib/executive-matrix-aggregator";
import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";
import {
  buildLargeFixture,
  FIXTURE_REFERENCE_DATE,
} from "./fixtures/workbench-queue-fixture";

// -- Test data -----------------------------------------------------------

const mockStats: ExecutiveActionStats = {
  pendingSchoolApprovalCount: 7,
  blockedTasksCount: 3,
  overdueTasksCount: 2,
  strategicActiveCount: 12,
};

const mockDepartments: DepartmentHealthSummary[] = [
  {

    departmentName: "Khoa Cong nghe thong tin",
    leadName: "TS. Nguyen Ngoc Vinh",
    totalTasksCount: 10,
    completedTasksCount: 6,
    inProgressTasksCount: 3,
    blockedTasksCount: 1,
    overdueTasksCount: 2,
    averageProgressPercent: 72,
  },
  {

    departmentName: "Phong Dao tao & QLKH",
    leadName: "ThS. Do Quang Trung",
    totalTasksCount: 8,
    completedTasksCount: 7,
    inProgressTasksCount: 1,
    blockedTasksCount: 0,
    overdueTasksCount: 0,
    averageProgressPercent: 92,
  },
  {

    departmentName: "Phong Hanh chinh - Quan tri",
    leadName: "ThS. Phan Van Thanh",
    totalTasksCount: 5,
    completedTasksCount: 1,
    inProgressTasksCount: 2,
    blockedTasksCount: 2,
    overdueTasksCount: 1,
    averageProgressPercent: 38,
  },
];

const EMPTY_STATS: ExecutiveActionStats = {
  pendingSchoolApprovalCount: 0,
  blockedTasksCount: 0,
  overdueTasksCount: 0,
  strategicActiveCount: 0,
};

function item(n: number): ExecutiveActionItem {
  return {
    id: `act-${n}`,
    taskId: `task-${n}`,
    title: `Nhiệm vụ số ${n} cần xử lý`,
    dueDate: `2026-09-1${n % 10}`,
    filterType: "BLOCKED_OVERDUE",
    reasons: ["OVERDUE"],
    primaryReason: "OVERDUE",
    actionLabel: "Xem chi tiết",
  };
}

const renderCenter = (over: Partial<Parameters<typeof ExecutiveActionCenter>[0]> = {}) =>
  renderToStaticMarkup(
    React.createElement(ExecutiveActionCenter, {
      stats: EMPTY_STATS,
      activeFilter: "ALL",
      onFilterChange: () => {},
      items: [],
      ...over,
    })
  );

// -- ExecutiveActionCenter card data -------------------------------------

describe("ExecutiveActionCenter", () => {
  test("getActionCardData returns 3 cards with correct values", () => {
    const cards = getActionCardData(mockStats);
    assert.equal(cards.length, 3);
    assert.equal(cards[0].value, 7); // pendingSchoolApprovalCount
    assert.equal(cards[1].value, 5); // blocked(3) + overdue(2)
    assert.equal(cards[2].value, 12); // strategicActiveCount
  });

  test("getActionCardData returns correct filter keys", () => {
    const cards = getActionCardData(mockStats);
    assert.equal(cards[0].filterKey, "PENDING_APPROVAL");
    assert.equal(cards[1].filterKey, "BLOCKED_OVERDUE");
    assert.equal(cards[2].filterKey, "STRATEGIC");
  });

  test("getActionCardData returns correct titles", () => {
    const cards = getActionCardData(mockStats);
    // The review card names the file set, not an approver claim the payload cannot prove.
    assert.equal(cards[0].title, "Hồ sơ chờ xem xét");
    assert.equal(cards[1].title, "Vướng mắc & Trễ hạn");
    assert.equal(cards[2].title, "Nhiệm vụ Chiến lược");
  });

  test("action card titles and values contain zero emojis", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const cards = getActionCardData(mockStats);
    for (const card of cards) {
      assert.ok(!emojiRegex.test(card.title), `Emoji found in title: ${card.title}`);
      assert.ok(!emojiRegex.test(String(card.value)), `Emoji found in value: ${card.value}`);
    }
  });

  test("getActionCardData handles zero stats gracefully", () => {
    const zeroStats: ExecutiveActionStats = {
      pendingSchoolApprovalCount: 0,
      blockedTasksCount: 0,
      overdueTasksCount: 0,
      strategicActiveCount: 0,
    };
    const cards = getActionCardData(zeroStats);
    assert.equal(cards[0].value, 0);
    assert.equal(cards[1].value, 0);
    assert.equal(cards[2].value, 0);
  });
});

// -- DepartmentProgressMatrix card data ----------------------------------

describe("DepartmentProgressMatrix", () => {
  test("getDepartmentCardData returns correct count matching input", () => {
    const cards = getDepartmentCardData(mockDepartments);
    assert.equal(cards.length, 3);
  });

  test("getDepartmentCardData preserves department data fields", () => {
    const cards = getDepartmentCardData(mockDepartments);
    assert.equal(cards[0].departmentId, "CNTT");
    assert.equal(cards[0].departmentName, "Khoa Cong nghe thong tin");
    assert.equal(cards[0].leadName, "TS. Nguyen Ngoc Vinh");
    assert.equal(cards[0].averageProgressPercent, 72);
    assert.equal(cards[0].overdueTasksCount, 2);
    assert.equal(cards[0].blockedTasksCount, 1);
  });

  test("getDepartmentCardData assigns emerald color when progress >= 80%", () => {
    const cards = getDepartmentCardData(mockDepartments);
    // DAO_TAO has 92% progress
    assert.equal(cards[1].progressColor, "bg-emerald-500");
  });

  test("getDepartmentCardData assigns amber color when progress 50-79%", () => {
    const cards = getDepartmentCardData(mockDepartments);
    // CNTT has 72% progress
    assert.equal(cards[0].progressColor, "bg-amber-500");
  });

  test("getDepartmentCardData assigns rose color when progress < 50%", () => {
    const cards = getDepartmentCardData(mockDepartments);
    // HANH_CHINH has 38% progress
    assert.equal(cards[2].progressColor, "bg-rose-500");
  });

  test("getDepartmentCardData boundary: exactly 50% gets amber", () => {
    const boundary: DepartmentHealthSummary[] = [
      {

        departmentName: "Test Dept",
        leadName: "Test Lead",
        totalTasksCount: 4,
        completedTasksCount: 2,
        inProgressTasksCount: 2,
        blockedTasksCount: 0,
        overdueTasksCount: 0,
        averageProgressPercent: 50,
      },
    ];
    const cards = getDepartmentCardData(boundary);
    assert.equal(cards[0].progressColor, "bg-amber-500");
  });

  test("getDepartmentCardData boundary: exactly 80% gets emerald", () => {
    const boundary: DepartmentHealthSummary[] = [
      {

        departmentName: "Test Dept",
        leadName: "Test Lead",
        totalTasksCount: 5,
        completedTasksCount: 4,
        inProgressTasksCount: 1,
        blockedTasksCount: 0,
        overdueTasksCount: 0,
        averageProgressPercent: 80,
      },
    ];
    const cards = getDepartmentCardData(boundary);
    assert.equal(cards[0].progressColor, "bg-emerald-500");
  });

  test("department card data contains zero emojis", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const cards = getDepartmentCardData(mockDepartments);
    for (const card of cards) {
      assert.ok(!emojiRegex.test(card.departmentName), `Emoji found in dept name: ${card.departmentName}`);
      assert.ok(!emojiRegex.test(card.leadName), `Emoji found in lead name: ${card.leadName}`);
    }
  });

  test("getDepartmentCardData handles empty array", () => {
    const cards = getDepartmentCardData([]);
    assert.equal(cards.length, 0);
  });
});

// -- DepartmentProgressMatrix navigation & sorting -----------------------

describe("DepartmentProgressMatrix Navigation & Sorting", () => {
  const mockDepts: DepartmentHealthSummary[] = [
    {

      departmentName: "Khoa CNTT",
      leadName: "Trưởng khoa CNTT",
      totalTasksCount: 20,
      completedTasksCount: 18,
      inProgressTasksCount: 2,
      overdueTasksCount: 0,
      blockedTasksCount: 0,
      averageProgressPercent: 90,
    },
    {

      departmentName: "Phòng QT-CSVC",
      leadName: "Trưởng phòng QTCSVC",
      totalTasksCount: 15,
      completedTasksCount: 5,
      inProgressTasksCount: 7,
      overdueTasksCount: 3,
      blockedTasksCount: 0,
      averageProgressPercent: 45,
    },
    {

      departmentName: "Phòng Đào tạo",
      leadName: "Trưởng phòng ĐT",
      totalTasksCount: 25,
      completedTasksCount: 15,
      inProgressTasksCount: 9,
      overdueTasksCount: 1,
      blockedTasksCount: 0,
      averageProgressPercent: 72,
    },
  ];

  test("generates direct link to /tasks?scope=school&dept=...", () => {
    const url = getDepartmentTasksUrl("K-CNTT");
    assert.equal(url, "/tasks?scope=school&dept=K-CNTT");
  });

  test("sorts departments by progress accurately", () => {
    const sorted = sortDepartmentsByProgress(mockDepts, true);
    assert.equal(sorted[0].departmentId, "K-CNTT"); // 90%
    assert.equal(sorted[1].departmentId, "P-DT"); // 72%
    assert.equal(sorted[2].departmentId, "QTCSVC"); // 45%
  });

  test("sorts departments by overdue tasks accurately", () => {
    const sorted = sortDepartmentsByOverdue(mockDepts, true);
    assert.equal(sorted[0].departmentId, "QTCSVC"); // 3 overdue
    assert.equal(sorted[1].departmentId, "P-DT"); // 1 overdue
    assert.equal(sorted[2].departmentId, "K-CNTT"); // 0 overdue
  });
});

// -- ExecutiveActionCenter rendering -------------------------------------

describe("ExecutiveActionCenter rendering", () => {
  // The empty-state contract is asserted against the RENDERED output: an empty
  // queue must say it is empty and must never claim health.
  test("renders an honest empty state (no false healthy claim)", () => {
    const html = renderCenter({ items: [] });
    assert.ok(html.includes("Không có nhiệm vụ cần xử lý"), "must render the honest empty heading");
    for (const claim of ["Verified Clear", "thông suốt", "Operational Clear", "ổn định"]) {
      assert.equal(html.includes(claim), false, `must not claim "${claim}"`);
    }
  });

  test("shows a 5-row preview with full counts and a working drill-down", () => {
    // Scale case: the 311-row fixture must render exactly 5 preview rows.
    const large = buildLargeFixture();
    const items = extractExecutiveActionItems(large.tasks, FIXTURE_REFERENCE_DATE);
    const html = renderCenter({ items });

    const rowCount = (html.match(/data-slot="action-item-row"/g) || []).length;
    assert.equal(rowCount, 5, `preview must render exactly 5 rows (got ${rowCount})`);

    // The total count is the full filtered set, not the preview length.
    assert.ok(html.includes("311 nhiệm vụ"), "header must show the full count");
    assert.ok(html.includes("Xem tất cả 311 nhiệm vụ"), "drill-down must name the full count");

    // The drill-down target is a query key the /tasks parser really consumes.
    const href = html.match(/href="([^"]*\/tasks\?[^"]*)"/)?.[1] ?? "";
    assert.ok(href.startsWith("/tasks?"), `drill-down must target /tasks (got "${href}")`);
    assert.equal(/[?&]filter=/.test(href), false, "must not use the dead `filter` key");

    // No expand-all control and no nested scroll region.
    assert.equal(html.includes("Xem thêm"), false, "no expand-all control");
    assert.equal(html.includes("Thu gọn danh sách"), false, "no expand-all control");
    assert.equal(html.includes("max-h-[460px]"), false, "no nested scroll region");
  });

  test("carries a clear operational queue heading", () => {
    const html = renderCenter();
    assert.ok(html.includes("Hàng đợi điều hành"), "Action queue must carry a clear operational heading");
  });

  test("renders lens filters as real buttons", () => {
    const html = renderCenter({ items: [item(1)] });
    assert.ok(html.includes('type="button"'), "lens filters must be real buttons");
  });

  test("rows keep an accessible action button and no destructive variant", () => {
    const html = renderCenter({ items: [item(1)] });
    assert.ok(html.includes('data-slot="action-item-row"'), "row must render");
    assert.match(
      html,
      /min-h-\[44px\] sm:min-h-\[36px\]/,
      "the row action button must meet the touch target"
    );
    // Overdue rows use a neutral action to open the file, never a destructive button.
    assert.equal(/variant="destructive"/.test(html), false, "no destructive button on a row");
  });
});

// -- Compact widgets ------------------------------------------------------

describe("Compact Widgets (Deadlines & Activity)", () => {
  test("parseDateOnly extracts year, month, day correctly", () => {
    const result = parseDateOnly("2026-09-15T00:00:00.000Z");
    assert.equal(result.year, 2026);
    assert.equal(result.month, 8); // 0-indexed month for September
    assert.equal(result.day, 15);
  });

  test("getActorInitials handles Vietnamese and single names cleanly", () => {
    assert.equal(getActorInitials("Nguyễn Văn A"), "NA");
    assert.equal(getActorInitials("Quản trị"), "QT");
    assert.equal(getActorInitials("Huy"), "HU");
    assert.equal(getActorInitials(""), "QC");
  });
});
