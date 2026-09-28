import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { isFeatureEnabled } from "@/features/flags";
import { prisma } from "@/lib/prisma";
import { ComposeOutgoingDocumentForm } from "@/components/documents/compose-outgoing-document-form";

// Always fetch fresh from DB
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Soạn văn bản đi - QCET E-Office" };
}

export default async function ComposeOutgoingDocumentPage() {
  // Feature flag gate — redirect when outgoing documents are not yet enabled
  if (!isFeatureEnabled("outgoingDocuments")) {
    redirect("/documents");
  }

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
    redirect("/login?returnTo=/documents/outgoing/compose");
  }

  // Fetch lookup data for the compose form
  const [departments, signers] = await Promise.all([
    prisma.organizationalUnit.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "BAN_GIAM_HIEU"] } },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const currentUser = {
    id: sessionUser.id,
    name: sessionUser.name,
    role: sessionUser.role,
    email: sessionUser.email,
    departmentId: sessionUser.departmentId,
  };

  return (
    <ComposeOutgoingDocumentForm
      departments={departments}
      signers={signers}
      currentUser={currentUser}
    />
  );
}
