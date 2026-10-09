"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Check,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import type { OfficialDocument } from "@/types/document";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { PropertyToggleChip } from "@/components/ui/property-toggle-chip";
import { ListToolbarFilterPopover, ListToolbarPopover, ListToolbarSearch, listToolbarPrimaryButtonClass } from "@/components/ui/list-toolbar";
import { TaskIconDepartment, TaskIconPriority, TaskIconStatus, TaskIconTime } from "@/lib/icons/task-icons";
import { cn } from "@/lib/utils";
import {
  formatLedgerDate,
  getLedgerDueNote,
  getLedgerStepLabel,
  getLedgerUrgencyTag,
  type LedgerStepKind,
  isLedgerDone,
  todayInVietnam,
} from "@/lib/documents/document-ledger-format";

const URGENCY_OPTIONS = [
  { value: "ALL", label: "Tất cả mức khẩn" },
  { value: "flash", label: "Hỏa tốc" },
  { value: "top_urgent", label: "Thượng khẩn" },
  { value: "urgent", label: "Khẩn" },
  { value: "normal", label: "Thường" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "pending_assignment", label: "Chờ bút phê" },
  { value: "processing", label: "Đang xử lý" },
  { value: "approved", label: "Chờ phê duyệt" },
  { value: "completed", label: "Đã lập hồ sơ" },
];

/** Cột tùy chọn của sổ. Văn bản và chọn dòng luôn hiển thị. */
export type LedgerColumnId = "urgency" | "issuingAuthority" | "leadUnit" | "dueDate" | "issuedDate" | "status";

export type LedgerColumnVisibility = Record<LedgerColumnId, boolean>;

export const DEFAULT_LEDGER_COLUMNS: LedgerColumnVisibility = {
  urgency: true,
  issuingAuthority: true,
  leadUnit: true,
  dueDate: true,
  issuedDate: true,
  status: true,
};

const LEDGER_COLUMN_OPTIONS: Array<{ id: LedgerColumnId; label: string }> = [
  { id: "urgency", label: "Mức khẩn" },
  { id: "issuingAuthority", label: "Cơ quan ban hành" },
  { id: "leadUnit", label: "Chủ trì" },
  { id: "dueDate", label: "Hạn xử lý" },
  { id: "issuedDate", label: "Ngày ban hành" },
  { id: "status", label: "Trạng thái" },
];

const LEDGER_COLUMN_WIDTH: Record<LedgerColumnId, string> = {
  urgency: "80px",
  issuingAuthority: "160px",
  leadUnit: "160px",
  dueDate: "96px",
  issuedDate: "96px",
  status: "120px",
};

/** Hai cột này chỉ hiện khi bảng đủ rộng; hẹp hơn thì không đưa vào lưới để các ô còn lại vẫn thẳng hàng. */
const WIDE_ONLY_COLUMNS: LedgerColumnId[] = ["issuingAuthority", "leadUnit"];

/** Bảng hẹp (Quick View đang mở): chỉ giữ hạn xử lý và trạng thái, văn bản được ưu tiên chỗ. */
const COMPACT_COLUMNS: LedgerColumnId[] = ["dueDate", "status"];

const TONE_TEXT = {
  danger: "text-rose-600",
  warning: "text-amber-600",
  muted: "text-muted-foreground",
  default: "text-foreground/80",
} as const;

/** Mẫu lưới theo cột đang bật; `wide=false` bỏ các cột chỉ hiện từ xl để khớp với ô đã ẩn. */
export function buildColumnTemplate(visible: LedgerColumnVisibility, wide: boolean): string {
  const tracks = LEDGER_COLUMN_OPTIONS.filter(
    (opt) => visible[opt.id] && (wide || !WIDE_ONLY_COLUMNS.includes(opt.id))
  ).map((opt) => !wide && opt.id === "urgency" ? "56px" : LEDGER_COLUMN_WIDTH[opt.id]);
  return ["24px", "minmax(0,1fr)", ...tracks].join(" ");
}

/** Mẫu lưới khi bảng hẹp: ô chọn, văn bản, rồi chỉ các cột trong `COMPACT_COLUMNS` đang bật. */
export function buildCompactColumnTemplate(visible: LedgerColumnVisibility): string {
  const tracks = LEDGER_COLUMN_OPTIONS.filter((opt) => visible[opt.id] && COMPACT_COLUMNS.includes(opt.id)).map(
    (opt) => LEDGER_COLUMN_WIDTH[opt.id]
  );
  return ["24px", "minmax(0,1fr)", ...tracks].join(" ");
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

/** Phím tắt "/" và "F" chỉ chạy khi không gõ liệu, không có hộp thoại đang hiển thị và không có tổ hợp phím. */
function isShortcutBlocked(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || e.keyCode === 229) return true;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return true;
  const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open], [aria-modal="true"]');
  return Array.from(modals).some((el) => el.getClientRects().length > 0);
}

