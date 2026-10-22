"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SHEET_MOTION_CLASS, SheetKeyboardSync } from "@/components/ui/menu";
import { useModifierKey } from "@/hooks/use-modifier-key";

// Namespace primitives re-export
export const Dialog = BaseDialog;
export const DialogRoot = BaseDialog.Root;
export const DialogPortal = BaseDialog.Portal;
export const DialogBackdrop = BaseDialog.Backdrop;
export const DialogPopup = BaseDialog.Popup;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export const DialogClose = BaseDialog.Close;
export const DialogTrigger = BaseDialog.Trigger;

export interface StandardDialogProps {
  open: boolean;
  /** `eventDetails.reason` (Base UI): "outside-press", "escape-key", "close-press"…; `event` là sự kiện gây ra. */
  onOpenChange: (open: boolean, eventDetails?: { reason?: string; event?: Event }) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  showHeader?: boolean;
  /** compact: mô tả 12px. Mặc định giữ nguyên. */
  compact?: boolean;
  /** Phần tử nhận focus khi mở (Base UI `initialFocus`); mặc định là phần tử tab được đầu tiên. */
  initialFocus?: React.ComponentProps<typeof BaseDialog.Popup>["initialFocus"];
  /**
   * compose: hộp tạo/soạn theo hộp New issue của Linear (Soạn văn bản đi, Tạo cuộc họp): nền trắng, không đệm để
   * `DialogComposeHeader`, `DialogComposeBody`, `DialogComposeProperties` và `DialogComposeFooter` tự chia lề; nút phóng to ở
   * đầu hộp. Dùng kèm `showHeader={false}`.
   */
  variant?: "default" | "compose";
}

/** Trạng thái phóng to của hộp `variant="compose"`; nút ở `DialogComposeHeader` đọc và đổi. Giữ qua các lần mở trong phiên. */
const ComposeExpandContext = React.createContext<{ expanded: boolean; toggle: () => void } | null>(null);

const sizeClasses: Record<NonNullable<StandardDialogProps["size"]>, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
  xl: "max-w-4xl",
  full: "max-w-[95vw] max-h-[92vh]",
};

/**
 * Standard Dialog wrapper over `@base-ui/react/dialog`.
 * Provides accessible portal, overlay backdrop (bg-overlay / bg-black/40), focus trap, ESC dismiss, and clean layout.
 * Aligned with Modal.dc.html: 10% distance from top edge (avoids vertical jump on content resize), max-height 85dvh.
 * Điện thoại (< md): bám đáy màn hình, trượt từ dưới lên, có thanh kéo; nâng lên trên bàn phím ảo (`--keyboard-height`).
 * Các lớp `!` thắng `sm:max-w-*`/`sm:p-*` của nơi gọi trong khoảng 640–767px.
 */
