"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp, Download, Ellipsis, ExternalLink, Files, Maximize2, Minimize2, MoveHorizontal, Search, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { PopoverContent, PopoverRoot, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTrackOpenPopover } from "./popover-escape-guard";
import { FileTypeIcon } from "./file-type-icon";
import type { FilePreviewKind } from "@/lib/documents/file-viewer-state";
import { Pressable } from "@/components/ui/pressable";

// Nút thao tác (có trạng thái hover), không phải hộp bọc icon tĩnh
const RAIL_BUTTON = cn(
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md",
  "text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
  "hover:bg-muted/60 data-[popup-open]:bg-muted/60 data-[popup-open]:text-foreground",
  "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
);

/** Nút trong rail: tooltip bên trái, aria-label đầy đủ. */
export function RailButton({
  label,
  className,
  render,
  children,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  render?: React.ReactElement<any>;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {render ? (
          React.cloneElement(render, { "aria-label": label, className: cn(RAIL_BUTTON, className) }, children)
        ) : (
          <Pressable aria-label={label} className={cn(RAIL_BUTTON, className)} {...props}>
            {children}
          </Pressable>
        )}
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// Ô hiển thị chữ + thao tác (số trang, số tệp): cũng là nút, không phải hộp bọc icon
const RAIL_TILE = cn(
  "flex w-9 cursor-pointer flex-col items-center justify-center rounded-md text-muted-foreground",
  "outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
  "hover:bg-muted/60 data-[popup-open]:bg-muted/60",
);

function RailDivider() {
  return <div role="separator" aria-orientation="horizontal" className="my-1 h-px w-5 shrink-0 bg-border/60" />;
}

export interface RailSearch {
  query: string;
  onQueryChange: (query: string) => void;
  /** Tổng số kết quả; vị trí đang chọn tính từ 0. */
  total: number;
  active: number;
  onActiveChange: (index: number) => void;
  /** Đã đọc hết lớp chữ và tệp không có chữ nào (thường là bản scan). */
  noText?: boolean;
}

function SearchButton({ search }: { search: RailSearch }) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  const { query, total, active, onActiveChange } = search;
  const searching = query.trim().length >= 2;
  const step = (delta: number) => total > 0 && onActiveChange((active + delta + total) % total);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger className={RAIL_BUTTON} aria-label="Tìm trong tệp" data-popup-open={open || undefined}>
            <Search strokeWidth={1.5} />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6} hidden={open}>
          Tìm trong tệp
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="left" align="start" sideOffset={8} positionerClassName="z-[60]" className="z-[60] w-64 p-1.5">
        <PopoverTitle className="sr-only">Tìm trong tệp</PopoverTitle>
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => search.onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              }
            }}
            placeholder="Tìm trong tệp"
            aria-label="Từ khóa cần tìm"
            className="h-7 min-w-0 flex-1 rounded-md bg-muted/50 px-2 text-compact text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="w-10 shrink-0 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {searching ? (total > 0 ? `${active + 1}/${total}` : "0") : ""}
          </span>
          <Pressable aria-label="Kết quả trước" disabled={total === 0} onClick={() => step(-1)} className={cn(RAIL_BUTTON, "size-7")}>
            <ChevronUp strokeWidth={1.5} />
          </Pressable>
          <Pressable aria-label="Kết quả sau" disabled={total === 0} onClick={() => step(1)} className={cn(RAIL_BUTTON, "size-7")}>
            <ChevronDown strokeWidth={1.5} />
          </Pressable>
        </div>
        {searching && total === 0 ? (
          <p className="px-1 pt-1.5 text-xs text-muted-foreground">
            {search.noText ? "Tệp này không có nội dung văn bản để tìm kiếm." : "Không thấy kết quả trong lớp chữ của tệp."}
          </p>
        ) : null}
      </PopoverContent>
    </PopoverRoot>
  );
}

export interface RailPages {
  /** Trang đang đọc (1-based); 0 khi chưa biết. */
  current: number;
  total: number;
  onGoto: (page: number) => void;
}

/** "3/12": một dòng khi đủ chỗ trong ô 36px; số dài (≥ 100 trang) mới xếp hai dòng. */
function pageLabelFits(current: number, total: number): boolean {
  return `${current || "–"}/${total}`.length <= 5;
}

