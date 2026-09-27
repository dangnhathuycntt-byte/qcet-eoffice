import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActiveFilterBreadcrumb,
  getStatusDisplayLabel,
  getPriorityDisplayLabel,
  getCategoryDisplayLabel,
  getHealthDisplayLabel,
  getOriginDisplayLabel,
} from "../src/components/workspace/components/active-filter-breadcrumb";
import { filterDisplayedTasks } from "../src/components/workspace/unified-adaptive-workspace";
import type { SchoolTask } from "../src/types/dashboard";

describe("Multi-Select Filter Enhancements", () => {
  test("combines multiple status values into Vietnamese labels", () => {
    const label = getStatusDisplayLabel("IN_PROGRESS,COMPLETED");
    assert.equal(label, "Đang thực hiện, Hoàn thành");

    const threeStatus = getStatusDisplayLabel("NEW,IN_PROGRESS,WAITING_APPROVAL");
    assert.equal(threeStatus, "Mới, Đang thực hiện, Chờ duyệt");
  });

  test("combines multiple priority values into Vietnamese labels", () => {
    const label = getPriorityDisplayLabel("URGENT,HIGH");
    assert.equal(label, "Khẩn cấp, Ưu tiên cao");
  });

  test("combines multiple category values into Vietnamese labels", () => {
    const label = getCategoryDisplayLabel("CNTT,ATTT");
    assert.equal(label, "Công nghệ thông tin, An toàn thông tin");
  });

  test("combines multiple health and origin values into Vietnamese labels", () => {
    const healthLabel = getHealthDisplayLabel("on_track,at_risk");
    assert.equal(healthLabel, "Đúng tiến độ, Nguy cơ trễ");

    const originLabel = getOriginDisplayLabel("KE_HOACH_NAM,NGHI_QUYET");
    assert.equal(originLabel, "Kế hoạch năm, Nghị quyết BGH");
  });

  test("renders multi-select chips in ActiveFilterBreadcrumb correctly", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        status: "IN_PROGRESS,COMPLETED",
        priority: "URGENT,HIGH",
        category: "CNTT,ATTT",
      })
    );

    assert.ok(html.includes("Đang thực hiện, Hoàn thành"));
    assert.ok(html.includes("Khẩn cấp, Ưu tiên cao"));
    assert.ok(html.includes("Công nghệ thông tin, An toàn thông tin"));
  });

  test("filterDisplayedTasks supports multi-status filtering", () => {
    const mockTasks: SchoolTask[] = [
      { id: "1", title: "Task 1", status: "IN_PROGRESS" } as any,
      { id: "2", title: "Task 2", status: "COMPLETED" } as any,
      { id: "3", title: "Task 3", status: "NEW" } as any,
      { id: "4", title: "Task 4", status: "CANCELLED" } as any,
    ];

    const filtered = filterDisplayedTasks({
      tasks: mockTasks,
      status: "IN_PROGRESS,COMPLETED",
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, "1");
    assert.equal(filtered[1].id, "2");
  });

  test("filterDisplayedTasks supports multi-priority filtering", () => {
    const mockTasks: SchoolTask[] = [
      { id: "1", title: "Task 1", priority: "URGENT" } as any,
      { id: "2", title: "Task 2", priority: "HIGH" } as any,
      { id: "3", title: "Task 3", priority: "NORMAL" } as any,
      { id: "4", title: "Task 4", priority: "LOW" } as any,
    ];

    const filtered = filterDisplayedTasks({
      tasks: mockTasks,
      priority: "URGENT,HIGH",
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, "1");
    assert.equal(filtered[1].id, "2");
  });
});
