import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  /** Tranh nét mực trong `public/design/illustrations/` (vd. "dossier"), dùng khi chưa có dữ liệu. Có tranh thì bỏ qua `icon`. */
  illustration?: IllustrationName;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Nút hành động tiếp theo, ví dụ "Tạo nhiệm vụ" hoặc "Xóa bộ lọc". */
  action?: React.ReactNode;
  /** compact: chữ 13px/12px và khoảng cách gọn cho khung trong bảng hoặc panel hẹp. Mặc định giữ nguyên. */
  density?: "default" | "compact";
}

export type IllustrationName =
  | "tasks"
  | "doc-in"
  | "doc-out"
  | "submission"
  | "dossier"
  | "inbox"
  | "unit-request"
  | "templates"
  | "calendar"
  | "all-done"
  | "load-error"
  | "meetings"
  | "approvals-done"
  | "directory"
  | "reports";

/**
 * Tranh nét mực tô bằng CSS mask: ảnh PNG chỉ giữ kênh alpha nên màu nét theo `bg-*` và đổi theo theme.
 * Chỉ dùng cho trạng thái chưa có dữ liệu; kết quả lọc/tìm kiếm rỗng dùng icon.
 */
export function InkIllustration({ name, className }: { name: IllustrationName; className?: string }) {
  const mask = `url(/design/illustrations/${name}.png) center / contain no-repeat`;
  return (
    <span
      data-slot="empty-state-illustration"
      aria-hidden="true"
      className={cn("block h-[104px] w-28 shrink-0 bg-foreground/75", className)}
      style={{ WebkitMask: mask, mask }}
    />
  );
}

export type ArrowHintVariant = "loop" | "curve" | "squiggle" | "zigzag" | "spiral";

/**
 * Mũi tên nét mực chỉ lên nút tạo mới ở thanh công cụ khi danh sách chưa có dữ liệu.
 * Người gọi tự đặt vị trí (`right-*`, `top-*`) để đầu mũi tên nằm dưới nút; chỉ hiện từ md, nơi nút ở góc phải.
 */
export function ArrowHint({ variant = "loop", className }: { variant?: ArrowHintVariant; className?: string }) {
  const mask = `url(/design/illustrations/arrow-${variant}.png) center / contain no-repeat`;
  return (
    <span
      data-slot="empty-state-arrow"
      aria-hidden="true"
      className={cn("pointer-events-none absolute hidden h-[70px] w-20 bg-muted-foreground/40 md:block", className)}
      style={{ WebkitMask: mask, mask }}
    />
  );
}

/** Trạng thái không có dữ liệu: nói rõ vì sao trống và việc nên làm tiếp. */
export function EmptyState({ icon, illustration, title, description, action, density = "default", className, ...props }: EmptyStateProps) {
  const compact = density === "compact";
  return (
    <div
      data-density={density}
      className={cn(
        compact ? "flex flex-col items-center gap-1.5 px-4 py-8 text-center" : "flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <InkIllustration name={illustration} className="mb-1" />
      ) : icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <p className={cn("font-medium text-foreground", compact ? "text-compact" : "text-base")}>{title}</p>
        {description ? <div className={cn("text-muted-foreground", compact ? "mt-0.5 text-xs" : "mt-1 text-sm")}>{description}</div> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
