/**
 * QCET E-Office: Document Deadline Scanner & Web-Push Dispatcher
 *
 * Implements automated scanning of incoming/internal documents nearing deadline (<24h)
 * or past due according to Decree 30/2020/ND-CP administrative standards.
 *
 * Architectural Invariants:
 * 1. Timezone: Indochina Time (ICT, UTC+7, Asia/Ho_Chi_Minh) via `getIctReferenceDateStart`.
 * 2. Transactional Outbox: Every scan event is recorded into `outbox_events` for auditability and at-least-once delivery.
 * 3. Multi-Channel Dispatch: Generates in-app `Notification` records and dispatches VAPID Web-Push to active client subscriptions.
 * 4. Recipient Resolution: Resolves lead users, unit DRIs, department heads, and BGH leaders.
 */

import { prisma as defaultPrisma } from "@/lib/prisma";
import { DocumentStatus, UserRole, type Prisma } from "@prisma/client";
import { getIctReferenceDateStart } from "@/domain/tasks/deadlines";
import {
  publishOutboxEvent,
  OutboxEventType,
  OutboxAggregateType,
  type DbClient,
  type OutboxEventHandler,
} from "@/lib/db/outbox";
import {
  formatDocumentPushPayload,
  sendPushNotificationToUser,
  type PushResult,
} from "@/lib/push-service";

export interface ScanDocumentDeadlinesOptions {
  now?: Date;
  db?: DbClient;
  dryRun?: boolean;
}

export interface DocumentDeadlineDetail {
  documentId: string;
  documentNumber: string;
  summary: string;
  dueDate: string;
  type: "OVERDUE" | "EXPIRING_SOON";
  recipients: string[];
  outboxEventId?: string;
  pushResults?: PushResult[];
}

export interface ScanDocumentDeadlinesResult {
  scannedAt: string;
  scannedCount: number;
  overdueCount: number;
  expiringSoonCount: number;
  outboxEventsCreated: number;
  notificationsCreated: number;
  pushesSent: number;
  items: DocumentDeadlineDetail[];
}

/**
 * Format a Date object or ISO string to ICT DD/MM/YYYY string.
 */
