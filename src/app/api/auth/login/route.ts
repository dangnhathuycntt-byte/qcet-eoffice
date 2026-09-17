import { ForbiddenError } from "@/server/api/errors";
import { apiError } from "@/server/api/response";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    throw new ForbiddenError(
      "Đăng nhập bằng mật khẩu đã bị vô hiệu hóa. Vui lòng sử dụng tài khoản Google Nhà trường."
    );
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
