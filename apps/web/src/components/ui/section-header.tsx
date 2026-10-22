import * as React from "react";
import { cn } from "@/lib/utils";

const META_TONE = {
  muted: "text-muted-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
} as const;

/**
 * Đầu một khối quy trình trong trang chi tiết (Luồng duyệt, Minh chứng, Gia hạn… của nhiệm vụ; Ký nháy, Theo dõi nơi nhận của
 * văn bản): tên 13px đậm, dòng phụ 12px ngay sau tên (số đếm, trạng thái), thao tác nhỏ dồn sang phải. Khoảng cách giữa các
 * khối và lề do khối chứa (`section`) quyết định.
 */
export function SectionHeader({
  title,
  meta,
  metaTone = "muted",
  action,
  as: Heading = "h2",
  id,
  className,
}: {
  title: React.ReactNode;
  /** Dòng phụ cạnh tên: số đếm ("2/3 đạt"), trạng thái ("Đã thu hồi"). */
  meta?: React.ReactNode;
  /** Màu dòng phụ: `warning` sắp tới hạn/cần chú ý, `destructive` trễ hạn/đã hủy. */
  metaTone?: keyof typeof META_TONE;
  /** Thao tác của khối (`Button variant="ghost" size="xs"`), canh phải. */
  action?: React.ReactNode;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Heading id={id} className="text-compact font-semibold tracking-tight text-foreground">
        {title}
      </Heading>
      {meta != null && meta !== false ? <span className={cn("text-xs tabular-nums", META_TONE[metaTone])}>{meta}</span> : null}
      {action ? <div className="ml-auto flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

/** Một dòng trong danh sách của khối quy trình: nội dung bên trái cắt cuối, phần trạng thái/thao tác bên phải, chữ 12px. */
export function SectionRow({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs", className)} {...props} />;
}
