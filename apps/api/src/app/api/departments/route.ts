import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { listActiveUnitDirectory } from "@/server/organization/unit-directory";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    requireAuthenticated(context);

    const url = new URL(req.url);
    const includePersonnel = url.searchParams.get("includePersonnel") === "true";

    const mapped = await listActiveUnitDirectory({ includePersonnel });

    return apiSuccess(
      {
        data: mapped,
        departments: mapped,
        total: mapped.length,
      },
      {
        headers: { "Cache-Control": "private, max-age=60" },
        requestId,
        legacyCompat: true,
      },
    );
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" } });
  }
}
