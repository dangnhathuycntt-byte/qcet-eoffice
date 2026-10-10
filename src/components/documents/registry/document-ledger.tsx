"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { Calendar, CalendarCheck, CalendarClock, CalendarPlus, CalendarX2, Check, Plus, SlidersHorizontal, Inbox, SearchX } from "lucide-react";
import type { OfficialDocument } from "@/types/document";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { PropertyToggleChip } from "@/components/ui/property-toggle-chip";
import {
  LIST_TOOLBAR_SEARCH_COLLAPSED,
  LIST_TOOLBAR_SEARCH_EXPANDED,
  ListToolbarFilterPopover,
  ListToolbarPopover,
  ListToolbarSearch,
  listToolbarPrimaryButtonClass,
} from "@/components/ui/list-toolbar";
import { ActiveFilterBar, FilterSegmentChip } from "@/components/workspace/components/active-filter-breadcrumb";
import { FilterIconDept, FilterIconMonth, FilterIconPriority, FilterIconStatus } from "@/components/dashboard/task-filter-icons";
import { TaskIconDepartment, TaskIconPriority, TaskIconStatus, TaskIconTime } from "@/lib/icons/task-icons";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatLedgerCellDate,
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
  { id: "status", label: "Bước xử lý" },
];

/*
 * Độ rộng cột (CSS px) theo ba mức của chính bảng (SPEC §17.4B), không theo viewport:
 * hẹp < 720px: chọn · văn bản · hạn · bước xử lý;
 * vừa 720–1099px: thêm mức khẩn (chỉ icon) và ngày ban hành;
 * rộng ≥ 1100px: thêm cơ quan ban hành, chủ trì; mức khẩn có nhãn.
 */
const LEDGER_COLUMN_WIDTH: Record<LedgerColumnId, string> = {
  urgency: "112px",
  // Giãn theo chỗ trống (trích yếu vẫn chiếm phần lớn) để tên cơ quan/đơn vị không bị cắt
  issuingAuthority: "minmax(144px,0.4fr)",
  leadUnit: "minmax(144px,0.4fr)",
  dueDate: "96px",
  issuedDate: "96px",
  status: "112px",
};

/** Mức vừa: mức khẩn chỉ còn icon. */
const MEDIUM_URGENCY_WIDTH = "28px";

/** Hai cột này chỉ hiện khi bảng đủ rộng; hẹp hơn thì không đưa vào lưới để các ô còn lại vẫn thẳng hàng. */
const WIDE_ONLY_COLUMNS: LedgerColumnId[] = ["issuingAuthority", "leadUnit"];

/** Bảng hẹp (Quick View đang mở): chỉ giữ hạn xử lý và bước xử lý, văn bản được ưu tiên chỗ. */
const COMPACT_COLUMNS: LedgerColumnId[] = ["dueDate", "status"];

const TONE_TEXT = {
  danger: "text-destructive",
  warning: "text-warning",
  muted: "text-muted-foreground",
  default: "text-foreground/80",
} as const;

