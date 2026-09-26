"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { motionTransition } from "@/lib/motion/tokens";

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
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        <AnimatePresence>
          {inspectorOpen && (
            <m.div
              key="inspector-mobile"
              className="w-full border-t border-border/40 pt-4"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={motionTransition.panel}
            >
              {inspector}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 min-h-0 min-w-0", className)}>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {children}
      </div>
      <AnimatePresence>
        {inspectorOpen && (
          <m.div
            key="inspector-desktop"
            className="w-[300px] shrink-0 min-w-0 pl-8"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={motionTransition.panel}
          >
            {inspector}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
