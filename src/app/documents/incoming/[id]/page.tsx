import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildDocumentResource } from "@/server/authorization/available-actions";
import { canReadDocument } from "@/server/policies/document-policy";
import { prisma } from "@/lib/prisma";
import { getIncomingDocument } from "@/lib/services/incoming-document-service";
import { IncomingDocumentDetailView } from "@/components/documents/incoming-document-detail-view";
import type { IncomingDocumentDetail } from "@/components/documents/incoming-document-detail-view";

// Always fetch fresh from DB
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(_: PageParams): Promise<Metadata> {
  return { title: "Chi tiết văn bản đến" };
}

export default async function IncomingDocumentDetailPage({ params }: PageParams) {
  const { id } = await params;

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
    redirect(`/login?returnTo=${encodeURIComponent(`/documents/incoming/${id}`)}`);
  }

  const rawWorkflow = await getIncomingDocument(id, sessionUser);

  if (!rawWorkflow || !rawWorkflow.document) {
    notFound();
  }

  // Nhiệm vụ liên kết: hiển thị hàng nhiệm vụ; `leadUnitId` là đơn vị xử lý văn bản khi xét quyền đọc
  const linkedTask = rawWorkflow.document.linkedTaskId
    ? await prisma.task.findUnique({
        where: { id: rawWorkflow.document.linkedTaskId },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          dueDate: true,
          progressPercent: true,
          leadUnitId: true,
        },
      })
    : null;

  // Check authorization
  const authContext = await loadAuthorizationContext(sessionUser.id);
  const authDocument = { ...rawWorkflow.document, linkedTask };
  const docResource = buildDocumentResource(authDocument);
  const readDecision = authorize(authContext, "document.read", docResource);

  if (!readDecision.allowed || !canReadDocument(authContext, authDocument as any)) {
    notFound();
  }

  const currentUser = {
    id: sessionUser.id,
    name: sessionUser.name,
    role: sessionUser.role,
  };

  // Serialize dates for client component
  const detail: IncomingDocumentDetail = {
    id: rawWorkflow.id,
    documentId: rawWorkflow.documentId,
    status: rawWorkflow.status as string,
    createdAt: rawWorkflow.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: rawWorkflow.updatedAt?.toISOString() ?? null,

    presentedAt: rawWorkflow.presentedAt?.toISOString() ?? null,
    presenterNotes: rawWorkflow.presenterNotes ?? null,
    directedAt: rawWorkflow.directedAt?.toISOString() ?? null,
    leadershipInstruction: rawWorkflow.leadershipInstruction ?? null,
    deadline: rawWorkflow.deadline?.toISOString() ?? null,
    resolvedAt: rawWorkflow.resolvedAt?.toISOString() ?? null,
    resolutionSummary: rawWorkflow.resolutionSummary ?? null,
    resolutionDocUrl: rawWorkflow.resolutionDocUrl ?? null,
    filedAt: rawWorkflow.filedAt?.toISOString() ?? null,
    dossierId: rawWorkflow.dossierId ?? null,
    filingNotes: rawWorkflow.filingNotes ?? null,

    leadUnit: rawWorkflow.leadUnit ?? null,
    leader: rawWorkflow.leader ?? null,

    unitAssignments: rawWorkflow.unitAssignments.map((a) => ({
      id: a.id,
      status: a.status as string,
      instruction: (a as any).instruction ?? null,
      deadline: (a as any).deadline?.toISOString() ?? null,
      createdAt: a.createdAt?.toISOString() ?? null,
      driUser: a.driUser,
      assignedBy: a.assignedBy,
    })),

    directives: ((rawWorkflow as any).directives ?? []).map((d: any) => ({
      id: d.id,
      content: d.content ?? null,
      issuedAt: d.issuedAt?.toISOString() ?? d.createdAt?.toISOString() ?? null,
      leader: d.leader,
    })),

    document: {
      id: rawWorkflow.document.id,
      summary: rawWorkflow.document.summary ?? null,
      category: rawWorkflow.document.category ?? null,
      securityLevel: rawWorkflow.document.securityLevel as string ?? null,
      urgency: rawWorkflow.document.urgency as string ?? null,
      originalNumber: rawWorkflow.document.originalNumber ?? null,
      issuedDate: rawWorkflow.document.issuedDate?.toISOString() ?? null,
      issuingAuthority: rawWorkflow.document.issuingAuthority ?? null,
      registrationNumber: rawWorkflow.document.registrationNumber ?? null,
      receivedDate: (rawWorkflow.document as any).receivedDate?.toISOString() ?? null,
      dueDate: rawWorkflow.document.dueDate?.toISOString() ?? null,
      linkedTaskId: rawWorkflow.document.linkedTaskId ?? null,
      attachments: (rawWorkflow.document as any).attachments?.map((a: any) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize ? Number(a.fileSize) : null,
        mimeType: a.mimeType ?? null,
        isOriginal: a.isOriginal ?? false,
      })) ?? [],
    },
  };

  return <IncomingDocumentDetailView detail={detail} currentUser={currentUser} />;
}
