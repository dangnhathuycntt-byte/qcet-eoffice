import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Khung trang một thẻ cho các trang không có danh sách + panel (Mẫu nhiệm vụ, Yêu cầu phối hợp):
 * cùng khung thẻ bo tròn, padding 8px và tiêu đề tách bằng đường kẻ như Sổ văn bản / Task Detail.
 * Giá trị khung trùng `split-workspace.module.css` và `document-registry-view.tsx`.
 * Điện thoại: nền trắng tràn mép, không viền, không bo (như Sổ văn bản), không thẻ lồng trong thẻ.
 */
export function WorkspacePageCard({
  title,
  description,
  actions,
  hideTitleOnMobile = false,
  hideDescriptionOnMobile = false,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** Hành động chính của trang (vd. "Tạo mẫu"), đặt bên phải tiêu đề như thanh công cụ các trang danh sách. */
  actions?: React.ReactNode;
  /** Điện thoại: tên trang đã nằm trên thanh trên cùng (AppTopbar) thì chỉ giữ tiêu đề cho trình đọc màn hình, tránh lặp. */
  hideTitleOnMobile?: boolean;
  /** Điện thoại: ẩn dòng mô tả khi thanh công cụ bên phải đã chiếm gần hết hàng (mô tả bị ép thành cột hẹp từng chữ). */
  hideDescriptionOnMobile?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)] md:pb-0">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-1.5 p-2 max-md:p-0">
        <main
          data-slot="workspace-page-card"
          className="@container flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border-hairline border-border bg-card text-foreground shadow-low max-md:rounded-none max-md:border-0 max-md:shadow-none"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-2.5 sm:px-6">
            <div className="min-w-0">
              <h1 className={cn("truncate text-compact font-semibold text-foreground", hideTitleOnMobile && "max-md:sr-only")}>{title}</h1>
              {description ? <p className={cn("mt-0.5 text-xs text-muted-foreground", hideDescriptionOnMobile && "max-md:hidden")}>{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
            <div className={cn("empty-fill mx-auto w-full max-w-4xl", className)}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
