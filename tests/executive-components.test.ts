import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getActionCardData,
  type ExecutiveFilter,
} from "../src/components/dashboard/executive-action-center";
import {
  getDepartmentCardData,
} from "../src/components/dashboard/department-progress-matrix";
import type { ExecutiveActionStats, DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";

// -- Test data -----------------------------------------------------------

const mockStats: ExecutiveActionStats = {
  pendingSchoolApprovalCount: 7,
  blockedTasksCount: 3,
  overdueTasksCount: 2,
  strategicActiveCount: 12,
};

const mockDepartments: DepartmentHealthSummary[] = [
  {
    departmentId: "CNTT",
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
    departmentId: "DAO_TAO",
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
    departmentId: "HANH_CHINH",
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

// -- ExecutiveActionCenter tests -----------------------------------------

describe("ExecutiveActionCenter", () => {
  test("getActionCardData returns 3 cards with correct values", () => {
    const cards = getActionCardData(mockStats);
    assert.equal(cards.length, 3);
    assert.equal(cards[0].value, 7);  // pendingSchoolApprovalCount
    assert.equal(cards[1].value, 5);  // blocked(3) + overdue(2)
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
    assert.equal(cards[0].title, "Cho BGH Phe duyet");
    assert.equal(cards[1].title, "Vuong mac & Tre han");
    assert.equal(cards[2].title, "Nhiem vu Chien luoc");
  });

  test("action card titles and values contain zero emojis", () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
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

// -- DepartmentProgressMatrix tests --------------------------------------

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
    const boundary: DepartmentHealthSummary[] = [{
      departmentId: "TEST",
      departmentName: "Test Dept",
      leadName: "Test Lead",
      totalTasksCount: 4,
      completedTasksCount: 2,
      inProgressTasksCount: 2,
      blockedTasksCount: 0,
      overdueTasksCount: 0,
      averageProgressPercent: 50,
    }];
    const cards = getDepartmentCardData(boundary);
    assert.equal(cards[0].progressColor, "bg-amber-500");
  });

  test("getDepartmentCardData boundary: exactly 80% gets emerald", () => {
    const boundary: DepartmentHealthSummary[] = [{
      departmentId: "TEST",
      departmentName: "Test Dept",
      leadName: "Test Lead",
      totalTasksCount: 5,
      completedTasksCount: 4,
      inProgressTasksCount: 1,
      blockedTasksCount: 0,
      overdueTasksCount: 0,
      averageProgressPercent: 80,
    }];
    const cards = getDepartmentCardData(boundary);
    assert.equal(cards[0].progressColor, "bg-emerald-500");
  });

  test("department card data contains zero emojis", () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
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

// -- Source file anti-slop audit -----------------------------------------

describe("Executive component source files anti-slop audit", () => {
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  const componentFiles = [
    path.join(process.cwd(), "src/components/dashboard/executive-action-center.tsx"),
    path.join(process.cwd(), "src/components/dashboard/department-progress-matrix.tsx"),
  ];

  test("zero emojis in executive-action-center.tsx source", () => {
    const content = fs.readFileSync(componentFiles[0], "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      assert.ok(!emojiRegex.test(lines[i]),
        `Emoji found at line ${i + 1} in executive-action-center.tsx: ${lines[i].trim()}`);
    }
  });

  test("zero emojis in department-progress-matrix.tsx source", () => {
    const content = fs.readFileSync(componentFiles[1], "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      assert.ok(!emojiRegex.test(lines[i]),
        `Emoji found at line ${i + 1} in department-progress-matrix.tsx: ${lines[i].trim()}`);
    }
  });

  test("components use strokeWidth={1.5} for Lucide icons", () => {
    for (const file of componentFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Must contain strokeWidth={1.5} if it uses any icon
      if (content.includes("lucide-react")) {
        assert.ok(content.includes("strokeWidth={1.5}"),
          `Missing strokeWidth={1.5} in ${path.basename(file)}`);
      }
    }
  });

  test("components use font-mono tabular-nums for numeric displays", () => {
    for (const file of componentFiles) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(content.includes("font-mono") && content.includes("tabular-nums"),
        `Missing font-mono tabular-nums in ${path.basename(file)}`);
    }
  });

  test("components use 'use client' directive", () => {
    for (const file of componentFiles) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(content.trimStart().startsWith('"use client"'),
        `Missing "use client" directive at top of ${path.basename(file)}`);
    }
  });
});
