import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** xs 12px, sm 14px (mặc định), md 16px: ba cỡ phổ biến nhất ở các nơi đang dùng Loader2. */
const sizeClass = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
} as const;

/** currentColor kế thừa màu chữ của nơi chứa (nút, dòng). */
const toneClass = {
  currentColor: "",
  muted: "text-muted-foreground",
  primary: "text-primary",
} as const;

export interface SpinnerProps {
  size?: keyof typeof sizeClass;
  tone?: keyof typeof toneClass;
  /** Có nhãn thì thành vùng trạng thái (role="status") đọc được cho trình đọc màn hình. */
  label?: string;
  className?: string;
}

/** Chỉ báo đang tải (Loader2 quay). Không truyền strokeWidth: nét lấy từ LucideProvider. */
export function Spinner({ size = "sm", tone = "currentColor", label, className }: SpinnerProps) {
  const icon = (
    <Loader2
      aria-hidden="true"
      data-slot="spinner"
      className={cn("shrink-0 animate-spin", sizeClass[size], toneClass[tone], !label && className)}
    />
  );
  if (!label) return icon;
  return (
    <span role="status" className={cn("inline-flex shrink-0 items-center", className)}>
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
