import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { ApprovalReportView } from "@/components/documents/approval-report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Báo cáo duyệt tờ trình" };

export default async function ApprovalReportPage() {
  const session = await getWebSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/documents/approval-report")}`);

  // Khung thẻ, tiêu đề và mô tả do `ApprovalReportView` dựng (`WorkspacePageCard`)
  return <ApprovalReportView />;
}
