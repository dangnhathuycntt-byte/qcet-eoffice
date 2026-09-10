"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  Clock,
  UserCheck,
  AlertTriangle,
  FileEdit,
  Send,
  Building2,
  Calendar,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  User,
} from "lucide-react";
import type { SchoolBottleneckItem } from "@/types/workspace";
import type {
  ExecutiveResolutionType,
  ExecutiveResolutionPayload,
} from "@/types/executive-resolution";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ExecutiveResolutionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bottleneck: SchoolBottleneckItem | null;
  onConfirm: (payload: ExecutiveResolutionPayload) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Chưa xác định";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function ExecutiveResolutionDrawer({
  isOpen,
  onClose,
  bottleneck,
  onConfirm,
}: ExecutiveResolutionDrawerProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [selectedType, setSelectedType] =
    React.useState<ExecutiveResolutionType>("EXTEND_DEADLINE");
  const [extensionDays, setExtensionDays] = React.useState<3 | 7>(3);
  const [newAssigneeName, setNewAssigneeName] = React.useState("");
  const [directiveNote, setDirectiveNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Mount check for client portal
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when opening or bottleneck changes
  React.useEffect(() => {
    if (isOpen && bottleneck) {
      setSelectedType("EXTEND_DEADLINE");
      setExtensionDays(3);
      setNewAssigneeName("");
      setDirectiveNote("");
      setError(null);
    }
  }, [isOpen, bottleneck]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = React.useCallback(() => {
    if (!bottleneck) return;

    if (selectedType === "EXTEND_DEADLINE") {
      onConfirm({
        taskId: bottleneck.id,
        type: "EXTEND_DEADLINE",
        extensionDays,
      });
      onClose();
    } else if (selectedType === "REASSIGN") {
      if (!newAssigneeName.trim()) {
        setError("Vui lòng nhập họ tên cán bộ tiếp nhận mới.");
        return;
      }
      onConfirm({
        taskId: bottleneck.id,
        type: "REASSIGN",
        newAssigneeName: newAssigneeName.trim(),
      });
      onClose();
    } else if (selectedType === "DEMAND_EXPLANATION") {
      onConfirm({
        taskId: bottleneck.id,
        type: "DEMAND_EXPLANATION",
      });
      onClose();
    } else if (selectedType === "DIRECT_DIRECTIVE") {
      if (!directiveNote.trim()) {
        setError("Vui lòng nhập nội dung bút phê chỉ đạo của BGH.");
        return;
      }
      onConfirm({
        taskId: bottleneck.id,
        type: "DIRECT_DIRECTIVE",
        directiveNote: directiveNote.trim(),
      });
      onClose();
    }
  }, [
    bottleneck,
    selectedType,
    extensionDays,
    newAssigneeName,
    directiveNote,
    onConfirm,
    onClose,
  ]);

  // Keyboard shortcut listener: Esc to close, Cmd+Enter / Ctrl+Enter to submit
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleSubmit]);

  if (!mounted || !isOpen || !bottleneck) {
    return null;
  }

  const isOverdue = Boolean(bottleneck.isOverdue || (bottleneck.daysOverdue && bottleneck.daysOverdue > 0));

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="executive-resolution-drawer-title"
        className="relative z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-right overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/80 px-5 py-4 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 shrink-0 border border-rose-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2
                  id="executive-resolution-drawer-title"
                  className="text-base font-bold tracking-tight text-foreground"
                >
                  Chỉ đạo Tháo gỡ Điểm nghẽn
                </h2>
                <Badge variant="rose" className="text-xs">
                  BGH Quyết định
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Quyết định tháo gỡ trực tiếp và cập nhật tiến độ tức thì
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 thin-scrollbar">
          {/* 1. Task Context Summary */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>{bottleneck.departmentName} ({bottleneck.departmentCode})</span>
              </div>
              {isOverdue ? (
                <Badge variant="rose" className="text-xs font-semibold">
                  Chậm {bottleneck.daysOverdue ?? 1} ngày
                </Badge>
              ) : (
                <Badge variant="amber" className="text-xs font-semibold">
                  Cần tháo gỡ
                </Badge>
              )}
            </div>

            {/* Task Title (15px font-bold) */}
            <h3 className="text-[15px] font-bold text-foreground leading-snug">
              {bottleneck.title}
            </h3>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">Phụ trách: <strong className="font-semibold text-foreground">{bottleneck.assigneeName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">Hạn chót: <strong className="font-semibold text-foreground">{formatDate(bottleneck.dueDate)}</strong></span>
              </div>
            </div>

            {/* Blocked Reason callout if available */}
            {bottleneck.blockedReason && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-rose-700">
                  <span className="font-semibold">Vướng mắc: </span>
                  {bottleneck.blockedReason}
                </div>
              </div>
            )}
          </div>

          {/* 2. Resolution Action Options Heading */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Phương án tháo gỡ của Ban Giám hiệu
              </h4>
              <span className="text-xs text-muted-foreground">Chọn 1 phương án</span>
            </div>

            {/* Option Cards */}
            <div className="space-y-2.5">
              {/* Option 1: EXTEND_DEADLINE */}
              <div
                onClick={() => {
                  setSelectedType("EXTEND_DEADLINE");
                  setError(null);
                }}
                className={cn(
                  "rounded-xl border p-3.5 transition-all cursor-pointer select-none",
                  selectedType === "EXTEND_DEADLINE"
                    ? "border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/40"
                    : "border-border/70 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 transition-colors",
                      selectedType === "EXTEND_DEADLINE"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Gia hạn tiến độ thêm
                      </span>
                      {selectedType === "EXTEND_DEADLINE" && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kéo dài hạn chót thực hiện và tự động gỡ cảnh báo quá hạn
                    </p>

                    {/* Sub-controls for Extend Deadline */}
                    {selectedType === "EXTEND_DEADLINE" && (
                      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/50">
                        <span className="text-xs font-medium text-foreground">Thời gian gia hạn:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExtensionDays(3);
                            }}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                              extensionDays === 3
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card text-foreground border-border hover:bg-muted"
                            )}
                          >
                            +3 ngày (Mặc định)
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExtensionDays(7);
                            }}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                              extensionDays === 7
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card text-foreground border-border hover:bg-muted"
                            )}
                          >
                            +7 ngày (1 tuần)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 2: REASSIGN */}
              <div
                onClick={() => {
                  setSelectedType("REASSIGN");
                  setError(null);
                }}
                className={cn(
                  "rounded-xl border p-3.5 transition-all cursor-pointer select-none",
                  selectedType === "REASSIGN"
                    ? "border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/40"
                    : "border-border/70 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 transition-colors",
                      selectedType === "REASSIGN"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Giao cán bộ khác xử lý thay thế
                      </span>
                      {selectedType === "REASSIGN" && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Chỉ định nhân sự phù hợp hơn để tiếp nhận và giải quyết dứt điểm
                    </p>

                    {/* Sub-controls for Reassign */}
                    {selectedType === "REASSIGN" && (
                      <div className="mt-3 space-y-1.5 pt-2 border-t border-border/50">
                        <label className="text-xs font-semibold text-foreground block">
                          Họ tên cán bộ tiếp nhận mới:
                        </label>
                        <Input
                          type="text"
                          value={newAssigneeName}
                          onChange={(e) => {
                            setNewAssigneeName(e.target.value);
                            if (error) setError(null);
                          }}
                          placeholder="Ví dụ: TS. Trần Minh Quang hoặc ThS. Nguyễn Văn A..."
                          className="h-9 text-xs"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 3: DEMAND_EXPLANATION */}
              <div
                onClick={() => {
                  setSelectedType("DEMAND_EXPLANATION");
                  setError(null);
                }}
                className={cn(
                  "rounded-xl border p-3.5 transition-all cursor-pointer select-none",
                  selectedType === "DEMAND_EXPLANATION"
                    ? "border-rose-500/60 bg-rose-500/5 shadow-xs ring-1 ring-rose-500/40"
                    : "border-border/70 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 transition-colors",
                      selectedType === "DEMAND_EXPLANATION"
                        ? "bg-rose-600 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          Yêu cầu giải trình khẩn
                        </span>
                        <Badge variant="rose" className="text-xs font-bold px-1.5 py-0">
                          Khẩn cấp
                        </Badge>
                      </div>
                      {selectedType === "DEMAND_EXPLANATION" && (
                        <CheckCircle2 className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gửi lệnh hỏa tốc yêu cầu Trưởng đơn vị báo cáo nguyên nhân và kế hoạch trong 24h
                    </p>

                    {/* Sub-controls for Demand Explanation */}
                    {selectedType === "DEMAND_EXPLANATION" && (
                      <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-700 leading-relaxed">
                        Lệnh giải trình sẽ gửi trực tiếp đến Trưởng đơn vị{" "}
                        <strong>{bottleneck.departmentName}</strong>. Thời hạn phản hồi được giám sát tự động trong vòng 24 giờ kể từ khi ban hành.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 4: DIRECT_DIRECTIVE */}
              <div
                onClick={() => {
                  setSelectedType("DIRECT_DIRECTIVE");
                  setError(null);
                }}
                className={cn(
                  "rounded-xl border p-3.5 transition-all cursor-pointer select-none",
                  selectedType === "DIRECT_DIRECTIVE"
                    ? "border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/40"
                    : "border-border/70 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 transition-colors",
                      selectedType === "DIRECT_DIRECTIVE"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <FileEdit className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Ban hành bút phê chỉ đạo trực tiếp
                      </span>
                      {selectedType === "DIRECT_DIRECTIVE" && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bút phê chỉ đạo cụ thể của BGH để các đơn vị thực hiện ngay
                    </p>

                    {/* Sub-controls for Direct Directive */}
                    {selectedType === "DIRECT_DIRECTIVE" && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-border/50">
                        <label className="text-xs font-semibold text-foreground block">
                          Nội dung bút phê chỉ đạo của BGH:
                        </label>
                        <textarea
                          rows={3}
                          value={directiveNote}
                          onChange={(e) => {
                            setDirectiveNote(e.target.value);
                            if (error) setError(null);
                          }}
                          placeholder="Ví dụ: Giao Phòng Đào tạo chủ trì phối hợp giải quyết dứt điểm trước 17h ngày mai..."
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Gợi ý chỉ đạo nhanh:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              "Giao Trưởng đơn vị chủ trì giải quyết dứt điểm trước 17h ngày mai.",
                              "Tập trung tối đa nhân sự hoàn thành đúng tiến độ, báo cáo BGH.",
                              "Ưu tiên tháo gỡ dứt điểm điểm nghẽn này trước các việc phát sinh.",
                            ].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDirectiveNote(preset);
                                  if (error) setError(null);
                                }}
                                className="text-xs px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors text-left"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Validation error message if present */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 flex items-center gap-2 text-xs text-destructive font-medium animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions */}
        <div className="border-t border-border/80 px-5 py-3.5 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            <span>Phím tắt:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground font-mono text-xs">Esc</kbd>
            <span>đóng,</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground font-mono text-xs">⌘↵</kbd>
            <span>xác nhận</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSubmit}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs gap-1.5 shadow-xs cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Xác nhận chỉ đạo tháo gỡ</span>
              <kbd className="hidden sm:inline-flex items-center ml-1 px-1 py-0.2 rounded bg-white/20 text-white font-mono text-xs">
                ⌘↵
              </kbd>
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
