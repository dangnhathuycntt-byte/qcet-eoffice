import * as React from "react";
import type { Metadata } from "next";
import { DocumentRegistryView } from "@/components/documents/document-registry-view";

export const metadata: Metadata = {
  title: "Văn bản & Quản lý Công văn - QCET E-Office",
  description:
    "Sổ quản lý văn bản, công văn đi - đến, tờ trình duyệt và liên thông nhiệm vụ Nghị định 30/2020/NĐ-CP - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default function DocumentsPage() {
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
        <DocumentRegistryView />
      </React.Suspense>
    </div>
  );
}
