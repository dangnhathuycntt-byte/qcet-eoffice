// Hợp đồng dữ liệu của GET /api/documents/[id]/audit-logs, dùng chung cho UI và helper tải dữ liệu.

export interface DocumentTimelineStep {
  id: string;
  stepNumber: number;
  key: string;
  title: string;
  subtitle: string;
  status: "completed" | "current" | "pending" | "rejected";
  actorName?: string | null;
  actorRole?: string | null;
  actorTitle?: string | null;
  actorAvatar?: string | null;
  timestamp?: string | null;
  notes?: string | null;
  departmentName?: string | null;
  assignedToName?: string | null;
  deadline?: string | null;
}

export interface DocumentAuditLogItem {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole?: string | null;
  actorTitle?: string | null;
  actorAvatar?: string | null;
  timestamp: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DocumentAuditApiResponse {
  success?: boolean;
  documentId: string;
  documentNumber: string;
  type: string;
  progressPercent: number;
  completedCount: number;
  totalSteps: number;
  currentStep?: DocumentTimelineStep;
  steps: DocumentTimelineStep[];
  auditLogs: DocumentAuditLogItem[];
}
