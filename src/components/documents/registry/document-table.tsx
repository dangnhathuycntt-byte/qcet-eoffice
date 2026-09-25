"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import {
  Eye,
  FileText,
  CheckCircle2,
  ArrowRight,
  Download,
  MoreHorizontal,
  Copy,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Check,
  Printer,
  Inbox,
  Send,
  FileCheck,
} from "lucide-react";
import { OfficialDocument, DocumentType } from "@/types/document";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getUrgencyBadgeConfig,
  getStatusBadgeConfig,
} from "../document-detail-dialog";

export interface DocumentTableProps {
  documents: OfficialDocument[];
  selectedDocument?: OfficialDocument | null;
  selectedIds?: Set<string>;
  onSelectDocument?: (doc: OfficialDocument) => void;
  onToggleSelect?: (docId: string, isShift?: boolean) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onViewPdf?: (doc: OfficialDocument) => void;
  onLinkTask?: (doc: OfficialDocument) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  selectable?: boolean;
}

function getDocTypeLabel(type: DocumentType): string {
  switch (type) {
    case "VAN_BAN_DEN":
    case "inbox":
      return "Văn bản đến";
    case "VAN_BAN_DI":
    case "outbox":
      return "Văn bản đi";
    case "TO_TRINH_NOI_BO":
    case "submission":
      return "Tờ trình nội bộ";
    default:
      return "Văn bản";
  }
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ariaLabel,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={ariaLabel}
      className={cn(
        "size-4 rounded border-border/80 text-primary focus:ring-primary/20 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors",
        className
      )}
    />
  );
}

