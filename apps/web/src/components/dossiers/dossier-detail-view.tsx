"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  Archive,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FolderArchive,
  Hash,
  Lock,
  MapPin,
  Send,
  Shield,
  StickyNote,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableEmptyValue, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirmAction } from "@/components/ui/confirm-host";
import { DossierDisposalPanel } from "./dossier-disposal-panel";
import { getDocumentHref } from "@qcet/shared/lib/documents/document-view-model";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter, DialogForm, FieldError, StandardDialog } from "@/components/ui/dialog";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SerializedDossierDetail {
  id: string;
  code: string;
  title: string;
  status: string;
  classification: string;
  storageLocation: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  submittedArchiveAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string | null;

  owningUnit: { id: string; name: string; code: string };
  responsiblePerson: { id: string; name: string; email: string };
  archivedBy: { id: string; name: string; email: string } | null;

  retentionRule: {
    id: string;
    code: string;
    name: string;
    durationYears: number | null;
  } | null;

  items: {
    id: string;
    itemType: string;
    itemId: string | null;
    title: string;
    documentNumber: string | null;
    documentDate: string | null;
    pageCount: number | null;
    sequence: number | null;
    notes: string | null;
    addedAt: string | null;
    addedBy: { id: string; name: string } | null;
  }[];

  itemCount: number;
}

