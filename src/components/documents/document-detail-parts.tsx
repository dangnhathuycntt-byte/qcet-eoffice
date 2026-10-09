"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronRight, Download, FileText } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { cn } from "@/lib/utils";
import { PopoverContent, PopoverRoot, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { getStatusDisplay } from "@/domain/tasks/display-config";
import { getDueIndicator, getSlaBadgeStatus } from "@/components/tasks/table/utils/table-date-helpers";
import { formatCompactDate, formatDisplayDate } from "@/lib/format/date";
import { toServedFileUrl } from "@/lib/url-utils";
import { useTrackOpenPopover } from "./popover-escape-guard";

/** Tiêu đề chính là trích yếu; số, ký hiệu và nguồn là dòng phụ. */
export function DocumentTitleBlock({
  eyebrow,
  title,
  meta,
  titleAs: Title = "h1",
}: {
  eyebrow?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  /** Thẻ tiêu đề, ví dụ `DrawerTitle` để drawer có tên truy cập đúng. */
  titleAs?: React.ElementType;
}) {
  return (
    <header className="space-y-1.5">
      {eyebrow ? <div className="text-xs text-muted-foreground">{eyebrow}</div> : null}
      <Title className="break-words font-sans text-xl font-semibold leading-snug tracking-tight text-foreground">{title}</Title>
      {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
    </header>
  );
}

/** Ghép các mẩu metadata bằng dấu "·", bỏ mẩu rỗng. */
export function MetaInline({ items, className }: { items: React.ReactNode[]; className?: string }) {
  const parts = items.filter((it) => it !== null && it !== undefined && it !== false && it !== "");
  if (parts.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <span aria-hidden className="text-muted-foreground/50">·</span> : null}
          <span className="min-w-0 break-words">{part}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

/** Thẻ trong cột thuộc tính, giống thẻ "Thuộc tính"/"Việc con" của nhiệm vụ. */
export function InspectorCard({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-3 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {title}
          {typeof count === "number" ? <span className="font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Dòng thuộc tính: nhãn 96px, giá trị canh trái ngay cạnh nhãn. */
export function InspectorRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid min-h-7 grid-cols-[96px_minmax(0,1fr)] items-start gap-2 py-0.5">
      <span className="flex h-6 items-center whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex min-h-6 min-w-0 select-text items-center break-words text-compact text-foreground",
          mono && "font-mono text-xs tabular-nums",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** Tiêu đề phân mục trong vùng chính: nhỏ, nhạt, không icon. */
export function SectionHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {children}
      {typeof count === "number" ? <span className="tabular-nums text-muted-foreground/70">{count}</span> : null}
    </h2>
  );
}

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Dòng tệp đính kèm tối giản: tên + dung lượng; nút tải chỉ hiện khi hover/focus.
 * `onSelect` dùng khi dòng chọn tệp để xem trước; `selected` tô nền nhẹ.
 */
export function AttachmentRow({
  fileName,
  fileUrl,
  fileSize,
  sizeLabel,
  selected,
  onSelect,
  trailing,
  meta,
}: {
  fileName: string;
  fileUrl?: string | null;
  fileSize?: number | null;
  /** Dung lượng đã định dạng sẵn từ API, dùng khi không có số byte. */
  sizeLabel?: string | null;
  selected?: boolean;
  onSelect?: () => void;
  trailing?: React.ReactNode;
  /** Thông tin phụ nằm giữa tên và dung lượng (ví dụ số trang). */
  meta?: React.ReactNode;
}) {
  const size = formatFileSize(fileSize) ?? sizeLabel ?? null;
  const href = toServedFileUrl(fileUrl);
  const label = (
    <>
      <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <span className={cn("min-w-0 flex-1 truncate text-compact text-foreground", selected && "font-medium")}>{fileName}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
      {size ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{size}</span> : null}
    </>
  );
  return (
    <div
      className={cn(
        "group/att -mx-2 flex min-h-8 items-center gap-1 rounded-md pr-1 transition-colors hover:bg-muted/50",
        selected && "bg-muted/60",
      )}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          title={fileName}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1" title={fileName}>
          {label}
        </span>
      )}
      {trailing}
      {href ? (
        <a
          href={href}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Tải về ${fileName}`}
          title="Tải về"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/att:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Download className="size-3.5" strokeWidth={1.5} />
        </a>
      ) : null}
    </div>
  );
}

export const DocumentPdfViewer = dynamic(() => import("./document-pdf-viewer").then((mod) => mod.DocumentPdfViewer), {
  ssr: false,
  loading: () => <p role="status" className="py-10 text-center text-xs text-muted-foreground">Đang tải trình xem tệp…</p>,
});

export interface LinkedTaskSummary {
  id: string;
  title?: string | null;
  code?: string | null;
  status?: string | null;
  dueDate?: string | null;
  progressPercent?: number | null;
}

/** Nhiệm vụ liên kết dạng hàng gọn, cùng kiểu với hàng "Việc con" của nhiệm vụ. */
export function LinkedTaskRow({ task }: { task: LinkedTaskSummary }) {
  const isCompleted = task.status === "COMPLETED";
  const dueLabel = task.dueDate ? formatCompactDate(task.dueDate, "") : "";
  const sla = getSlaBadgeStatus(task.dueDate ?? undefined, task.status ?? undefined);
  const due = getDueIndicator({
    status: task.status ?? undefined,
    isOverdue: sla.isOverdue,
    isToday: sla.isToday,
    daysRemaining: sla.daysRemaining,
    label: sla.label,
  });
  const title = task.title || task.code || "Nhiệm vụ giao từ văn bản";

  return (
    <Link
      href={`/tasks/${task.id}`}
      title={title}
      className="group/task -mx-1.5 flex min-h-8 items-center gap-2.5 rounded-lg px-2 py-1 text-compact leading-snug outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="shrink-0" role="img" aria-label={`Trạng thái: ${getStatusDisplay(task.status ?? "NOT_STARTED").label}`}>
        <TaskStatusCircle status={task.status ?? undefined} />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 break-words line-clamp-2",
          isCompleted ? "text-muted-foreground line-through decoration-muted-foreground/30" : "text-foreground/90 group-hover/task:text-foreground",
        )}
      >
        {title}
      </span>
      {typeof task.progressPercent === "number" && !isCompleted ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{task.progressPercent}%</span>
      ) : null}
      {dueLabel ? (
        <span
          className={cn("shrink-0 text-xs tabular-nums", due.tone === "danger" ? "text-destructive" : "text-muted-foreground")}
          title={`Hạn hoàn thành: ${formatDisplayDate(task.dueDate)}`}
        >
          {dueLabel}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Phân mục thu gọn mặc định (luân chuyển, lịch sử). Nội dung chỉ dựng khi mở,
 * nên phần cần tải dữ liệu cũng chỉ gọi API khi người dùng cần xem.
 */
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="group/sec">
      <Collapsible.Trigger className="-mx-2 flex h-8 w-[calc(100%+1rem)] cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform duration-150 group-data-[open]/sec:rotate-90 motion-reduce:transition-none"
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="text-foreground/90">{title}</span>
        {summary ? <span className="min-w-0 truncate font-normal">{summary}</span> : null}
      </Collapsible.Trigger>
      <Collapsible.Panel className="pt-2">{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
}

export interface DetailRow {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

export { hasOpenDetailsPopover } from "./popover-escape-guard";

/** Nút "Chi tiết": các thuộc tính phụ trong popover, không chiếm chỗ cố định. */
export function DetailsPopover({ rows, title = "Chi tiết văn bản" }: { rows: DetailRow[]; title?: string }) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  const visible = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "" && row.value !== false);
  if (visible.length === 0) return null;
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="-mx-1 inline-flex h-6 cursor-pointer items-center gap-0.5 rounded-md px-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted data-[popup-open]:text-foreground">
        Chi tiết
        <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} positionerClassName="z-[60]" className="z-[60] w-64 p-3">
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <dl className="text-xs">
          {visible.map((row) => (
            <div key={row.label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 py-1">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={cn("min-w-0 select-text break-words text-compact text-foreground", row.mono && "font-mono text-xs tabular-nums")}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </PopoverRoot>
  );
}

/** Nhiệm vụ liên kết dạng hàng gọn; chưa có thì giữ lối tạo nhiệm vụ như trước. */
export function LinkedTaskSection({
  task,
  createHref,
  hideWhenEmpty,
}: {
  task?: LinkedTaskSummary | null;
  createHref?: string;
  hideWhenEmpty?: boolean;
}) {
  if (!task && hideWhenEmpty) return null;
  return (
    <section aria-label="Nhiệm vụ liên kết">
      <SectionHeading>Nhiệm vụ liên kết</SectionHeading>
      {task ? (
        <LinkedTaskRow task={task} />
      ) : (
        <p className="flex min-h-8 items-center gap-1.5 text-compact text-muted-foreground">
          Chưa gán nhiệm vụ trong Kho việc.
          {createHref ? (
            <Link href={createHref} className="rounded-sm text-foreground underline decoration-border underline-offset-3 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Tạo nhiệm vụ
            </Link>
          ) : null}
        </p>
      )}
    </section>
  );
}
