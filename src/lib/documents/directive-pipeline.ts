import type { DocumentItem, DocumentDirectiveItem, DocumentUrgency } from "@/types/document";
import type { TaskPriority } from "@/types/workspace";

/**
 * Maps Decree 30 document urgency levels to TaskPriority.
 * High and Urgent dispatches escalate directly to corresponding task priorities.
 */
export function mapUrgencyToTaskPriority(urgency: DocumentUrgency): TaskPriority {
  switch (urgency) {
    case "HOA_TOC":
    case "flash":
      return "URGENT";
    case "THUONG_KHAN":
    case "top_urgent":
    case "KHAN":
    case "urgent":
      return "HIGH";
    case "THUONG":
    case "normal":
    default:
      return "NORMAL";
  }
}

export interface GeneratedTaskPayload {
  title: string;
  description: string;
  scope: "SCHOOL";
  departmentId: string;
  priority: TaskPriority;
  dueDate: string;
  sourceDocumentId: string;
  metadata: {
    originalNumber: string;
    issuingAuthority: string;
    leaderName?: string;
    directiveInstruction: string;
  };
}

/**
 * Converts a leadership directive (Bút phê BGH) on an official document
 * into a standardized SchoolTask creation payload.
 */
export function mapDirectiveToSchoolTask(
  doc: DocumentItem,
  directive: DocumentDirectiveItem
): GeneratedTaskPayload {
  const shortSummary =
    doc.summary.length > 80 ? doc.summary.substring(0, 80) + "..." : doc.summary;
  const title = `[Xử lý VB ${doc.originalNumber}] ${shortSummary}`;

  const dueDate =
    directive.deadline ||
    doc.dueDate ||
    new Date(Date.now() + 7 * 86400000).toISOString();

  const description = [
    `TRÍCH YẾU VĂN BẢN: ${doc.summary}`,
    `CƠ QUAN BAN HÀNH: ${doc.issuingAuthority}`,
    `SỐ KÝ HIỆU GỐC: ${doc.originalNumber} (Ngày ký: ${doc.issuedDate.slice(0, 10)})`,
    ``,
    `=== Ý KIẾN CHỈ ĐẠO BÚT PHÊ CỦA LÃNH ĐẠO TRƯỜNG ===`,
    `Người chỉ đạo: ${directive.leaderName || "Ban Giám hiệu"}`,
    `Nội dung: ${directive.instruction}`,
    `Hạn hoàn thành báo cáo: ${dueDate.slice(0, 10)}`,
  ].join("\n");

  return {
    title,
    description,
    scope: "SCHOOL",
    departmentId: directive.assignedDeptId,
    priority: mapUrgencyToTaskPriority(doc.urgency),
    dueDate,
    sourceDocumentId: doc.id,
    metadata: {
      originalNumber: doc.originalNumber,
      issuingAuthority: doc.issuingAuthority,
      leaderName: directive.leaderName,
      directiveInstruction: directive.instruction,
    },
  };
}

/**
 * Executes the directive pipeline:
 * 1. Generates task payload from document & directive.
 * 2. Invokes taskCreator delegate to persist task in Task Hub / database.
 * 3. Updates directive isTaskGenerated flag and document status to DANG_XU_LY with backlink.
 */
export async function executeDirectivePipeline<T>(
  doc: DocumentItem,
  directive: DocumentDirectiveItem,
  taskCreator: (taskPayload: GeneratedTaskPayload) => Promise<T>
): Promise<{ task: T; directive: DocumentDirectiveItem; document: DocumentItem }> {
  const taskPayload = mapDirectiveToSchoolTask(doc, directive);
  const createdTask = await taskCreator(taskPayload);

  const updatedDirective: DocumentDirectiveItem = {
    ...directive,
    isTaskGenerated: true,
  };

  const updatedDoc: DocumentItem = {
    ...doc,
    status: "DANG_XU_LY",
    linkedTaskId: (createdTask as any)?.id || doc.linkedTaskId || null,
  };

  return {
    task: createdTask,
    directive: updatedDirective,
    document: updatedDoc,
  };
}
