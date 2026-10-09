"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PANE_HISTORY_MARK,
  parsePaneParams,
  planPaneHistory,
  type PaneEvent,
  type PaneHistoryPlan,
} from "@/lib/documents/document-pane-history";

export interface UseDocumentPaneReturn {
  docId: string | null;
  fileId: string | null;
  open: (docId: string, fileId?: string | null) => void;
  switchDocument: (docId: string) => void;
  selectFile: (fileId: string) => void;
  close: () => void;
}

const hasMark = () => {
  try {
    return (window.history.state as Record<string, unknown> | null)?.[PANE_HISTORY_MARK] === true;
  } catch {
    return false;
  }
};

function apply(plan: PaneHistoryPlan, pathname: string) {
  if (plan.op === "none") return;
  if (plan.op === "back") {
    window.history.back();
    return;
  }
  const url = `${pathname}${plan.search}`;
  // Chỉ truyền cờ của pane: Next tự chép state nội bộ (`__NA`, cây router) vào state mới khi vá pushState/replaceState.
  // Không tự chép `__NA`: Next coi đó là lời gọi nội bộ và sẽ không cập nhật router/useSearchParams.
  const state = { [PANE_HISTORY_MARK]: plan.mark };
  if (plan.op === "push") window.history.pushState(state, "", url);
  else window.history.replaceState(state, "", url);
}

/**
 * Trạng thái Quick View nằm trên URL (`docId`, `file`); mọi thay đổi đi qua `planPaneHistory`
 * (mở = push, đổi văn bản/tệp = replace, đóng = back hoặc replace). URL là nguồn sự thật:
 * Back/Forward/làm mới đều cho ra cùng trạng thái.
 */
export function useDocumentPane(): UseDocumentPaneReturn {
  const pathname = usePathname() || "/documents";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const { docId, file } = React.useMemo(() => parsePaneParams(search), [search]);

  const dispatch = React.useCallback(
    (event: PaneEvent) => {
      // Đọc query thực tế tại thời điểm thao tác, không dùng snapshot của lần render trước
      const live = window.location.search.replace(/^\?/, "");
      apply(planPaneHistory(event, { search: live, hasPaneMark: hasMark() }), pathname);
    },
    [pathname],
  );

  return {
    docId,
    fileId: file,
    open: React.useCallback((id, fileId) => dispatch({ type: "open", docId: id, file: fileId ?? null }), [dispatch]),
    switchDocument: React.useCallback((id) => dispatch({ type: "switch-doc", docId: id }), [dispatch]),
    selectFile: React.useCallback((fileId) => dispatch({ type: "switch-file", file: fileId }), [dispatch]),
    close: React.useCallback(() => dispatch({ type: "close" }), [dispatch]),
  };
}
