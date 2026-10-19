/** Giới hạn tệp của `POST /api/upload` (10MB): chặn sớm để báo đúng thay vì lỗi máy chủ. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export interface UploadedFile {
  fileUrl: string;
  fileName: string;
}

/**
 * Tải một tệp lên `POST /api/upload`. `taskId` gắn tệp với nhiệm vụ đã có; lúc soạn nhiệm vụ mới thì bỏ trống (máy chủ
 * cho người đọc được nhiệm vụ tải tệp khi mô tả chứa mã tệp và người tạo nhiệm vụ là người tải lên).
 * Lỗi ném `Error` kèm lời báo tiếng Việt, ưu tiên lời của máy chủ.
 */
export async function uploadFile(file: File, options: { taskId?: string } = {}): Promise<UploadedFile> {
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new Error(`Tệp quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa ${UPLOAD_MAX_BYTES / 1024 / 1024}MB`);
  }
  const form = new FormData();
  form.append("file", file);
  if (options.taskId) form.append("taskId", options.taskId);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: form });
  } catch {
    throw new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại");
  }
  if (!res.ok) {
    // Hiện đúng nguyên nhân từ máy chủ (quyền, dung lượng, định dạng, giới hạn tần suất...)
    const body = await res.json().catch(() => null);
    const serverMsg = (typeof body?.error === "string" ? body.error : body?.error?.message) || body?.message || "";
    const fallback =
      res.status === 401 ? "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại"
      : res.status === 403 ? "Bạn không có quyền tải tệp lên nhiệm vụ này"
      : res.status === 413 ? "Tệp quá lớn (tối đa 10MB)"
      : res.status === 429 ? "Tải lên quá nhanh, vui lòng thử lại sau ít giây"
      : `Máy chủ từ chối tải lên (mã ${res.status})`;
    throw new Error(serverMsg || fallback);
  }
  const json = await res.json().catch(() => null);
  const data = json?.data ?? json;
  if (!data?.fileUrl) throw new Error("Máy chủ không trả về đường dẫn tệp");
  return data as UploadedFile;
}
