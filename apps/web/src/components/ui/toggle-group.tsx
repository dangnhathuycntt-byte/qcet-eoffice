"use client";

import * as React from "react";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

type ToggleVariant = "segmented" | "outline" | "soft";
type ToggleSize = "xs" | "sm";
type ToggleTone = "default" | "destructive";

interface ToggleGroupContextValue {
  variant: ToggleVariant;
  size: ToggleSize;
  tone: ToggleTone;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: "segmented",
  size: "sm",
  tone: "default",
});

const groupVariantClass: Record<ToggleVariant, string> = {
  segmented: "gap-0.5 rounded-md bg-secondary p-0.5",
  outline: "gap-1",
  soft: "gap-1",
};

const itemBaseClass = `inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1 whitespace-nowrap rounded-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-3.5 ${focusRingClass} motion-reduce:transition-none`;

const itemSizeClass: Record<ToggleSize, string> = {
  xs: "h-6 px-2 text-xs",
  sm: "h-7 px-2.5 text-xs",
};

const iconOnlySizeClass: Record<ToggleSize, string> = {
  xs: "size-6 px-0",
  sm: "size-7 px-0",
};

const itemVariantClass: Record<ToggleVariant, string> = {
  segmented: "data-[pressed]:bg-card data-[pressed]:text-foreground data-[pressed]:shadow-low",
  outline: "border border-border/80 bg-background hover:bg-accent data-[pressed]:bg-selected data-[pressed]:text-foreground",
  soft: "hover:bg-accent data-[pressed]:bg-selected data-[pressed]:text-foreground",
};

const itemToneClass: Record<ToggleTone, string> = {
  default: "",
  destructive: "data-[pressed]:bg-danger-soft data-[pressed]:text-destructive",
};

export interface ToggleGroupProps {
  /** Nhãn cho nhóm (bắt buộc: trình đọc màn hình đọc nhóm này). */
  "aria-label": string;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Chọn nhiều mục; mặc định chọn một. */
  multiple?: boolean;
  variant?: ToggleVariant;
  size?: ToggleSize;
  tone?: ToggleTone;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Nhóm nút bật/tắt chọn một hoặc nhiều mục; hỗ trợ mũi tên để di chuyển giữa các mục. */
export function ToggleGroup({
  "aria-label": ariaLabel,
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  variant = "segmented",
  size = "sm",
  tone = "default",
  disabled,
  className,
  children,
}: ToggleGroupProps) {
  return (
    <BaseToggleGroup
      aria-label={ariaLabel}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.([...next])}
      multiple={multiple}
      disabled={disabled}
      className={cn("inline-flex items-center", groupVariantClass[variant], className)}
    >
      <ToggleGroupContext.Provider value={{ variant, size, tone }}>{children}</ToggleGroupContext.Provider>
    </BaseToggleGroup>
  );
}

export type ToggleGroupItemProps = {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
} & (
  | { iconOnly: true; "aria-label": string }
  | { iconOnly?: false; "aria-label"?: string }
);

/** Mục trong ToggleGroup. Khi `iconOnly` bắt buộc có `aria-label` vì không còn chữ hiển thị. */
export function ToggleGroupItem({ value, disabled, className, children, iconOnly = false, ...props }: ToggleGroupItemProps) {
  const { variant, size, tone } = React.useContext(ToggleGroupContext);
  return (
    <BaseToggle
      value={value}
      disabled={disabled}
      data-slot="toggle-group-item"
      className={cn(
        itemBaseClass,
        iconOnly ? iconOnlySizeClass[size] : itemSizeClass[size],
        itemVariantClass[variant],
        itemToneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </BaseToggle>
  );
}
