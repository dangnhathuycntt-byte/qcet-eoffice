import * as React from "react";
import { cn } from "@/lib/utils";
import { EmptyGlyph, type EmptyGlyphName } from "@/components/ui/empty-glyphs";

export type { EmptyGlyphName };

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  /** Icon lớn (`empty-glyphs`) theo ngữ cảnh trang (vd. "dossier"); cùng bộ với `glyph`, giữ tên cũ cho chỗ gọi. Có thì bỏ qua `icon`. */
  illustration?: IllustrationName;
  /** Icon lớn 96px (`empty-glyphs`) cho trạng thái thường ngày (Hộp thư trống, chưa chọn, lỗi tải…); có thì bỏ qua `illustration` và `icon`. */
  glyph?: EmptyGlyphName;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Nút hành động tiếp theo, ví dụ "Tạo nhiệm vụ" hoặc "Xóa bộ lọc". */
  action?: React.ReactNode;
  /**
   * compact: chữ 13px/12px và khoảng cách gọn cho khung trong bảng hoặc panel hẹp.
   * page: trang danh sách trống kiểu Linear (đo linear.app 14/10/2026): khối rộng 340px đặt giữa vùng, chữ căn trái,
   * icon lớn vừa khít nét vẽ, mép trái thẳng mép chữ như Linear; tiêu đề 14px đậm, mô tả 13px; icon, chữ và nút cách nhau 24px;
   * nút `Button size="pill"` cách nhau 8px. Tự giãn lấp phần còn lại của khối cha dạng cột (khối bao gắn `empty-fill`) và đứng
   * giữa, đệm trên 96px từ md để khối hơi thấp hơn giữa như trang Nhiệm vụ; màn thấp (≤ 700px) đệm trên 48px để trang trống có
   * hàng bộ lọc không cuộn ở 1000×600.
   */
  density?: "default" | "compact" | "page";
}

/** Tên cũ của bộ tranh trạng thái trống; từ 20/10/2026 tranh nét mực được thay bằng icon lớn SVG cùng bộ với `glyph`. */
export type IllustrationName = EmptyGlyphName;

/** Trạng thái không có dữ liệu: nói rõ vì sao trống và việc nên làm tiếp. */
export function EmptyState({ icon, illustration, glyph, title, description, action, density = "default", className, ...props }: EmptyStateProps) {
  const art = glyph ?? illustration;
  if (density === "page") {
    return (
      <div data-density={density} className={cn("flex w-full shrink-0 grow items-center justify-center px-6 py-12 md:pt-24 md:[@media(max-height:700px)]:pt-12", className)} {...props}>
        <div className="flex w-full max-w-[340px] flex-col gap-6 text-left">
          {art ? (
            <EmptyGlyph name={art} fit="tight" />
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
      {art ? (
        // Khoảng trống trong khung vẽ đã tạo ~24px tới chữ như Linear (đo khay Hộp thư 20/10/2026), không thêm lề
        <EmptyGlyph name={art} />
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
