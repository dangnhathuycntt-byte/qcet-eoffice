"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stats?: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted?: number;
    overdue: number;
    completionRate: number;
  };
  children: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  stats,
  children,
}: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative z-50 flex h-full w-full sm:max-w-3xl flex-col bg-card border-l border-border/60 shadow-[0_0_50px_rgba(0,0,0,0.18)] dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col border-b border-border/60 px-4 sm:px-6 py-4 gap-3.5 shrink-0 bg-card/95 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug font-heading">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs font-medium text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-transparent hover:border-border/60 transition-all duration-200 active:scale-95 shrink-0 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {stats && (
            <div className="rounded-2xl px-4 py-3 bg-muted/40 border border-border/50 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between text-xs sm:text-[13px] font-bold">
                <span className="text-foreground">
                  Tiến độ hoàn thành:{" "}
                  <span className="tabular-nums text-primary">
                    {stats.completed}/{stats.total}
                  </span>
                </span>
                <span className="text-muted-foreground font-medium text-xs tabular-nums">
                  {stats.total} nhiệm vụ
                </span>
              </div>
              <Progress
                value={stats.completionRate}
                className="[&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-indicator]]:bg-emerald-500 rounded-full"
              />
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium pt-0.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                  {stats.completed} hoàn thành
                </span>
                <span>·</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold tabular-nums">
                  {stats.inProgress} đang làm
                </span>
                {stats.overdue > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums animate-pulse">
                      {stats.overdue} quá hạn
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background/50 thin-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
