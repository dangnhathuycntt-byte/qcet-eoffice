"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Loader2, RotateCcw, X } from "lucide-react";
import { TaskIconFilter, TaskIconSearch } from "@/lib/icons/task-icons";
import { cn } from "@/lib/utils";
import { propertyMotionStyle, propertyPopupClassName } from "@/components/ui/property-control-styles";
import { Pressable } from "@/components/ui/pressable";
import { useIsPhone } from "@/hooks/use-is-phone";
import {
  MENU_POPUP_CLASS,
  MenuBackdrop,
  MenuSheetHeader,
  SHEET_BACKDROP_CLASS,
  SHEET_POPUP_CLASS,
  SHEET_POSITIONER_CLASS,
  MenuOptionItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRoot,
  MenuSubmenu,
  MenuTrigger,
} from "@/components/ui/menu";

/** Nút icon trên thanh công cụ danh sách (bộ lọc, hiển thị) */
export function listToolbarIconButtonClass(active = false) {
  return cn(
    "inline-flex size-7 max-md:size-11 shrink-0 cursor-pointer select-none items-center justify-center rounded-full border px-0 text-xs font-medium transition-colors touch-manipulation",
    active ? "border-border bg-accent/60 text-foreground hover:bg-accent" : "border-border/80 bg-background text-foreground hover:bg-accent"
  );
}

/** Ô tìm của trang danh sách: 140/180px, focus giãn 240px (chuẩn thanh Nhiệm vụ). */
export const LIST_TOOLBAR_SEARCH_COLLAPSED = "w-[140px] sm:w-[180px]";
export const LIST_TOOLBAR_SEARCH_EXPANDED = "w-[200px] sm:w-[240px]";

/** Nút chính trên thanh công cụ (Tạo việc, Soạn văn bản) */
export const listToolbarPrimaryButtonClass =
  "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-border/80 bg-background hover:bg-accent text-foreground px-2.5 text-xs font-medium transition-colors shadow-2xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0 touch-manipulation";

