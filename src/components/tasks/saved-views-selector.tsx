"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
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
  defaultLabel?: string;
  className?: string;
}

export function SavedViewsSelector({
  user,
  activeViewId: controlledActiveViewId,
  currentCriteria,
  onSelectView,
  onSaveView,
  onDeleteView,
  onRenameView,
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

  // Canonical default view: "Tất cả nhiệm vụ"
  const defaultTaskView = React.useMemo<SavedTaskView>(() => ({
    id: "default-all",
    name: "Tất cả nhiệm vụ",
    isPreset: true,
    criteria: {
      scope: currentCriteria?.scope || "school",
      dept: "ALL",
      status: "all",
      workbox: "ALL",
      academicMonth: "ALL",
      q: "",
      viewMode: currentCriteria?.viewMode || "table",
      density: "compact",
    },
  }), [currentCriteria?.scope, currentCriteria?.viewMode]);

  const isDefaultActive =
    !effectiveActiveViewId ||
    effectiveActiveViewId === "default-all" ||
    !customViews.some((v) => v.id === effectiveActiveViewId);

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

  const handleSelectDefault = () => {
    applyView(defaultTaskView);
    onSelectView?.(defaultTaskView);
    setActiveViewId(null);
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
    if (effectiveActiveViewId === id) {
      handleSelectDefault();
    }
  };

  const inlineViews = customViews.slice(0, 3);
  const overflowViews = customViews.slice(3);

  return (
    <div
      className={cn("inline-flex items-center gap-0.5 shrink-0 select-none", className)}
      data-slot="saved-views-nav"
      role="navigation"
      aria-label="Góc nhìn công việc"
    >
      {/* 1. Default View: Tất cả nhiệm vụ */}
      <button
        type="button"
        role="tab"
        aria-selected={isDefaultActive}
        onClick={handleSelectDefault}
        className={cn(
          "inline-flex h-7 items-center rounded-md px-2 text-xs font-medium transition-colors cursor-pointer",
          isDefaultActive
            ? "bg-slate-100 text-slate-900 font-semibold"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        Tất cả nhiệm vụ
      </button>

      {/* 2. User-Created Saved Views (Inline) */}
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
                className="h-7 w-28 px-1.5 text-xs rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="size-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <Check className="size-3" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setEditingViewId(null)}
                className="size-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
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
                "inline-flex h-7 items-center rounded-md px-2 text-xs font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <span className="truncate max-w-[120px]">{cleanViewName(view.name)}</span>
            </button>

            {/* View options button (visible on hover or active) */}
            <button
              type="button"
              aria-label={`Tùy chọn góc nhìn ${view.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(activeMenuId === view.id ? null : view.id);
              }}
              className={cn(
                "size-5 -ml-1 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-opacity",
                isActive || activeMenuId === view.id
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              )}
            >
              <MoreHorizontal className="size-3" strokeWidth={1.5} />
            </button>

            {/* Context menu for this view */}
            {activeMenuId === view.id && (
              <div
                ref={menuRef}
                className="absolute left-0 top-full mt-1 w-32 rounded-md border border-slate-200/90 bg-white py-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-xs"
              >
                <button
                  type="button"
                  onClick={(e) => handleStartRename(view, e)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left cursor-pointer"
                >
                  <Pencil className="size-3 text-slate-400" />
                  <span>Đổi tên</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(view.id, e)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 text-rose-600 hover:bg-rose-50 text-left cursor-pointer"
                >
                  <Trash2 className="size-3 text-rose-500" />
                  <span>Xóa góc nhìn</span>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 3. Overflow views dropdown if user created > 3 views */}
      {overflowViews.length > 0 && (
        <div className="relative inline-block" ref={overflowRef}>
          <button
            type="button"
            onClick={() => setIsOverflowOpen((prev) => !prev)}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
            aria-label="Xem thêm góc nhìn đã lưu"
          >
            <span>+{overflowViews.length}</span>
            <ChevronDown className="size-3 text-slate-400" />
          </button>

          {isOverflowOpen && (
            <div className="absolute left-0 top-full mt-1 w-44 rounded-md border border-slate-200/90 bg-white py-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-xs">
              {overflowViews.map((view) => {
                const isActive = effectiveActiveViewId === view.id;
                return (
                  <div
                    key={view.id}
                    className={cn(
                      "group flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer",
                      isActive && "bg-slate-50 font-semibold text-slate-900"
                    )}
                    onClick={() => handleSelect(view)}
                  >
                    <span className="truncate flex-1">{cleanViewName(view.name)}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(view.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded"
                      title="Xóa góc nhìn"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. [+] Create new saved view button & lightweight popover */}
      <div className="relative inline-block" ref={createPopoverRef}>
        <button
          type="button"
          onClick={() => {
            setIsCreateOpen((prev) => !prev);
            setNewViewName("");
          }}
          aria-label="Tạo góc nhìn mới từ bộ lọc hiện tại"
          title="Tạo góc nhìn mới từ bộ lọc hiện tại"
          className={cn(
            "size-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer",
            isCreateOpen && "bg-slate-100 text-slate-700"
          )}
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
        </button>

        {isCreateOpen && (
          <div
            role="dialog"
            aria-label="Tạo góc nhìn mới"
            className="absolute left-0 top-full mt-1 w-64 rounded-md border border-slate-200/90 bg-white p-3 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            <div className="text-xs font-semibold text-slate-900 mb-1.5">
              Tạo góc nhìn mới
            </div>
            <form onSubmit={handleCreate}>
              <input
                ref={inputRef}
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Tên góc nhìn..."
                autoFocus
                className="w-full h-7 px-2 text-xs rounded border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 mb-1.5"
              />
              <p className="text-[11px] text-slate-400 mb-3">
                Lưu theo bộ lọc và điều kiện hiện tại
              </p>
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-6.5 px-2.5 text-xs text-slate-500 hover:text-slate-800 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newViewName.trim()}
                  className="h-6.5 px-3 text-xs font-medium rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  Tạo
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