export function formatIctDate(dateVal: Date | string): string {
  const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Resolves target stakeholder user IDs for a given document.
 */
export async function resolveDocumentStakeholders(
  doc: {
    id: string;
    leadUserId?: string | null;
    registeredById?: string | null;
    leadUnitId?: string | null;
    incomingWorkflow?: {
      leaderId?: string | null;
      leadUnitId?: string | null;
      unitAssignments?: Array<{ driUserId: string }>;
    } | null;
  },
  db: DbClient = defaultPrisma
): Promise<string[]> {
  const recipientIds = new Set<string>();

  // 1. Direct lead user (Chuyên viên chủ trì xử lý)
  if (doc.leadUserId) {
    recipientIds.add(doc.leadUserId);
  }

  // 2. Unit assignments DRI users (Chuyên viên thực hiện tại đơn vị)
  if (doc.incomingWorkflow?.unitAssignments && Array.isArray(doc.incomingWorkflow.unitAssignments)) {
    for (const assignment of doc.incomingWorkflow.unitAssignments) {
      if (assignment.driUserId) {
        recipientIds.add(assignment.driUserId);
      }
    }
  }

  // 3. Leadership assignee (Lãnh đạo BGH chỉ đạo)
  if (doc.incomingWorkflow?.leaderId) {
    recipientIds.add(doc.incomingWorkflow.leaderId);
  }

  // 4. Department Heads / Unit Leaders in lead unit
  const targetUnitId = doc.leadUnitId || doc.incomingWorkflow?.leadUnitId;
  if (targetUnitId) {
    try {
      const unit = await db.organizationalUnit.findUnique({
        where: { id: targetUnitId },
        include: {
          positionAssignments: {
            where: { status: "ACTIVE" },
            include: { user: { select: { id: true, role: true } } },
          },
        },
      });

      for (const pa of unit?.positionAssignments ?? []) {
        if (pa.user?.role === UserRole.TRUONG_PHONG || pa.user?.role === UserRole.BAN_GIAM_HIEU) {
          recipientIds.add(pa.user.id);
        }
      }
    } catch (e) {
      console.warn("[resolveDocumentStakeholders] Unit lookup error:", e);
    }
  }

  // 5. Fallback: If no direct assignee found, notify document registrant (Văn thư) or BGH
  if (recipientIds.size === 0) {
    if (doc.registeredById) {
      recipientIds.add(doc.registeredById);
    }
    try {
      const leadershipUsers = await db.user.findMany({
        where: {
          role: { in: [UserRole.BAN_GIAM_HIEU, UserRole.VAN_THU] },
          isActive: true,
        },
        select: { id: true },
        take: 5,
      });
      for (const u of leadershipUsers) {
        recipientIds.add(u.id);
      }
    } catch (e) {
      console.warn("[resolveDocumentStakeholders] Leadership fallback lookup error:", e);
    }
  }

  return Array.from(recipientIds);
}

/**
 * Scans active documents in the database and dispatches notifications for overdue
 * and expiring soon (<24h) deadlines.
 */
export async function scanAndDispatchDocumentDeadlines(
  options: ScanDocumentDeadlinesOptions = {}
): Promise<ScanDocumentDeadlinesResult> {
  const db = options.db ?? defaultPrisma;
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;

  // Compute ICT day boundaries
  const ictTodayStart = getIctReferenceDateStart(now);
  const ictTomorrowStart = new Date(ictTodayStart.getTime() + 24 * 60 * 60 * 1000);
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Query all active documents with a dueDate
  const activeDocuments = await db.document.findMany({
    where: {
      dueDate: { not: null },
      status: {
        notIn: [DocumentStatus.DA_HOAN_THANH, DocumentStatus.LUU_THEO_DOI],
      },
      archivedAt: null,
    },
    include: {
      incomingWorkflow: {
        include: {
          unitAssignments: {
            select: { driUserId: true },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const result: ScanDocumentDeadlinesResult = {
    scannedAt: now.toISOString(),
    scannedCount: activeDocuments.length,
    overdueCount: 0,
    expiringSoonCount: 0,
    outboxEventsCreated: 0,
    notificationsCreated: 0,
    pushesSent: 0,
    items: [],
  };

  for (const doc of activeDocuments) {
    if (!doc.dueDate) continue;

    const dueDate = new Date(doc.dueDate);
    if (isNaN(dueDate.getTime())) continue;

    // Check if overdue or expiring soon
    let deadlineType: "OVERDUE" | "EXPIRING_SOON" | null = null;

    if (dueDate.getTime() < now.getTime()) {
      deadlineType = "OVERDUE";
      result.overdueCount++;
    } else if (
      dueDate.getTime() <= twentyFourHoursFromNow.getTime() ||
      dueDate.getTime() < ictTomorrowStart.getTime()
    ) {
      deadlineType = "EXPIRING_SOON";
      result.expiringSoonCount++;
    }

    if (!deadlineType) {
      continue; // Not yet due or expiring
    }

    // Deduplication & throttling check: Skip if notification for this document
    // and deadlineType was already created in the last 24 hours (or since start of day)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const existingNotification = await db.notification.findFirst({
      where: {
        linkHref: { contains: doc.id },
        type: deadlineType === "OVERDUE" ? "DOCUMENT_OVERDUE" : "DOCUMENT_EXPIRING_SOON",
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (existingNotification) {
      // Already notified within the last 24h, skip to prevent spam
      continue;
    }

    // Resolve target stakeholders
    const targetUserIds = await resolveDocumentStakeholders(doc, db);
    const dueDateStr = formatIctDate(dueDate);
    const docDisplayNumber = doc.originalNumber || String(doc.registrationNumber);

    const detailItem: DocumentDeadlineDetail = {
      documentId: doc.id,
      documentNumber: docDisplayNumber,
      summary: doc.summary,
      dueDate: dueDate.toISOString(),
      type: deadlineType,
      recipients: targetUserIds,
      pushResults: [],
    };

    if (dryRun) {
      result.items.push(detailItem);
      continue;
    }

    // 1. Record Outbox Event (for asynchronous processing by worker)
    const eventType =
      deadlineType === "OVERDUE"
        ? OutboxEventType.DOCUMENT_OVERDUE_NOTIFICATION
        : OutboxEventType.DOCUMENT_EXPIRING_SOON_NOTIFICATION;

    const outboxEvent = await publishOutboxEvent(db, {
      eventType,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: {
        documentId: doc.id,
        documentNumber: docDisplayNumber,
        registrationNumber: doc.registrationNumber,
        documentYear: doc.documentYear,
        summary: doc.summary,
        dueDate: dueDate.toISOString(),
        dueDateStr,
        urgency: doc.urgency,
        type: deadlineType,
        targetUserIds,
        scannedAt: now.toISOString(),
      },
    });

    result.outboxEventsCreated++;
    detailItem.outboxEventId = outboxEvent.id;

    // 2. Format Push Payload & In-App Notification details
    const pushPayload = formatDocumentPushPayload({
      event: deadlineType === "OVERDUE" ? "DOCUMENT_OVERDUE" : "DOCUMENT_EXPIRING_SOON",
      documentId: doc.id,
      documentNumber: docDisplayNumber,
      summary: doc.summary,
      dueDateStr,
      urgency: doc.urgency,
    });

    // 3. Dispatch in-app notifications to all recipients
    for (const userId of targetUserIds) {
      try {
        await db.notification.create({
          data: {
            userId,
            actorName: "Hệ thống Quản lý Văn bản",
            title: pushPayload.title,
            body: pushPayload.body,
            category: "DOCUMENT_DISPATCH",
            type: deadlineType === "OVERDUE" ? "DOCUMENT_OVERDUE" : "DOCUMENT_EXPIRING_SOON",
            linkHref: `/documents?id=${encodeURIComponent(doc.id)}`,
          },
        });
        result.notificationsCreated++;
      } catch (err) {
        console.error(
          `[scanAndDispatchDocumentDeadlines] Failed to notify user ${userId} for doc ${doc.id}:`,
          err
        );
      }
    }

    result.items.push(detailItem);
  }

  return result;
}

/**
 * Outbox event handler for processing DOCUMENT_OVERDUE_NOTIFICATION
 * and DOCUMENT_EXPIRING_SOON_NOTIFICATION asynchronously.
 */
export const documentDeadlineOutboxHandler: OutboxEventHandler = async (event) => {
  const payload = event.payload as {
    documentId: string;
    documentNumber?: string;
    summary: string;
    dueDateStr?: string;
    urgency?: string;
    type: "OVERDUE" | "EXPIRING_SOON";
    targetUserIds?: string[];
  };

  if (!payload || !payload.documentId) {
    throw new Error("Invalid document deadline outbox payload");
  }

  const pushPayload = formatDocumentPushPayload({
    event: payload.type === "OVERDUE" ? "DOCUMENT_OVERDUE" : "DOCUMENT_EXPIRING_SOON",
    documentId: payload.documentId,
    documentNumber: payload.documentNumber,
    summary: payload.summary,
    dueDateStr: payload.dueDateStr,
    urgency: payload.urgency,
  });

  const targetUsers = payload.targetUserIds || [];
  for (const userId of targetUsers) {
    await sendPushNotificationToUser(userId, pushPayload);
  }
};
