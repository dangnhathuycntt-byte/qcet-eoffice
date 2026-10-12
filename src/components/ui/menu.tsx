"use client";

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import * as m from "motion/react-m";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { popoverVariants } from "@/lib/motion/variants";
import { Pressable } from "@/components/ui/pressable";
import { useVirtualKeyboard } from "@/hooks/use-virtual-keyboard";

/** Hàng mục menu chuẩn: cao 28px, chữ 12px, icon 16px, hover nền accent (dùng chung menu thao tác và bộ lọc) */
export const MENU_ROW_CLASS =
  "flex w-full items-center gap-2 px-2 h-7 rounded-md text-left text-xs text-foreground cursor-pointer transition-colors duration-75 outline-none hover:bg-accent focus-visible:bg-accent";

/** Khung popup menu: bo góc theo token, không viền, bóng menu. Chuyển động do `MenuPopup` (motion) đảm nhiệm. */
export const MENU_POPUP_CLASS =
  "rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-xs text-popover-foreground shadow-menu outline-none z-50 origin-[var(--transform-origin)] data-[closed]:hidden";

/**
 * Điện thoại (< md): menu/popover thành bottom sheet kiểu Linear mobile — lớp tối phía sau, khung bám đáy rộng hết màn,
 * bo góc trên, thanh kéo + tiêu đề (`MenuSheetHeader`), hàng cao 40px cho ngón tay. Từ md trở lên giữ popup như cũ.
 * Positioner của Base UI ghi `position/top/left/transform` inline nên các lớp vị trí phải `!` mới thắng.
 */
export const SHEET_BACKDROP_CLASS =
  "fixed inset-0 z-[55] bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none md:hidden";
export const SHEET_POSITIONER_CLASS =
  "max-md:fixed! max-md:inset-x-0! max-md:top-auto! max-md:bottom-[var(--keyboard-height,0px)]! max-md:transform-none! max-md:z-[56]";
export const SHEET_POPUP_CLASS =
  "max-md:w-full! max-md:max-w-none! max-md:min-w-0! max-md:max-h-[calc(80dvh-var(--keyboard-height,0px))]! max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:px-2 max-md:pt-0 max-md:pb-[calc(env(safe-area-inset-bottom,0px)+8px)] max-md:text-compact max-md:has-[[data-popup-open]]:invisible max-md:[&_[role=menuitem]]:h-10 max-md:[&_[role=menuitem]]:px-3 max-md:[&_[role=menuitem]]:text-compact max-md:[&_[role=option]]:min-h-10 max-md:[&_[role=option]]:px-3 max-md:[&_[role=option]]:text-compact";

/** Gắn vào sheet có ô nhập: khi bàn phím ảo mở, `--keyboard-height` nâng sheet lên trên bàn phím (iOS không co khung nhìn). */
export function SheetKeyboardSync() {
  useVirtualKeyboard();
  return null;
}

/** Đầu bottom sheet (chỉ hiện trên điện thoại): thanh kéo, tiêu đề, nút quay lại khi đang ở menu con. */
export function MenuSheetHeader({ title, onBack }: { title?: React.ReactNode; onBack?: () => void }) {
  return (
    <div data-sheet-header="" className="sticky top-0 z-10 -mx-2 bg-popover px-2 pt-2 md:hidden">
      <div aria-hidden className="mx-auto mb-1 h-1 w-9 rounded-full bg-mark" />
      {title || onBack ? (
        <div className="flex h-10 items-center gap-1 px-1 text-compact font-medium text-foreground">
          {onBack ? (
            <Pressable
              onClick={onBack}
              aria-label="Quay lại"
              className="-ml-1 flex size-8 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            >
              <ChevronLeft className="size-4" />
            </Pressable>
          ) : null}
          <span className="min-w-0 truncate">{title}</span>
        </div>
      ) : null}
    </div>
  );
}

// Namespace re-export
export const Menu = BaseMenu;

// Individual primitives re-export
export const MenuRoot = BaseMenu.Root;
export const MenuTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Trigger> & { asChild?: boolean }
>(({ children, asChild, render, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    return <BaseMenu.Trigger ref={ref as any} render={children as any} {...props} />;
  }
  return (
    <BaseMenu.Trigger ref={ref as any} render={render} {...props}>
      {children}
    </BaseMenu.Trigger>
  );
});
MenuTrigger.displayName = "MenuTrigger";
export const MenuPortal = BaseMenu.Portal;
export const MenuPositioner = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>
>(({ className, ...props }, ref) => (
  <BaseMenu.Positioner
    ref={ref}
    className={cn("z-50 outline-none", className)}
    {...props}
  />
));
MenuPositioner.displayName = "MenuPositioner";
/**
 * Khung popup của menu: vào bằng `popoverVariants` của thư viện motion (cùng chuyển động với popover khác trong app),
 * đóng ngay như menu chuột phải (`data-[closed]:hidden` gỡ popup đang đóng, không chờ animation vào chạy nốt nên submenu cũ không chồng lên submenu mới). Tự tắt khi người dùng bật giảm chuyển động (MotionConfig reducedMotion="user").
 */
