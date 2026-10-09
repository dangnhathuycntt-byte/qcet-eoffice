/**
 * Lịch sử trình duyệt, URL và dấu entry của Quick View (SPEC §6.3).
 * Hàm thuần: không gọi `history` trực tiếp; trả về thao tác cần thực hiện.
 */
export const PANE_HISTORY_MARK = "__qcetDocPane";

export interface PaneParams {
  docId: string | null;
  file: string | null;
}

export function parsePaneParams(search: string | URLSearchParams): PaneParams {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const docId = params.get("docId")?.trim() || null;
  const file = docId ? params.get("file")?.trim() || null : null;
  return { docId, file };
}

/** Ghi `docId`/`file` vào query hiện tại, giữ nguyên mọi tham số khác (bộ lọc, trang…). */
export function buildPaneSearch(search: string | URLSearchParams, next: Partial<PaneParams>): string {
  const params = new URLSearchParams(typeof search === "string" ? search : search.toString());
  if ("docId" in next) {
    if (next.docId) params.set("docId", next.docId);
    else {
      params.delete("docId");
      params.delete("file");
    }
  }
  if ("file" in next) {
    if (next.file && params.get("docId")) params.set("file", next.file);
    else params.delete("file");
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export type PaneEvent =
  | { type: "open"; docId: string; file?: string | null }
  | { type: "switch-doc"; docId: string }
  | { type: "switch-file"; file: string }
  | { type: "close" };

export interface PaneContext {
  /** Query hiện tại (không gồm dấu "?"). */
  search: string;
  /** Entry hiện tại do pane tạo ra (đi từ danh sách vào), không phải deep link. */
  hasPaneMark: boolean;
}

export type PaneHistoryPlan =
  | { op: "push" | "replace"; search: string; mark: boolean }
  | { op: "back" }
  | { op: "none" };

export function planPaneHistory(event: PaneEvent, ctx: PaneContext): PaneHistoryPlan {
  const current = parsePaneParams(ctx.search);
  switch (event.type) {
    case "open": {
      if (current.docId === event.docId && (event.file ?? null) === current.file) return { op: "none" };
      // Đã có pane mở: đổi văn bản là replace; chưa mở: push và đánh dấu
      const search = buildPaneSearch(ctx.search, { docId: event.docId, file: event.file ?? null });
      return current.docId
        ? { op: "replace", search, mark: ctx.hasPaneMark }
        : { op: "push", search, mark: true };
    }
    case "switch-doc": {
      if (current.docId === event.docId) return { op: "none" };
      return { op: "replace", search: buildPaneSearch(ctx.search, { docId: event.docId, file: null }), mark: ctx.hasPaneMark };
    }
    case "switch-file": {
      if (!current.docId || current.file === event.file) return { op: "none" };
      return { op: "replace", search: buildPaneSearch(ctx.search, { file: event.file }), mark: ctx.hasPaneMark };
    }
    case "close": {
      if (!current.docId) return { op: "none" };
      if (ctx.hasPaneMark) return { op: "back" };
      return { op: "replace", search: buildPaneSearch(ctx.search, { docId: null }), mark: false };
    }
  }
}
