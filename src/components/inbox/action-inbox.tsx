"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  CheckSquare,
  FileCheck,
  ChevronRight,
  Filter,
  Inbox,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/pressable";

export type ResourceType = "TASK" | "DOCUMENT" | "REPORT";
export type PriorityLevel = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface ActionInboxItem {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  title: string;
  requiredAction: string;
  priority: PriorityLevel;
  deadline: Date | string | null;
  reasonWhyMe: string;
  href: string;
  createdAt?: Date | string;
}

export interface ActionInboxProps {
  items?: ActionInboxItem[];
  isLoading?: boolean;
  onItemSelect?: (item: ActionInboxItem) => void;
  className?: string;
}

export function ActionInbox({
  items = [],
  isLoading = false,
  onItemSelect,
  className = "",
}: ActionInboxProps) {
  const [filterType, setFilterType] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const matchType = filterType === "ALL" || item.resourceType === filterType;
      const matchQuery =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requiredAction.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.reasonWhyMe.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchQuery;
    });
  }, [items, filterType, searchQuery]);

  const urgentCount = React.useMemo(
    () => items.filter((i) => i.priority === "URGENT" || i.priority === "HIGH").length,
    [items]
  );

  return (
    <div
      className={`w-full bg-background text-foreground rounded-2xl border border-border shadow-xs overflow-hidden ${className}`}
      data-slot="action-inbox"
    >
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Inbox size={20} strokeWidth={1.5} className="shrink-0" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Hộp công việc cần xử lý</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                {items.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Các nhiệm vụ, văn bản và tờ trình đang chờ bạn phê duyệt hoặc thực hiện theo thẩm quyền.
            </p>
          </div>

          {urgentCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs font-medium">
              <AlertCircle size={16} strokeWidth={1.5} className="text-warning shrink-0" />
              <span>{urgentCount} việc ưu tiên cao cần xử lý</span>
            </div>
          )}
        </div>

        {/* Filter Controls theo chuẩn 1-row Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <div
            role="group"
            aria-label="Lọc theo loại tài nguyên"
            className="inline-flex h-7 items-center rounded-md border border-border/80 bg-muted/30 p-0.5 text-xs shrink-0 select-none"
          >
            <Pressable
              onClick={() => setFilterType("ALL")}
              aria-pressed={filterType === "ALL"}
              className={cn(
                "inline-flex items-center gap-1 h-6 px-2.5 rounded-[4px] text-xs font-medium transition-colors select-none",
                filterType === "ALL"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <span>Tất cả</span>
              <span className="font-mono tabular-nums text-xs opacity-75">({items.length})</span>
            </Pressable>
            <Pressable
              onClick={() => setFilterType("TASK")}
              aria-pressed={filterType === "TASK"}
              className={cn(
                "inline-flex items-center gap-1 h-6 px-2.5 rounded-[4px] text-xs font-medium transition-colors select-none",
                filterType === "TASK"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <span>Nhiệm vụ</span>
              <span className="font-mono tabular-nums text-xs opacity-75">
                ({items.filter((i) => i.resourceType === "TASK").length})
              </span>
            </Pressable>
            <Pressable
              onClick={() => setFilterType("DOCUMENT")}
              aria-pressed={filterType === "DOCUMENT"}
              className={cn(
                "inline-flex items-center gap-1 h-6 px-2.5 rounded-[4px] text-xs font-medium transition-colors select-none",
                filterType === "DOCUMENT"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <span>Văn bản</span>
              <span className="font-mono tabular-nums text-xs opacity-75">
                ({items.filter((i) => i.resourceType === "DOCUMENT").length})
              </span>
            </Pressable>
          </div>

          <div className="ml-auto relative w-full sm:w-60">
            <Search className="size-3.5 text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề hoặc thẩm quyền..."
              aria-label="Tìm theo tiêu đề hoặc thẩm quyền"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-8 pr-2.5 text-xs rounded-md border border-border/80 bg-background placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="p-8 text-center space-y-3 animate-pulse">
            <div className="h-6 bg-muted/60 rounded-xl w-1/4 mx-auto" />
            <div className="h-16 bg-muted/40 rounded-2xl w-full" />
            <div className="h-16 bg-muted/40 rounded-2xl w-full" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <CheckCircle2 size={24} strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-foreground">Không có công việc nào tồn đọng</p>
            <p className="text-xs text-muted-foreground">
              Tất cả các nhiệm vụ và văn bản trong thẩm quyền xử lý của bạn đã hoàn thành.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <ActionInboxRow
              key={item.id}
              item={item}
              onSelect={onItemSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ActionInboxRow({
  item,
  onSelect,
}: {
  item: ActionInboxItem;
  onSelect?: (item: ActionInboxItem) => void;
}) {
  const isUrgent = item.priority === "URGENT" || item.priority === "HIGH";

  const renderIcon = () => {
    switch (item.resourceType) {
      case "TASK":
        return <CheckSquare size={15} strokeWidth={1.5} className="text-muted-foreground" />;
      case "DOCUMENT":
        return <FileText size={15} strokeWidth={1.5} className="text-muted-foreground" />;
      case "REPORT":
        return <FileCheck size={15} strokeWidth={1.5} className="text-muted-foreground" />;
    }
  };

  const formattedDeadline = item.deadline
    ? new Date(item.deadline).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/40 transition-colors">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="p-2.5 rounded-xl bg-muted shrink-0 mt-0.5">
          {renderIcon()}
        </div>

        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                isUrgent
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.requiredAction}
            </span>

            <span className="text-xs text-muted-foreground font-medium">
              Thẩm quyền: {item.reasonWhyMe}
            </span>

            {formattedDeadline && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto sm:ml-0 font-mono tabular-nums">
                <Clock size={12} strokeWidth={1.5} />
                <span>Hạn: {formattedDeadline}</span>
              </span>
            )}
          </div>

          <Link
            href={item.href}
            onClick={() => onSelect?.(item)}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors block truncate"
          >
            {item.title}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 sm:self-center">
        <Link
          href={item.href}
          onClick={() => onSelect?.(item)}
          className="h-7 px-3 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] shrink-0"
        >
          <span>Xử lý ngay</span>
          <ArrowUpRight size={13} strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

export default ActionInbox;
