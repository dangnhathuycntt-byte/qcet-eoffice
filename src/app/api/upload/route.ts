import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { isAllowedFileExtension } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
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

    if (!isAllowedFileExtension(file.name)) {
      const ext = path.extname(file.name).toLowerCase();
      return apiError(`Loại tệp không được phép: ${ext}`, requestId);
    }

    // Generate unique filename: taskFiles/<date>/<uuid><ext>
    const ext = path.extname(file.name).toLowerCase();
    const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const relPath = path.join("taskFiles", dateDir, uniqueName);
    const absPath = path.join(UPLOADS_DIR, relPath);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absPath, buffer);

    // Return URL that /api/files/[...path] can serve
    const fileUrl = `/api/files/${relPath}`;

    return apiSuccess({
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, { requestId });
  } catch (err: any) {
    return apiError(err, requestId);
  }
}
