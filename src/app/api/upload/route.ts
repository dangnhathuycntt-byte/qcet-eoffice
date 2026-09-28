import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { assertCsrf } from "@/server/security/csrf";
import { storeUploadedFile } from "@/lib/services/file-service";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    const context = await getApiContext(req);
    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return apiError("Vui lòng gửi tệp trong trường 'file'", requestId);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError(`Tệp quá lớn (tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB)`, requestId);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedFile = await storeUploadedFile({
      uploadedById: authUser.id,
      originalName: file.name,
      declaredMimeType: file.type,
      bytes: buffer,
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
