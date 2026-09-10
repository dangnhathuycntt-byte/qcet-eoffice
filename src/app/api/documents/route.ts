import { NextRequest } from "next/server";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  assertQueryStringLength,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import { canReadDocument, canCreateDocument } from "@/server/policies/document-policy";
import { toDocumentListDTOArray, toDocumentDetailDTO } from "@/server/dto/document-dto";
import { DocumentQuerySchema, CreateDocumentSchema } from "@/contracts/documents";
import {
  createDocument,
  listDocuments,
  type CreateDocumentPayload,
  type ListDocumentsFilter,
} from "@/lib/documents/document-service";
import { validateDocumentCreatePayload } from "@/lib/documents/document-validator";
import { AuthorizationError, ValidationError } from "@/server/api/errors";
import type { DocumentType } from "@/types/document";

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    assertQueryStringLength(request);
    const searchParams = request.nextUrl.searchParams;
    const rawParams = Object.fromEntries(searchParams.entries());
    const query = DocumentQuerySchema.parse(rawParams);

    const searchQuery = query.search || query.q;
    if (searchQuery && searchQuery.trim().length > 0) {
      assertRateLimit(authUser.id, "SEARCH");
    }

    let docType: DocumentType | undefined;
    if (query.type === "VAN_BAN_DEN" || query.type === "INCOMING" || query.type === "inbox") {
      docType = "VAN_BAN_DEN";
    } else if (query.type === "VAN_BAN_DI" || query.type === "OUTGOING" || query.type === "outbox") {
      docType = "VAN_BAN_DI";
    } else if (query.type === "TO_TRINH_NOI_BO" || query.type === "INTERNAL") {
      docType = "TO_TRINH_NOI_BO";
    }

    const limit = query.limit ?? query.pageSize ?? 50;
    const page = query.page ?? 1;
    const offset = (page - 1) * limit;

    const filter: ListDocumentsFilter = {
      type: docType,
      documentYear: query.documentYear || query.year,
      status: query.status as any,
      urgency: query.urgency as any,
      securityLevel: query.securityLevel as any,
      leadDepartmentId: query.leadDepartmentId || query.departmentId,
      draftingDeptId: query.draftingDeptId,
      search: searchQuery,
      limit,
      offset,
    };

    const documents = await listDocuments(filter);

    // Object-level authorization filtering (BOLA prevention)
    const readableDocs = documents.filter((doc) => canReadDocument(authUser, doc));

    return apiSuccess(
      {
        success: true,
        data: readableDocs,
        documents: toDocumentListDTOArray(readableDocs),
        total: readableDocs.length,
        page,
        limit,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // 1. CSRF assertion on mutations
    assertCsrf(request);

    // 2. Content-Type and Body size limits
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    // 3. Rate limiting on mutations
    assertRateLimit(authUser.id, "MUTATION");

    // 4. Authorization check
    if (!canCreateDocument(authUser)) {
      throw new AuthorizationError("Bạn không có quyền tạo văn bản (Forbidden)", "FORBIDDEN");
    }

    // 5. Parse and validate JSON input
    const rawBody = await request.json();

    // Anti-spoofing: registeredById cannot be supplied by client
    delete rawBody.registeredById;

    // Validate using Zod contract schema
    const validated = CreateDocumentSchema.parse(rawBody);

    // Also run Decree 30 validator for institutional business rules
    const institutionalValidation = validateDocumentCreatePayload({
      ...rawBody,
      registeredById: authUser.id,
    });
    if (!institutionalValidation.isValid) {
      throw new ValidationError(
        institutionalValidation.errors[0] || "Dữ liệu văn bản không hợp lệ",
        {
          general: institutionalValidation.errors,
        }
      );
    }

    let docType: DocumentType = "VAN_BAN_DEN";
    if (validated.type === "VAN_BAN_DI" || validated.type === "OUTGOING") {
      docType = "VAN_BAN_DI";
    } else if (validated.type === "TO_TRINH_NOI_BO" || validated.type === "INTERNAL") {
      docType = "TO_TRINH_NOI_BO";
    }

    const payload: CreateDocumentPayload = {
      type: docType,
      documentYear: validated.documentYear || undefined,
      registrationNumber: validated.registrationNumber || undefined,
      registeredDate: validated.registeredDate || undefined,
      originalNumber: (validated.originalNumber || validated.documentNumber)!,
      issuedDate: validated.issuedDate || new Date(),
      issuingAuthority: validated.issuingAuthority || "QCET",
      category: validated.category || "Công văn",
      summary: (validated.summary || validated.title)!,
      urgency: (validated.urgency as any) || "THUONG",
      securityLevel: (validated.securityLevel as any) || "THUONG",
      dueDate: validated.dueDate || null,
      signerName: validated.signerName || null,
      signerTitle: validated.signerTitle || null,
      draftingDeptId: validated.draftingDeptId || validated.departmentId || null,
      recipientList: validated.recipientList || null,
      distributedCopies: validated.distributedCopies ?? 1,
      leadDepartmentId: validated.leadDepartmentId || null,
      leadUserId: validated.leadUserId || null,
      notes: validated.notes || null,
      registeredById: authUser.id, // Strictly anti-spoofed!
      attachments: validated.attachments as any,
    };

    const newDoc = await createDocument(payload);

    return apiSuccess(
      {
        success: true,
        data: {
          ...newDoc,
          registeredById: authUser.id,
        },
        document: toDocumentDetailDTO(newDoc),
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
