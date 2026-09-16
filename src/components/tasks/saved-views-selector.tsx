"use client";

import * as React from "react";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";
import {
  type SavedTaskView,
  type TaskViewCriteria,
  useSavedViews,
  cleanViewName,
} from "@/lib/saved-views/saved-views-store";

export interface SavedViewsSelectorProps {
  user?: AuthUser | null;
  activeViewId?: string | null;
  currentCriteria?: TaskViewCriteria;
  onSelectView?: (view: SavedTaskView) => void;
  onSaveView?: (newView: SavedTaskView) => void;
  onDeleteView?: (viewId: string) => void;
  onRenameView?: (viewId: string, newName: string) => void;
  availableDepartments?: Array<{ code: string; name: string }>;
  defaultLabel?: string;
  className?: string;
}

/**
 * Generate an intuitive smart name suggestion based on active filter criteria.
 */
function suggestFilterName(
  criteria?: TaskViewCriteria,
  availableDepartments?: Array<{ code: string; name: string }>
): string {
  if (!criteria) return "Bộ lọc tùy chỉnh";
  const parts: string[] = [];

  if (criteria.q && criteria.q.trim()) {
    parts.push(`Tìm "${criteria.q.trim()}"`);
  }

  if (criteria.dept && criteria.dept !== "ALL") {
    const found = availableDepartments?.find((d) => d.code === criteria.dept);
    parts.push(found ? found.name : criteria.dept);
  }

  if (criteria.status && criteria.status !== "all" && criteria.status !== "ALL") {
    if (criteria.status === "overdue") parts.push("Quá hạn");
    else if (criteria.status === "this_week" || criteria.status === "today") parts.push("Đến hạn tuần này");
    else if (criteria.status === "waiting_approval" || criteria.status === "review") parts.push("Chờ duyệt");
    else if (criteria.status === "in_progress") parts.push("Đang thực hiện");
    else if (criteria.status === "completed") parts.push("Hoàn thành");
    else parts.push(criteria.status);
  }

  if (criteria.priority && criteria.priority !== "ALL") {
    if (criteria.priority === "URGENT") parts.push("Khẩn cấp");
    else if (criteria.priority === "HIGH") parts.push("Ưu tiên cao");
  }

  if (criteria.category && criteria.category !== "ALL") {
    parts.push(criteria.category);
  }

  if (criteria.academicMonth && criteria.academicMonth !== "ALL") {
    parts.push(`Tháng ${criteria.academicMonth}`);
  }

  return parts.length > 0 ? parts.join(" - ") : "Bộ lọc tùy chỉnh";
}

