import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { readMeetingDetailPageData, readMeetingTitle } from "@/server/services/meeting-detail-page-data";

import { MeetingDetailView } from "@/components/meetings/meeting-detail-view";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const title = await readMeetingTitle(id);

  return { title: title ?? "Cuộc họp" };
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

  /* Fetch -------------------------------------------------------------- */
  const serialized = await readMeetingDetailPageData(id);

  if (!serialized) notFound();

  return <MeetingDetailView meeting={serialized} currentUser={currentUser} />;
}
