"use client";

import * as React from "react";
import {
  INITIAL_DETAIL_STATE,
  detailReducer,
  fetchDocumentDetail,
  type DetailState,
} from "@/lib/documents/document-detail-client";

export interface UseDocumentDetailReturn {
  state: DetailState;
  /** Tải lại chi tiết văn bản đang mở (sau thao tác workflow), giữ dữ liệu cũ trong lúc tải. */
  refresh: () => void;
}

/**
 * Một instance dùng cho cả Quick View và Full Page: tải theo `docId`, hủy yêu cầu cũ khi đổi văn bản,
 * chỉ commit kết quả khớp văn bản hiện tại.
 */
export function useDocumentDetail(docId: string | null): UseDocumentDetailReturn {
  const [state, dispatch] = React.useReducer(detailReducer, INITIAL_DETAIL_STATE);
  const [revision, setRevision] = React.useState(0);
  const lastRevision = React.useRef(0);

  React.useEffect(() => {
    dispatch({ type: "select", docId });
    if (!docId) return;
    if (revision !== lastRevision.current) {
      lastRevision.current = revision;
      dispatch({ type: "refresh", docId });
    }
    const controller = new AbortController();
    fetchDocumentDetail(docId, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) dispatch({ type: "result", docId, result });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [docId, revision]);

  const refresh = React.useCallback(() => setRevision((n) => n + 1), []);
  return { state, refresh };
}
