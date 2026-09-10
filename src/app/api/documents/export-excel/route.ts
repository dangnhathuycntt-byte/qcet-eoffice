import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertQueryStringLength,
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import { ExportDocumentQuerySchema } from "@/contracts/documents";
import { listDocuments } from "@/lib/documents/document-service";
import { generateAppendixIVCsv } from "@/lib/documents/excel-export";
import { isFeatureEnabled } from "@/features/flags";
import { ValidationError } from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import type { DocumentType } from "@/types/document";

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // Rate limiting: strict export tier limit
    assertRateLimit(authUser.id, "EXPORT");

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

    assertQueryStringLength(request);
    const searchParams = request.nextUrl.searchParams;
    const rawParams = Object.fromEntries(searchParams.entries());

    const query = ExportDocumentQuerySchema.safeParse(rawParams);
    if (!query.success) {
      throw new ValidationError(
        "Invalid document export query parameters",
        query.error.flatten().fieldErrors
      );
    }

    const typeParam = query.data.type;
    const type: DocumentType =
      typeParam === "VAN_BAN_DEN" || typeParam === "inbox" ? "VAN_BAN_DEN" : "VAN_BAN_DI";

    const currentYear = new Date().getFullYear();
    const year = query.data.year || query.data.documentYear || currentYear;

    // Fetch documents matching type and year
    const documents = await listDocuments({
      type,
      documentYear: year,
      limit: 5000,
      userContext: authUser,
    });

    const readableDocs = documents.filter((doc) => canReadDocument(authUser, doc));

    // Sort ascending by registrationNumber for chronological registry book ordering
    const sortedDocs = [...readableDocs].sort(
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
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Request-ID": context.requestId,
      },
    });
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // CSRF and rate limiting assertions
    assertCsrf(request);
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);
    assertRateLimit(authUser.id, "EXPORT");

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

    const rawBody = await request.json();
    const query = ExportDocumentQuerySchema.safeParse(rawBody);
    if (!query.success) {
      throw new ValidationError(
        "Invalid document export payload",
        query.error.flatten().fieldErrors
      );
    }

    const typeParam = query.data.type;
    const type: DocumentType =
      typeParam === "VAN_BAN_DEN" || typeParam === "inbox" ? "VAN_BAN_DEN" : "VAN_BAN_DI";

    const currentYear = new Date().getFullYear();
    const year = query.data.year || query.data.documentYear || currentYear;

    const documents = await listDocuments({
      type,
      documentYear: year,
      limit: 5000,
      userContext: authUser,
    });

    const readableDocs = documents.filter((doc) => canReadDocument(authUser, doc));

    const sortedDocs = [...readableDocs].sort(
      (a, b) => a.registrationNumber - b.registrationNumber
    );

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
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Request-ID": context.requestId,
      },
    });
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
