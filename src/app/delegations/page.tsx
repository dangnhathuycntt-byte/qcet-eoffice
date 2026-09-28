import * as React from "react";
import type { Metadata } from "next";
import { DelegationRegistryView } from "@/components/delegations/delegation-registry-view";

export const metadata: Metadata = {
  title: "Ủy quyền tác nghiệp - QCET E-Office",
  description:
    "Quản lý ủy quyền tác nghiệp, phân quyền thay mặt xử lý công việc - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default function DelegationsPage() {
  return (
    <div className="w-full space-y-4">
      <React.Suspense
        fallback={
          <div className="max-w-[1440px] w-full mx-auto p-6 space-y-4 animate-pulse">
            <div className="h-10 bg-muted/60 rounded-xl w-1/3" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
            </div>
            <div className="h-64 bg-muted/30 rounded-2xl w-full" />
          </div>
        }
      >
        <DelegationRegistryView />
      </React.Suspense>
    </div>
  );
}
