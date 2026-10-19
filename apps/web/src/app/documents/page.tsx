import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRuntimeConfig, getWebSession } from "@/lib/server-api";
import { DocumentRegistryView } from "@/components/documents/document-registry-view";
import { DocumentRegistrySkeleton } from "@/components/documents/registry/document-ledger-skeleton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Văn bản & Quản lý Công văn - QCET E-Office",
  description:
    "Sổ quản lý văn bản, công văn đi - đến, tờ trình duyệt và liên thông nhiệm vụ Nghị định 30/2020/NĐ-CP - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default async function DocumentsPage() {
  const session = await getWebSession();

  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent("/documents")}`);
  }

  const runtimeConfig = await getRuntimeConfig();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <React.Suspense
        fallback={<DocumentRegistrySkeleton />}
      >
        {/* Soạn văn bản đi còn theo cờ triển khai: cờ tắt thì sổ Văn bản đi không có nút soạn */}
        <DocumentRegistryView canComposeOutgoing={runtimeConfig?.features.outgoingDocuments ?? false} />
      </React.Suspense>
    </div>
  );
}
