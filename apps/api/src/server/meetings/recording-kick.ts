/**
 * Chạy ngay việc chép lời vừa xếp, không đợi vòng thăm dò của worker (60 giây, và chỉ có ở production). Gọi sau khi đã
 * trả lời yêu cầu (`after`), nối tiếp các việc xếp thêm khi bản ghi dài hơn một lần chạy.
 */
import { OutboxStatus } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { logger } from "@/server/observability/logger";
import { runOutboxCycle } from "@/server/outbox/outbox-worker";

/** Tối đa số lần nối tiếp trong một lần kick (4 giờ ghi âm là 40 đoạn 6 phút, mỗi lần chạy làm được 1–2 đoạn, thêm lượt soạn biên bản). */
const MAX_ROUNDS = 60;

export async function runRecordingJobs(recordingId: string, firstJobId: string): Promise<void> {
  let ids = [firstJobId];
  try {
    for (let round = 0; round < MAX_ROUNDS && ids.length > 0; round += 1) {
      await runOutboxCycle(prisma, { ids });
      const next = await prisma.outboxEvent.findMany({
        where: {
          eventType: "AGENT_JOB_TRANSCRIBE_MEETING",
          status: OutboxStatus.PENDING,
          availableAt: { lte: new Date() },
          aggregateId: { startsWith: `${recordingId}:` },
        },
        select: { id: true },
        take: 5,
      });
      ids = next.map((event) => event.id);
    }
  } catch (error) {
    // Việc vẫn nằm trong outbox: worker production (hoặc nút Thử lại) sẽ chạy tiếp
    logger.error("meeting_recording.kick_failed", { metadata: { recordingId } }, error);
  }
}
