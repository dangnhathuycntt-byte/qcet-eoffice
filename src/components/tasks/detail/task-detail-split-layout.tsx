"use client";

import * as React from "react";
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
        {inspectorOpen && (
          <div className="w-full border-t border-border/40 pt-4">{inspector}</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 min-h-0 min-w-0", className)}>
      <div className="flex-1 min-h-0 min-w-0">
        {children}
      </div>
      {inspectorOpen && (
          <div className="w-[300px] shrink-0 min-w-0 pl-8">
            {inspector}
          </div>
      )}
    </div>
  );
}
