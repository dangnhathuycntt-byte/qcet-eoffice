import { ForbiddenError } from "@/server/api/errors";
import { apiError } from "@/server/api/response";
import { getApiContext } from "@/server/api/request-context";

export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    // P0 Hotfix: Vô hiệu hóa hoàn toàn endpoint đăng ký tự do
    throw new ForbiddenError("Đăng ký công khai đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên");
  } catch (error) {
    // Canonical error handling adheres to RFC 7807 problem details (status: 403 Forbidden)
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
