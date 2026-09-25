import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { checkRateLimit, RATE_LIMIT_TIERS, logRateLimitExceeded } from "@/server/security/rate-limit";
import { prisma } from "@/lib/prisma";
import {
  BatchDocumentRequestSchema,
  type BatchDocumentRequest,
} from "@/contracts/documents";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/api/errors";
import {
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  DocumentStatus,
  DocumentType,
  DossierItemType,
} from "@prisma/client";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import { UnitWorkAssignmentStatusValues } from "@/domain/documents/unit-assignment-status";
import { type AuthenticatedUser, normalizeRole } from "@/server/api/request-context";
import { isAdmin, isManager, isClerk } from "@/server/policies/document-policy";

/**
 * Checks if the user has authorization to perform batch operations on documents.
 * Restricted strictly to:
 * - Ban Giám hiệu / Lãnh đạo trường (Executive Leadership / Admin)
 * - Trưởng đơn vị / Trưởng phòng (Unit Managers)
 * - Văn thư cơ quan / Quản trị hồ sơ (Clerical Staff)
 */
function assertBatchAuthorization(user: AuthenticatedUser) {
  const userAdmin = isAdmin(user);
  const userManager = isManager(user);
  const userClerk = isClerk(user);

  const roleUpper = (user.role || "").toUpperCase();
  const posCode = (user.positionCode || "").toUpperCase();
  const titleUpper = (user.title || "").toUpperCase();

  const isExecutive =
    userAdmin ||
    roleUpper === "BAN_GIAM_HIEU" ||
    roleUpper === "HIEU_TRUONG" ||
    roleUpper === "PHO_HIEU_TRUONG" ||
    posCode === "HIEU_TRUONG" ||
    posCode === "PHO_HIEU_TRUONG";

  const isUnitHead =
    userManager ||
    roleUpper === "TRUONG_PHONG" ||
    roleUpper === "TRUONG_DON_VI" ||
    posCode.includes("TRUONG") ||
    posCode.includes("HEAD");

  const isClericalStaff =
    userClerk ||
    roleUpper === "VAN_THU" ||
    roleUpper === "CLERK" ||
    posCode === "VAN_THU" ||
    titleUpper.includes("VĂN THƯ");

  if (!isExecutive && !isUnitHead && !isClericalStaff) {
    throw new ForbiddenError(
      "Chỉ Ban Giám hiệu, Trưởng đơn vị hoặc Văn thư mới có quyền thực hiện thao tác văn bản hàng loạt.",
      "FORBIDDEN"
    );
  }
}

export interface BatchItemResult {
  documentId: string;
  success: boolean;
  status?: string;
  leadUnitId?: string;
  dossierId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // 1. Role-Based Access Control
    assertBatchAuthorization(authUser);

    // 2. CSRF assertion on mutations
    assertCsrf(request);