/** Mẫu lưới theo cột đang bật; `wide=false` (mức vừa) bỏ các cột chỉ hiện ở mức rộng để khớp với ô đã ẩn. */
export function buildColumnTemplate(visible: LedgerColumnVisibility, wide: boolean): string {
  const tracks = LEDGER_COLUMN_OPTIONS.filter(
    (opt) => visible[opt.id] && (wide || !WIDE_ONLY_COLUMNS.includes(opt.id))
  ).map((opt) => !wide && opt.id === "urgency" ? MEDIUM_URGENCY_WIDTH : LEDGER_COLUMN_WIDTH[opt.id]);
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

export interface LedgerEmptyContext {
  /** Có bộ lọc/từ khóa người dùng đặt (không tính loại sổ, nhóm ở sidebar). */
  isResultFiltered: boolean;
  /** Từ khóa đang tìm (đã trim). */
  search?: string;
  /** Loại sổ: all | inbox | outbox | submission. */
  type?: string;
  /** Nhóm chọn từ sidebar: pending | done | issued. */
  bucket?: string;
}

const EMPTY_SCOPE_COPY: Record<string, Record<string, { title: string; description: string }>> = {
  inbox: {
    pending: { title: "Không có văn bản đến chờ xử lý", description: "Văn bản đến chưa hoàn thành xử lý sẽ hiện ở đây." },
    done: { title: "Chưa có văn bản đến đã xử lý", description: "Văn bản đến đã hoàn thành hoặc đã lập hồ sơ sẽ hiện ở đây." },
  },
  outbox: {
    pending: { title: "Không có văn bản đi chờ xử lý", description: "Dự thảo đang soạn, chờ duyệt hoặc chờ ký sẽ hiện ở đây." },
    done: { title: "Chưa có văn bản đi đã xử lý", description: "Văn bản đã ký, đã cấp số và chờ phát hành sẽ hiện ở đây." },
    issued: { title: "Chưa có văn bản đi đã phát hành", description: "Văn bản đã phát hành sẽ hiện ở đây." },
  },
};

const EMPTY_TYPE_COPY: Record<string, { title: string; description: string }> = {
  inbox: { title: "Chưa có văn bản đến", description: "Vào sổ văn bản đến để bắt đầu theo dõi và giao xử lý." },
  outbox: { title: "Chưa có văn bản đi", description: "Soạn văn bản đi để trình duyệt, ký và phát hành." },
  submission: { title: "Chưa có tờ trình", description: "Soạn tờ trình để trình lãnh đạo xem xét." },
};

/**
 * Nội dung trạng thái rỗng theo đúng ngữ cảnh (NN/g: nói rõ vì sao trống, nơi này sẽ hiện gì, lối đi tiếp):
 * có từ khóa hoặc bộ lọc thì nói không khớp; đang xem một nhóm ở sidebar thì nói nhóm đó trống; còn lại là sổ chưa có văn bản.
 */
export function getLedgerEmptyCopy(ctx: LedgerEmptyContext): { title: string; description: string } {
  if (ctx.isResultFiltered) {
    const search = ctx.search?.trim();
    return search
      ? { title: `Không tìm thấy văn bản với từ khóa "${search}"`, description: "Kiểm tra lại chính tả, thử số, ký hiệu hoặc một phần trích yếu, hoặc bỏ bớt bộ lọc." }
      : { title: "Không có văn bản khớp bộ lọc", description: "Thử bỏ bớt bộ lọc đang chọn." };
  }
  const scoped = ctx.type && ctx.bucket ? EMPTY_SCOPE_COPY[ctx.type]?.[ctx.bucket] : undefined;
  if (scoped) return scoped;
  return (ctx.type && EMPTY_TYPE_COPY[ctx.type]) || { title: "Chưa có văn bản nào", description: "Vào sổ hoặc soạn văn bản mới để bắt đầu." };
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
  onClearFilters: () => void;
  visibleColumns: LedgerColumnVisibility;
  onVisibleColumnsChange: (columns: LedgerColumnVisibility) => void;
}

export function DocumentLedgerToolbar({
  title,
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
    // Cùng thanh công cụ trang Nhiệm vụ: tiêu đề bên trái; tìm · lọc · hiển thị · hành động chính bên phải.
    // Xóa bộ lọc nằm ở hàng chip bên dưới ("Xóa lọc"), không lặp lại cạnh nút Lọc.
    <div data-slot="document-ledger-toolbar" className="flex items-center gap-1.5">
      <div className="flex min-w-0 flex-1 items-center pr-4">
        <h1 className="truncate text-compact font-semibold text-foreground select-none">{title}</h1>
      </div>
      <ListToolbarSearch
        ref={searchRef}
        value={searchValue}
        onChange={onSearchChange}
        placeholder="Tìm văn bản… /"
        aria-label="Tìm văn bản"
        title="Tìm theo số, ký hiệu, trích yếu"
        collapsedWidthClassName={LIST_TOOLBAR_SEARCH_COLLAPSED}
        expandedWidthClassName={LIST_TOOLBAR_SEARCH_EXPANDED}
      />
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
  );
}

const FILTER_CHIP_ICON: Record<string, React.ComponentType<any> | undefined> = {
  status: FilterIconStatus,
  urgency: FilterIconPriority,
  leadUnit: FilterIconDept,
  year: FilterIconMonth,
};

export interface DocumentActiveFiltersProps {
  filters: Array<{ id: string; label: string; value: string; onClear: () => void }>;
  onClearAll: () => void;
  /** Số văn bản khớp bộ lọc; null khi đang tải (không hiện số cũ cho truy vấn mới). */
  total: number | null;
}

/** Hàng bộ lọc đang áp dụng dưới thanh công cụ, dùng chung `ActiveFilterBar` của trang Nhiệm vụ. */
export function DocumentActiveFilters({ filters, onClearAll, total }: DocumentActiveFiltersProps) {
  if (filters.length === 0) return null;
  return (
    <ActiveFilterBar onClearAll={onClearAll} filteredCount={total ?? undefined}>
      {filters.map((f) => (
        <FilterSegmentChip
          key={f.id}
          dataSlot={`filter-chip-${f.id}`}
          icon={FILTER_CHIP_ICON[f.id]}
          label={f.label}
          value={f.value}
          onRemove={f.onClear}
        />
      ))}
    </ActiveFilterBar>
  );
}

/* ------------------------------------------------------------------ */
/* Table — cùng ngôn ngữ với bảng Nhiệm vụ                              */
/* ------------------------------------------------------------------ */

/*
 * Ba mẫu lưới theo độ rộng của chính bảng (container query), không theo viewport:
 * hẹp (< 720px, Quick View đang mở) / vừa / rộng (≥ 1100px, thêm cơ quan ban hành và chủ trì).
 * Ô nào không có trong mẫu của mức hiện tại phải ẩn để các ô còn lại vẫn thẳng hàng.
 * Hàng và tiêu đề tối thiểu 40px (cỡ medium của Carbon data table), tiêu đề cột cao bằng hàng.
 * Trích yếu một dòng (cắt cuối, có tooltip); tên cơ quan ban hành/chủ trì không cắt mà xuống tối đa 2 dòng (hàng 48px).
 */
const GRID =
  "grid min-h-10 items-center py-1 gap-x-2 px-2 [grid-template-columns:var(--ledger-cols-sm)] @[720px]/ledger:[grid-template-columns:var(--ledger-cols)] @[1100px]/ledger:[grid-template-columns:var(--ledger-cols-xl)]";
/** Ô ẩn ở mức hẹp, hiện từ mức vừa. */
const FROM_MEDIUM = "hidden @[720px]/ledger:block";
/** Ô ẩn dưới mức rộng, hiện từ mức rộng. */
const FROM_WIDE = "hidden @[1100px]/ledger:block";
/**
 * Tên cơ quan/đơn vị: xuống dòng (tối đa 2 dòng × 20px), không ghi tắt bằng "…".
 * `line-clamp` đặt `display: -webkit-box` nên phải nằm ở thẻ con: đặt chung với `hidden` của ô sẽ làm ô hiện ở mức hẹp/vừa.
 */
const WRAP_TEXT = "break-words text-xs leading-5 text-muted-foreground line-clamp-2";

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
            always ? "opacity-60" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-within:opacity-100"
          )}
        />
      )}
    </button>
  );
}

