import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildDocumentResource } from "@/server/authorization/available-actions";
import { canReadDocument } from "@/server/policies/document-policy";
import { OutgoingDocumentDetailView } from "@/components/documents/outgoing-document-detail-view";
import type { OutgoingWorkflowDetail } from "@/components/documents/outgoing-document-detail-view";

// Always fetch fresh from DB
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(_: PageParams): Promise<Metadata> {
  return { title: "Chi tiết văn bản đi" };
}

export default async function OutgoingDocumentDetailPage({ params }: PageParams) {
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
    redirect(`/login?returnTo=${encodeURIComponent(`/documents/outgoing/${id}`)}`);
  }

  const rawWorkflow = await prisma.documentOutgoingWorkflow.findFirst({
    where: { documentId: id },
    include: {
      document: {
        include: {
          attachments: true,
          signatures: { orderBy: { signedAt: "asc" } },
        },
      },
      contentReviewer: { select: { id: true, name: true } },
      formatReviewer: { select: { id: true, name: true } },
      authorizedSigner: { select: { id: true, name: true } },
      numberer: { select: { id: true, name: true } },
      orgSigner: { select: { id: true, name: true } },
      issuer: { select: { id: true, name: true } },
    },
  });

  if (!rawWorkflow || !rawWorkflow.document) {
    notFound();
  }

  // Check authorization (department / role / confidentiality)
  const authContext = await loadAuthorizationContext(sessionUser.id);
  const docResource = buildDocumentResource(rawWorkflow.document);
  const readDecision = authorize(authContext, "document.read", docResource);

  if (!readDecision.allowed || !canReadDocument(authContext, rawWorkflow.document as any)) {
    notFound();
  }

  const currentUser = {
    id: sessionUser.id,
    name: sessionUser.name,
    role: sessionUser.role,
  };

  // Serialize dates and BigInt for client component
  const workflow: OutgoingWorkflowDetail = {
    id: rawWorkflow.id,
    documentId: rawWorkflow.documentId,
    status: rawWorkflow.status,
    currentVersion: rawWorkflow.currentVersion,
    outgoingNumberStr: rawWorkflow.outgoingNumberStr,
    recipientList: rawWorkflow.recipientList,
    createdAt: rawWorkflow.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: rawWorkflow.updatedAt?.toISOString() ?? null,

    contentReviewSubmittedAt: rawWorkflow.contentReviewSubmittedAt?.toISOString() ?? null,
    contentApprovedAt: rawWorkflow.contentApprovedAt?.toISOString() ?? null,
    contentReviewNotes: rawWorkflow.contentReviewNotes,
    formatReviewSubmittedAt: rawWorkflow.formatReviewSubmittedAt?.toISOString() ?? null,
    formatApprovedAt: rawWorkflow.formatApprovedAt?.toISOString() ?? null,
    formatReviewNotes: rawWorkflow.formatReviewNotes,
    authorizedSignedAt: rawWorkflow.authorizedSignedAt?.toISOString() ?? null,
    signingNotes: rawWorkflow.signingNotes,
    numberedAt: rawWorkflow.numberedAt?.toISOString() ?? null,
    orgSignedAt: rawWorkflow.orgSignedAt?.toISOString() ?? null,
    issuedAt: rawWorkflow.issuedAt?.toISOString() ?? null,

    contentReviewer: rawWorkflow.contentReviewer,
    formatReviewer: rawWorkflow.formatReviewer,
    authorizedSigner: rawWorkflow.authorizedSigner,
    numberer: rawWorkflow.numberer,
    orgSigner: rawWorkflow.orgSigner,
    issuer: rawWorkflow.issuer,

    document: {
      id: rawWorkflow.document.id,
      summary: rawWorkflow.document.summary,
      category: rawWorkflow.document.category,
      securityLevel: rawWorkflow.document.securityLevel,
      urgency: rawWorkflow.document.urgency,
      originalNumber: rawWorkflow.document.originalNumber,
      issuedDate: rawWorkflow.document.issuedDate?.toISOString() ?? null,
      attachments: rawWorkflow.document.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize ? Number(a.fileSize) : null,
        mimeType: a.mimeType,
        isOriginal: a.isOriginal,
      })),
    },
  };

  return <OutgoingDocumentDetailView workflow={workflow} currentUser={currentUser} />;
}
