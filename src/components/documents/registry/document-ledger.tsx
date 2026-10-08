"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Calendar, CalendarCheck, CalendarClock, CalendarX2, Check, ChevronDown, Filter, Plus, Search, X } from "lucide-react";
import type { OfficialDocument } from "@/types/document";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { TaskIconPriorityHigh, TaskIconPriorityNormal, TaskIconPriorityUrgent } from "@/lib/icons/task-icons";
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

const TONE_TEXT = {
  danger: "text-rose-600",
  warning: "text-amber-600",
  muted: "text-muted-foreground",
  default: "text-foreground/80",
} as const;

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function OptionList({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="listbox" className="flex flex-col">
      {options.map((opt) => {
        const selected = value === opt.value || (opt.value === "ALL" && !value);
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(opt.value)}
            className="flex items-center gap-2 h-7 px-2 rounded-md text-compact text-foreground/90 hover:bg-muted/70 cursor-pointer text-left"
          >
            <span className="flex-1 truncate">{opt.label}</span>
            {selected ? <Check className="size-3.5 text-foreground/70" strokeWidth={1.5} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function ToolbarPopover({
  trigger,
  children,
  width = "w-56",
  active,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  width?: string;
  active?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        // `text-compact` không đi qua cn(): tailwind-merge coi nó là class màu và sẽ bỏ đi.
        className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-compact transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          active || open ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted/70"
        }`}
      >
        {trigger}
      </Popover.Trigger>
      {open ? (
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
            <Popover.Popup
              className={cn(
                "rounded-lg border border-border/70 bg-popover p-1 shadow-md outline-none",
                width
              )}
            >
              {children(() => setOpen(false))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      ) : null}
    </Popover.Root>
  );
}

export interface DocumentLedgerToolbarProps {
  title: string;
  total: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  urgency: string;
  onUrgencyChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  year?: number;
  onYearChange: (year: number | undefined) => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  quickCounts: Array<{
    id: string;
    count: number;
    label: string;
    tone: "default" | "warning" | "danger";
    onSelect?: () => void;
    active?: boolean;
  }>;
  activeFilters: Array<{ id: string; label: string; value: string; onClear: () => void }>;
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
  primaryActionLabel,
  onPrimaryAction,
  quickCounts,
  activeFilters,
}: DocumentLedgerToolbarProps) {
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: "ALL", label: "Tất cả các năm" },
    ...Array.from({ length: 5 }, (_, i) => String(currentYear - i)).map((y) => ({
      value: y,
      label: `Sổ năm ${y}`,
    })),
  ];
  const filterCount = (urgency !== "ALL" ? 1 : 0) + (status !== "ALL" ? 1 : 0);

  return (
    <div data-slot="document-ledger-toolbar">
      <div className="flex items-center gap-2 h-10">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">{title}</h1>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{total}</span>
        </div>
        <span className="flex-1" />

        <label className="hidden sm:flex items-center gap-2 h-7 w-64 rounded-md bg-muted/60 pl-2 pr-1 text-compact text-muted-foreground focus-within:bg-muted focus-within:text-foreground transition-colors">
          <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm số, ký hiệu, trích yếu…"
            aria-label="Tìm văn bản"
            className="flex-1 min-w-0 bg-transparent outline-none text-compact text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="inline-flex size-5 items-center justify-center rounded bg-background/80 text-xs text-muted-foreground">/</kbd>
        </label>

        <ToolbarPopover
          active={filterCount > 0}
          trigger={
            <>
              <Filter className="size-3.5" strokeWidth={1.5} />
              <span>Lọc</span>
              {filterCount > 0 ? (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{filterCount}</span>
              ) : null}
            </>
          }
        >
          {(close) => (
            <div className="flex flex-col gap-1">
              <p className="px-2 pt-1 text-xs text-muted-foreground">Mức khẩn</p>
              <OptionList options={URGENCY_OPTIONS} value={urgency} onSelect={(v) => { onUrgencyChange(v); close(); }} />
              <div className="my-0.5 h-px bg-border/60" />
              <p className="px-2 pt-1 text-xs text-muted-foreground">Trạng thái</p>
              <OptionList options={STATUS_OPTIONS} value={status} onSelect={(v) => { onStatusChange(v); close(); }} />
            </div>
          )}
        </ToolbarPopover>

        <ToolbarPopover
          width="w-44"
          trigger={
            <>
              <span>{year ? `Sổ năm ${year}` : "Mọi năm"}</span>
              <ChevronDown className="size-3 text-muted-foreground" strokeWidth={1.5} />
            </>
          }
        >
          {(close) => (
            <OptionList
              options={yearOptions}
              value={year ? String(year) : "ALL"}
              onSelect={(v) => { onYearChange(v === "ALL" ? undefined : parseInt(v, 10)); close(); }}
            />
          )}
        </ToolbarPopover>

        <span className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={onPrimaryAction}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-compact font-medium hover:bg-primary/90 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
          <span className="hidden md:inline">{primaryActionLabel}</span>
        </button>
      </div>

      <div className="h-px bg-border/60" />

      <div className="flex items-center gap-4 min-h-8 mt-3 text-compact">
        {quickCounts.map((q) => {
          const body = (
            <>
              <b className={cn("font-semibold tabular-nums", q.tone === "default" ? "text-foreground" : "")}>{q.count}</b>
              <span className="ml-1.5">{q.label}</span>
            </>
          );
          const cls =
            q.count === 0
              ? "text-muted-foreground"
              : q.tone === "danger"
              ? TONE_TEXT.danger
              : q.tone === "warning"
              ? TONE_TEXT.warning
              : "text-foreground/80";
          return q.onSelect ? (
            <button
              key={q.id}
              type="button"
              onClick={q.onSelect}
              aria-pressed={q.active}
              className={cn(cls, "cursor-pointer rounded-sm hover:underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50", q.active && "underline")}
            >
              {body}
            </button>
          ) : (
            <span key={q.id} className={cls}>{body}</span>
          );
        })}
        <span className="flex-1" />
        {activeFilters.map((f) => (
          <span key={f.id} className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-muted text-xs text-muted-foreground">
            {f.label}: <b className="font-medium text-foreground">{f.value}</b>
            <button type="button" onClick={f.onClear} aria-label={`Bỏ lọc ${f.label}`} className="cursor-pointer text-muted-foreground/80 hover:text-foreground">
              <X className="size-3" strokeWidth={1.5} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table — cùng ngôn ngữ với bảng Nhiệm vụ                              */
/* ------------------------------------------------------------------ */

const GRID =
  "grid items-center gap-x-3 pl-3 pr-4 grid-cols-[24px_minmax(0,1fr)_96px_112px_132px] " +
  "xl:grid-cols-[24px_minmax(0,1fr)_104px_168px_168px_112px_136px]";

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
      <span className="inline-flex items-center text-muted-foreground" title="Mức khẩn: Thường">
        <TaskIconPriorityNormal className="size-4" />
      </span>
    );
  }
  const Icon = tag.tone === "danger" ? TaskIconPriorityUrgent : TaskIconPriorityHigh;
  const label = tag.label.charAt(0) + tag.label.slice(1).toLowerCase();
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", tag.tone === "danger" ? TONE_TEXT.danger : TONE_TEXT.warning)} title={`Mức khẩn: ${label}`}>
      <Icon className="size-4 shrink-0" />
      <span className="truncate hidden lg:inline">{label}</span>
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
      <span className={cn(note ? "text-foreground font-medium" : "text-muted-foreground")}>{formatLedgerDate(doc.dueDate).slice(0, 5)}</span>
      {note ? <span className="sr-only">{note.text}</span> : null}
    </span>
  );
}

export interface DocumentLedgerTableProps {
  documents: OfficialDocument[];
  selectedIds: Set<string>;
  selectedDocumentId?: string | null;
  numberHeader: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpen: (doc: OfficialDocument) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

export function DocumentLedgerTable({
  documents,
  selectedIds,
  selectedDocumentId,
  isLoading,
  error,
  onRetry,
  onOpen,
  onToggleSelect,
  onSelectAll,
}: DocumentLedgerTableProps) {
  const today = React.useMemo(() => todayInVietnam(), []);
  const allSelected = documents.length > 0 && selectedIds.size === documents.length;

  const header = (
    <div role="row" className={cn(GRID, "h-9 text-xs font-medium text-muted-foreground select-none")}>
      <span role="columnheader">
        <RowSelector checked={allSelected} label="Chọn tất cả văn bản" onToggle={onSelectAll} always />
      </span>
      <span role="columnheader">Văn bản</span>
      <span role="columnheader">Mức khẩn</span>
      <span role="columnheader" className="hidden xl:block">Cơ quan ban hành</span>
      <span role="columnheader" className="hidden xl:block">Chủ trì</span>
      <span role="columnheader">Hạn xử lý</span>
      <span role="columnheader">Trạng thái</span>
    </div>
  );

  if (isLoading) {
    return (
      <div role="table" aria-busy="true" aria-label="Sổ văn bản" data-slot="document-ledger-table">
        {header}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 flex items-center px-3 animate-pulse">
            <div className="h-3 w-full rounded bg-muted/70" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="py-16 text-center space-y-2" data-slot="document-ledger-table">
        <p className="text-compact font-medium text-foreground">Không thể tải danh sách văn bản</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="h-7 px-2.5 rounded-md bg-muted text-compact hover:bg-muted/70 cursor-pointer">
            Thử lại
          </button>
        ) : null}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-16 text-center space-y-1" data-slot="document-ledger-table">
        <p className="text-compact font-medium text-foreground">Chưa có văn bản nào</p>
        <p className="text-xs text-muted-foreground">Thử bỏ bớt bộ lọc hoặc vào sổ văn bản mới.</p>
      </div>
    );
  }

  return (
    <div role="table" aria-label="Sổ văn bản" data-slot="document-ledger-table">
      {header}
      {documents.map((doc) => {
        const step = getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type);
        const selected = selectedIds.has(doc.id);
        const isOpen = selectedDocumentId === doc.id;
        const no = numberLabel(doc);
        const sub = [doc.documentNumber, formatLedgerDate(doc.issuedDate)].filter(Boolean).join(" · ");
        const unit = doc.leadDepartment && doc.leadDepartment !== "Chưa phân công" ? doc.leadDepartment : "";
        return (
          <div
            key={doc.id}
            role="row"
            tabIndex={0}
            aria-selected={selected || isOpen}
            onClick={() => onOpen(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target === e.currentTarget) onOpen(doc);
            }}
            className={cn(
              GRID,
              "group min-h-11 py-1.5 cursor-pointer select-none text-foreground transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              selected ? "bg-selected/80 hover:bg-selected" : isOpen ? "bg-primary/[0.08]" : "hover:bg-muted/40"
            )}
          >
            <span role="cell">
              <RowSelector checked={selected} label={`Chọn văn bản ${doc.documentNumber}`} onToggle={() => onToggleSelect(doc.id)} always={selectedIds.size > 0} />
            </span>
            <span role="cell" className="flex flex-col min-w-0 gap-0.5">
              <span className="flex items-center gap-2 min-w-0">
                {no ? <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">{no}</span> : null}
                <span className="truncate text-compact font-medium text-foreground group-hover:text-primary transition-colors" title={doc.summary}>
                  {doc.summary}
                </span>
              </span>
              <span className="truncate text-xs text-muted-foreground/80 font-mono" title={sub}>{sub}</span>
            </span>
            <span role="cell"><UrgencyCell doc={doc} /></span>
            <span role="cell" className="hidden xl:block text-xs leading-snug text-muted-foreground line-clamp-2 break-words" title={doc.issuingAuthority}>
              {doc.issuingAuthority || "-"}
            </span>
            <span role="cell" className="hidden xl:block text-xs leading-snug text-muted-foreground line-clamp-2 break-words" title={unit}>
              {unit || "-"}
            </span>
            <span role="cell"><DueCell doc={doc} today={today} /></span>
            <span role="cell" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <TaskStatusCircle status={STEP_STATUS[step.kind]} />
              <span className="truncate">{step.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
