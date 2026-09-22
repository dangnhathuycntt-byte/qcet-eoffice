import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { NotFoundError, ForbiddenError, ValidationError } from "@/server/api/errors";
import { DossierService } from "@/lib/services/dossier-service";
import { canReadDossier } from "@/server/policies/dossier-policy";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await Promise.resolve(context.params);

    const dossier = await prisma.workDossier.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            addedBy: { select: { id: true, name: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!dossier) {
      throw new NotFoundError(`Không tìm thấy hồ sơ: ${id}`);
    }

    const hasFullRead = canReadDossier(authUser, dossier);
    let items = dossier.items || [];

    if (!hasFullRead) {
      items = items.filter((item) => item.addedById === authUser.id);
      if (items.length === 0) {
        throw new ForbiddenError("Bạn không có quyền truy cập hồ sơ công việc này");
      }
    }

    return apiSuccess({ items }, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await Promise.resolve(context.params);
    const body = await req.json();

    const result = await DossierService.addItemToDossier(authUser, {
      ...body,
      dossierId: id,
    });

    return apiSuccess(result, { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await Promise.resolve(context.params);
    const url = new URL(req.url);
    let itemId = url.searchParams.get("itemId");

    if (!itemId) {
      try {
        const body = await req.json();
        itemId = body.itemId;
      } catch {
        // no body provided
      }
    }

    if (!itemId) {
      return apiError(new ValidationError("itemId parameter is required"), requestId);
    }

    const result = await DossierService.removeItemFromDossier(authUser, {
      dossierId: id,
      itemId,
    });

    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}
