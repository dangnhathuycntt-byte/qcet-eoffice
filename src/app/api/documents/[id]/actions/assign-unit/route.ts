import { z } from "zod";
import { assignUnitWork } from "@/server/documents/incoming-document-service";
import { withIdempotency } from "@/server/api/idempotency";
import { ValidationError } from "@/server/api/errors";
import { documentActionRoute } from "../shared";

const AssignUnitWorkSchema = z.object({
  driUserId: z.string().trim().min(1, "driUserId là bắt buộc"),
  collaboratorUserIds: z.array(z.string().trim()).optional().nullable(),
  instruction: z.string().trim().max(5000).optional().nullable(),
  deadline: z.union([z.string().trim(), z.date()]).optional().nullable(),
  createTask: z.boolean().optional().nullable(),
  taskTitle: z.string().trim().max(255).optional().nullable(),
});

export const POST = documentActionRoute(AssignUnitWorkSchema, async (user, body, { documentId, requestId, req }) => {
  const command = {
    documentId,
    driUserId: body.driUserId,
    collaboratorUserIds: body.collaboratorUserIds ?? undefined,
    instruction: body.instruction ?? undefined,
    deadline: body.deadline ? new Date(body.deadline) : undefined,
    createTask: body.createTask ?? undefined,
    taskTitle: body.taskTitle ?? undefined,
  };
  const execute = () => assignUnitWork(command, user, requestId);
  if (!command.createTask) return execute();

  const rawKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
  const idempotencyKey = rawKey?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) {
    throw new ValidationError(
      "Giao việc có tạo Task cần gửi Idempotency-Key (tối đa 255 ký tự).",
      { "Idempotency-Key": ["Bắt buộc khi createTask=true; độ dài tối đa 255 ký tự."] },
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }
  return withIdempotency(
    {
      userId: user.id,
      operation: `document.incoming.assign-unit:${documentId}`,
      key: idempotencyKey,
      payload: command,
    },
    execute
  );
});
