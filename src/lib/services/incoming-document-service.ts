/**
 * Incoming Document Service V2 (Nghị định 30/2020/NĐ-CP Lifecycle)
 *
 * Full two-tier delegation workflow:
 * 1. Văn thư (Clerk) registers incoming document (REGISTERED)
 * 2. Văn thư presents document to Leadership (PRESENTED)
 * 3. Ban Giám hiệu (Rector / Vice-Rector) issues Tier-1 Directive to Lead Unit (DIRECTED)
 * 4. Trưởng đơn vị (Unit Head) issues Tier-2 Assignment to Individual DRI (UNIT_ASSIGNED_PERSON)
 * 5. DRI executes & submits resolution (RESOLVED)
 * 6. Lập hồ sơ và lưu trữ văn bản (FILED / ARCHIVED)
 *
 * Invariants Enforced:
 * - Hybrid Authorization via assertAuthorized()
 * - Single DRI Principle for operational execution
 * - Atomic database operations via prisma.$transaction
 * - Immutable Audit Logging via auditService
 * - Reliable Outbox Event Publishing via publishOutboxEvent
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, Document, DocumentIncomingWorkflow, UnitWorkAssignment } from "@prisma/client";
import {
  IncomingDocumentStatus,
  DocumentType,
  DocumentSecurityLevel,
  DocumentUrgency,
  DocumentStatus,
  TaskScope,
  TaskStatus,
  TaskPriority,
  TaskActorRole,
  AssigneeRole,
} from "@prisma/client";
import {
  assertAuthorized,
  type AuthenticatedUserContext,
  type AuthorizationResource,
  HybridAuthorizationError,
} from "@/lib/auth/hybrid-authorization";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/server/api/errors";
import type { SessionPayload } from "@/lib/jwt-session";
import { getNextRegistrationNumber } from "@/lib/documents/numbering-engine";
import {
  IncomingDocumentStateMachine,
  mapIncomingWorkflowStatusToDocumentStatus,
} from "@/lib/documents/state-machine";

// ============================================================================
// Types & Input Interfaces
// ============================================================================

export interface RegisterIncomingDocumentInput {
  registrationNumber?: number;
  documentNumber?: string | number;
  originalNumber?: string;
  originalDocNumber?: string;
  title: string;
  summary?: string;
  category?: string;
  issuingAuthority?: string;
  sender?: string;
  issuedDate?: Date | string;
  receivedDate?: Date | string;
  securityLevel?: DocumentSecurityLevel;
  urgency?: DocumentUrgency;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  storageLocation?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface PresentDocumentInput {
  documentId: string;
  presenterNotes?: string;
  suggestedLeaderId?: string;
}

export interface DirectDocumentInput {
  documentId: string;
  leadUnitId: string;
  coordinatingUnitIds?: string[];
  leadershipInstruction: string;
  deadline?: Date | string;
  responsibilityAreaId?: string;
  notes?: string;
}

export interface AssignUnitWorkInput {
  documentId: string;
  driUserId: string;
  collaboratorUserIds?: string[];
  instruction?: string;
  deadline?: Date | string;
  createTask?: boolean;
  taskTitle?: string;
}

export interface ResolveDocumentInput {
  documentId: string;
  resolutionSummary: string;
  resolutionDocUrl?: string;
  notes?: string;
}

export interface FileDocumentInput {
  documentId: string;
  dossierId?: string;
  filingNotes?: string;
  archiveNow?: boolean;
  storageLocation?: string;
}

export interface ListIncomingWorkflowsFilter {
  status?: IncomingDocumentStatus;
  leadUnitId?: string;
  driUserId?: string;
  leaderId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export type IncomingDocumentWorkflowWithDetails = DocumentIncomingWorkflow & {
  document: Document;
  leadUnit: { id: string; name: string; code: string } | null;
  leader: { id: string; name: string; email: string } | null;
  unitAssignments: (UnitWorkAssignment & {
    driUser: { id: string; name: string; email: string };
    assignedBy: { id: string; name: string; email: string };
  })[];
};

// ============================================================================
// Helper: Resolve User Context from Session or Authenticated Context
// ============================================================================

export async function resolveUserContext(
  actor: AuthenticatedUserContext | SessionPayload
): Promise<AuthenticatedUserContext> {
  // If already full AuthenticatedUserContext
  if ("systemRole" in actor && "activePositionCode" in actor) {
    return actor as AuthenticatedUserContext;
  }

  const session = actor as SessionPayload;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      positionAssignments: {
        where: { status: "ACTIVE" },
        include: {
          positionDefinition: true,
          unit: true,
          portfolios: {
            include: { responsibilityArea: true },
          },
        },
      },
      department: true,
    },
  });

  const activePosition = dbUser?.positionAssignments[0]?.positionDefinition;
  let activePositionCode = activePosition?.code;
  if (!activePositionCode) {
    const roleUpper = (session.role || "").toUpperCase();
    const titleUpper = (session.title || "").toUpperCase();
    if (
      roleUpper === "VAN_THU" ||
      roleUpper === "CLERK" ||
      titleUpper.includes("VĂN THƯ") ||
      titleUpper.includes("VAN THU")
    ) {
      activePositionCode = "VAN_THU";
    } else if (
      roleUpper === "LUU_TRU" ||
      roleUpper === "ARCHIVIST" ||
      titleUpper.includes("LƯU TRỮ") ||
      titleUpper.includes("LUU TRU")
    ) {
      activePositionCode = "LUU_TRU";
    } else if (
      roleUpper === "BAN_GIAM_HIEU" ||
      roleUpper === "RECTOR" ||
      titleUpper.includes("HIỆU TRƯỞNG") ||
      titleUpper.includes("HIEU TRUONG")
    ) {
      if (titleUpper.includes("PHÓ") || titleUpper.includes("PHO")) {
        activePositionCode = "PHO_HIEU_TRUONG";
      } else {
        activePositionCode = "HIEU_TRUONG";
      }
    } else if (
      roleUpper === "MANAGER" ||
      roleUpper === "TRUONG_PHONG" ||
      roleUpper === "TRUONG_KHOA" ||
      titleUpper.includes("TRƯỞNG") ||
      titleUpper.includes("TRUONG")
    ) {
      activePositionCode = "TRUONG_DON_VI";
    } else if (
      roleUpper === "STAFF" ||
      roleUpper === "CHUYEN_VIEN" ||
      roleUpper === "GIANG_VIEN" ||
      titleUpper.includes("CHUYÊN VIÊN") ||
      titleUpper.includes("GIẢNG VIÊN")
    ) {
      activePositionCode = "GIANG_VIEN_CHUYEN_VIEN";
    } else if (roleUpper === "ADMIN" || roleUpper === "SUPER_ADMIN") {
      activePositionCode = "QUAN_TRI_HE_THONG";
    } else {
      activePositionCode = session.title ?? session.role ?? undefined;
    }
  }

  const portfolios =
    dbUser?.positionAssignments.flatMap((pa) =>
      pa.portfolios.map((p) => p.responsibilityArea.code as any)
    ) || [];

  const now = new Date();
  const v2Grants = await prisma.delegationGrant.findMany({
    where: {
      granteeAssignment: { userId: session.id },
      status: "ACTIVE",
      validUntil: { gte: now },
    },
    include: {
      granteeAssignment: true,
    },
  });

  const formattedGrants = v2Grants.map((g) => ({
    id: g.id,
    granteeUserId: g.granteeAssignment.userId,
    capability: g.action || "*",
    validFrom: g.validFrom,
    validUntil: g.validUntil,
    status: g.status,
  }));

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    systemRole: session.role === "ADMIN" ? "SYSTEM_ADMIN" : session.role,
    activePositionCode,
    departmentId: dbUser?.departmentId || session.departmentId || undefined,
    departmentCode: dbUser?.department?.shortName || undefined,
    portfolios,
    isActive: true,
    delegationGrants: formattedGrants,
  };
}

// ============================================================================
// Service Methods
// ============================================================================

/**
 * 1. Register Incoming Document (Văn thư đăng ký vào Sổ đăng ký văn bản đến)
 * Status: REGISTERED
 */
