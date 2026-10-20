"use client";

import * as React from "react";
import { Drawer as VaulDrawer } from "vaul";
import { cn } from "@/lib/utils";

interface BottomSheetContextValue {
  open?: boolean;
}

const BottomSheetContext = React.createContext<BottomSheetContextValue>({
  open: false,
});

/**
 * `autoFocus` mặc định bật (vaul để tắt): không bật thì khi mở, con trỏ bàn phím vẫn ở trang phía sau và Tab đi vòng ngoài
 * tấm trượt dù tấm trượt là modal. Tấm có ô nhập ngay đầu mà không muốn bàn phím điện thoại bật lên thì truyền `autoFocus={false}`.
 */
export const BottomSheet = ({
  shouldScaleBackground = false,
  autoFocus = true,
  open,
  children,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Root>) => (
  <BottomSheetContext.Provider value={{ open }}>
    <VaulDrawer.Root
      shouldScaleBackground={shouldScaleBackground}
      autoFocus={autoFocus}
      open={open}
      {...props}
    >
      {children}
    </VaulDrawer.Root>
  </BottomSheetContext.Provider>
);
BottomSheet.displayName = "BottomSheet";

export const BottomSheetTrigger = VaulDrawer.Trigger;
export const BottomSheetPortal = ({
  children,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Portal>) => {
  const { open } = React.useContext(BottomSheetContext);
  if (typeof window === "undefined") {
    if (!open) return null;
    return <>{children}</>;
  }
  return <VaulDrawer.Portal {...props}>{children}</VaulDrawer.Portal>;
};
export const BottomSheetClose = VaulDrawer.Close;
export const BottomSheetHandle = VaulDrawer.Handle;

export const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Overlay>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-overlay transition-opacity duration-200 motion-reduce:transition-none",
      className
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

/**
 * Thân tấm trượt. Cuộn nội dung bằng một khối con (`min-h-0 flex-1 overflow-y-auto`), đừng đặt `overflow-y-auto` lên chính
 * thẻ này: vaul gắn `::after` cao 200% ngay dưới thẻ để che khi kéo, cuộn trên thẻ sẽ cuộn được vào khoảng trống đó.
 */
export const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> & {
    hideHandle?: boolean;
    /** Lớp thêm cho tay kéo, ví dụ `md:hidden` khi hộp thành thẻ giữa màn hình trên máy tính. */
    handleClassName?: string;
  }
>(({ className, children, hideHandle = false, handleClassName, ...props }, ref) => {
  const { open } = React.useContext(BottomSheetContext);

  if (typeof window === "undefined" || typeof document === "undefined") {
    if (!open) return null;
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[90dvh] flex-col rounded-t-[24px] border-0 bg-card text-card-foreground shadow-dialog focus:outline-none motion-reduce:transition-none",
          "pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
          className
        )}
      >
        {!hideHandle && (
          <div className={cn("mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-mark", handleClassName)} />
        )}
        {children}
      </div>
    );
  }

  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <VaulDrawer.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[90dvh] flex-col rounded-t-[24px] border-0 bg-card text-card-foreground shadow-dialog focus:outline-none motion-reduce:transition-none",
          "pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
          className
        )}
        {...props}
      >
        {!hideHandle && (
          <div className={cn("mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-mark", handleClassName)} />
        )}
        {children}
      </VaulDrawer.Content>
    </BottomSheetPortal>
  );
});
BottomSheetContent.displayName = "BottomSheetContent";

export const BottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1 px-5 pt-3 pb-2 text-left shrink-0",
      className
    )}
    {...props}
  />
);
BottomSheetHeader.displayName = "BottomSheetHeader";

export const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Title>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Title>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={cn("text-base font-semibold tracking-tight text-foreground", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

export const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Description>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Description>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mt-auto flex flex-col gap-2 p-5 pt-2 shrink-0 border-0",
      className
    )}
    {...props}
  />
);
BottomSheetFooter.displayName = "BottomSheetFooter";