function PageJumpForm({ pages, onDone }: { pages: RailPages; onDone: () => void }) {
  const { current, total, onGoto } = pages;
  const [draft, setDraft] = React.useState(String(current || 1));
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Number.parseInt(draft, 10);
        if (Number.isFinite(value)) onGoto(Math.min(total, Math.max(1, value)));
        onDone();
      }}
    >
      <input
        autoFocus
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        aria-label="Số trang"
        className="h-7 min-w-0 flex-1 rounded-md bg-muted/50 px-2 text-compact tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">/ {total}</span>
      <button type="submit" className="h-7 shrink-0 cursor-pointer rounded-md px-2 text-xs text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
        Đi
      </button>
    </form>
  );
}

function PageGroup({ pages }: { pages: RailPages }) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  const { current, total, onGoto } = pages;
  const go = (page: number) => onGoto(Math.min(total, Math.max(1, page)));
  const oneLine = pageLabelFits(current, total);
  return (
    <div role="group" aria-label="Điều hướng trang" className="hidden flex-col items-center gap-0.5 @lg/doc:flex">
      <RailButton label="Trang trước" disabled={current <= 1} onClick={() => go(current - 1)}>
        <ChevronUp strokeWidth={1.5} />
      </RailButton>
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`Trang ${current} trên ${total}, bấm để nhập số trang`}
          data-popup-open={open || undefined}
          className={cn(RAIL_TILE, "h-8 text-xs leading-none tabular-nums", !oneLine && "h-9 gap-0.5")}
        >
          {oneLine ? (
            <span className="whitespace-nowrap">
              <span className="text-foreground">{current || "–"}</span>/{total}
            </span>
          ) : (
            <>
              <span className="text-foreground">{current || "–"}</span>
              <span>/{total}</span>
            </>
          )}
        </PopoverTrigger>
        <PopoverContent side="left" align="start" sideOffset={8} positionerClassName="z-[60]" className="z-[60] w-44 p-1.5">
          <PopoverTitle className="sr-only">Đi tới trang</PopoverTitle>
          <PageJumpForm pages={pages} onDone={() => setOpen(false)} />
        </PopoverContent>
      </PopoverRoot>
      <RailButton label="Trang sau" disabled={current >= total} onClick={() => go(current + 1)}>
        <ChevronDown strokeWidth={1.5} />
      </RailButton>
    </div>
  );
}

/** Thu phóng là tỷ lệ so với "vừa chiều rộng" (100 = vừa khung), không phải kích thước thực của trang. */
function zoomAriaLabel(zoom: number): string {
  return zoom === 100 ? "Thu phóng 100%, vừa chiều rộng" : `Thu phóng ${zoom}% so với vừa chiều rộng`;
}

function ZoomValue({ zoom }: { zoom: number }) {
  return zoom === 100 ? (
    <span className="flex flex-col items-center leading-none">
      <span>Vừa</span>
      <span>rộng</span>
    </span>
  ) : (
    <span>{zoom}%</span>
  );
}

const MENU_ITEM =
  "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-compact text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Rail thấp: gộp thu phóng thành một nút mở popover. */
function ZoomMenu({ zoom, onZoomChange }: { zoom: number; onZoomChange: (zoom: number) => void }) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger aria-label={zoomAriaLabel(zoom)} data-popup-open={open || undefined} className={cn(RAIL_TILE, "h-8 text-xs tabular-nums")}>
            <ZoomValue zoom={zoom} />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6} hidden={open}>
          Thu phóng
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="left" align="start" sideOffset={8} positionerClassName="z-[60]" className="z-[60] w-56 p-1">
        <PopoverTitle className="px-2 pb-1 pt-1.5 text-xs font-normal text-muted-foreground">Tỷ lệ so với vừa chiều rộng</PopoverTitle>
        <Pressable className={MENU_ITEM} disabled={zoom >= 200} onClick={() => onZoomChange(Math.min(zoom + 15, 200))}>
          <ZoomIn strokeWidth={1.5} />
          Phóng to
        </Pressable>
        <Pressable className={MENU_ITEM} disabled={zoom <= 50} onClick={() => onZoomChange(Math.max(zoom - 15, 50))}>
          <ZoomOut strokeWidth={1.5} />
          Thu nhỏ
        </Pressable>
        <Pressable className={MENU_ITEM} disabled={zoom === 100} onClick={() => onZoomChange(100)}>
          <MoveHorizontal strokeWidth={1.5} />
          Vừa chiều rộng
          {zoom === 100 ? <Check className="ml-auto" strokeWidth={1.5} aria-hidden /> : null}
        </Pressable>
      </PopoverContent>
    </PopoverRoot>
  );
}

