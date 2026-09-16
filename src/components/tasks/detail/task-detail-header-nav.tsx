"use client";

import * as React from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  MoreHorizontal,
  Share2,
  RefreshCw,
  Printer,
  Box,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskDetailHeaderNavProps {
  taskCode: string;
  taskTitle: string;
  onBack: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function TaskDetailHeaderNav({
  taskCode,
  taskTitle,
  onBack,
  showInspector,
  onToggleInspector,
  onRefresh,
  className,
}: TaskDetailHeaderNavProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);

  const handleCopyLink = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  // Close more menu on click outside
  React.useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  return (
    <header
      data-slot="task-detail-header-nav"
      className={cn(
        "h-12 w-full flex items-center justify-between px-4 sm:px-6 border-b border-border/40 bg-background/95 backdrop-blur-md sticky top-0 z-30 select-none",
        className
      )}
    >
      {/* Left: Linear-style Breadcrumbs navigation */}
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

      {/* Right: Sleek Action Icons */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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
              <Copy className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
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
          title="Ẩn / Hiện cột thuộc tính (⌘I / Ctrl+I)"
          aria-label="Ẩn hoặc hiện cột thuộc tính"
          aria-pressed={showInspector}
        >
          {showInspector ? (
            <PanelRightClose className="size-3.5 shrink-0" strokeWidth={1.5} />
          ) : (
            <PanelRightOpen className="size-3.5 shrink-0" strokeWidth={1.5} />
          )}
          <span className="hidden sm:inline">Thuộc tính</span>
          <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground">
            ⌘I
          </kbd>
        </button>

        {/* More Actions Dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            title="Thao tác khác"
            aria-label="Thao tác khác"
            aria-expanded={showMoreMenu}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </button>

          {showMoreMenu && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {onRefresh && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onRefresh();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                >
                  <RefreshCw className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Làm mới dữ liệu</span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  handleCopyLink();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
              >
                <Share2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>Chia sẻ nhiệm vụ</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (typeof window !== "undefined") window.print();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
              >
                <Printer className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>In thông tin</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
