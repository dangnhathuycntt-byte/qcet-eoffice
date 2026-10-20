/**
 * Ghi âm cuộc họp: tạo bản ghi, nhận âm thanh theo từng phần, ghép (UPLOADED, đo sóng âm), rồi khi người dùng bấm "Tạo
 * biên bản" (kèm xác nhận đã thông báo và đồng ý gửi tới dịch vụ AI) mới xếp việc chép lời.
 *
 * Quyền: cùng quan hệ với soạn biên bản (chủ tọa, thư ký, người tổ chức, `meeting.draft_minutes`) cho mọi thao tác, kể cả
 * xem bản chép lời. Quyền soạn biên bản chỉ mở khi cuộc họp đã diễn ra, còn ghi âm xảy ra trong lúc họp, nên kiểm với
 * trạng thái HELD rồi tự chặn các trạng thái không còn ghi âm được. Người không đọc được cuộc họp nhận 404.
 */
import { MeetingRecordingStatus, MeetingStatus, type MeetingRecording } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { AuditAction, AuditEntityType, logAuditEvent } from "@qcet/db/audit";
import {
  MEETING_RECORDINGS_PER_MEETING_MAX,
  type CompleteMeetingRecordingInput,
  type CreateMeetingRecordingInput,
  type ProcessMeetingRecordingInput,
  type MeetingRecordingActionItem,
  type MeetingRecordingDetail,
  type MeetingRecordingSummary,
} from "@qcet/contracts/meeting-recordings";
import { planRecordingWindows, type TranscribedWindow } from "@qcet/shared/domain/meetings/recording-transcript";
import { authorize } from "@/server/authorization";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/server/api/errors";
import { buildMeetingResource } from "@/server/services/meeting-service";
import { enqueueAgentJob } from "@/server/outbox/agent-jobs";
import { TRANSCRIBE_MEETING_JOB, recordingGatewayConfig } from "@/server/meetings/recording-job";
import {
  assembleRecording,
  detectRecordingMimeType,
  readRecordingHead,
  recordingAudioPath,
  recordingByteLimit,
  recordingTooLargeError,
  removeRecordingFiles,
  writeRecordingPart,
} from "@/server/meetings/recording-storage";
import { computeWaveform, recordingWindowSec } from "@/server/meetings/recording-slicer";
import { logger } from "@/server/observability/logger";

/** Trạng thái cuộc họp còn ghi âm hoặc gửi thêm được (đang mời, đã diễn ra, đang soạn biên bản). */
const WRITABLE_MEETING_STATUSES: MeetingStatus[] = [MeetingStatus.INVITED, MeetingStatus.HELD, MeetingStatus.MINUTES_DRAFT];
/** Bản đang tải lên bỏ dở quá thời gian này bị dọn khi tạo bản mới. */
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

type RecordingWithAuthor = MeetingRecording & { createdBy: { name: string | null } };

async function authorizeRecordingAccess(meetingId: string, userId: string, options: { write: boolean }) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { body: { include: { memberships: true } }, unit: true, participants: true },
  });
  if (!meeting) throw new NotFoundError("Cuộc họp không tồn tại");

  const context = await loadAuthorizationContext(userId, new Date(), { useCache: true });
  const read = authorize(context, "meeting.read", buildMeetingResource(meeting));
  if (!read.allowed) throw new NotFoundError("Cuộc họp không tồn tại");
  const relation = authorize(context, "meeting.draft_minutes", buildMeetingResource({ ...meeting, status: MeetingStatus.HELD }));
  if (!relation.allowed) {
    throw new AuthorizationError("Chỉ chủ tọa, thư ký hoặc người tổ chức mới ghi âm và xem bản chép lời của cuộc họp.");
  }
  if (options.write && !WRITABLE_MEETING_STATUSES.includes(meeting.status)) {
    throw new ValidationError("Cuộc họp ở trạng thái này không còn ghi âm được.");
  }
  return meeting;
}

function readWindows(value: unknown): TranscribedWindow[] {
  return Array.isArray(value) ? (value as TranscribedWindow[]) : [];
}

function readActionItems(value: unknown): MeetingRecordingActionItem[] {
  return Array.isArray(value) ? (value as MeetingRecordingActionItem[]) : [];
}