export async function registerIncomingDocument(
  input: RegisterIncomingDocumentInput,
  actor: AuthenticatedUserContext | SessionPayload,
  requestId?: string
): Promise<{ document: Document; workflow: DocumentIncomingWorkflow }> {
  const user = await resolveUserContext(actor);

  const resource: AuthorizationResource = {
    id: "new",
    type: "document_incoming",
    scope: "SCHOOL",
    securityLevel: input.securityLevel || "NORMAL",
  };

  await assertAuthorized(user, "document.incoming.register", resource);

  const summary = input.summary || input.title;
  const issuingAuthority = input.issuingAuthority || input.sender;
  const originalNumber = input.originalNumber || input.originalDocNumber || "CHƯA_CÓ_SỐ";

  if (!summary || !issuingAuthority) {
    throw new ValidationError("Trích yếu nội dung (summary/title) và cơ quan ban hành (sender/issuingAuthority) là bắt buộc.");
  }

  const issuedDate = input.issuedDate ? new Date(input.issuedDate) : new Date();
  const receivedDate = input.receivedDate ? new Date(input.receivedDate) : new Date();
  const documentYear = receivedDate.getFullYear();

  return prisma.$transaction(async (tx) => {
    // Determine next sequential registration number for incoming docs in this year
    let regNumber: number;
    if (input.registrationNumber !== undefined && Number.isInteger(input.registrationNumber)) {
      regNumber = input.registrationNumber;
    } else if (input.documentNumber && !Number.isNaN(Number(input.documentNumber))) {
      regNumber = Number(input.documentNumber);
    } else {
      // Atomic sequential registration numbering (race-free, non-repeating)
      regNumber = await getNextRegistrationNumber(DocumentType.VAN_BAN_DEN, documentYear, tx);
    }

    // 1. Create canonical Document record
    const document = await tx.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: regNumber,
        documentYear,
        registeredDate: receivedDate,
        originalNumber,
        issuedDate,
        issuingAuthority,
        category: input.category || "Công văn",
        summary,
        urgency: input.urgency || DocumentUrgency.THUONG,
        securityLevel: input.securityLevel || DocumentSecurityLevel.THUONG,
        status: mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.REGISTERED),
        notes: input.notes,
        registeredById: user.id,
      },
    });

    // 1b. If attachments provided, create DocumentAttachment
    if (input.fileUrl) {
      await tx.documentAttachment.create({
        data: {
          documentId: document.id,
          fileName: input.fileName || "Tệp đính kèm",
          fileUrl: input.fileUrl,
          fileSize: input.fileSize || 0,
          mimeType: input.fileType || "application/pdf",
        },
      });
    }

    // 2. Create Incoming Workflow tracking record
    const workflow = await tx.documentIncomingWorkflow.create({
      data: {
        documentId: document.id,
        status: IncomingDocumentStatus.REGISTERED,
        filingNotes: input.storageLocation,
      },
    });

    // 3. Log Immutable Audit Event
    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_CREATED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: document.id,
      requestId,
      afterData: {
        documentId: document.id,
        registrationNumber: document.registrationNumber,
        summary: document.summary,
        status: workflow.status,
      },
      metadata: {
        workflowId: workflow.id,
        phase: "REGISTRATION",
      },
    });

    // 4. Publish Outbox Event for background processing / notifications
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_ISSUED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: document.id,
      payload: {
        documentId: document.id,
        registrationNumber: document.registrationNumber,
        summary: document.summary,
        workflowId: workflow.id,
        registeredById: user.id,
        registeredAt: new Date().toISOString(),
      },
    });

    return { document, workflow };
  });
}

