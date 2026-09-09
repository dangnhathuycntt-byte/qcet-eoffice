import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { prisma } from "@/lib/prisma";
import { OutgoingDocumentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    requireAuthenticated(context);

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") as OutgoingDocumentStatus | null;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;
    const search = url.searchParams.get("search") || undefined;

    const where: any = {};
    if (statusParam && Object.values(OutgoingDocumentStatus).includes(statusParam)) {
      where.status = statusParam;
    }
    if (search) {
      where.document = {
        OR: [
          { summary: { contains: search, mode: "insensitive" } },
          { originalNumber: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.documentOutgoingWorkflow.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          document: {
            include: {
              attachments: true,
              signatures: { orderBy: { signedAt: "asc" } },
            },
          },
          contentReviewer: { select: { id: true, name: true, email: true } },
          formatReviewer: { select: { id: true, name: true, email: true } },
          authorizedSigner: { select: { id: true, name: true, email: true } },
          numberer: { select: { id: true, name: true, email: true } },
          orgSigner: { select: { id: true, name: true, email: true } },
          issuer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.documentOutgoingWorkflow.count({ where }),
    ]);

    return apiSuccess({ items, total, limit, offset }, { requestId, status: 200 });
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
    const result = await OutgoingDocumentService.createOutgoingDraft(
      body,
      authUser as any,
      { requestId }
    );

    return apiSuccess(result, {
      requestId,
      status: 201,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