    // 3. Content-Type and Body size limits
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    // 4. Rate limiting on mutations
    const rateResult = await checkRateLimit("MUTATION", authUser.id);
    if (!rateResult.success) {
      const retryAfter = rateResult.retryAfter;
      logRateLimitExceeded("MUTATION", authUser.id, request.url, authUser.id).catch(() => undefined);
      return NextResponse.json(
        {
          error: "Too Many Requests",
          code: "RATE_LIMITED",
          retryAt: rateResult.resetAt.toISOString(),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, retryAfter)),
            "X-RateLimit-Limit": String(RATE_LIMIT_TIERS.MUTATION.limit),
            "X-RateLimit-Remaining": String(rateResult.remaining),
          },
        }
      );
    }

    // 5. Parse and validate JSON input
    const rawBody = await request.json();
    const payload: BatchDocumentRequest = BatchDocumentRequestSchema.parse(rawBody);

    const { action, documentIds } = payload;
    const now = new Date();

    // 6. Execute atomic batch operations in prisma.$transaction
    const result = await prisma.$transaction(async (tx) => {
      const successful: BatchItemResult[] = [];
      const failed: BatchItemResult[] = [];

      // Fetch all targeted documents along with their workflows
      const documents = await tx.document.findMany({
        where: { id: { in: documentIds } },
        include: {
          incomingWorkflow: true,
          outgoingWorkflow: true,
        },
      });

      const docMap = new Map(documents.map((d) => [d.id, d]));

      // Check for missing document IDs
      for (const docId of documentIds) {
        if (!docMap.has(docId)) {
          failed.push({
            documentId: docId,
            success: false,
            error: `Văn bản không tồn tại trong hệ thống: ${docId}`,
          });
        }
      }

      // Pre-validation for ASSIGN_LEAD_UNIT
      let targetUnitId: string | null = null;
      if (action === "ASSIGN_LEAD_UNIT" && payload.leadUnitId) {
        const unit = await tx.organizationalUnit.findFirst({
          where: {
            OR: [{ id: payload.leadUnitId }, { code: payload.leadUnitId }],
          },
          select: { id: true, name: true, code: true },
        });

        if (!unit) {
          throw new ValidationError(
            `Đơn vị chủ trì không tồn tại trong hệ thống: ${payload.leadUnitId}`,
            { leadUnitId: ["Đơn vị chủ trì không tồn tại"] }
          );
        }
        targetUnitId = unit.id;
      }

      // Pre-fetch work dossier if dossierId is provided
      let workDossier: { id: string; code: string; items: { sequence: number }[] } | null = null;
      if ((action === "FILE_DOCUMENTS" || action === "ARCHIVE_DOCUMENTS") && payload.dossierId) {
        workDossier = await tx.workDossier.findFirst({
          where: {
            OR: [{ id: payload.dossierId }, { code: payload.dossierId }],
          },
          select: {
            id: true,
            code: true,
            items: { select: { sequence: true } },
          },
        });
      }

      // Process each existing document according to the specified batch action
      for (const doc of documents) {
        try {
          switch (action) {
            // -------------------------------------------------------------
            // 1. MARK_RESOLVED
            // -------------------------------------------------------------
            case "MARK_RESOLVED": {
              const resolutionText =
                payload.resolutionSummary || payload.notes || "Đã giải quyết theo lô";

              // Update incoming workflow if present
              if (doc.incomingWorkflow || (doc.type as string) === DocumentType.VAN_BAN_DEN) {
                await tx.documentIncomingWorkflow.upsert({
                  where: { documentId: doc.id },
                  create: {
                    documentId: doc.id,
                    status: IncomingDocumentStatus.RESOLVED,
                    resolvedAt: now,
                    resolvedById: authUser.id,
                    resolutionSummary: resolutionText,
                  },
                  update: {
                    status: IncomingDocumentStatus.RESOLVED,
                    resolvedAt: now,
                    resolvedById: authUser.id,
                    resolutionSummary: resolutionText,
                  },
                });

                // Mark any unit assignments as RESOLVED
                await tx.unitWorkAssignment.updateMany({
                  where: { workflow: { documentId: doc.id } },
                  data: { status: UnitWorkAssignmentStatusValues.RESOLVED },
                });
              }

              // Update canonical Document
              await tx.document.update({
                where: { id: doc.id },
                data: {
                  status: DocumentStatus.DA_HOAN_THANH,
                  notes: payload.notes
                    ? doc.notes
                      ? `${doc.notes}\n[${now.toLocaleDateString("vi-VN")}]: ${payload.notes}`
                      : payload.notes
                    : doc.notes,
                },
              });

              // Audit Log
              await auditService.logEvent(tx, {
                actorId: authUser.id,
                action: AuditAction.DOCUMENT_RESOLVED,
                entityType: AuditEntityType.DOCUMENT,
                entityId: doc.id,
                requestId,
                beforeData: { status: doc.status },
                afterData: {
                  status: DocumentStatus.DA_HOAN_THANH,
                  resolvedById: authUser.id,
                  resolutionSummary: resolutionText,
                },
                metadata: {
                  batchAction: "MARK_RESOLVED",
                  requestId,
                },
              });

              // Outbox Event
              await publishOutboxEvent(tx, {
                eventType: OutboxEventType.DOCUMENT_RESOLVED_NOTIFICATION,
                aggregateType: OutboxAggregateType.DOCUMENT,
                aggregateId: doc.id,
                payload: {
                  documentId: doc.id,
                  resolvedById: authUser.id,
                  resolutionSummary: resolutionText,
                },
              });

              successful.push({
                documentId: doc.id,
                success: true,
                status: DocumentStatus.DA_HOAN_THANH,
              });
              break;
            }

            // -------------------------------------------------------------
            // 2. ASSIGN_LEAD_UNIT
            // -------------------------------------------------------------
            case "ASSIGN_LEAD_UNIT": {
              if (!targetUnitId) {
                throw new ValidationError("Đơn vị chủ trì (leadUnitId) là bắt buộc.");
              }

              const instruction =
                payload.leadershipInstruction ||
                payload.instruction ||
                "Phân công đơn vị chủ trì xử lý văn bản hàng loạt";
              const deadlineDate = payload.deadline ? new Date(payload.deadline) : null;

              // Update or create incoming workflow
              await tx.documentIncomingWorkflow.upsert({
                where: { documentId: doc.id },
                create: {
                  documentId: doc.id,
                  status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
                  directedAt: now,
                  leaderId: authUser.id,
                  leadUnitId: targetUnitId,
                  leadershipInstruction: instruction,
                  deadline: deadlineDate,
                },
                update: {
                  status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
                  directedAt: now,
                  leaderId: authUser.id,
                  leadUnitId: targetUnitId,
                  leadershipInstruction: instruction,
                  deadline: deadlineDate || doc.incomingWorkflow?.deadline,
                },
              });

              // Update canonical Document status and deadline
              await tx.document.update({
                where: { id: doc.id },
                data: {
                  status: DocumentStatus.DANG_XU_LY,
                  dueDate: deadlineDate || doc.dueDate,
                },
              });

              // Audit Log
              await auditService.logEvent(tx, {
                actorId: authUser.id,
                action: AuditAction.DOCUMENT_DIRECTED,
                entityType: AuditEntityType.DOCUMENT,
                entityId: doc.id,
                requestId,
                beforeData: {
                  status: doc.status,
                  leadUnitId: doc.incomingWorkflow?.leadUnitId,
                },
                afterData: {
                  status: DocumentStatus.DANG_XU_LY,
                  leadUnitId: targetUnitId,
                  instruction,
                  deadline: deadlineDate,
                },
                metadata: {
                  batchAction: "ASSIGN_LEAD_UNIT",
                  requestId,
                },
              });

              // Outbox Event
              await publishOutboxEvent(tx, {
                eventType: OutboxEventType.DOCUMENT_DIRECTIVE_NOTIFICATION,
                aggregateType: OutboxAggregateType.DOCUMENT,
                aggregateId: doc.id,
                payload: {
                  documentId: doc.id,
                  leadUnitId: targetUnitId,
                  leaderId: authUser.id,
                  instruction,
                  deadline: deadlineDate,
                },
              });

              successful.push({
                documentId: doc.id,
                success: true,
                status: "ASSIGNED_TO_LEAD_UNIT",
                leadUnitId: targetUnitId,
              });
              break;
            }

            // -------------------------------------------------------------
            // 3. FILE_DOCUMENTS
            // -------------------------------------------------------------
            case "FILE_DOCUMENTS": {
              const archiveNow = Boolean(payload.archiveNow);
              const targetWorkflowStatus = archiveNow
                ? IncomingDocumentStatus.ARCHIVED
                : IncomingDocumentStatus.FILED;
              const dossierCode =
                payload.dossierId ||
                (workDossier
                  ? workDossier.code
                  : `HS-${doc.documentYear || now.getFullYear()}-${doc.registrationNumber}`);
              const filingNotes =
                payload.filingNotes ||
                payload.storageLocation ||
                `Lập hồ sơ lưu trữ ${dossierCode}`;

              // Update incoming workflow if applicable
              if (doc.incomingWorkflow || (doc.type as string) === DocumentType.VAN_BAN_DEN) {
                await tx.documentIncomingWorkflow.upsert({
                  where: { documentId: doc.id },
                  create: {
                    documentId: doc.id,
                    status: targetWorkflowStatus,
                    filedAt: now,
                    filedById: authUser.id,
                    dossierId: dossierCode,
                    filingNotes,
                    ...(archiveNow ? { archivedAt: now, archivedById: authUser.id } : {}),
                  },
                  update: {
                    status: targetWorkflowStatus,
                    filedAt: now,
                    filedById: authUser.id,
                    dossierId: dossierCode,
                    filingNotes: filingNotes || doc.incomingWorkflow?.filingNotes,
                    ...(archiveNow ? { archivedAt: now, archivedById: authUser.id } : {}),
                  },
                });
              }

              // Update outgoing workflow if applicable
              if (doc.outgoingWorkflow || (doc.type as string) === DocumentType.VAN_BAN_DI) {
                if (doc.outgoingWorkflow) {
                  await tx.documentOutgoingWorkflow.update({
                    where: { documentId: doc.id },
                    data: {
                      status: archiveNow
                        ? OutgoingDocumentStatus.ARCHIVED
                        : OutgoingDocumentStatus.FILED,
                      filedAt: now,
                      filedById: authUser.id,
                      dossierId: dossierCode,
                      ...(archiveNow ? { archivedAt: now, archivedById: authUser.id } : {}),
                    },
                  });
                }
              }

              // Update canonical Document
              await tx.document.update({
                where: { id: doc.id },
                data: {
                  status: DocumentStatus.LUU_THEO_DOI,
                  archiveReason: filingNotes,
                  ...(archiveNow ? { archivedAt: now, archivedById: authUser.id } : {}),
                },
              });

              // Link document item into WorkDossier if matching dossier exists
              if (workDossier) {
                const existingItem = await tx.dossierItem.findFirst({
                  where: {
                    dossierId: workDossier.id,
                    itemType: DossierItemType.DOCUMENT,
                    itemId: doc.id,
                  },
                });

                if (!existingItem) {
                  const maxSeq = workDossier.items.reduce(
                    (max, it) => (it.sequence > max ? it.sequence : max),
                    0
                  );
                  const newItem = await tx.dossierItem.create({
                    data: {
                      dossierId: workDossier.id,
                      itemType: DossierItemType.DOCUMENT,
                      itemId: doc.id,
                      title: doc.summary,
                      documentNumber: doc.originalNumber || String(doc.registrationNumber),
                      documentDate: doc.issuedDate,
                      sequence: maxSeq + 1,
                      addedById: authUser.id,
                      notes: filingNotes,
                    },
                  });
                  workDossier.items.push({ sequence: newItem.sequence });
                }
              }

              // Audit Log
              await auditService.logEvent(tx, {
                actorId: authUser.id,
                action: AuditAction.DOCUMENT_FILED,
                entityType: AuditEntityType.DOCUMENT,
                entityId: doc.id,
                requestId,
                beforeData: { status: doc.status },
                afterData: {
                  status: archiveNow ? "ARCHIVED" : "FILED",
                  dossierId: dossierCode,
                  storageLocation: payload.storageLocation,
                  filedById: authUser.id,
                  filingNotes,
                },
                metadata: {
                  batchAction: "FILE_DOCUMENTS",
                  archiveNow,
                  requestId,
                },
              });

              // Outbox Event
              await publishOutboxEvent(tx, {
                eventType: OutboxEventType.DOCUMENT_FILED_NOTIFICATION,
                aggregateType: OutboxAggregateType.DOCUMENT,
                aggregateId: doc.id,
                payload: {
                  documentId: doc.id,
                  dossierId: dossierCode,
                  filedById: authUser.id,
                  status: archiveNow ? "ARCHIVED" : "FILED",
                },
              });

              successful.push({
                documentId: doc.id,
                success: true,
                status: archiveNow ? "ARCHIVED" : "FILED",
                dossierId: dossierCode,
              });
              break;
            }

            // -------------------------------------------------------------
            // 4. ARCHIVE_DOCUMENTS
            // -------------------------------------------------------------
            case "ARCHIVE_DOCUMENTS": {
              const archiveReason =
                payload.archiveReason ||
                payload.notes ||
                payload.storageLocation ||
                "Chuyển lưu trữ văn bản theo lô";

              // Update incoming workflow if applicable
              if (doc.incomingWorkflow || (doc.type as string) === DocumentType.VAN_BAN_DEN) {
                await tx.documentIncomingWorkflow.upsert({
                  where: { documentId: doc.id },
                  create: {
                    documentId: doc.id,
                    status: IncomingDocumentStatus.ARCHIVED,
                    archivedAt: now,
                    archivedById: authUser.id,
                    filingNotes: archiveReason,
                  },
                  update: {
                    status: IncomingDocumentStatus.ARCHIVED,
                    archivedAt: now,
                    archivedById: authUser.id,
                    filingNotes: archiveReason || doc.incomingWorkflow?.filingNotes,
                  },
                });
              }

              // Update outgoing workflow if applicable
              if (doc.outgoingWorkflow || (doc.type as string) === DocumentType.VAN_BAN_DI) {
                if (doc.outgoingWorkflow) {
                  await tx.documentOutgoingWorkflow.update({
                    where: { documentId: doc.id },
                    data: {
                      status: OutgoingDocumentStatus.ARCHIVED,
                      archivedAt: now,
                      archivedById: authUser.id,
                    },
                  });
                }
              }

              // Update canonical Document
              await tx.document.update({
                where: { id: doc.id },
                data: {
                  status: DocumentStatus.LUU_THEO_DOI,
                  archivedAt: now,
                  archivedById: authUser.id,
                  archiveReason,
                },
              });

              // Audit Log
              await auditService.logEvent(tx, {
                actorId: authUser.id,
                action: AuditAction.DOCUMENT_FILED,
                entityType: AuditEntityType.DOCUMENT,
                entityId: doc.id,
                requestId,
                beforeData: { status: doc.status },
                afterData: {
                  status: "ARCHIVED",
                  archivedAt: now,
                  archivedById: authUser.id,
                  archiveReason,
                },
                metadata: {
                  batchAction: "ARCHIVE_DOCUMENTS",
                  requestId,
                },
              });

              // Outbox Event
              await publishOutboxEvent(tx, {
                eventType: OutboxEventType.DOCUMENT_FILED_NOTIFICATION,
                aggregateType: OutboxAggregateType.DOCUMENT,
                aggregateId: doc.id,
                payload: {
                  documentId: doc.id,
                  archivedById: authUser.id,
                  status: "ARCHIVED",
                  archiveReason,
                },
              });

              successful.push({
                documentId: doc.id,
                success: true,
                status: "ARCHIVED",
              });
              break;
            }
          }
        } catch (itemErr: any) {
          failed.push({
            documentId: doc.id,
            success: false,
            error: itemErr.message || "Lỗi xử lý văn bản trong lô",
          });
        }
      }

      return {
        action,
        total: documentIds.length,
        successCount: successful.length,
        failureCount: failed.length,
        successful,
        failed,
      };
    });

    return apiSuccess(
      {
        success: true,
        data: result,
        summary: {
          total: result.total,
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId,
        status: 200,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