/**
 * 2. Present Document (Văn thư trình Lãnh đạo Trường)
 * Transition: REGISTERED | RECEIVED -> PRESENTED
 */
export async function presentDocument(
  input: PresentDocumentInput,
  actor: AuthenticatedUserContext | SessionPayload,
  requestId?: string
): Promise<DocumentIncomingWorkflow> {
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { incomingWorkflow: true },
  });

  if (!doc || !doc.incomingWorkflow) {
    throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");
  }

  const resource: AuthorizationResource = {
    id: doc.id,
    type: "document_incoming",
    scope: "SCHOOL",
    securityLevel: doc.securityLevel || "NORMAL",
    leadDepartmentId: doc.leadDepartmentId || undefined,
  };

  await assertAuthorized(user, "document.incoming.present", resource);

  const currentStatus = doc.incomingWorkflow.status;
  IncomingDocumentStateMachine.assertTransition(
    currentStatus,
    IncomingDocumentStatus.PRESENTED,
    input.documentId
  );

  return prisma.$transaction(async (tx) => {
    const updatedWorkflow = await tx.documentIncomingWorkflow.update({
      where: { documentId: input.documentId },
      data: {
        status: IncomingDocumentStatus.PRESENTED,
        presentedAt: new Date(),
        presentedById: user.id,
        presenterNotes: input.presenterNotes,
      },
    });

    const targetDocStatus = mapIncomingWorkflowStatusToDocumentStatus(
      IncomingDocumentStatus.PRESENTED
    );
    await tx.document.update({
      where: { id: input.documentId },
      data: {
        status: targetDocStatus,
      },
    });

    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_PRESENTED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      beforeData: { status: currentStatus },
      afterData: {
        status: updatedWorkflow.status,
        presentedById: user.id,
        presenterNotes: input.presenterNotes,
      },
      metadata: { documentId: doc.id },
    });

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_PRESENTED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: {
        documentId: doc.id,
        workflowId: updatedWorkflow.id,
        suggestedLeaderId: input.suggestedLeaderId,
        presentedById: user.id,
      },
    });

    return {
      ...updatedWorkflow,
      workflow: updatedWorkflow,
      document: {
        id: doc.id,
        summary: doc.summary,
        status: targetDocStatus,
      },
    } as any;
  });
}

