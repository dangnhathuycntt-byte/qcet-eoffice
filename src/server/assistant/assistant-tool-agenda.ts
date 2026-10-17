/**
 * Công cụ hộp việc và lịch họp của Trợ lý (chỉ đọc).
 * Hộp việc đi qua ActionInboxService; lịch họp đi qua MeetingService luôn có authz (buildMeetingReadWhere).
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AssistantSourceRef } from "@/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { ActionInboxService } from "@/server/services/action-inbox-service";
import { MeetingService } from "@/server/services/meeting-service";
import { assistantSourceHref } from "@/domain/assistant/assistant-sources";
import { CalendarDate, clip, ictDate, ictDateTime, isCalendarDate, redactContact, ToolFailure } from "./assistant-tool-shared";
import { isRestrictedDocument } from "./assistant-tool-documents";

/** Số việc tối đa trong hộp việc. */
export const INBOX_LIST_LIMIT = 20;
/** Số lịch họp tối đa trong một lần liệt kê. */
export const MEETING_LIST_LIMIT = 20;
/** Cỡ trang khi lấy lịch họp từ dịch vụ. */
export const MEETING_FETCH_LIMIT = 100;
/** Khoảng ngày tối đa của một lần xem lịch họp. */
export const MEETING_RANGE_MAX_DAYS = 31;

const DOCUMENT_RESOURCE_TYPES = new Set(["INCOMING_DOCUMENT", "OUTGOING_DOCUMENT"]);
const RESTRICTED_DOSSIER_CLASSES = new Set(["RESTRICTED", "PERSONAL_DATA"]);

/** Nhãn trạng thái cuộc họp, khớp STATUS_CONFIG trong meeting-detail-view.tsx. */
const MEETING_STATUS_LABEL: Record<string, string> = {
  DRAFT_AGENDA: "Dự thảo chương trình",
  INVITED: "Đã mời",
  HELD: "Đã họp",
  MINUTES_DRAFT: "Dự thảo biên bản",
  MINUTES_CONFIRMED: "Biên bản đã duyệt",
  CANCELLED: "Đã hủy",
};

export const InboxArgs = z.object({}).strict();

