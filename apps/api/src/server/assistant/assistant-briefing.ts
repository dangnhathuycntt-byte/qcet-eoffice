/**
 * Bản tin sáng của Trợ lý (ADR-012): người dùng tự bật trong Cài đặt Trợ lý; từ 07:00 giờ Việt Nam mỗi ngày, Hộp thư
 * nhận một thông báo đếm việc cần xử lý, nhiệm vụ trễ hạn và cuộc họp hôm nay. Bấm thông báo mở Trợ lý với câu hỏi soạn
 * sẵn (người dùng tự gửi). Không gọi mô hình: số lấy bằng đúng các hàm đọc đã kiểm quyền của công cụ Trợ lý.
 *
 * Chạy trong worker outbox (mỗi lần quét nhắc việc) và qua `GET /api/cron/assistant-briefing`; mỗi người một bản một
 * ngày nhờ khóa chính (userId, day) của `assistant_briefings`, gửi lỗi thì nhả khóa để lần quét sau gửi lại.
 */
import { prisma } from "@qcet/db/prisma";
import { isFeatureEnabled } from "@/features/flags";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { logger } from "@/server/observability/logger";
import { ictDayKey, isPastReminderHour } from "@qcet/shared/domain/tasks/reminder-rules";
import { listReadableMeetings, readInbox } from "./assistant-tool-agenda";
import { listReadableTasks } from "./assistant-tool-tasks";

export const ASSISTANT_BRIEFING_TYPE = "assistant_briefing";
/** Câu hỏi soạn sẵn khi bấm bản tin (người dùng tự gửi, không tự chạy từ đường dẫn). */
export const ASSISTANT_BRIEFING_PROMPT = "Tóm tắt việc hôm nay của tôi: việc cần xử lý, nhiệm vụ trễ hạn và lịch họp hôm nay.";
/** Mỗi lần quét gửi tối đa chừng này bản (lần quét sau gửi tiếp). */
const BRIEFING_BATCH = 200;

export interface BriefingCounts {
  inbox: number;
  overdue: number;
  meetings: number;
}

export interface BriefingScanResult {
  sent: number;
  skipped: number;
  failed: number;
}

/** Nội dung thông báo từ các số đếm (thuần). */
export function briefingBody(counts: BriefingCounts): string {
  const parts = [
    counts.inbox > 0 ? `${counts.inbox} việc cần xử lý` : null,
    counts.overdue > 0 ? `${counts.overdue} nhiệm vụ trễ hạn` : null,
    counts.meetings > 0 ? `${counts.meetings} cuộc họp hôm nay` : null,
  ].filter(Boolean);
  if (parts.length === 0) return "Hôm nay chưa có việc cần xử lý, nhiệm vụ trễ hạn hay lịch họp. Bấm để hỏi Trợ lý.";
  return `${parts.join(" · ")}. Bấm để hỏi Trợ lý chi tiết.`;
}

export function briefingHref(): string {
  return `/assistant?prompt=${encodeURIComponent(ASSISTANT_BRIEFING_PROMPT)}`;
}

/** Số đếm của một người, đọc theo quyền của chính họ. */
export async function readBriefingCounts(userId: string, day: string): Promise<BriefingCounts> {
  const authz = await loadCachedAuthorizationContext(userId);
  const [inbox, overdue, meetings] = await Promise.all([
    readInbox(userId),
    listReadableTasks(authz, { view: "related", status: "overdue", limit: 1 }, day),
    listReadableMeetings(authz, { from: day, to: day }),
  ]);
  return { inbox: inbox.total, overdue: overdue.total, meetings: meetings.total };
}

/**
 * Gửi bản tin cho những người đã bật mà hôm nay chưa nhận. Trước 07:00 (giờ Việt Nam) hoặc khi Trợ lý tắt thì không
 * làm gì. Không ném lỗi theo từng người: lỗi một người chỉ log tên lỗi và nhả khóa.
 */
export async function sendAssistantBriefings(now: Date = new Date()): Promise<BriefingScanResult> {
  const result: BriefingScanResult = { sent: 0, skipped: 0, failed: 0 };
  if (!isFeatureEnabled("assistant") || !isPastReminderHour(now)) return result;
  const day = ictDayKey(now);

  const due = await prisma.assistantPreference.findMany({
    where: {
      briefingEnabled: true,
      user: { isActive: true, assistantBriefings: { none: { day } } },
    },
    select: { userId: true },
    orderBy: { userId: "asc" },
    take: BRIEFING_BATCH,
  });

  for (const { userId } of due) {
    // Giữ chỗ trước: hai tiến trình quét cùng lúc chỉ một bên gửi
    const claimed = await prisma.assistantBriefing.createMany({ data: [{ userId, day }], skipDuplicates: true });
    if (claimed.count === 0) {
      result.skipped++;
      continue;
    }
    try {
      const counts = await readBriefingCounts(userId, day);
      const notification = await prisma.notification.create({
        data: {
          userId,
          actorName: "Trợ lý",
          title: "Bản tin sáng",
          body: briefingBody(counts),
          category: "assistant",
          type: ASSISTANT_BRIEFING_TYPE,
          linkHref: briefingHref(),
        },
        select: { id: true },
      });
      await prisma.assistantBriefing.update({ where: { userId_day: { userId, day } }, data: { notificationId: notification.id } });
      result.sent++;
    } catch (error) {
      result.failed++;
      logger.warn("assistant.briefing.failed", { metadata: { errorName: error instanceof Error ? error.name : "unknown" } });
      await prisma.assistantBriefing.deleteMany({ where: { userId, day } }).catch(() => undefined);
    }
  }
  return result;
}
