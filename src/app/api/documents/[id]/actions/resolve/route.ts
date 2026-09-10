import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveDocument } from "@/lib/services/incoming-document-service";

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;
    const body = await req.json();

    const result = await resolveDocument(
      {
        documentId: id,
        resolutionSummary: body.resolutionSummary,
        resolutionDocUrl: body.resolutionDocUrl,
        notes: body.notes,
      },
      authUser as any,
      requestId
    );

    return apiSuccess(result, {
      requestId,
      status: 200,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
