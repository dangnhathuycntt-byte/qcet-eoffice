import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";
import { updateTaskPriority, updateTaskStatus, remindTask } from "../src/lib/tasks/task-actions";
import {
  applyOptimisticStatusChange,
  revertOptimisticStatusChange,
} from "../src/components/workspace/utils/task-workspace-mutations";
import { filterTasks } from "../src/components/tasks/table/utils/table-filter-engine";
import { filterDisplayedTasks } from "../src/components/workspace/unified-adaptive-workspace";
import { isOpenTaskOverdue } from "../src/lib/workspace-metrics-aggregator";

const realFetch = globalThis.fetch;
function mockFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

describe("task-actions: đọc lỗi từ máy chủ", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("Problem Details (route update-status/approve) hiện đúng lý do, không còn câu chung chung", async () => {
    mockFetch(422, {
      success: false,
      type: "about:blank",
      title: "Unprocessable",
      status: 422,
      detail: "Chưa nộp minh chứng nên chưa thể gửi duyệt",
      code: "INVALID_TRANSITION",
    });
    const res = await updateTaskStatus("t1", "WAITING_APPROVAL", undefined, 3);
    assert.equal(res.ok, false);
    assert.equal(res.error, "Chưa nộp minh chứng nên chưa thể gửi duyệt");
    assert.equal(res.code, "INVALID_TRANSITION");
  });

  test("xung đột phiên bản (412) đổi sang câu tiếng Việt", async () => {
    mockFetch(412, { success: false, detail: "Task aggregate version conflict: expected version 3, current version 4", code: "PRECONDITION_FAILED" });
    const res = await updateTaskStatus("t1", "IN_PROGRESS", undefined, 3);
    assert.match(res.error ?? "", /vừa được cập nhật ở nơi khác/);
  });

  test("lỗi kiểu cũ { error: string } vẫn đọc được", async () => {
    mockFetch(403, { success: false, error: "Bạn không có quyền cập nhật nhiệm vụ này", code: "FORBIDDEN" });
    const res = await updateTaskPriority("t1", "HIGH");
    assert.equal(res.error, "Bạn không có quyền cập nhật nhiệm vụ này");
  });

  test("đôn đốc gọi action remind kèm expectedVersion (không còn gọi push/test)", async () => {
    const calls = mockFetch(200, { success: true, data: { taskId: "t1", version: 5 } });
    const res = await remindTask("t1", 4);
    assert.equal(res.ok, true);
    assert.equal(res.data?.version, 5);
    assert.equal(calls[0].url, "/api/tasks/t1/actions/remind");
    assert.deepEqual(calls[0].body, { expectedVersion: 4 });
  });
});

describe("đổi trạng thái lạc quan trên danh sách", () => {
  const tasks = [
    { id: "a", status: "IN_PROGRESS", progressPercent: 20, subTasks: [] },
    { id: "b", status: "NOT_STARTED", progressPercent: 0, subTasks: [] },
  ] as unknown as SchoolTask[];

  test("giữ đúng trạng thái được chọn (trước đây mọi trạng thái khác Hoàn thành đều thành Đang thực hiện)", () => {
    for (const status of ["WAITING_APPROVAL", "CANCELLED", "NOT_STARTED"] as const) {
      const next = applyOptimisticStatusChange(tasks, "a", status);
      assert.equal(next.find((t) => t.id === "a")?.status, status);
    }
  });

  test("hoàn tác chỉ trả về đúng nhiệm vụ lỗi, giữ thay đổi đang chờ của dòng khác (đổi hàng loạt)", () => {
    let state = applyOptimisticStatusChange(tasks, "a", "COMPLETED");
    state = applyOptimisticStatusChange(state, "b", "COMPLETED");
    state = revertOptimisticStatusChange(state, "a", { status: "IN_PROGRESS", progressPercent: 20 });
    const a = state.find((t) => t.id === "a");
    assert.equal(a?.status, "IN_PROGRESS");
    assert.equal(a?.progressPercent, 20);
    assert.equal(state.find((t) => t.id === "b")?.status, "COMPLETED");
  });
});