export interface ListToolbarSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  wrapperClassName?: string;
  /** Chiều rộng khi chưa focus và khi focus (mặc định chuẩn trang danh sách); ô tự mở rộng bằng transition */
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
    collapsedWidthClassName = LIST_TOOLBAR_SEARCH_COLLAPSED,
    expandedWidthClassName = LIST_TOOLBAR_SEARCH_EXPANDED,
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
      <TaskIconSearch size={14} className="text-muted-foreground/80 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
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
          "h-8 sm:h-7 w-full rounded-md border border-border/60 bg-background pl-8 pr-8 text-base sm:text-xs text-ellipsis text-foreground placeholder:text-muted-foreground/70 shadow-2xs hover:border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors",
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
            <X className="size-3" />
          </button>
        ) : (
          <kbd className="hidden h-4 min-w-4 items-center justify-center rounded border border-border/60 bg-muted/60 px-1 font-mono text-xs leading-none text-muted-foreground select-none pointer-events-none sm:inline-flex">
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
  sheetTitle,
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
  /** Tiêu đề bottom sheet trên điện thoại (mặc định dùng ariaLabel) */
  sheetTitle?: string;
}) {
  const isMobile = useIsPhone();

  // Chuột phải ở nơi khác (menu thao tác của hàng) không kích hoạt "bấm ra ngoài" của Popover: tự đóng để không chồng hai lớp
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-list-toolbar-popover]")) return;
      onOpenChange(false);
    };
    document.addEventListener("contextmenu", close, true);
    return () => document.removeEventListener("contextmenu", close, true);
  }, [open, onOpenChange]);

  return (
    // Điện thoại: popover là bottom sheet nên chạy modal (khóa cuộn trang phía sau như sheet của Menu); desktop giữ non-modal.
    <Popover.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={isMobile}
    >
      <Popover.Trigger type="button" aria-label={ariaLabel} title={title} className={cn(listToolbarIconButtonClass(open), "relative")}>
        {trigger}
      </Popover.Trigger>
      {open ? (
        <Popover.Portal>
          <Popover.Backdrop className={SHEET_BACKDROP_CLASS} />
          <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className={cn("z-50", SHEET_POSITIONER_CLASS)}>
            <Popover.Popup
              data-list-toolbar-popover=""
              className={cn(
                propertyPopupClassName,
                width,
                "max-w-[calc(100vw-1rem)]",
                scrollable && "max-h-[min(360px,var(--available-height))] overflow-y-auto",
                flush && "p-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl",
                SHEET_POPUP_CLASS,
                "max-md:border-0 max-md:bg-popover"
              )}
              style={propertyMotionStyle}
            >
              <MenuSheetHeader title={sheetTitle ?? ariaLabel} />
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
  /** Số bộ lọc đang áp dụng: hiện chấm trên nút và quyết định có hiện "Xóa bộ lọc" */
  activeCount: number;
  onClear: () => void;
  ariaLabel?: string;
}

/** Nút mở bộ lọc: chấm báo đang lọc thay cho số, nên nút giữ bề rộng và các nút bên cạnh không bị đẩy. */
export const ListToolbarFilterButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { activeCount: number; open: boolean }
>(function ListToolbarFilterButton({ activeCount, open, className, ...props }, ref) {
  const label = activeCount > 0 ? `Bộ lọc (${activeCount} đang áp dụng)` : "Bộ lọc";
  return (
    <Pressable
      ref={ref}
      aria-label={label}
      title={activeCount > 0 ? `Bộ lọc (F) · ${activeCount} đang áp dụng` : "Bộ lọc (F)"}
      className={cn(listToolbarIconButtonClass(open || activeCount > 0), "relative", className)}
      {...props}
    >
      <TaskIconFilter size={14} className="shrink-0 text-muted-foreground" />
      {activeCount > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />}
    </Pressable>
  );
});

/**
 * Bộ lọc dùng chung của trang danh sách, cùng menu với trang Nhiệm vụ:
 * mỗi nhóm mở menu con thả sang trái, mục đang chọn nền accent đậm (không tick, không mũi tên),
 * chọn xong menu vẫn mở để đổi tiếp.
 */
export function ListToolbarFilterPopover({
  open,
  onOpenChange,
  categories,
  activeCount,
  onClear,
  ariaLabel = "Bộ lọc",
}: ListToolbarFilterPopoverProps) {
  return (
    <MenuRoot open={open} onOpenChange={onOpenChange}>
      <MenuTrigger render={<ListToolbarFilterButton activeCount={activeCount} open={open} aria-label={ariaLabel} />} />
      <MenuPortal>
        <MenuBackdrop className={SHEET_BACKDROP_CLASS} />
        <MenuPositioner side="bottom" align="end" sideOffset={6} collisionPadding={12} className={cn("z-50 outline-none", SHEET_POSITIONER_CLASS)}>
          <MenuPopup className={cn(MENU_POPUP_CLASS, "w-52", SHEET_POPUP_CLASS)}>
            <MenuSheetHeader title={ariaLabel} />
            <div className="space-y-px">
              {categories.map((c) => (
                <MenuSubmenu
                  key={c.id}
                  icon={<c.Icon className="size-4 text-muted-foreground" />}
                  label={c.label}
                  active={c.valueLabel !== undefined}
                  hint={c.valueLabel}
                  title={c.label}
                >
                  <div className="space-y-px">
                    {c.options.map((opt) => (
                      <MenuOptionItem key={opt.value} selected={c.value === opt.value} onClick={() => c.onSelect(opt.value)}>
                        {opt.label}
                      </MenuOptionItem>
                    ))}
                  </div>
                </MenuSubmenu>
              ))}
              {activeCount > 0 ? (
                <MenuOptionItem
                  closeOnClick
                  leading={<RotateCcw className="size-4 text-muted-foreground" />}
                  hint={activeCount}
                  onClick={onClear}
                >
                  Xóa bộ lọc
                </MenuOptionItem>
              ) : null}
            </div>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  );
}
