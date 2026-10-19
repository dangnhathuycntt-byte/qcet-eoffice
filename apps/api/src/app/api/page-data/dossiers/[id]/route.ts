/**
 * API Route: /api/page-data/dossiers/[id]
 * GET - Dữ liệu trang chi tiết hồ sơ (src/app/dossiers/[id]/page.tsx): DossierService.getDossierDetail kiểm quyền đọc
 * như GET /api/dossiers/[id]; ngày giờ đổi sang ISO cho giao diện.
 */

import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { NotFoundError } from "@/server/api/errors";
import { DossierService } from "@/server/dossiers/dossier-service";
import type { DossierDetailPageData } from "@qcet/contracts/page-data";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId = crypto.randomUUID();
  try {
    const { id } = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const user = requireAuthenticated(ctx);

    // DossierService.getDossierDetail handles authorization internally (canReadDossier)
    const rawDossier = await DossierService.getDossierDetail(user, id);
    if (!rawDossier) throw new NotFoundError("Không tìm thấy hồ sơ");

    // Serialize dates for client component
    const dossier: DossierDetailPageData["dossier"] = {
      id: rawDossier.id,
      code: rawDossier.code,
      title: rawDossier.title,
      status: rawDossier.status,
      classification: rawDossier.classification,
      storageLocation: rawDossier.storageLocation,
      notes: rawDossier.notes,
      openedAt: rawDossier.openedAt?.toISOString() ?? new Date().toISOString(),
      closedAt: rawDossier.closedAt?.toISOString() ?? null,
      submittedArchiveAt: (rawDossier as any).submittedArchiveAt?.toISOString() ?? null,
      archivedAt: rawDossier.archivedAt?.toISOString() ?? null,
      createdAt: rawDossier.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: rawDossier.updatedAt?.toISOString() ?? null,

      owningUnit: rawDossier.owningUnit,
      responsiblePerson: rawDossier.responsiblePerson,
      archivedBy: rawDossier.archivedBy ?? null,

      retentionRule: rawDossier.retentionRule
        ? {
            id: rawDossier.retentionRule.id,
            code: rawDossier.retentionRule.code,
            name: rawDossier.retentionRule.name,
            durationYears: rawDossier.retentionRule.durationYears,
          }
        : null,

      items: (rawDossier.items ?? []).map((item) => ({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        title: item.title,
        documentNumber: item.documentNumber,
        documentDate: (item.documentDate as Date | null)?.toISOString() ?? null,
        pageCount: item.pageCount,
        sequence: item.sequence,
        notes: item.notes,
        addedAt: (item.addedAt as Date)?.toISOString() ?? null,
        addedBy: item.addedBy ? { id: item.addedBy.id, name: item.addedBy.name } : null,
      })),

      itemCount: rawDossier._count?.items ?? rawDossier.items?.length ?? 0,
    };

    const data: DossierDetailPageData = {
      dossier,
      currentUser: { id: user.id, name: user.name || "Người dùng", role: user.role || "STAFF" },
    };
    return apiSuccess(data, { requestId, headers: NO_STORE });
  } catch (error) {
    return apiError(error, requestId, { headers: NO_STORE });
  }
}
