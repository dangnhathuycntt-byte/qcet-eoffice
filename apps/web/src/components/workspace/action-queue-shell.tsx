"use client";

import * as React from "react";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Inbox,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AttentionBadge } from "./attention-badge";

import { Pressable } from "@/components/ui/pressable";
export interface ActionQueueTabItem {
  id: string;
  label: string;
  count: number;
  icon?: LucideIcon;
  variant?: "urgent" | "warning" | "info" | "neutral";
}

export interface ActionQueueShellProps {
  title?: string;
  subtitle?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  tabs?: ActionQueueTabItem[];
  totalCount?: number;
  children?: React.ReactNode;
  headerRight?: React.ReactNode;
  footerSlot?: React.ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

/**
 * ActionQueueShell - Canonical action queue container.
 * Houses pending approvals, submissions, and overdue items with clean categorization tabs,
 * WCAG 2.2 AA compliant touch targets (44px+), visible focus rings, and senior ergonomics.
 * Strictly Light-Only with zero dark: classes and zero emojis.
 */
export function ActionQueueShell({
  title = "Hàng đợi xử lý",
  subtitle = "Hồ sơ, minh chứng và nhiệm vụ yêu cầu hành động ngay",
  activeTab,
  onTabChange,
  tabs,
  totalCount,
  children,
  headerRight,
  footerSlot,
  isEmpty = false,
  emptyTitle = "Không có việc tồn đọng",
  emptyDescription = "Tất cả hồ sơ phê duyệt và minh chứng công việc đã được xử lý đúng tiến độ.",
  collapsible = true,
  defaultCollapsed = false,
  className,
}: ActionQueueShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const calculatedTotal = React.useMemo(() => {
    if (typeof totalCount === "number") return totalCount;
    if (tabs && tabs.length > 0) {
      return tabs.reduce((acc, curr) => acc + (curr.count || 0), 0);
    }
    return 0;
  }, [totalCount, tabs]);

  const hasItems = !isEmpty && calculatedTotal > 0;

  return (
    <section
      aria-labelledby="action-queue-title"
      className={cn(
        "rounded-panel bg-card border border-border/60 shadow-none overflow-hidden transition-colors",
        className
      )}
    >
      {/* Header Container */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-border/40 bg-secondary/30">
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-control bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <CheckCheck className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="action-queue-title"
                className="text-base sm:text-lg font-bold text-foreground tracking-tight"
              >
                {title}
              </h2>
              {calculatedTotal > 0 ? (
                <AttentionBadge
                  level={calculatedTotal > 5 ? "urgent" : "warning"}
                  label={`${calculatedTotal} việc cần xử lý`}
                  size="sm"
                />
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  Hoàn thành
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {headerRight}

          {collapsible && hasItems && (
            <Pressable
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Mở rộng hàng đợi" : "Thu gọn hàng đợi"}
              className={cn(
                "inline-flex items-center justify-center size-11 min-h-[44px] min-w-[44px] rounded-control bg-secondary text-foreground hover:bg-accent transition-colors",
              )}
            >
              {isCollapsed ? (
                <ChevronDown className="size-5" aria-hidden="true" />
              ) : (
                <ChevronUp className="size-5" aria-hidden="true" />
              )}
            </Pressable>
          )}
        </div>
      </div>

      {/* Tabs Filter Bar */}
      {!isCollapsed && tabs && tabs.length > 0 && onTabChange && (
        <div
          role="tablist"
          aria-label="Lọc danh mục hàng đợi"
          className="flex items-center gap-1.5 p-2 bg-secondary/60 border-b border-border overflow-x-auto no-scrollbar"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon || Layers;

            return (
              <Pressable
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[44px] transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none shrink-0",
                  isActive
                    ? "bg-background text-foreground shadow-low border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <IconComponent
                  className={cn(
                    "size-4",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full px-1.5 py-0.2 font-mono text-xs font-bold",
                    isActive
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : "bg-accent text-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </Pressable>
            );
          })}
        </div>
      )}

      {/* Content Area */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5">
          {hasItems ? (
            <div className="space-y-3">{children}</div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div
                className="size-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3"
                aria-hidden="true"
              >
                <Inbox className="size-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">{emptyTitle}</h3>
              <p className="text-xs sm:text-sm text-foreground max-w-md mt-1">
                {emptyDescription}
              </p>
            </div>
          )}

          {footerSlot && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              {footerSlot}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
