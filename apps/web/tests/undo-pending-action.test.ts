/**
 * Xóa có Hoàn tác (23/10/2026, người dùng: "web search cả việc undo"). `createPendingAction` giữ thứ tự: giao diện đã ẩn kết quả,
 * yêu cầu thật chỉ đi một lần khi cửa sổ đóng mà không ai hoàn tác, chốt lỗi thì đưa về chỗ cũ và báo. Phần giao diện toast
 * (`ui/undo-toast.ts`) và nơi dùng đọc từ mã nguồn.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPendingAction } from "../src/lib/pending-action";

function spy() {
  const calls: string[] = [];
  const errors: unknown[] = [];
  return {
    calls,
    errors,
    options: {
      commit: async ({ keepalive }: { keepalive: boolean }) => {
        calls.push(keepalive ? "commit:keepalive" : "commit");
      },
      restore: () => calls.push("restore"),
      onError: (error: unknown) => errors.push(error),
    },
  };
}

describe("createPendingAction", () => {
  it("chốt đúng một lần dù gọi nhiều lần (toast tự đóng và pagehide cùng chạy)", async () => {
    const { calls, options } = spy();
    const action = createPendingAction(options);
    await Promise.all([action.commit(), action.commit(true)]);
    assert.deepEqual(calls, ["commit"]);
    assert.equal(action.state, "committed");
  });

  it("hoàn tác thì không bao giờ chốt, và chỉ khôi phục một lần", async () => {
    const { calls, options } = spy();
    const action = createPendingAction(options);
    action.undo();
    action.undo();
    await action.commit();
    assert.deepEqual(calls, ["restore"]);
    assert.equal(action.state, "undone");
  });

  it("đã chốt thì hoàn tác không còn tác dụng (không khôi phục mục đã xóa thật)", async () => {
    const { calls, options } = spy();
    const action = createPendingAction(options);
    await action.commit();
    action.undo();
    assert.deepEqual(calls, ["commit"]);
  });

  it("truyền keepalive cho lúc rời trang", async () => {
    const { calls, options } = spy();
    await createPendingAction(options).commit(true);
    assert.deepEqual(calls, ["commit:keepalive"]);
  });

  it("chốt lỗi thì đưa mục về lại rồi báo lỗi, không im lặng", async () => {
    const failure = new Error("503");
    const calls: string[] = [];
    const errors: unknown[] = [];
    const action = createPendingAction({
      commit: () => {
        calls.push("commit");
        throw failure;
      },
      restore: () => calls.push("restore"),
      onError: (error) => errors.push(error),
    });
    await action.commit();
    assert.deepEqual(calls, ["commit", "restore"]);
    assert.deepEqual(errors, [failure]);
  });
});

describe("toast Hoàn tác", () => {
  const toastSource = readFileSync("src/components/ui/undo-toast.ts", "utf8");

  it("chốt bằng vòng đời toast, không đồng hồ riêng, và không có nút ✕ cạnh Hoàn tác", () => {
    assert.match(toastSource, /onAutoClose: commit/);
    assert.match(toastSource, /onDismiss: commit/);
    assert.match(toastSource, /closeButton: false/);
    assert.ok(!/setTimeout/.test(toastSource), "sonner dừng đếm khi rê chuột; đồng hồ riêng sẽ chốt xóa dưới nút Hoàn tác");
  });

  it("⌘Z / Ctrl+Z hoàn tác nhưng nhường ô nhập; rời trang thì chốt với keepalive", () => {
    assert.match(toastSource, /event\.key\.toLowerCase\(\) !== "z"/);
    assert.match(toastSource, /isEditableTarget\(event\.target\)/);
    assert.match(toastSource, /"pagehide"/);
    assert.match(toastSource, /commit\(true\)/);
  });

  it("nơi dùng: Ghi chú thay hộp xác nhận bằng Hoàn tác; ⌘Z có trong bảng phím tắt", () => {
    const notes = readFileSync("src/components/notes/notes-view.tsx", "utf8");
    assert.match(notes, /showUndoToast\(/);
    assert.ok(!/DestructiveConfirmDialog/.test(notes), "Hoàn tác thay xác nhận, không dùng cả hai");
    const shortcuts = readFileSync("src/components/layout/global-shortcuts-modal.tsx", "utf8");
    assert.match(shortcuts, /Hoàn tác/);
  });
});
