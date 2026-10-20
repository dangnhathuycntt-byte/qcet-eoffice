/**
 * Việc nền `TRANSCRIBE_MEETING`: chép lời bản ghi âm theo từng đoạn thời gian bằng mô hình nghe được âm thanh (Gemini qua
 * gateway) rồi soạn biên bản đề xuất từ bản chép. Mỗi lần gọi mô hình gửi cả tệp kèm khoảng thời gian cần chép.
 *
 * Việc dài hơn thời gian một lần chạy (AGENT_JOB_TIMEOUT_MS): bản chép từng đoạn được lưu ngay vào CSDL, hết ngân sách
 * thời gian thì xếp việc nối tiếp rồi kết thúc bình thường. Không ném lỗi để "làm tiếp sau" vì outbox chỉ thử lại vài lần
 * rồi bỏ. Chỉ lỗi thật mới ném (để outbox thử lại có lùi lịch); sau MAX_RUN_ATTEMPTS lần thì ghi FAILED, người dùng
 * bấm "Thử lại" để chạy tiếp từ các đoạn đã xong.
 *
 * Âm thanh bị xóa khi xử lý xong. Nội dung chép lời và biên bản không ghi vào log hay audit.
 */
import { MeetingRecordingStatus, type Prisma } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import type { MeetingRecordingMimeType } from "@qcet/contracts/meeting-recordings";
import {
  MINUTES_SYSTEM_PROMPT,
  TRANSCRIBE_SYSTEM_PROMPT,
  buildMinutesPrompt,
  buildTranscribeWindowPrompt,
  cleanWindowTranscript,
  joinWindowTranscripts,
  parseMinutesReply,
  planRecordingWindows,
  type TranscribedWindow,
} from "@qcet/shared/domain/meetings/recording-transcript";
import { ApiError } from "@/server/api/errors";
import { logger } from "@/server/observability/logger";
import { callGateway, readGatewayConfig, type GatewayConfig } from "@/server/services/agent-gateway";
import { agentJobTimeoutMs, defineAgentJobHandlers, enqueueAgentJob, type AgentJobContext } from "@/server/outbox/agent-jobs";
import { readRecordingAudio, removeRecordingFiles } from "@/server/meetings/recording-storage";

export const TRANSCRIBE_MEETING_JOB = "TRANSCRIBE_MEETING";
const SUBJECT = "Dịch vụ chép lời";
const DEFAULT_AUDIO_MODEL = "gemini-3.8-flash";
/** Một đoạn 12 phút cho ra vài nghìn chữ; thời gian chờ và số token dư dả cho cả suy nghĩ ngắn của mô hình. */
const WINDOW_CALL_TIMEOUT_MS = 150_000;
const WINDOW_OUTPUT_TOKENS = 16_000;
const MINUTES_CALL_TIMEOUT_MS = 120_000;
const MINUTES_OUTPUT_TOKENS = 8_000;
const MAX_RUN_ATTEMPTS = 3;
/** Chừa cuối thời gian chạy cho việc ghi CSDL và xếp việc nối tiếp. */
const RUN_SAFETY_MS = 10_000;

const FILE_EXTENSIONS: Record<MeetingRecordingMimeType, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Cấu hình gateway cho ghi âm: dùng chung địa chỉ và khóa của Agent, nhưng mô hình riêng (nghe được âm thanh), không bật suy nghĩ dài. */
export function recordingGatewayConfig(): GatewayConfig {
  const base = readGatewayConfig(SUBJECT);
  return { ...base, model: process.env.MEETING_AUDIO_MODEL?.trim() || DEFAULT_AUDIO_MODEL, thinkingBudget: null };
}

const ACTIVE_STATUSES: MeetingRecordingStatus[] = [MeetingRecordingStatus.QUEUED, MeetingRecordingStatus.PROCESSING];

async function failRecording(recordingId: string, message: string) {
  await prisma.meetingRecording.updateMany({
    where: { id: recordingId, status: { in: ACTIVE_STATUSES } },
    data: { status: MeetingRecordingStatus.FAILED, error: message.slice(0, 500) },
  });
}