function toSummary(row: RecordingWithAuthor, windowSec: number): MeetingRecordingSummary {
  const total = planRecordingWindows(row.durationSec, windowSec).length;
  const done = readWindows(row.windows).length;
  return {
    id: row.id,
    source: row.source === "file" ? "file" : "live",
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdBy.name,
    durationSec: row.durationSec,
    byteSize: Number(row.byteSize),
    progress: row.status === "PROCESSING" || row.status === "QUEUED" ? { done: Math.min(done, total), total } : null,
    error: row.error,
    submittedAt: row.consentAt?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    waveform: Array.isArray(row.waveform) ? (row.waveform as number[]) : null,
  };
}

function toDetail(row: RecordingWithAuthor, windowSec: number): MeetingRecordingDetail {
  return {
    ...toSummary(row, windowSec),
    transcript: row.transcript,
    minutesDraft: row.minutesDraft,
    decisions: Array.isArray(row.decisions) ? (row.decisions as string[]) : [],
    actionItems: readActionItems(row.actionItems),
    model: row.model,
  };
}

async function findRecording(meetingId: string, recordingId: string): Promise<RecordingWithAuthor> {
  const row = await prisma.meetingRecording.findFirst({
    where: { id: recordingId, meetingId },
    include: { createdBy: { select: { name: true } } },
  });
  if (!row) throw new NotFoundError("Bản ghi âm không tồn tại");
  return row;
}

export class MeetingRecordingService {
  static async list(meetingId: string, userId: string): Promise<{ recordings: MeetingRecordingSummary[] }> {
    await authorizeRecordingAccess(meetingId, userId, { write: false });
    const rows = await prisma.meetingRecording.findMany({
      where: { meetingId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: MEETING_RECORDINGS_PER_MEETING_MAX,
    });
    const windowSec = await recordingWindowSec();
    return { recordings: rows.map((row) => toSummary(row, windowSec)) };
  }

  static async get(meetingId: string, recordingId: string, userId: string): Promise<MeetingRecordingDetail> {
    await authorizeRecordingAccess(meetingId, userId, { write: false });
    return toDetail(await findRecording(meetingId, recordingId), await recordingWindowSec());
  }

  static async create(
    meetingId: string,
    input: CreateMeetingRecordingInput,
    userId: string,
    requestId?: string
  ): Promise<MeetingRecordingSummary> {
    await authorizeRecordingAccess(meetingId, userId, { write: true });
    // Chưa cấu hình gateway thì từ chối ngay (503), không để người dùng ghi cả buổi rồi mới báo lỗi
    recordingGatewayConfig();
    // Tệp có sẵn báo trước dung lượng: quá giới hạn của máy chủ thì từ chối ngay, không bắt người dùng gửi cả tệp rồi mới báo
    if (input.byteSize !== undefined) {
      const limit = await recordingByteLimit();
      if (input.byteSize > limit) throw recordingTooLargeError(limit);
    }

    // Dọn bản tải lên bỏ dở (đóng trình duyệt giữa chừng) để không chiếm chỗ trong giới hạn mỗi cuộc họp
    const stale = await prisma.meetingRecording.findMany({
      where: { meetingId, status: MeetingRecordingStatus.UPLOADING, updatedAt: { lt: new Date(Date.now() - STALE_UPLOAD_MS) } },
      select: { id: true },
      take: 20,
    });
    for (const { id } of stale) {
      await removeRecordingFiles(id);
      await prisma.meetingRecording.deleteMany({ where: { id, status: MeetingRecordingStatus.UPLOADING } });
    }

    if ((await prisma.meetingRecording.count({ where: { meetingId } })) >= MEETING_RECORDINGS_PER_MEETING_MAX) {
      throw new ConflictError(
        `Mỗi cuộc họp tối đa ${MEETING_RECORDINGS_PER_MEETING_MAX} bản ghi âm. Hãy xóa bản cũ trước khi ghi tiếp.`,
        "RECORDING_LIMIT"
      );
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.meetingRecording.create({
        data: { meetingId, createdById: userId, source: input.source, mimeType: input.mimeType },
        include: { createdBy: { select: { name: true } } },
      });
      await logAuditEvent(tx, {
        actorId: userId,
        action: AuditAction.MEETING_RECORDING_CREATED,
        entityType: AuditEntityType.MEETING_RECORDING,
        entityId: created.id,
        requestId,
        metadata: { meetingId, source: input.source },
      });
      return created;
    });
    return toSummary(row, await recordingWindowSec());
  }

