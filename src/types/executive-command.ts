import type { SchoolTask } from "@/types/dashboard";

export type ExecutiveRAGStatus = "RED" | "AMBER" | "GREEN";

export type ExecutiveTriageFilter = "ALL" | "BOTTLENECKS" | "PENDING_APPROVAL";

export interface FocusInitiative {
  taskId: string;
  title: string;
  dueDate: string;
  progressPercent: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  categoryLabel?: string;
}

export interface ExecutiveDepartmentSummary {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  headOfDepartment: {
    name: string;
    title: string;
    email?: string;
  };
  ragStatus: ExecutiveRAGStatus;
  ragReason?: string;
  focusInitiative?: FocusInitiative;
  metrics: {
    totalTasks: number;
    inProgress: number;
    dueSoon: number; // Deadline <= 3 days from reference date
    overdue: number;
    completed: number;
    completionRate: number; // 0 - 100
  };
  pendingApprovalCount: number;
  schoolLevelTaskCount: number;
  unitLevelTaskCount: number;
  tasks: SchoolTask[];
}
