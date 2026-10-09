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
import { getDocumentById } from "@/lib/documents/document-service";
import { getDocumentKind, getFullPageHref } from "@/lib/documents/document-view-model";
import { GenericDocumentDetailView } from "@/components/documents/workspace/generic-document-detail-view";

// Luôn đọc mới từ DB
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string | string[] }>;
}

export async function generateMetadata(_: Pick<PageParams, "params">): Promise<Metadata> {
  return { title: "Chi tiết văn bản" };
}

/**
 * Cổng vào chung `/documents/[id]`: văn bản đến/đi chuyển về trang riêng của loại đó (giữ `?file=`),
 * tờ trình hiển thị tại đây. Quyền đọc kiểm ở server; không đủ quyền hoặc không có thì 404 như các trang chi tiết khác.
 */
export default async function DocumentDetailPage({ params, searchParams }: PageParams) {
  const { id } = await params;
  const { file } = await searchParams;

  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id ? await getSessionFromRequest({ cookies: cookieStore }) : null;
  const userId = authSession?.user?.id ?? jwtSession?.id;
  if (!userId) {
    redirect(`/login?returnTo=${encodeURIComponent(`/documents/${id}`)}`);
  }

  const document = await getDocumentById(id);
  if (!document) notFound();

  const authContext = await loadAuthorizationContext(userId);
  const readDecision = authorize(authContext, "document.read", buildDocumentResource(document));
  if (!readDecision.allowed || !canReadDocument(authContext, document)) notFound();

  const kind = getDocumentKind(document.type);
  if (kind !== "submission") {
    redirect(getFullPageHref(kind, id, typeof file === "string" ? file : null));
  }

  // Chuyển về dạng JSON thuần để truyền xuống client component
  return <GenericDocumentDetailView item={JSON.parse(JSON.stringify(document))} />;
}
