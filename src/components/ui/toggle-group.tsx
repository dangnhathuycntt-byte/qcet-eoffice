"use client";

import * as React from "react";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";
import { toggleVariants } from "./toggle";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<{
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}>({
  variant: "default",
  size: "default",
});

export interface ToggleGroupProps
  extends React.ComponentPropsWithoutRef<typeof BaseToggleGroup>,
    VariantProps<typeof toggleVariants> {}

/**
 * Nhóm nút chuyển đổi trạng thái (Toggle Group) chuẩn QCET.
 * Hỗ trợ chọn đơn hoặc đa mục, bố trí ngang trên nền `bg-secondary`.
 */
export function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: ToggleGroupProps) {
  return (
    <BaseToggleGroup
      className={cn("inline-flex items-center gap-1 rounded-xl bg-secondary p-1", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant: variant || "default", size: size || "default" }}>
        {children}
      </ToggleGroupContext.Provider>
    </BaseToggleGroup>
  );
}

export function useToggleGroupContext() {
  return React.useContext(ToggleGroupContext);
}
