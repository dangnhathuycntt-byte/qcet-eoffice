/**
 * Lý do lỗi của API để hiện cho người dùng: máy chủ trả RFC 9457 (`detail`), một số route cũ trả `message`/`error`.
 * Không có lý do thì dùng `fallback` (thường kèm mã HTTP), không để người dùng đọc "Thao tác thất bại" trần.
 */
export async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  for (const key of ["detail", "message", "error", "title"]) {
    const value = json?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}
