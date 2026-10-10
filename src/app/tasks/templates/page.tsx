import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { TaskTemplatesManager } from "@/components/tasks/task-templates-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mẫu nhiệm vụ" };

export default async function TaskTemplatesPage() {
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/tasks/templates")}`);

  return (
    <WorkspacePageCard
      title="Mẫu nhiệm vụ và nhiệm vụ lặp lại"
      description="Tạo mẫu cho việc định kỳ, gắn người thực hiện và chu kỳ theo tháng; hệ thống tự tạo nhiệm vụ của tháng. Dành cho trưởng đơn vị và lãnh đạo."
    >
      <TaskTemplatesManager />
    </WorkspacePageCard>
  );
}
