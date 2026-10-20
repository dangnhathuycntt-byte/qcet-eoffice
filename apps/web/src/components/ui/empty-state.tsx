import * as React from "react";
import { cn } from "@/lib/utils";
import { EmptyGlyph, type EmptyGlyphName } from "@/components/ui/empty-glyphs";

export type { EmptyGlyphName };

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  /** Tranh nét mực trong `public/design/illustrations/` (vd. "dossier"), dùng khi chưa có dữ liệu. Có tranh thì bỏ qua `icon`. */
  illustration?: IllustrationName;
  /** Icon lớn 56px (`empty-glyphs`) cho trạng thái thường ngày (Hộp thư trống, chưa chọn, lỗi tải…); có icon lớn thì bỏ qua tranh và `icon`. */
  glyph?: EmptyGlyphName;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Nút hành động tiếp theo, ví dụ "Tạo nhiệm vụ" hoặc "Xóa bộ lọc". */
  action?: React.ReactNode;
  /**
   * compact: chữ 13px/12px và khoảng cách gọn cho khung trong bảng hoặc panel hẹp.
   * page: trang danh sách trống kiểu Linear (đo linear.app 14/10/2026): khối rộng 340px đặt giữa vùng, chữ căn trái,
   * tranh cao 160px (người dùng chốt 14/10/2026: 80px quá nhỏ so với Linear), tiêu đề 14px đậm, mô tả 13px; tranh, chữ và nút cách nhau 24px;
   * nút `Button size="pill"` cách nhau 8px.
   */
  density?: "default" | "compact" | "page";
}

export type IllustrationName =
  | "tasks"
  | "overdue"
  | "doc-in"
  | "doc-out"
  | "submission"
  | "dossier"
  | "inbox"
  | "inbox-select"
  | "unit-request"
  | "templates"
  | "calendar"
  | "all-done"
  | "load-error"
  | "meetings"
  | "approvals-done"
  | "directory"
  | "reports"
  | "no-results"
  | "welcome";

/**
 * Tranh có sẵn màu, hiện nguyên ảnh thay cho tranh nét mực tô bằng mask. Hiện chưa có tranh nào: 17/10/2026 người dùng chọn đổi cả bộ
 * từ doodle bút chì (nhân vật tóc xoăn, nét gạch đặc) sang pictogram nét bút dạ tối giản cho nhẹ như giao diện; quy tắc vẽ ở DESIGN.md
 * (mục "Tranh trạng thái trống"). Mỗi tranh giữ ý của bản cũ (kính lúp, phích cắm, đồng hồ báo thức…).
 */
const COLOR_ILLUSTRATIONS: Partial<Record<IllustrationName, string>> = {};

/**
 * Tranh nét mực tô bằng CSS mask: ảnh PNG chỉ giữ kênh alpha nên màu nét theo `bg-*` và đổi theo theme.
 * Nét 85% `foreground` (đậm cỡ nét minh họa trống của Linear); khi hiện, tranh nhấc nhẹ rồi đặt về chỗ một lần (`animate-illustration-settle`).
 * Dùng cho trạng thái chưa có dữ liệu và kết quả lọc/tìm kiếm rỗng (`no-results`). Tranh có bản màu (`COLOR_ILLUSTRATIONS`) thì hiện ảnh màu.
 */
export function InkIllustration({ name, className, align = "center" }: { name: IllustrationName; className?: string; align?: "center" | "left" }) {
  const position = align === "left" ? "left center" : "center";
  const color = COLOR_ILLUSTRATIONS[name];
  if (color) {
    return (
      <span
        data-slot="empty-state-illustration"
        aria-hidden="true"
        className={cn("animate-illustration-settle block h-[104px] w-28 shrink-0", className)}
        style={{ background: `url(${color}) ${position} / contain no-repeat` }}
      />
    );
  }
  const mask = `url(/design/illustrations/${name}.png) ${position} / contain no-repeat`;
  return (
    <span
      data-slot="empty-state-illustration"
      aria-hidden="true"
      className={cn("animate-illustration-settle block h-[104px] w-28 shrink-0 bg-foreground/85", className)}
      style={{ WebkitMask: mask, mask }}
    />
  );
}

/** Trạng thái không có dữ liệu: nói rõ vì sao trống và việc nên làm tiếp. */
export function EmptyState({ icon, illustration, glyph, title, description, action, density = "default", className, ...props }: EmptyStateProps) {
  if (density === "page") {
    return (
      <div data-density={density} className={cn("flex w-full items-center justify-center px-6 py-12", className)} {...props}>
        <div className="flex w-full max-w-[340px] flex-col gap-6 text-left">
          {glyph ? (
            <EmptyGlyph name={glyph} />
          ) : illustration ? (
            <InkIllustration name={illustration} align="left" className="h-40 w-[172px]" />
          ) : icon ? (
            <div className="text-muted-foreground [&_svg]:size-10">{icon}</div>
          ) : null}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description ? <div className="text-compact text-pretty text-muted-foreground">{description}</div> : null}
          </div>
          {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </div>
    );
  }
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
      {glyph ? (
        // Cách chữ 16px như Linear (gap 6px + 10px)
        <EmptyGlyph name={glyph} className="mb-2.5" />
      ) : illustration ? (
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
