import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { ApprovalReportView } from "@/components/documents/approval-report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Báo cáo duyệt tờ trình" };

export default async function ApprovalReportPage() {
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/documents/approval-report")}`);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-base font-semibold text-foreground">Báo cáo thời gian duyệt tờ trình</h1>
      <p className="mt-1 text-xs text-muted-foreground">Lãnh đạo xem toàn bộ, trưởng đơn vị xem bước của đơn vị mình phụ trách.</p>
      <ApprovalReportView className="mt-4" />
    </main>
  );
}