/** Nhãn mức khẩn dạng "Thượng khẩn"; null khi văn bản không khẩn. */
function urgencyText(doc: OfficialDocument): { label: string; toneClass: string } | null {
  const tag = getLedgerUrgencyTag(doc.urgency);
  if (!tag) return null;
  return {
    label: tag.label.charAt(0) + tag.label.slice(1).toLowerCase(),
    toneClass: tag.tone === "danger" ? TONE_TEXT.danger : TONE_TEXT.warning,
  };
}

/**
 * Mỗi mức khẩn một icon riêng (theo bộ icon độ ưu tiên): Hỏa tốc = dấu chấm than, Thượng khẩn = 3 cột,
 * Khẩn = 2 cột, Thường = 1 cột. Màu không thay nhãn: tên luôn có trong nhãn truy cập và tooltip.
 */
const URGENCY_ICON: Record<string, string> = { flash: "URGENT", top_urgent: "HIGH", urgent: "NORMAL", normal: "LOW" };

function UrgencyIcon({ doc, className }: { doc: OfficialDocument; className?: string }) {
  const urgent = urgencyText(doc);
  return (
    <PrioritySignalBars
      priority={URGENCY_ICON[doc.urgency] ?? "LOW"}
      className={cn(urgent ? urgent.toneClass : "text-muted-foreground/60", className)}
      ariaLabel={`Mức khẩn: ${urgent?.label ?? "Thường"}`}
    />
  );
}

