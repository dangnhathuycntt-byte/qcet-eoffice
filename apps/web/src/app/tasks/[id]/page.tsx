import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { fetchPageData } from "@/lib/server-api";
import { TaskDetailPageDataSchema } from "@qcet/contracts/page-data";
import { TaskDetailPage } from "@/components/tasks/task-detail-page";

// Always fetch fresh from DB — task detail contains user-edited content
export const dynamic = "force-dynamic";

interface TaskDetailPageParams {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: TaskDetailPageParams): Promise<Metadata> {
  await params;
  // Do not query protected task data from metadata before authentication and
  // object-level authorization have run in the page request.
  return { title: "Chi tiết nhiệm vụ" };
}

export default async function Page({ params, searchParams }: TaskDetailPageParams) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  // Resolve searchParams — preserve full query string for login returnTo
  const resolvedSearchParams = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([k, v]) =>
      v === undefined ? [] : Array.isArray(v) ? v.map((val) => [k, val]) : [[k, v]]
    )
  ).toString();

  // Kiểm quyền nhiệm vụ, nhiệm vụ cha và việc con ở API (GET /api/page-data/tasks/[id]); query của trang chuyển nguyên
  const result = await fetchPageData(
    `/api/page-data/tasks/${encodeURIComponent(id)}${queryString ? `?${queryString}` : ""}`,
    TaskDetailPageDataSchema,
  );
  if (!result.ok) {
    if (result.status === 401) {
      const returnPath = queryString ? `/tasks/${id}?${queryString}` : `/tasks/${id}`;
      redirect(`/login?returnTo=${encodeURIComponent(returnPath)}`);
    }
    if (result.status === 404) {
      notFound();
    }
    throw new Error(`GET /api/page-data/tasks/[id] trả ${result.status}`);
  }

  if (result.data.outcome === "redirect") {
    redirect(result.data.redirectTo);
  }

  const { task, auditEvents, currentUser, canEdit, peekTasks, blocks } = result.data;

  return (
    <TaskDetailPage
      task={task}
      auditEvents={auditEvents}
      currentUser={currentUser}
      canEdit={canEdit}
      peekTasks={peekTasks}
      blocks={blocks}
    />
  );
}
