"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Loader2, RotateCcw, X } from "lucide-react";
import { TaskIconFilter, TaskIconSearch } from "@qcet/shared/lib/icons/task-icons";
import { cn } from "@/lib/utils";
import { propertyMotionStyle, propertyPopupClassName } from "@/components/ui/property-control-styles";
import { Pressable } from "@/components/ui/pressable";
import { fieldFocusRingClass, focusRingClass } from "@/components/ui/focus-ring";
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

/** Nút icon trên thanh công cụ danh sách (tìm, bộ lọc, hiển thị); icon 16px như icon sidebar, nơi gọi truyền cỡ nào cũng vậy */
export function listToolbarIconButtonClass(active = false) {
  return cn(
    "inline-flex size-7 max-md:size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-full border px-0 text-xs font-medium transition-colors touch-manipulation [&_svg]:size-4",
    active ? "border-border bg-accent/60 text-foreground hover:bg-accent" : "border-border/80 bg-background text-foreground hover:bg-accent"
  );
}

/** Ô tìm của trang danh sách: 140/180px, focus giãn 240px (chuẩn thanh Nhiệm vụ). */
export const LIST_TOOLBAR_SEARCH_COLLAPSED = "w-[140px] sm:w-[180px]";
export const LIST_TOOLBAR_SEARCH_EXPANDED = "w-[200px] sm:w-[240px]";

/** Nút chính trên thanh công cụ (Tạo việc, Soạn văn bản) */
export const listToolbarPrimaryButtonClass =
  `inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-border/80 bg-background hover:bg-accent text-foreground px-2.5 text-xs font-medium transition-colors shadow-2xs outline-none ${focusRingClass} disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0 touch-manipulation`;

export interface ListToolbarSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  wrapperClassName?: string;
  /** Chiều rộng khi chưa focus và khi focus (mặc định chuẩn trang danh sách); ô tự mở rộng bằng transition */
  collapsedWidthClassName?: string;
  expandedWidthClassName?: string;
  /**
   * Phím tắt mở ô ("/"), chỉ truyền khi trang thật sự nghe phím đó; hiện khi ô trống và chưa focus. Trước đây ô nào cũng
   * hiện "/" kể cả trang không gắn phím (Ủy quyền, Danh bạ tài khoản, Cơ cấu đơn vị).
   */
  shortcutHint?: string;
  /** Phím khi đang gõ mà ô trống ("Esc" ở ô thu gọn được), thay cho phím tắt mở ô: đã ở trong ô thì "/" vô nghĩa. */
  focusHint?: string;
}

const searchKbdClass =
  "hidden h-4 min-w-4 items-center justify-center rounded border-hairline border-border px-1 font-sans text-micro leading-none text-muted-foreground select-none pointer-events-none sm:inline-flex";

/**
 * Ô tìm kiếm của thanh công cụ danh sách (người dùng 21/10/2026 "research cải thiện ui ux component này"; theo Search Input
 * của Paragon UI: gợi ý phím mờ đi khi focus và đổi thành Esc, nút xóa thay chỗ khi có chữ): bo tròn như các nút tròn
 * bên cạnh, gợi ý phím đúng trạng thái, nút xóa khi có từ khóa (vùng chạm 44px trên điện thoại).
 */
export const ListToolbarSearch = React.forwardRef<HTMLInputElement, ListToolbarSearchProps>(function ListToolbarSearch(
  {
    value,
    onChange,
    onClear,
    loading,
    wrapperClassName,
    collapsedWidthClassName = LIST_TOOLBAR_SEARCH_COLLAPSED,
    expandedWidthClassName = LIST_TOOLBAR_SEARCH_EXPANDED,
    shortcutHint,
    focusHint,
    className,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref
) {
  const [focused, setFocused] = React.useState(false);
  const hint = value ? null : focused ? focusHint : shortcutHint;
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
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
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
          `h-8 sm:h-7 w-full rounded-full border border-border/60 bg-background pl-8 pr-8 text-base sm:text-xs text-ellipsis text-foreground placeholder:text-faint shadow-2xs hover:border-border outline-none ${fieldFocusRingClass} focus-visible:-outline-offset-1 transition-colors`,
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
            className="touch-target-expand-44 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground p-0.5 rounded-full cursor-pointer touch-manipulation"
          >
            <X className="size-3" />
          </button>
        ) : hint ? (
          <kbd aria-hidden className={searchKbdClass}>
            {hint}
          </kbd>
        ) : null}
      </div>
    </div>
  );
});

