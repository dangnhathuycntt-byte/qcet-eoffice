"use client";

import * as React from "react";
import {
  Link2,
  Check,
  PanelRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTaskDetailUrl } from "@/lib/tasks/task-detail-navigation";

export interface TaskDetailHeaderNavProps {
  taskId: string;
  showInspector?: boolean;
  onToggleInspector?: () => void;
  isDrawerOpen?: boolean;
  onOpenProgressModal?: () => void;
  className?: string;
}

export function TaskDetailHeaderNav({
  taskId,
  showInspector,
  onToggleInspector,
  isDrawerOpen = false,
  onOpenProgressModal,
  className,
}: TaskDetailHeaderNavProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyLink = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const url = getTaskDetailUrl(taskId);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard write failed — silently degrade
    }
  }, [taskId]);

  return (
    <header
      data-slot="task-detail-header-nav"
      className={cn(
        "h-12 w-full flex items-center justify-between px-4 sm:px-6 border-b border-border/40 bg-background/95 backdrop-blur-md sticky top-0 z-30 select-none",
        className
      )}
    >
      {/* Left side intentionally empty — breadcrumbs managed by layout */}
      <div />

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Cập nhật tiến độ */}
        {onOpenProgressModal && (
          <button
            type="button"
            onClick={onOpenProgressModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background hover:bg-muted/50 text-xs font-medium text-foreground transition-colors cursor-pointer"
            title="Cập nhật tiến độ nhiệm vụ"
          >
            <span className="text-xs">Cập nhật tiến độ</span>
          </button>
        )}

        {/* Copy link — subtle direct icon, visible on hover/focus and touch */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center size-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/70 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          title="Sao chép liên kết"
          aria-label="Sao chép liên kết"
        >
          {copiedLink ? (
            <Check className="size-3.5 text-emerald-600" strokeWidth={1.5} />
          ) : (
            <Link2 className="size-3.5" strokeWidth={1.5} />
          )}
        </button>

        {/* Properties toggle — hidden when child drawer is open */}
        {onToggleInspector && !isDrawerOpen && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
              showInspector
                ? "bg-muted/80 text-foreground"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
            )}
            title={showInspector ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
            aria-label={showInspector ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
            aria-expanded={showInspector}
          >
            <PanelRight className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </header>
  );
}
