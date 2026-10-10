import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildDocumentResource } from "@/server/authorization/available-actions";
import { canReadDocument, canUpdateDocument } from "@/server/policies/document-policy";
import { isDocumentImmutable } from "@/lib/documents/state-machine";
import { getDocumentById } from "@/lib/documents/document-service";
import { getDocumentKind } from "@/lib/documents/document-view-model";
import { GenericDocumentDetailView } from "@/components/documents/workspace/generic-document-detail-view";

// Always fetch fresh from DB
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(_: PageParams): Promise<Metadata> {
  return { title: "Chi tiết văn bản đến" };
}

/**
 * Văn bản đến dùng cùng bộ khung Full Page và các phần thông tin với Quick View (thao tác theo bước,
 * luân chuyển, nhiệm vụ liên kết). Quyền đọc kiểm ở server; không đủ quyền hoặc không phải văn bản đến thì 404.
 */
export default async function IncomingDocumentDetailPage({ params }: PageParams) {
  const { id } = await params;

  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id ? await getSessionFromRequest({ cookies: cookieStore }) : null;
  const userId = authSession?.user?.id ?? jwtSession?.id;
  if (!userId) {
    redirect(`/login?returnTo=${encodeURIComponent(`/documents/incoming/${id}`)}`);
  }

  const [document, authContext] = await Promise.all([getDocumentById(id), loadAuthorizationContext(userId)]);
  if (!document || getDocumentKind(document.type) !== "incoming") notFound();
  const readDecision = authorize(authContext, "document.read", buildDocumentResource(document));
  if (!readDecision.allowed || !canReadDocument(authContext, document)) notFound();

  const canEdit = canUpdateDocument(authContext, document) && !isDocumentImmutable(document);

  // Chuyển về dạng JSON thuần để truyền xuống client component
  return <GenericDocumentDetailView item={JSON.parse(JSON.stringify({ ...document, canEdit }))} />;
}
