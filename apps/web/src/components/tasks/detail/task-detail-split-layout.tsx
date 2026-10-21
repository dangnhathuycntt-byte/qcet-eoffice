"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 1024;

interface TaskDetailSplitLayoutProps {
  inspectorOpen: boolean;
  /** Không còn nút thu gọn ở trang chi tiết; giữ tùy chọn để tương thích với nơi khác */
  onToggleInspector?: () => void;
  children: React.ReactNode;
  inspector: React.ReactNode;
  className?: string;
}

const STACKED_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeStacked(onChange: () => void) {
  const mql = window.matchMedia(STACKED_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Màn hẹp (< 1024px): cột thuộc tính không còn là cột phải mà xếp dọc cùng nội dung. SSR luôn là bố cục rộng. */
export function useStackedTaskDetail() {
  return React.useSyncExternalStore(
    subscribeStacked,
    () => window.matchMedia(STACKED_QUERY).matches,
    () => false,
  );
}

export function TaskDetailSplitLayout({
  inspectorOpen,
  children,
  inspector,
  className,
}: TaskDetailSplitLayoutProps) {
  const isMobile = useStackedTaskDetail();

  // Mobile: không min-h-0 để khối nội dung giữ chiều cao tự nhiên; canvas cha là vùng cuộn duy nhất
  if (isMobile) {
    return (
      <div className={cn("flex-1 flex flex-col", className)}>
        <div className="flex-1 flex flex-col">{children}</div>
        {inspectorOpen && (
          <div className="w-full border-t border-border/40 pt-4">{inspector}</div>
        )}
      </div>
    );
  }

  // Màn rộng: cột nội dung và cột thuộc tính cuộn riêng như Linear, cột thuộc tính đứng yên khi cuộn nội dung (người dùng yêu
  // cầu 21/10/2026 "cột properties cố định, scroll nội dung thôi"). Hàng này cao đúng bằng vùng cuộn của trang (flex-1 min-h-0)
  // nên mỗi cột tự cuộn trong chiều cao đó; vùng cuộn của trang không còn gì để cuộn.
  return (
    <div className={cn("flex flex-1 min-h-0 min-w-0", className)}>
      <div
        data-slot="task-detail-main"
        className={cn(
          "flex-1 min-h-0 min-w-0 flex flex-col",
          inspectorOpen && "pr-6 pb-16 overflow-y-auto overflow-x-hidden overscroll-contain thin-scrollbar [overflow-anchor:none]"
        )}
      >
        {children}
      </div>
      {inspectorOpen && (
        <div
          data-slot="task-detail-inspector"
          className="w-[340px] shrink-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain thin-scrollbar px-2 pt-3 pb-6"
        >
          {inspector}
        </div>
      )}
    </div>
  );
}