export function SavedViewsSelector({
  user,
  activeViewId: controlledActiveViewId,
  currentCriteria,
  onSelectView,
  onSaveView,
  onDeleteView,
  onRenameView,
  availableDepartments,
  className,
}: SavedViewsSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const [editingViewId, setEditingViewId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [isOverflowOpen, setIsOverflowOpen] = React.useState(false);

  const createPopoverRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const overflowRef = React.useRef<HTMLDivElement>(null);

  const {
    customViews,
    activeViewId: internalActiveViewId,
    saveCurrentView,
    renameView,
    deleteView,
    applyView,
    setActiveViewId,
  } = useSavedViews({
    user,
    currentCriteria,
    onApplyView: (view) => {
      onSelectView?.(view);
    },
    initialViewId: controlledActiveViewId || undefined,
  });

  // Synchronize controlled activeViewId when prop changes
  React.useEffect(() => {
    if (controlledActiveViewId !== undefined) {
      setActiveViewId(controlledActiveViewId);
    }
  }, [controlledActiveViewId, setActiveViewId]);

  const effectiveActiveViewId = controlledActiveViewId ?? internalActiveViewId;

  // Detect whether active custom filters exist
  const hasActiveFilters = React.useMemo(() => {
    if (!currentCriteria) return false;
    const isStatusActive =
      currentCriteria.status &&
      currentCriteria.status !== "all" &&
      currentCriteria.status !== "ALL";
    const isDeptActive = currentCriteria.dept && currentCriteria.dept !== "ALL";
    const isWorkboxActive = currentCriteria.workbox && currentCriteria.workbox !== "ALL";
    const isQueryActive = Boolean(currentCriteria.q && currentCriteria.q.trim().length > 0);
    const isCategoryActive = currentCriteria.category && currentCriteria.category !== "ALL";
    const isPriorityActive = currentCriteria.priority && currentCriteria.priority !== "ALL";
    const isMonthActive =
      currentCriteria.academicMonth !== undefined && currentCriteria.academicMonth !== "ALL";

    return Boolean(
      isStatusActive ||
      isDeptActive ||
      isWorkboxActive ||
      isQueryActive ||
      isCategoryActive ||
      isPriorityActive ||
      isMonthActive
    );
  }, [currentCriteria]);

  // Human-readable summary of active filter criteria
  const activeCriteriaSummary = React.useMemo(() => {
    if (!currentCriteria) return [];
    const items: Array<{ label: string; value: string }> = [];

    if (currentCriteria.q && currentCriteria.q.trim()) {
      items.push({ label: "Từ khóa", value: `"${currentCriteria.q.trim()}"` });
    }
    if (currentCriteria.dept && currentCriteria.dept !== "ALL") {
      const found = availableDepartments?.find((d) => d.code === currentCriteria.dept);
      items.push({ label: "Đơn vị", value: found ? found.name : currentCriteria.dept });
    }
    if (currentCriteria.status && currentCriteria.status !== "all" && currentCriteria.status !== "ALL") {
      let statusLabel = currentCriteria.status;
      if (currentCriteria.status === "overdue") statusLabel = "Quá hạn";
      else if (currentCriteria.status === "this_week" || currentCriteria.status === "today") statusLabel = "Đến hạn tuần này";
      else if (currentCriteria.status === "waiting_approval" || currentCriteria.status === "review") statusLabel = "Chờ duyệt";
      items.push({ label: "Trạng thái", value: statusLabel });
    }
    if (currentCriteria.priority && currentCriteria.priority !== "ALL") {
      items.push({ label: "Ưu tiên", value: currentCriteria.priority });
    }
    if (currentCriteria.category && currentCriteria.category !== "ALL") {
      items.push({ label: "Danh mục", value: currentCriteria.category });
    }
    if (currentCriteria.academicMonth && currentCriteria.academicMonth !== "ALL") {
      items.push({ label: "Kỳ tháng", value: `Tháng ${currentCriteria.academicMonth}` });
    }

    return items;
  }, [currentCriteria, availableDepartments]);

  // Outside click & Escape listener for create popover
  React.useEffect(() => {
    if (!isCreateOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCreateOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (createPopoverRef.current && !createPopoverRef.current.contains(e.target as Node)) {
        setIsCreateOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreateOpen]);

  // Outside click for view action menu
  React.useEffect(() => {
    if (!activeMenuId) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuId]);

  // Outside click for overflow menu
  React.useEffect(() => {
    if (!isOverflowOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOverflowOpen]);

  const handleOpenCreate = () => {
    const suggested = suggestFilterName(currentCriteria, availableDepartments);
    setNewViewName(suggested);
    setIsCreateOpen(true);
  };

  const handleSelect = (view: SavedTaskView) => {
    applyView(view);
    onSelectView?.(view);
    setIsOverflowOpen(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewName.trim();
    if (!trimmed) return;

    const saved = saveCurrentView(trimmed);
    onSaveView?.(saved);
    onSelectView?.(saved);
    setNewViewName("");
    setIsCreateOpen(false);
  };

  const handleStartRename = (view: SavedTaskView, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingViewId(view.id);
    setEditingName(view.name);
    setActiveMenuId(null);
  };

  const handleConfirmRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = editingName.trim();
    if (trimmed) {
      renameView(id, trimmed);
      onRenameView?.(id, trimmed);
    }
    setEditingViewId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteView(id);
    onDeleteView?.(id);
    setActiveMenuId(null);
  };

  const inlineViews = customViews.slice(0, 3);
  const overflowViews = customViews.slice(3);

  return (
    <div
      className={cn("inline-flex items-center gap-1 shrink-0 select-none", className)}
      data-slot="saved-filters-nav"
      role="navigation"
      aria-label="Bộ lọc đã lưu"
    >
      {/* 1. Saved Filter Pills (1-click active + edit/delete) */}
      {inlineViews.map((view) => {
        const isActive = effectiveActiveViewId === view.id;
        const isEditing = editingViewId === view.id;

        if (isEditing) {
          return (
            <form
              key={view.id}
              onSubmit={(e) => handleConfirmRename(view.id, e)}
              className="inline-flex items-center gap-1"
            >
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                className="h-7 w-28 px-1.5 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                title="Xác nhận đổi tên"
              >
                <Check className="size-3" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setEditingViewId(null)}
                className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                title="Hủy"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            </form>
          );
        }

        return (
          <div key={view.id} className="relative group inline-flex items-center">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelect(view)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-muted text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Bookmark className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="truncate max-w-[120px]">{cleanViewName(view.name)}</span>
            </button>

            {/* Context action trigger */}
            <button
              type="button"
              aria-label={`Tùy chọn bộ lọc ${view.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(activeMenuId === view.id ? null : view.id);
              }}
              className={cn(
                "size-5 -ml-1 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-opacity",
                isActive || activeMenuId === view.id
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              )}
            >
              <MoreHorizontal className="size-3" strokeWidth={1.5} />
            </button>

            {/* Context menu for rename / delete */}
            {activeMenuId === view.id && (
              <div
                ref={menuRef}
                className="absolute left-0 top-full mt-1 w-32 rounded-md border border-border bg-popover py-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
              >
                <button
                  type="button"
                  onClick={(e) => handleStartRename(view, e)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 text-foreground hover:bg-accent text-left cursor-pointer"
                >
                  <Pencil className="size-3 text-muted-foreground" strokeWidth={1.5} />
                  <span>Đổi tên</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(view.id, e)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 text-rose-600 hover:bg-rose-50 text-left cursor-pointer"
                >
                  <Trash2 className="size-3 text-rose-500" strokeWidth={1.5} />
                  <span>Xóa bộ lọc</span>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 2. Overflow Views Dropdown (> 3 views) */}
      {overflowViews.length > 0 && (
        <div className="relative inline-block" ref={overflowRef}>
          <button
            type="button"
            onClick={() => setIsOverflowOpen((prev) => !prev)}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            aria-label="Xem thêm bộ lọc đã lưu"
          >
            <span>+{overflowViews.length}</span>
            <ChevronDown className="size-3 text-muted-foreground" strokeWidth={1.5} />
          </button>

          {isOverflowOpen && (
            <div className="absolute left-0 top-full mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground">
              {overflowViews.map((view) => {
                const isActive = effectiveActiveViewId === view.id;
                return (
                  <div
                    key={view.id}
                    className={cn(
                      "group flex items-center justify-between px-2.5 py-1.5 hover:bg-accent cursor-pointer",
                      isActive && "bg-accent font-semibold text-foreground"
                    )}
                    onClick={() => handleSelect(view)}
                  >
                    <span className="truncate flex-1">{cleanViewName(view.name)}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(view.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600 p-0.5 rounded cursor-pointer"
                      title="Xóa bộ lọc"
                    >
                      <Trash2 className="size-3" strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. [+] "Lưu bộ lọc" Button & Contextual Modal/Popover */}
      {hasActiveFilters && (
        <div className="relative inline-block" ref={createPopoverRef}>
          <button
            type="button"
            onClick={handleOpenCreate}
            aria-label="Lưu cấu hình bộ lọc hiện tại"
            title="Lưu các điều kiện lọc đang chọn thành bộ lọc nhanh"
            className={cn(
              "h-7 flex items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-2xs",
              isCreateOpen && "bg-primary/20"
            )}
          >
            <BookmarkPlus className="size-3.5 text-primary" strokeWidth={1.5} />
            <span>Lưu bộ lọc</span>
          </button>

          {isCreateOpen && (
            <div
              role="dialog"
              aria-label="Lưu bộ lọc mới"
              className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-80 rounded-md border border-border bg-popover p-3.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-popover-foreground"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/60">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BookmarkPlus className="size-3.5 text-primary" strokeWidth={1.5} />
                  <span>Lưu bộ lọc hiện tại</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Active Conditions List */}
              {activeCriteriaSummary.length > 0 && (
                <div className="mb-3 p-2 rounded bg-muted/60 border border-border/60 text-xs">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                    Điều kiện đang áp dụng:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeCriteriaSummary.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background text-foreground border border-border/80 text-[11px]"
                      >
                        <span className="text-muted-foreground">{item.label}:</span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Name input with pre-filled smart suggestion */}
              <form onSubmit={handleCreate}>
                <div className="mb-3">
                  <label htmlFor="filter-name-input" className="block text-[11px] font-medium text-foreground mb-1">
                    Tên bộ lọc (gợi ý tự động, có thể sửa):
                  </label>
                  <input
                    id="filter-name-input"
                    ref={inputRef}
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder="VD: Việc CNTT quá hạn..."
                    autoFocus
                    className="w-full h-8 px-2.5 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!newViewName.trim()}
                    className="h-7 px-3.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                  >
                    Lưu bộ lọc
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SavedViewsSelector;