export const MenuPopup = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof BaseMenu.Popup>>(
  function MenuPopup(props, ref) {
    return (
      <BaseMenu.Popup
        ref={ref}
        render={<m.div variants={popoverVariants} initial="initial" animate="animate" />}
        {...props}
      />
    );
  }
);
export const MenuItem = BaseMenu.Item;
export const MenuSeparator = BaseMenu.Separator;
export const MenuGroup = BaseMenu.Group;
export const MenuGroupLabel = BaseMenu.GroupLabel;
export const MenuBackdrop = BaseMenu.Backdrop;
export const MenuArrow = BaseMenu.Arrow;
export const MenuCheckboxItem = BaseMenu.CheckboxItem;
export const MenuRadioGroup = BaseMenu.RadioGroup;
export const MenuRadioItem = BaseMenu.RadioItem;
export const MenuSubmenuRoot = BaseMenu.SubmenuRoot;
export const MenuSubmenuTrigger = BaseMenu.SubmenuTrigger;

/** Tiêu đề nhỏ ở đầu menu con ("Độ ưu tiên", "Hạn hoàn thành"…). */
export function MenuSubmenuTitle({ children }: { children: React.ReactNode }) {
  return <div data-slot="menu-submenu-title" className="px-2 pt-1 pb-1 text-xs text-muted-foreground select-none">{children}</div>;
}

/** Ô icon 16px dẫn đầu hàng menu, để mọi hàng thẳng cột dù icon lớn nhỏ khác nhau. */
function MenuRowLeading({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-slot="menu-leading"
      className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg:not([class*='size-'])]:size-4"
    >
      {children}
    </span>
  );
}

export interface MenuOptionItemProps extends React.ComponentPropsWithoutRef<typeof BaseMenu.Item> {
  /** Icon dẫn đầu (16px). */
  leading?: React.ReactNode;
  /** Gợi ý bên phải: số lượng, ngày, giá trị đang chọn. */
  hint?: React.ReactNode;
  /** Phím tắt hiển thị bên phải. */
  shortcut?: React.ReactNode;
  /** Đang chọn: nền accent, chữ đậm, không dấu tick. */
  selected?: boolean;
  /** Thao tác xóa/nguy hiểm: chữ và nền hover màu destructive. */
  destructive?: boolean;
}

/**
 * Hàng trong menu/popover: [icon] nhãn · gợi ý · phím tắt.
 * Chuẩn chung: hàng 28px, chữ 12px, đang chọn = nền accent + chữ đậm (không tick, không ô tích).
 * Là hàng chọn giá trị nên bấm không đóng menu (chọn nhiều giá trị liên tiếp); hàng thao tác dùng `MenuActionItem`.
 */
export const MenuOptionItem = React.forwardRef<HTMLDivElement, MenuOptionItemProps>(
  ({ leading, hint, shortcut, selected, destructive, className, children, closeOnClick = false, ...props }, ref) => (
    <BaseMenu.Item
      ref={ref}
      closeOnClick={closeOnClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        MENU_ROW_CLASS,
        "whitespace-nowrap data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        selected && "bg-accent font-medium",
        destructive && "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 [&_[data-slot=menu-leading]]:text-destructive",
        className
      )}
      {...props}
    >
      {leading ? <MenuRowLeading>{leading}</MenuRowLeading> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground/80">{hint}</span> : null}
      {shortcut ? <kbd className="shrink-0 font-sans text-xs font-normal tabular-nums text-muted-foreground/80">{shortcut}</kbd> : null}
    </BaseMenu.Item>
  )
);
MenuOptionItem.displayName = "MenuOptionItem";

/** Hàng thao tác (Sửa, In, Xóa…): cùng diện mạo `MenuOptionItem` nhưng bấm xong thì đóng menu. */
export const MenuActionItem = React.forwardRef<HTMLDivElement, MenuOptionItemProps>(
  ({ closeOnClick = true, ...props }, ref) => <MenuOptionItem ref={ref} closeOnClick={closeOnClick} {...props} />
);
MenuActionItem.displayName = "MenuActionItem";

