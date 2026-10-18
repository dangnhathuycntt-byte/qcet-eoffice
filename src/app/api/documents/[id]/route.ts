import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  canUpdateDocument,
  canDeleteDocument,
} from "@/server/policies/document-policy";
import { toDocumentDetailDTO } from "@/server/dto/document-dto";
import { UpdateDocumentSchema } from "@/contracts/documents";
import {
  applyDocumentPatch,
  deleteDocumentCascade,
  getDocumentById,
  isDocumentMarked,
} from "@/server/documents/document-service";
import { isDocumentImmutable } from "@/server/documents/state-machine";
import { validateDocumentUpdatePayload } from "@/lib/documents/document-validator";
import {
  NotFoundError,
  AuthorizationError,
  ForbiddenError,
  ValidationError,
} from "@/server/api/errors";
import {
  loadAuthorizationContext,
  computeAvailableActions,
  buildDocumentResource,
  authorize,
} from "@/server/authorization";
import { readDocumentForUser } from "@/server/documents/read-document-for-user";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);

    const { id } = await Promise.resolve(context.params);

    const authContext = await loadAuthorizationContext(authUser.id);
    const { document, docResource } = await readDocumentForUser(authContext, id);

    const availableActions = computeAvailableActions(
      authContext,
      docResource
    );

    const marked = await isDocumentMarked(id, authUser.id);
    const documentDTO = toDocumentDetailDTO(document);
    // Cùng điều kiện với PATCH và bổ sung tệp: UI chỉ hiện "Sửa"/"Thêm tệp" khi thao tác thực sự được phép
    const canEdit = canUpdateDocument(authContext, document) && !isDocumentImmutable(document);

    return apiSuccess(
      {
        success: true,
        data: {
          ...document,
          availableActions,
          canEdit,
          marked,
        },
        document: {
          ...documentDTO,
          availableActions,
          canEdit,
          marked,
        },
        availableActions,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: apiContext.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);

    // 1. CSRF assertion on mutations
    assertCsrf(request);

    // 2. Content-Type and Body size limits
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    // 3. Rate limiting on mutations
    await assertRateLimit(authUser.id, "MUTATION");

    const { id } = await Promise.resolve(context.params);

    const existing = await getDocumentById(id);
    if (!existing) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // 4. Enforce Immutability (signed / issued / resolved / filed)
    if (isDocumentImmutable(existing)) {
      throw new ValidationError(
        "Văn bản đã được ký hoặc đã ban hành/hoàn thành/lưu trữ là bất biến, không thể chỉnh sửa metadata.",
        undefined,
        "IMMUTABLE_DOCUMENT"
      );
    }

    // 5. Object-level authorization check (BOLA prevention)
    const authContext = await loadAuthorizationContext(authUser.id);
    const docResource = buildDocumentResource(existing);
    const updateDecision = authorize(authContext, 'document.review_content', docResource);
    if ((!updateDecision.allowed && !canUpdateDocument(authUser, existing)) || !canUpdateDocument(authUser, existing)) {
      throw new ForbiddenError(
        updateDecision.reason || "Bạn không có quyền cập nhật văn bản này (Forbidden)"
      );
    }

    // 6. Input validation
    const rawBody = await request.json();

    // 5b. Enforce Generic PATCH Restrictions (F10)
    const FORBIDDEN_PATCH_FIELDS = [
      "status",
      "signedAt",
      "signer",
      "signerName",
      "signerTitle",
      "authorizedSignerId",
      "authorizedSignedAt",
      "documentNumber",
      "registrationNumber",
      "originalNumber",
      "outgoingNumber",
      "numbererId",
      "numberedAt",
      "issuedAt",
      "issuedDate",
      "registeredDate",
      "type",
      "version",
    ];

    const attemptedForbidden = FORBIDDEN_PATCH_FIELDS.filter(
      (field) => rawBody[field] !== undefined
    );

    if (attemptedForbidden.length > 0) {
      throw new ValidationError(
        `Các trường [${attemptedForbidden.join(
          ", "
        )}] không được phép cập nhật qua generic PATCH. Vui lòng sử dụng canonical workflow command tương ứng.`,
        undefined,
        "CANONICAL_COMMAND_REQUIRED"
      );
    }

    // Contract validation
    const validated = UpdateDocumentSchema.parse(rawBody);

    // Business rules validation
    const validation = validateDocumentUpdatePayload(rawBody);
    if (!validation.isValid) {
      throw new ValidationError(
        validation.errors[0] || "Dữ liệu cập nhật văn bản không hợp lệ",
        {
          general: validation.errors,
        }
      );
    }

    // S-1: gắn/đổi/gỡ nhiệm vụ liên kết được kiểm quyền và ghi nhật ký trong transaction có khóa dòng (xem service).
    const updated = await applyDocumentPatch(id, validated, { authUser, authContext, requestId });

    return apiSuccess(
      {
        success: true,
        data: updated,
        document: toDocumentDetailDTO(updated),
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: apiContext.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);

    // 1. CSRF assertion on mutations
    assertCsrf(request);

    // 2. Rate limiting on mutations
    await assertRateLimit(authUser.id, "MUTATION");

    const { id } = await Promise.resolve(context.params);

    const existing = await getDocumentById(id);
    if (!existing) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // 2b. Enforce Immutability (signed / issued / resolved / filed)
    if (isDocumentImmutable(existing)) {
      throw new ValidationError(
        "Văn bản đã được ký hoặc đã ban hành/hoàn thành là bất biến, không thể xóa.",
        undefined,
        "IMMUTABLE_DOCUMENT"
      );
    }

    // 3. Object-level authorization check (BOLA prevention)
    const authContext = await loadAuthorizationContext(authUser.id);
    const docResource = buildDocumentResource(existing);
    const deleteDecision = authorize(authContext, 'document.archive', docResource);
    // Cổng thật là canDeleteDocument; engine chỉ góp lý do từ chối.
    if (!canDeleteDocument(authUser, existing)) {
      throw new ForbiddenError(
        deleteDecision.reason || "Bạn không có quyền xóa văn bản này (Forbidden)"
      );
    }

    // 4. Atomic transaction cleanup and deletion
    await deleteDocumentCascade(id);

    return apiSuccess(
      {
        success: true,
        message: "Đã xóa văn bản thành công",
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: apiContext.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
