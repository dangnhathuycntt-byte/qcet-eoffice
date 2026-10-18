/**
 * Thao tác văn bản hàng loạt (POST /api/documents/batch): giao đơn vị chủ trì, lưu hồ sơ.
 * Mỗi văn bản gọi đúng command đơn lẻ (máy trạng thái, phân quyền theo văn bản, ánh xạ ADR-004) và chạy
 * độc lập, không có transaction bao ngoài: lỗi của một văn bản ghi vào `failed` kèm mã lỗi như thao tác
 * đơn lẻ, không ảnh hưởng văn bản khác.
 * Route đã kiểm vai trò, CSRF, giới hạn tần suất và validate payload trước khi gọi.
 */
import { prisma } from "@qcet/db/prisma";
import {
  DocumentType,
  DossierItemType,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
} from "@prisma/client";
import type { AuthenticatedUser } from "@/server/api/request-context";
import type { BatchDocumentRequest } from "@qcet/contracts/documents";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
  toApiErrorResponse,
} from "@/server/api/errors";
import { assertAuthorized } from "@/server/authorization/hybrid-authorization";
import { assertDossierNotImmutable } from "@/domain/dossiers/state-machine";
import { logger } from "@/server/observability/logger";
import {
  directDocument,
  fileDocument,
  resolveUserContext,
} from "@/server/documents/incoming-document-service";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { DossierService } from "@/server/dossiers/dossier-service";

export interface BatchItemResult {
  documentId: string;
  success: boolean;
  status?: string;
  leadUnitId?: string;
  dossierId?: string;
  /**
   * Mã lỗi như thao tác đơn lẻ trả về (INVALID_TRANSITION, INSUFFICIENT_CAPABILITY, NOT_FOUND...);
   * ALREADY_FILED/ALREADY_ASSIGNED khi văn bản đã ở trạng thái đích của thao tác.
   */
  code?: string;
  /** HTTP status thao tác đơn lẻ trả về cho văn bản này. */
  httpStatus?: number;
  error?: string;
}

type BatchDocument = {
  id: string;
  type: DocumentType;
  incomingWorkflow: { dossierId: string | null; status: IncomingDocumentStatus } | null;
  outgoingWorkflow: { status: OutgoingDocumentStatus } | null;
};

function unsupportedDocumentType() {
  return new ValidationError("Thao tác không áp dụng cho loại văn bản này.", undefined, "UNSUPPORTED_DOCUMENT_TYPE");
}

function toFailure(documentId: string, err: unknown, requestId: string, action: string): BatchItemResult {
  const { status, body } = toApiErrorResponse(err, requestId);
  if (status >= 500) {
    logger.error("document.batch.item_failed", { metadata: { requestId, documentId, action } }, err);
  }
  return {
    documentId,
    success: false,
    code: body.code,
    httpStatus: status,
    // Lỗi không lường trước (vd lỗi Prisma) không lộ chi tiết hệ thống ra ngoài
    error: status >= 500 ? "Lỗi xử lý văn bản trong lô" : body.message,
  };
}

