import { NextRequest, NextResponse } from "next/server";
import {
  getDocumentById,
  updateDocument,
} from "@/lib/documents/document-service";
import { validateDocumentUpdatePayload } from "@/lib/documents/document-validator";
import { getSessionFromRequest, SessionPayload } from "@/lib/jwt-session";

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

function getSessionPayload(request: NextRequest): SessionPayload | null {
  return getSessionFromRequest(request);
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "Vui lòng đăng nhập để truy cập văn bản",
          success: false,
          error: "Vui lòng đăng nhập để truy cập văn bản",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const document = await getDocumentById(id);
    if (!document) {
      return NextResponse.json(
        { success: false, error: "Văn bản không tồn tại" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: document,
      document,
    });
  } catch (error: any) {
    console.error("Error fetching document by ID:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "Vui lòng đăng nhập để cập nhật văn bản",
          success: false,
          error: "Vui lòng đăng nhập để cập nhật văn bản",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existing = await getDocumentById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Văn bản không tồn tại" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = validateDocumentUpdatePayload(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const updated = await updateDocument(id, body);

    return NextResponse.json({
      success: true,
      data: updated,
      document: updated,
    });
  } catch (error: any) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
