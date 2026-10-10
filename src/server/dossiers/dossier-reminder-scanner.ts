/**
 * Nhắc hồ sơ (V-07): nhắc người phụ trách nộp lưu trước hạn 30 ngày, báo Văn thư khi hồ sơ hết
 * hạn bảo quản. Mỗi nhắc nhở gắn khóa (hồ sơ, loại, mốc) với ràng buộc duy nhất nên không gửi trùng.
 */
import { AssignmentStatus, DossierStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRetentionExpired, isSubmitReminderDue, retentionEnd, submitDeadline } from "@/domain/dossiers/disposal-rules";

type Db = Prisma.TransactionClient | typeof prisma;

export interface DossierReminderResult {
  sent: Record<string, number>;
  skippedDuplicate: number;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

async function clerkIds(db: Db): Promise<string[]> {
  const rows = await db.positionAssignment.findMany({
    where: { status: AssignmentStatus.ACTIVE, positionDefinition: { code: { in: ["VAN_THU", "CLERK"] } } },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

async function deliver(
  db: Db,
  args: { dossierId: string; kind: string; dueKey: string; recipientIds: string[]; type: string; title: string; body: string },
  result: DossierReminderResult
) {
  if (args.recipientIds.length === 0) return;
  const claimed = await db.dossierReminderLog.createMany({
    data: [{ dossierId: args.dossierId, kind: args.kind, dueKey: args.dueKey }],
    skipDuplicates: true,
  });
  if (claimed.count === 0) {
    result.skippedDuplicate++;
    return;
  }
  try {
    await db.notification.createMany({
      data: args.recipientIds.map((userId) => ({
        userId,
        actorName: "Hệ thống",
        title: args.title,
        body: args.body,
        category: "DOSSIER_ARCHIVE",
        type: args.type,
        linkHref: `/dossiers/${encodeURIComponent(args.dossierId)}`,
      })),
    });
    result.sent[args.kind] = (result.sent[args.kind] ?? 0) + 1;
  } catch (error) {
    await db.dossierReminderLog.deleteMany({ where: { dossierId: args.dossierId, kind: args.kind, dueKey: args.dueKey } });
    throw error;
  }
}

export async function scanDossierReminders(options: { now?: Date; db?: Db; dossierIds?: string[] } = {}): Promise<DossierReminderResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? prisma;
  const scope: Prisma.WorkDossierWhereInput = options.dossierIds ? { id: { in: options.dossierIds } } : {};
  const result: DossierReminderResult = { sent: {}, skippedDuplicate: 0 };

  // 1. Nhắc nộp lưu cơ quan: hồ sơ đã đóng mà chưa nộp, còn không quá 30 ngày hoặc đã qua hạn 1 năm.
  const closed = await db.workDossier.findMany({
    where: { ...scope, disposedAt: null, status: { in: [DossierStatus.CLOSED, DossierStatus.READY_FOR_ARCHIVE] }, closedAt: { not: null } },
    select: { id: true, code: true, title: true, closedAt: true, responsiblePersonId: true },
  });
  for (const d of closed) {
    if (!isSubmitReminderDue(d.closedAt, now)) continue;
    const deadline = submitDeadline(d.closedAt) as Date;
    await deliver(db, {
      dossierId: d.id,
      kind: "SUBMIT_DEADLINE_30D",
      dueKey: dayKey(deadline),
      recipientIds: [d.responsiblePersonId],
      type: "dossier_submit_deadline",
      title: "Hồ sơ sắp đến hạn nộp lưu trữ",
      body: `${d.code}: ${d.title}. Hạn nộp lưu trữ cơ quan ${deadline.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`,
    }, result);
  }

  // 2. Hết hạn bảo quản: báo Văn thư lập đề nghị xét hủy. Một lần cho mỗi mốc hết hạn.
  const archived = await db.workDossier.findMany({
    where: { ...scope, disposedAt: null, status: DossierStatus.ARCHIVED, archivedAt: { not: null }, retentionRule: { durationYears: { not: null } } },
    include: { retentionRule: true, disposalProposals: { where: { status: "PROPOSED" }, select: { id: true } } },
  });
  const clerks = archived.length ? await clerkIds(db) : [];
  for (const d of archived) {
    const input = { archivedAt: d.archivedAt, ruleYears: d.retentionRule?.durationYears ?? null, extraYears: d.retentionExtraYears };
    if (!isRetentionExpired(input, now) || d.disposalProposals.length > 0) continue;
    const end = retentionEnd(input) as Date;
    await deliver(db, {
      dossierId: d.id,
      kind: "RETENTION_EXPIRED",
      dueKey: dayKey(end),
      recipientIds: clerks,
      type: "dossier_retention_expired",
      title: "Hồ sơ hết hạn bảo quản",
      body: `${d.code}: ${d.title}. Cần lập đề nghị xét hủy hoặc gia hạn bảo quản.`,
    }, result);
  }

  return result;
}
