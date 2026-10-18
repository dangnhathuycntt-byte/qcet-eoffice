import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { DossierService } from "@/server/dossiers/dossier-service";
import { CreateDossierSchema, DataClassificationSchema, DossierStatusSchema } from "@/contracts/dossiers";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const url = new URL(req.url);
    const statusParam = DossierStatusSchema.safeParse(url.searchParams.get("status"));
    const owningUnitId = url.searchParams.get("owningUnitId") || undefined;
    const responsiblePersonId = url.searchParams.get("responsiblePersonId") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const classification = DataClassificationSchema.safeParse(url.searchParams.get("classification"));
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    const result = await DossierService.listDossiers(authUser, {
      status: statusParam.success ? statusParam.data : undefined,
      owningUnitId,
      responsiblePersonId,
      search,
      classification: classification.success ? classification.data : undefined,
      limit,
      offset,
    });

    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}

export async function POST(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    assertCsrf(req);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const body = await parseAndValidateJson(req, CreateDossierSchema);
    const result = await DossierService.createDossier(authUser, body);

    return apiSuccess(result, { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
