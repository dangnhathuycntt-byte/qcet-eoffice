import * as React from "react";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Cùng khung một thẻ với `OrgDirectoryView` để trang không nhảy bố cục khi tải xong. */
export default function OrgLoading() {
  return (
    <WorkspacePageCard title="Cơ cấu & Danh bạ" description="Đơn vị và cán bộ, giảng viên toàn trường" hideTitleOnMobile hideDescriptionOnMobile className="max-w-none">
      <div aria-busy aria-label="Đang tải cơ cấu và danh bạ" className="flex flex-col gap-3 pb-6">
        <Skeleton pulse className="h-7 w-44" />
        <Skeleton pulse className="h-8 w-full" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} pulse className="h-12 w-full" />
        ))}
      </div>
    </WorkspacePageCard>
  );
}
