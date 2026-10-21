"use client";

import * as React from "react";
import { Building2, Archive, Loader2 } from "lucide-react";
import type { OfficialDocument } from "@qcet/contracts/types/document";
import { getDocumentHref } from "@qcet/shared/lib/documents/document-view-model";
import { TaskIconExport, TaskIconLink } from "@qcet/shared/lib/icons/task-icons";
import { Button } from "@/components/ui/button";
import { SelectionActionBar, SelectionActionButton, SelectionActionDivider } from "@/components/ui/selection-action-bar";
import { useFeedback } from "@/components/ui/feedback-layer";
import { StandardDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { useDepartmentList } from "@/hooks/use-department-list";
import { useAuth } from "@/lib/auth-context";
import { getIncomingActions } from "@/lib/documents/incoming-workflow";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayInVietnam } from "@qcet/shared/lib/documents/document-ledger-format";
import { documentCsvRows } from "./document-list-export";

// Hoàn tất hàng loạt đã bỏ: giải quyết văn bản cần báo cáo kết quả và hồ sơ như thao tác đơn lẻ.
export type BulkActionType = "assign-unit" | "file";

/**
 * Giao đơn vị hàng loạt chính là bút phê văn bản đến: dùng cùng nguồn gợi ý quyền với nút "Chuyển"
 * ở chi tiết văn bản đến. Server vẫn kiểm quyền từng văn bản.
 */
export function canBulkAssignLeadUnit(dbRole: string | null | undefined): boolean {
  return getIncomingActions("REGISTERED", dbRole).some((action) => action.key === "direct");
}

export interface BulkBatchFailureGroup {
  reason: string;
  count: number;
}

