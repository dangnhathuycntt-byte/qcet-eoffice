import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "xs" | "sm" | "md" | "lg";
  label?: string;
}

const sizeMap = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
};

/**
 * Con quay chỉ báo tải dữ liệu (Loading Spinner) tối giản chuẩn QCET.
 * Hình cung tròn sắc nét, quay êm ái, hỗ trợ WAI-ARIA status.
 */
export function Spinner({
  size = "sm",
  label = "Đang tải dữ liệu...",
  className,
  ...props
}: SpinnerProps) {
  const pixelSize = sizeMap[size];

  return (
    <svg
      role="status"
      aria-label={label}
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("motion-safe:animate-spin motion-reduce:animate-none text-primary shrink-0", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeOpacity="0.2"
      />
      <path
        d="M12 3 A9 9 0 0 1 21 12"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