export async function processDocumentBatch(
  payload: BatchDocumentRequest,
  authUser: AuthenticatedUser,
  requestId: string
) {
  const { action } = payload;
  const documentIds = [...new Set(payload.documentIds)];
  const user = await resolveUserContext(authUser);

  // Đơn vị chủ trì tra theo id hoặc mã; không tồn tại thì từ chối cả lô.
  let leadUnitId: string | null = null;
  if (action === "ASSIGN_LEAD_UNIT" && payload.leadUnitId) {
    const unit = await prisma.organizationalUnit.findFirst({
      where: { OR: [{ id: payload.leadUnitId }, { code: payload.leadUnitId }] },
      select: { id: true },
    });
    if (!unit) {
      throw new ValidationError(
        `Đơn vị chủ trì không tồn tại trong hệ thống: ${payload.leadUnitId}`,
        { leadUnitId: ["Đơn vị chủ trì không tồn tại"] }
      );
    }
    leadUnitId = unit.id;
  }

  // dossierId khớp hồ sơ công việc thì gắn văn bản qua DossierService; không khớp thì giữ như mã hồ sơ tự do.
  const workDossier =
    action === "FILE_DOCUMENTS" && payload.dossierId
      ? await prisma.workDossier.findFirst({
          where: { OR: [{ id: payload.dossierId }, { code: payload.dossierId }] },
          select: {
            id: true,
            code: true,
            status: true,
            owningUnitId: true,
            responsiblePersonId: true,
            disposedAt: true,
            items: {
              where: { itemType: DossierItemType.DOCUMENT, itemId: { in: documentIds } },
              select: { itemId: true },
            },
          },
        })
      : null;
  const alreadyInDossier = new Set(workDossier?.items.map((item) => item.itemId));

  const documents: BatchDocument[] = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: {
      id: true,
      type: true,
      incomingWorkflow: { select: { dossierId: true, status: true } },
      outgoingWorkflow: { select: { status: true } },
    },
  });
  const docMap = new Map(documents.map((d) => [d.id, d]));

  async function fileOne(doc: BatchDocument): Promise<BatchItemResult> {
    const isOutgoing = doc.type === DocumentType.VAN_BAN_DI;
    if (!isOutgoing && doc.type !== DocumentType.VAN_BAN_DEN) throw unsupportedDocumentType();
    // Máy trạng thái cho phép FILED→FILED: lưu lại sẽ ghi đè thông tin lưu hồ sơ (ADR-004 §4) kèm audit/outbox trùng.
    const alreadyFiled = isOutgoing
      ? doc.outgoingWorkflow?.status === OutgoingDocumentStatus.FILED
      : doc.incomingWorkflow?.status === IncomingDocumentStatus.FILED;
    if (alreadyFiled) throw new InvalidTransitionError("Văn bản đã được lưu hồ sơ.", "ALREADY_FILED");
    // Hồ sơ đã hủy (xóa mềm) coi như không tồn tại, như tra cứu hồ sơ thường.
    if (workDossier?.disposedAt) throw new NotFoundError(`Không tìm thấy hồ sơ: ${payload.dossierId}`);

    const linkDossier = workDossier && !alreadyInDossier.has(doc.id) ? workDossier : null;
    if (linkDossier) {
      // Kiểm trước (không ghi) các điều kiện gắn hồ sơ như DossierService.addItemToDossier, rồi lưu xong mới gắn:
      // dòng bị từ chối không để lại thay đổi nào trên hồ sơ hay văn bản.
      assertDossierNotImmutable(linkDossier.status, "thêm tài liệu vào");
      await assertAuthorized(user, "dossier.add_item", {
        type: "dossier",
        id: linkDossier.id,
        owningUnitId: linkDossier.owningUnitId,
        dossierOwnerId: linkDossier.responsiblePersonId,
      });
      // fileDocument ghi đè liên kết hồ sơ của văn bản, nên phải chặn văn bản đã thuộc hồ sơ khác trước khi lưu.
      const linkedId = doc.incomingWorkflow?.dossierId;
      if (linkedId && linkedId !== linkDossier.id && linkedId !== linkDossier.code) {
        throw new ConflictError("Văn bản đã thuộc một hồ sơ công việc khác.", "INCOMING_DOCUMENT_DOSSIER_ALREADY_LINKED");
      }
    }

    const filed: { status: string; dossierId?: string } = isOutgoing
      ? await OutgoingDocumentService.fileOutgoingDocument(
          { documentId: doc.id, filingNotes: payload.filingNotes ?? undefined },
          user,
          { requestId }
        ).then((workflow) => ({ status: workflow.status, dossierId: workDossier?.id }))
      : await fileDocument(
          {
            documentId: doc.id,
            // Không chọn hồ sơ thì giữ liên kết hồ sơ sẵn có, tránh ghi đè bằng mã tự sinh.
            dossierId: workDossier?.id ?? payload.dossierId ?? doc.incomingWorkflow?.dossierId ?? undefined,
            filingNotes: payload.filingNotes ?? undefined,
            storageLocation: payload.storageLocation ?? undefined,
          },
          user,
          requestId
        ).then((workflow) => ({ status: workflow.status, dossierId: workflow.dossierId ?? undefined }));

    if (linkDossier) {
      try {
        await DossierService.linkDocument(user, { dossierId: linkDossier.id, documentId: doc.id });
      } catch (err) {
        // Văn bản đã lưu nhưng gắn hồ sơ lỗi (vd hồ sơ vừa bị đóng): báo riêng để không hiểu nhầm là chưa xử lý.
        const failure = toFailure(doc.id, err, requestId, action);
        return {
          ...failure,
          status: filed.status,
          code: "DOSSIER_LINK_FAILED",
          error: `Văn bản đã lưu nhưng chưa gắn được vào hồ sơ: ${failure.error}`,
        };
      }
    }
    return { documentId: doc.id, success: true, ...filed };
  }

  const successful: BatchItemResult[] = [];
  const failed: BatchItemResult[] = [];

  for (const documentId of documentIds) {
    try {
      const doc = docMap.get(documentId);
      if (!doc) throw new NotFoundError(`Văn bản không tồn tại trong hệ thống: ${documentId}`);

      if (action === "ASSIGN_LEAD_UNIT") {
        if (doc.type !== DocumentType.VAN_BAN_DEN) throw unsupportedDocumentType();
        // Máy trạng thái cho phép tự chuyển: bút phê lại sẽ thay đơn vị, ý kiến chỉ đạo, hạn và gửi lại thông báo.
        if (doc.incomingWorkflow?.status === IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT) {
          throw new InvalidTransitionError("Văn bản đã được giao đơn vị chủ trì.", "ALREADY_ASSIGNED");
        }
        const workflow = await directDocument(
          {
            documentId,
            leadUnitId: leadUnitId!,
            leadershipInstruction: (payload.leadershipInstruction || payload.instruction)!,
            deadline: payload.deadline ? new Date(payload.deadline) : undefined,
          },
          user,
          requestId
        );
        successful.push({ documentId, success: true, status: workflow.status, leadUnitId: leadUnitId! });
      } else {
        const result = await fileOne(doc);
        (result.success ? successful : failed).push(result);
      }
    } catch (err) {
      failed.push(toFailure(documentId, err, requestId, action));
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
}