  static async uploadPart(meetingId: string, recordingId: string, index: number, bytes: Buffer, userId: string): Promise<{ index: number }> {
    await authorizeRecordingAccess(meetingId, userId, { write: true });
    const row = await findRecording(meetingId, recordingId);
    if (row.status !== MeetingRecordingStatus.UPLOADING) throw new ConflictError("Bản ghi âm này không còn nhận thêm âm thanh.", "RECORDING_NOT_UPLOADING");
    await writeRecordingPart(recordingId, index, bytes);
    await prisma.meetingRecording.update({ where: { id: recordingId }, data: { updatedAt: new Date() } });
    return { index };
  }

  /**
   * Ghép các phần, kiểm byte đầu tệp khớp định dạng đã khai, rồi chuyển UPLOADED: âm thanh nằm trên máy chủ, chưa gửi tới
   * dịch vụ AI cho tới khi người dùng bấm "Tạo biên bản" (`process`). Route đo sóng âm sau khi trả lời (`measureWaveform`).
   */
  static async complete(
    meetingId: string,
    recordingId: string,
    input: CompleteMeetingRecordingInput,
    userId: string
  ): Promise<{ recording: MeetingRecordingSummary }> {
    await authorizeRecordingAccess(meetingId, userId, { write: true });
    const row = await findRecording(meetingId, recordingId);
    if (row.status !== MeetingRecordingStatus.UPLOADING) throw new ConflictError("Bản ghi âm này đã tải lên xong.", "RECORDING_NOT_UPLOADING");

    // Thiếu phần thì ném lỗi và giữ bản ghi UPLOADING để gửi bù rồi hoàn tất lại
    const { byteSize } = await assembleRecording(recordingId, input.partCount);
    const detected = detectRecordingMimeType(await readRecordingHead(recordingId));
    if (!detected) {
      // Các phần đã bị xóa khi ghép, không còn gì để gửi bù: bỏ bản ghi để người dùng ghi hoặc chọn tệp lại
      await removeRecordingFiles(recordingId);
      await prisma.meetingRecording.deleteMany({ where: { id: recordingId } });
      throw new ValidationError("Tệp không phải âm thanh được hỗ trợ (webm, ogg, mp4/m4a, mp3, wav).");
    }

    const claimed = await prisma.meetingRecording.updateMany({
      where: { id: recordingId, status: MeetingRecordingStatus.UPLOADING },
      data: {
        status: MeetingRecordingStatus.UPLOADED,
        // Safari ghi mp4 còn Chrome ghi webm: lấy định dạng thật theo nội dung, mime khai báo chỉ để gợi ý
        mimeType: detected,
        partCount: input.partCount,
        byteSize: BigInt(byteSize),
        durationSec: input.durationSec,
        error: null,
      },
    });
    if (claimed.count !== 1) throw new ConflictError("Bản ghi âm này đã tải lên xong.", "RECORDING_NOT_UPLOADING");
    return { recording: toSummary(await findRecording(meetingId, recordingId), await recordingWindowSec()) };
  }

