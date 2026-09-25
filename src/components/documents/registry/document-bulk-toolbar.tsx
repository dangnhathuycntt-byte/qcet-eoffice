"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  Building2,
  CheckCircle2,
  Archive,
  X,
  CheckSquare,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { useDepartmentList } from "@/hooks/use-department-list";
import { motionSpring, motionDuration, motionEase } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

export type BulkActionType = "assign-unit" | "resolve" | "file";

export interface DocumentBulkToolbarProps {
  /** Số lượng văn bản đã chọn */
  selectedCount: number;
  /** Danh sách ID các văn bản đã chọn */
  selectedIds?: Set<string> | string[];
  /** Tổng số văn bản trên danh sách (hiển thị /tổng nếu có) */
  totalCount?: number;
  /** Callback xóa lựa chọn */
  onClearSelection: () => void;
  /** Callback làm mới dữ liệu sau khi thao tác hàng loạt thành công */
  onRefresh?: () => void | Promise<void>;
  /** Callback thông báo thành công */
  onSuccess?: (action: BulkActionType, count: number) => void;
  /** Callback thông báo lỗi */
  onError?: (error: string) => void;
  /** Tùy chọn class bổ sung */
  className?: string;
  /** Trạng thái đang tải từ bên ngoài */
  isLoading?: boolean;
}

interface ActionModalState {
  type: BulkActionType | null;
  isOpen: boolean;
}

/**
 * Component DocumentBulkToolbar:
 * Thanh công cụ thao tác hàng loạt cố định nổi ở đáy màn hình khi có văn bản được chọn.
 * Hỗ trợ các hành động: Giao đơn vị, Hoàn tất, Lưu hồ sơ, và Bỏ chọn (ESC).
 */
