import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { UnitRequestInbox } from "@/components/tasks/unit-request-inbox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Yêu cầu phối hợp" };

export default async function UnitRequestsPage() {
  const session = await getWebSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/tasks/unit-requests")}`);

  return (
    <WorkspacePageCard
      title="Yêu cầu phối hợp từ đơn vị khác"
      description="Cử người của đơn vị mình làm người phối hợp hoặc từ chối kèm lý do. Chỉ trưởng đơn vị được yêu cầu mới trả lời."
      className="max-w-3xl"
    >
      <UnitRequestInbox />
    </WorkspacePageCard>
  );
}
