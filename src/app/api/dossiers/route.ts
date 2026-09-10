import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { DossierService } from "@/lib/services/dossier-service";
import { DossierStatus, DataClassification } from "@prisma/client";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") as DossierStatus | null;
    const owningUnitId = url.searchParams.get("owningUnitId") || undefined;
    const responsiblePersonId = url.searchParams.get("responsiblePersonId") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const classification = url.searchParams.get("classification") as DataClassification | null;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    const result = await DossierService.listDossiers(authUser, {
      status: statusParam && Object.values(DossierStatus).includes(statusParam) ? statusParam : undefined,
      owningUnitId,
      responsiblePersonId,
      search,
      classification: classification && Object.values(DataClassification).includes(classification) ? classification : undefined,
      limit,
      offset,
    });

    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const body = await req.json();
    const result = await DossierService.createDossier(authUser, body);

    return apiSuccess(result, { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId);
  }
}
