import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

/**
 * Vùng bấm không mang kiểu nút: hàng danh sách, ô lịch, thẻ, tab tự dựng, mục chọn.
 * Chỉ gắn hành vi chung (type="button", focus ring như Button, disabled, con trỏ);
 * kích thước, nền, bố cục do nơi dùng quyết định. Cần nút có kiểu thì dùng Button.
 */
export const pressableClass =
  `cursor-pointer outline-none ${focusRingClass} disabled:cursor-not-allowed`;

export type PressableProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const Pressable = React.forwardRef<HTMLButtonElement, PressableProps>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-slot="pressable"
      className={cn(pressableClass, className)}
      {...props}
    />
  )
);
Pressable.displayName = "Pressable";

export { Pressable };