function UrgencyCell({ doc }: { doc: OfficialDocument }) {
  const urgent = urgencyText(doc);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-xs font-medium", urgent ? urgent.toneClass : "text-muted-foreground")}>
      <UrgencyIcon doc={doc} />
      {/* Nhãn chỉ hiện ở mức rộng (cột 112px); mức vừa chỉ icon, tên nằm ở nhãn truy cập/tooltip */}
      <span className="hidden truncate @[1100px]/ledger:inline">{urgent?.label ?? "Thường"}</span>
    </span>
  );
}

function EmptyCell({ label }: { label: string }) {
  return (
    <span className="text-xs text-muted-foreground/60">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function DueCell({ doc, today, filterYear }: { doc: OfficialDocument; today: string; filterYear?: number }) {
  if (!doc.dueDate) return <EmptyCell label="Chưa có hạn xử lý" />;
  const note = getLedgerDueNote(doc.dueDate, isLedgerDone(doc.status), today);
  const Icon = !note ? CalendarCheck : note.tone === "danger" ? CalendarX2 : note.tone === "warning" ? CalendarClock : Calendar;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 tabular-nums text-xs" title={`Hạn ${formatLedgerDate(doc.dueDate)}${note ? ` · ${note.text}` : ""}`}>
      <Icon
        className={cn("size-3.5 shrink-0", note?.tone === "danger" ? "text-destructive" : note?.tone === "warning" ? "text-warning" : "text-muted-foreground/70")}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span className={cn("truncate font-medium", note ? "text-foreground" : "text-muted-foreground")}>{formatLedgerCellDate(doc.dueDate, filterYear)}</span>
      {note ? <span className="sr-only">{note.text}</span> : null}
    </span>
  );
}

function IssuedDateCell({ doc, filterYear }: { doc: OfficialDocument; filterYear?: number }) {
  if (!doc.issuedDate) return <EmptyCell label="Chưa có ngày ban hành" />;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 tabular-nums text-xs text-muted-foreground" title={`Ban hành ${formatLedgerDate(doc.issuedDate)}`}>
      <CalendarPlus className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.5} aria-hidden="true" />
      <span className="truncate">{formatLedgerCellDate(doc.issuedDate, filterYear)}</span>
    </span>
  );
}

export interface DocumentLedgerTableProps {
  documents: OfficialDocument[];
  selectedIds: Set<string>;
  selectedDocumentId?: string | null;
  numberHeader: string;
  visibleColumns: LedgerColumnVisibility;
  /** Năm đang lọc: ngày trong bảng được rút gọn "dd/MM" khi trùng năm này. */
  filterYear?: number;
  /** Có bộ lọc hoặc từ khóa đang áp dụng: phân biệt "không khớp" với "sổ chưa có văn bản". */
  isFiltered?: boolean;
  /** Nội dung trạng thái rỗng theo ngữ cảnh (`getLedgerEmptyCopy`); bỏ trống thì suy từ `isFiltered`. */
  emptyCopy?: { title: string; description: string };
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpen: (doc: OfficialDocument) => void;
  /** Focus chuyển sang dòng khác bằng bàn phím (j/k, ↑/↓): Quick View đang mở thì đổi văn bản theo. */
  onNavigate?: (doc: OfficialDocument) => void;
  /** → trên dòng đang xem: chuyển focus sang tiêu đề Quick View. */
  onFocusDetail?: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

interface LedgerRowProps {
  doc: OfficialDocument;
  documents: OfficialDocument[];
  selected: boolean;
  isOpen: boolean;
  showSelectors: boolean;
  numberHeader: string;
  visibleColumns: LedgerColumnVisibility;
  filterYear?: number;
  today: string;
  onOpen: (doc: OfficialDocument) => void;
  onNavigate?: (doc: OfficialDocument) => void;
  onFocusDetail?: () => void;
  onToggleSelect: (id: string) => void;
}

function LedgerRow({ doc, documents, selected, isOpen, showSelectors, numberHeader, visibleColumns, filterYear, today, onOpen, onNavigate, onFocusDetail, onToggleSelect }: LedgerRowProps) {
  const step = getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type);
  const no = numberLabel(doc);
  const urgent = urgencyText(doc);
  const unit = doc.leadDepartment && doc.leadDepartment !== "Chưa phân công" ? doc.leadDepartment : "";
  const summaryRef = React.useRef<HTMLSpanElement>(null);
  const [hover, setHover] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [truncated, setTruncated] = React.useState(false);
  const wantTooltip = hover || focused;
  // Chỉ đo khi cần hiện tooltip: trích yếu không bị cắt thì không có gì để xem thêm
  React.useLayoutEffect(() => {
    if (!wantTooltip) return;
    const el = summaryRef.current;
    setTruncated(Boolean(el && el.scrollWidth > el.clientWidth + 1));
  }, [wantTooltip]);
  const identifiers = [no ? `${numberHeader} ${no}` : null, doc.documentNumber || null].filter(Boolean).join(" · ");

