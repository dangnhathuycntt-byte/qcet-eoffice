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

  return <TaskTemplatesManager />;
}
