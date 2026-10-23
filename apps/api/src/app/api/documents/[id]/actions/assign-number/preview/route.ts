import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Xem trước hộp Cấp số: số sẽ cấp, ký hiệu mặc định, khoảng ngày ban hành. Không ghi gì; chỉ người cấp số được gọi. */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);
    await assertRateLimit(authUser.id, "DEFAULT_API");
    const { id } = await context.params;

    const preview = await OutgoingDocumentService.previewAssignNumber(id, authUser);
    return apiSuccess(
      { success: true, data: preview },
      { headers: { "Cache-Control": "private, no-store" }, requestId }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" }, legacyCompat: true });
  }
}