export function DocumentTable({
  documents,
  selectedDocument,
  selectedIds = new Set<string>(),
  onSelectDocument,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onViewPdf,
  onLinkTask,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "Không tìm thấy văn bản phù hợp",
  emptyDescription = "Vui lòng thay đổi từ khóa hoặc bộ lọc tìm kiếm.",
  className,
  selectable = true,
}: DocumentTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const lastClickedIndexRef = React.useRef<number | null>(null);

  const isAllSelected =
    documents.length > 0 && selectedIds.size === documents.length;
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < documents.length;

  const handleHeaderCheckboxChange = () => {
    if (isAllSelected) {
      onClearSelection?.();
    } else {
      onSelectAll?.();
    }
  };

  const handleRowCheckboxClick = (
    index: number,
    docId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const isShift = e.shiftKey;
    onToggleSelect?.(docId, isShift);
    lastClickedIndexRef.current = index;
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard write failure
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div
        className={cn("overflow-x-auto select-none", className)}
        data-slot="document-table"
      >
        <table className="w-full text-left text-xs border-collapse table-row-dense">
          <thead>
            <tr className="border-b border-border/50 bg-muted/10">
              {selectable && (
                <th className="py-3 px-3.5 w-[44px] text-center">
                  <div className="size-4 bg-muted rounded mx-auto animate-pulse" />
                </th>
              )}
              <th className="py-3 px-4 w-[160px] text-xs font-semibold text-muted-foreground">
                Số / Ký hiệu
              </th>
              <th className="py-3 px-4 w-[120px] text-xs font-semibold text-muted-foreground">
                Ngày BH / Đến
              </th>
              <th className="py-3 px-4 w-[190px] text-xs font-semibold text-muted-foreground">
                Cơ quan &amp; Người ký
              </th>
              <th className="py-3 px-4 min-w-[280px] text-xs font-semibold text-muted-foreground">
                Trích yếu nội dung
              </th>
              <th className="py-3 px-4 w-[160px] text-xs font-semibold text-muted-foreground">
                Đơn vị &amp; Tiến độ
              </th>
              <th className="py-3 px-4 w-[170px] text-xs font-semibold text-muted-foreground">
                Liên thông việc
              </th>
              <th className="py-3 px-4 w-[88px] text-right text-xs font-semibold text-muted-foreground">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {Array.from({ length: 6 }).map((_, idx) => (
              <tr key={`skeleton-${idx}`} className="animate-pulse">
                {selectable && (
                  <td className="py-3 px-3.5 text-center">
                    <div className="size-4 bg-muted/70 rounded mx-auto" />
                  </td>
                )}
                <td className="py-3 px-4 table-cell-dense">
                  <div className="h-4 w-28 bg-muted rounded mb-1" />
                  <div className="h-3 w-16 bg-muted/60 rounded" />
                </td>
                <td className="py-3 px-4 table-cell-dense">
                  <div className="h-4 w-20 bg-muted rounded mb-1" />
                  <div className="h-3 w-14 bg-muted/60 rounded" />
                </td>
                <td className="py-3 px-4 table-cell-dense">
                  <div className="h-4 w-32 bg-muted rounded mb-1" />
                  <div className="h-3 w-24 bg-muted/60 rounded" />
                </td>
                <td className="py-3 px-4 table-cell-dense">
                  <div className="h-4 w-3/4 bg-muted rounded mb-1.5" />
                  <div className="h-3 w-20 bg-muted/60 rounded" />
                </td>
                <td className="py-3 px-4 table-cell-dense">
                  <div className="h-4 w-24 bg-muted rounded mb-1" />
                  <div className="h-3 w-20 bg-muted/60 rounded" />
                </td>
                <td className="py-3 px-4 table-cell-dense">
                  <div className="h-6 w-24 bg-muted/80 rounded-lg" />
                </td>
                <td className="py-3 px-4 table-cell-dense text-right">
                  <div className="h-7 w-7 bg-muted/60 rounded-lg ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        className={cn("p-12 text-center space-y-3", className)}
        data-slot="document-table"
      >
        <AlertTriangle
          className="size-8 mx-auto text-amber-500 opacity-80"
          strokeWidth={1.5}
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Không thể tải dữ liệu văn bản
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw className="size-3.5" />
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  // Empty State
  if (documents.length === 0) {
    return (
      <div
        className={cn("p-12 text-center text-muted-foreground", className)}
        data-slot="document-table"
      >
        <FileText className="size-8 mx-auto mb-2 opacity-50" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="text-xs mt-1">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-x-auto", className)}
      data-slot="document-table"
    >
      <table className="w-full text-left text-xs border-collapse table-row-dense">
        <thead>
          <tr className="border-b border-border/50 bg-muted/10 select-none">
            {selectable && (
              <th className="py-3 px-3.5 w-[44px] text-center">
                <IndeterminateCheckbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleHeaderCheckboxChange}
                  ariaLabel="Chọn tất cả văn bản"
                />
              </th>
            )}
            <th className="py-3 px-4 w-[160px] text-xs font-semibold text-muted-foreground">
              Số / Ký hiệu
            </th>
            <th className="py-3 px-4 w-[120px] text-xs font-semibold text-muted-foreground">
              Ngày BH / Đến
            </th>
            <th className="py-3 px-4 w-[190px] text-xs font-semibold text-muted-foreground">
              Cơ quan &amp; Người ký
            </th>
            <th className="py-3 px-4 min-w-[280px] text-xs font-semibold text-muted-foreground">
              Trích yếu nội dung
            </th>
            <th className="py-3 px-4 w-[160px] text-xs font-semibold text-muted-foreground">
              Đơn vị &amp; Tiến độ
            </th>
            <th className="py-3 px-4 w-[170px] text-xs font-semibold text-muted-foreground">
              Liên thông việc
            </th>
            <th className="py-3 px-4 w-[88px] text-right text-xs font-semibold text-muted-foreground">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {documents.map((doc, index) => {
            const urgencyConfig = getUrgencyBadgeConfig(doc.urgency);
            const statusConfig = getStatusBadgeConfig(doc.status);
            const StatusIcon = statusConfig.icon;
            const isSelectedRow = selectedIds.has(doc.id);
            const isCurrentActive = selectedDocument?.id === doc.id;
            const docTypeLabel = getDocTypeLabel(doc.type);

            return (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument?.(doc)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSelectDocument?.(doc);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "hover:bg-muted/40 transition-colors cursor-pointer group select-none",
                  isSelectedRow && "bg-primary/5 hover:bg-primary/10",
                  isCurrentActive && "ring-1 ring-primary/40 bg-muted/50"
                )}
              >
                {/* Checkbox Column */}
                {selectable && (
                  <td
                    className="py-3 px-3.5 text-center table-cell-dense"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelectedRow}
                      onClick={(e) => handleRowCheckboxClick(index, doc.id, e)}
                      onChange={() => {
                        // Handled by onClick for shiftKey support
                      }}
                      aria-label={`Chọn văn bản ${doc.documentNumber || doc.id}`}
                      className="size-4 rounded border-border/80 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-colors"
                    />
                  </td>
                )}

                {/* Số / Ký hiệu & Loại */}
                <td className="py-3 px-4 table-cell-dense">
                  <span className="font-mono text-xs md:text-[13px] font-semibold text-primary block group-hover:text-primary/80 transition-colors">
                    {doc.documentNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {docTypeLabel}
                  </span>
                </td>

                {/* Ngày ban hành / đến */}
                <td className="py-3 px-4 table-cell-dense">
                  <span className="font-mono text-xs text-muted-foreground block">
                    {doc.issuedDate}
                  </span>
                  {doc.receivedDate && (
                    <span className="text-xs text-muted-foreground/80 block">
                      Đến: {doc.receivedDate}
                    </span>
                  )}
                </td>

                {/* Cơ quan & Người ký */}
                <td className="py-3 px-4 table-cell-dense">
                  <span className="font-medium text-foreground block truncate max-w-[180px]" title={doc.issuingAuthority}>
                    {doc.issuingAuthority}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate max-w-[180px]" title={doc.signatory}>
                    {doc.signatory}
                  </span>
                </td>

                {/* Trích yếu nội dung */}
                <td className="py-3 px-4 table-cell-dense">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed" title={doc.summary}>
                      {doc.summary}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs border",
                          urgencyConfig.className
                        )}
                      >
                        {urgencyConfig.label}
                      </span>
                      {doc.fileAttachment && (
                        <span className="text-xs text-muted-foreground font-mono">
                          • PDF ({doc.fileAttachment.size})
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Đơn vị & Tiến độ */}
                <td className="py-3 px-4 table-cell-dense">
                  <span className="font-medium text-foreground block truncate max-w-[150px]" title={doc.leadDepartment}>
                    {doc.leadDepartment}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border mt-1 font-medium",
                      statusConfig.className
                    )}
                  >
                    <StatusIcon className="size-3" strokeWidth={1.5} />
                    <span>{statusConfig.label}</span>
                  </span>
                </td>

                {/* Liên thông việc */}
                <td
                  className="py-3 px-4 table-cell-dense"
                  onClick={(e) => e.stopPropagation()}
                >
                  {doc.linkedTaskId ? (
                    <Link
                      href={`/?taskId=${doc.linkedTaskId}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/20 text-xs font-semibold transition-colors"
                      title={doc.linkedTaskTitle || `Mã nhiệm vụ ${doc.linkedTaskId}`}
                    >
                      <CheckCircle2 className="size-3" strokeWidth={1.5} />
                      <span className="font-mono">{doc.linkedTaskId}</span>
                      <ArrowRight className="size-2.5" strokeWidth={1.5} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLinkTask?.(doc)}
                      className="text-xs text-muted-foreground/60 hover:text-primary transition-colors italic cursor-pointer"
                    >
                      Chưa tạo việc
                    </button>
                  )}
                </td>

                {/* Thao tác (Actions Dropdown & Quick Detail) */}
                <td
                  className="py-3 px-4 table-cell-dense text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSelectDocument?.(doc)}
                      className="size-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted cursor-pointer active:scale-[0.98]"
                      aria-label={`Xem chi tiết văn bản ${doc.documentNumber || doc.id}`}
                    >
                      <Eye className="size-3.5" strokeWidth={1.5} />
                    </Button>

                    <Menu.Root>
                      <Menu.Trigger
                        aria-label={`Tùy chọn thao tác văn bản ${doc.documentNumber || doc.id}`}
                        className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer active:scale-[0.98]"
                      >
                        <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
                      </Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Positioner
                          side="bottom"
                          align="end"
                          sideOffset={4}
                          collisionPadding={12}
                          className="z-50"
                        >
                          <Menu.Popup
                            aria-label="Tùy chọn thao tác văn bản"
                            style={{
                              maxWidth: "var(--available-width)",
                              maxHeight: "var(--available-height)",
                              overflowY: "auto",
                            }}
                            className="w-48 select-none rounded-xl border border-border/80 bg-popover/95 p-1 text-xs text-popover-foreground shadow-lg shadow-black/10 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => onSelectDocument?.(doc)}
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer text-left text-foreground"
                            >
                              <Eye className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                              <span>Xem chi tiết</span>
                            </button>

                            {doc.fileAttachment && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => onViewPdf?.(doc)}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer text-left text-foreground"
                              >
                                <FileText className="size-3.5 text-primary" strokeWidth={1.5} />
                                <span>Xem tệp PDF</span>
                              </button>
                            )}

                            {doc.linkedTaskId ? (
                              <Link
                                href={`/?taskId=${doc.linkedTaskId}`}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer text-left text-emerald-600"
                              >
                                <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={1.5} />
                                <span>Xem nhiệm vụ</span>
                              </Link>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => onLinkTask?.(doc)}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer text-left text-foreground"
                              >
                                <ArrowRight className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                                <span>Liên thông việc</span>
                              </button>
                            )}

                            <div className="my-1 border-t border-border/40" />

                            <button
                              type="button"
                              role="menuitem"
                              onClick={() =>
                                handleCopy(
                                  doc.documentNumber || doc.id,
                                  `code-${doc.id}`
                                )
                              }
                              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer text-left text-foreground"
                            >
                              <span className="flex items-center gap-2">
                                <Copy className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                                <span>Sao chép số hiệu</span>
                              </span>
                              {copiedId === `code-${doc.id}` && (
                                <Check className="size-3 text-emerald-600" strokeWidth={2} />
                              )}
                            </button>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