/** Rail thấp: điều hướng trang chuyển vào "Công cụ xem". */
function ViewToolsMenu({ pages }: { pages: RailPages }) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  const { current, total, onGoto } = pages;
  const go = (page: number) => onGoto(Math.min(total, Math.max(1, page)));
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger aria-label={`Công cụ xem, trang ${current} trên ${total}`} data-popup-open={open || undefined} className={RAIL_BUTTON}>
            <Ellipsis strokeWidth={1.5} />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6} hidden={open}>
          Công cụ xem
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="left" align="start" sideOffset={8} positionerClassName="z-[60]" className="z-[60] w-56 p-1.5">
        <PopoverTitle className="px-0.5 pb-1.5 text-xs font-normal text-muted-foreground">Trang</PopoverTitle>
        <div className="flex items-center gap-1">
          <Pressable aria-label="Trang trước" disabled={current <= 1} onClick={() => go(current - 1)} className={cn(RAIL_BUTTON, "size-7")}>
            <ChevronUp strokeWidth={1.5} />
          </Pressable>
          <div className="min-w-0 flex-1">
            <PageJumpForm key={current} pages={pages} onDone={() => setOpen(false)} />
          </div>
          <Pressable aria-label="Trang sau" disabled={current >= total} onClick={() => go(current + 1)} className={cn(RAIL_BUTTON, "size-7")}>
            <ChevronDown strokeWidth={1.5} />
          </Pressable>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

function DownloadMenu({ fileUrl, onDownload }: { fileUrl: string; onDownload: () => void }) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  const item =
    "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-compact text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:text-muted-foreground";
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger className={RAIL_BUTTON} aria-label="Tải về" data-popup-open={open || undefined}>
            <Download strokeWidth={1.5} />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6} hidden={open}>
          Tải về
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="left" align="start" sideOffset={8} positionerClassName="z-[60]" className="z-[60] w-56 p-1">
        <PopoverTitle className="sr-only">Tải về hoặc mở tệp</PopoverTitle>
        <Pressable
          className={item}
          onClick={() => {
            onDownload();
            setOpen(false);
          }}
        >
          <Download strokeWidth={1.5} />
          Tải về
        </Pressable>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
          <ExternalLink strokeWidth={1.5} />
          Mở trong tab mới
        </a>
      </PopoverContent>
    </PopoverRoot>
  );
}

export interface RailFile {
  id: string;
  name: string;
  url?: string | null;
  /** Ví dụ "3 trang · 2,4 MB". */
  detail?: string;
  mimeType?: string | null;
}

