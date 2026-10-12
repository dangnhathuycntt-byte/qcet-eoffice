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

  return (
    <div className={cn("flex flex-1 min-h-0 min-w-0", className)}>
      <div className={cn("flex-1 min-h-0 min-w-0 flex flex-col", inspectorOpen && "pr-6 pb-16")}>
        {children}
      </div>
      {inspectorOpen && (
        <div data-slot="task-detail-inspector" className="w-[340px] shrink-0 min-w-0 px-2 pt-3">
          {inspector}
        </div>
      )}
    </div>
  );
}
