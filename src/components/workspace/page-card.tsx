import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Khung trang một thẻ cho các trang không có danh sách + panel (Mẫu nhiệm vụ, Yêu cầu phối hợp):
 * cùng khung thẻ bo tròn, padding 8px và tiêu đề tách bằng đường kẻ như Sổ văn bản / Task Detail.
 * Giá trị khung trùng `split-workspace.module.css` và `document-registry-view.tsx`.
 */
export function WorkspacePageCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-1.5 p-2">
        <main
          data-slot="workspace-page-card"
          className="@container flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground"
        >
          <header className="shrink-0 border-b border-border/60 px-4 pb-2 pt-2.5 sm:px-6">
            <h1 className="truncate text-compact font-semibold text-foreground">{title}</h1>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className={cn("mx-auto w-full max-w-4xl", className)}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
