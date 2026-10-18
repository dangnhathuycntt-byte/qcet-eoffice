import { NextRequest, NextResponse } from "next/server";
import { getApiContext, requireAuthenticated, type AuthenticatedUser } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertQueryStringLength,
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import { ExportDocumentQuerySchema } from "@qcet/contracts/documents";
import { listDocuments } from "@/server/documents/document-service";
import { generateAppendixIVCsv } from "@/lib/documents/excel-export";
import { isFeatureEnabled } from "@/features/flags";
import { ValidationError } from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import type { DocumentType } from "@qcet/contracts/types/document";
import { resolveDocumentTypeParam } from "@qcet/shared/domain/documents/document-type-param";

/** Operational kill switch: largeExcelExport. */
function featureDisabledResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "Tính năng xuất sổ văn bản Excel/CSV tạm thời bị vô hiệu hóa bởi cấu hình vận hành hệ thống",
      code: "FEATURE_DISABLED",
    },
    { status: 503 }
  );
}

/** Xuất sổ văn bản (Phụ lục IV) dạng CSV theo loại và năm, chỉ gồm văn bản người dùng được đọc. */
async function exportRegistry(authUser: AuthenticatedUser, raw: unknown, invalidMessage: string, requestId: string) {
  const query = ExportDocumentQuerySchema.safeParse(raw);
  if (!query.success) {
    throw new ValidationError(invalidMessage, query.error.flatten().fieldErrors);
  }

  // Sổ chỉ có hai loại: văn bản đến và văn bản đi.
  const type: DocumentType = resolveDocumentTypeParam(query.data.type) === "VAN_BAN_DEN" ? "VAN_BAN_DEN" : "VAN_BAN_DI";
  const year = query.data.year || query.data.documentYear || new Date().getFullYear();

  const documents = await listDocuments({
    type,
    documentYear: year,
    limit: 5000,
    userContext: authUser,
  });

  // Sort ascending by registrationNumber for chronological registry book ordering
  const sortedDocs = documents
    .filter((doc) => canReadDocument(authUser, doc))
    .sort((a, b) => a.registrationNumber - b.registrationNumber);

  // Generate CSV string with UTF-8 BOM
  const csvContent = generateAppendixIVCsv(type, year, sortedDocs);
  const filename = type === "VAN_BAN_DEN" ? `so-van-ban-den-${year}.csv` : `so-van-ban-di-${year}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Request-ID": requestId,
    },
  });
}

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // Rate limiting: strict bulk export tier limit
    await assertRateLimit(authUser.id, "BULK_EXPORT");
    if (!isFeatureEnabled("largeExcelExport")) return featureDisabledResponse();

    assertQueryStringLength(request);
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    return await exportRegistry(authUser, rawParams, "Invalid document export query parameters", context.requestId);
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
    await assertRateLimit(authUser.id, "REPORTS_EXPORT");
    if (!isFeatureEnabled("largeExcelExport")) return featureDisabledResponse();

    const rawBody = await request.json();
    return await exportRegistry(authUser, rawBody, "Invalid document export payload", context.requestId);
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
