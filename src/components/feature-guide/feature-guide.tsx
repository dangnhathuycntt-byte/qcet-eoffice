"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "qcet_fg_";

interface FeatureGuideCardProps {
  /** Unique key per feature, e.g. "tasks-deadline-sort" */
  id: string;
  /** Step tag shown at top-left, e.g. "Nhiệm vụ" */
  tag?: string;
  /** Main headline */
  title: string;
  /** Supporting copy */
  description: string;
  /** Optional inline preview snippet */
  preview?: React.ReactNode;
  /** Which side of the anchor to place the card */
  side?: "top" | "bottom" | "left" | "right";
  /** Horizontal alignment relative to anchor */
  align?: "start" | "center" | "end";
  /** Delay before showing (ms) — let the page settle */
  delay?: number;
  /** Additional className on the outer wrapper */
  className?: string;
  children: React.ReactNode;
}

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

function dismiss(id: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
  } catch {
    // ignore
  }
}

/**
 * Contextual Feature Guide — wraps a UI element and shows a small
 * non-blocking tooltip card anchored to it on first visit.
 *
 * Usage:
 *   <FeatureGuideCard id="tasks-sort" title="Việc gần hạn nằm trên cùng." description="...">
 *     <TaskList />   ← the anchor element
 *   </FeatureGuideCard>
 *
 * Design spec (Page 5): "Thẻ nhỏ gắn vào giao diện thật, chỉ hiện lần đầu
 * mở từng màn hình. Tối đa 3 thẻ mỗi màn hình."
 */
export function FeatureGuideCard({
  id,
  tag,
  title,
  description,
  preview,
  side = "bottom",
  align = "start",
  delay = 800,
  className,
  children,
}: FeatureGuideCardProps) {
  const [visible, setVisible] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Show after delay if not already dismissed
  React.useEffect(() => {
    if (isDismissed(id)) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [id, delay]);

  // Re-open via custom event: window.dispatchEvent(new CustomEvent("qcet:open-feature-guide"))
  React.useEffect(() => {
    const handleReopen = () => {
      setVisible(true);
    };
    window.addEventListener("qcet:open-feature-guide", handleReopen);
    return () => window.removeEventListener("qcet:open-feature-guide", handleReopen);
  }, []);

  const handleDismiss = React.useCallback(() => {
    setVisible(false);
    dismiss(id);
  }, [id]);

  // ESC to dismiss
  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleDismiss]);

  // Click outside to dismiss
  React.useEffect(() => {
    if (!visible) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        handleDismiss();
      }
    };
    // Use timeout so the click that opened the page doesn't immediately dismiss
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onClick);
    };
  }, [visible, handleDismiss]);

  const positionClasses = cn(
    "absolute z-40",
    // Side
    side === "bottom" && "top-full mt-2",
    side === "top" && "bottom-full mb-2",
    side === "left" && "right-full mr-2 top-0",
    side === "right" && "left-full ml-2 top-0",
    // Align (horizontal for top/bottom, vertical for left/right)
    (side === "top" || side === "bottom") && align === "start" && "left-0",
    (side === "top" || side === "bottom") && align === "center" && "left-1/2 -translate-x-1/2",
    (side === "top" || side === "bottom") && align === "end" && "right-0",
    (side === "left" || side === "right") && align === "start" && "top-0",
    (side === "left" || side === "right") && align === "center" && "top-1/2 -translate-y-1/2",
    (side === "left" || side === "right") && align === "end" && "bottom-0",
  );

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {children}

      {visible && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={title}
          className={cn(
            positionClasses,
            "w-[280px] sm:w-[300px]",
            "animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none",
          )}
        >
          <div className="flex flex-col rounded-xl bg-card p-3.5 shadow-lg border border-border">
            {/* Header */}
            <div className="flex items-center justify-between">
              {tag && (
                <span className="text-[11px] font-semibold text-muted-foreground tracking-tight">
                  {tag}
                </span>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Đóng hướng dẫn"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ml-auto"
              >
                <X className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <h4 className="mt-1.5 text-sm font-semibold tracking-tight text-foreground leading-snug">
              {title}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>

            {/* Preview */}
            {preview}

            {/* Footer: Xong */}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex h-7 items-center justify-center rounded-md bg-foreground px-3 text-xs font-medium text-background hover:opacity-90 active:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Resets all feature guide dismissals — called from Help → Hướng dẫn tính năng.
 */
export function resetAllFeatureGuides(): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
    for (const k of keys) {
      localStorage.removeItem(k);
    }
    window.dispatchEvent(new CustomEvent("qcet:open-feature-guide"));
  } catch {
    // ignore
  }
}
