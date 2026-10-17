"use client";

import * as React from "react";
import type { AssistantConversationSummaryDTO, AssistantContextRef } from "@/contracts/assistant";
import {
  AssistantRequestError,
  deleteConversationRequest,
  listConversationsRequest,
  renameConversationRequest,
} from "@/components/assistant/assistant-client";
import { appendUniqueById } from "@/components/assistant/assistant-model";

const LIST_ERROR_MESSAGE = "Chưa tải được lịch sử.";

export type HistoryStatus = "loading" | "ready" | "error";

/**
 * Lời báo lỗi tải lịch sử: lỗi 4xx giữ câu của máy chủ; 5xx hoặc lỗi mạng dùng câu chung,
 * không đưa chuỗi thô của máy chủ (như "Internal server error") ra popover.
 */
export function listErrorText(error: unknown): string {
  return error instanceof AssistantRequestError && error.status < 500 ? error.message : LIST_ERROR_MESSAGE;
}

/** Danh sách lịch sử: phân trang bằng con trỏ, nhóm "Về mục này" nếu mở từ một mục. */
export function useAssistantHistory(context: AssistantContextRef | null) {
  const [items, setItems] = React.useState<AssistantConversationSummaryDTO[]>([]);
  const [status, setStatus] = React.useState<HistoryStatus>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [moreError, setMoreError] = React.useState<string | null>(null);
  const [contextItems, setContextItems] = React.useState<AssistantConversationSummaryDTO[]>([]);
  // Chỉ kết quả của lần tải mới nhất được ghi vào state (làm mới liên tiếp không đè kết quả mới bằng kết quả cũ)
  const requestSeq = React.useRef(0);
  // Đã "Tải thêm" từ lần tải hẳn gần nhất: làm mới lặng lẽ giữ con trỏ của trang đã tải tới
  const loadedMoreRef = React.useRef(false);
  const contextType = context?.type ?? null;
  const contextId = context?.id ?? null;

  const loadFirstPage = React.useCallback(async (silent: boolean) => {
    const mine = ++requestSeq.current;
    if (!silent) {
      // Thử lại: bỏ câu lỗi cũ để không nằm cạnh skeleton
      setStatus("loading");
      setError(null);
    }
    try {
      const page = await listConversationsRequest({});
      if (mine !== requestSeq.current) return;
      if (silent) {
        // Làm mới lặng lẽ (mở menu, xong một lượt): trang đầu lên trước, giữ các cuộc đã "Tải thêm" và con trỏ trang sau,
        // kẻo mở lại menu thì danh sách co về 30 cuộc và cuộc đang mở ở trang sau mất chữ "Hiện tại"
        setItems((prev) => appendUniqueById(page.items, prev));
        if (!loadedMoreRef.current) setNextCursor(page.nextCursor);
      } else {
        loadedMoreRef.current = false;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      }
      setError(null);
      setMoreError(null);
      setStatus("ready");
    } catch (err) {
      if (mine !== requestSeq.current) return;
      setError(listErrorText(err));
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    void loadFirstPage(false);
  }, [loadFirstPage]);

  React.useEffect(() => {
    if (!contextType || !contextId) {
      setContextItems([]);
      return;
    }
    let alive = true;
    listConversationsRequest({ contextType, contextId })
      .then((page) => alive && setContextItems(page.items))
      .catch(() => alive && setContextItems([]));
    return () => {
      alive = false;
    };
  }, [contextType, contextId]);

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    // Trang tiếp theo thuộc danh sách lúc bấm: làm mới trong lúc chờ thì bỏ trang này
    const seqAtStart = requestSeq.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listConversationsRequest({ cursor: nextCursor });
      if (seqAtStart !== requestSeq.current) return;
      setItems((prev) => appendUniqueById(prev, page.items));
      loadedMoreRef.current = true;
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (seqAtStart !== requestSeq.current) return;
      setMoreError(listErrorText(err));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  /** Làm mới sau mỗi lượt trả lời, không báo "đang tải": trang đầu và nhóm "Về mục này" (nếu có). */
  const refresh = React.useCallback(async () => {
    await loadFirstPage(true);
    if (!contextType || !contextId) return;
    try {
      const page = await listConversationsRequest({ contextType, contextId });
      setContextItems(page.items);
    } catch {
      // Giữ nhóm cũ nếu tải lại lỗi; lần sau sẽ làm mới
    }
  }, [loadFirstPage, contextType, contextId]);

  /**
   * Đưa hội thoại lên đầu (vừa tạo hoặc vừa có tin mới), thay bản cũ nếu có. Hội thoại thuộc đúng mục đang mở
   * thì cũng vào nhóm "Về mục này" ngay, không đợi làm mới.
   */
  const upsert = React.useCallback(
    (summary: AssistantConversationSummaryDTO) => {
      setItems((prev) => [summary, ...prev.filter((item) => item.id !== summary.id)]);
      const belongsToContext = Boolean(contextType && contextId) && summary.contextType === contextType && summary.contextId === contextId;
      setContextItems((prev) =>
        belongsToContext ? [summary, ...prev.filter((item) => item.id !== summary.id)] : prev.map((item) => (item.id === summary.id ? summary : item)),
      );
    },
    [contextType, contextId],
  );

  const rename = React.useCallback(async (id: string, title: string) => {
    const updated = await renameConversationRequest(id, title);
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    setContextItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    return updated;
  }, []);

  const remove = React.useCallback(async (id: string) => {
    await deleteConversationRequest(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setContextItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    items,
    contextItems,
    status,
    error,
    hasMore: Boolean(nextCursor),
    loadingMore,
    moreError,
    loadMore,
    retry: () => loadFirstPage(false),
    refresh,
    upsert,
    rename,
    remove,
  };
}