/**
 * 3. Direct Document (Lãnh đạo Trường cho ý kiến chỉ đạo - Tier 1 Directive)
 * Assigns lead unit, coordinating units, deadline, instructions.
 * Transition: PRESENTED | REGISTERED -> DIRECTED
 */
export async function directDocument(
  input: DirectDocumentInput,
  actor: AuthenticatedUserContext | SessionPayload,
  requestId?: string
): Promise<DocumentIncomingWorkflow> {
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { incomingWorkflow: true },
  });

  if (!doc || !doc.incomingWorkflow) {
    throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");
  }

  // Check Portfolio alignment if responsibilityAreaId is specified
  let portfolioCode: any = undefined;
  if (input.responsibilityAreaId) {
    const area = await prisma.responsibilityArea.findUnique({
      where: { id: input.responsibilityAreaId },
    });
    if (area) {
      portfolioCode = area.code;
    }
  }

  const resource: AuthorizationResource = {
    id: doc.id,
    type: "document_incoming",
    scope: "SCHOOL",
    portfolio: portfolioCode,
    securityLevel: doc.securityLevel || "NORMAL",
    leadDepartmentId: input.leadUnitId,
  };

  await assertAuthorized(user, "document.incoming.direct", resource);

  const currentStatus = doc.incomingWorkflow.status;
  const targetStatus = input.leadUnitId
    ? IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT
    : IncomingDocumentStatus.DIRECTED;
  IncomingDocumentStateMachine.assertTransition(
    currentStatus,
    targetStatus,
    input.documentId
  );

  if (!input.leadUnitId) {
    throw new ValidationError("Đơn vị chủ trì (leadUnitId) là bắt buộc.");
  }
  if (!input.leadershipInstruction || input.leadershipInstruction.trim() === "") {
    throw new ValidationError("Ý kiến chỉ đạo của Lãnh đạo Trường không được để trống.");
  }

  const deadline = input.deadline ? new Date(input.deadline) : null;

  return prisma.$transaction(async (tx) => {
    const targetWorkflowStatus = input.leadUnitId
      ? IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT
      : IncomingDocumentStatus.DIRECTED;

    // 1. Update workflow
    const updatedWorkflow = await tx.documentIncomingWorkflow.update({
      where: { documentId: input.documentId },
      data: {
        status: targetWorkflowStatus,
        directedAt: new Date(),
        leaderId: user.id,
        leadUnitId: input.leadUnitId,
        coordinatingUnitIds: input.coordinatingUnitIds || [],
        leadershipInstruction: input.leadershipInstruction,
        deadline,
        responsibilityAreaId: input.responsibilityAreaId,
      },
    });

    // 2. Check if a legacy Department exists with id leadUnitId, if so update Document
    const legacyDept = await tx.department.findUnique({
      where: { id: input.leadUnitId },
    });

    const targetDocStatus = mapIncomingWorkflowStatusToDocumentStatus(targetWorkflowStatus);

    await tx.document.update({
      where: { id: input.documentId },
      data: {
        status: targetDocStatus,
        dueDate: deadline,
        ...(legacyDept ? { leadDepartmentId: input.leadUnitId } : {}),
      },
    });

    // 3. Create legacy DocumentDirective if legacy Department exists
    let createdDirective: any = null;
    if (legacyDept) {
      const dir = await tx.documentDirective.create({
        data: {
          documentId: input.documentId,
          leaderId: user.id,
          instruction: input.leadershipInstruction,
          deadline,
          assignedDeptId: legacyDept.id,
          collaboratorIds: (input.coordinatingUnitIds || []).join(","),
        },
      });
      createdDirective = Object.assign(dir, {
        leadUnitId: dir.assignedDeptId,
      });
    }

    // 4. Audit Log
    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_DIRECTED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      beforeData: { status: currentStatus },
      afterData: {
        status: updatedWorkflow.status,
        leaderId: user.id,
        leadUnitId: input.leadUnitId,
        coordinatingUnitIds: input.coordinatingUnitIds,
        instruction: input.leadershipInstruction,
        deadline,
      },
      metadata: { documentId: doc.id },
    });

    // 5. Outbox event
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_DIRECTIVE_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: {
        documentId: doc.id,
        workflowId: updatedWorkflow.id,
        leadUnitId: input.leadUnitId,
        leaderId: user.id,
        instruction: input.leadershipInstruction,
      },
    });

    return {
      ...updatedWorkflow,
      workflow: updatedWorkflow,
      directive: createdDirective,
      document: {
        id: doc.id,
        summary: doc.summary,
        status: targetDocStatus,
      },
    } as any;
  });
}

