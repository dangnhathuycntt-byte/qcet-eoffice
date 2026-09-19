"use client";

import * as React from "react";
import {
  ArrowLeft,
  Link2,
  Check,
  Box,
  ChevronRight,
  Ellipsis,
  PanelRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskDetailHeaderNavProps {
  taskCode: string;
  taskTitle: string;
  onBack: () => void;
  showBreadcrumbs?: boolean;
  showInspector?: boolean;
  onToggleInspector?: () => void;
  isDrawerOpen?: boolean;
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
  isDrawerOpen = false,
  onOpenProgressModal,
  className,
}: TaskDetailHeaderNavProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleCopyLink = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setMenuOpen(false);
    setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header
      data-slot="task-detail-header-nav"
      data-breadcrumbs={showBreadcrumbs}
      className={cn(
        "h-12 w-full flex items-center justify-between px-4 sm:px-6 border-b border-border/40 bg-background/95 backdrop-blur-md sticky top-0 z-30 select-none",
        className
      )}
    >
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

        {/* Overflow menu: copy link + future actions */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="inline-flex items-center justify-center size-8 rounded-lg border border-border/50 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            title="Thêm thao tác"
            aria-label="Thêm thao tác"
            aria-expanded={menuOpen}
          >
            <Ellipsis className="size-3.5" strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted cursor-pointer"
              >
                {copiedLink ? (
                  <><Check className="size-3.5 text-emerald-600" strokeWidth={1.5} /> <span className="text-emerald-700">Đã sao chép</span></>
                ) : (
                  <><Link2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} /> Sao chép liên kết</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Properties toggle — hidden when drawer is open */}
        {onToggleInspector && !isDrawerOpen && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-lg border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
              showInspector
                ? "bg-muted/80 border-border/80 text-foreground"
                : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
