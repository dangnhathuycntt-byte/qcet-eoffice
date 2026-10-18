import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getStatusDisplay } from "@qcet/shared/domain/tasks/display-config";
import { normalizeDisplayStatus } from "@qcet/shared/domain/tasks/canonical-semantics";
import { getDueIndicator, getSlaBadgeStatus } from "../src/components/tasks/table/utils/table-date-helpers";

// Dialog render qua portal nên kiểm tra nguồn dữ liệu của peek preview và các hàm nó dùng.
const source = fs.readFileSync(path.resolve(process.cwd(), "src/components/tasks/preview/task-peek-preview-modal.tsx"), "utf-8");

describe("peek preview hiển thị đúng dữ liệu", () => {
  test("nhãn trạng thái dùng chung với danh sách: Đã hủy không thành Chưa bắt đầu", () => {
    assert.ok(source.includes("getStatusDisplay(normalizeDisplayStatus(task.status)).label"));
    assert.equal(getStatusDisplay(normalizeDisplayStatus("CANCELLED")).label, "Đã hủy");
    assert.equal(getStatusDisplay(normalizeDisplayStatus("NOT_STARTED")).label, "Mới");
  });

  test("thiếu đơn vị thì ghi rõ, không tự điền Ban Giám hiệu/Tổ chuyên môn", () => {
    assert.ok(!source.includes('"Ban Giám hiệu"'));
    assert.ok(!source.includes('"Tổ chuyên môn"'));
  });

  test("hạn tính như hàng trong danh sách: đã hoàn thành thì không báo trễ", () => {
    assert.ok(source.includes('dueIndicator.icon !== "closed"'));
    const indicator = (status: string) => {
      const sla = getSlaBadgeStatus("2026-10-01", status, "2026-10-13");
      return getDueIndicator({ status, isOverdue: sla.isOverdue, isToday: sla.isToday, daysRemaining: sla.daysRemaining, label: sla.label });
    };
    assert.equal(indicator("COMPLETED").icon, "closed");
    assert.equal(indicator("IN_PROGRESS").tone, "danger");
    assert.match(indicator("IN_PROGRESS").hint, /Trễ 12 ngày/);
  });
});
