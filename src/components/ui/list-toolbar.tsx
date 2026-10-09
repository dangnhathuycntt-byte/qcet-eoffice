"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronRight, Filter, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { propertyMotionStyle, propertyPopupClassName } from "@/components/ui/property-control-styles";

/** Nút icon trên thanh công cụ danh sách (bộ lọc, hiển thị) */
export function listToolbarIconButtonClass(active = false) {
  return cn(
    "inline-flex h-7 shrink-0 cursor-pointer select-none items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-medium transition-colors touch-manipulation",
    active ? "border-border bg-accent/60 text-foreground hover:bg-accent" : "border-border/80 bg-background text-foreground hover:bg-accent"
  );
}

/** Nút chính trên thanh công cụ (Tạo việc, Soạn văn bản) */
export const listToolbarPrimaryButtonClass =
  "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-border/80 bg-background hover:bg-accent text-foreground px-2.5 text-xs font-medium transition-colors shadow-2xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0 touch-manipulation";

export interface ListToolbarSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  wrapperClassName?: string;
  /** Chiều rộng khi chưa focus và khi focus; ô tự mở rộng bằng transition */
  collapsedWidthClassName?: string;
  expandedWidthClassName?: string;
}

/** Ô tìm kiếm của thanh công cụ danh sách: gợi ý phím "/" khi trống, nút xoá khi có từ khóa */
export const ListToolbarSearch = React.forwardRef<HTMLInputElement, ListToolbarSearchProps>(function ListToolbarSearch(
  {
    value,
    onChange,
    onClear,
    loading,
    wrapperClassName,
    collapsedWidthClassName,
    expandedWidthClassName,
    className,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref
) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div
      className={cn(
        "relative shrink-0 transition-[width] duration-200 ease-out",
        wrapperClassName,
        focused ? expandedWidthClassName : collapsedWidthClassName
      )}
    >
      <Search className="size-3.5 text-muted-foreground/80 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(
          "h-7 w-full rounded-md border border-border/60 bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 shadow-2xs hover:border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors",
          className
        )}
        {...inputProps}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Đang tải dữ liệu" />}
        {value ? (
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(""))}
            aria-label="Xóa từ khóa tìm kiếm"
            className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer touch-manipulation"
          >
            <X className="size-3" strokeWidth={1.5} />
          </button>
        ) : (
          <kbd className="hidden h-4 min-w-4 items-center justify-center rounded border border-border/60 bg-muted/60 px-1 font-mono text-[10px] leading-none text-muted-foreground select-none pointer-events-none sm:inline-flex">
            /
          </kbd>
        )}
      </div>
    </div>
  );
});

/** Khung popover của thanh công cụ: nút trigger dùng chung và panel theo style property */
export function ListToolbarPopover({
  open,
  onOpenChange,
  trigger,
  children,
  width = "w-56",
  ariaLabel,
  title,
  flush = false,
  scrollable = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  ariaLabel?: string;
  title?: string;
  /** Panel tự quản padding và bo góc (ví dụ bảng cài đặt nhiều phần) */
  flush?: boolean;
  /** Giới hạn chiều cao và cuộn khi nội dung dài */
  scrollable?: boolean;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger type="button" aria-label={ariaLabel} title={title} className={cn(listToolbarIconButtonClass(open), "relative")}>
        {trigger}
      </Popover.Trigger>
      {open ? (
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-50">
            <Popover.Popup
              className={cn(
                propertyPopupClassName,
                width,
                "max-w-[calc(100vw-1rem)]",
                scrollable && "max-h-[min(360px,var(--available-height))] overflow-y-auto",
                flush && "p-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl"
              )}
              style={propertyMotionStyle}
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      ) : null}
    </Popover.Root>
  );
}

export interface ListFilterOption {
  value: string;
  label: string;
}

export interface ListFilterCategory {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  options: ListFilterOption[];
  /** Giá trị đang chọn; "ALL" là chưa lọc */
  value: string;
  valueLabel?: string;
  onSelect: (value: string) => void;
}

export interface ListToolbarFilterPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ListFilterCategory[];
  /** Số bộ lọc đang áp dụng, hiện trên nút và quyết định có hiện "Xóa bộ lọc" */
  activeCount: number;
  onClear: () => void;
  ariaLabel?: string;
}

