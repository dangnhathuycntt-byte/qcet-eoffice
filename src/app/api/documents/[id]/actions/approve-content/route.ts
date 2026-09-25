import { NextRequest } from "next/server";
import { z } from "zod";
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

const ApproveContentSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
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
    const body = await parseAndValidateJson(req, ApproveContentSchema, { allowEmpty: true });

    const result = await OutgoingDocumentService.approveContent(
      {
        documentId: id,
        notes: body.notes ?? undefined,
      },
      authUser,
      { requestId }
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
