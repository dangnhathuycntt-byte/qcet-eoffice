import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import prisma from "@/lib/prisma";

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
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { title: true },
  });

  return { title: meeting?.title ?? "Cuộc họp" };
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
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      unit: { select: { name: true, code: true } },
      organizer: { select: { name: true, email: true } },
      participants: {
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { role: "asc" },
      },
      resolutions: {
        include: {
          leadUnit: { select: { name: true } },
          leadUser: { select: { name: true } },
        },
        orderBy: { code: "asc" },
      },
    },
  });

  if (!meeting) notFound();

  /* Serialize ---------------------------------------------------------- */
  const serialized = {
    ...meeting,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime?.toISOString() ?? null,
    minutesConfirmedAt: meeting.minutesConfirmedAt?.toISOString() ?? null,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    participants: meeting.participants.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    resolutions: meeting.resolutions.map((r) => ({
      ...r,
      deadline: r.deadline?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };

  return <MeetingDetailView meeting={serialized} currentUser={currentUser} />;
}
