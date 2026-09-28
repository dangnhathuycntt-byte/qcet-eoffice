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
import { assignUnitWork } from "@/lib/services/incoming-document-service";
import { withIdempotency } from "@/lib/db/idempotency";
import { ValidationError } from "@/server/api/errors";

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
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const { id } = await context.params;
    const body = await parseAndValidateJson(req, AssignUnitWorkSchema, { allowEmpty: false });

    const command = {
        documentId: id,
        driUserId: body.driUserId,
        collaboratorUserIds: body.collaboratorUserIds ?? undefined,
        instruction: body.instruction ?? undefined,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        createTask: body.createTask ?? undefined,
        taskTitle: body.taskTitle ?? undefined,
    };
    const execute = () => assignUnitWork(command, authUser, requestId);

    let result;
    if (command.createTask) {
      const rawKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
      const idempotencyKey = rawKey?.trim();
      if (!idempotencyKey || idempotencyKey.length > 255) {
        throw new ValidationError(
          "Giao việc có tạo Task cần gửi Idempotency-Key (tối đa 255 ký tự).",
          { "Idempotency-Key": ["Bắt buộc khi createTask=true; độ dài tối đa 255 ký tự."] },
          "IDEMPOTENCY_KEY_REQUIRED"
        );
      }
      result = await withIdempotency(
        {
          userId: authUser.id,
          operation: `document.incoming.assign-unit:${id}`,
          key: idempotencyKey,
          payload: command,
        },
        execute
      );
    } else {
      result = await execute();
    }

    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
