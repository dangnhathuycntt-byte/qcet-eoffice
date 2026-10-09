import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { DocumentRegistryView } from "@/components/documents/document-registry-view";
import { DocumentRegistrySkeleton } from "@/components/documents/registry/document-ledger-skeleton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Văn bản & Quản lý Công văn - QCET E-Office",
  description:
    "Sổ quản lý văn bản, công văn đi - đến, tờ trình duyệt và liên thông nhiệm vụ Nghị định 30/2020/NĐ-CP - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default async function DocumentsPage() {
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;

  if (!userId) {
    redirect(`/login?returnTo=${encodeURIComponent("/documents")}`);
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <React.Suspense
        fallback={<DocumentRegistrySkeleton />}
      >
        <DocumentRegistryView />
      </React.Suspense>
    </div>
  );
}