  /**
   * Đo sóng âm của bản vừa ghép và lưu (route gọi sau khi trả lời). Không có ffmpeg hoặc tệp không đọc được thì lưu [] để giao
   * diện thôi chờ; bản ghi đã bị xóa hoặc âm thanh đã bị dọn thì bỏ qua.
   */
  static async measureWaveform(recordingId: string): Promise<void> {
    const row = await prisma.meetingRecording.findUnique({ where: { id: recordingId }, select: { durationSec: true, waveform: true } });
    if (!row || row.waveform !== null) return;
    let waveform: number[] = [];
    try {
      waveform = await computeWaveform(recordingAudioPath(recordingId), row.durationSec);
    } catch (error) {
      logger.warn("meeting_recording.waveform_failed", { metadata: { recordingId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" } });
    }
    await prisma.meetingRecording.updateMany({ where: { id: recordingId }, data: { waveform } });
  }

  /**
   * "Tạo biên bản": người dùng xác nhận đã báo người dự họp và đồng ý gửi âm thanh tới dịch vụ AI (lưu `consentAt`), bản ghi
   * chuyển QUEUED và việc chép lời được xếp trong cùng giao dịch.
   */
  static async process(
    meetingId: string,
    recordingId: string,
    _input: ProcessMeetingRecordingInput,
    userId: string
  ): Promise<{ recording: MeetingRecordingSummary; jobId: string }> {
    await authorizeRecordingAccess(meetingId, userId, { write: true });
    recordingGatewayConfig();
    const row = await findRecording(meetingId, recordingId);
    if (row.status !== MeetingRecordingStatus.UPLOADED) {
      throw new ConflictError(
        row.status === MeetingRecordingStatus.UPLOADING ? "Bản ghi âm chưa tải lên xong." : "Bản ghi âm này đã được gửi đi soạn biên bản.",
        "RECORDING_NOT_UPLOADED"
      );
    }
    const jobId = await prisma.$transaction(async (tx) => {
      const claimed = await tx.meetingRecording.updateMany({
        where: { id: recordingId, status: MeetingRecordingStatus.UPLOADED },
        data: { status: MeetingRecordingStatus.QUEUED, consentAt: new Date(), error: null },
      });
      if (claimed.count !== 1) throw new ConflictError("Bản ghi âm này đã được gửi đi soạn biên bản.", "RECORDING_NOT_UPLOADED");
      const job = await enqueueAgentJob(tx, {
        type: TRANSCRIBE_MEETING_JOB,
        payload: { recordingId },
        idempotencyKey: `${recordingId}:0`,
        actorId: userId,
      });
      return job.id;
    });
    return { recording: toSummary(await findRecording(meetingId, recordingId), await recordingWindowSec()), jobId };
  }

  /** Bản lỗi (còn âm thanh) chạy lại từ các đoạn đã chép xong. */
  static async retry(meetingId: string, recordingId: string, userId: string): Promise<{ recording: MeetingRecordingSummary; jobId: string }> {
    await authorizeRecordingAccess(meetingId, userId, { write: true });
    const row = await findRecording(meetingId, recordingId);
    if (row.status !== MeetingRecordingStatus.FAILED) throw new ConflictError("Chỉ bản ghi bị lỗi mới thử lại được.", "RECORDING_NOT_FAILED");
    const jobId = await prisma.$transaction(async (tx) => {
      const claimed = await tx.meetingRecording.updateMany({
        where: { id: recordingId, status: MeetingRecordingStatus.FAILED },
        data: { status: MeetingRecordingStatus.QUEUED, error: null },
      });
      if (claimed.count !== 1) throw new ConflictError("Bản ghi âm đang được xử lý.", "RECORDING_NOT_FAILED");
      const job = await enqueueAgentJob(tx, {
        type: TRANSCRIBE_MEETING_JOB,
        payload: { recordingId },
        idempotencyKey: `${recordingId}:retry:${crypto.randomUUID().slice(0, 8)}`,
        actorId: userId,
      });
      return job.id;
    });
    return { recording: toSummary(await findRecording(meetingId, recordingId), await recordingWindowSec()), jobId };
  }

  /** Xóa cả bản ghi lẫn âm thanh còn lại. Việc đang chạy gặp bản ghi biến mất thì tự dừng. */
  static async remove(meetingId: string, recordingId: string, userId: string, requestId?: string): Promise<{ id: string }> {
    await authorizeRecordingAccess(meetingId, userId, { write: false });
    await findRecording(meetingId, recordingId);
    await prisma.$transaction(async (tx) => {
      await tx.meetingRecording.deleteMany({ where: { id: recordingId, meetingId } });
      await logAuditEvent(tx, {
        actorId: userId,
        action: AuditAction.MEETING_RECORDING_DELETED,
        entityType: AuditEntityType.MEETING_RECORDING,
        entityId: recordingId,
        requestId,
        metadata: { meetingId },
      });
    });
    await removeRecordingFiles(recordingId);
    return { id: recordingId };
  }
}
