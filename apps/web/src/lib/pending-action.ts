/**
 * Thao tác đang chờ trong cửa sổ Hoàn tác: giao diện đã ẩn kết quả (xóa dòng), yêu cầu thật chỉ đi khi cửa sổ đóng mà không ai
 * hoàn tác. Tách khỏi giao diện toast để kiểm được thứ tự: chỉ chốt một lần, hoàn tác thì không chốt, chốt lỗi thì đưa dòng
 * về lại và báo (đừng để danh sách im lặng "mọc lại" mà người dùng không biết vì sao).
 */
export type PendingActionState = "pending" | "committed" | "undone";

export interface PendingActionOptions {
  /** Gửi yêu cầu thật. `keepalive` là lúc người dùng rời trang: yêu cầu phải đi tiếp sau khi trang đóng. */
  commit: (context: { keepalive: boolean }) => Promise<void> | void;
  /** Đưa kết quả đã ẩn về chỗ cũ (hoàn tác, hoặc chốt không thành công). */
  restore: () => void;
  /** Chốt không thành công: nơi gọi báo lỗi cho người dùng. */
  onError?: (error: unknown) => void;
}

export interface PendingAction {
  readonly state: PendingActionState;
  undo: () => void;
  commit: (keepalive?: boolean) => Promise<void>;
}

export function createPendingAction(options: PendingActionOptions): PendingAction {
  let state: PendingActionState = "pending";
  return {
    get state() {
      return state;
    },
    undo() {
      if (state !== "pending") return;
      state = "undone";
      options.restore();
    },
    async commit(keepalive = false) {
      if (state !== "pending") return;
      state = "committed";
      try {
        await options.commit({ keepalive });
      } catch (error) {
        options.restore();
        options.onError?.(error);
      }
    },
  };
}