export interface MenuSubmenuProps {
  /** Icon dẫn đầu của hàng mở menu con (16px). */
  icon?: React.ReactNode;
  label: React.ReactNode;
  /** Gợi ý bên phải hàng: số bộ lọc đang bật, giá trị đang chọn. */
  hint?: React.ReactNode;
  /** Đang có giá trị được chọn bên trong: nhãn đậm. */
  active?: boolean;
  /** Tiêu đề trong menu con. */
  title?: React.ReactNode;
  /** Lớp bổ sung cho khung menu con (độ rộng, chiều cao tối đa). */
  popupClassName?: string;
  children: React.ReactNode;
}

/**
 * Hàng mở menu con thả sang trái: rê chuột là mở ngay (delay 0), đóng sau 80ms.
 * Không mũi tên; hàng mở có nền accent. Dùng chung cho mọi bộ lọc nhiều cấp.
 */
export function MenuSubmenu({ icon, label, hint, active, title, popupClassName, children }: MenuSubmenuProps) {
  // Điều khiển trạng thái mở để nút "Quay lại" của bottom sheet (điện thoại) đóng được riêng menu con.
  const [open, setOpen] = React.useState(false);
  return (
    <BaseMenu.SubmenuRoot open={open} onOpenChange={setOpen}>
      <BaseMenu.SubmenuTrigger
        openOnHover
        delay={0}
        closeDelay={80}
        className={cn(MENU_ROW_CLASS, "group select-none data-[popup-open]:bg-accent")}
      >
        {icon ? <MenuRowLeading>{icon}</MenuRowLeading> : null}
        <span className={cn("min-w-0 flex-1 truncate", active && "font-medium")}>{label}</span>
        {hint ? <span className="max-w-24 shrink-0 truncate text-xs tabular-nums text-muted-foreground/80">{hint}</span> : null}
      </BaseMenu.SubmenuTrigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          side="left"
          align="start"
          sideOffset={2}
          alignOffset={-4}
          collisionPadding={12}
          className={cn("z-50 outline-none", SHEET_POSITIONER_CLASS)}
        >
          <MenuPopup
            className={cn(
              MENU_POPUP_CLASS,
              "w-auto min-w-[176px] max-w-[320px] max-h-[min(26rem,var(--available-height))] overflow-y-auto",
              popupClassName,
              SHEET_POPUP_CLASS
            )}
          >
            <MenuSheetHeader title={title ?? label} onBack={() => setOpen(false)} />
            {title ? <div className="max-md:hidden"><MenuSubmenuTitle>{title}</MenuSubmenuTitle></div> : null}
            {children}
          </MenuPopup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.SubmenuRoot>
  );
}

export interface MenuContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseMenu.Popup> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  showBackdrop?: boolean;
  backdropClassName?: string;
  positionerClassName?: string;
  arrow?: boolean;
  /** Điện thoại: hiện thành bottom sheet (xem `SHEET_POPUP_CLASS`). */
  mobileSheet?: boolean;
  /** Tiêu đề của bottom sheet trên điện thoại. */
  sheetTitle?: React.ReactNode;
}

/**
 * Standard MenuContent built over `@base-ui/react/menu`.
 * Features automatic Portal, Positioner with collision avoidance, optional backdrop blur,
 * and smooth scale/fade animations conforming to QCET UI polish tokens.
 */
export const MenuContent = React.forwardRef<HTMLDivElement, MenuContentProps>(
  (
    {
      className,
      align = "start",
      side = "bottom",
      sideOffset = 4,
      alignOffset = 0,
      collisionPadding = 12,
      showBackdrop = false,
      backdropClassName,
      positionerClassName,
      arrow = false,
      mobileSheet = false,
      sheetTitle,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <BaseMenu.Portal>
        {mobileSheet && <BaseMenu.Backdrop className={SHEET_BACKDROP_CLASS} />}
        {showBackdrop && (
          <BaseMenu.Backdrop
            className={cn(
              "fixed inset-0 z-30 bg-overlay transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none",
              backdropClassName
            )}
          />
        )}
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          className={cn("z-30 outline-none", positionerClassName, mobileSheet && SHEET_POSITIONER_CLASS)}
        >
          <MenuPopup
            ref={ref}
            className={cn(MENU_POPUP_CLASS, "min-w-[12rem]", className, mobileSheet && SHEET_POPUP_CLASS)}
            {...props}
          >
            {mobileSheet ? <MenuSheetHeader title={sheetTitle} /> : null}
            {children}
            {arrow && (
              <BaseMenu.Arrow className="fill-popover" />
            )}
          </MenuPopup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    );
  }
);

MenuContent.displayName = "MenuContent";
