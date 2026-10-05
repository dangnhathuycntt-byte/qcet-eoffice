"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Search, CheckSquare, FileText, User, Plus, X } from "lucide-react";
import { Kbd } from "./kbd";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  title: string;
  group: string; // "Nhiệm vụ" | "Văn bản" | "Thao tác" | "Cán bộ giảng viên" | string
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onSelect?: () => void;
}

export interface CommandMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
  emptyText?: string;
  maxItemsPerGroup?: number;
}

/**
 * Hộp tìm kiếm nhanh toàn hệ thống (⌘K).
 * Chuẩn QCET: Artboard Patterns (Gõ để lọc · ↑↓ chọn · Enter mở · Esc đóng · gom theo loại, ≤ 5 dòng mỗi nhóm).
 */
export function CommandMenu({
  open,
  onOpenChange,
  items,
  placeholder = "Tìm nhanh nhiệm vụ, văn bản, cán bộ...",
  emptyText = "Không tìm thấy kết quả phù hợp",
  maxItemsPerGroup = 5,
}: CommandMenuProps) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Global shortcut ⌘K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange?.(!open);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange?.(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter items and group them
  const filteredItems = React.useMemo(() => {
    if (!query.trim()) return items;
    const term = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(term)) ||
        (item.badge && item.badge.toLowerCase().includes(term))
    );
  }, [items, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filteredItems.forEach((item) => {
      const list = map.get(item.group) || [];
      if (list.length < maxItemsPerGroup) {
        list.push(item);
        map.set(item.group, list);
      }
    });
    return Array.from(map.entries());
  }, [filteredItems, maxItemsPerGroup]);

  const flattenedVisibleItems = React.useMemo(() => {
    return grouped.flatMap(([_, list]) => list);
  }, [grouped]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, flattenedVisibleItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? flattenedVisibleItems.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = flattenedVisibleItems[selectedIndex];
      if (current) {
        current.onSelect?.();
        onOpenChange?.(false);
      }
    }
  };

  const getDefaultIcon = (group: string) => {
    switch (group) {
      case "Nhiệm vụ":
        return <CheckSquare className="size-4 text-muted-foreground" />;
      case "Văn bản":
        return <FileText className="size-4 text-muted-foreground" />;
      case "Cán bộ giảng viên":
        return <User className="size-4 text-muted-foreground" />;
      case "Thao tác":
        return <Plus className="size-4 text-muted-foreground" />;
      default:
        return <Search className="size-4 text-muted-foreground" />;
    }
  };

  if (!open) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh"
      className="fixed inset-0 z-40 flex items-start justify-center pt-16 sm:pt-24 bg-overlay px-4 motion-reduce:transition-none"
      onClick={() => onOpenChange?.(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-card border-0 p-2 text-foreground shadow-dialog overflow-hidden motion-reduce:transition-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-2.5 h-11 px-3 rounded-control bg-secondary text-sm">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
          <Kbd className="hidden sm:inline-flex">Esc</Kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto mt-2 px-1 flex flex-col gap-3 pb-1 thin-scrollbar">
          {flattenedVisibleItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            grouped.map(([groupName, groupList]) => (
              <div key={groupName} className="flex flex-col gap-0.5">
                <div className="px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {groupName}
                </div>
                {groupList.map((item) => {
                  const itemIndex = flattenedVisibleItems.findIndex((i) => i.id === item.id);
                  const isSelected = itemIndex === selectedIndex;

                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        item.onSelect?.();
                        onOpenChange?.(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs sm:text-sm select-none transition-colors",
                        isSelected
                          ? "bg-selected text-foreground font-semibold"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      <span className="shrink-0">{item.icon || getDefaultIcon(item.group)}</span>
                      <div className="flex flex-1 items-center justify-between min-w-0 pr-1">
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground shrink-0 tabular-nums">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.shortcut && (
                        <Kbd className="ml-1 shrink-0">{item.shortcut}</Kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2">
            <span>↑↓ để di chuyển</span>
            <span>·</span>
            <span>Enter để mở</span>
          </div>
          <span>Esc để đóng</span>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
