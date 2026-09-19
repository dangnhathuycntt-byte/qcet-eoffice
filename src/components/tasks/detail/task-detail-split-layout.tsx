"use client";

import * as React from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { cn } from "@/lib/utils";

const DEFAULT_INSPECTOR_PCT = 28;
const MIN_INSPECTOR_PCT = 20;
const MAX_INSPECTOR_PCT = 40;
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
  const inspectorPanelRef = usePanelRef();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  React.useEffect(() => {
    const panel = inspectorPanelRef.current;
    if (!panel) return;
    if (inspectorOpen) {
      if (panel.isCollapsed()) panel.expand();
    } else {
      if (!panel.isCollapsed()) panel.collapse();
    }
  }, [inspectorOpen, inspectorPanelRef]);

  if (isMobile) {
    return (
      <div className={cn("flex-1 min-h-0 flex flex-col", className)}>
        <div className="flex-1 min-h-0">{children}</div>
        {inspectorOpen && <div className="w-full border-t border-border/40 pt-4">{inspector}</div>}
      </div>
    );
  }

  return (
    <Group
      orientation="horizontal"
      className={cn("flex-1 min-h-0", className)}
    >
      <Panel minSize="50%" defaultSize={inspectorOpen ? `${100 - DEFAULT_INSPECTOR_PCT}%` : "100%"} id="main">
        {children}
      </Panel>

      {inspectorOpen && (
        <>
          <Separator
            className={cn(
              "w-px bg-transparent hover:bg-primary/40 focus-visible:bg-primary/60",
              "transition-colors duration-100 cursor-col-resize",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "motion-reduce:transition-none",
              "data-[resize-handle-active]:bg-primary/60",
            )}
            aria-label="Thay đổi độ rộng cột thuộc tính"
          >
            <div className="w-3 h-full -ml-1.5" />
          </Separator>

          <Panel
            panelRef={inspectorPanelRef}
            id="inspector"
            defaultSize={`${DEFAULT_INSPECTOR_PCT}%`}
            minSize={`${MIN_INSPECTOR_PCT}%`}
            maxSize={`${MAX_INSPECTOR_PCT}%`}
            collapsible
            onResize={() => {}}
          >
            {inspector}
          </Panel>
        </>
      )}
    </Group>
  );
}