/** Gom các văn bản không xử lý được theo lý do server trả về, giữ thứ tự xuất hiện. */
export function groupBulkBatchFailures(
  failed: ReadonlyArray<{ documentId?: string; error?: string | null }>
): BulkBatchFailureGroup[] {
  const counts = new Map<string, number>();
  for (const item of failed) {
    const reason = item.error?.trim() || "Không xử lý được văn bản.";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return Array.from(counts, ([reason, count]) => ({ reason, count }));
}

export interface BulkBatchOutcome {
  successCount: number;
  failureCount: number;
  total: number;
  failures: BulkBatchFailureGroup[];
}

/**
 * Đọc kết quả lô: `outcome` khi có văn bản không xử lý được (hiện kết quả thay vì đóng hộp thoại);
 * `clearSelection` khi có văn bản đã xử lý xong, vì giữ lựa chọn thì bấm lại sẽ chạy lại thao tác trên
 * chính các văn bản đó. Lô lỗi toàn bộ giữ lựa chọn để sửa thông tin rồi thử lại.
 */
export function resolveBulkBatchResult(
  data: unknown,
  fallbackTotal: number
): { outcome: BulkBatchOutcome | null; clearSelection: boolean } {
  const result = (data ?? {}) as {
    total?: unknown;
    successCount?: unknown;
    failed?: unknown;
  };
  const failed = Array.isArray(result.failed)
    ? (result.failed as { documentId?: string; error?: string | null }[])
    : [];
  if (failed.length === 0) return { outcome: null, clearSelection: true };
  const successCount = typeof result.successCount === "number" ? result.successCount : 0;
  return {
    outcome: {
      successCount,
      failureCount: failed.length,
      total: typeof result.total === "number" ? result.total : fallbackTotal,
      failures: groupBulkBatchFailures(failed),
    },
    clearSelection: successCount > 0,
  };
}

export interface DocumentBulkToolbarProps {
  /** Số lượng văn bản đã chọn */
  selectedCount: number;
  /** Danh sách ID các văn bản đã chọn */
  selectedIds?: ReadonlySet<string> | string[];
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
  /** Các văn bản đang chọn (theo thứ tự trên sổ): sao chép liên kết, xuất Excel. */
  selectedDocuments?: OfficialDocument[];
  /** Tiêu đề cột số của sổ đang xem ("Số đến", "Số đi", "Số") cho bảng xuất Excel. */
  numberHeader?: string;
  /**
   * Mở hộp Giao đơn vị / Lưu hồ sơ cho đúng các văn bản này (menu thao tác của một dòng), không đụng lựa chọn đang có.
   * `key` đổi mỗi lần yêu cầu để mở lại được cùng thao tác.
   */
  actionRequest?: { type: BulkActionType; ids: string[]; key: number } | null;
}

interface ActionModalState {
  type: BulkActionType | null;
  isOpen: boolean;
}

/**
 * Component DocumentBulkToolbar:
 * Thanh công cụ thao tác hàng loạt cố định nổi ở đáy màn hình khi có văn bản được chọn.
 * Hỗ trợ các hành động: Giao đơn vị (người có quyền bút phê), Lưu hồ sơ, và Bỏ chọn (ESC).
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
  selectedDocuments = [],
  numberHeader = "Số",
  actionRequest,
}: DocumentBulkToolbarProps) {
  const feedback = useFeedback();
  // Văn bản của hộp thoại đang mở: `null` là các văn bản đang chọn, mảng là văn bản mở từ menu của một dòng
  const [targetIds, setTargetIds] = React.useState<string[] | null>(null);
  const [modalState, setModalState] = React.useState<ActionModalState>({
    type: null,
    isOpen: false,
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [batchOutcome, setBatchOutcome] = React.useState<BulkBatchOutcome | null>(null);

  // Form states cho từng loại modal
  const [selectedUnitId, setSelectedUnitId] = React.useState("");
  const unitFieldRef = React.useRef<HTMLDivElement>(null);
  const [instruction, setInstruction] = React.useState("");
  const instructionRef = React.useRef<HTMLTextAreaElement>(null);
  const [deadline, setDeadline] = React.useState("");
  const [filingNotes, setFilingNotes] = React.useState("");

  const { user } = useAuth();
  // `role` là vai trò giao diện (ADMIN/MANAGER/STAFF); quyền theo bước dùng vai trò nghiệp vụ trong DB.
  const canAssignUnit = canBulkAssignLeadUnit((user as { dbRole?: string } | null)?.dbRole);

  const { departments, isLoading: isLoadingDepts } = useDepartmentList();

  // Chuyển đổi selectedIds sang array chuẩn
  const resolvedIds = React.useMemo(() => {
    if (!selectedIds) return [];
    return Array.isArray(selectedIds) ? selectedIds : Array.from(selectedIds);
  }, [selectedIds]);

  const selectionCount = selectedCount || resolvedIds.length;
  const actionIds = targetIds ?? resolvedIds;
  const effectiveCount = targetIds ? targetIds.length : selectionCount;

  const openModal = (type: BulkActionType, ids: string[] | null = null) => {
    setTargetIds(ids);
    setErrorMessage(null);
    setBatchOutcome(null);
    setSelectedUnitId("");
    setInstruction("");
    setDeadline("");
    setFilingNotes("");
    setModalState({ type, isOpen: true });
  };

  const requestKey = actionRequest?.key;
  React.useEffect(() => {
    if (actionRequest) openModal(actionRequest.type, actionRequest.ids);
    // Chỉ mở khi có yêu cầu mới (key đổi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const closeModal = () => {
    if (isSubmitting) return;
    setModalState({ type: null, isOpen: false });
    setErrorMessage(null);
    setBatchOutcome(null);
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
    if (modalState.type === "assign-unit" && !instruction.trim()) {
      setErrorMessage("Vui lòng nhập ý kiến chỉ đạo.");
      instructionRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload =
        modalState.type === "assign-unit"
          ? {
              action: "ASSIGN_LEAD_UNIT",
              documentIds: actionIds,
              leadUnitId: selectedUnitId,
              leadershipInstruction: instruction.trim(),
              deadline: deadline || undefined,
            }
          : {
              action: "FILE_DOCUMENTS",
              documentIds: actionIds,
              filingNotes: filingNotes.trim() || undefined,
              archiveReason: filingNotes.trim() || undefined,
            };

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

      // Server xử lý từng văn bản độc lập: văn bản không xử lý được nằm trong `failed` kèm lý do.
      const { outcome, clearSelection } = resolveBulkBatchResult(json?.data, effectiveCount);
      // Thao tác mở từ menu của một dòng không bỏ lựa chọn đang có của các dòng khác
      if (clearSelection && !targetIds) onClearSelection();
      if (outcome) {
        setBatchOutcome(outcome);
        if (clearSelection && onRefresh) {
          await onRefresh();
        }
        return;
      }

      onSuccess?.(modalState.type, effectiveCount);
      closeModal();
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

  const copyLinks = async () => {
    try {
      await navigator.clipboard.writeText(selectedDocuments.map((doc) => `${window.location.origin}${getDocumentHref(doc.id)}`).join("\n"));
      feedback.notifySuccess(selectedDocuments.length === 1 ? "Đã sao chép liên kết" : `Đã sao chép ${selectedDocuments.length} liên kết`);
    } catch {
      feedback.notifyError("Không sao chép được liên kết");
    }
  };

  return (
    <>
      {/* Cùng thanh thao tác hàng loạt của bảng Nhiệm vụ và trang Cuộc họp (SelectionActionBar): đáy trang, nổi trên thanh
          dưới; điện thoại rộng gần hết màn, thao tác xuống hàng dưới */}
      <SelectionActionBar
        count={selectionCount}
        total={totalCount}
        noun="văn bản"
        onClear={onClearSelection}
        busy={isLoading || isSubmitting}
        className={className}
      >
        {/* Giao đơn vị: chỉ người có quyền bút phê văn bản đến */}
        {canAssignUnit ? (
          <SelectionActionButton onClick={() => openModal("assign-unit")} disabled={isLoading || isSubmitting} title="Giao đơn vị chủ trì xử lý các văn bản đã chọn">
            <Building2 className="size-4" />
            Giao đơn vị
          </SelectionActionButton>
        ) : null}
        <SelectionActionButton onClick={() => openModal("file")} disabled={isLoading || isSubmitting} title="Lập hồ sơ và đưa vào lưu trữ theo dõi">
          <Archive className="size-4" />
          Lưu hồ sơ
        </SelectionActionButton>
        {selectedDocuments.length > 0 ? (
          <>
            <SelectionActionDivider />
            <SelectionActionButton onClick={() => void copyLinks()} title="Sao chép liên kết các văn bản đã chọn">
              <TaskIconLink className="size-4" />
              <span className="max-sm:hidden">Sao chép liên kết</span>
              <span className="sm:hidden">Liên kết</span>
            </SelectionActionButton>
            <SelectionActionButton
              onClick={() => downloadCsv(`so-van-ban-${todayInVietnam()}.csv`, toCsv(documentCsvRows(selectedDocuments, numberHeader)))}
              title="Tải bảng các văn bản đã chọn (mở bằng Excel)"
            >
              <TaskIconExport className="size-4" />
              Xuất Excel
            </SelectionActionButton>
          </>
        ) : null}
      </SelectionActionBar>

      {/* Dialog xác nhận hành động hàng loạt */}
      <StandardDialog
      compact
        open={modalState.isOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        title={modalState.type === "assign-unit" ? "Giao đơn vị chủ trì" : "Lưu trữ hồ sơ văn bản"}
        description={
          // Lựa chọn có thể đã được bỏ khi hiện kết quả, nên lấy tổng số từ kết quả lô
          batchOutcome
            ? `Kết quả xử lý ${batchOutcome.total} văn bản`
            : targetIds?.length === 1
              ? "Áp dụng cho văn bản này"
              : `Áp dụng đồng loạt cho ${effectiveCount} văn bản đã chọn`
        }
        size="md"
      >
        {errorMessage && <InlineAlert className="mb-3">{errorMessage}</InlineAlert>}

        {batchOutcome ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <InlineAlert variant={batchOutcome.successCount > 0 ? "warning" : "error"}>
                Đã xử lý {batchOutcome.successCount}/{batchOutcome.total} văn bản. Không xử lý được{" "}
                {batchOutcome.failureCount} văn bản:
              </InlineAlert>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {batchOutcome.failures.map((failure) => (
                  <li key={failure.reason}>
                    <span className="font-medium text-foreground tabular-nums">{failure.count} văn bản</span>: {failure.reason}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button size="sm" onClick={closeModal}>
                Đóng
              </Button>
            </div>
          </div>
        ) : (
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

              <FormField label="Ý kiến chỉ đạo / yêu cầu xử lý">
                <Textarea
                  ref={instructionRef}
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

          {/* Nội dung Form: Lưu hồ sơ */}
          {modalState.type === "file" && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  {targetIds?.length === 1 ? "Lập hồ sơ lưu trữ cho văn bản này." : `Lập hồ sơ lưu trữ cho ${effectiveCount} văn bản đã chọn.`}
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
              {isSubmitting && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              <span>
                {isSubmitting
                  ? "Đang xử lý..."
                  : modalState.type === "assign-unit"
                  ? "Xác nhận giao việc"
                  : "Lưu hồ sơ"}
              </span>
            </Button>
          </div>
        </form>
        )}
      </StandardDialog>
    </>
  );
}
