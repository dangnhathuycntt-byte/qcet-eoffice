import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Network,
  FileText,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "./dashboard";
import type { UserRole } from "./auth";

export type WorkspaceRole = UserRole;

export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ApprovalDecision = "approved" | "revision_requested" | "rejected";

export interface DeliverableSubmissionPayload {
  taskId: string;
  deliverableName: string;
  url?: string;
  fileType?: string;
  note?: string;
}

export interface ApprovalActionPayload {
  taskId: string;
  decision: ApprovalDecision;
  comment?: string;
  reviewedByRole: UserRole;
  reviewedByName: string;
}

export interface StaffUrgencySummary {
  todayCount: number;
  thisWeekCount: number;
  waitingApprovalCount: number;
  revisionRequestedCount: number;
  completedCount: number;
}

export interface DepartmentHealthSummary {
  departmentCode: string;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  completionRate: number;
  healthStatus: "GREEN" | "YELLOW" | "RED";
}

export type WorkspaceZone = "portal" | "dashboard" | "tasks" | "calendar" | "org" | "documents";

export interface ZoneConfig {
  id: WorkspaceZone;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  badgeKey?: "urgentTasks" | "totalTasks" | "upcomingDeadlines" | "unitsCount" | "docsCount";
}

export const WORKSPACE_ZONES: ZoneConfig[] = [
  {
    id: "portal",
    label: "Cổng Portal",
    shortLabel: "Cổng Portal",
    description: "Trung tâm điều hành và cổng kết nối các phân hệ",
    icon: LayoutGrid,
  },
  {
    id: "dashboard",
    label: "Dashboard Điều hành",
    shortLabel: "Dashboard",
    description: "Báo cáo chỉ số KPI và tiến độ đơn vị toàn trường",
    icon: LayoutDashboard,
    badgeKey: "urgentTasks",
  },
  {
    id: "tasks",
    label: "Quản lý Công việc",
    shortLabel: "Công việc",
    description: "Phân cấp nhiệm vụ, giao việc và theo dõi đầu việc",
    icon: CheckSquare,
    badgeKey: "totalTasks",
  },
  {
    id: "calendar",
    label: "Lịch công tác",
    shortLabel: "Lịch biểu",
    description: "Lịch sự kiện, tiến độ và hạn chót giao việc",
    icon: Calendar,
    badgeKey: "upcomingDeadlines",
  },
  {
    id: "documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    description: "Sổ văn bản đến/đi, tờ trình & ký số Nghị định 30",
    icon: FileText,
  },
  {
    id: "org",
    label: "Cơ cấu Tổ chức",
    shortLabel: "Tổ chức",
    description: "Sơ đồ bộ máy, phòng ban và danh bạ liên hệ",
    icon: Network,
    badgeKey: "unitsCount",
  },
];

export function parseZoneParam(param: string | null | undefined): WorkspaceZone {
  if (!param) return "dashboard"; // Fallback chuẩn xác về Bàn làm việc Cockpit
  const normalized = param.trim().toLowerCase();
  if (normalized === "portal" || normalized === "hub") return "portal";
  if (normalized === "dashboard" || normalized === "kpi") return "dashboard";
  if (
    normalized === "tasks" ||
    normalized === "work" ||
    normalized === "task" ||
    normalized === "cong-viec"
  ) {
    return "tasks";
  }
  if (normalized === "calendar" || normalized === "lich") return "calendar";
  if (
    normalized === "documents" ||
    normalized === "van-ban" ||
    normalized === "cong-van" ||
    normalized === "docs"
  ) {
    return "documents";
  }
  if (
    normalized === "org" ||
    normalized === "directory" ||
    normalized === "to-chuc" ||
    normalized === "danh-ba"
  ) {
    return "org";
  }
  return "dashboard";
}

export interface SchoolBottleneckItem {
  id: string;
  title: string;
  departmentCode: string;
  departmentName: string;
  assigneeName: string;
  dueDate: string;
  daysRemaining?: number | null;
  daysOverdue?: number;
  isOverdue?: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  priority?: "KHAN_CAP" | "CAO" | "TRUNG_BINH" | "THAP" | string;
  status?: string;
  progressPercent?: number;
  taskType?: "SCHOOL_TASK" | "STAFF_TASK";
  parentSchoolTaskId?: string;
  originalTask: SchoolTask | StaffTask;
}

export interface ElevenDepartmentRadarItem {
  departmentCode: string;
  departmentName: string;
  leadName: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  blockedTasks: number;
  completionRate: number;
  healthStatus: "GREEN" | "YELLOW" | "RED";
}

export type OwnershipRoleFilter = 'ALL' | 'LEADING' | 'PARTICIPATING';

export interface AssigneeWorkloadItem {
  assigneeName: string;
  assigneeId?: string;
  count: number;
  completedCount: number;
}

export interface GroupedParentTaskView {
  parentTask: SchoolTask;
  isLeading: boolean;
  isParticipating: boolean;
  isAwaitingAssignment: boolean;
  workloads: AssigneeWorkloadItem[];
  userSubTasks: StaffTask[];
  allSubTasks: StaffTask[];
}

