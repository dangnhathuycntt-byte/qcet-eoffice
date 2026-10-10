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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StandardDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
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
  const unitFieldRef = React.useRef<HTMLDivElement>(null);
  const [instruction, setInstruction] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [resolutionSummary, setResolutionSummary] = React.useState("");
  const [filingNotes, setFilingNotes] = React.useState("");

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
      unitFieldRef.current?.querySelector("button")?.focus();
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
        apiAction = "FILE_DOCUMENTS";
        payload = {
          action: apiAction,
          documentIds: resolvedIds,
          filingNotes: filingNotes.trim() || undefined,
          archiveReason: filingNotes.trim() || undefined,
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
            <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-1 shadow-lg text-foreground">
              {/* Badge hiển thị số lượng */}
              <div className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 text-compact font-medium text-foreground whitespace-nowrap">
                <CheckSquare
                  className="size-3.5 text-primary shrink-0"
                  strokeWidth={1.5}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModal("assign-unit")}
                disabled={isLoading || isSubmitting}
                className="text-foreground"
                title="Giao đơn vị chủ trì xử lý các văn bản đã chọn"
              >
                <Building2 className="text-primary" strokeWidth={1.5} />
                <span>Giao đơn vị</span>
              </Button>

              {/* [Nút Hoàn tất] */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModal("resolve")}
                disabled={isLoading || isSubmitting}
                className="text-foreground"
                title="Đánh dấu hoàn tất xử lý các văn bản đã chọn"
              >
                <CheckCircle2 className="text-emerald-600" strokeWidth={1.5} />
                <span>Hoàn tất</span>
              </Button>

              {/* [Nút Lưu hồ sơ] */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModal("file")}
                disabled={isLoading || isSubmitting}
                className="text-foreground"
                title="Lập hồ sơ và đưa vào lưu trữ theo dõi"
              >
                <Archive className="text-primary" strokeWidth={1.5} />
                <span>Lưu hồ sơ</span>
              </Button>

              <div
                className="h-4 w-px bg-border/80 mx-0.5 shrink-0"
                aria-hidden="true"
              />

              {/* [Nút Bỏ chọn (ESC)] */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                disabled={isLoading || isSubmitting}
                aria-label="Bỏ chọn tất cả văn bản"
                title="Bỏ chọn (Esc)"
              >
                <X strokeWidth={1.5} />
                <span className="hidden sm:inline">Bỏ chọn</span>
                <kbd className="inline-flex items-center rounded border border-border/80 bg-muted/80 px-1 font-mono text-xs text-muted-foreground leading-none font-medium">
                  Esc
                </kbd>
              </Button>
            </div>
          </m.aside>
        )}
      </AnimatePresence>

      {/* Dialog xác nhận hành động hàng loạt */}
      <StandardDialog
      compact
        open={modalState.isOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        title={
          modalState.type === "assign-unit"
            ? "Giao đơn vị chủ trì"
            : modalState.type === "resolve"
            ? "Xác nhận hoàn tất văn bản"
            : "Lưu trữ hồ sơ văn bản"
        }
        description={`Áp dụng đồng loạt cho ${effectiveCount} văn bản đã chọn`}
        size="md"
      >
        {errorMessage && (
          <div role="alert" className="mb-3 flex items-center gap-1.5 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleExecuteBatch} noValidate className="space-y-3">
          {/* Nội dung Form: Giao đơn vị */}
          {modalState.type === "assign-unit" && (
            <div className="space-y-3">
              <div ref={unitFieldRef}>
              <FormField label="Đơn vị chủ trì thực hiện">
                <Select
                  compact
                  positionerClassName="z-50"
                  placeholder="Chọn đơn vị tiếp nhận chủ trì"
                  options={departments.map((dept) => ({ value: dept.id, label: `${dept.name} (${dept.code})` }))}
                  value={selectedUnitId || null}
                  onValueChange={(v) => setSelectedUnitId(v ?? "")}
                  disabled={isSubmitting || isLoadingDepts}
                  required
                />
              </FormField>
              </div>

              <FormField label="Ý kiến chỉ đạo / yêu cầu xử lý" optional>
                <Textarea
                  compact
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder="Nhập nội dung chỉ đạo hoặc phân công nhiệm vụ..."
                  className="resize-none"
                />
              </FormField>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bulk-deadline" className="text-xs font-medium text-foreground">
                  Thời hạn hoàn thành
                  <span className="ml-1.5 font-normal text-muted-foreground">(không bắt buộc)</span>
                </label>
                <VietnameseDatePicker
                  id="bulk-deadline"
                  variant="input"
                  value={deadline}
                  onChange={(val) => setDeadline(val)}
                  disabled={isSubmitting}
                  triggerClassName="h-11 sm:h-7 rounded-md px-2"
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Nội dung Form: Hoàn tất */}
          {modalState.type === "resolve" && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  Bạn đang thao tác đánh dấu hoàn tất xử lý cho {effectiveCount} văn bản.
                </p>
                <p>
                  Trạng thái các văn bản sẽ được chuyển sang{" "}
                  <span className="font-semibold text-emerald-700">Đã hoàn thành (DA_HOAN_THANH)</span>.
                </p>
              </div>

              <FormField label="Tóm tắt kết quả giải quyết" optional>
                <Textarea
                  compact
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder="Ghi chú kết quả thực hiện, văn bản phúc đáp hoặc căn cứ hoàn thành..."
                  className="resize-none"
                />
              </FormField>
            </div>
          )}

          {/* Nội dung Form: Lưu hồ sơ */}
          {modalState.type === "file" && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  Lập hồ sơ lưu trữ cho {effectiveCount} văn bản đã chọn.
                </p>
                <p>
                  Văn bản sẽ được đánh dấu lưu theo dõi và đưa vào danh mục hồ sơ lưu trữ theo chuẩn quy định.
                </p>
              </div>

              <FormField label="Ghi chú lưu hồ sơ / vị trí lưu" optional>
                <Textarea
                  compact
                  value={filingNotes}
                  onChange={(e) => setFilingNotes(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder="Ghi chú nơi lưu trữ, tập hồ sơ số..."
                  className="resize-none"
                />
              </FormField>
            </div>
          )}

          {/* Footer hành động của Dialog */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Hủy bỏ
            </Button>

            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin motion-reduce:animate-none" strokeWidth={1.5} />}
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
      </StandardDialog>
    </>
  );
}
