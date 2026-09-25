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
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200",
      className
    )}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> & {
    direction?: "left" | "right" | "top" | "bottom";
  }
>(({ className, children, direction = "right", ...props }, ref) => {
  const { open } = React.useContext(DrawerContext);

  const directionClasses = {
    right: "fixed inset-y-0 right-0 z-50 flex h-full w-full sm:max-w-3xl flex-col bg-card border-l border-border/60 shadow-2xl focus:outline-none",
    left: "fixed inset-y-0 left-0 z-50 flex h-full w-full sm:max-w-3xl flex-col bg-card border-r border-border/60 shadow-2xl focus:outline-none",
    bottom: "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[28px] border-t border-border/80 bg-card shadow-2xl focus:outline-none pb-[max(1rem,env(safe-area-inset-bottom))]",
    top: "fixed inset-x-0 top-0 z-50 flex max-h-[90dvh] flex-col rounded-b-[28px] border-b border-border/80 bg-card shadow-2xl focus:outline-none pt-[max(1rem,env(safe-area-inset-top))]",
  }[direction];

  if (typeof window === "undefined" || typeof document === "undefined") {
    if (!open) return null;
    return (
      <div className={cn(directionClasses, className)}>
        {children}
      </div>
    );
  }

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <VaulDrawer.Content
        ref={ref}
        className={cn(directionClasses, className)}
        {...props}
      >
        {children}
      </VaulDrawer.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

export const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col border-b border-border/60 px-4 sm:px-6 py-4 gap-3.5 shrink-0 bg-card/95 backdrop-blur-md",
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
    className={cn("text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug font-heading", className)}
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
      "mt-auto flex flex-col gap-2 p-4 sm:p-6 pt-2 shrink-0 border-t border-border/40",
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
      <DrawerContent direction={direction} className={className}>
        {(title || subtitle || stats) && (
          <DrawerHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
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
                className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.98] shrink-0 cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {stats && (
              <div className="rounded-2xl px-4 py-3 bg-muted/40 border border-border/50 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs sm:text-[13px] font-bold">
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
                  className="[&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-indicator]]:bg-emerald-500 rounded-full"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pt-0.5">
                  <span className="text-emerald-600 font-bold tabular-nums">
                    {stats.completed} hoàn thành
                  </span>
                  <span>·</span>
                  <span className="text-blue-600 font-semibold tabular-nums">
                    {stats.inProgress} đang làm
                  </span>
                  {stats.overdue > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-rose-600 font-bold tabular-nums animate-pulse">
                        {stats.overdue} quá hạn
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </DrawerHeader>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background/50 thin-scrollbar">
          {children}
        </div>
      </DrawerContent>
    </DrawerRoot>
  );
}
