"use client";

import { toast } from "sonner";
import { createPendingAction, type PendingAction, type PendingActionOptions } from "@/lib/pending-action";

/**
 * Xóa có Hoàn tác thay cho hộp xác nhận (nghiên cứu 23/10/2026: NN/g, Material, Marigold; Linear dùng ⌘Z và mục "Recently deleted",
 * Asana toast Hoàn tác 10–15 giây): thao tác lặp lại nhiều, một mục, kết quả hiện ngay trước mắt, hoãn vài giây không ảnh hưởng
 * ai khác. Không dùng cho việc đã báo cho người khác, việc hàng loạt hay việc không thể hoãn (vẫn `DestructiveConfirmDialog`).
 * Không dùng cả hai: xác nhận rồi lại Hoàn tác chỉ dạy người dùng bấm qua hộp thoại.
 *
 * Giao diện ẩn kết quả ngay; yêu cầu thật đi khi toast đóng mà không ai hoàn tác (`commit` do vòng đời toast kích hoạt, không
 * có đồng hồ riêng: sonner dừng đếm khi rê chuột vào, đồng hồ riêng sẽ chốt xóa ngay dưới nút Hoàn tác). Không có nút ✕ cạnh
 * "Hoàn tác": ✕ nghĩa là chốt xóa, người dùng dễ hiểu thành "tắt thông báo". Ngoài ra chốt ngay khi rời trang (`pagehide`, yêu
 * cầu `keepalive`), nên đóng tab trong cửa sổ không làm mất việc đã báo xong; còn trình duyệt chết giữa chừng thì mục còn nguyên.
 *
 * ⌘Z / Ctrl+Z hoàn tác thao tác gần nhất đang chờ (bỏ qua khi con trỏ ở ô nhập: ⌘Z là của trình soạn). Chỉ có một lần hoàn tác
 * cho mỗi thao tác, không có ngăn xếp nhiều bước như Linear.
 */

export const UNDO_WINDOW_MS = 8000;
const UNDO_LABEL = "Hoàn tác";

export interface UndoToastInput extends PendingActionOptions {
  /** Câu báo đã làm gì, nêu đúng mục ("Đã xóa ghi chú “…”"); "Xong" không giúp người bấm nhầm hàng. */
  message: string;
  windowMs?: number;
}

interface PendingEntry {
  id: string;
  action: PendingAction;
}

const pending = new Set<PendingEntry>();
let sequence = 0;
let listening = false;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

function undoEntry(entry: PendingEntry) {
  pending.delete(entry);
  entry.action.undo();
  toast.dismiss(entry.id);
  stopListening();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.shiftKey || event.altKey || !(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() !== "z" || isEditableTarget(event.target)) return;
  const latest = [...pending].at(-1);
  if (!latest) return;
  event.preventDefault();
  undoEntry(latest);
}

function onPageHide() {
  for (const entry of [...pending]) {
    pending.delete(entry);
    void entry.action.commit(true);
  }
}

function startListening() {
  if (listening) return;
  listening = true;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pagehide", onPageHide);
}

function stopListening() {
  if (!listening || pending.size > 0) return;
  listening = false;
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("pagehide", onPageHide);
}

/** Ẩn kết quả ở nơi gọi trước khi gọi hàm này; `restore` đưa về chỗ cũ, `commit` gửi yêu cầu thật sau cửa sổ Hoàn tác. */
export function showUndoToast({ message, windowMs = UNDO_WINDOW_MS, ...options }: UndoToastInput): void {
  const entry: PendingEntry = { id: `undo:${++sequence}`, action: createPendingAction(options) };
  pending.add(entry);
  startListening();

  const commit = () => {
    pending.delete(entry);
    void entry.action.commit(false);
    stopListening();
  };

  toast.success(message, {
    id: entry.id,
    duration: windowMs,
    closeButton: false,
    action: { label: UNDO_LABEL, onClick: () => undoEntry(entry) },
    onAutoClose: commit,
    onDismiss: commit,
  });
}
