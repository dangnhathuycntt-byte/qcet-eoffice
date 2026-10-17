import * as React from "react";
import { cn } from "@/lib/utils";

export interface AgentIconProps extends React.SVGProps<SVGSVGElement> {
  /** Tô đặc khi panel Agent đang mở (nút Ẩn), nét rỗng khi chưa mở. */
  filled?: boolean;
}

/**
 * Icon Agent soạn nhiệm vụ: tia sáng bốn cánh cạnh cong mềm kèm một tia nhỏ tô đặc ở góc, cùng quy cách bộ icon sidebar
 * (`layout/sidebar-rounded-icons`): lưới 16, nét 1,25px, đầu cánh bo tròn, đang bật thì tô đặc.
 * Mặc định 14px như icon trong nút `pill-xs` cạnh nó; cụm hình cân trong ô nên không lệch khỏi chữ.
 */
export function AgentIcon({ filled = false, className, ...props }: AgentIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      // design-lint-ignore icon-stroke-width: icon tự vẽ cùng bộ sidebar (nét 1,25px trên lưới 16), không phải lucide
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      {...props}
    >
      <path
        d="M7 3.25Q8.15 7.85 12.75 9Q8.15 10.15 7 14.75Q5.85 10.15 1.25 9Q5.85 7.85 7 3.25Z"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M12.75 1.25Q13.19 2.81 14.75 3.25Q13.19 3.69 12.75 5.25Q12.31 3.69 10.75 3.25Q12.31 2.81 12.75 1.25Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
