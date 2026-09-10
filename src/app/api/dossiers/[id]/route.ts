import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { DossierService } from "@/lib/services/dossier-service";

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await Promise.resolve(context.params);
    const dossier = await DossierService.getDossierDetail(authUser, id);

    return apiSuccess(dossier, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}
