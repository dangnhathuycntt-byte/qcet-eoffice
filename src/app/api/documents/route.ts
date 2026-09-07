import { NextRequest, NextResponse } from "next/server";
import {
  createDocument,
  listDocuments,
  ListDocumentsFilter,
} from "@/lib/documents/document-service";
import { validateDocumentCreatePayload } from "@/lib/documents/document-validator";
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from "@/lib/jwt-session";
import type { DocumentType, DocumentStatus, DocumentUrgency, DocumentSecurityLevel } from "@/types/document";

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const type = searchParams.get("type") as DocumentType | null;
    const yearParam = searchParams.get("year") || searchParams.get("documentYear");
    const status = searchParams.get("status") as DocumentStatus | null;
    const urgency = searchParams.get("urgency") as DocumentUrgency | null;
    const securityLevel = searchParams.get("securityLevel") as DocumentSecurityLevel | null;
    const search = searchParams.get("search") || searchParams.get("q") || undefined;
    const leadDepartmentId = searchParams.get("leadDepartmentId") || undefined;
    const draftingDeptId = searchParams.get("draftingDeptId") || undefined;

    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200) : 50;
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const offset = (page - 1) * limit;

    const filter: ListDocumentsFilter = {
      type: type || undefined,
      documentYear: yearParam ? parseInt(yearParam, 10) : undefined,
      status: status || undefined,
      urgency: urgency || undefined,
      securityLevel: securityLevel || undefined,
      search,
      leadDepartmentId,
      draftingDeptId,
      limit,
      offset,
    };

    const documents = await listDocuments(filter);

    return NextResponse.json({
      success: true,
      data: documents,
      documents,
      total: documents.length,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    const body = await request.json();

    // If session is present and registeredById is not set, set from session
    if (!body.registeredById && session?.id) {
      body.registeredById = session.id;
    }

    const validation = validateDocumentCreatePayload(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const newDoc = await createDocument(body);

    return NextResponse.json(
      {
        success: true,
        data: newDoc,
        document: newDoc,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
