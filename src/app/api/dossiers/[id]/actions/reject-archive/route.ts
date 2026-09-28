import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { DossierService } from "@/lib/services/dossier-service";
import { RejectArchiveSchema } from "@/contracts/dossiers";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { readOptionalJsonBody } from "@/server/api/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    assertCsrf(req);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const { id } = await Promise.resolve(context.params);
    const body = RejectArchiveSchema.parse(await readOptionalJsonBody(req));
    const result = await DossierService.rejectArchive(authUser, {
      ...body,
      dossierId: id,
    });

    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
