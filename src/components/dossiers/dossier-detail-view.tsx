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
  Loader2,
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
import { DossierDisposalPanel } from "./dossier-disposal-panel";

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
    className: "bg-blue-500/10 text-blue-700 border-blue-500/20",
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
  ACCEPTED: {
    label: "Đã chấp nhận",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  ARCHIVED: {
    label: "Đã lưu trữ",
    className: "bg-emerald-600/10 text-emerald-800 border-emerald-600/20",
  },
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  PUBLIC: "Công khai",
  INTERNAL: "Nội bộ",
  RESTRICTED: "Hạn chế",
  PERSONAL_DATA: "Dữ liệu cá nhân",
};

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
      <Icon
        className="size-3.5 text-muted-foreground shrink-0 mt-0.5"
        strokeWidth={1.5}
      />
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
      return `/documents/${itemId}`;
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
    if (!window.confirm(confirmMsg)) return;
    setPendingAction(actionPath);
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
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }));
        window.alert(err.error ?? "Thao tác thất bại");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleRejectArchive() {
    const reason = window.prompt("Nhập lý do từ chối lưu trữ:");
    if (!reason || reason.trim().length === 0) return;
    setPendingAction("reject-archive");
    fetch(`/api/dossiers/${dossier.id}/actions/reject-archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ returnReason: reason.trim() }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }));
          window.alert(err.error ?? "Thao tác thất bại");
          return;
        }
        router.refresh();
      })
      .catch(() => {
        window.alert("Lỗi kết nối. Vui lòng thử lại.");
      })
      .finally(() => {
        setPendingAction(null);
      });
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
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Quay lại danh sách
          </Link>
        </div>

        {/* Header card */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
              <FolderArchive className="size-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground font-heading leading-snug">
                {dossier.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-foreground">
                  <Hash
                    className="size-3.5 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  <span className="font-mono font-medium">
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
                  <Calendar className="size-3.5" strokeWidth={1.5} />
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
              const isLoading = pendingAction === action.key;
              return (
                <button
                  key={action.key}
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={action.handler}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    action.style === "primary" &&
                      "bg-foreground text-background hover:bg-foreground/90",
                    action.style === "secondary" &&
                      "border border-border text-foreground hover:bg-muted/60",
                    action.style === "destructive" &&
                      "border border-red-300 text-red-700 hover:bg-red-50",
                  )}
                  style={{ transition: `opacity, transform ${motionTransition.micro.duration}s` }}
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Icon className="size-3.5" strokeWidth={1.5} />
                  )}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

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
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left font-medium text-muted-foreground pb-2 pr-3 w-10">
                          STT
                        </th>
                        <th className="text-left font-medium text-muted-foreground pb-2 pr-3">
                          Tiêu đề
                        </th>
                        <th className="hidden md:table-cell text-left font-medium text-muted-foreground pb-2 pr-3 w-24">
                          Loại
                        </th>
                        <th className="hidden md:table-cell text-left font-medium text-muted-foreground pb-2 pr-3 w-28">
                          Số văn bản
                        </th>
                        <th className="text-left font-medium text-muted-foreground pb-2 pr-3 w-24">
                          Ngày VB
                        </th>
                        <th className="hidden md:table-cell text-right font-medium text-muted-foreground pb-2 pr-3 w-14">
                          Trang
                        </th>
                        <th className="hidden md:table-cell text-left font-medium text-muted-foreground pb-2 w-28">
                          Người thêm
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.items.map((item, idx) => {
                        const href = itemDetailHref(
                          item.itemType,
                          item.itemId,
                        );
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-border/30 last:border-0"
                          >
                            <td className="py-2 pr-3 text-muted-foreground tabular-nums">
                              {item.sequence ?? idx + 1}
                            </td>
                            <td className="py-2 pr-3">
                              {href ? (
                                <Link
                                  href={href}
                                  className="text-foreground hover:underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring rounded"
                                >
                                  {item.title}
                                </Link>
                              ) : (
                                <span className="text-foreground">
                                  {item.title}
                                </span>
                              )}
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {item.notes}
                                </p>
                              )}
                            </td>
                            <td className="hidden md:table-cell py-2 pr-3 text-muted-foreground">
                              {ITEM_TYPE_LABEL[item.itemType] ??
                                item.itemType}
                            </td>
                            <td className="hidden md:table-cell py-2 pr-3 font-mono text-foreground">
                              {item.documentNumber ?? "—"}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground tabular-nums">
                              {formatDate(item.documentDate) || "—"}
                            </td>
                            <td className="hidden md:table-cell py-2 pr-3 text-right text-muted-foreground tabular-nums">
                              {item.pageCount ?? "—"}
                            </td>
                            <td className="hidden md:table-cell py-2 text-muted-foreground">
                              {item.addedBy?.name ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
      </m.div>
    </AnimatePresence>
  );
}
