"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskStatus,
} from "@/types/dashboard";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "@/lib/dashboard-aggregator";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { CATEGORY_TABS } from "@/components/tasks/cascading-task-table";
import type { DelegationRule } from "@/types/delegation";
import type { AuthUser } from "@/types/auth";
import { isOnline, enqueueOfflineMutation } from "@/lib/offline-sync";
import { getSystemReferenceDateStr } from "@/lib/unified-task-hub";
import { createLatestRequestGuard } from "@/lib/latest-request-guard";

export const EMPTY_DASHBOARD_PAYLOAD: DashboardPayload = {
  stats: {
    totalSchoolTasks: 0,
    schoolTasksInProgress: 0,
    schoolTasksCompleted: 0,
    totalStaffTasks: 0,
    staffTasksInProgress: 0,
    staffTasksCompleted: 0,
    needsReviewTasksCount: 0,
    overdueTasksCount: 0,
    averageSchoolProgressPercent: 0,
    totalTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    pendingApprovals: 0,
    completionRate: 0,
  },
  tasks: [],
  upcoming: [],
  activities: [],
  source: "database",
  departmentHealth: [],
  syncTimestamp: "",
};

const INITIAL_QCET_DELEGATIONS: DelegationRule[] = [
  {
    id: "del-cntt-001",
    grantorId: "staff-vinh-nn",
    grantorName: "TS. Nguyễn Ngọc Vinh",
    grantorRole: "MANAGER",
    granteeId: "staff-pho-lv",
    granteeName: "ThS. Lê Văn Phó",
    granteeRole: "STAFF",
    departmentCode: "K_CNTT",
    scope: "DACUM_REVIEW_STEP1",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    status: "ACTIVE",
    reason: "Ủy quyền thẩm định và phê duyệt hồ sơ DACUM bước 1 trong thời gian Trưởng khoa công tác.",
    createdAt: "2026-09-01T08:00:00.000Z",
  },
];

export interface TaskMutationsReturn {
  dashboardData: DashboardPayload;
  isLoading: boolean;
  errorMessage: string | null;
  error?: string | null;
  isRefreshing: boolean;
  delegations: DelegationRule[];
  delegationDeptCode: string;
  handleStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void>;
  handleSubmitDeliverable: (payload: DeliverableSubmissionPayload) => Promise<void>;
  handleReviewAction: (payload: ApprovalActionPayload) => Promise<void>;
  handleCreateTask: (data: CreateTaskFormData) => void;
  handleManualRefresh: () => Promise<void>;
  handleSaveDelegation: (ruleData: Omit<DelegationRule, "id" | "createdAt">) => void;
  handleRevokeDelegation: (ruleId: string) => void;
}

