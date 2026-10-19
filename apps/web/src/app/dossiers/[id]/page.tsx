import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { fetchPageData } from "@/lib/server-api";
import { DossierDetailPageDataSchema } from "@qcet/contracts/page-data";
import { DossierDetailView } from "@/components/dossiers/dossier-detail-view";

// Always fetch fresh from API
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(_: PageParams): Promise<Metadata> {
  return { title: "Chi tiết hồ sơ công việc" };
}

export default async function DossierDetailPage({ params }: PageParams) {
  const { id } = await params;

  // API xác thực và kiểm quyền đọc hồ sơ (GET /api/page-data/dossiers/[id]); mọi lỗi đọc khác trả 404 như trước
  const result = await fetchPageData(`/api/page-data/dossiers/${encodeURIComponent(id)}`, DossierDetailPageDataSchema);

  if (!result.ok) {
    if (result.status === 401) {
      redirect(`/login?returnTo=${encodeURIComponent(`/dossiers/${id}`)}`);
    }
    notFound();
  }

  const { dossier, currentUser } = result.data;

  return <DossierDetailView dossier={dossier} currentUser={currentUser} />;
}
