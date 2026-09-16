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
  ExternalLink,
  Printer,
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
        "h-12 w-full flex items-center justify-between px-3 sm:px-6 border-b border-border/60 bg-background/95 backdrop-blur-xs sticky top-0 z-30 select-none",
        className
      )}
    >
      {/* Left: Compact Breadcrumbs navigation */}
      <nav aria-label="Đường dẫn điều hướng" className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          title="Quay lại danh sách nhiệm vụ"
          aria-label="Quay lại danh sách nhiệm vụ"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="hidden sm:inline">Nhiệm vụ</span>
        </button>

        <span className="text-muted-foreground/40 font-mono text-xs select-none" aria-hidden="true">
          /
        </span>

        <div className="flex items-center gap-1.5 min-w-0 text-xs">
          <span className="font-mono font-semibold text-foreground shrink-0 bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
            {taskCode}
          </span>
          <span className="text-muted-foreground/40 font-mono text-xs hidden md:inline select-none" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-muted-foreground truncate max-w-[200px] sm:max-w-[340px] md:max-w-[480px] hidden md:inline">
            {taskTitle}
          </span>
        </div>
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 bg-background hover:bg-muted/60 text-xs font-medium text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          title="Sao chép liên kết nhiệm vụ"
          aria-label="Sao chép liên kết nhiệm vụ"
        >
          {copiedLink ? (
            <>
              <Check className="size-3.5 text-emerald-600 shrink-0" strokeWidth={1.5} />
              <span className="text-emerald-700 font-semibold text-xs">Đã chép</span>
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
              ? "bg-muted border-border text-foreground font-semibold"
              : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
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
          <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-muted-foreground/15 text-[10px] font-mono text-muted-foreground font-medium">
            ⌘I
          </kbd>
        </button>

        {/* More Actions Dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
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
