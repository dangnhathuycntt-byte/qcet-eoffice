import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { assertCsrf } from "@/server/security/csrf";
import { storeUploadedFile } from "@/lib/services/file-service";
import { prisma } from "@/lib/prisma";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskReadWhere } from "@/server/tasks/task-query-service";
import { ForbiddenError, PayloadTooLargeError } from "@/server/api/errors";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    const context = await getApiContext(req);
    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    // Next đệm body request ở middleware và cắt khi vượt middlewareClientMaxBodySize;
    // body bị cắt làm formData() ném lỗi. Báo đúng nguyên nhân thay vì 500.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new PayloadTooLargeError(
        `Không đọc được tệp tải lên. Tệp có thể vượt quá ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }
    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return apiError("Vui lòng gửi tệp trong trường 'file'", requestId);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError(`Tệp quá lớn (tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB)`, requestId);
    }

    const taskId = formData.get("taskId");
    let taskMetadata: { taskId: string } | undefined;
    if (taskId && typeof taskId === "string" && taskId.trim().length > 0) {
      const authorizationContext = await loadAuthorizationContext(authUser.id, new Date(), {
        useCache: true,
      });
      const taskReadWhere = buildTaskReadWhere(authorizationContext);
      const task = await prisma.task.findFirst({
        where: {
          id: taskId.trim(),
          ...taskReadWhere,
        },
        select: { id: true },
      });
      if (!task) {
        throw new ForbiddenError("Không có quyền truy cập nhiệm vụ để tải tệp");
      }
      taskMetadata = { taskId: task.id };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedFile = await storeUploadedFile({
      uploadedById: authUser.id,
      originalName: file.name,
      declaredMimeType: file.type,
      bytes: buffer,
      metadata: taskMetadata,
    });
    const fileUrl = `/api/file-objects/${storedFile.id}`;

    return apiSuccess({
      fileUrl,
      fileId: storedFile.id,
      fileName: storedFile.originalName,
      fileSize: Number(storedFile.byteSize),
      mimeType: storedFile.mimeType,
      contentHash: storedFile.contentHash,
      scanStatus: storedFile.scanStatus,
      deduplicated: storedFile.deduplicated,
    }, { requestId });
  } catch (err: any) {
    return apiError(err, requestId);
  }
}
