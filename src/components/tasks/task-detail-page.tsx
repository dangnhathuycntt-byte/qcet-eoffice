"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useListScrollRestore } from "@/hooks/use-list-scroll-restore";
import { LinearTaskDetailView, type DetailTab } from "@/components/tasks/detail/linear-task-detail-view";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { updateTaskStatus, updateTaskPriority, updateTaskDueDate } from "@/lib/tasks/task-actions";

export interface TaskDetailPageProps {
  task: SchoolTask | StaffTask;
  auditEvents?: Array<{
    id: string;
    action: string;
    timestamp: string;
    actorName?: string;
    description?: string;
  }>;
  currentUser?: any;
}

export function TaskDetailPage({
  task: initialTask,
  auditEvents: initialAuditEvents = [],
  currentUser: serverUser,
}: TaskDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: clientUser } = useAuth();
  const currentUser = clientUser || serverUser;

  const { restoreScrollAndNavigateBack } = useListScrollRestore();

  // State task
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  // Sub-Tabs URL sync (REQ-14)
  const tabParam = searchParams.get("tab");
  const validTab: DetailTab =
    tabParam === "subtasks" || tabParam === "activity" ? tabParam : "overview";

  const [activeTab, setActiveTab] = React.useState<DetailTab>(validTab);
  React.useEffect(() => {
    if (tabParam === "subtasks" || tabParam === "activity" || tabParam === "overview") {
      setActiveTab(tabParam as DetailTab);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: DetailTab) => {
    setActiveTab(newTab);
    try {
      const currentParams = new URLSearchParams(searchParams.toString());
      if (newTab === "overview") {
        currentParams.delete("tab");
      } else {
        currentParams.set("tab", newTab);
      }
      const newQuery = currentParams.toString();
      const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      window.history.replaceState(null, "", targetUrl);
    } catch {
      // Fallback safe
    }
  };

  // Subtask modal state
  const [isCreateSubTaskModalOpen, setIsCreateSubTaskModalOpen] = React.useState(false);

  // Return to task list with preserved scroll & filters (REQ-12)
  const handleBackToList = () => {
    restoreScrollAndNavigateBack("/tasks");
  };

  // Action layer handlers (REQ-20 & REQ-13)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus, note?: string) => {
    const res = await updateTaskStatus(taskId, newStatus, note);
    if (!res.ok) {
      console.error("Lỗi cập nhật trạng thái:", res.error);
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: TaskPriority) => {
    const res = await updateTaskPriority(taskId, newPriority);
    if (!res.ok) {
      console.error("Lỗi cập nhật độ ưu tiên:", res.error);
    }
  };

  const handleDueDateChange = async (taskId: string, newDueDate: string) => {
    const res = await updateTaskDueDate(taskId, newDueDate);
    if (!res.ok) {
      console.error("Lỗi cập nhật hạn hoàn thành:", res.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-3 sm:p-5 lg:p-7 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <LinearTaskDetailView
          task={task}
          onBack={handleBackToList}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onDueDateChange={handleDueDateChange}
          onAddSubTask={() => setIsCreateSubTaskModalOpen(true)}
          currentUser={currentUser}
          auditEvents={initialAuditEvents}
          initialTab={activeTab}
          onTabChange={handleTabChange}
          onRefresh={() => router.refresh()}
        />
      </div>

      {/* Modal Add SubTask */}
      <CreateTaskModal
        isOpen={isCreateSubTaskModalOpen}
        onClose={() => setIsCreateSubTaskModalOpen(false)}
        initialParentTaskId={task.id}
        initialParentTaskTitle={task.title}
        initialLevel="DON_VI"
        onSubmitSuccess={() => {
          setIsCreateSubTaskModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
