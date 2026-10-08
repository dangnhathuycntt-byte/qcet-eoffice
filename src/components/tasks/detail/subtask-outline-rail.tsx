"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { getTaskContentPreview } from "@/lib/task-content-preview";
import { formatCompactDate } from "@/lib/format/date";
import type { StaffTask } from "@/types/dashboard";

export interface SubtaskOutlineRailProps {
  subTasks: StaffTask[];
  activeSubtaskId?: string | null;
  onSelectSubtask: (subtask: StaffTask) => void;
  className?: string;
}

/** Độ dài vạch (px) theo độ dài tiêu đề, giới hạn 8–20 để thành "bản đồ" nhỏ gọn */
function tickWidth(title: string): number {
  return Math.min(20, Math.max(8, Math.round(title.trim().length / 2) + 6));
}

/**
 * Thanh vạch mỏng ở mép trái khung chi tiết việc con: mỗi vạch là một việc con
 * (độ dài vạch theo độ dài tiêu đề, việc đang mở dài và sáng nhất).
 * Rê chuột / focus vào một vạch để xem thẻ xem nhanh, nhấn để mở việc đó.
 */
export function SubtaskOutlineRail({
  subTasks,
  activeSubtaskId,
  onSelectSubtask,
  className,
}: SubtaskOutlineRailProps) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [cardTop, setCardTop] = React.useState(0);

  const focusTick = React.useCallback((id: string) => {
    const li = listRef.current?.querySelector<HTMLElement>(`[data-tick-id="${id}"]`);
    if (!li) return;
    setHoverId(id);
    setCardTop(li.offsetTop + li.offsetHeight / 2);
  }, []);

  // Lướt chuột dọc thanh: thẻ xem nhanh bám theo vạch gần con trỏ nhất (không bị đứt ở khoảng trống giữa các vạch)
  const handleMouseMove = (e: React.MouseEvent) => {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[data-tick-id]");
    if (!items || items.length === 0) return;
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    items.forEach((li) => {
      const r = li.getBoundingClientRect();
      const d = Math.abs(e.clientY - (r.top + r.height / 2));
      if (d < bestDist) {
        bestDist = d;
        best = li;
      }
    });
    const id = (best as HTMLElement | null)?.dataset.tickId;
    if (id && id !== hoverId) focusTick(id);
  };

  if (!subTasks || subTasks.length === 0) return null;

  const hovered = hoverId ? subTasks.find((st) => st.id === hoverId) ?? null : null;
  const preview = hovered
    ? getTaskContentPreview((hovered as any).description || hovered.deliverableDescription).replace(/\s*\n\s*/g, " ")
    : "";
  const due = hovered?.dueDate ? formatCompactDate(hovered.dueDate, "") : "";

  return (
    <nav
      aria-label="Điều hướng nhanh việc con"
      data-slot="subtask-outline-rail"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverId(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverId(null);
      }}
      className={cn("absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 md:block", className)}
    >
      <ul ref={listRef} className="relative flex flex-col py-3 pl-1 pr-3">
        {subTasks.map((st) => {
          const isActive = st.id === activeSubtaskId;
          const isHover = st.id === hoverId;
          return (
            <li key={st.id} data-tick-id={st.id}>
              <button
                type="button"
                onClick={() => onSelectSubtask(st)}
                onFocus={() => focusTick(st.id)}
                aria-label={`Mở việc con: ${st.title}`}
                aria-current={isActive ? "true" : undefined}
                className="flex h-4 w-6 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <span
                  style={{ width: isActive || isHover ? 24 : tickWidth(st.title) }}
                  className={cn(
                    "block h-0.5 rounded-full transition-[width,background-color] duration-100",
                    isActive ? "bg-foreground" : isHover ? "bg-foreground/70" : "bg-muted-foreground/35"
                  )}
                />
              </button>
            </li>
          );
        })}

        {/* Một thẻ xem nhanh duy nhất, trượt theo vạch đang được lướt tới */}
        {hovered && (
          <div
            role="tooltip"
            style={{ top: cardTop }}
            className="pointer-events-none absolute left-full z-30 -translate-y-1/2 pl-1 transition-[top] duration-100 ease-out motion-reduce:transition-none"
          >
            <div className="w-64 rounded-xl border border-border bg-popover p-3 shadow-xl">
              <div className="flex items-start gap-2">
                <TaskStatusCircle status={hovered.status} className="mt-0.5" />
                <span className="min-w-0 flex-1 text-xs font-medium text-foreground line-clamp-2">{hovered.title}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                {preview || "Chưa có mô tả."}
              </p>
              {(hovered.assigneeName || due) && (
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{hovered.assigneeName || ""}</span>
                  {due && <span className="shrink-0 tabular-nums">{due}</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </ul>
    </nav>
  );
}
