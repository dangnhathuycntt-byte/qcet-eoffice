import { NextRequest, NextResponse } from "next/server";
import { listDocuments } from "@/lib/documents/document-service";
import { generateAppendixIVCsv } from "@/lib/documents/excel-export";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { isFeatureEnabled } from "@/features/flags";
import type { DocumentType } from "@/types/document";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "Vui lòng đăng nhập để xuất sổ văn bản",
          success: false,
          error: "Vui lòng đăng nhập để xuất sổ văn bản",
        },
        { status: 401 }
      );
    }

    // Operational kill switch: largeExcelExport
    if (!isFeatureEnabled("largeExcelExport")) {
      return NextResponse.json(
        {
          success: false,
          error: "Tính năng xuất sổ văn bản Excel/CSV tạm thời bị vô hiệu hóa bởi cấu hình vận hành hệ thống",
          code: "FEATURE_DISABLED",
        },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get("type");

    let type: DocumentType;
    if (typeParam === "VAN_BAN_DEN" || typeParam === "inbox") {
      type = "VAN_BAN_DEN";
    } else if (typeParam === "VAN_BAN_DI" || typeParam === "outbox") {
      type = "VAN_BAN_DI";
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid document type. Expected 'VAN_BAN_DEN' or 'VAN_BAN_DI'",
        },
        { status: 400 }
      );
    }

    const yearParam = searchParams.get("year") || searchParams.get("documentYear");
    const currentYear = new Date().getFullYear();
    const year = yearParam ? parseInt(yearParam, 10) || currentYear : currentYear;

    // Fetch documents matching type and year
    const documents = await listDocuments({
      type,
      documentYear: year,
      limit: 5000,
    });

    // Sort ascending by registrationNumber for chronological registry book ordering
    const sortedDocs = [...documents].sort(
      (a, b) => a.registrationNumber - b.registrationNumber
    );

    // Generate CSV string with UTF-8 BOM
    const csvContent = generateAppendixIVCsv(type, year, sortedDocs);

    const filename =
      type === "VAN_BAN_DEN"
        ? `so-van-ban-den-${year}.csv`
        : `so-van-ban-di-${year}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Error exporting document registry Excel:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
