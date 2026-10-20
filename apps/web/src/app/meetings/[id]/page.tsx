import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { fetchPageData } from "@/lib/server-api";
import { MeetingDetailPageDataSchema } from "@qcet/contracts/page-data";

import { MeetingDetailView } from "@/components/meetings/meeting-detail-view";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

// Không đọc dữ liệu cuộc họp ở metadata: bước này chạy trước xác thực và kiểm quyền theo đối tượng.
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Cuộc họp" };
}

/* ------------------------------------------------------------------ */
/*  Page (server component – Pattern A)                                */
/* ------------------------------------------------------------------ */

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params;

  /* Fetch: API xác thực và kiểm meeting.read; không có quyền -> 404 -> notFound() */
  const result = await fetchPageData(`/api/page-data/meetings/${encodeURIComponent(id)}`, MeetingDetailPageDataSchema);

  if (!result.ok) {
    if (result.status === 401) {
      redirect(`/login?returnTo=${encodeURIComponent(`/meetings/${id}`)}`);
    }
    if (result.status === 404) notFound();
    throw new Error(`GET /api/page-data/meetings/[id] trả ${result.status}`);
  }

  const { meeting: serialized, currentUser } = result.data;

  return <MeetingDetailView meeting={serialized} currentUser={currentUser} />;
}