  return (
    <div
      role="row"
      tabIndex={0}
      data-doc-id={doc.id}
      aria-selected={selected}
      aria-current={isOpen ? "true" : undefined}
      aria-keyshortcuts={isOpen && onFocusDetail ? "ArrowRight" : undefined}
      onClick={() => onOpen(doc)}
      onFocus={(e) => {
        if (e.target === e.currentTarget && e.currentTarget.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(e) => {
        if (e.target === e.currentTarget) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen(doc);
          return;
        }
        if (e.key === "ArrowRight" && isOpen && onFocusDetail) {
          e.preventDefault();
          onFocusDetail();
          return;
        }
        const delta = e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0;
        if (!delta) return;
        const index = documents.findIndex((d) => d.id === doc.id);
        const next = documents[index + delta];
        if (!next) return;
        e.preventDefault();
        const row = e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(next.id)}"]`);
        row?.focus();
        onNavigate?.(next);
      }}
      className={cn(
        GRID,
        "group cursor-pointer select-none text-foreground transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        isOpen ? "bg-selected" : selected ? "bg-muted/60 hover:bg-muted/80" : "hover:bg-muted/40"
      )}
    >
      <span role="cell" className="flex items-center">
        <RowSelector checked={selected} label={`Chọn văn bản ${doc.documentNumber || no || doc.summary}`} onToggle={() => onToggleSelect(doc.id)} always={showSelectors} />
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-1.5">
        {/* Bảng hẹp không có cột mức khẩn: văn bản khẩn hiện icon ngay đầu ô */}
        {visibleColumns.urgency && urgent ? <UrgencyIcon doc={doc} className="@[720px]/ledger:hidden" /> : null}
        <Tooltip open={wantTooltip && truncated} onOpenChange={setHover}>
          <TooltipTrigger asChild>
            <span ref={summaryRef} className="min-w-0 truncate text-compact font-medium text-foreground transition-colors group-hover:text-primary">
              {doc.summary}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="max-w-96 whitespace-normal py-1.5 leading-snug">
            {doc.summary}
            {identifiers ? <span className="mt-0.5 block font-mono font-normal opacity-70">{identifiers}</span> : null}
          </TooltipContent>
        </Tooltip>
        {doc.documentNumber ? (
          <span className="hidden min-w-0 max-w-40 shrink-[2] truncate font-mono text-xs text-muted-foreground @[1100px]/ledger:inline" title={`Số, ký hiệu: ${doc.documentNumber}`}>
            {doc.documentNumber}
          </span>
        ) : null}
      </span>
      {visibleColumns.urgency ? <span role="cell" className={FROM_MEDIUM}><UrgencyCell doc={doc} /></span> : null}
      {visibleColumns.issuingAuthority ? (
        <span role="cell" className={cn(FROM_WIDE, "min-w-0")}>
          <span className={WRAP_TEXT}>{doc.issuingAuthority || <EmptyCell label="Chưa có cơ quan ban hành" />}</span>
        </span>
      ) : null}
      {visibleColumns.leadUnit ? (
        <span role="cell" className={cn(FROM_WIDE, "min-w-0")}>
          <span className={WRAP_TEXT}>{unit || <EmptyCell label="Chưa có đơn vị chủ trì" />}</span>
        </span>
      ) : null}
      {visibleColumns.dueDate ? <span role="cell" className="flex min-w-0"><DueCell doc={doc} today={today} filterYear={filterYear} /></span> : null}
      {visibleColumns.issuedDate ? <span role="cell" className={cn(FROM_MEDIUM, "min-w-0")}><IssuedDateCell doc={doc} filterYear={filterYear} /></span> : null}
      {visibleColumns.status ? (
        <span role="cell" className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={step.label}>
          <TaskStatusCircle status={STEP_STATUS[step.kind]} />
          <span className="truncate font-medium">{step.label}</span>
        </span>
      ) : null}
    </div>
  );
}

