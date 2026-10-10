import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { TaskTemplatesManager } from "@/components/tasks/task-templates-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mẫu nhiệm vụ" };

export default async function TaskTemplatesPage() {
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/tasks/templates")}`);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-base font-semibold text-foreground">Mẫu nhiệm vụ và nhiệm vụ lặp lại</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Tạo mẫu cho việc định kỳ, gắn người thực hiện và chu kỳ theo tháng; hệ thống tự tạo nhiệm vụ của tháng. Dành cho trưởng đơn vị và lãnh đạo.
      </p>
      <TaskTemplatesManager className="mt-4" />
    </main>
  );
}