describe("nguồn dữ liệu và phiên bản", () => {
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");

  test("trang /tasks tải lại qua trang server (dữ liệu đầy đủ), không qua DTO rút gọn của API danh sách", () => {
    const source = read("src/app/tasks/tasks-page-client.tsx");
    assert.ok(source.includes("router.refresh()"));
    assert.ok(source.includes("onRefresh={handleRefresh}"));
  });

  test("trang chi tiết gửi version hiện tại (ref), không dùng version của lần render đầu", () => {
    const source = read("src/components/tasks/task-detail-page.tsx");
    assert.ok(!source.includes("updateTaskStatus(taskId, newStatus, note, (task as any).version)"));
    assert.ok(!source.includes("updateTaskPriority(taskId, newPriority, (task as any).version)"));
    for (const call of ["updateTaskStatus(", "updateTaskPriority("]) {
      const line = source.split("\n").find((l) => l.includes(`await ${call}`));
      assert.ok(line?.includes("taskVersionRef.current"), `${call} phải gửi taskVersionRef.current`);
    }
  });
});

describe("một định nghĩa Trễ hạn", () => {
  test("chỉ xét hạn của chính nhiệm vụ: việc con trễ không kéo việc cha vào Trễ hạn", () => {
    const ref = "2026-10-13";
    const cases = [
      { id: "1", status: "IN_PROGRESS", dueDate: "2026-10-01", subTasks: [] },
      { id: "2", status: "NOT_STARTED", dueDate: "2026-10-31", subTasks: [{ id: "s", status: "IN_PROGRESS", dueDate: "2026-09-27" }] },
      { id: "3", status: "NOT_STARTED", dueDate: "2026-10-31", subTasks: [{ id: "s", status: "COMPLETED", dueDate: "2026-09-27" }] },
      { id: "4", status: "COMPLETED", dueDate: "2026-09-01", subTasks: [] },
      { id: "5", status: "IN_PROGRESS", isOverdue: true, dueDate: "2026-12-01", subTasks: [] },
      { id: "6", status: "IN_PROGRESS", subTasks: [] },
    ] as unknown as SchoolTask[];
    assert.deepEqual(cases.filter((t) => isOpenTaskOverdue(t, ref)).map((t) => t.id), ["1", "5"]);
  });
});

describe("thao tác lỗi luôn được báo", () => {
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");

  test("menu chuột phải không nuốt lỗi của handler hay API", () => {
    const source = read("src/components/tasks/table/task-context-menu.tsx");
    assert.ok(source.includes("const runEdit = async"));
    assert.ok(!/await updateTask(Status|Priority|Assignee|DueDate)\(task\.id/.test(source), "mọi lệnh gọi API đi qua runEdit");
  });

  test("đổi trạng thái hàng loạt gom một thông báo và giữ chọn dòng lỗi", () => {
    const source = read("src/components/tasks/table/modular-cascading-task-table.tsx");
    assert.ok(source.includes("onStatusChange(id, newStatus, undefined, { silent: true })"));
    assert.ok(source.includes("tableState.deselectMultiple(ids.filter((id) => !failedIds.includes(id)))"));
  });
});

describe("tìm kiếm không phân biệt dấu", () => {
  const tasks = [
    { id: "a", title: "Nhiệm vụ đào tạo", leadAssigneeName: "Đặng Nhật Huy", status: "IN_PROGRESS", subTasks: [] },
    { id: "b", title: "Báo cáo tháng", leadAssigneeName: "Phạm Văn Tường", status: "IN_PROGRESS", subTasks: [] },
  ] as unknown as SchoolTask[];

  test("bảng: gõ không dấu vẫn ra kết quả có dấu", () => {
    assert.deepEqual(filterTasks(tasks, { searchQuery: "nhiem vu dao" }).map((t) => t.id), ["a"]);
    assert.deepEqual(filterTasks(tasks, { searchQuery: "dang nhat" }).map((t) => t.id), ["a"]);
  });

  test("trang /tasks (workspace): gõ không dấu vẫn ra kết quả có dấu", () => {
    assert.deepEqual(filterDisplayedTasks({ tasks, search: "bao cao" } as never).map((t) => t.id), ["b"]);
    assert.deepEqual(filterDisplayedTasks({ tasks, search: "pham van tuong" } as never).map((t) => t.id), ["b"]);
  });
});

describe("trang chi tiết đồng bộ version sau thao tác làm server tăng version", () => {
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
  test("lưu tiêu đề dùng version hiện tại; việc con/minh chứng lấy lại version từ server", () => {
    const source = read("src/components/tasks/task-detail-page.tsx");
    assert.ok(source.includes("body: JSON.stringify({ title: newTitle, expectedVersion: taskVersionRef.current })"));
    assert.equal((source.match(/void syncTaskMetaFromServer\(\)/g) ?? []).length, 3, "việc con, nộp và xóa minh chứng");
  });
});

describe("hộp tiến độ không hiện dữ liệu bịa", () => {
  test("100% không ghi Hoàn thành, không có Hôm nay hay câu mô tả tự chế", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { TaskProgressComposer } = await import("../src/components/tasks/detail/task-progress-composer");
    const html = renderToStaticMarkup(
      React.createElement(TaskProgressComposer, { taskId: "t1", initialProgress: 100, taskStatus: "WAITING_APPROVAL" })
    );
    assert.ok(html.includes("Tiến độ 100%"));
    for (const text of ["Hoàn thành", "Hôm nay", "Nhiệm vụ đã hoàn thành toàn bộ"]) {
      assert.ok(!html.includes(text), text);
    }
  });
});