export interface ListToolbarSearchToggleProps extends ListToolbarSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tên nút icon và ô tìm ("Tìm nhiệm vụ"). */
  label: string;
  /** Nghe phím "/" ở cả trang để mở ô (bỏ qua khi đang gõ trong ô nhập). Trang tự xử lý phím tắt thì để tắt. */
  slashShortcut?: boolean;
}

/**
 * Tìm thu gọn của trang danh sách (chuẩn trang Nhiệm vụ): nút icon tròn, bấm (hoặc "/") thì thành `ListToolbarSearch` và đưa
 * con trỏ vào; rời ô khi ô trống thì thu lại. Còn từ khóa thì ô luôn mở để người dùng thấy đang tìm gì.
 */
export const ListToolbarSearchToggle = React.forwardRef<HTMLInputElement, ListToolbarSearchToggleProps>(function ListToolbarSearchToggle(
  { open, onOpenChange, label, slashShortcut = false, value, onChange, onClear, onBlur, onKeyDown, ...props },
  ref
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const focusOnOpen = React.useRef(false);
  const focusButtonOnClose = React.useRef(false);
  const expanded = open || value.trim().length > 0;
  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );
  const openAndFocus = React.useCallback(() => {
    focusOnOpen.current = true;
    if (inputRef.current) inputRef.current.focus();
    else onOpenChange(true);
  }, [onOpenChange]);

  React.useEffect(() => {
    if (expanded && focusOnOpen.current) {
      focusOnOpen.current = false;
      inputRef.current?.focus();
    }
    if (!expanded && focusButtonOnClose.current) {
      focusButtonOnClose.current = false;
      buttonRef.current?.focus();
    }
  }, [expanded]);

  React.useEffect(() => {
    if (!slashShortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Ô tích của hàng (vừa bấm chọn) không phải ô gõ chữ: "/" vẫn mở ô tìm
      if (target?.closest("input:not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true'], [role='textbox']")) return;
      event.preventDefault();
      openAndFocus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slashShortcut, openAndFocus]);

  if (expanded) {
    return (
      <ListToolbarSearch
        ref={setRefs}
        value={value}
        onChange={onChange}
        aria-label={label}
        // Mở từ nút tròn 28px rồi giãn ra (không nhảy hình); còn từ khóa mà rời ô thì giữ bề ngang đọc được từ khóa
        collapsedWidthClassName={value ? LIST_TOOLBAR_SEARCH_COLLAPSED : "w-7"}
        focusHint="Esc"
        // Bấm X xóa xong con trỏ ở lại ô để gõ tiếp (nút X biến mất, không thì tiêu điểm rơi ra trang và ô không thu lại)
        onClear={() => {
          if (onClear) onClear();
          else onChange("");
          inputRef.current?.focus();
        }}
        onBlur={(event) => {
          if (!value.trim()) onOpenChange(false);
          onBlur?.(event);
        }}
        // Esc: còn chữ thì xóa chữ, ô trống thì thu lại và trả con trỏ về nút tìm
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Escape") return;
          event.preventDefault();
          if (value) {
            if (onClear) onClear();
            else onChange("");
          } else {
            focusButtonOnClose.current = true;
            onOpenChange(false);
          }
        }}
        {...props}
      />
    );
  }
  return (
    <Pressable ref={buttonRef} onClick={openAndFocus} aria-label={label} title={`${label} (/)`} className={listToolbarIconButtonClass(false)}>
      <TaskIconSearch size={14} className="shrink-0 text-muted-foreground" />
    </Pressable>
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
                flush && "p-0 overflow-hidden",
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
      // Hàng lọc đưa tiêu điểm về đây khi bỏ chip cuối cùng (`ActiveFilterBar`)
      data-list-filter-button=""
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
          <MenuPopup className={cn(MENU_POPUP_CLASS, "w-56", SHEET_POPUP_CLASS)}>
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
