"use client";

import * as React from "react";
import { Drawer as VaulDrawer } from "vaul";
import { X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DrawerContextValue {
  open?: boolean;
}

const DrawerContext = React.createContext<DrawerContextValue>({
  open: false,
});

export const DrawerRoot = ({
  open,
  direction = "right",
  shouldScaleBackground = false,
  children,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Root>) => (
  <DrawerContext.Provider value={{ open }}>
    <VaulDrawer.Root
      open={open}
      direction={direction}
      shouldScaleBackground={shouldScaleBackground}
      {...props}
    >
      {children}
    </VaulDrawer.Root>
  </DrawerContext.Provider>
);
DrawerRoot.displayName = "DrawerRoot";

export const DrawerTrigger = VaulDrawer.Trigger;

export const DrawerPortal = ({
  children,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Portal>) => {
  const { open } = React.useContext(DrawerContext);
  if (typeof window === "undefined") {
    if (!open) return null;
    return <>{children}</>;
  }
  return <VaulDrawer.Portal {...props}>{children}</VaulDrawer.Portal>;
};

export const DrawerClose = VaulDrawer.Close;

export const DrawerOverlay = React.forwardRef<
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
DrawerOverlay.displayName = "DrawerOverlay";

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> {
  direction?: "left" | "right" | "top" | "bottom";
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
}

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  DrawerContentProps
>(
  (
    {
      className,
      children,
      direction = "right",
      resizable = false,
      minWidth = 520,
      maxWidth = 1727,
      defaultWidth = 680,
      onWidthChange,
      style,
      ...props
    },
    ref
  ) => {
    const { open } = React.useContext(DrawerContext);
    const [width, setWidth] = React.useState<number>(defaultWidth);
    const isDraggingRef = React.useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!resizable) return;
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return;
        let newWidth: number;
        if (direction === "right") {
          newWidth = window.innerWidth - moveEvent.clientX;
        } else if (direction === "left") {
          newWidth = moveEvent.clientX;
        } else {
          return;
        }
        const clampedWidth = Math.min(
          Math.max(newWidth, minWidth),
          Math.min(maxWidth, window.innerWidth)
        );
        setWidth(clampedWidth);
        onWidthChange?.(clampedWidth);
      };

      const handlePointerUp = () => {
        isDraggingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    };

    const isSide = direction === "left" || direction === "right";

    const directionClasses = {
      right: "fixed inset-y-0 right-0 z-40 flex h-full w-full flex-col bg-card border-0 shadow-dialog focus:outline-none motion-reduce:transition-none",
      left: "fixed inset-y-0 left-0 z-40 flex h-full w-full flex-col bg-card border-0 shadow-dialog focus:outline-none motion-reduce:transition-none",
      bottom: "fixed inset-x-0 bottom-0 z-40 flex max-h-[90dvh] flex-col rounded-t-[28px] border-0 bg-card shadow-dialog focus:outline-none pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:transition-none",
      top: "fixed inset-x-0 top-0 z-40 flex max-h-[90dvh] flex-col rounded-b-[28px] border-0 bg-card shadow-dialog focus:outline-none pt-[max(1rem,env(safe-area-inset-top))] motion-reduce:transition-none",
    }[direction];

    const contentStyle = React.useMemo(() => {
      if (resizable && isSide) {
        return {
          ...style,
          width: `${width}px`,
          maxWidth: "100vw",
        };
      }
      return style;
    }, [resizable, isSide, width, style]);

    const resizeHandle = resizable && isSide ? (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để thay đổi độ rộng panel"
        onPointerDown={handlePointerDown}
        className={cn(
          "absolute top-0 bottom-0 z-50 w-2 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors",
          direction === "right" ? "left-0 -translate-x-1" : "right-0 translate-x-1"
        )}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-border" />
      </div>
    ) : null;

    if (typeof window === "undefined" || typeof document === "undefined") {
      if (!open) return null;
      return (
        <div
          style={contentStyle}
          className={cn(
            directionClasses,
            !resizable && isSide && "sm:max-w-3xl",
            className
          )}
        >
          {resizeHandle}
          {children}
        </div>
      );
    }

    return (
      <DrawerPortal>
        <DrawerOverlay />
        <VaulDrawer.Content
          ref={ref}
          style={contentStyle}
          className={cn(
            directionClasses,
            !resizable && isSide && "sm:max-w-3xl",
            className
          )}
          {...props}
        >
          {resizeHandle}
          {children}
        </VaulDrawer.Content>
      </DrawerPortal>
    );
  }
);
DrawerContent.displayName = "DrawerContent";

export const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col border-0 px-4 sm:px-6 py-4 gap-3.5 shrink-0 bg-card",
      className
    )}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Title>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Title>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={cn("text-base font-semibold tracking-tight text-foreground leading-snug font-heading", className)}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Description>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Description>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={cn("text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mt-auto flex flex-col gap-2 p-4 sm:p-6 shrink-0 bg-secondary/30",
      className
    )}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