/** Nút "Tệp N": danh sách đầy đủ tên tệp, số trang và dung lượng; chọn để chuyển tệp ngay. */
export function FilesMenu({
  files,
  activeId,
  onSelect,
  variant = "rail",
}: {
  files: RailFile[];
  activeId: string;
  onSelect: (id: string) => void;
  /** `labelled`: nút có chữ "Tệp N" ở dòng tên tệp; `rail`: ô icon trong rail. */
  variant?: "rail" | "labelled";
}) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLUListElement>(null);
  useTrackOpenPopover(open);

  const moveFocus = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
    rows[next]?.focus();
    event.preventDefault();
  };

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      {variant === "labelled" ? (
        <PopoverTrigger
          aria-label={`Tệp ${files.length}`}
          data-popup-open={open || undefined}
          className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted/60 data-[popup-open]:text-foreground"
        >
          <Files className="size-3.5" strokeWidth={1.5} aria-hidden />
          <span className="tabular-nums">Tệp {files.length}</span>
          <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
        </PopoverTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              aria-label={`Tệp ${files.length}`}
              data-popup-open={open || undefined}
              className={cn(RAIL_TILE, "h-9")}
            >
              <Files className="size-4" strokeWidth={1.5} />
              <span className="text-xs leading-none tabular-nums">{files.length}</span>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={6} hidden={open}>
            Tệp {files.length}
          </TooltipContent>
        </Tooltip>
      )}
      <PopoverContent
        side={variant === "labelled" ? "bottom" : "left"}
        align={variant === "labelled" ? "end" : "center"}
        sideOffset={variant === "labelled" ? 4 : 8}
        positionerClassName="z-[60]"
        className="z-[60] max-h-[60vh] w-64 max-w-[calc(100vw-16px)] overflow-y-auto p-1"
      >
        <PopoverTitle className="sr-only">Chọn tệp đính kèm</PopoverTitle>
        <ul ref={listRef} role="listbox" aria-label="Tệp đính kèm" onKeyDown={moveFocus}>
          {files.map((file) => {
            const isActive = file.id === activeId;
            return (
              <li key={file.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-current={isActive ? "true" : undefined}
                  title={file.name}
                  autoFocus={isActive}
                  onClick={() => {
                    onSelect(file.id);
                    setOpen(false);
                  }}
                  className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FileTypeIcon fileName={file.name} mimeType={file.mimeType} />
                  <span className={cn("min-w-0 flex-1 truncate text-compact text-foreground", isActive && "font-medium")}>{file.name}</span>
                  {file.detail ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{file.detail}</span> : null}
                  {isActive ? <Check className="size-4 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </PopoverRoot>
  );
}

export interface DocumentRailProps {
  fileUrl: string;
  fileName: string;
  /** Loại xem trước: chỉ PDF/ảnh có thu phóng, chỉ PDF có tìm kiếm và điều hướng trang. */
  kind: FilePreviewKind;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  search?: RailSearch;
  pages?: RailPages;
  fullscreen?: boolean;
  onFullscreen?: () => void;
  onDownload: () => void;
  /** Nhóm tệp (xem `DocumentFilesRail`, `FilesMenu`), chỉ có khi văn bản có nhiều tệp. */
  files?: React.ReactNode;
  /** Nhóm bổ sung ở cuối (ví dụ nút mở panel thông tin ở Full Page). */
  extra?: React.ReactNode;
}

/** Vùng cuộn dọc gần nhất chứa rail (bỏ qua khung cuộn ngang của PDF và body/html). */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (node.hasAttribute("data-pdf-no-scroll")) continue;
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/** Khoảng dư trước khi bung lại rail đầy đủ, tránh nhảy qua lại ở ngưỡng. */
const RAIL_EXPAND_SLACK = 16;

/**
 * Rail thu gọn khi chiều cao khả dụng (vùng cuộn trừ phần đang bám phía trên) không đủ cho rail đầy đủ.
 * Chiều cao đầy đủ chỉ đo khi đang ở dạng đầy đủ; thu gọn rồi thì cần dư thêm `RAIL_EXPAND_SLACK` mới bung lại.
 */
function useRailCompact(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [compact, setCompact] = React.useState(false);
  const compactRef = React.useRef(false);
  const fullHeight = React.useRef(0);
  React.useLayoutEffect(() => {
    const rail = ref.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const scroller = findScrollParent(rail);
    const measure = () => {
      if (!compactRef.current) fullHeight.current = rail.offsetHeight;
      const stickyTop = parseFloat(getComputedStyle(rail).top) || 0;
      const available = (scroller ? scroller.clientHeight : window.innerHeight) - stickyTop;
      const next = compactRef.current ? available < fullHeight.current + RAIL_EXPAND_SLACK : available < fullHeight.current;
      if (next !== compactRef.current) {
        compactRef.current = next;
        setCompact(next);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    if (scroller) observer.observe(scroller);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
    };
  }, [ref]);
  return compact;
}

/**
 * Rail công cụ dọc ở mép phải viewer, chia nhóm: Xem (thu phóng) — Trang — Tìm — Khung (toàn màn hình, tải về) — Tệp.
 * Dính đầu vùng cuộn nên luôn nằm trong tầm tay khi cuộn PDF; nằm ngoài vùng giấy nên không che nội dung.
 * Vùng cuộn thấp hơn rail: thu phóng gộp thành một nút, điều hướng trang vào "Công cụ xem", vạch tệp ẩn
 * (chọn tệp bằng "Tệp N" ở dòng tên tệp) để tìm, toàn màn hình và tải về luôn nhìn thấy.
 */
export function DocumentViewerRail({ fileUrl, fileName, kind, zoom, onZoomChange, search, pages, fullscreen, onFullscreen, onDownload, files, extra }: DocumentRailProps) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const compact = useRailCompact(railRef);
  const zoomable = kind !== "other";
  const hasPages = kind === "pdf" && pages && pages.total > 1;
  const roving = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")).filter((el) => el.offsetParent !== null);
    const at = buttons.indexOf(target.closest("button, a") as HTMLElement);
    if (at === -1) return;
    const next = event.key === "ArrowDown" ? Math.min(buttons.length - 1, at + 1) : Math.max(0, at - 1);
    buttons[next]?.focus();
    event.preventDefault();
  };
  // Tệp không xem trước được: thu phóng, trang, tìm, toàn màn hình không áp dụng; tải về và chọn tệp đã có
  // ở thông báo và nút "Tệp N". Chỉ giữ nhóm bổ sung (Full Page: mở panel thông tin).
  if (kind === "other") {
    return extra ? (
      <div
        role="toolbar"
        aria-orientation="vertical"
        aria-label={`Công cụ xem ${fileName}`}
        data-slot="document-viewer-rail"
        className="sticky top-[var(--viewer-sticky-top,0px)] z-10 flex w-11 shrink-0 flex-col items-center gap-0.5 self-start bg-card py-1.5"
      >
        {extra}
      </div>
    ) : null;
  }
  return (
    <div
      ref={railRef}
      role="toolbar"
      aria-orientation="vertical"
      aria-label={`Công cụ xem ${fileName}`}
      onKeyDown={roving}
      data-slot="document-viewer-rail"
      data-compact={compact || undefined}
      className="sticky top-[var(--viewer-sticky-top,0px)] z-10 flex w-11 shrink-0 flex-col items-center gap-0.5 self-start bg-card py-1.5"
    >
      {zoomable && compact ? <ZoomMenu zoom={zoom} onZoomChange={onZoomChange} /> : null}
      {zoomable && !compact ? (
        <>
          <RailButton label="Phóng to" disabled={zoom >= 200} onClick={() => onZoomChange(Math.min(zoom + 15, 200))}>
            <ZoomIn strokeWidth={1.5} />
          </RailButton>
          <span
            className="flex min-h-5 items-center py-0.5 text-center text-xs tabular-nums text-muted-foreground"
            aria-label={zoomAriaLabel(zoom)}
            title="Tỷ lệ so với vừa chiều rộng"
          >
            <ZoomValue zoom={zoom} />
          </span>
          <RailButton label="Thu nhỏ" disabled={zoom <= 50} onClick={() => onZoomChange(Math.max(zoom - 15, 50))}>
            <ZoomOut strokeWidth={1.5} />
          </RailButton>
          <RailButton label="Vừa chiều rộng" disabled={zoom === 100} onClick={() => onZoomChange(100)}>
            <MoveHorizontal strokeWidth={1.5} />
          </RailButton>
        </>
      ) : null}
      {hasPages ? (
        <>
          <RailDivider />
          {compact ? <ViewToolsMenu pages={pages} /> : <PageGroup pages={pages} />}
        </>
      ) : null}
      {kind === "pdf" && search ? (
        <>
          <RailDivider />
          <SearchButton search={search} />
        </>
      ) : null}
      <RailDivider />
      {onFullscreen ? (
        <RailButton label={fullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"} onClick={onFullscreen} aria-pressed={fullscreen}>
          {fullscreen ? <Minimize2 strokeWidth={1.5} /> : <Maximize2 strokeWidth={1.5} />}
        </RailButton>
      ) : null}
      <DownloadMenu fileUrl={fileUrl} onDownload={onDownload} />
      {files && !compact ? (
        <>
          <RailDivider />
          {files}
        </>
      ) : null}
      {extra ? (
        <>
          <RailDivider />
          {extra}
        </>
      ) : null}
    </div>
  );
}

/** Độ dài vạch (px) theo độ dài tên tệp, giới hạn 8–20 như thanh vạch của việc con. */
function tickWidth(name: string): number {
  return Math.min(20, Math.max(8, Math.round(name.trim().length / 4) + 4));
}

/**
 * Nhóm tệp trong rail, cùng kiểu thanh vạch của trang việc con: mỗi vạch là một tệp
 * (tệp đang xem dài và đậm nhất). Rê chuột / focus để xem thẻ tên đầy đủ, dung lượng, số trang;
 * nhấn để chuyển tệp ngay trong khung xem. Phím mũi tên lên/xuống di chuyển giữa các vạch.
 */
export function DocumentFilesRail({
  files,
  activeId,
  onSelect,
}: {
  files: RailFile[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [cardTop, setCardTop] = React.useState(0);

  const focusTick = React.useCallback((id: string) => {
    const li = listRef.current?.querySelector<HTMLElement>(`[data-tick-id="${CSS.escape(id)}"]`);
    if (!li) return;
    setHoverId(id);
    setCardTop(li.offsetTop + li.offsetHeight / 2);
  }, []);

  // Lướt dọc thanh: thẻ bám theo vạch gần con trỏ nhất, không đứt ở khoảng trống giữa các vạch
  const handleMouseMove = (event: React.MouseEvent) => {
    let best: string | undefined;
    let bestDist = Infinity;
    listRef.current?.querySelectorAll<HTMLElement>("[data-tick-id]").forEach((li) => {
      const rect = li.getBoundingClientRect();
      const dist = Math.abs(event.clientY - (rect.top + rect.height / 2));
      if (dist < bestDist) {
        bestDist = dist;
        best = li.dataset.tickId;
      }
    });
    if (best && best !== hoverId) focusTick(best);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const ticks = Array.from(listRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
    const at = ticks.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? Math.min(ticks.length - 1, at + 1) : Math.max(0, at - 1);
    ticks[next]?.focus();
    event.preventDefault();
  };

  const hovered = hoverId ? files.find((file) => file.id === hoverId) ?? null : null;

  return (
    <nav
      aria-label={`Tệp đính kèm (${files.length})`}
      data-slot="document-files-rail"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverId(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoverId(null);
      }}
      onKeyDown={handleKeyDown}
    >
      <ul ref={listRef} className="relative flex flex-col items-center py-1">
        {files.map((file) => {
          const isActive = file.id === activeId;
          const isHover = file.id === hoverId;
          return (
            <li key={file.id} data-tick-id={file.id}>
              <button
                type="button"
                onClick={() => onSelect(file.id)}
                onFocus={() => focusTick(file.id)}
                aria-label={`Xem tệp ${file.name}`}
                aria-current={isActive ? "true" : undefined}
                className="flex h-4 w-8 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  style={{ width: isActive || isHover ? 24 : tickWidth(file.name) }}
                  className={cn(
                    "block h-0.5 rounded-full transition-[width,background-color] duration-100 motion-reduce:transition-none",
                    isActive ? "bg-foreground" : isHover ? "bg-foreground/70" : "bg-muted-foreground/35",
                  )}
                />
              </button>
            </li>
          );
        })}

        {/* Một thẻ xem nhanh duy nhất, trượt theo vạch; mở về phía trái để không ra khỏi drawer */}
        {hovered ? (
          <div
            role="tooltip"
            style={{ top: cardTop }}
            className="pointer-events-none absolute right-full z-30 -translate-y-1/2 pr-1 transition-[top] duration-100 ease-out motion-reduce:transition-none"
          >
            <div className="w-64 rounded-xl border border-border bg-popover p-3 shadow-xl">
              <p className="line-clamp-2 break-words text-xs font-medium text-foreground">{hovered.name}</p>
              {hovered.detail ? <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">{hovered.detail}</p> : null}
            </div>
          </div>
        ) : null}
      </ul>
    </nav>
  );
}
