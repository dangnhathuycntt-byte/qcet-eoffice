"use client";

import * as React from "react";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  Layers,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";
import {
  type SavedTaskView,
  type TaskViewCriteria,
  useSavedViews,
  getRolePresetViews,
  resolveUserSavedViewRole,
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
  /** Label shown on the trigger button when no view is active. Defaults to "Góc nhìn". */
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
  defaultLabel = "Góc nhìn: Tất cả nhiệm vụ",
  className,
}: SavedViewsSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");
  const [editingViewId, setEditingViewId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    presetViews,
    customViews,
    allViews,
    activeViewId: internalActiveViewId,
    activeView,
    isCurrentCriteriaMatching,
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
  const effectiveActiveView =
    allViews.find((v) => v.id === effectiveActiveViewId) || activeView;

  // Outside click & Escape listener
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setEditingViewId(null);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setEditingViewId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const handleSelect = (view: SavedTaskView) => {
    applyView(view);
    onSelectView?.(view);
    setIsOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewName.trim();
    if (!trimmed) return;

    const saved = saveCurrentView(trimmed);
    onSaveView?.(saved);
    onSelectView?.(saved);
    setNewViewName("");
    setIsOpen(false);
  };

  const handleStartRename = (view: SavedTaskView, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingViewId(view.id);
    setEditingName(view.name);
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

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingViewId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteView(id);
    onDeleteView?.(id);
  };

  const getScopeBadge = (scope: "school" | "unit" | "my") => {
    if (scope === "school") {
      return (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/80">
          Trường
        </span>
      );
    }
    if (scope === "unit") {
      return (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/80">
          Đơn vị
        </span>
      );
    }
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/80">
        Cá nhân
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
      data-slot="saved-views-selector"
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Chọn hoặc lưu góc nhìn nhiệm vụ"
        className={cn(
          "inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[36px] sm:h-9 px-3 sm:px-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer select-none",
          effectiveActiveView
            ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10 shadow-2xs font-semibold"
            : "border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <Bookmark
          className={cn(
            "size-3.5 shrink-0",
            effectiveActiveView ? "text-primary" : "text-muted-foreground"
          )}
          strokeWidth={1.5}
        />
        <span className="truncate max-w-[130px] sm:max-w-[160px] text-left">
          {effectiveActiveView
            ? effectiveActiveView.name.startsWith("Góc nhìn")
              ? cleanViewName(effectiveActiveView.name)
              : `Góc nhìn: ${cleanViewName(effectiveActiveView.name)}`
            : defaultLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Quản lý góc nhìn nhiệm vụ"
          className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-[310px] sm:w-[340px] z-50 rounded-2xl border border-border/80 bg-card p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold text-foreground">
                Góc nhìn nhiệm vụ
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng bảng chọn góc nhìn"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="max-h-[340px] overflow-y-auto py-2 space-y-3.5">
            {/* Section 1: Role Presets */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Mặc định cho vai trò
                </span>
                <span className="text-xs text-muted-foreground">Mặc định</span>
              </div>
              <div className="space-y-1">
                {presetViews.map((preset) => {
                  const isActive = effectiveActiveViewId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelect(preset)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 p-2 rounded-xl text-left text-xs transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px]",
                        isActive
                          ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                          : "hover:bg-muted/70 text-foreground border border-transparent"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{cleanViewName(preset.name)}</span>
                          {getScopeBadge(preset.criteria.scope)}
                        </div>
                        {preset.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {preset.description}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <Check className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Custom Saved Views */}
            <div className="pt-2 border-t border-border/60">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Góc nhìn tùy chỉnh
                </span>
                <span className="text-xs text-muted-foreground">
                  {customViews.length}
                </span>
              </div>

              {customViews.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                  Chưa có góc nhìn tùy chỉnh nào.
                </div>
              ) : (
                <div className="space-y-1">
                  {customViews.map((view) => {
                    const isActive = effectiveActiveViewId === view.id;
                    const isEditing = editingViewId === view.id;

                    if (isEditing) {
                      return (
                        <form
                          key={view.id}
                          onSubmit={(e) => handleConfirmRename(view.id, e)}
                          className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border"
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 min-h-[36px] px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            type="submit"
                            aria-label="Xác nhận đổi tên"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            aria-label="Hủy đổi tên"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={view.id}
                        onClick={() => handleSelect(view)}
                        className={cn(
                          "group w-full flex items-center justify-between gap-2 p-2 rounded-xl text-left text-xs transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px]",
                          isActive
                            ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                            : "hover:bg-muted/70 text-foreground border border-transparent"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{cleanViewName(view.name)}</span>
                            {getScopeBadge(view.criteria.scope)}
                          </div>
                        </div>

                        {/* Inline actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <Check className="size-4 text-primary mr-0.5" strokeWidth={1.5} />
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(view, e)}
                            aria-label={`Đổi tên góc nhìn ${view.name}`}
                            className="min-h-[32px] min-w-[32px] p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(view.id, e)}
                            aria-label={`Xóa góc nhìn ${view.name}`}
                            className="min-h-[32px] min-w-[32px] p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Save Current View Form */}
          <form
            onSubmit={handleSave}
            className="pt-2.5 mt-1 border-t border-border/60 flex items-center gap-1.5"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Lưu bộ lọc hiện tại..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              aria-label="Tên góc nhìn mới"
              className="flex-1 min-h-[44px] sm:min-h-[34px] px-2.5 rounded-xl border border-border/80 bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1.5 focus:ring-primary/40 focus:border-primary"
            />
            <button
              type="submit"
              disabled={!newViewName.trim()}
              aria-label="Lưu góc nhìn hiện tại"
              className={cn(
                "inline-flex items-center justify-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 rounded-xl text-xs font-semibold shrink-0 transition-colors select-none",
                newViewName.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/95 shadow-xs cursor-pointer active:scale-98"
                  : "bg-muted text-muted-foreground border border-border/60 cursor-not-allowed"
              )}
            >
              <BookmarkPlus className="size-3.5" />
              <span>Lưu</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
