"use client";

import * as React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 1024;

interface TaskDetailSplitLayoutProps {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  children: React.ReactNode;
  inspector: React.ReactNode;
  className?: string;
}

export function TaskDetailSplitLayout({
  inspectorOpen,
  onToggleInspector,
  children,
  inspector,
  className,
}: TaskDetailSplitLayoutProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (isMobile) {
    return (
      <div className={cn("flex-1 min-h-0 flex flex-col", className)}>
        <div className="flex-1 min-h-0">{children}</div>
        {inspectorOpen ? (
          <div className="w-full border-t border-border/40 pt-4">
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-xs font-medium text-muted-foreground">Thuộc tính</span>
              <button
                type="button"
                onClick={onToggleInspector}
                title="Ẩn thuộc tính"
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Ẩn
              </button>
            </div>
            {inspector}
          </div>
        ) : (
          <div className="border-t border-border/40 px-4 py-2">
            <button
              type="button"
              onClick={onToggleInspector}
              title="Hiện thuộc tính"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              <span>Hiện thuộc tính</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 min-h-0 min-w-0", className)}>
      <div className="flex-1 min-h-0 min-w-0">
        {children}
      </div>

      {/* Separator edge with collapse/expand control */}
      <div className="relative flex items-center shrink-0">
        {/* Thin divider line */}
        <div className={cn("w-px self-stretch", inspectorOpen ? "bg-border/40" : "bg-transparent")} />

        {/* Collapse / Expand chevron at the separator edge */}
        <button
          type="button"
          onClick={onToggleInspector}
          title={inspectorOpen ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
          aria-label={inspectorOpen ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
          aria-expanded={inspectorOpen}
          className={cn(
            "absolute z-10 flex items-center justify-center rounded-full border border-border/60 bg-background shadow-sm transition-colors cursor-pointer",
            "hover:bg-muted hover:border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
            inspectorOpen
              ? "size-6 -right-3"
              : "h-7 gap-1 px-2 -right-1 text-xs text-muted-foreground hover:text-foreground"
          )}
        >
          {inspectorOpen ? (
            <ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
          ) : (
            <>
              <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              <span className="hidden lg:inline text-[11px] font-medium whitespace-nowrap">Thuộc tính</span>
            </>
          )}
        </button>
      </div>

      {inspectorOpen && (
        <div className="w-[300px] shrink-0 min-w-0 pl-4">
          {inspector}
        </div>
      )}
    </div>
  );
}