export interface DossierDetailViewProps {
  dossier: SerializedDossierDetail;
  currentUser: { id: string; name: string; role: string };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN: {
    label: "Đang mở",
    className: "bg-muted text-muted-foreground border-border/60",
  },
  ACTIVE: {
    label: "Hoạt động",
    className: "bg-muted text-muted-foreground border-border/60",
  },
  CLOSED: {
    label: "Đã đóng",
    className: "bg-muted/60 text-muted-foreground border-border/40",
  },
  READY_FOR_ARCHIVE: {
    label: "Sẵn sàng lưu trữ",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  SUBMITTED_TO_ARCHIVE: {
    label: "Đã nộp lưu trữ",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  // Trạng thái cuối chữ mờ như cột Trạng thái của danh sách hồ sơ; chỉ hai bước còn việc phải làm mới tô màu cảnh báo
  ACCEPTED: {
    label: "Đã chấp nhận",
    className: "bg-muted/60 text-muted-foreground border-border/40",
  },
  ARCHIVED: {
    label: "Đã lưu trữ",
    className: "bg-muted/60 text-muted-foreground border-border/40",
  },
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  PUBLIC: "Công khai",
  INTERNAL: "Nội bộ",
  RESTRICTED: "Hạn chế",
  PERSONAL_DATA: "Dữ liệu cá nhân",
};

/** Bề rộng cột của bảng tài liệu trong hồ sơ (như `TASK_COLUMN_CLASS`); khung hẹp thì bớt cột. */
const ITEM_COLUMN_CLASS = {
  type: "w-[96px] @max-[640px]:hidden",
  number: "w-[120px] @max-[640px]:hidden",
  date: "w-[104px]",
  pages: "w-[64px] @max-[760px]:hidden",
  addedBy: "w-[144px] @max-[760px]:hidden",
} as const;

const ITEM_TYPE_LABEL: Record<string, string> = {
  DOCUMENT: "Văn bản",
  TASK: "Nhiệm vụ",
  RESULT: "Kết quả",
  DECISION: "Quyết định",
  MEETING_MINUTES: "Biên bản họp",
  ATTACHMENT: "Tệp đính kèm",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lỗi thao tác từ API (RFC 9457 `detail` hoặc `error`); không đọc được thì nói chung. */
async function readActionError(res: Response): Promise<string> {
  const json = await res.json().catch(() => null);
  const detail = json && (json.detail || json.error?.message || json.error || json.title);
  return typeof detail === "string" && detail ? detail : "Chưa thực hiện được thao tác. Thử lại sau ít phút.";
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
      <h2 className="text-xs font-semibold text-foreground mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Item type → detail route
// ---------------------------------------------------------------------------

function itemDetailHref(
  itemType: string,
  itemId: string | null,
): string | null {
  if (!itemId) return null;
  switch (itemType) {
    case "DOCUMENT":
      return getDocumentHref(itemId);
    case "TASK":
      return `/tasks/${itemId}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DossierDetailView({
  dossier,
  currentUser,
}: DossierDetailViewProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  // Lỗi thao tác hiện ngay dưới hàng nút (không dùng hộp alert của trình duyệt)
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [rejectSubmitError, setRejectSubmitError] = React.useState<string | null>(null);
  const rejectReasonRef = React.useRef<HTMLTextAreaElement>(null);
  const rejectReasonId = React.useId();

  const statusCfg = STATUS_CONFIG[dossier.status] ?? {
    label: dossier.status,
    className: "bg-muted text-muted-foreground border-border/60",
  };

  // ------- Action helpers -------

  async function executeAction(
    actionPath: string,
    body: Record<string, unknown>,
    confirmMsg: string,
  ) {
    if (!(await confirmAction({ title: confirmMsg }))) return;
    setPendingAction(actionPath);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/dossiers/${dossier.id}/actions/${actionPath}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setActionError(await readActionError(res));
        return;
      }
      router.refresh();
    } catch {
      setActionError("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleRejectArchive() {
    setRejectReason("");
    setRejectError(null);
    setRejectSubmitError(null);
    setRejectOpen(true);
  }

  /** Từ chối lưu trữ: lý do bắt buộc, thiếu thì báo dưới ô và đưa con trỏ về ô (nút chính không khóa vì thiếu chữ). */
  async function submitRejectArchive() {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError("Nhập lý do để người nộp biết cần bổ sung gì.");
      rejectReasonRef.current?.focus();
      return;
    }
    setPendingAction("reject-archive");
    setRejectSubmitError(null);
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}/actions/reject-archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ returnReason: reason }),
      });
      if (!res.ok) {
        setRejectSubmitError(await readActionError(res));
        return;
      }
      setRejectOpen(false);
      router.refresh();
    } catch {
      setRejectSubmitError("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPendingAction(null);
    }
  }

  // ------- Compute visible actions based on status + role -------

  const role = currentUser.role;
  const status = dossier.status;

  const canManage = ["BAN_GIAM_HIEU", "TRUONG_PHONG", "VAN_THU", "ADMIN"].includes(role);
  const canArchive = ["VAN_THU", "ADMIN"].includes(role);

  type ActionDef = {
    key: string;
    label: string;
    icon: React.ElementType;
    style: "primary" | "secondary" | "destructive";
    handler: () => void;
  };

  const actions: ActionDef[] = [];

  if ((status === "OPEN" || status === "ACTIVE") && canManage) {
    actions.push({
      key: "close",
      label: "Đóng hồ sơ",
      icon: Lock,
      style: "secondary",
      handler: () => executeAction("close", {}, "Xác nhận đóng hồ sơ này?"),
    });
  }

  if (status === "CLOSED" && canManage) {
    actions.push({
      key: "mark-ready-for-archive",
      label: "Đánh dấu sẵn sàng lưu trữ",
      icon: Archive,
      style: "secondary",
      handler: () =>
        executeAction(
          "mark-ready-for-archive",
          {},
          "Đánh dấu hồ sơ sẵn sàng cho lưu trữ?",
        ),
    });
  }

  if (status === "READY_FOR_ARCHIVE" && canManage) {
    actions.push({
      key: "submit-archive",
      label: "Nộp lưu trữ",
      icon: Send,
      style: "primary",
      handler: () =>
        executeAction("submit-archive", {}, "Xác nhận nộp hồ sơ để lưu trữ?"),
    });
  }

  if (status === "SUBMITTED_TO_ARCHIVE" && canArchive) {
    actions.push({
      key: "accept-archive",
      label: "Chấp nhận lưu trữ",
      icon: CheckCircle2,
      style: "primary",
      handler: () =>
        executeAction(
          "accept-archive",
          {},
          "Xác nhận chấp nhận lưu trữ hồ sơ này?",
        ),
    });
    actions.push({
      key: "reject-archive",
      label: "Từ chối lưu trữ",
      icon: XCircle,
      style: "destructive",
      handler: handleRejectArchive,
    });
  }

  if (status === "ACCEPTED" && canArchive) {
    actions.push({
      key: "finalize-archive",
      label: "Hoàn tất lưu trữ",
      icon: CheckCircle2,
      style: "primary",
      handler: () =>
        executeAction(
          "finalize-archive",
          {},
          "Xác nhận hoàn tất lưu trữ hồ sơ này?",
        ),
    });
  }

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={dossier.id}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={motionTransition}
        className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 pb-6 md:pb-10 space-y-4"
      >
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <Link
            href="/dossiers"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại danh sách
          </Link>
        </div>

        {/* Header card */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
              <FolderArchive className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground font-heading leading-snug">
                {dossier.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-foreground">
                  <Hash
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="font-medium tabular-nums">
                    {dossier.code}
                  </span>
                </span>

                <span
                  className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded border",
                    statusCfg.className,
                  )}
                >
                  {statusCfg.label}
                </span>

                <span
                  className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded border",
                    "bg-muted/60 text-muted-foreground border-border/40",
                  )}
                >
                  {CLASSIFICATION_LABEL[dossier.classification] ??
                    dossier.classification}
                </span>

                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Mở: {formatDate(dossier.openedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action panel */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.key}
                  size="sm"
                  variant={action.style === "primary" ? "default" : action.style === "destructive" ? "destructive" : "outline"}
                  disabled={pendingAction !== null && pendingAction !== action.key}
                  loading={pendingAction === action.key}
                  onClick={action.handler}
                >
                  <Icon />
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
        {actionError ? <InlineAlert variant="error">{actionError}</InlineAlert> : null}

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Left column */}
          <div className="space-y-4 min-w-0">
            {/* Metadata */}
            <SectionCard title="Thông tin chung">
              <div className="space-y-2">
                <MetaRow
                  icon={Building2}
                  label="Đơn vị"
                  value={`${dossier.owningUnit.name} (${dossier.owningUnit.code})`}
                />
                <MetaRow
                  icon={User}
                  label="Người phụ trách"
                  value={dossier.responsiblePerson.name}
                />
                <MetaRow
                  icon={MapPin}
                  label="Nơi lưu trữ"
                  value={dossier.storageLocation}
                />
                <MetaRow
                  icon={StickyNote}
                  label="Ghi chú"
                  value={dossier.notes}
                />
              </div>
            </SectionCard>

            {/* Items list */}
            <SectionCard title={`Danh mục tài liệu (${dossier.items.length})`}>
              {dossier.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Chưa có tài liệu nào trong hồ sơ.
                </p>
              ) : (
                // Bảng dùng chung như bảng Nhiệm vụ, tràn ra mép thẻ để cột đầu thẳng với chữ trong thẻ
                <Table density="two-line" className="table-fixed" containerClassName="@container -mx-4 w-[calc(100%+2rem)]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">STT</TableHead>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead className={ITEM_COLUMN_CLASS.type}>Loại</TableHead>
                      <TableHead className={ITEM_COLUMN_CLASS.number}>Số văn bản</TableHead>
                      <TableHead className={ITEM_COLUMN_CLASS.date}>Ngày VB</TableHead>
                      <TableHead className={cn("text-right", ITEM_COLUMN_CLASS.pages)}>Trang</TableHead>
                      <TableHead className={ITEM_COLUMN_CLASS.addedBy}>Người thêm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dossier.items.map((item, idx) => {
                      const href = itemDetailHref(item.itemType, item.itemId);
                      return (
                        <TableRow
                          key={item.id}
                          interactive={Boolean(href)}
                          tabIndex={href ? 0 : undefined}
                          onClick={href ? () => router.push(href) : undefined}
                          onKeyDown={
                            href
                              ? (event) => {
                                  if (event.key === "Enter" && event.target === event.currentTarget) {
                                    event.preventDefault();
                                    router.push(href);
                                  }
                                }
                              : undefined
                          }
                        >
                          <TableCell className="text-xs tabular-nums text-muted-foreground">{item.sequence ?? idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex min-w-0 flex-col">
                              {href ? (
                                <Link
                                  href={href}
                                  tabIndex={-1}
                                  onClick={(event) => event.stopPropagation()}
                                  className="truncate font-medium text-foreground outline-none transition-colors group-hover:text-primary"
                                  title={item.title}
                                >
                                  {item.title}
                                </Link>
                              ) : (
                                <span className="truncate font-medium text-foreground" title={item.title}>
                                  {item.title}
                                </span>
                              )}
                              {item.notes && <span className="truncate text-xs text-muted-foreground">{item.notes}</span>}
                            </div>
                          </TableCell>
                          <TableCell className={cn("truncate text-xs text-muted-foreground", ITEM_COLUMN_CLASS.type)}>
                            {ITEM_TYPE_LABEL[item.itemType] ?? item.itemType}
                          </TableCell>
                          <TableCell className={cn("truncate text-xs tabular-nums", ITEM_COLUMN_CLASS.number)}>
                            {item.documentNumber ?? <TableEmptyValue />}
                          </TableCell>
                          <TableCell className={cn("whitespace-nowrap text-xs tabular-nums text-muted-foreground", ITEM_COLUMN_CLASS.date)}>
                            {formatDate(item.documentDate) || <TableEmptyValue />}
                          </TableCell>
                          <TableCell className={cn("text-right text-xs tabular-nums text-muted-foreground", ITEM_COLUMN_CLASS.pages)}>
                            {item.pageCount ?? <TableEmptyValue />}
                          </TableCell>
                          <TableCell className={cn("truncate text-xs text-muted-foreground", ITEM_COLUMN_CLASS.addedBy)}>
                            {item.addedBy?.name ?? <TableEmptyValue />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </div>

          {/* Right sidebar */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            {/* Retention rule */}
            {dossier.retentionRule && (
              <SectionCard title="Thời hạn bảo quản">
                <div className="space-y-2">
                  <MetaRow
                    icon={Hash}
                    label="Mã"
                    value={dossier.retentionRule.code}
                  />
                  <MetaRow
                    icon={FileText}
                    label="Tên"
                    value={dossier.retentionRule.name}
                  />
                  <MetaRow
                    icon={Clock}
                    label="Thời hạn"
                    value={dossier.retentionRule.durationYears != null ? `${dossier.retentionRule.durationYears} năm` : "Vĩnh viễn"}
                  />
                </div>
              </SectionCard>
            )}

            <DossierDisposalPanel dossierId={dossier.id} />

            {/* Archive lifecycle */}
            <SectionCard title="Vòng đời lưu trữ">
              <div className="space-y-2">
                <MetaRow
                  icon={Shield}
                  label="Nộp lưu trữ"
                  value={
                    dossier.submittedArchiveAt
                      ? formatDateTime(dossier.submittedArchiveAt)
                      : null
                  }
                />
                <MetaRow
                  icon={FolderArchive}
                  label="Đã lưu trữ"
                  value={
                    dossier.archivedAt
                      ? formatDateTime(dossier.archivedAt)
                      : null
                  }
                />
                <MetaRow
                  icon={User}
                  label="Người lưu trữ"
                  value={dossier.archivedBy?.name ?? null}
                />
                {!dossier.submittedArchiveAt && !dossier.archivedAt && (
                  <p className="text-xs text-muted-foreground italic">
                    Chưa nộp lưu trữ.
                  </p>
                )}
              </div>
            </SectionCard>

            {/* Dates */}
            <SectionCard title="Mốc thời gian">
              <div className="space-y-2">
                <MetaRow
                  icon={Calendar}
                  label="Ngày mở"
                  value={formatDate(dossier.openedAt)}
                />
                <MetaRow
                  icon={Calendar}
                  label="Ngày đóng"
                  value={
                    dossier.closedAt ? formatDate(dossier.closedAt) : null
                  }
                />
                <MetaRow
                  icon={Clock}
                  label="Tạo lúc"
                  value={formatDateTime(dossier.createdAt)}
                />
                <MetaRow
                  icon={Clock}
                  label="Cập nhật"
                  value={
                    dossier.updatedAt
                      ? formatDateTime(dossier.updatedAt)
                      : null
                  }
                />
              </div>
            </SectionCard>
          </div>
        </div>

        <StandardDialog
          open={rejectOpen}
          onOpenChange={(open) => {
            if (!open && pendingAction !== "reject-archive") setRejectOpen(false);
          }}
          title="Từ chối lưu trữ"
          description="Hồ sơ trả về người nộp kèm lý do để bổ sung."
          size="sm"
          compact
        >
          <DialogForm onSubmit={() => void submitRejectArchive()}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={rejectReasonId} className="text-xs font-medium text-foreground">
                Lý do từ chối
              </label>
              <Textarea
                ref={rejectReasonRef}
                id={rejectReasonId}
                compact
                autoFocus
                rows={3}
                className="min-h-20"
                value={rejectReason}
                aria-invalid={rejectError ? true : undefined}
                aria-describedby={rejectError ? `${rejectReasonId}-error` : undefined}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  setRejectError(null);
                }}
              />
              {rejectError ? <FieldError id={`${rejectReasonId}-error`}>{rejectError}</FieldError> : null}
            </div>
            {rejectSubmitError ? <InlineAlert variant="error">{rejectSubmitError}</InlineAlert> : null}
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)} disabled={pendingAction === "reject-archive"}>
                Hủy
              </Button>
              <Button type="submit" size="sm" variant="destructive" loading={pendingAction === "reject-archive"}>
                Từ chối lưu trữ
              </Button>
            </DialogFooter>
          </DialogForm>
        </StandardDialog>
      </m.div>
    </AnimatePresence>
  );
}