export function DocumentLedgerTable({
  documents,
  selectedIds,
  selectedDocumentId,
  numberHeader,
  visibleColumns,
  filterYear,
  isFiltered,
  emptyCopy,
  emptyAction,
  isLoading,
  error,
  onRetry,
  onOpen,
  onNavigate,
  onFocusDetail,
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
    <div role="row" className={cn(GRID, "whitespace-nowrap text-xs font-medium text-muted-foreground select-none")}>
      <span role="columnheader" className="flex items-center">
        <RowSelector checked={allSelected} label="Chọn tất cả văn bản trên trang này" onToggle={onSelectAll} always />
      </span>
      <span role="columnheader">Văn bản</span>
      {visibleColumns.urgency ? (
        <span role="columnheader" className={FROM_MEDIUM}>
          {/* Cột 28px ở mức vừa chỉ đủ cho icon: tiêu đề ẩn khỏi mắt nhưng vẫn có tên */}
          <span className="sr-only @[1100px]/ledger:not-sr-only">Mức khẩn</span>
        </span>
      ) : null}
      {visibleColumns.issuingAuthority ? <span role="columnheader" className={FROM_WIDE}>Cơ quan ban hành</span> : null}
      {visibleColumns.leadUnit ? <span role="columnheader" className={FROM_WIDE}>Chủ trì</span> : null}
      {visibleColumns.dueDate ? <span role="columnheader">Hạn xử lý</span> : null}
      {visibleColumns.issuedDate ? <span role="columnheader" className={FROM_MEDIUM}>Ngày ban hành</span> : null}
      {visibleColumns.status ? <span role="columnheader">Bước xử lý</span> : null}
    </div>
  );

  if (isLoading) {
    return (
      <div role="table" aria-busy="true" aria-label="Sổ văn bản" data-slot="document-ledger-table" className="@container/ledger" style={wrapperStyle}>
        {header}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex h-10 items-center gap-2 px-2 animate-pulse">
            <div className="size-4 shrink-0 rounded-[4px] bg-muted/50" />
            <div className="h-3 rounded bg-muted/70" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
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
    const copy = emptyCopy ?? getLedgerEmptyCopy({ isResultFiltered: Boolean(isFiltered) });
    // Đặt giữa vùng danh sách như trạng thái rỗng của Nhiệm vụ, không dạt lên đầu để lại khoảng trắng lớn
    return (
      <div data-slot="document-ledger-table" className="flex min-h-[48vh] items-center justify-center">
        <EmptyState
          role="status"
          density="compact"
          icon={isFiltered ? <SearchX strokeWidth={1.5} /> : <Inbox strokeWidth={1.5} />}
          title={copy.title}
          description={copy.description}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div role="table" aria-label="Sổ văn bản" data-slot="document-ledger-table" className="@container/ledger" style={wrapperStyle}>
      {header}
      {documents.map((doc) => (
        <LedgerRow
          key={doc.id}
          doc={doc}
          documents={documents}
          selected={selectedIds.has(doc.id)}
          isOpen={selectedDocumentId === doc.id}
          showSelectors={selectedIds.size > 0}
          numberHeader={numberHeader}
          visibleColumns={visibleColumns}
          filterYear={filterYear}
          today={today}
          onOpen={onOpen}
          onNavigate={onNavigate}
          onFocusDetail={onFocusDetail}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