/** Nội dung trạng thái rỗng: có bộ lọc đổi kết quả thì nói là không khớp, không thì nói sổ chưa có văn bản. */
export function getLedgerEmptyCopy(isResultFiltered: boolean): { title: string; description: string } {
  return isResultFiltered
    ? { title: "Không có văn bản khớp bộ lọc", description: "Thử bỏ bớt bộ lọc hoặc từ khóa tìm kiếm." }
    : { title: "Chưa có văn bản nào", description: "Vào sổ văn bản mới để bắt đầu." };
}

export interface LedgerFilterOption {
  value: string;
  label: string;
}

interface LedgerFilterCategory {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  options: LedgerFilterOption[];
  value: string;
  valueLabel?: string;
  onSelect: (value: string) => void;
}

export interface DocumentLedgerToolbarProps {
  title: string;
  total: number | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  urgency: string;
  onUrgencyChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  year?: number;
  onYearChange: (year: number | undefined) => void;
  leadUnitId: string;
  leadUnitLabel?: string;
  leadUnitOptions: LedgerFilterOption[];
  onLeadUnitChange: (leadUnitId: string) => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  activeFilters: Array<{ id: string; label: string; value: string; onClear: () => void }>;
  onClearFilters: () => void;
  visibleColumns: LedgerColumnVisibility;
  onVisibleColumnsChange: (columns: LedgerColumnVisibility) => void;
}