export interface DrawerProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  stats?: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted?: number;
    overdue: number;
    completionRate: number;
  };
  children: React.ReactNode;
  direction?: "left" | "right" | "top" | "bottom";
  className?: string;
  shouldScaleBackground?: boolean;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
}

export function Drawer({
  isOpen,
  open: controlledOpen,
  onClose,
  onOpenChange,
  title,
  subtitle,
  stats,
  children,
  direction = "right",
  className,
  shouldScaleBackground = false,
  resizable = false,
  minWidth = 520,
  maxWidth = 1727,
  defaultWidth = 680,
  onWidthChange,
}: DrawerProps) {
  const effectiveOpen = controlledOpen ?? isOpen ?? false;

  const handleOpenChange = (openState: boolean) => {
    if (!openState) {
      onClose?.();
    }
    onOpenChange?.(openState);
  };

  return (
    <DrawerRoot
      open={effectiveOpen}
      onOpenChange={handleOpenChange}
      direction={direction}
      shouldScaleBackground={shouldScaleBackground}
    >
      <DrawerContent
        direction={direction}
        resizable={resizable}
        minWidth={minWidth}
        maxWidth={maxWidth}
        defaultWidth={defaultWidth}
        onWidthChange={onWidthChange}
        className={className}
      >
        {(title || subtitle || stats) && (
          <DrawerHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {title && (
                  <DrawerTitle>
                    {title}
                  </DrawerTitle>
                )}
                {subtitle && (
                  <DrawerDescription>
                    {subtitle}
                  </DrawerDescription>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {stats && (
              <div className="rounded-2xl p-4 bg-secondary flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold">
                  <span className="text-foreground">
                    Tiến độ hoàn thành:{" "}
                    <span className="tabular-nums text-primary">
                      {stats.completed}/{stats.total}
                    </span>
                  </span>
                  <span className="text-muted-foreground font-medium text-xs tabular-nums">
                    {stats.total} nhiệm vụ
                  </span>
                </div>
                <Progress
                  value={stats.completionRate}
                  className="[&_[data-slot=progress-track]]:h-2.5 rounded-full"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pt-0.5">
                  <span className="text-foreground font-semibold tabular-nums">
                    {stats.completed} hoàn thành
                  </span>
                  <span>·</span>
                  <span className="text-muted-foreground font-semibold tabular-nums">
                    {stats.inProgress} đang làm
                  </span>
                  {stats.overdue > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-destructive font-semibold tabular-nums">
                        {stats.overdue} trễ hạn
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </DrawerHeader>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background thin-scrollbar">
          {children}
        </div>
      </DrawerContent>
    </DrawerRoot>
  );
}

/** Panel bên kéo giãn nở 520px–1727px theo Artboard Components & CodeMap */
export function SidePanel(props: DrawerProps) {
  return <Drawer resizable defaultWidth={props.defaultWidth ?? 520} {...props} />;
}
