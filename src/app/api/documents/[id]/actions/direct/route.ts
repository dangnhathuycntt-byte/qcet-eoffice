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
import { directDocument } from "@/lib/services/incoming-document-service";

const DirectDocumentSchema = z
  .object({
    leadUnitId: z.string().trim().min(1, "leadUnitId là bắt buộc"),
    coordinatingUnitIds: z.array(z.string().trim()).optional().nullable(),
    leadershipInstruction: z.string().trim().max(5000).optional().nullable(),
    instruction: z.string().trim().max(5000).optional().nullable(),
    deadline: z.union([z.string().trim(), z.date()]).optional().nullable(),
    responsibilityAreaId: z.string().trim().max(64).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.leadershipInstruction && data.leadershipInstruction.trim().length > 0) ||
          (data.instruction && data.instruction.trim().length > 0)
      ),
    {
      message: "Ý kiến chỉ đạo / bút phê (leadershipInstruction hoặc instruction) là bắt buộc",
      path: ["leadershipInstruction"],
    }
  );

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
    const body = await parseAndValidateJson(req, DirectDocumentSchema, { allowEmpty: false });

    const leadershipInstruction = (body.leadershipInstruction || body.instruction)!;

    const result = await directDocument(
      {
        documentId: id,
        leadUnitId: body.leadUnitId,
        coordinatingUnitIds: body.coordinatingUnitIds ?? undefined,
        leadershipInstruction,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        responsibilityAreaId: body.responsibilityAreaId ?? undefined,
        notes: body.notes ?? undefined,
      },
      authUser,
      requestId
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