describe("bảng đang nhóm: bàn phím và chọn dải theo đúng thứ tự hàng đang hiện", () => {
  test("J/K, Shift+click, peek trước/sau dùng visibleRows (bỏ nhóm thu gọn), không dùng danh sách chưa nhóm", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/components/tasks/table/modular-cascading-task-table.tsx"), "utf-8");
    assert.ok(source.includes("groupedTasks.filter((group) => toggledGroupKeys.has(group.key)).flatMap((group) => group.tasks)"));
    assert.ok(source.includes("items: visibleRows,"));
    assert.ok(source.includes("const rangeIds = visibleRows.slice(start, end + 1)"));
    assert.ok(!source.includes("keyboardNav.activeIndex === index ||\n                                task.id === selectedTaskId"), "hàng trong nhóm không dùng chỉ số riêng của nhóm");
  });

  test("gia hạn hàng loạt cộng vào hạn hiện tại của từng nhiệm vụ, không tính từ hôm nay", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/components/tasks/table/modular-cascading-task-table.tsx"), "utf-8");
    assert.ok(source.includes("handleContextMenuDueDateChange(id, calculateExtendedDeadline(days, base), { silent: true })"));
    // Lỗi từng dòng phải ném ra (không nuốt) để tổng hợp không báo thành công giả
    const workspace = fs.readFileSync(path.resolve(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx"), "utf-8");
    assert.ok(workspace.includes("if (options?.silent) throw new Error(res.error || failureMessage);"));
  });

  test("mốc Shift+click theo id, không lệch khi thu/mở nhóm", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/components/tasks/table/modular-cascading-task-table.tsx"), "utf-8");
    assert.ok(source.includes("visibleRows.findIndex((t) => t.id === lastClickedIdRef.current)"));
    assert.ok(!source.includes("lastClickedIndexRef"));
  });
});

describe("trang chi tiết và drawer việc con: quyền ngày và đồng bộ version", () => {
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
  test("bỏ phản hồi đồng bộ đến muộn (version cũ hơn hoặc nhiệm vụ khác)", () => {
    const source = read("src/components/tasks/task-detail-page.tsx");
    assert.ok(source.includes("prev.id !== requestedId || (typeof prevVersion === \"number\" && dto.version < prevVersion)"));
  });

  test("drawer: ngày bắt đầu theo task.update_metadata, hạn chót theo task.assign (như máy chủ)", () => {
    const source = read("src/components/tasks/detail/subtask-detail-drawer.tsx");
    assert.ok(source.includes("onStartDateChange={canEditContent ? handleStartDateChange : undefined}"));
    assert.ok(source.includes("onDueDateChange={canChangeDueDate ? handleDueDateChange : undefined}"));
  });
});
