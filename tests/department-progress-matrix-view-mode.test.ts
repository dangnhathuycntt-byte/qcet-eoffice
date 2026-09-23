import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DepartmentProgressMatrix,
  sortDepartmentsByOverdue,
  sortDepartmentsByProgress,
  getDepartmentCardData,
  type DepartmentMatrixViewMode,
} from "../src/components/dashboard/department-progress-matrix";
import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";

const mockDepartments: DepartmentHealthSummary[] = [
  {

    departmentName: "Khoa Công nghệ thông tin",
    leadName: "TS. Nguyễn Ngọc Vịnh",
    totalTasksCount: 10,
    completedTasksCount: 7,
    inProgressTasksCount: 3,
    blockedTasksCount: 0,
    overdueTasksCount: 0,
    averageProgressPercent: 78,
  },
  {

    departmentName: "Khoa Điện - Điện tử",
    leadName: "ThS. Trần Văn Ba",
    totalTasksCount: 12,
    completedTasksCount: 4,
    inProgressTasksCount: 5,
    blockedTasksCount: 2,
    overdueTasksCount: 3,
    averageProgressPercent: 45,
  },
  {

    departmentName: "Khoa Cơ khí động lực",
    leadName: "TS. Lê Hoàng",
    totalTasksCount: 8,
    completedTasksCount: 6,
    inProgressTasksCount: 1,
    blockedTasksCount: 1,
    overdueTasksCount: 1,
    averageProgressPercent: 75,
  },
];

describe("DepartmentProgressMatrix View Mode & Compact Table Engine", () => {
  test("sortDepartmentsByOverdue sorts by overdue count descending", () => {
    const sorted = sortDepartmentsByOverdue(mockDepartments);
    assert.equal(sorted[0].departmentId, "DIEN", "Highest overdue (3) must come first");
    assert.equal(sorted[1].departmentId, "CO_KHI", "Middle overdue (1) must come second");
    assert.equal(sorted[2].departmentId, "CNTT", "Zero overdue (0) must come last");
  });

  test("sortDepartmentsByOverdue supports ascending order when requested", () => {
    const sorted = sortDepartmentsByOverdue(mockDepartments, false);
    assert.equal(sorted[0].departmentId, "CNTT", "Zero overdue (0) must come first in ascending sort");
    assert.equal(sorted[2].departmentId, "DIEN", "Highest overdue (3) must come last in ascending sort");
  });

  test("sortDepartmentsByOverdue handles legacy field names (overdueTasks)", () => {
    const legacyDepts: DepartmentHealthSummary[] = [
      {

        departmentName: "Phòng A",
        leadName: "Lãnh đạo A",
        totalTasksCount: 5,
        completedTasksCount: 5,
        inProgressTasksCount: 0,
        blockedTasksCount: 0,
        overdueTasksCount: 0,
        averageProgressPercent: 100,
        overdueTasks: 0,
      },
      {

        departmentName: "Phòng B",
        leadName: "Lãnh đạo B",
        totalTasksCount: 5,
        completedTasksCount: 2,
        inProgressTasksCount: 2,
        blockedTasksCount: 1,
        overdueTasksCount: 0,
        averageProgressPercent: 40,
        overdueTasks: 2,
      },
    ];

    const sorted = sortDepartmentsByOverdue(legacyDepts);
    assert.equal(sorted[0].departmentId, "DEPT_B");
    assert.equal(sorted[1].departmentId, "DEPT_A");
  });

  test("renders in cards view by default with density toggle buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentProgressMatrix, {
        departments: mockDepartments,
        selectedDepartment: "ALL",
        onSelectDepartment: () => {},
      })
    );

    assert.match(html, /data-slot="department-progress-matrix"/, "Must render cards container");
    assert.match(html, /data-mode="cards"/, "Must have cards view toggle button");
    assert.match(html, /data-mode="compact_table"/, "Must have compact table toggle button");
    assert.match(html, /Khoa Công nghệ thông tin/);
  });

  test("renders in compact_table mode when defaultViewMode is compact_table", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentProgressMatrix, {
        departments: mockDepartments,
        selectedDepartment: "ALL",
        onSelectDepartment: () => {},
        defaultViewMode: "compact_table",
      })
    );

    assert.match(html, /<table/i, "Must render a table in compact_table mode");
    assert.match(html, /data-slot="department-progress-matrix-table"/, "Must have table data-slot");
    assert.match(html, /Đơn vị/, "Must have Đơn vị column");
    assert.match(html, /Tiến độ/, "Must have Tiến độ column");
    assert.match(html, /Quá hạn/, "Must have Quá hạn column");
    assert.match(html, /Đang làm/, "Must have Đang làm column");
    assert.match(html, /Hoàn thành/, "Must have Hoàn thành column");
    assert.match(html, /Hành động|Xem/, "Must have Hành động (Xem) column or button");
  });

  test("compact_table mode supports both compact_table and table aliases", () => {
    const htmlTable = renderToStaticMarkup(
      React.createElement(DepartmentProgressMatrix, {
        departments: mockDepartments,
        selectedDepartment: "DIEN",
        onSelectDepartment: () => {},
        viewMode: "table" as DepartmentMatrixViewMode,
      })
    );

    assert.match(htmlTable, /data-slot="department-progress-matrix-table"/);
    assert.match(htmlTable, /aria-pressed="true"/, "Selected department DIEN must have aria-pressed=true");
  });

  test("sortDepartmentsByProgress sorts by averageProgressPercent descending", () => {
    const sorted = sortDepartmentsByProgress(mockDepartments, true);
    assert.equal(sorted[0].departmentId, "CNTT", "Highest progress (78%) must come first");
    assert.equal(sorted[1].departmentId, "CO_KHI", "Second highest progress (75%) must come second");
    assert.equal(sorted[2].departmentId, "DIEN", "Lowest progress (45%) must come last");
  });

  test("renders in ranking mode when defaultViewMode is ranking", () => {
    const htmlRanking = renderToStaticMarkup(
      React.createElement(DepartmentProgressMatrix, {
        departments: mockDepartments,
        selectedDepartment: "ALL",
        onSelectDepartment: () => {},
        defaultViewMode: "ranking",
      })
    );

    assert.match(htmlRanking, /data-slot="department-ranking-chart"/, "Must render ranking chart container");
    assert.match(htmlRanking, /data-slot="department-ranking-row"/, "Must render ranking rows");
    assert.match(htmlRanking, /data-mode="ranking"/, "Must have ranking view toggle button");
    assert.match(htmlRanking, /Xếp hạng/, "Must have Xếp hạng text");
  });

  test("renders active filter chip with clear button when department is selected", () => {
    const htmlSelected = renderToStaticMarkup(
      React.createElement(DepartmentProgressMatrix, {
        departments: mockDepartments,
        selectedDepartment: "CNTT",
        onSelectDepartment: () => {},
      })
    );

    assert.match(htmlSelected, /Đang lọc:\s*Khoa Công nghệ thông tin/, "Must display active department filter chip");
    assert.match(htmlSelected, /Bỏ chọn đơn vị/, "Must have clear filter button");
  });

});
