import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyProgressResult,
  applySubtaskStatusToAggregates,
  computeProgressFromSubtasks,
  resolveSubtaskAggregates,
} from "../src/components/tasks/detail/task-detail-state";

describe("Cập nhật tiến độ: áp kết quả từ server", () => {
  it("lấy status và version mới từ server, không suy đoán ở client", () => {
    const task = { id: "t1", status: "IN_PROGRESS", progressPercent: 40, progress: 40, version: 3 };
    const next = applyProgressResult(task, { status: "IN_PROGRESS", progressPercent: 0, version: 4 });
    assert.equal(next.status, "IN_PROGRESS", "0% không được đưa về NOT_STARTED nếu server giữ IN_PROGRESS");
    assert.equal(next.progressPercent, 0);
    assert.equal(next.progress, 0);
    assert.equal(next.version, 4, "version phải tăng theo server để lần sửa sau không bị 412");
  });

  it("giữ nguyên status và version khi response không có các trường đó", () => {
    const task = { status: "WAITING_APPROVAL", version: 7 };
    const next = applyProgressResult(task, { progressPercent: 50 });
    assert.equal(next.status, "WAITING_APPROVAL");
    assert.equal(next.version, 7);
  });

  it("không đổi object gốc", () => {
    const task = { status: "NEW", version: 1 };
    applyProgressResult(task, { status: "IN_PROGRESS", progressPercent: 10, version: 2 });
    assert.equal(task.status, "NEW");
    assert.equal(task.version, 1);
  });
});

describe("Tổng hợp việc con", () => {
  it("ưu tiên số thô của server khi việc con bị ẩn quyền", () => {
    const visible = [{ status: "COMPLETED" }];
    const { total, completed } = resolveSubtaskAggregates({
      subTasks: visible,
      totalSubTasks: 4,
      completedSubTasks: 2,
    });
    assert.equal(total, 4);
    assert.equal(completed, 2);
    assert.equal(computeProgressFromSubtasks(total, completed), 50);
  });

  it("fallback về danh sách đã lọc khi thiếu số liệu thô", () => {
    const { total, completed } = resolveSubtaskAggregates({
      subTasks: [{ status: "COMPLETED" }, { status: "IN_PROGRESS" }],
    });
    assert.equal(total, 2);
    assert.equal(completed, 1);
  });

  it("không chia cho 0 khi không có việc con", () => {
    assert.equal(computeProgressFromSubtasks(0, 0), 0);
  });
});

describe("Đổi trạng thái việc con: dịch chuyển số thô", () => {
  it("tăng khi việc con chuyển sang COMPLETED", () => {
    const next = applySubtaskStatusToAggregates({ completedSubTasks: 1 }, "IN_PROGRESS", "COMPLETED");
    assert.equal(next.completedSubTasks, 2);
  });

  it("giảm khi việc con rời khỏi COMPLETED, không xuống dưới 0", () => {
    assert.equal(applySubtaskStatusToAggregates({ completedSubTasks: 1 }, "COMPLETED", "IN_PROGRESS").completedSubTasks, 0);
    assert.equal(applySubtaskStatusToAggregates({ completedSubTasks: 0 }, "COMPLETED", "NEW").completedSubTasks, 0);
  });

  it("giữ nguyên khi không đổi vào/ra COMPLETED", () => {
    const parent = { completedSubTasks: 3 };
    assert.equal(applySubtaskStatusToAggregates(parent, "NEW", "IN_PROGRESS"), parent);
  });

  it("không tạo số liệu khi server không gửi số thô", () => {
    const parent = { completedSubTasks: undefined };
    assert.equal(applySubtaskStatusToAggregates(parent, "NEW", "COMPLETED").completedSubTasks, undefined);
  });
});

describe("Hợp đồng source của trang chi tiết", () => {
  const pageSource = readFileSync("src/components/tasks/task-detail-page.tsx", "utf8");

  it("không còn phím Space điều khiển inspector", () => {
    assert.ok(!pageSource.includes('e.code === "Space"'), "phím Space phải được bỏ");
    assert.ok(!pageSource.includes("isDialogOpen"), "helper chỉ phục vụ Space phải được bỏ");
  });

  it("rollback dùng snapshot đồng bộ, không ghi biến qua updater", () => {
    assert.ok(!/previousTask = prev;/.test(pageSource));
    assert.ok(!/previousDeliverables = prev;/.test(pageSource));
  });

  it("sidebar thuộc tính: loại người phụ trách khỏi Phối hợp, không có chevron trang trí", () => {
    const sidebar = readFileSync("src/components/tasks/detail/task-properties-sidebar.tsx", "utf8");
    assert.ok(sidebar.includes("const collaborators = React.useMemo"), "collaborators phải là danh sách đã lọc");
    assert.ok(sidebar.includes("leadKeys.has("), "phải loại người phụ trách khỏi Phối hợp");
    assert.ok(!sidebar.includes("ChevronDown"), "chevron không có hành vi thu gọn nên phải bỏ");
  });

  it("người phụ trách dùng màu foreground và ô icon 16px để căn mép chữ", () => {
    const controls = readFileSync("src/components/tasks/detail/task-property-controls.tsx", "utf8");
    assert.ok(!controls.includes('propertyTriggerVariants({ variant: "muted" })'));
    assert.ok(controls.includes("flex size-4 shrink-0 items-center justify-center"));
  });

  it("hàng việc con không cao hơn 32px và ngày trễ hạn không in đậm", () => {
    const section = readFileSync("src/components/tasks/detail/task-subtasks-sidebar-section.tsx", "utf8");
    assert.ok(section.includes("min-h-8") && !section.includes("min-h-9"));
    assert.ok(!section.includes("text-destructive font-medium"));
  });

  it("không còn nút thu gọn cột thuộc tính và phím Cmd+I", () => {
    assert.ok(!pageSource.includes("onToggleInspector={handleToggleInspector}"), "header/split layout không được nhận nút thu gọn");
    assert.ok(!pageSource.includes("handleToggleInspector"), "không còn handler thu gọn");
    assert.ok(!pageSource.includes('e.key.toLowerCase() === "i"'), "phím Cmd+I đã bỏ");
    assert.ok(pageSource.includes("const showInspector = !activeSubtask;"), "cột thuộc tính chỉ ẩn khi drawer việc con mở");
  });

  it("việc con chỉ hiện trong cột thuộc tính, không có khối dự phòng ở nội dung chính", () => {
    assert.ok(!pageSource.includes("{!showInspector && ("), "khối dự phòng đã gỡ");
    assert.ok(!pageSource.includes("<TaskSubtasksSidebarSection"), "trang chi tiết không render danh sách trực tiếp");
  });

  it("lead name không phụ thuộc isSchool heuristic", () => {
    assert.ok(pageSource.includes("(task as any).leadAssigneeName || (task as any).assigneeName"));
  });
});
