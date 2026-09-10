import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  registerIncomingDocument,
  listIncomingWorkflows,
} from "@/lib/services/incoming-document-service";
import { IncomingDocumentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") as IncomingDocumentStatus | null;
    const leadUnitId = url.searchParams.get("leadUnitId") || undefined;
    const driUserId = url.searchParams.get("driUserId") || undefined;
    const leaderId = url.searchParams.get("leaderId") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    const result = await listIncomingWorkflows({
      status: statusParam || undefined,
      leadUnitId,
      driUserId,
      leaderId,
      search,
      limit,
      offset,
    });

    return apiSuccess(result, {
      requestId,
      status: 200,
    });
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

    const result = await registerIncomingDocument(
      body,
      authUser as any,
      requestId
    );

    return apiSuccess(result, {
      requestId,
      status: 201,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