export function StandardDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "md",
  showCloseButton = true,
  showHeader = true,
  compact = false,
  initialFocus,
  variant = "default",
}: StandardDialogProps) {
  const [expanded, setExpanded] = React.useState(false);
  const compose = React.useMemo(() => ({ expanded, toggle: () => setExpanded((value) => !value) }), [expanded]);
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal keepMounted={open}>
        {/* data-slot: nơi gọi phân biệt nhấn nền mờ với nhấn vào portal của nội dung (menu "/" của editor) */}
        <BaseDialog.Backdrop data-slot="dialog-backdrop" className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
        <BaseDialog.Popup
          initialFocus={initialFocus}
          className={cn(
            "fixed left-1/2 top-[10%] z-50 w-full -translate-x-1/2 outline-none max-h-[85dvh] flex flex-col overflow-y-auto",
            "rounded-2xl border-0 bg-card p-4 sm:p-6 shadow-dialog motion-reduce:transition-none",
            "max-md:inset-x-0 max-md:w-full max-md:top-auto max-md:bottom-[var(--keyboard-height,0px)] max-md:translate-x-0 max-md:max-w-none! max-md:max-h-[calc(85dvh-var(--keyboard-height,0px))]! max-md:rounded-b-none max-md:pt-0! max-md:pb-[calc(env(safe-area-inset-bottom,0px)+24px)]!",
            SHEET_MOTION_CLASS,
            sizeClasses[size],
            variant === "compose" && "gap-0 bg-background p-0 sm:p-0 max-md:pb-0!",
            // Phóng to như Linear (đo 22/10/2026: 750 → 820px, cao gần hết màn): giữ mép trên 10%, chiều cao cố định để phần
            // thân giãn và hàng chip cùng chân hộp xuống đáy. Điện thoại đã là tấm đáy nên bỏ qua
            variant === "compose" && expanded && "md:h-[85dvh] md:max-w-[820px]",
            className
          )}
        >
          <SheetKeyboardSync />
          <div aria-hidden className="mx-auto my-2 h-1 w-9 shrink-0 rounded-full bg-mark md:hidden" />
          {showHeader ? (
            <>
              {/* Mô tả đi sát tiêu đề (4px) rồi mới cách nội dung 16px; trước đây mô tả cách tiêu đề 16px nhưng chỉ cách
                  nhãn ô đầu 8px nên đọc như dính vào ô (người dùng gửi ảnh hộp Tạo cuộc họp 20/10/2026) */}
              <div className="flex items-start justify-between gap-3 pb-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <BaseDialog.Title className="text-base font-semibold tracking-tight text-foreground">
                    {title}
                  </BaseDialog.Title>
                  <BaseDialog.Description
                    className={cn(!description && "sr-only", compact ? "text-xs" : "text-sm", "text-muted-foreground")}
                  >
                    {description || title}
                  </BaseDialog.Description>
                </div>
                {showCloseButton && (
                  <BaseDialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Đóng" className="-mt-0.5 shrink-0" />}>
                    <X className="size-4" />
                  </BaseDialog.Close>
                )}
              </div>
            </>
          ) : (
            <>
              <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
              <BaseDialog.Description className="sr-only">
                {description || title}
              </BaseDialog.Description>
            </>
          )}
          {variant === "compose" ? <ComposeExpandContext.Provider value={compose}>{children}</ComposeExpandContext.Provider> : children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/**
 * Biểu mẫu trong hộp thoại: Enter trong ô một dòng gửi (có nút `type="submit"` trong `DialogFooter` và nút đó không bị
 * `disabled`), Ctrl/Cmd+Enter trong ô nhiều dòng gửi. Tắt kiểm tra của trình duyệt (`noValidate`): nơi gọi tự báo lỗi
 * từng ô (`aria-invalid` + dòng `text-xs text-destructive` dưới ô) và đưa focus vào ô lỗi đầu tiên.
 */
export function DialogForm({ onSubmit, className, children }: { onSubmit: () => void; className?: string; children: React.ReactNode }) {
  return (
    <form
      noValidate
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** Chân hộp thoại: nút phụ (ghost) bên trái nút chính, dồn phải, cách nhau 8px. Nút chính `type="submit"` + `loading` khi đang gửi. */
export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex justify-end gap-2 pt-1", className)}>{children}</div>;
}

/**
 * Dòng đầu hộp tạo/soạn thay cho tiêu đề lớn: nơi chứa › việc đang làm, chữ 12px, mục đầu đậm (hộp Tạo cuộc họp, Soạn văn
 * bản đi, Tạo nhiệm vụ). Mục giữa dài (tên việc cha) thì cắt cuối, nơi gọi gắn `title` để xem đủ.
 */
export function DialogBreadcrumb({ items, icon, className }: { items: React.ReactNode[]; icon?: React.ReactNode; className?: string }) {
  return (
    <div data-slot="dialog-breadcrumb" className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {icon}
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden /> : null}
          <span className={index === 0 ? "shrink-0 font-medium text-foreground" : "min-w-0 truncate"}>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Đầu hộp tạo/soạn (`StandardDialog variant="compose"`): dòng `DialogBreadcrumb`, nút phóng to/thu nhỏ (từ md) và nút đóng
 * tròn, lề 20/20/0/24 như hộp Tạo nhiệm vụ.
 */
export function DialogComposeHeader({ items }: { items: React.ReactNode[] }) {
  const compose = React.useContext(ComposeExpandContext);
  return (
    <header className="flex shrink-0 items-center gap-2 px-5 pt-5 max-md:pt-3 md:pl-6">
      <DialogBreadcrumb items={items} />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {compose ? <DialogExpandButton expanded={compose.expanded} onToggle={compose.toggle} /> : null}
        <BaseDialog.Close render={<Button variant="ghost" size="icon-xs" aria-label="Đóng" title="Đóng (Esc)" className="rounded-full max-md:size-8" />}>
          <X />
        </BaseDialog.Close>
      </div>
    </header>
  );
}

/** Nút phóng to/thu nhỏ hộp tạo/soạn, tròn 28px; chỉ từ md (điện thoại hộp đã là tấm đáy hoặc gần hết màn). */
export function DialogExpandButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const label = expanded ? "Thu nhỏ" : "Phóng to";
  return (
    <Button variant="ghost" size="icon-xs" aria-label={label} title={label} onClick={onToggle} className="rounded-full max-md:hidden">
      {expanded ? <Minimize2 /> : <Maximize2 />}
    </Button>
  );
}

/**
 * Phần thân cuộn của hộp tạo/soạn theo hộp New issue của Linear: tên, mô tả ngay dưới tên (không đường kẻ), rồi phần đi kèm
 * như danh sách tệp. Hàng chip và chân hộp nằm ngoài vùng cuộn nên luôn thấy; hộp phóng to thì phần này giãn hết chỗ còn lại.
 */
export function DialogComposeBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 pb-3 md:px-6", className)}>{children}</div>;
}

/**
 * Hàng chip thuộc tính của hộp tạo/soạn (`Select variant="pill"`, `VietnameseDatePicker variant="pill"`…), nằm dưới phần thân
 * như Linear: chip cách nhau 8px, tự xuống dòng. `errors`: dòng `FieldError` của chip (ngày, giờ, tệp) ngay dưới hàng.
 */
export function DialogComposeProperties({ errors, children }: { errors?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1 px-5 md:px-6">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {errors}
    </div>
  );
}

/**
 * Chân hộp tạo/soạn: không kẻ (cách hàng chip 24px là đủ tách, như Linear), lề trái thẳng hàng chip, lề phải thẳng nút đóng,
 * chừa vùng an toàn đáy trên điện thoại. `start`: thao tác phụ bên trái (nút đính kèm); nút Hủy và nút chính ở `children`.
 */
export function DialogComposeFooter({ start, className, children }: { start?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <DialogFooter className={cn("shrink-0 items-center px-5 pt-6 pb-3 md:pl-6 max-md:pb-[calc(env(safe-area-inset-bottom,0px)+12px)]", className)}>
      {start ? <div className="mr-auto flex items-center gap-2">{start}</div> : null}
      {children}
    </DialogFooter>
  );
}

/** Phím tắt gửi nằm gọn trong nút chính của hộp tạo/soạn (⌘↵ hoặc Ctrl ↵), nhạt hơn nhãn, ẩn trên điện thoại. */
export function SubmitShortcutHint() {
  const modKey = useModifierKey();
  return (
    <kbd aria-hidden="true" className="hidden font-sans text-micro text-primary-foreground/60 sm:inline">
      {modKey === "⌘" ? "⌘↵" : "Ctrl ↵"}
    </kbd>
  );
}

/** Lỗi của một ô nhập: dòng `text-xs text-destructive` ngay dưới ô (ô đặt `aria-invalid` và `aria-describedby` trỏ tới `id`), đọc to khi hiện. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {children}
    </p>
  );
}
