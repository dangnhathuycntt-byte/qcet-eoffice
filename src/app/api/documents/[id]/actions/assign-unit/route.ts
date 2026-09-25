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
import { assignUnitWork } from "@/lib/services/incoming-document-service";

const AssignUnitWorkSchema = z.object({
  driUserId: z.string().trim().min(1, "driUserId là bắt buộc"),
  collaboratorUserIds: z.array(z.string().trim()).optional().nullable(),
  instruction: z.string().trim().max(5000).optional().nullable(),
  deadline: z.union([z.string().trim(), z.date()]).optional().nullable(),
  createTask: z.boolean().optional().nullable(),
  taskTitle: z.string().trim().max(255).optional().nullable(),
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
    const body = await parseAndValidateJson(req, AssignUnitWorkSchema, { allowEmpty: false });

    const result = await assignUnitWork(
      {
        documentId: id,
        driUserId: body.driUserId,
        collaboratorUserIds: body.collaboratorUserIds ?? undefined,
        instruction: body.instruction ?? undefined,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        createTask: body.createTask ?? undefined,
        taskTitle: body.taskTitle ?? undefined,
      },
      authUser,
      requestId
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
