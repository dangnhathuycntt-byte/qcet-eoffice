import { NextRequest } from "next/server";
import { z } from "zod";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { RecipientsSchema } from "@/server/documents/outgoing-recipients";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";

const IssueDocumentSchema = z.object({
  recipientList: z.string().trim().max(2000).optional().nullable(),
  recipients: RecipientsSchema.optional(),
  replacesDocumentId: z.string().trim().min(1).optional(),
  deliveryMethod: z.string().trim().max(100).optional().nullable(),
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
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const { id } = await context.params;
    const body = await parseAndValidateJson(req, IssueDocumentSchema, { allowEmpty: true });

    const result = await OutgoingDocumentService.issueDocument(
      {
        documentId: id,
        recipientList: body.recipientList ?? undefined,
        recipients: body.recipients,
        replacesDocumentId: body.replacesDocumentId,
        deliveryMethod: body.deliveryMethod ?? undefined,
        notes: body.notes ?? undefined,
      },
      authUser,
      { requestId }
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
