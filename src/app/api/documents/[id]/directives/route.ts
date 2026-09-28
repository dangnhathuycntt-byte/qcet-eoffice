import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import { canReadDocument } from "@/server/policies/document-policy";
import { toDocumentDirectiveDTOArray } from "@/server/dto/document-dto";
import { CreateDirectiveSchema } from "@/contracts/documents";
import { getDocumentById } from "@/lib/documents/document-service";
import { directDocument } from "@/lib/services/incoming-document-service";
import { OrganizationalUnitService } from "@/server/services/organization-unit-service";
import { AuthorizationError, NotFoundError, ValidationError } from "@/server/api/errors";

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

    const document = await getDocumentById(id);
    if (!document) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // Object-level authorization check (BOLA prevention)
    if (!canReadDocument(authUser, document)) {
      throw new AuthorizationError(
        "Bạn không có quyền truy cập văn bản này (Forbidden)",
        "FORBIDDEN"
      );
    }

    // Preserve read access to historical directives. New bút phê commands are
    // stored on DocumentIncomingWorkflow and do not create these legacy rows.
    const directiveRows = await prisma.documentDirective.findMany({
      where: { documentId: id },
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        document: {
          select: {
            linkedTask: {
              select: {
                id: true,
                code: true,
                leadUnit: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const directives = directiveRows.map(({ document: parent, ...dir }) => ({
      ...dir,
      linkedTask: parent?.linkedTask ?? null,
    }));

    return apiSuccess(
      {
        success: true,
        data: directives,
        directives: toDocumentDirectiveDTOArray(directives),
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

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const { id } = await context.params;
    const validated = await parseAndValidateJson(request, CreateDirectiveSchema, {
      allowEmpty: false,
    });

    // This compatibility endpoint accepts the legacy directive payload but
    // delegates to the canonical Tier-1 command. A directive only routes the
    // document; it never creates a Task or writes a second workflow.
    const leadUnit = await OrganizationalUnitService.resolveUnitRef(validated.leadUnitId!);
    if (!leadUnit) {
      throw new ValidationError(
        `Đơn vị chủ trì "${validated.leadUnitId}" không tồn tại trong hệ thống đơn vị.`,
        { leadUnitId: [`Không tìm thấy đơn vị với id/mã "${validated.leadUnitId}"`] },
        "ORG_UNIT_NOT_FOUND"
      );
    }

    let coordinatingUnitIds: string[] = [];
    if (Array.isArray(validated.collaboratorIds)) {
      coordinatingUnitIds = validated.collaboratorIds;
    } else if (typeof validated.collaboratorIds === "string" && validated.collaboratorIds.trim()) {
      try {
        const parsed: unknown = JSON.parse(validated.collaboratorIds);
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
          coordinatingUnitIds = parsed;
        } else {
          coordinatingUnitIds = [validated.collaboratorIds.trim()];
        }
      } catch {
        coordinatingUnitIds = [validated.collaboratorIds.trim()];
      }
    }

    const instruction = (validated.instruction || validated.content)!;
    const result = await directDocument(
      {
        documentId: id,
        leadUnitId: leadUnit.id,
        coordinatingUnitIds,
        leadershipInstruction: instruction,
        deadline: validated.deadline ? new Date(validated.deadline) : undefined,
      },
      authUser,
      requestId
    );

    const legacyData = {
      workflow: result.workflow,
      directive: null,
      task: null,
      document: result.document,
    };
    return apiSuccess(
      { data: legacyData, ...legacyData },
      {
        headers: { "Cache-Control": "private, no-store" },
        legacyCompat: true,
        requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      rfc9457: true,
      instance: request.nextUrl.pathname,
    });
  }
}
