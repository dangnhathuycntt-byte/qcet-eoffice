import { NextRequest } from "next/server";
import { z } from "zod";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { AuthorizationError } from "@/server/api/errors";
import { assertRateLimit } from "@/server/security/rate-limit";
import { canCreateDocument } from "@/server/policies/document-policy";
import { findSuspectedDuplicates } from "@/lib/documents/duplicate-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  originalNumber: z.string().trim().min(1).max(100),
  issuingAuthority: z.string().trim().min(1).max(255),
  excludeId: z.string().trim().max(64).optional(),
});

/**
 * GET /api/documents/duplicate-check?originalNumber=&issuingAuthority=
 * Văn bản đến trùng số ký hiệu và cơ quan ban hành, trong phạm vi người dùng được đọc (V-02).
 */
export async function GET(request: NextRequest): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "DEFAULT_API");

    if (!canCreateDocument(authUser)) {
      throw new AuthorizationError("Bạn không có quyền đăng ký văn bản", "FORBIDDEN");
    }

    const params = request.nextUrl.searchParams;
    const query = QuerySchema.parse({
      originalNumber: params.get("originalNumber") ?? "",
      issuingAuthority: params.get("issuingAuthority") ?? "",
      excludeId: params.get("excludeId") ?? undefined,
    });

    const matches = await findSuspectedDuplicates(authUser, query, { excludeId: query.excludeId });
    return apiSuccess({ matches }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
