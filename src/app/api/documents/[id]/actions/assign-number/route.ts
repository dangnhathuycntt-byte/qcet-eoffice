import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentSecurityLevel, DocumentUrgency } from "@prisma/client";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";

const AssignNumberSchema = z.object({
  outgoingNumberStr: z.string().trim().max(100).optional().nullable(),
  codeNotation: z.string().trim().max(100).optional().nullable(),
  issuedDate: z.union([z.string().trim(), z.date()]).optional().nullable(),
  securityLevel: z.nativeEnum(DocumentSecurityLevel).optional().nullable(),
  urgency: z.nativeEnum(DocumentUrgency).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, MAX_JSON_BODY_SIZE);

    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;
    const body = await parseAndValidateJson(req, AssignNumberSchema, { allowEmpty: true });

    const result = await OutgoingDocumentService.assignOutgoingNumber(
      {
        documentId: id,
        outgoingNumberStr: body.outgoingNumberStr ?? undefined,
        codeNotation: body.codeNotation ?? undefined,
        issuedDate: body.issuedDate ? new Date(body.issuedDate) : undefined,
        securityLevel: body.securityLevel ?? undefined,
        urgency: body.urgency ?? undefined,
      },
      authUser,
      { requestId }
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
