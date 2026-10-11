import { ResolveDocumentSchema } from "@/contracts/documents";
import { resolveDocument } from "@/lib/services/incoming-document-service";
import { withIdempotency } from "@/lib/db/idempotency";
import { ValidationError } from "@/server/api/errors";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  ResolveDocumentSchema,
  (user, body, { documentId, requestId, req }) => {
    const command = {
      documentId,
      resolutionSummary: body.resolutionSummary,
      resolutionDocUrl: body.resolutionDocUrl ?? undefined,
      notes: body.notes ?? undefined,
    };
    const rawKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
    const idempotencyKey = rawKey?.trim();
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new ValidationError(
        "Xác nhận giải quyết văn bản cần gửi Idempotency-Key (tối đa 255 ký tự).",
        { "Idempotency-Key": ["Bắt buộc; độ dài tối đa 255 ký tự."] },
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    }

    return withIdempotency(
      {
        userId: user.id,
        operation: `document.incoming.resolve:${documentId}`,
        key: idempotencyKey,
        payload: command,
      },
      () => resolveDocument(command, user, requestId)
    );
  },
  { allowEmpty: true, legacyErrors: true }
);
