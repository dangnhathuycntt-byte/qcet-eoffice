import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { DossierService } from "@/lib/services/dossier-service";
import { DossierDetailView } from "@/components/dossiers/dossier-detail-view";
import type { SerializedDossierDetail } from "@/components/dossiers/dossier-detail-view";

// Always fetch fresh from DB
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(_: PageParams): Promise<Metadata> {
  return { title: "Chi tiết hồ sơ công việc" };
}

export default async function DossierDetailPage({ params }: PageParams) {
  const { id } = await params;

  // Dual-path auth: NextAuth session or JWT fallback
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const sessionUser = authSession?.user?.id
    ? {
        id: authSession.user.id,
        name: authSession.user.name || "Người dùng",
        role: (authSession.user as any).role || "STAFF",
        email: authSession.user.email || "",
        departmentId: (authSession.user as any).departmentId || null,
      }
    : jwtSession
    ? {
        id: jwtSession.id,
        name: jwtSession.name || "Người dùng",
        role: jwtSession.role || "STAFF",
        email: jwtSession.email || "",
        departmentId: jwtSession.departmentId || null,
      }
    : null;

  if (!sessionUser || !sessionUser.id) {
    redirect(`/login?returnTo=${encodeURIComponent(`/dossiers/${id}`)}`);
  }

  let rawDossier;
  try {
    // DossierService.getDossierDetail handles authorization internally (canReadDossier)
    rawDossier = await DossierService.getDossierDetail(sessionUser, id);
  } catch {
    notFound();
  }

  if (!rawDossier) {
    notFound();
  }

  const currentUser = {
    id: sessionUser.id,
    name: sessionUser.name,
    role: sessionUser.role,
  };

  // Serialize dates for client component
  const dossier: SerializedDossierDetail = {
    id: rawDossier.id,
    code: rawDossier.code,
    title: rawDossier.title,
    status: rawDossier.status,
    classification: rawDossier.classification,
    storageLocation: rawDossier.storageLocation,
    notes: rawDossier.notes,
    openedAt: rawDossier.openedAt?.toISOString() ?? new Date().toISOString(),
    closedAt: rawDossier.closedAt?.toISOString() ?? null,
    submittedArchiveAt: (rawDossier as any).submittedArchiveAt?.toISOString() ?? null,
    archivedAt: rawDossier.archivedAt?.toISOString() ?? null,
    createdAt: rawDossier.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: rawDossier.updatedAt?.toISOString() ?? null,

    owningUnit: rawDossier.owningUnit,
    responsiblePerson: rawDossier.responsiblePerson,
    archivedBy: rawDossier.archivedBy ?? null,

    retentionRule: rawDossier.retentionRule
      ? {
          id: rawDossier.retentionRule.id,
          code: rawDossier.retentionRule.code,
          name: rawDossier.retentionRule.name,
          durationYears: rawDossier.retentionRule.durationYears,
        }
      : null,

    items: (rawDossier.items ?? []).map((item) => ({
      id: item.id,
      itemType: item.itemType,
      itemId: item.itemId,
      title: item.title,
      documentNumber: item.documentNumber,
      documentDate: (item.documentDate as Date | null)?.toISOString() ?? null,
      pageCount: item.pageCount,
      sequence: item.sequence,
      notes: item.notes,
      addedAt: (item.addedAt as Date)?.toISOString() ?? null,
      addedBy: item.addedBy ? { id: item.addedBy.id, name: item.addedBy.name } : null,
    })),

    itemCount: rawDossier._count?.items ?? rawDossier.items?.length ?? 0,
  };

  return <DossierDetailView dossier={dossier} currentUser={currentUser} />;
}
