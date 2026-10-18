import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskDeliverables, toTaskDeliverableItems } from "../src/components/tasks/detail/task-deliverables";
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from "@qcet/shared/lib/adapters/task-db-adapter";

const rawTask = {
  id: "t1",
  code: "NV-1",
  title: "Nhiệm vụ",
  status: "WAITING_APPROVAL",
  priority: "NORMAL",
  scope: "SCHOOL",
  dueDate: "2026-10-20T00:00:00.000Z",
  actors: [],
  deliverables: [
    { id: "d1", title: "Báo cáo tổng kết", fileUrl: "https://drive.example.edu.vn/a", reviewStatus: "PENDING", createdAt: "2026-10-10T03:00:00.000Z" },
    { id: "d2", title: "Biên bản", fileUrl: "https://drive.example.edu.vn/b", reviewStatus: "REVISION_REQUIRED" },
  ],
} as never;

describe("minh chứng trên trang chi tiết nhiệm vụ", () => {
  test("cả hai mapper đều mang minh chứng, không tự điền loại tệp hay ngày nộp", () => {
    for (const mapped of [mapPrismaTaskToSchoolTask(rawTask), mapPrismaTaskToStaffTask(rawTask)]) {
      const items = toTaskDeliverableItems((mapped as { deliverables?: unknown }).deliverables);
      assert.deepEqual(items.map((d) => [d.id, d.title, d.fileUrl, d.reviewStatus]), [
        ["d1", "Báo cáo tổng kết", "https://drive.example.edu.vn/a", "PENDING"],
        ["d2", "Biên bản", "https://drive.example.edu.vn/b", "REVISION_REQUIRED"],
      ]);
      assert.ok(items[0].createdAt);
      assert.equal(items[1].createdAt, undefined, "thiếu ngày thì để trống, không lấy hôm nay");
    }
    const staff = mapPrismaTaskToStaffTask(rawTask);
    assert.equal(staff.deliverables?.[0].fileType, undefined, "không còn gán cứng application/pdf");
  });

  test("người duyệt xem được minh chứng; không có quyền thì không có nút thêm/xóa", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskDeliverables, {
        deliverables: toTaskDeliverableItems(mapPrismaTaskToSchoolTask(rawTask).deliverables),
        canSubmit: false,
        canDelete: false,
        onAdd: async () => {},
        onDelete: () => {},
      })
    );
    assert.ok(html.includes("Báo cáo tổng kết"));
    assert.ok(html.includes('href="https://drive.example.edu.vn/a"'));
    assert.ok(html.includes("Chờ duyệt"));
    assert.ok(html.includes("Cần làm lại"));
    assert.ok(!html.includes("Xóa minh chứng"));
    assert.ok(!html.includes(">Thêm<"));
  });

  test("chưa có minh chứng và không được nộp thì không hiện gì", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskDeliverables, { deliverables: [], canSubmit: false, canDelete: false, onAdd: async () => {}, onDelete: () => {} })
    );
    assert.equal(html, "");
  });

  test("trang chi tiết gắn quyền như API deliverables", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/components/tasks/task-detail-page.tsx"), "utf-8");
    assert.ok(source.includes('canSubmit={hasTaskAction("task.submit_result")}'));
    assert.ok(source.includes('canDelete={hasTaskAction("task.update_execution")}'));
  });
});
