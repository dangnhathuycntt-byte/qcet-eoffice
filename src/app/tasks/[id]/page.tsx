import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from "@/lib/adapters/task-db-adapter";
import { TaskDetailPage } from "@/components/tasks/task-detail-page";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

interface TaskDetailPageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TaskDetailPageParams): Promise<Metadata> {
  const { id } = await params;
  if (!id) {
    return { title: "Chi tiết nhiệm vụ | QCET E-Office" };
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: { code: true, title: true },
  });

  if (!task) {
    return { title: "Không tìm thấy nhiệm vụ | QCET E-Office" };
  }

  const taskCodePrefix = task.code ? `${task.code} - ` : "";
  return {
    title: `${taskCodePrefix}${task.title} | QCET E-Office`,
  };
}

export default async function Page({ params }: TaskDetailPageParams) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });

  const currentUser =
    session && session.id
      ? {
          id: session.id,
          name: session.name || "Người dùng",
          role: session.role || "STAFF",
          email: session.email || "",
          department: session.departmentId || "",
        }
      : null;

  // Fetch full task entity with all related data
  const rawTask = await prisma.task.findUnique({
    where: { id },
    include: {
      department: true,
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      },
      deliverables: {
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      resolutions: {
        include: {
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      parentTask: {
        select: { id: true, code: true, title: true, scope: true },
      },
      subTasks: {
        where: {
          status: { not: "CANCELLED" },
        },
        include: {
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          deliverables: true,
        },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!rawTask) {
    notFound();
  }

  // Format task according to scope
  const isSchoolScope = rawTask.scope === "SCHOOL";
  const mappedTask = (
    isSchoolScope
      ? mapPrismaTaskToSchoolTask(rawTask)
      : mapPrismaTaskToStaffTask(rawTask)
  ) as unknown as SchoolTask | StaffTask;

  // Extract audit events from resolutions
  const auditEvents = (rawTask.resolutions || []).map((res: any) => ({
    id: res.id,
    action: res.resolutionType || "Điều hành",
    timestamp: res.createdAt ? res.createdAt.toISOString() : new Date().toISOString(),
    actorName: res.actor?.name || "Người điều hành",
    description: res.directiveNote || undefined,
  }));

  return (
    <TaskDetailPage
      task={mappedTask}
      auditEvents={auditEvents}
      currentUser={currentUser}
    />
  );
}