export function DocumentBulkToolbar({
  selectedCount,
  selectedIds,
  totalCount,
  onClearSelection,
  onRefresh,
  onSuccess,
  onError,
  className,
  isLoading = false,
}: DocumentBulkToolbarProps) {
  const [modalState, setModalState] = React.useState<ActionModalState>({
    type: null,
    isOpen: false,
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Form states cho từng loại modal
  const [selectedUnitId, setSelectedUnitId] = React.useState("");
  const [instruction, setInstruction] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [resolutionSummary, setResolutionSummary] = React.useState("");
  const [filingNotes, setFilingNotes] = React.useState("");
  const [archiveNow, setArchiveNow] = React.useState(false);

  const { departments, isLoading: isLoadingDepts } = useDepartmentList();

  // Chuyển đổi selectedIds sang array chuẩn
  const resolvedIds = React.useMemo(() => {
    if (!selectedIds) return [];
    if (selectedIds instanceof Set) {
      return Array.from(selectedIds);
    }
    return Array.isArray(selectedIds) ? selectedIds : [];
  }, [selectedIds]);

  const effectiveCount = selectedCount || resolvedIds.length;

  // Lắng nghe phím ESC để bỏ chọn khi không có modal nào mở
  React.useEffect(() => {
    if (effectiveCount <= 0 || modalState.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveCount, modalState.isOpen, onClearSelection]);

  const openModal = (type: BulkActionType) => {
    setErrorMessage(null);
    setSelectedUnitId("");
    setInstruction("");
    setDeadline("");
    setResolutionSummary("");
    setFilingNotes("");
    setArchiveNow(false);
    setModalState({ type, isOpen: true });
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setModalState({ type: null, isOpen: false });
    setErrorMessage(null);
  };

  // Thực thi gọi API /api/documents/batch
  const handleExecuteBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState.type || effectiveCount <= 0) return;

    // Validate theo từng loại hành động
    if (modalState.type === "assign-unit" && !selectedUnitId) {
      setErrorMessage("Vui lòng chọn đơn vị chủ trì thực hiện.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let apiAction = "ASSIGN_LEAD_UNIT";
      let payload: Record<string, any> = {
        documentIds: resolvedIds,
      };

      if (modalState.type === "assign-unit") {
        apiAction = "ASSIGN_LEAD_UNIT";
        payload = {
          action: apiAction,
          documentIds: resolvedIds,
          leadUnitId: selectedUnitId,
          instruction: instruction.trim() || undefined,
          leadershipInstruction: instruction.trim() || undefined,
          deadline: deadline || undefined,
        };
      } else if (modalState.type === "resolve") {
        apiAction = "MARK_RESOLVED";
        payload = {
          action: apiAction,
          documentIds: resolvedIds,
          resolutionSummary: resolutionSummary.trim() || "Hoàn tất xử lý hàng loạt",
        };
      } else if (modalState.type === "file") {
        apiAction = archiveNow ? "ARCHIVE_DOCUMENTS" : "FILE_DOCUMENTS";
        payload = {
          action: apiAction,
          documentIds: resolvedIds,
          filingNotes: filingNotes.trim() || undefined,
          archiveReason: filingNotes.trim() || undefined,
          archiveNow: archiveNow || undefined,
        };
      }

      const res = await fetch("/api/documents/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorDetail =
          json?.error ||
          json?.message ||
          (json?.errors && Array.isArray(json.errors) ? json.errors.join(", ") : null) ||
          "Xảy ra lỗi khi thực hiện thao tác hàng loạt";
        throw new Error(errorDetail);
      }

      onSuccess?.(modalState.type, effectiveCount);
      closeModal();
      onClearSelection();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      const msg = err?.message || "Không thể thực hiện thao tác hàng loạt";
      setErrorMessage(msg);
      onError?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBarVisible = effectiveCount > 0;

  return (
    <>
      <AnimatePresence>
        {isBarVisible && (
          <m.aside
            key="document-bulk-toolbar"
            role="region"
            aria-label="Thao tác hàng loạt trên văn bản"
            aria-live="polite"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: motionSpring.snappy,
            }}
            exit={{
              opacity: 0,
              y: 24,
              scale: 0.96,
              transition: {
                duration: motionDuration.fast,
                ease: motionEase.exit,
              },
            }}
            className={cn(
              "fixed bottom-6 inset-x-0 mx-auto w-fit z-40 max-w-[95vw] sm:max-w-max select-none",
              className
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md px-3 py-2 shadow-2xl text-foreground ring-1 ring-border/20">
              {/* Badge hiển thị số lượng */}
              <div className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 text-xs font-medium text-foreground whitespace-nowrap">
                <CheckSquare
                  className="size-4 text-primary shrink-0"
                  strokeWidth={1.75}
                />
                <span className="flex items-center gap-1">
                  Đã chọn{" "}
                  <strong className="font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                    {effectiveCount}
                  </strong>
                  {totalCount ? (
                    <span className="text-muted-foreground font-normal">
                      /{totalCount}
                    </span>
                  ) : null}
                  <span className="hidden xs:inline">văn bản</span>
                </span>
              </div>

              <div
                className="h-4 w-px bg-border/80 mx-0.5 shrink-0"
                aria-hidden="true"
              />

              {/* [Nút Giao đơn vị] */}
              <button
                type="button"
                onClick={() => openModal("assign-unit")}
                disabled={isLoading || isSubmitting}
                className={cn(
                  "h-8 px-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                  "text-foreground hover:bg-primary/10 hover:text-primary active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title="Giao đơn vị chủ trì xử lý các văn bản đã chọn"
              >
                <Building2 className="size-3.5 text-primary shrink-0" />
                <span>Giao đơn vị</span>
              </button>

              {/* [Nút Hoàn tất] */}
              <button
                type="button"
                onClick={() => openModal("resolve")}
                disabled={isLoading || isSubmitting}
                className={cn(
                  "h-8 px-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                  "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title="Đánh dấu hoàn tất xử lý các văn bản đã chọn"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Hoàn tất</span>
              </button>

              {/* [Nút Lưu hồ sơ] */}
              <button
                type="button"
                onClick={() => openModal("file")}
                disabled={isLoading || isSubmitting}
                className={cn(
                  "h-8 px-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                  "text-sky-700 dark:text-sky-400 hover:bg-sky-500/10 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title="Lập hồ sơ và đưa vào lưu trữ theo dõi"
              >
                <Archive className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Lưu hồ sơ</span>
              </button>

              <div
                className="h-4 w-px bg-border/80 mx-0.5 shrink-0"
                aria-hidden="true"
              />

              {/* [Nút Bỏ chọn (ESC)] */}
              <button
                type="button"
                onClick={onClearSelection}
                disabled={isLoading || isSubmitting}
                className={cn(
                  "h-8 pl-2 pr-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                  "text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                aria-label="Bỏ chọn tất cả văn bản"
                title="Bỏ chọn (Esc)"
              >
                <X className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Bỏ chọn</span>
                <kbd className="inline-flex items-center rounded border border-border/80 bg-muted/80 px-1 py-0.2 font-mono text-[10px] text-muted-foreground leading-none font-medium">
                  Esc
                </kbd>
              </button>
            </div>
          </m.aside>
        )}
      </AnimatePresence>

      {/* Dialog xác nhận hành động dùng @base-ui/react/dialog */}
      <BaseDialog.Root
        open={modalState.isOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-150 motion-safe:transition-opacity motion-safe:duration-150" />
          <BaseDialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none",
              "rounded-2xl border border-border bg-card p-6 shadow-2xl text-foreground",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-200"
            )}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "size-9 rounded-xl flex items-center justify-center shrink-0",
                    modalState.type === "assign-unit" &&
                      "bg-primary/10 text-primary border border-primary/20",
                    modalState.type === "resolve" &&
                      "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
                    modalState.type === "file" &&
                      "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                  )}
                >
                  {modalState.type === "assign-unit" && (
                    <Building2 className="size-5" />
                  )}
                  {modalState.type === "resolve" && (
                    <CheckCircle2 className="size-5" />
                  )}
                  {modalState.type === "file" && <Archive className="size-5" />}
                </div>
                <div>
                  <BaseDialog.Title className="text-base font-semibold text-foreground">
                    {modalState.type === "assign-unit" && "Giao đơn vị chủ trì"}
                    {modalState.type === "resolve" &&
                      "Xác nhận hoàn tất văn bản"}
                    {modalState.type === "file" && "Lưu trữ hồ sơ văn bản"}
                  </BaseDialog.Title>
                  <BaseDialog.Description className="text-xs text-muted-foreground mt-0.5">
                    Áp dụng đồng loạt cho{" "}
                    <strong className="text-foreground font-semibold">
                      {effectiveCount}
                    </strong>{" "}
                    văn bản đã chọn
                  </BaseDialog.Description>
                </div>
              </div>

              <BaseDialog.Close
                disabled={isSubmitting}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Đóng"
              >
                <X className="size-4" />
              </BaseDialog.Close>
            </div>

            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleExecuteBatch} className="mt-4 space-y-4">
              {/* Nội dung Form: Giao đơn vị */}
              {modalState.type === "assign-unit" && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="bulk-lead-unit"
                      className="text-xs font-semibold text-foreground flex items-center gap-1"
                    >
                      Đơn vị chủ trì thực hiện{" "}
                      <span className="text-destructive">*</span>
                    </label>
                    <select
                      id="bulk-lead-unit"
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                      disabled={isSubmitting || isLoadingDepts}
                      required
                      className="w-full h-9.5 px-3 text-xs rounded-xl border border-border/80 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="" disabled>
                        -- Chọn đơn vị tiếp nhận chủ trì --
                      </option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="bulk-instruction"
                      className="text-xs font-semibold text-foreground"
                    >
                      Ý kiến chỉ đạo / Yêu cầu xử lý
                    </label>
                    <textarea
                      id="bulk-instruction"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      disabled={isSubmitting}
                      rows={3}
                      placeholder="Nhập nội dung chỉ đạo hoặc phân công nhiệm vụ..."
                      className="w-full p-2.5 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="bulk-deadline"
                      className="text-xs font-semibold text-foreground flex items-center gap-1"
                    >
                      <Clock className="size-3.5 text-muted-foreground" />
                      Thời hạn hoàn thành
                    </label>
                    <input
                      type="date"
                      id="bulk-deadline"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full h-9.5 px-3 text-xs rounded-xl border border-border/80 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              )}

              {/* Nội dung Form: Hoàn tất */}
              {modalState.type === "resolve" && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">
                      Bạn đang thao tác đánh dấu hoàn tất xử lý cho{" "}
                      {effectiveCount} văn bản.
                    </p>
                    <p>
                      Trạng thái các văn bản sẽ được chuyển sang{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Đã hoàn thành (DA_HOAN_THANH)
                      </span>
                      .
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="bulk-resolution"
                      className="text-xs font-semibold text-foreground"
                    >
                      Tóm tắt kết quả giải quyết (tùy chọn)
                    </label>
                    <textarea
                      id="bulk-resolution"
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      disabled={isSubmitting}
                      rows={3}
                      placeholder="Ghi chú kết quả thực hiện, văn bản phúc đáp hoặc căn cứ hoàn thành..."
                      className="w-full p-2.5 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Nội dung Form: Lưu hồ sơ */}
              {modalState.type === "file" && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-800 dark:text-sky-300 space-y-1">
                    <p className="font-medium">
                      Lập hồ sơ lưu trữ cho {effectiveCount} văn bản đã chọn.
                    </p>
                    <p className="text-[11px] opacity-90">
                      Văn bản sẽ được đánh dấu lưu theo dõi và đưa vào danh mục
                      hồ sơ lưu trữ theo chuẩn quy định.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="bulk-filing-notes"
                      className="text-xs font-semibold text-foreground"
                    >
                      Ghi chú lưu hồ sơ / Vị trí lưu
                    </label>
                    <textarea
                      id="bulk-filing-notes"
                      value={filingNotes}
                      onChange={(e) => setFilingNotes(e.target.value)}
                      disabled={isSubmitting}
                      rows={3}
                      placeholder="Ghi chú nơi lưu trữ, tập hồ sơ số..."
                      className="w-full p-2.5 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="bulk-archive-now"
                      checked={archiveNow}
                      onChange={(e) => setArchiveNow(e.target.checked)}
                      disabled={isSubmitting}
                      className="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    />
                    <label
                      htmlFor="bulk-archive-now"
                      className="text-xs text-foreground cursor-pointer select-none"
                    >
                      Đưa thẳng vào kho lưu trữ lịch sử (Lưu trữ vĩnh viễn)
                    </label>
                  </div>
                </div>
              )}

              {/* Footer hành động của Dialog */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs rounded-xl"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className={cn(
                    "h-9 px-4 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer",
                    modalState.type === "assign-unit" &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                    modalState.type === "resolve" &&
                      "bg-emerald-600 text-white hover:bg-emerald-700",
                    modalState.type === "file" &&
                      "bg-sky-600 text-white hover:bg-sky-700"
                  )}
                >
                  {isSubmitting && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  <span>
                    {isSubmitting
                      ? "Đang xử lý..."
                      : modalState.type === "assign-unit"
                      ? "Xác nhận giao việc"
                      : modalState.type === "resolve"
                      ? "Xác nhận hoàn tất"
                      : "Lưu hồ sơ"}
                  </span>
                </Button>
              </div>
            </form>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </>
  );
}
