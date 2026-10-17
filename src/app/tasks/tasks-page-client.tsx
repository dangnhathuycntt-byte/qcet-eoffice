"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isUserExecutive, isUserUnitHead } from "@/domain/tasks/attention-resolver";
import { useWorkspaceQuery } from "@/hooks/use-workspace-query";
import {
  TaskManagementWorkspace,
  type WorkspaceScope,
} from "@/components/tasks/task-management-workspace";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { TaskView } from "@/domain/tasks";

export type { WorkspaceScope, TaskView };

export interface TasksPageClientProps {
  initialTasks?: SchoolTask[];
  initialScope?: WorkspaceScope;
  initialTaskView?: TaskView;
}

// Biến module sống qua các lần điều hướng phía client: true khi danh sách đã từng hiển thị trong phiên này.
let hasShownTaskList = false;

export function TasksPageClient({ initialTasks, initialScope }: TasksPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Quay lại danh sách (back/link) Next dùng bản RSC đã lưu nên thiếu thay đổi vừa làm ở trang chi tiết: tải lại ngầm.
  React.useEffect(() => {
    if (hasShownTaskList) router.refresh();
    hasShownTaskList = true;
  }, [router]);

  const isExec = user ? isUserExecutive(user as any) : false;
  const isHead = user ? isUserUnitHead(user as any) : false;

  const defaultRoleScope: WorkspaceScope = isExec ? "school" : isHead ? "unit" : "my";
  const workspaceQuery = useWorkspaceQuery({
    defaultScope: initialScope || defaultRoleScope,
    canonicalTaskView: true,
  });
  const { queryState, setScope, setTaskView, setDept } = workspaceQuery;

  const activeScope: WorkspaceScope =
    queryState.scope || initialScope || defaultRoleScope;

  const currentDept =
    queryState.dept || queryState.unit || "ALL";

  const onScopeChange = (s: WorkspaceScope | TaskView) => {
    if (s === "related" || s === "unit" || s === "all" || s === "approval") {
      setTaskView(s as TaskView, { shallow: true, replace: true });
    } else {
      setScope(s as WorkspaceScope, { shallow: true, replace: true });
    }
  };

  const handleDepartmentChange = (dept?: string) => {
    const nextDept = dept || "ALL";
    setDept(nextDept !== "ALL" ? nextDept : null, { shallow: true, replace: true });
  };

  // Tải lại qua trang server (cùng nguồn dữ liệu đầy đủ với lần tải đầu: ngày bắt đầu, việc con…);
  // API danh sách chỉ trả DTO rút gọn nên nếu tự fetch thì các cột đó bị trống sau khi lưu trữ/đổi phạm vi.
  const [isRefreshing, startRefresh] = React.useTransition();
  const handleRefresh = React.useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  const handleSelectTask = React.useCallback(
    (task: SchoolTask | StaffTask) => {
      router.push(`/tasks/${task.id}`);
    },
    [router]
  );

  return (
    <TaskManagementWorkspace
      scope={activeScope}
      onScopeChange={onScopeChange}
      selectedDepartment={currentDept}
      onDepartmentChange={handleDepartmentChange}
      onSelectTask={handleSelectTask}
      initialTasks={initialTasks}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      workspaceQuery={workspaceQuery}
      defaultTaskTab="active"
    />
  );
}
