import * as React from "react";
import { showUndoToast } from "@/components/ui/undo-toast";
import { deleteTask } from "@/lib/tasks/task-actions";

/**
 * Xóa (lưu trữ) nhiệm vụ có Hoàn tác thay cho hộp xác nhận (người dùng hỏi "nút undo ở đâu" sau khi xóa 1 nhiệm vụ, 23/10/2026).
 * Không có API khôi phục, và việc lưu trữ báo cho người liên quan rồi gỡ liên kết văn bản, nên không gửi ngay: ẩn nhiệm vụ khỏi
 * danh sách, giữ yêu cầu `archive` đến khi toast Hoàn tác đóng (`showUndoToast`). Hoàn tác thì chưa có gì xảy ra ở máy chủ, nên
 * không ai bị báo nhầm. Chốt lỗi hoặc xung đột phiên bản thì nhiệm vụ hiện lại kèm thông báo.
 */

const EMPTY: ReadonlySet<string> = new Set();
let hiddenIds: ReadonlySet<string> = EMPTY;
const listeners = new Set<() => void>();

function setHidden(next: ReadonlySet<string>) {
  hiddenIds = next.size === 0 ? EMPTY : next;
  listeners.forEach((listener) => listener());
}

function hide(ids: string[]) {
  setHidden(new Set([...hiddenIds, ...ids]));
}

function release(ids: string[]) {
  const next = new Set(hiddenIds);
  for (const id of ids) next.delete(id);
  setHidden(next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Nhiệm vụ đã ẩn khỏi danh sách nhưng chưa gửi lưu trữ (còn trong cửa sổ Hoàn tác). */
export function useHiddenTaskIds(): ReadonlySet<string> {
  return React.useSyncExternalStore(subscribe, () => hiddenIds, () => EMPTY);
}

type WithSubTasks = { id: string; subTasks?: WithSubTasks[] };

/** Bỏ nhiệm vụ đang chờ lưu trữ (kể cả việc con) khỏi danh sách; trả nguyên mảng khi không có gì để bỏ. */
export function withoutHiddenTasks<T extends { id: string }>(tasks: T[], hidden: ReadonlySet<string>): T[] {
  if (hidden.size === 0) return tasks;
  let changed = false;
  const result: T[] = [];
  for (const task of tasks) {
    if (hidden.has(task.id)) {
      changed = true;
      continue;
    }
    const nested = (task as T & WithSubTasks).subTasks;
    const subTasks = nested ? withoutHiddenTasks(nested, hidden) : nested;
    if (subTasks !== nested) {
      changed = true;
      result.push({ ...task, subTasks });
    } else {
      result.push(task);
    }
  }
  return changed ? result : tasks;
}

export interface ArchiveTarget {
  id: string;
  version: number;
}

interface ArchiveFeedback {
  notifyError: (message: string) => void;
  notifyWarning: (message: string) => void;
}

export function archiveTasksWithUndo(targets: ArchiveTarget[], feedback: ArchiveFeedback, options: { onCommitted?: () => void } = {}): void {
  if (targets.length === 0) return;
  const ids = targets.map((target) => target.id);
  hide(ids);

  showUndoToast({
    message: targets.length === 1 ? "Đã lưu trữ 1 nhiệm vụ." : `Đã lưu trữ ${targets.length} nhiệm vụ.`,
    restore: () => release(ids),
    commit: async ({ keepalive }) => {
      const results = await Promise.all(
        targets.map(async (target) => ({ id: target.id, result: await deleteTask(target.id, target.version, undefined, { keepalive }) })),
      );
      const archived = results.filter((item) => item.result.ok).map((item) => item.id);
      const failed = results.filter((item) => !item.result.ok);

      // Máy chủ đã lưu trữ: gỡ khỏi danh sách thật trước rồi mới thôi ẩn, kẻo nhiệm vụ nháy hiện lại giữa hai bước
      if (typeof window !== "undefined") {
        for (const taskId of archived) window.dispatchEvent(new CustomEvent("qcet:task-archived", { detail: { taskId, optimistic: true } }));
        if (archived.length > 0) window.dispatchEvent(new CustomEvent("qcet:task-archived", { detail: { taskId: null, optimistic: false } }));
      }
      release(ids);
      if (archived.length > 0) options.onCommitted?.();

      if (failed.length > 0) {
        const reason = failed[0].result.error;
        if (archived.length === 0) feedback.notifyError(reason || "Không lưu trữ được nhiệm vụ");
        else feedback.notifyWarning(`Đã lưu trữ ${archived.length}, ${failed.length} nhiệm vụ không lưu trữ được${reason ? `: ${reason}` : ""}`);
      }
    },
    onError: (error) => {
      release(ids);
      feedback.notifyError(error instanceof Error ? error.message : "Không lưu trữ được nhiệm vụ");
    },
  });
}
