"use client";

import * as React from "react";

/**
 * Cột tin bám đáy khi đang ở đáy (chữ trả lời tới dần); người dùng kéo lên đọc thì không bị kéo xuống. Dùng chung cho
 * trang Trợ lý và khung chat nổi.
 *
 * @param thread đổi khi có tin mới hay chữ mới
 * @param activeId mở cuộc khác thì luôn bắt đầu từ đáy
 * @param listMounted cột tin vừa gắn vào cây (màn đầu → đang chat): gắn lại bộ theo dõi chiều cao
 */
export function useStickToBottom(thread: unknown, activeId: string | null, listMounted: boolean) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const stickToBottomRef = React.useRef(true);

  React.useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [thread]);

  // Chữ hiện dần làm cột tin cao lên mà thread không đổi: theo dõi chiều cao để vẫn bám đáy
  React.useEffect(() => {
    const el = listRef.current;
    const content = el?.firstElementChild;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [listMounted]);

  React.useEffect(() => {
    stickToBottomRef.current = true;
  }, [activeId]);

  const onScroll = React.useCallback(() => {
    const el = listRef.current;
    if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  return { listRef, stickToBottomRef, onScroll };
}
