import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { UnitRequestInbox } from "@/components/tasks/unit-request-inbox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Yêu cầu phối hợp" };

export default async function UnitRequestsPage() {
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
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