/** Popover bộ lọc dùng chung: tìm loại bộ lọc, danh mục có submenu chọn một giá trị, xóa bộ lọc */
export function ListToolbarFilterPopover({
  open,
  onOpenChange,
  categories,
  activeCount,
  onClear,
  ariaLabel = "Bộ lọc",
}: ListToolbarFilterPopoverProps) {
  const [query, setQuery] = React.useState("");
  const [openCategory, setOpenCategory] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const categoryRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const close = () => {
    setOpenCategory(null);
    setQuery("");
    onOpenChange(false);
  };

  const q = query.trim().toLowerCase();
  const shown = categories.filter(
    (c) => !q || c.label.toLowerCase().includes(q) || c.options.some((o) => o.label.toLowerCase().includes(q))
  );

  return (
    <ListToolbarPopover
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      ariaLabel={ariaLabel}
      title="Lọc"
      width="w-56"
      trigger={
        <>
          <Filter className="size-3.5" strokeWidth={1.5} />
          {activeCount > 0 ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{activeCount}</span> : null}
        </>
      }
    >
      <div className="flex flex-col">
        <div className="mb-1 flex items-center gap-2 border-b border-border/40 px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Thêm bộ lọc…"
            aria-label="Tìm loại bộ lọc"
            autoFocus
            className="h-5 w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <kbd className="hidden items-center rounded border border-border/60 bg-muted/80 px-1.5 font-mono text-[9px] text-muted-foreground select-none pointer-events-none sm:inline-flex">
            F
          </kbd>
        </div>
        <div className="flex flex-col p-1">
          {shown.map((c) => (
            <Menu.Root key={c.id} open={openCategory === c.id} onOpenChange={(o) => setOpenCategory(o ? c.id : null)}>
              <Menu.Trigger
                ref={(el: HTMLButtonElement | null) => {
                  categoryRefs.current[c.id] = el;
                }}
                className="flex h-7.5 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-foreground outline-none hover:bg-accent focus-visible:bg-accent data-[popup-open]:bg-accent"
              >
                <c.Icon className="size-3.5 shrink-0 text-foreground/80" strokeWidth={1.5} />
                <span className="flex-1 truncate">{c.label}</span>
                {c.valueLabel ? <span className="max-w-[96px] truncate font-normal text-foreground/70">{c.valueLabel}</span> : null}
                <ChevronRight className="size-3.5 shrink-0 text-foreground/60" strokeWidth={1.5} />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side={isMobile ? "bottom" : "right"} align="start" sideOffset={4} collisionPadding={8} className="z-[60]">
                  <Menu.Popup
                    className={cn(propertyPopupClassName, "w-56 max-w-[calc(100vw-1rem)] max-h-[min(288px,var(--available-height))] overflow-y-auto")}
                    style={propertyMotionStyle}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenCategory(null);
                        categoryRefs.current[c.id]?.focus();
                      }
                    }}
                  >
                    <Menu.RadioGroup
                      value={c.value}
                      onValueChange={(v) => {
                        c.onSelect(v);
                        close();
                      }}
                    >
                      {c.options.map((opt) => (
                        <Menu.RadioItem
                          key={opt.value}
                          value={opt.value}
                          className="flex h-7.5 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-xs font-medium text-foreground outline-none data-[highlighted]:bg-accent"
                        >
                          <span className="flex-1 truncate">{opt.label}</span>
                          <Menu.RadioItemIndicator className="flex items-center">
                            <Check className="size-3.5 text-foreground" strokeWidth={2} />
                          </Menu.RadioItemIndicator>
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ))}
          {shown.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">Không có loại bộ lọc phù hợp</p> : null}
        </div>
        {activeCount > 0 ? (
          <div className="border-t border-border/60 p-1">
            <button
              type="button"
              onClick={() => {
                onClear();
                close();
              }}
              className="flex h-7 w-full cursor-pointer items-center rounded-md px-2 text-xs font-medium text-foreground/80 hover:bg-accent hover:text-foreground"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : null}
      </div>
    </ListToolbarPopover>
  );
}