export function DocumentLedgerToolbar({
  title,
  total,
  searchValue,
  onSearchChange,
  urgency,
  onUrgencyChange,
  status,
  onStatusChange,
  year,
  onYearChange,
  leadUnitId,
  leadUnitLabel,
  leadUnitOptions,
  onLeadUnitChange,
  primaryActionLabel,
  onPrimaryAction,
  activeFilters,
  onClearFilters,
  visibleColumns,
  onVisibleColumnsChange,
}: DocumentLedgerToolbarProps) {
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [isDisplayOpen, setIsDisplayOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        if (isShortcutBlocked(e)) return;
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "f" || e.key === "F") && !isShortcutBlocked(e)) {
        e.preventDefault();
        setIsFilterOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentYear = new Date().getFullYear();
  const yearOptions: LedgerFilterOption[] = [
    { value: "ALL", label: "Tất cả các năm" },
    ...Array.from({ length: 5 }, (_, i) => String(currentYear - i)).map((y) => ({ value: y, label: `Năm ${y}` })),
  ];
  const categories: LedgerFilterCategory[] = [
    {
      id: "urgency",
      label: "Mức khẩn",
      Icon: TaskIconPriority,
      options: URGENCY_OPTIONS,
      value: urgency,
      valueLabel: URGENCY_OPTIONS.find((o) => o.value === urgency && o.value !== "ALL")?.label,
      onSelect: onUrgencyChange,
    },
    {
      id: "status",
      label: "Trạng thái",
      Icon: TaskIconStatus,
      options: STATUS_OPTIONS,
      value: status,
      valueLabel: STATUS_OPTIONS.find((o) => o.value === status && o.value !== "ALL")?.label,
      onSelect: onStatusChange,
    },
    {
      id: "year",
      label: "Năm",
      Icon: TaskIconTime,
      options: yearOptions,
      value: year ? String(year) : "ALL",
      valueLabel: year ? `Năm ${year}` : undefined,
      onSelect: (v) => onYearChange(v === "ALL" ? undefined : parseInt(v, 10)),
    },
    {
      id: "leadUnit",
      label: "Đơn vị chủ trì",
      Icon: TaskIconDepartment,
      options: [{ value: "ALL", label: "Tất cả đơn vị" }, ...leadUnitOptions],
      value: leadUnitId || "ALL",
      valueLabel: leadUnitId ? leadUnitLabel : undefined,
      onSelect: (v) => onLeadUnitChange(v === "ALL" ? "" : v),
    },
  ];
  const filterCount =
    (urgency !== "ALL" ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (year ? 1 : 0) + (leadUnitId ? 1 : 0);

  return (
    <div data-slot="document-ledger-toolbar">
      <div className="flex flex-wrap items-center gap-2 min-h-10">
        <div className="flex shrink-0 items-baseline gap-2">
          <h1 className="whitespace-nowrap text-compact font-semibold text-foreground">{title}</h1>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{total ?? "—"}</span>
        </div>
        <span className="flex-1" />

        <div className="order-last flex w-full items-center gap-1.5 sm:order-none sm:w-auto">
          <ListToolbarSearch
            ref={searchRef}
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Tìm số, ký hiệu, trích yếu…"
            aria-label="Tìm văn bản"
            collapsedWidthClassName="w-full sm:w-56"
            expandedWidthClassName="w-full sm:w-72"
          />
        </div>

        <ListToolbarFilterPopover
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          categories={categories}
          activeCount={filterCount}
          onClear={onClearFilters}
          ariaLabel="Bộ lọc văn bản"
        />

        <ListToolbarPopover
          open={isDisplayOpen}
          onOpenChange={setIsDisplayOpen}
          ariaLabel="Tùy chọn hiển thị và thuộc tính bảng"
          title="Hiển thị"
          width="w-64"
          trigger={<SlidersHorizontal className="size-3.5" strokeWidth={1.5} />}
        >
          <div className="flex flex-col gap-2 p-2">
            <p className="text-xs font-medium text-muted-foreground">Thuộc tính hiển thị</p>
            <div className="flex flex-wrap gap-1.5">
              {LEDGER_COLUMN_OPTIONS.map((opt) => (
                <PropertyToggleChip
                  key={opt.id}
                  pressed={visibleColumns[opt.id]}
                  onPressedChange={(pressed) => onVisibleColumnsChange({ ...visibleColumns, [opt.id]: pressed })}
                >
                  {opt.label}
                </PropertyToggleChip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Cơ quan ban hành và Chủ trì chỉ hiện khi danh sách đủ rộng.</p>
            <div className="flex justify-end border-t border-border/60 pt-1.5">
              <button
                type="button"
                onClick={() => onVisibleColumnsChange(DEFAULT_LEDGER_COLUMNS)}
                className="h-7 cursor-pointer rounded-md px-2 text-xs text-foreground/80 hover:bg-accent hover:text-foreground"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </ListToolbarPopover>

        <button
          type="button"
          onClick={onPrimaryAction}
          aria-label={primaryActionLabel}
          title={primaryActionLabel}
          className={listToolbarPrimaryButtonClass}
        >
          <Plus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span>{primaryActionLabel}</span>
        </button>
      </div>

      <div className="h-px bg-border/60" />

      {activeFilters.some((f) => f.id !== "bucket") ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-h-8 mt-3 text-compact">
          <span className="flex-1" />
          {activeFilters.filter((f) => f.id !== "bucket").map((f) => (
            <FilterChip key={f.id} label={f.label} value={f.value} onRemove={f.onClear} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table — cùng ngôn ngữ với bảng Nhiệm vụ                              */
/* ------------------------------------------------------------------ */

/*
 * Ba mẫu lưới theo độ rộng của chính bảng (container query), không theo viewport:
 * hẹp (< 720px, Quick View đang mở) / vừa / rộng (≥ 1100px, thêm cơ quan ban hành và chủ trì).
 * Ô nào không có trong mẫu của mức hiện tại phải ẩn để các ô còn lại vẫn thẳng hàng.
 */
const GRID =
  "grid items-center gap-x-4 pl-3 pr-4 [grid-template-columns:var(--ledger-cols-sm)] @[720px]/ledger:[grid-template-columns:var(--ledger-cols)] @[1100px]/ledger:[grid-template-columns:var(--ledger-cols-xl)]";
/** Ô ẩn ở mức hẹp, hiện từ mức vừa. */
const FROM_MEDIUM = "hidden @[720px]/ledger:block";
/** Ô ẩn dưới mức rộng, hiện từ mức rộng. */
const FROM_WIDE = "hidden @[1100px]/ledger:block";

const STEP_STATUS: Record<LedgerStepKind, string> = {
  new: "NOT_STARTED",
  progress: "IN_PROGRESS",
  review: "WAITING_APPROVAL",
  done: "COMPLETED",
};

const numberLabel = (doc: OfficialDocument): string | null =>
  doc.registrationNumber != null ? String(doc.registrationNumber).padStart(4, "0") : null;

function RowSelector({ checked, label, onToggle, always }: { checked: boolean; label: string; onToggle: () => void; always?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="relative flex size-6 items-center justify-center rounded outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
    >
      {checked ? (
        <span className="flex size-4 items-center justify-center rounded-[4px] bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={1.5} />
        </span>
      ) : (
        <span
          className={cn(
            "size-4 rounded-[4px] border border-border/70 bg-background/60 transition-opacity",
            always ? "opacity-60" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        />
      )}
    </button>
  );
}

function UrgencyCell({ doc }: { doc: OfficialDocument }) {
  const tag = getLedgerUrgencyTag(doc.urgency);
  if (!tag) {
    return (
      <PrioritySignalBars priority="NORMAL" className="text-muted-foreground" ariaLabel="Mức khẩn: Thường" />
    );
  }
  const label = tag.label.charAt(0) + tag.label.slice(1).toLowerCase();
  const toneClass = tag.tone === "danger" ? TONE_TEXT.danger : TONE_TEXT.warning;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", toneClass)}>
      <PrioritySignalBars priority="URGENT" className={toneClass} ariaLabel={`Mức khẩn: ${label}`} />
      <span className="truncate hidden @[900px]/ledger:inline">{label}</span>
    </span>
  );
}

function DueCell({ doc, today }: { doc: OfficialDocument; today: string }) {
  if (!doc.dueDate) return <span className="text-muted-foreground/50 text-xs">-</span>;
  const note = getLedgerDueNote(doc.dueDate, isLedgerDone(doc.status), today);
  const Icon = !note ? CalendarCheck : note.tone === "danger" ? CalendarX2 : note.tone === "warning" ? CalendarClock : Calendar;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-xs" title={`${formatLedgerDate(doc.dueDate)}${note ? ` · ${note.text}` : ""}`}>
      <Icon
        className={cn("size-3.5 shrink-0", note?.tone === "danger" ? "text-rose-600" : note?.tone === "warning" ? "text-amber-600" : "text-muted-foreground/70")}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span className={cn(note ? "text-foreground font-semibold" : "text-muted-foreground font-semibold")}>{formatLedgerDate(doc.dueDate).slice(0, 5)}</span>
      {note ? <span className="sr-only">{note.text}</span> : null}
    </span>
  );
}

function IssuedDateCell({ doc }: { doc: OfficialDocument }) {
  if (!doc.issuedDate) return <span className="text-muted-foreground/50 text-xs">-</span>;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-xs text-muted-foreground" title={formatLedgerDate(doc.issuedDate)}>
      <CalendarPlus className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.5} aria-hidden="true" />
      <span>{formatLedgerDate(doc.issuedDate).slice(0, 5)}</span>
    </span>
  );
}

export interface DocumentLedgerTableProps {
  documents: OfficialDocument[];
  selectedIds: Set<string>;
  selectedDocumentId?: string | null;
  numberHeader: string;
  visibleColumns: LedgerColumnVisibility;
  /** Có bộ lọc hoặc từ khóa đang áp dụng: phân biệt "không khớp" với "sổ chưa có văn bản". */
  isFiltered?: boolean;
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpen: (doc: OfficialDocument) => void;
  /** Focus chuyển sang dòng khác bằng bàn phím (j/k, ↑/↓): Quick View đang mở thì đổi văn bản theo. */
  onNavigate?: (doc: OfficialDocument) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

export function DocumentLedgerTable({
  documents,
  selectedIds,
  selectedDocumentId,
  numberHeader,
  visibleColumns,
  isFiltered,
  emptyAction,
  isLoading,
  error,
  onRetry,
  onOpen,
  onNavigate,
  onToggleSelect,
  onSelectAll,
}: DocumentLedgerTableProps) {
  const today = React.useMemo(() => todayInVietnam(), []);
  const allSelected = documents.length > 0 && selectedIds.size === documents.length;
  const wrapperStyle = {
    "--ledger-cols-sm": buildCompactColumnTemplate(visibleColumns),
    "--ledger-cols": buildColumnTemplate(visibleColumns, false),
    "--ledger-cols-xl": buildColumnTemplate(visibleColumns, true),
  } as CSSProperties;

  const header = (
    <div role="row" className={cn(GRID, "h-11 text-xs font-medium text-muted-foreground select-none")}>
      <span role="columnheader">
        <RowSelector checked={allSelected} label="Chọn tất cả văn bản" onToggle={onSelectAll} always />
      </span>
      <span role="columnheader">Văn bản</span>
      {visibleColumns.urgency ? <span role="columnheader" className={FROM_MEDIUM}>Mức khẩn</span> : null}
      {visibleColumns.issuingAuthority ? <span role="columnheader" className={FROM_WIDE}>Cơ quan ban hành</span> : null}
      {visibleColumns.leadUnit ? <span role="columnheader" className={FROM_WIDE}>Chủ trì</span> : null}
      {visibleColumns.dueDate ? <span role="columnheader">Hạn xử lý</span> : null}
      {visibleColumns.issuedDate ? <span role="columnheader" className={FROM_MEDIUM}>Ngày ban hành</span> : null}
      {visibleColumns.status ? <span role="columnheader">Trạng thái</span> : null}
    </div>
  );

  if (isLoading) {
    return (
      <div role="table" aria-busy="true" aria-label="Sổ văn bản" data-slot="document-ledger-table" className="@container/ledger" style={wrapperStyle}>
        {header}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="min-h-14 py-2 flex flex-col justify-center gap-1.5 px-3 animate-pulse">
            <div className="h-3.5 w-3/5 rounded bg-muted/70" />
            <div className="h-3 w-2/5 rounded bg-muted/50" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div data-slot="document-ledger-table">
        <DocumentLoadError title="Không thể tải danh sách văn bản" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (documents.length === 0) {
    const copy = getLedgerEmptyCopy(Boolean(isFiltered));
    return (
      <div data-slot="document-ledger-table">
        <EmptyState density="compact" title={copy.title} description={copy.description} action={emptyAction} />
      </div>
    );
  }

  return (
    <div role="table" aria-label="Sổ văn bản" data-slot="document-ledger-table" className="@container/ledger" style={wrapperStyle}>
      {header}
      {documents.map((doc) => {
        const step = getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type);
        const selected = selectedIds.has(doc.id);
        const isOpen = selectedDocumentId === doc.id;
        const no = numberLabel(doc);
        const sub = [no, doc.documentNumber, formatLedgerDate(doc.issuedDate)].filter(Boolean);
        const unit = doc.leadDepartment && doc.leadDepartment !== "Chưa phân công" ? doc.leadDepartment : "";
        return (
          <div
            key={doc.id}
            role="row"
            tabIndex={0}
            data-doc-id={doc.id}
            aria-selected={selected || isOpen}
            aria-current={isOpen ? "true" : undefined}
            onClick={() => onOpen(doc)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
              if (e.key === "Enter") {
                e.preventDefault();
                onOpen(doc);
                return;
              }
              const step = e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              const index = documents.findIndex((d) => d.id === doc.id);
              const next = documents[index + step];
              if (!next) return;
              e.preventDefault();
              const row = e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(next.id)}"]`);
              row?.focus();
              onNavigate?.(next);
            }}
            className={cn(
              GRID,
              "group min-h-12 py-2 cursor-pointer select-none text-foreground transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              selected ? "bg-selected/80 hover:bg-selected" : isOpen ? "bg-primary/[0.08]" : "hover:bg-muted/40"
            )}
          >
            <span role="cell">
              <RowSelector checked={selected} label={`Chọn văn bản ${doc.documentNumber}`} onToggle={() => onToggleSelect(doc.id)} always={selectedIds.size > 0} />
            </span>
            <span role="cell" className="flex min-w-0 flex-col gap-0.5">
              <span className="min-w-0 break-words text-compact font-medium text-foreground transition-colors group-hover:text-primary" title={doc.summary}>
                {doc.summary}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                {no ? <span className="shrink-0 font-mono tabular-nums" title={`${numberHeader} ${no}`}>{no}</span> : null}
                {no && sub.length > 1 ? <span aria-hidden="true">·</span> : null}
                <span className="min-w-0 truncate font-mono" title={sub.join(" · ")}>{[doc.documentNumber, formatLedgerDate(doc.issuedDate)].filter(Boolean).join(" · ")}</span>
              </span>
            </span>
            {visibleColumns.urgency ? <span role="cell" className={FROM_MEDIUM}><UrgencyCell doc={doc} /></span> : null}
            {visibleColumns.issuingAuthority ? (
              <span role="cell" className="hidden min-w-0 break-words text-xs text-muted-foreground @[1100px]/ledger:line-clamp-2" title={doc.issuingAuthority}>
                {doc.issuingAuthority || "-"}
              </span>
            ) : null}
            {visibleColumns.leadUnit ? (
              <span role="cell" className="hidden min-w-0 break-words text-xs text-muted-foreground @[1100px]/ledger:line-clamp-2" title={unit}>
                {unit || "-"}
              </span>
            ) : null}
            {visibleColumns.dueDate ? <span role="cell"><DueCell doc={doc} today={today} /></span> : null}
            {visibleColumns.issuedDate ? <span role="cell" className={FROM_MEDIUM}><IssuedDateCell doc={doc} /></span> : null}
            {visibleColumns.status ? (
              <span role="cell" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <TaskStatusCircle status={STEP_STATUS[step.kind]} />
                <span className="truncate font-semibold">{step.label}</span>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
