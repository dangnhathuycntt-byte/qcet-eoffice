"use client";

import * as React from "react";
import {
  ArrowLeft,
  Link2,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Box,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskDetailHeaderNavProps {
  taskCode: string;
  taskTitle: string;
  onBack: () => void;
  showBreadcrumbs?: boolean;
  showInspector: boolean;
  onToggleInspector: () => void;
  onOpenProgressModal?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function TaskDetailHeaderNav({
  taskCode,
  taskTitle,
  onBack,
  showBreadcrumbs = true,
  showInspector,
  onToggleInspector,
  onOpenProgressModal,
  onRefresh,
  className,
}: TaskDetailHeaderNavProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);

  const handleCopyLink = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  return (
    <header
      data-slot="task-detail-header-nav"
      data-breadcrumbs={showBreadcrumbs}
      className={cn(
        "h-12 w-full flex items-center justify-between px-4 sm:px-6 border-b border-border/40 bg-background/95 backdrop-blur-md sticky top-0 z-30 select-none",
        className
      )}
    >
      {/* The application shell already owns the page breadcrumb on full-page views. */}
      {showBreadcrumbs && (
      <nav aria-label="Đường dẫn điều hướng" className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          title="Quay lại danh sách nhiệm vụ"
          aria-label="Quay lại danh sách nhiệm vụ"
        >
          <ArrowLeft className="size-3.5 shrink-0" strokeWidth={1.5} />
          <span>Nhiệm vụ</span>
        </button>

        <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" strokeWidth={1.5} />

        <div className="flex items-center gap-1.5 min-w-0 text-xs">
          <div className="flex items-center gap-1 shrink-0 font-mono font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
            <Box className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <span>{taskCode}</span>
          </div>

          <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 hidden md:inline" strokeWidth={1.5} />

          <span className="font-medium text-muted-foreground truncate max-w-[200px] sm:max-w-[340px] md:max-w-[480px] hidden md:inline">
            {taskTitle}
          </span>
        </div>
      </nav>
      )}

      {/* Right: Sleek Action Icons */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Cập nhật tiến độ Button */}
        {onOpenProgressModal && (
          <button
            type="button"
            onClick={onOpenProgressModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background hover:bg-muted/50 text-xs font-medium text-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Cập nhật tiến độ nhiệm vụ"
          >
            <span className="text-xs">Cập nhật tiến độ</span>
          </button>
        )}

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          title="Sao chép liên kết nhiệm vụ"
          aria-label="Sao chép liên kết nhiệm vụ"
        >
          {copiedLink ? (
            <>
              <Check className="size-3.5 text-emerald-600 shrink-0" strokeWidth={1.5} />
              <span className="text-emerald-700 font-medium text-xs">Đã sao chép</span>
            </>
          ) : (
            <>
              <Link2 className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="hidden sm:inline text-xs">Sao chép liên kết</span>
            </>
          )}
        </button>

        {/* Toggle Inspector Button (Desktop) */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
            showInspector
              ? "bg-muted/80 border-border/80 text-foreground font-semibold"
              : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          title="Ẩn/Hiện thuộc tính (Space)"
          aria-label="Ẩn hoặc hiện cột thuộc tính"
          aria-expanded={showInspector}
        >
          {showInspector ? (
            <PanelRightClose className="size-3.5 shrink-0" strokeWidth={1.5} />
          ) : (
            <PanelRightOpen className="size-3.5 shrink-0" strokeWidth={1.5} />
          )}
          <span className="hidden sm:inline">Thuộc tính</span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground">
            Space
          </kbd>
        </button>
      </div>
    </header>
  );
}
