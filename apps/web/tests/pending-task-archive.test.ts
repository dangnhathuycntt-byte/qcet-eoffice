/**
 * Xóa nhiệm vụ có Hoàn tác (23/10/2026, người dùng xóa một nhiệm vụ và hỏi "nút undo ở đâu"). Lưu trữ nhiệm vụ báo cho người
 * liên quan và gỡ liên kết văn bản nên không có API khôi phục: giao diện ẩn nhiệm vụ, yêu cầu `archive` giữ đến khi toast Hoàn tác
 * đóng. Kiểm trên trình duyệt (menu chuột phải và thanh chọn hàng loạt, chặn ghi): ẩn ngay, không hộp xác nhận, Hoàn tác bằng
 * nút hoặc Ctrl+Z thì không có yêu cầu nào, hết 8 giây thì đúng một yêu cầu.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withoutHiddenTasks } from "../src/lib/tasks/pending-task-archive";

const task = (id: string, subTasks?: Array<{ id: string; subTasks?: unknown[] }>) => ({ id, subTasks });

describe("withoutHiddenTasks", () => {
  it("không có gì ẩn thì trả nguyên mảng (không tạo tham chiếu mới, khỏi vẽ lại)", () => {
    const list = [task("a"), task("b")];
    assert.equal(withoutHiddenTasks(list, new Set()), list);
    assert.equal(withoutHiddenTasks(list, new Set(["zzz"])), list);
  });

  it("bỏ nhiệm vụ đang chờ lưu trữ và giữ thứ tự các nhiệm vụ còn lại", () => {
    const result = withoutHiddenTasks([task("a"), task("b"), task("c")], new Set(["b"]));
    assert.deepEqual(result.map((t) => t.id), ["a", "c"]);
  });

  it("bỏ cả việc con nằm trong nhiệm vụ cha mà không đổi các nhánh khác", () => {
    const untouched = task("p2", [{ id: "s3" }]);
    const result = withoutHiddenTasks([task("p1", [{ id: "s1" }, { id: "s2" }]), untouched], new Set(["s1"]));
    assert.deepEqual((result[0].subTasks as Array<{ id: string }>).map((t) => t.id), ["s2"]);
    assert.equal(result[1], untouched);
  });
});

describe("nối Hoàn tác vào xóa nhiệm vụ", () => {
  const archive = readFileSync("src/lib/tasks/pending-task-archive.ts", "utf8");
  const contextMenu = readFileSync("src/components/tasks/table/task-context-menu.tsx", "utf8");
  const table = readFileSync("src/components/tasks/table/modular-cascading-task-table.tsx", "utf8");
  const workspace = readFileSync("src/components/workspace/unified-adaptive-workspace.tsx", "utf8");

  it("menu chuột phải và thanh chọn hàng loạt dùng archiveTasksWithUndo, không còn hộp xác nhận", () => {
    assert.match(contextMenu, /archiveTasksWithUndo\(/);
    assert.match(table, /archiveTasksWithUndo\(/);
    assert.ok(!/DestructiveConfirmDialog|confirmAction\(/.test(contextMenu + table), "Hoàn tác thay xác nhận, không dùng cả hai");
  });

  it("chỉ gửi lưu trữ lúc chốt (toast đóng), không gửi khi bấm xóa", () => {
    const hideIdx = archive.indexOf("hide(ids)");
    const toastIdx = archive.indexOf("showUndoToast(");
    const sendIdx = archive.indexOf("deleteTask(");
    assert.ok(hideIdx > 0 && toastIdx > hideIdx, "ẩn trước khi hiện toast");
    assert.ok(sendIdx > toastIdx, "lời gọi archive nằm trong commit của toast");
    assert.match(archive, /restore: \(\) => release\(ids\)/);
    assert.match(archive, /\{ keepalive \}/, "rời trang thì chốt với keepalive");
  });

  it("danh sách và số đếm của khu làm việc đều bỏ nhiệm vụ đang chờ", () => {
    assert.match(workspace, /withoutHiddenTasks\(controlledTasks !== undefined \? controlledTasks : internalTasks, hiddenTaskIds\)/);
  });

  it("chốt xong thì gỡ khỏi danh sách thật trước khi thôi ẩn (không nháy hiện lại)", () => {
    const optimistic = archive.indexOf("optimistic: true");
    const releaseAfter = archive.indexOf("release(ids);", optimistic);
    assert.ok(optimistic > 0 && releaseAfter > optimistic);
  });
});
