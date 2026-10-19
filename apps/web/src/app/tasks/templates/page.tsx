import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { TaskTemplatesManager } from "@/components/tasks/task-templates-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mẫu nhiệm vụ" };

export default async function TaskTemplatesPage() {
  const session = await getWebSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/tasks/templates")}`);

  return <TaskTemplatesManager />;
}
