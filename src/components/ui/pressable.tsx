import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Vùng bấm không mang kiểu nút: hàng danh sách, ô lịch, thẻ, tab tự dựng, mục chọn.
 * Chỉ gắn hành vi chung (type="button", focus ring như Button, disabled, con trỏ);
 * kích thước, nền, bố cục do nơi dùng quyết định. Cần nút có kiểu thì dùng Button.
 */
export const pressableClass =
  "cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 disabled:cursor-not-allowed";

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