/**
 * 4. Assign Unit Work (Trưởng đơn vị giao việc chuyên viên - Tier 2 Work Assignment)
 * Appoints single DRI and collaborators. Optionally creates an operational Task.
 * Transition: DIRECTED | ASSIGNED_TO_LEAD_UNIT -> UNIT_ASSIGNED_PERSON
 */
export async function assignUnitWork(
  input: AssignUnitWorkInput,
  actor: AuthenticatedUserContext | SessionPayload,
  requestId?: string
): Promise<{ assignment: UnitWorkAssignment; workflow: DocumentIncomingWorkflow }> {
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { incomingWorkflow: true },
  });

  if (!doc || !doc.incomingWorkflow) {
    throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");
  }

  const leadUnitId = doc.incomingWorkflow.leadUnitId || doc.leadDepartmentId;
  if (!leadUnitId) {
    throw new ValidationError("Văn bản chưa có đơn vị chủ trì.");
  }

  const resource: AuthorizationResource = {
    id: doc.id,
    type: "document_incoming",
    scope: "DEPARTMENT",
    leadDepartmentId: leadUnitId,
    departmentId: leadUnitId,
    securityLevel: doc.securityLevel || "NORMAL",
  };

  await assertAuthorized(user, "document.incoming.assign_person", resource);

  // Unit leader boundary check:
  // User must belong to leadUnitId or be executive / system admin
  const isExecutiveOrAdmin =
    user.systemRole === "SYSTEM_ADMIN" ||
    user.systemRole === "ADMIN" ||
    user.activePositionCode === "HIEU_TRUONG" ||
    user.activePositionCode === "PHO_HIEU_TRUONG";

  if (!isExecutiveOrAdmin && user.departmentId !== leadUnitId) {
    throw new HybridAuthorizationError(
      "Trưởng đơn vị chỉ có quyền phân công trong phạm vi đơn vị mình phụ trách.",
      "DEPARTMENT_BOUNDARY_VIOLATION",
      "document.incoming.assign_person",
      doc.id,
      403
    );
  }

  const currentStatus = doc.incomingWorkflow.status;
  const targetStatus = input.createTask
    ? IncomingDocumentStatus.IN_PROGRESS
    : IncomingDocumentStatus.UNIT_ASSIGNED_PERSON;
  IncomingDocumentStateMachine.assertTransition(
    currentStatus,
    targetStatus,
    input.documentId
  );

  if (!input.driUserId) {
    throw new ValidationError("Người chịu trách nhiệm chính (driUserId) là bắt buộc.");
  }

  const deadline = input.deadline ? new Date(input.deadline) : doc.incomingWorkflow.deadline;

  return prisma.$transaction(async (tx) => {
    let createdTaskId: string | null = null;

    // Optional Task creation for execution tracking
    if (input.createTask) {
      const now = new Date();
      const code = `VB-${doc.registrationNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      const taskTitle = input.taskTitle || `Xử lý văn bản số ${doc.registrationNumber}: ${doc.summary}`;

      const legacyDept = await tx.department.findUnique({
        where: { id: leadUnitId },
      });

      const task = await tx.task.create({
        data: {
          code,
          title: taskTitle,
          description: input.instruction || doc.incomingWorkflow?.leadershipInstruction || doc.summary,
          scope: TaskScope.DEPARTMENT,
          status: TaskStatus.IN_PROGRESS,
          priority:
            doc.urgency === DocumentUrgency.HOA_TOC || doc.urgency === DocumentUrgency.THUONG_KHAN
              ? TaskPriority.URGENT
              : doc.urgency === DocumentUrgency.KHAN
              ? TaskPriority.HIGH
              : TaskPriority.NORMAL,
          academicMonth: now.getMonth() + 1,
          academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
          startDate: now,
          dueDate: deadline || new Date(now.getTime() + 7 * 86400000),
          createdById: user.id,
          departmentId: legacyDept ? legacyDept.id : undefined,
          leadUnitId,
          assignees: {
            create: [
              {
                userId: input.driUserId,
                roleInTask: AssigneeRole.PRIMARY_OWNER,
              },
              ...(input.collaboratorUserIds || []).map((collabId) => ({
                userId: collabId,
                roleInTask: AssigneeRole.COLLABORATOR,
              })),
            ],
          },
          actors: {
            create: [
              {
                userId: user.id,
                role: TaskActorRole.ASSIGNER,
                isPrimaryDRI: false,
              },
              {
                userId: input.driUserId,
                role: TaskActorRole.DRI,
                isPrimaryDRI: true,
              },
              ...(input.collaboratorUserIds || []).map((collabId) => ({
                userId: collabId,
                role: TaskActorRole.COLLABORATOR,
                isPrimaryDRI: false,
              })),
            ],
          },
        },
      });

      createdTaskId = task.id;
    }

    // 1. Create UnitWorkAssignment
    const assignment = await tx.unitWorkAssignment.create({
      data: {
        workflowId: doc.incomingWorkflow!.id,
        unitId: leadUnitId,
        assignedById: user.id,
        driUserId: input.driUserId,
        collaboratorUserIds: input.collaboratorUserIds || [],
        instruction: input.instruction,
        deadline,
        taskId: createdTaskId,
        status: "ASSIGNED",
      },
    });

    // 2. Update workflow status to UNIT_ASSIGNED_PERSON (or IN_PROGRESS if task created)
    const targetStatus = input.createTask
      ? IncomingDocumentStatus.IN_PROGRESS
      : IncomingDocumentStatus.UNIT_ASSIGNED_PERSON;

    const updatedWorkflow = await tx.documentIncomingWorkflow.update({
      where: { id: doc.incomingWorkflow!.id },
      data: {
        status: targetStatus,
      },
    });

    // 3. Update document lead user and synchronize status
    const targetDocStatus = mapIncomingWorkflowStatusToDocumentStatus(targetStatus);
    await tx.document.update({
      where: { id: input.documentId },
      data: {
        leadUserId: input.driUserId,
        status: targetDocStatus,
      },
    });

    // 4. Audit log
    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_UNIT_ASSIGNED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      afterData: {
        assignmentId: assignment.id,
        driUserId: input.driUserId,
        collaboratorUserIds: input.collaboratorUserIds,
        instruction: input.instruction,
        taskId: createdTaskId,
      },
      metadata: {
        documentId: doc.id,
        workflowId: updatedWorkflow.id,
      },
    });

    // 5. Outbox event
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_ASSIGNED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: {
        documentId: doc.id,
        workflowId: updatedWorkflow.id,
        assignmentId: assignment.id,
        driUserId: input.driUserId,
        collaborators: input.collaboratorUserIds || [],
        taskId: createdTaskId,
      },
    });

    const assignmentWithCompat = {
      ...assignment,
      createdTaskId: assignment.taskId,
    };

    const workflowWithCompat = {
      ...updatedWorkflow,
      driUserId: input.driUserId,
      collaboratorUserIds: input.collaboratorUserIds || [],
    };

    return {
      assignment: assignmentWithCompat,
      workflow: workflowWithCompat,
    };
  });
}

/**
 * 5. Resolve Document (Chuyên viên / Đơn vị giải quyết văn bản xong)
 * Transition: UNIT_ASSIGNED_PERSON | IN_PROGRESS | DIRECTED -> RESOLVED
 */
export async function resolveDocument(
  input: ResolveDocumentInput,
  actor: AuthenticatedUserContext | SessionPayload,
  requestId?: string
): Promise<DocumentIncomingWorkflow> {
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: {
      incomingWorkflow: {
        include: { unitAssignments: true },
      },
    },
  });

  if (!doc || !doc.incomingWorkflow) {
    throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");
  }

  const driIds = doc.incomingWorkflow.unitAssignments.map((a) => a.driUserId);
  const collaboratorIds = doc.incomingWorkflow.unitAssignments.flatMap(
    (a) => (a.collaboratorUserIds as string[]) || []
  );

  const resource: AuthorizationResource = {
    id: doc.id,
    type: "document_incoming",
    scope: "DEPARTMENT",
    leadDepartmentId: doc.incomingWorkflow.leadUnitId || undefined,
    departmentId: doc.incomingWorkflow.leadUnitId || undefined,
    leadUserId: driIds[0] || doc.leadUserId || undefined,
    primaryOwnerId: driIds[0] || doc.leadUserId || undefined,
    assigneeIds: driIds,
    collaboratorIds,
  };

  await assertAuthorized(user, "document.incoming.execute", resource);

  const currentStatus = doc.incomingWorkflow.status;
  IncomingDocumentStateMachine.assertTransition(
    currentStatus,
    IncomingDocumentStatus.RESOLVED,
    input.documentId
  );

  if (!input.resolutionSummary || input.resolutionSummary.trim() === "") {
    throw new ValidationError("Báo cáo / Tóm tắt kết quả giải quyết không được để trống.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Update workflow to RESOLVED
    const updatedWorkflow = await tx.documentIncomingWorkflow.update({
      where: { id: doc.incomingWorkflow!.id },
      data: {
        status: IncomingDocumentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolutionSummary: input.resolutionSummary,
        resolutionDocUrl: input.resolutionDocUrl,
      },
    });

    // 2. Update assignments status
    await tx.unitWorkAssignment.updateMany({
      where: { workflowId: doc.incomingWorkflow!.id },
      data: { status: "RESOLVED" },
    });

    const targetDocStatus = mapIncomingWorkflowStatusToDocumentStatus(
      IncomingDocumentStatus.RESOLVED
    );

    // 3. Update canonical document status
    await tx.document.update({
      where: { id: input.documentId },
      data: {
        status: targetDocStatus,
      },
    });

    // 4. Audit Log
    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_RESOLVED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      beforeData: { status: currentStatus },
      afterData: {
        status: updatedWorkflow.status,
        resolvedById: user.id,
        resolutionSummary: input.resolutionSummary,
        resolutionDocUrl: input.resolutionDocUrl,
      },
      metadata: { documentId: doc.id },
    });

    // 5. Outbox Event
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_RESOLVED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: {
        documentId: doc.id,
        workflowId: updatedWorkflow.id,
        resolvedById: user.id,
        resolutionSummary: input.resolutionSummary,
      },
    });

    return {
      ...updatedWorkflow,
      workflow: updatedWorkflow,
      document: {
        id: doc.id,
        summary: doc.summary,
        status: targetDocStatus,
      },
    } as any;
  });
}

/**
 * 6. File Document (Lập hồ sơ và lưu trữ văn bản vào hồ sơ cơ quan / đơn vị)
 * Strict Requirement: Must be RESOLVED before filing.
 * Transition: RESOLVED -> FILED | ARCHIVED
 */
export async function fileDocument(
  input: FileDocumentInput,
  actor: AuthenticatedUserContext | SessionPayload,
  requestId?: string
): Promise<DocumentIncomingWorkflow> {
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: {
      incomingWorkflow: {
        include: { unitAssignments: true },
      },
    },
  });

  if (!doc || !doc.incomingWorkflow) {
    throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");
  }

  const driIds = doc.incomingWorkflow.unitAssignments.map((a) => a.driUserId);

  const resource: AuthorizationResource = {
    id: doc.id,
    type: "document_incoming",
    leadDepartmentId: doc.incomingWorkflow.leadUnitId || undefined,
    leadUserId: driIds[0] || doc.leadUserId || undefined,
    primaryOwnerId: driIds[0] || doc.leadUserId || undefined,
    dossierOwnerId: user.id,
  };

  await assertAuthorized(user, "document.incoming.file", resource);

  const currentStatus = doc.incomingWorkflow.status;
  const archiveNow = Boolean(input.archiveNow);
  const targetStatus = archiveNow
    ? IncomingDocumentStatus.ARCHIVED
    : IncomingDocumentStatus.FILED;

  IncomingDocumentStateMachine.assertTransition(
    currentStatus,
    targetStatus,
    input.documentId
  );
  const dossierId = input.dossierId || `HS-${doc.documentYear || new Date().getFullYear()}-${doc.registrationNumber}`;

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Update Workflow
    const updatedWorkflow = await tx.documentIncomingWorkflow.update({
      where: { id: doc.incomingWorkflow!.id },
      data: {
        status: targetStatus,
        filedAt: now,
        filedById: user.id,
        dossierId,
        filingNotes: input.filingNotes,
        ...(archiveNow
          ? {
              archivedAt: now,
              archivedById: user.id,
            }
          : {}),
      },
    });

    // 2. Update canonical document
    const targetDocStatus = mapIncomingWorkflowStatusToDocumentStatus(targetStatus);
    await tx.document.update({
      where: { id: input.documentId },
      data: {
        status: targetDocStatus,
        archivedAt: now,
        archivedById: user.id,
        archiveReason: input.filingNotes || `Lưu trữ hồ sơ ${dossierId}`,
      },
    });

    // 3. Audit Log
    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_FILED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      beforeData: { status: currentStatus },
      afterData: {
        status: targetStatus,
        dossierId,
        filedById: user.id,
        filingNotes: input.filingNotes,
      },
      metadata: {
        documentId: doc.id,
        archiveNow,
      },
    });

    // 4. Outbox Event
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_FILED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: {
        documentId: doc.id,
        workflowId: updatedWorkflow.id,
        dossierId,
        filedById: user.id,
        status: targetStatus,
      },
    });

    return {
      ...updatedWorkflow,
      workflow: updatedWorkflow,
      document: {
        id: doc.id,
        summary: doc.summary,
        status: targetDocStatus,
      },
    } as any;
  });
}

/**
 * Query incoming document details with full workflow and assignments.
 */
export async function getIncomingDocument(
  documentId: string,
  _actor?: AuthenticatedUserContext | SessionPayload
): Promise<IncomingDocumentWorkflowWithDetails | null> {
  const workflow = await prisma.documentIncomingWorkflow.findUnique({
    where: { documentId },
    include: {
      document: true,
      leadUnit: {
        select: { id: true, name: true, code: true },
      },
      leader: {
        select: { id: true, name: true, email: true },
      },
      unitAssignments: {
        include: {
          driUser: { select: { id: true, name: true, email: true } },
          assignedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!workflow) return null;

  const directives = await prisma.documentDirective.findMany({
    where: { documentId },
    include: {
      leader: { select: { id: true, name: true, email: true } },
      assignedDept: { select: { id: true, name: true } },
    },
  });

  return Object.assign(workflow, {
    directives,
  }) as unknown as IncomingDocumentWorkflowWithDetails;
}

/**
 * List incoming workflows by status, lead unit, or leader.
 */
export async function listIncomingWorkflows(
  filters: ListIncomingWorkflowsFilter = {}
) {
  const where: Prisma.DocumentIncomingWorkflowWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.leadUnitId) {
    where.leadUnitId = filters.leadUnitId;
  }
  if (filters.leaderId) {
    where.leaderId = filters.leaderId;
  }
  if (filters.driUserId) {
    where.unitAssignments = {
      some: { driUserId: filters.driUserId },
    };
  }
  if (filters.search) {
    where.document = {
      OR: [
        { summary: { contains: filters.search, mode: "insensitive" } },
        { issuingAuthority: { contains: filters.search, mode: "insensitive" } },
        { originalNumber: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  const [total, items] = await Promise.all([
    prisma.documentIncomingWorkflow.count({ where }),
    prisma.documentIncomingWorkflow.findMany({
      where,
      include: {
        document: true,
        leadUnit: {
          select: { id: true, name: true, code: true },
        },
        leader: {
          select: { id: true, name: true, email: true },
        },
        unitAssignments: {
          include: {
            driUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
  ]);

  return { total, items };
}
