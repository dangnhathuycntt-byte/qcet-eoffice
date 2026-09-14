import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatDepartmentLabel,
  resolveDepartment,
  matchesDepartmentSearch,
  DEPARTMENT_TIERS,
} from "../src/components/layout/scope-switcher";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("ScopeSwitcher Ergonomics & Zero-Hardcode Suite", () => {
  test("formatDepartmentLabel outputs clean non-truncating labels", () => {
    const cntt = QCET_DEPARTMENTS.find((d) => d.code === "K_CNTT");
    assert.ok(cntt);
    const label = formatDepartmentLabel(cntt);
    assert.strictEqual(label, "Khoa Công nghệ thông tin");
  });

  test("DEPARTMENT_TIERS correctly partitions all 16 non-BGH operational units", () => {
    const standardDepartments = QCET_DEPARTMENTS.filter(
      (dept) => dept.code !== "BGH" && dept.category !== "BGH"
    );
    assert.strictEqual(
      standardDepartments.length,
      16,
      "There must be exactly 16 subordinate operational units excluding BGH"
    );

    const partitioned = DEPARTMENT_TIERS.map((tier) => {
      const depts = standardDepartments.filter((d) => d.category === tier.category);
      return {
        category: tier.category,
        label: tier.label,
        count: depts.length,
        departments: depts,
      };
    });

    const khoaTier = partitioned.find((t) => t.category === "KHOA_CHUYEN_MON");
    const phongTier = partitioned.find((t) => t.category === "PHONG_CHUC_NANG");
    const ttTier = partitioned.find((t) => t.category === "TRUNG_TAM");

    assert.ok(khoaTier, "Khoa chuyên môn tier must exist");
    assert.strictEqual(khoaTier.count, 9, "Khoa chuyên môn must contain exactly 9 units");

    assert.ok(phongTier, "Phòng chức năng tier must exist");
    assert.strictEqual(phongTier.count, 5, "Phòng chức năng must contain exactly 5 units");

    assert.ok(ttTier, "Trung tâm tier must exist");
    assert.strictEqual(ttTier.count, 2, "Trung tâm must contain exactly 2 units");

    const totalPartitioned = partitioned.reduce((sum, t) => sum + t.count, 0);
    assert.strictEqual(
      totalPartitioned,
      16,
      "The 3 tiers must partition all 16 units without overlap or omissions"
    );

    // Ensure every standard department belongs to exactly one tier
    const allPartitionedIds = partitioned.flatMap((t) => t.departments.map((d) => d.id));
    const uniqueIds = new Set(allPartitionedIds);
    assert.strictEqual(uniqueIds.size, 16, "All 16 partitioned department IDs must be unique");
  });

  test("matchesDepartmentSearch correctly matches unaccented queries (cntt, dao tao, dien)", () => {
    const standardDepartments = QCET_DEPARTMENTS.filter(
      (dept) => dept.code !== "BGH" && dept.category !== "BGH"
    );

    // Empty query matches all departments
    const allMatches = standardDepartments.filter((d) => matchesDepartmentSearch(d, ""));
    assert.strictEqual(allMatches.length, 16, "Empty query must match all 16 departments");

    // 'cntt' query matches Khoa Công nghệ thông tin
    const cnttMatches = standardDepartments.filter((d) => matchesDepartmentSearch(d, "cntt"));
    assert.ok(cnttMatches.length >= 1, "Query 'cntt' must find at least one match");
    assert.ok(
      cnttMatches.some((d) => d.code === "K_CNTT"),
      "Query 'cntt' must match K_CNTT"
    );

    // 'dao tao' query matches Phòng Đào tạo & Quản lý khoa học
    const daoTaoMatches = standardDepartments.filter((d) => matchesDepartmentSearch(d, "dao tao"));
    assert.ok(daoTaoMatches.length >= 1, "Query 'dao tao' must find at least one match");
    assert.ok(
      daoTaoMatches.some((d) => d.code === "P_DTQLKH" || d.name.includes("Đào tạo")),
      "Query 'dao tao' must match đào tạo department"
    );

    // 'dien' query matches Khoa Điện - Điện tử
    const dienMatches = standardDepartments.filter((d) => matchesDepartmentSearch(d, "dien"));
    assert.ok(dienMatches.length >= 1, "Query 'dien' must find at least one match");
    assert.ok(
      dienMatches.some((d) => d.code === "K_DDT" || d.name.includes("Điện")),
      "Query 'dien' must match Khoa Điện"
    );

    // Non-existent search query returns 0 matches
    const noMatches = standardDepartments.filter((d) =>
      matchesDepartmentSearch(d, "xyz-khong-ton-tai-123")
    );
    assert.strictEqual(noMatches.length, 0, "Nonsense query must yield 0 matches");
  });
});
