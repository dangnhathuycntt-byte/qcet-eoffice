import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { readMeetingDetailPageData } from "@/server/services/meeting-detail-page-data";

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

  /* Auth --------------------------------------------------------------- */
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;

  if (!userId) {
    redirect(`/login?returnTo=${encodeURIComponent(`/calendar/meetings/${id}`)}`);
  }

  const currentUser = {
    id: userId,
    name: authSession?.user?.name ?? jwtSession?.name ?? "Người dùng",
    role: (authSession?.user as any)?.role ?? jwtSession?.role ?? "CHUYEN_VIEN",
  };

  /* Fetch (kiểm meeting.read; không có quyền -> null -> notFound()) ------- */
  const serialized = await readMeetingDetailPageData(id, userId);

  if (!serialized) notFound();

  return <MeetingDetailView meeting={serialized} currentUser={currentUser} />;
}