export async function transcribeMeeting(job: AgentJobContext): Promise<void> {
  const recordingId = (job.payload as { recordingId?: unknown } | null)?.recordingId;
  if (typeof recordingId !== "string" || !recordingId) return;

  const recording = await prisma.meetingRecording.findUnique({
    where: { id: recordingId },
    include: { meeting: { select: { title: true } } },
  });
  // Bản ghi đã bị xóa, đã xong hoặc đã lỗi: việc nối tiếp tới muộn thì bỏ qua
  if (!recording || !ACTIVE_STATUSES.includes(recording.status)) return;
  await prisma.meetingRecording.updateMany({
    where: { id: recordingId, status: { in: ACTIVE_STATUSES } },
    data: { status: MeetingRecordingStatus.PROCESSING, error: null },
  });

  let config: GatewayConfig;
  try {
    config = recordingGatewayConfig();
  } catch (error) {
    await failRecording(recordingId, error instanceof Error ? error.message : "Dịch vụ chép lời chưa được cấu hình.");
    return;
  }

  const title = recording.meeting.title;
  const plan = planRecordingWindows(recording.durationSec);
  let windows: TranscribedWindow[] = Array.isArray(recording.windows) ? (recording.windows as unknown as TranscribedWindow[]) : [];
  const runEndsAt = Date.now() + agentJobTimeoutMs() - RUN_SAFETY_MS;
  let stage: "transcribe" | "minutes" = "transcribe";

  try {
    let audioBase64: string | null = null;
    let processedThisRun = 0;
    for (const window of plan) {
      if (windows.some((done) => done.index === window.index)) continue;
      // Không đủ thời gian cho thêm một lần gọi: lưu tiến độ, xếp việc nối tiếp rồi kết thúc êm (luôn làm ít nhất một đoạn mỗi lần chạy)
      if (processedThisRun > 0 && runEndsAt - Date.now() < WINDOW_CALL_TIMEOUT_MS + 5_000) {
        await enqueueContinuation(recordingId, windows.length, job.actorId);
        return;
      }
      audioBase64 ??= (await readRecordingAudio(recordingId)).toString("base64");
      const mimeType = recording.mimeType as MeetingRecordingMimeType;
      const completion = await callGateway(
        [
          { role: "system", content: TRANSCRIBE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: buildTranscribeWindowPrompt(window, title) },
              {
                type: "file",
                file: {
                  filename: `ghi-am.${FILE_EXTENSIONS[mimeType] ?? "webm"}`,
                  file_data: `data:${mimeType};base64,${audioBase64}`,
                },
              },
            ],
          },
        ],
        { config, signal: job.signal, timeoutMs: WINDOW_CALL_TIMEOUT_MS, outputTokens: WINDOW_OUTPUT_TOKENS, subject: SUBJECT }
      );
      windows = [...windows, { index: window.index, startSec: window.startSec, endSec: window.endSec, text: cleanWindowTranscript(completion.content) }];
      processedThisRun += 1;
      const saved = await prisma.meetingRecording.updateMany({
        where: { id: recordingId, status: MeetingRecordingStatus.PROCESSING },
        data: { windows: windows as unknown as Prisma.InputJsonValue },
      });
      // Bản ghi bị xóa (hoặc đổi trạng thái) giữa chừng: dừng, không gọi mô hình tiếp
      if (saved.count === 0) return;
    }

    stage = "minutes";
    const transcript = joinWindowTranscripts(windows);
    if (!transcript) {
      await failRecording(recordingId, "Không nghe thấy lời nói trong bản ghi. Thầy/Cô kiểm tra micro hoặc chọn tệp khác.");
      return;
    }
    const minutes = await callGateway(
      [
        { role: "system", content: MINUTES_SYSTEM_PROMPT },
        { role: "user", content: buildMinutesPrompt(title, transcript) },
      ],
      { config, signal: job.signal, timeoutMs: MINUTES_CALL_TIMEOUT_MS, outputTokens: MINUTES_OUTPUT_TOKENS, subject: SUBJECT }
    );
    await finishRecording(recordingId, config.model, transcript, minutes.content, null);
  } catch (error) {
    if (error instanceof ApiError && error.code === "AGENT_NOT_CONFIGURED") {
      await failRecording(recordingId, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Không xử lý được bản ghi âm.";
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      await failRecording(recordingId, "Không còn tệp âm thanh của bản ghi này. Thầy/Cô ghi hoặc tải lên lại.");
      return;
    }
    logger.warn("meeting_recording.job_error", { metadata: { recordingId, attempt: job.attempt, stage, reason: message.slice(0, 200) } });
    if (job.attempt < MAX_RUN_ATTEMPTS) throw error; // outbox thử lại có lùi lịch; các đoạn đã chép xong được giữ
    if (stage === "minutes") {
      // Bản chép đã đủ: vẫn giao bản chép, chỉ thiếu phần biên bản đề xuất
      await finishRecording(recordingId, config.model, joinWindowTranscripts(windows), null, "Chưa soạn được biên bản đề xuất. Bản chép lời vẫn dùng được.");
    } else {
      await failRecording(recordingId, message);
    }
  }
}

async function enqueueContinuation(recordingId: string, doneWindows: number, actorId: string | null) {
  await enqueueAgentJob(prisma, {
    type: TRANSCRIBE_MEETING_JOB,
    payload: { recordingId },
    idempotencyKey: `${recordingId}:${doneWindows}`,
    actorId,
  });
}

/** Ghi kết quả, đánh dấu READY và xóa âm thanh (không còn dùng, và không giữ giọng nói lâu hơn cần thiết). */
async function finishRecording(recordingId: string, model: string, transcript: string, minutesReply: string | null, note: string | null) {
  const parsed = minutesReply ? parseMinutesReply(minutesReply) : null;
  const updated = await prisma.meetingRecording.updateMany({
    where: { id: recordingId, status: MeetingRecordingStatus.PROCESSING },
    data: {
      status: MeetingRecordingStatus.READY,
      transcript,
      // Mô hình không theo dạng JSON thì giữ nguyên câu trả lời làm biên bản nháp, người dùng tự chỉnh
      minutesDraft: parsed?.minutes ?? (minutesReply?.trim() || null),
      decisions: (parsed?.decisions ?? []) as Prisma.InputJsonValue,
      actionItems: (parsed?.actionItems ?? []) as unknown as Prisma.InputJsonValue,
      model: model.slice(0, 64),
      error: note,
      processedAt: new Date(),
    },
  });
  if (updated.count === 1) await removeRecordingFiles(recordingId);
}

/** Đăng ký vào `OUTBOX_HANDLERS` ở outbox-worker (không đặt trong agent-jobs.ts để tránh vòng import). */
export const MEETING_RECORDING_JOB_HANDLERS = defineAgentJobHandlers({ [TRANSCRIBE_MEETING_JOB]: transcribeMeeting });
