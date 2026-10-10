/** Handler outbox cho xét hủy hồ sơ (V-07): thông báo trong ứng dụng, người nhận tính khi xử lý. */
import { AssignmentStatus } from "@prisma/client";
import { OutboxEventType, type DbClient, type OutboxHandlerMap } from "@/lib/db/outbox";
import type { OutboxEvent } from "@prisma/client";

function payloadOf(event: OutboxEvent): Record<string, unknown> {
  const p = event.payload;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

const str = (p: Record<string, unknown>, key: string): string | null => {
  const v = p[key];
  return typeof v === "string" && v.trim() ? v : null;
};

async function executiveIds(db: DbClient): Promise<string[]> {
  const rows = await db.positionAssignment.findMany({
    where: { status: AssignmentStatus.ACTIVE, positionDefinition: { code: { in: ["HIEU_TRUONG", "PHO_HIEU_TRUONG"] } } },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

async function notify(db: DbClient, dossierId: string, recipients: string[], actorId: string | null, n: { type: string; title: string; body: string }) {
  const ids = [...new Set(recipients)].filter((id) => id && id !== actorId);
  if (ids.length === 0) return [];
  const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
  await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      actorName: actor?.name || "Hệ thống",
      title: n.title,
      body: n.body,
      category: "DOSSIER_ARCHIVE",
      type: n.type,
      linkHref: `/dossiers/${encodeURIComponent(dossierId)}`,
    })),
  });
  return ids;
}

export const DOSSIER_NOTIFICATION_HANDLERS: OutboxHandlerMap = {
  // Văn thư đề nghị xét hủy: báo lãnh đạo quyết định.
  [OutboxEventType.DOSSIER_DISPOSAL_PROPOSED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const dossier = await db.workDossier.findUnique({ where: { id: str(p, "dossierId") ?? event.aggregateId } });
    const proposal = await db.dossierDisposalProposal.findUnique({ where: { id: str(p, "proposalId") ?? "" } });
    if (!dossier || !proposal || proposal.status !== "PROPOSED") return { skipped: "closed" };
    return notify(db, dossier.id, await executiveIds(db), str(p, "proposedById"), {
      type: "dossier_disposal_proposed",
      title: "Đề nghị xét hủy hồ sơ chờ bạn quyết định",
      body: `${dossier.code}: ${dossier.title}. Biên bản ${proposal.minutesReference}.`,
    });
  },

  // Lãnh đạo quyết định: báo người lập đề nghị.
  [OutboxEventType.DOSSIER_DISPOSAL_DECIDED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const dossier = await db.workDossier.findUnique({ where: { id: str(p, "dossierId") ?? event.aggregateId } });
    const proposal = await db.dossierDisposalProposal.findUnique({ where: { id: str(p, "proposalId") ?? "" } });
    if (!dossier || !proposal) return { skipped: "missing" };
    const disposed = proposal.status === "DISPOSE";
    return notify(db, dossier.id, [proposal.proposedById], str(p, "deciderId"), {
      type: "dossier_disposal_decided",
      title: disposed ? "Lãnh đạo quyết định hủy hồ sơ" : "Lãnh đạo quyết định gia hạn bảo quản hồ sơ",
      body: `${dossier.code}: ${dossier.title}.${disposed ? "" : ` Gia hạn thêm ${proposal.extendYears ?? 0} năm.`}`,
    });
  },
};
