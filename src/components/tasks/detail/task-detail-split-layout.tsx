"use client";

import * as React from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { cn } from "@/lib/utils";

const DEFAULT_INSPECTOR_PCT = 28;
const MIN_INSPECTOR_PCT = 20;
const MAX_INSPECTOR_PCT = 40;
const MOBILE_BREAKPOINT = 1024;
const STORAGE_KEY = 'qcet-inspector-pct';
function readStoredPct(): number {
  try { const v = localStorage.getItem(STORAGE_KEY); if (v) { const n = Number(v); if (n >= MIN_INSPECTOR_PCT && n <= MAX_INSPECTOR_PCT) return n; } } catch {}
  return DEFAULT_INSPECTOR_PCT;
}

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
  const storedPct = React.useRef(readStoredPct());
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
      <Panel minSize="50%" defaultSize={`${100 - storedPct.current}%`} id="main">
        {children}
      </Panel>

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
        defaultSize={`${storedPct.current}%`}
        minSize={`${MIN_INSPECTOR_PCT}%`}
        maxSize={`${MAX_INSPECTOR_PCT}%`}
        collapsible
        collapsedSize="0%"
        onResize={(size) => { try { const pct = Math.round(size.asPercentage); if (pct >= MIN_INSPECTOR_PCT && pct <= MAX_INSPECTOR_PCT) localStorage.setItem(STORAGE_KEY, String(pct)); } catch {} }}
      >
        {inspector}
      </Panel>
    </Group>
  );
}