export function useTaskMutations(
  user?: AuthUser | null,
  onOpenCreateModal?: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void,
  initialData?: DashboardPayload
): TaskMutationsReturn {
  const hasInitialData = Boolean(initialData && initialData.tasks && initialData.stats);
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(
    hasInitialData ? (initialData as DashboardPayload) : EMPTY_DASHBOARD_PAYLOAD
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(!hasInitialData);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [delegations, setDelegations] = React.useState<DelegationRule[]>(INITIAL_QCET_DELEGATIONS);
  const [delegationDeptCode] = React.useState("K_CNTT");

  // Latest-request-wins guard: a slow earlier fetch must not overwrite a newer
  // one (plan T03.6). One guard instance per hook, shared by every overview fetch.
  const overviewRequestGuard = React.useRef(createLatestRequestGuard());

  // Initial background sync: Skip when server-provided initial data is present
  React.useEffect(() => {
    if (hasInitialData) {
      return;
    }
    let isMounted = true;
    async function syncDashboardOverview() {
      const requestToken = overviewRequestGuard.current.begin();
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/dashboard/overview");
        if (isMounted && !overviewRequestGuard.current.isCurrent(requestToken)) {
          return; // a newer request has started; this response is stale
        }
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData && liveData.tasks && liveData.stats) {
            setDashboardData(liveData);
          }
        } else if (!response.ok && isMounted) {
          const errData = await response.json().catch(() => null);
          setErrorMessage(errData?.error || "Không thể tải dữ liệu dashboard từ máy chủ");
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || "Lỗi mạng khi tải dữ liệu dashboard");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    syncDashboardOverview();
    return () => {
      isMounted = false;
    };
  }, [hasInitialData]);

  const handleManualRefresh = React.useCallback(async () => {
    const requestToken = overviewRequestGuard.current.begin();
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (!overviewRequestGuard.current.isCurrent(requestToken)) {
        return; // a newer request has started; this response is stale
      }
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData && liveData.tasks && liveData.stats) {
          setDashboardData(liveData);
        }
      } else {
        const errData = await response.json().catch(() => null);
        setErrorMessage(errData?.error || "Làm mới dữ liệu thất bại");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi kết nối khi làm mới dữ liệu");
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, []);

  const handleStatusChange = React.useCallback(
    async (taskId: string, newStatus: TaskStatus, note?: string) => {
      const previousData = dashboardData;
      setErrorMessage(null);

      // Optimistic state update
      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === taskId) {
            const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
              newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
            return { ...st, status: schoolStatus };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
            sub.id === taskId ? { ...sub, status: newStatus } : sub
          );
          return { ...st, subTasks: updatedSubs };
        });
        const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUpTasks,
          stats: computeDashboardStats(rolledUpTasks),
        };
      });

      // Determine canonical domain action endpoint and payload
      let actionUrl = `/api/tasks/${taskId}/actions/update-progress`;
      let actionBody: any = { note };
      const actionDesc = `Cập nhật nhiệm vụ ${taskId} (${newStatus})`;

      if (newStatus === "IN_PROGRESS") {
        actionUrl = `/api/tasks/${taskId}/actions/start`;
        actionBody = { note };
      } else if (newStatus === "COMPLETED") {
        actionUrl = `/api/tasks/${taskId}/actions/submit-result`;
        actionBody = { note: note || "Hoàn thành nhiệm vụ", completionRate: 100 };
      } else if (newStatus === "CANCELLED") {
        actionUrl = `/api/tasks/${taskId}/actions/cancel`;
        actionBody = { reason: note || "Hủy nhiệm vụ" };
      } else if (newStatus === "NEEDS_REVIEW" || newStatus === "WAITING_APPROVAL") {
        actionUrl = `/api/tasks/${taskId}/actions/submit-result`;
        actionBody = { note: note || "Nộp kết quả chờ phê duyệt" };
      }

      // API call or offline enqueue
      if (!isOnline()) {
        enqueueOfflineMutation({
          url: actionUrl,
          method: "POST",
          body: actionBody,
          description: actionDesc,
        });
        setErrorMessage("Đang ngoại tuyến. Thay đổi đã được lưu tạm và sẽ tự động gửi khi có mạng.");
        return;
      }

      try {
        const res = await fetch(actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actionBody),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setDashboardData(previousData);
          setErrorMessage(errData?.error || "Cập nhật trạng thái nhiệm vụ thất bại. Đã khôi phục dữ liệu.");
        }
      } catch (err: any) {
        // Network drop during request: enqueue mutation and preserve optimistic state
        enqueueOfflineMutation({
          url: actionUrl,
          method: "POST",
          body: actionBody,
          description: actionDesc,
        });
        setErrorMessage("Mất kết nối mạng. Thao tác đã được lưu tạm và sẽ tự động gửi khi có kết nối.");
      }
    },
    [dashboardData]
  );

  const handleSubmitDeliverable = React.useCallback(
    async (payload: DeliverableSubmissionPayload) => {
      const previousData = dashboardData;
      setErrorMessage(null);
      const todayStr = getSystemReferenceDateStr();

      // Optimistic state update
      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === payload.taskId) {
            return {
              ...st,
              status: "PENDING_EXECUTIVE_APPROVAL" as const,
              completionReport: {
                summary:
                  payload.note ||
                  payload.deliverableName ||
                  "Nộp minh chứng hoàn thành nhiệm vụ cấp trường",
                submittedBy: user?.name || "Cán bộ chủ trì",
                submittedAt: todayStr,
                reportUrl: payload.url,
              },
            };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) => {
            if (sub.id === payload.taskId) {
              const existingDeliverables = sub.deliverables || [];
              const newFile = {
                id: `deliv-${Date.now()}`,
                name: payload.deliverableName || "Tài liệu minh chứng",
                url: payload.url || "#",
                fileType: payload.fileType || "application/pdf",
                submittedAt: todayStr,
              };
              return {
                ...sub,
                status: "NEEDS_REVIEW" as const,
                deliverables: [...existingDeliverables, newFile],
                deliverableDescription: payload.note || sub.deliverableDescription,
                updatedAt: todayStr,
              };
            }
            return sub;
          });
          return { ...st, subTasks: updatedSubs };
        });

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });

      // API call or offline enqueue
      if (!isOnline()) {
        enqueueOfflineMutation({
          url: `/api/tasks/${payload.taskId}/deliverables`,
          method: "POST",
          body: {
            title: payload.deliverableName || "Tài liệu minh chứng",
            fileUrl: payload.url || "#",
            fileType: payload.fileType || "LINK",
            uploadedById: user?.id,
          },
          description: `Nộp minh chứng nhiệm vụ ${payload.taskId}`,
        });
        setErrorMessage("Đang ngoại tuyến. Minh chứng đã được lưu tạm và sẽ tự động gửi khi có mạng.");
        return;
      }

      try {
        const res = await fetch(`/api/tasks/${payload.taskId}/deliverables`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.deliverableName || "Tài liệu minh chứng",
            fileUrl: payload.url || "#",
            fileType: payload.fileType || "LINK",
            uploadedById: user?.id,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setDashboardData(previousData);
          setErrorMessage(errData?.error || "Nộp minh chứng thất bại. Đã khôi phục dữ liệu.");
        }
      } catch (err: any) {
        // Network drop: enqueue mutation and preserve optimistic state
        enqueueOfflineMutation({
          url: `/api/tasks/${payload.taskId}/deliverables`,
          method: "POST",
          body: {
            title: payload.deliverableName || "Tài liệu minh chứng",
            fileUrl: payload.url || "#",
            fileType: payload.fileType || "LINK",
            uploadedById: user?.id,
          },
          description: `Nộp minh chứng nhiệm vụ ${payload.taskId}`,
        });
        setErrorMessage("Mất kết nối mạng. Minh chứng đã được lưu tạm và sẽ tự động nộp khi có mạng.");
      }
    },
    [dashboardData, user?.id, user?.name]
  );

  const handleReviewAction = React.useCallback(
    async (payload: ApprovalActionPayload) => {
      const previousData = dashboardData;
      setErrorMessage(null);
      const todayStr = getSystemReferenceDateStr();
      let statusToSet: TaskStatus = "IN_PROGRESS";
      if (payload.decision === "approved") {
        statusToSet = "COMPLETED";
      } else if (payload.decision === "revision_requested") {
        statusToSet = "IN_PROGRESS";
      } else if (payload.decision === "rejected") {
        statusToSet = "BLOCKED";
      }

      // Optimistic state update
      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === payload.taskId) {
            const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
              payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
            return {
              ...st,
              status: schoolStatus,
            };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) => {
            if (sub.id === payload.taskId) {
              return {
                ...sub,
                status: statusToSet,
                updatedAt: todayStr,
                rejectionReason:
                  payload.decision !== "approved" ? payload.comment : undefined,
              };
            }
            return sub;
          });
          return { ...st, subTasks: updatedSubs };
        });

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });

      let actionUrl = `/api/tasks/${payload.taskId}/actions/approve`;
      let actionBody: any = { note: payload.comment };
      let actionDesc = `Phê duyệt nhiệm vụ ${payload.taskId}`;

      if (payload.decision === "approved") {
        actionUrl = `/api/tasks/${payload.taskId}/actions/approve`;
        actionBody = { note: payload.comment };
        actionDesc = `Phê duyệt nhiệm vụ ${payload.taskId}`;
      } else if (payload.decision === "revision_requested") {
        actionUrl = `/api/tasks/${payload.taskId}/actions/request-revision`;
        actionBody = { feedback: payload.comment || "Yêu cầu chỉnh sửa", revisionRequired: true };
        actionDesc = `Yêu cầu chỉnh sửa nhiệm vụ ${payload.taskId}`;
      } else if (payload.decision === "rejected") {
        actionUrl = `/api/tasks/${payload.taskId}/actions/review`;
        actionBody = { reviewStatus: "REJECTED", reviewNote: payload.comment };
        actionDesc = `Từ chối nhiệm vụ ${payload.taskId}`;
      }

      // API call or offline enqueue
      if (!isOnline()) {
        enqueueOfflineMutation({
          url: actionUrl,
          method: "POST",
          body: actionBody,
          description: actionDesc,
        });
        setErrorMessage("Đang ngoại tuyến. Quyết định phê duyệt đã được lưu tạm và sẽ tự động gửi khi có mạng.");
        return;
      }

      try {
        const res = await fetch(actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actionBody),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setDashboardData(previousData);
          setErrorMessage(errData?.error || "Phê duyệt nhiệm vụ thất bại. Đã khôi phục dữ liệu.");
        }
      } catch (err: any) {
        // Network drop: enqueue mutation and preserve optimistic state
        enqueueOfflineMutation({
          url: actionUrl,
          method: "POST",
          body: actionBody,
          description: actionDesc,
        });
        setErrorMessage("Mất kết nối mạng. Quyết định phê duyệt đã được lưu tạm và sẽ tự động gửi khi có kết nối.");
      }
    },
    [dashboardData]
  );

  const handleCreateTask = React.useCallback(
    (data: CreateTaskFormData) => {
      const todayStr = getSystemReferenceDateStr();

      setDashboardData((prev) => {
        let updatedTasks = [...prev.tasks];

        if (data.level === "TRUONG") {
          const newTask: SchoolTask = {
            id: `task-${Date.now()}`,
            title: data.title,
            category: data.category,
            categoryLabel:
              CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
            leadAssigneeName: data.leadAssigneeName,
            coAssignees: data.coAssignees,
            assignedDate: todayStr,
            dueDate: data.dueDate,
            status: "IN_PROGRESS",
            subTasks: [],
            totalSubTasks: 0,
            completedSubTasks: 0,
            progressPercent: 0,
          };
          updatedTasks.unshift(newTask);
        } else {
          const newSubTask: StaffTask = {
            id: `sub-${Date.now()}`,
            title: data.title,
            assigneeName: data.leadAssigneeName,
            status: "NEW",
            dueDate: data.dueDate,
            internalDueDate: data.internalDueDate,
            deliverableDescription: data.requiredDeliverables,
            vtvlRole: data.vtvlRole,
            requiresReview: data.requiresReview,
            parentSchoolTaskId: data.parentTaskId || updatedTasks[0]?.id || "task-1",
            updatedAt: todayStr,
          };

          if (data.parentTaskId) {
            updatedTasks = updatedTasks.map((st) => {
              if (st.id === data.parentTaskId) {
                return {
                  ...st,
                  subTasks: [newSubTask, ...st.subTasks],
                };
              }
              return st;
            });
          } else if (updatedTasks.length > 0) {
            updatedTasks[0] = {
              ...updatedTasks[0],
              subTasks: [newSubTask, ...updatedTasks[0].subTasks],
            };
          }
        }

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });
    },
    []
  );

  const handleSaveDelegation = React.useCallback(
    (ruleData: Omit<DelegationRule, "id" | "createdAt">) => {
      const newRule: DelegationRule = {
        ...ruleData,
        id: `del-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setDelegations((prev) => [newRule, ...prev]);
    },
    []
  );

  const handleRevokeDelegation = React.useCallback((ruleId: string) => {
    setDelegations((prev) =>
      prev.map((d) => (d.id === ruleId ? { ...d, status: "REVOKED" as const } : d))
    );
  }, []);

  // Global custom event listeners
  React.useEffect(() => {
    const handleGlobalTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<CreateTaskFormData>;
      if (customEvent.detail) {
        handleCreateTask(customEvent.detail);
      }
    };

    const handleGlobalOpenCreate = (e: Event) => {
      const customEvent = e as CustomEvent<{ leadAssigneeName?: string }>;
      onOpenCreateModal?.("TRUONG", undefined, customEvent?.detail?.leadAssigneeName);
    };

    window.addEventListener("qcet:task-created", handleGlobalTaskCreated);
    window.addEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    return () => {
      window.removeEventListener("qcet:task-created", handleGlobalTaskCreated);
      window.removeEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    };
  }, [handleCreateTask, onOpenCreateModal]);

  return {
    dashboardData,
    isLoading,
    errorMessage,
    error: errorMessage,
    isRefreshing,
    delegations,
    delegationDeptCode,
    handleStatusChange,
    handleSubmitDeliverable,
    handleReviewAction,
    handleCreateTask,
    handleManualRefresh,
    handleSaveDelegation,
    handleRevokeDelegation,
  };
}
