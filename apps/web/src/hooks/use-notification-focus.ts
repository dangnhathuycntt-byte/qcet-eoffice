"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { NOTIFICATION_COMMENT_PARAM, NOTIFICATION_FOCUS_PARAM } from "@/lib/notification-inbox";

/** Khối đích có thể vẽ sau (bình luận, minh chứng tải riêng): chờ khối đúng một lúc rồi mới tô khối dự phòng. */
const PREFERRED_WAIT_MS = 2500;
const GIVE_UP_MS = 6000;
const POLL_MS = 100;

/** Chỉ một vùng được tô tại một thời điểm; mở thông báo khác thì bỏ vùng cũ. */
let clearActive: (() => void) | null = null;

function highlight(el: HTMLElement) {
  clearActive?.();
  el.setAttribute("data-notification-highlight", "");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  // Như Notion: vùng giữ màu tới khi người dùng bấm hoặc gõ phím
  const clear = () => {
    el.removeAttribute("data-notification-highlight");
    document.removeEventListener("pointerdown", clear, true);
    document.removeEventListener("keydown", clear, true);
    if (clearActive === clear) clearActive = null;
  };
  document.addEventListener("pointerdown", clear, true);
  document.addEventListener("keydown", clear, true);
  clearActive = clear;
}

/** Bỏ tham số tô sáng khỏi URL sau khi dùng: tải lại hay đổi tab không tô lại, đường dẫn chia sẻ gọn. */
function stripFocusParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete(NOTIFICATION_FOCUS_PARAM);
  url.searchParams.delete(NOTIFICATION_COMMENT_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function selectorFor(key: string): string {
  return `[data-notification-focus="${CSS.escape(key)}"]`;
}

/**
 * Mở trang từ Hộp thư (`?focus=<khối>`, `&comment=<id>`): cuộn tới và tô sáng khối liên quan của thông báo, như Notion tô
 * cuộc thảo luận khi bấm thông báo. Khối mang `data-notification-focus="<khối>"` (bình luận: `comment:<id>`). Không thấy
 * khối đúng (đã xóa, đang thu thành chip) thì tô phần đầu trang (`overview`); không có gì để tô thì bỏ qua. Việc con
 * (`subtaskId`) tô phần đầu khung việc con (`subtask`).
 */
export function useNotificationFocus(enabled = true) {
  const searchParams = useSearchParams();
  const focus = searchParams?.get(NOTIFICATION_FOCUS_PARAM) ?? null;
  const comment = searchParams?.get(NOTIFICATION_COMMENT_PARAM) ?? null;
  // Thông báo của việc con mở trang nhiệm vụ gốc kèm khung việc con (`subtaskId`): tô phần đầu khung việc con
  const inSubtask = Boolean(searchParams?.get("subtaskId"));

  React.useEffect(() => {
    if (!enabled || !focus) return;
    const preferred = inSubtask
      ? [selectorFor("subtask")]
      : ([comment ? selectorFor(`comment:${comment}`) : null, selectorFor(focus)].filter(Boolean) as string[]);
    const fallback = focus === "overview" ? [] : [selectorFor("overview")];
    const started = performance.now();
    let done = false;
    let timer = 0;
    const finish = () => {
      done = true;
      window.clearInterval(timer);
    };

    const tick = () => {
      if (done) return;
      const elapsed = performance.now() - started;
      // Bình luận cụ thể ưu tiên hơn cả khu bình luận: chờ bình luận tải xong rồi mới chấp nhận khu bình luận
      const candidates = elapsed < PREFERRED_WAIT_MS ? preferred.slice(0, 1) : [...preferred, ...fallback];
      for (const selector of candidates) {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          finish();
          highlight(el);
          stripFocusParams();
          return;
        }
      }
      if (elapsed >= GIVE_UP_MS) {
        finish();
        stripFocusParams();
      }
    };

    timer = window.setInterval(tick, POLL_MS);
    tick();
    return finish;
  }, [enabled, focus, comment, inSubtask]);
}