export const ListMeetingsArgs = z
  .object({
    from: CalendarDate,
    to: CalendarDate,
    query: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine(
    (value) => {
      if (!isCalendarDate(value.from) || !isCalendarDate(value.to)) return true;
      const days = (Date.parse(`${value.to}T00:00:00+07:00`) - Date.parse(`${value.from}T00:00:00+07:00`)) / 86_400_000;
      return days >= 0 && days < MEETING_RANGE_MAX_DAYS;
    },
    { message: `from phải trước hoặc bằng to, và khoảng cách tối đa ${MEETING_RANGE_MAX_DAYS} ngày.` }
  );
export type ListMeetingsInput = z.infer<typeof ListMeetingsArgs>;

/** Mốc UTC `Z` của 00:00 giờ Việt Nam ngày `from`, và mốc chặn trên của ngày `to` (23:59:59.999, vì service dùng lte). */
export function meetingWindow(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00+07:00`).getTime();
  const nextDayStart = new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000;
  return { from: new Date(start).toISOString(), to: new Date(nextDayStart - 1).toISOString() };
}

function shortDayMonth(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

export function meetingRangeLabel(input: ListMeetingsInput): string {
  return `Xem lịch họp ${shortDayMonth(input.from)}–${shortDayMonth(input.to)}`;
}

export interface InboxRead {
  total: number;
  truncated: boolean;
  items: Array<Record<string, unknown>>;
  sources: AssistantSourceRef[];
}

/** Hộp việc của người hỏi, bỏ văn bản mật/hạn chế và hồ sơ RESTRICTED/PERSONAL_DATA. */
export async function readInbox(userId: string): Promise<InboxRead> {
  const response = await ActionInboxService.getActionInbox(userId);

  const documentIds = response.items
    .filter((item) => DOCUMENT_RESOURCE_TYPES.has(item.resourceType))
    .map((item) => item.resourceId);
  const documentRows = documentIds.length
    ? await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, securityLevel: true, notes: true },
      })
    : [];
  const allowedDocumentIds = new Set(documentRows.filter((row) => !isRestrictedDocument(row)).map((row) => row.id));

  const kept = response.items.filter((item) => {
    if (DOCUMENT_RESOURCE_TYPES.has(item.resourceType)) return allowedDocumentIds.has(item.resourceId);
    if (item.resourceType === "DOSSIER") {
      return !RESTRICTED_DOSSIER_CLASSES.has(String(item.classification ?? "").toUpperCase());
    }
    return true;
  });

  const shown = kept.slice(0, INBOX_LIST_LIMIT);
  const sources: AssistantSourceRef[] = [];
  for (const item of shown) {
    if (item.resourceType === "TASK") {
      sources.push({
        type: "task",
        id: item.resourceId,
        code: item.resourceCode,
        title: clip(item.title, 200),
        href: assistantSourceHref("task", item.resourceId),
      });
    } else if (DOCUMENT_RESOURCE_TYPES.has(item.resourceType)) {
      sources.push({
        type: "document",
        id: item.resourceId,
        code: item.resourceCode || null,
        title: clip(item.title, 200),
        href: assistantSourceHref("document", item.resourceId),
      });
    }
  }

  return {
    total: kept.length,
    truncated: kept.length > shown.length,
    items: shown.map((item) => ({
      type: item.resourceType,
      code: item.resourceCode,
      title: clip(item.title, 200),
      requiredAction: item.requiredAction,
      reason: redactContact(item.reasonWhyMe),
      priority: item.priority,
      deadline: ictDate(item.deadline),
    })),
    sources,
  };
}

export interface MeetingsRead {
  total: number;
  truncated: boolean;
  items: Array<Record<string, unknown>>;
  sources: AssistantSourceRef[];
}

/**
 * Lịch họp trong khoảng ngày mà người hỏi được xem. Không trả biên bản, chương trình hay email.
 * Dịch vụ sắp giảm dần theo giờ bắt đầu, nên MEETING_LIST_LIMIT cuộc sớm nhất nằm ở cuối danh sách:
 * chỉ lấy đúng các trang chứa chúng (tối đa hai trang), rồi sắp tăng dần và cắt.
 */
export async function listReadableMeetings(authz: AuthorizationContext, input: ListMeetingsInput): Promise<MeetingsRead> {
  if (!isCalendarDate(input.from) || !isCalendarDate(input.to)) {
    throw new ToolFailure("Tham số không hợp lệ: from và to phải theo dạng YYYY-MM-DD.");
  }
  const window = meetingWindow(input.from, input.to);
  const query = { from: window.from, to: window.to, search: input.query, limit: MEETING_FETCH_LIMIT };
  const first = await MeetingService.listMeetings({ ...query, page: 1 }, authz);
  const total = first.total;

  // Thứ tự giảm dần: vị trí k (từ 0) thuộc trang floor(k / cỡ trang) + 1; các cuộc sớm nhất ở vị trí [total - 20, total - 1]
  const firstPage = Math.max(1, Math.ceil((total - MEETING_LIST_LIMIT + 1) / MEETING_FETCH_LIMIT));
  const lastPage = Math.ceil(total / MEETING_FETCH_LIMIT);
  const pool: typeof first.items = [];
  for (let page = firstPage; page <= lastPage; page += 1) {
    const batch = page === 1 ? first : await MeetingService.listMeetings({ ...query, page }, authz);
    pool.push(...batch.items);
  }

  const shown = [...pool]
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || String(a.id).localeCompare(String(b.id))
    )
    .slice(0, MEETING_LIST_LIMIT);

  const sources: AssistantSourceRef[] = shown.map((meeting) => ({
    type: "meeting",
    id: meeting.id,
    code: null,
    title: clip(meeting.title, 200),
    href: assistantSourceHref("meeting", meeting.id),
  }));

  return {
    total,
    truncated: total > shown.length,
    items: shown.map((meeting) => ({
      id: meeting.id,
      title: clip(meeting.title, 200),
      start: ictDateTime(meeting.startTime),
      end: ictDateTime(meeting.endTime),
      location: meeting.location ? redactContact(meeting.location) : null,
      organizer: meeting.organizer?.name ?? null,
      unit: meeting.unit?.name ?? null,
      status: MEETING_STATUS_LABEL[meeting.status] ?? String(meeting.status),
    })),
    sources,
  };
}
