import type { AssistantStreamEvent } from "@qcet/contracts/assistant";

/**
 * Lượt chạy của Trợ lý độc lập với kết nối của trình duyệt (người dùng yêu cầu 19/10/2026, theo mẫu "resumable stream"
 * của AI SDK và TanStack AI): rời trang, chuyển trang hay tải lại không dừng lượt; mở lại cuộc thì phát lại từ đầu rồi
 * nhận tiếp. Chỉ nút Dừng (`POST /api/assistant/runs/[id]/stop`) mới hủy lượt.
 *
 * Sổ lượt nằm trong bộ nhớ của tiến trình API: triển khai hiện có một container `qcet-api` (docker-compose.yml). Chạy
 * nhiều bản API thì phải chuyển sổ này sang Redis (luồng sự kiện + kênh dừng). Đặt trên `globalThis` vì route handler của
 * Next có thể nạp module này thành nhiều bản (như Prisma client ở packages/db).
 */

/** Giữ lượt đã xong thêm một lúc: trình duyệt nối lại đúng lúc lượt kết thúc vẫn nhận đủ, không thấy câu hỏi bỏ dở. */
const FINISHED_RUN_TTL_MS = 60_000;

interface RunListener {
  onEvent: (event: AssistantStreamEvent) => void;
  onEnd: () => void;
}

export interface AssistantRun {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: number;
  /** Có sau sự kiện `conversation` (cuộc mới tạo xong, câu hỏi đã lưu). */
  conversationId: string | null;
  readonly events: AssistantStreamEvent[];
  readonly controller: AbortController;
  finished: boolean;
  readonly listeners: Set<RunListener>;
}

interface RunRegistry {
  runs: Map<string, AssistantRun>;
  /** Mã cuộc → lượt mới nhất của cuộc đó (kể cả lượt vừa xong, còn trong thời gian giữ). */
  byConversation: Map<string, string>;
}

const globalForRuns = globalThis as unknown as { qcetAssistantRuns?: RunRegistry };
const registry: RunRegistry = (globalForRuns.qcetAssistantRuns ??= { runs: new Map(), byConversation: new Map() });

export function startAssistantRun(userId: string, now: number = Date.now()): AssistantRun {
  const run: AssistantRun = {
    id: crypto.randomUUID(),
    userId,
    startedAt: now,
    conversationId: null,
    events: [],
    controller: new AbortController(),
    finished: false,
    listeners: new Set(),
  };
  registry.runs.set(run.id, run);
  return run;
}

/** Ghi sự kiện vào nhật ký của lượt và gửi cho các kết nối đang nghe. Lượt đã xong thì bỏ qua. */
export function emitRunEvent(run: AssistantRun, event: AssistantStreamEvent): void {
  if (run.finished) return;
  run.events.push(event);
  if (event.type === "conversation") {
    run.conversationId = event.conversation.id;
    registry.byConversation.set(event.conversation.id, run.id);
  }
  for (const listener of run.listeners) listener.onEvent(event);
}

export function finishAssistantRun(run: AssistantRun): void {
  if (run.finished) return;
  run.finished = true;
  for (const listener of run.listeners) listener.onEnd();
  run.listeners.clear();
  const timer = setTimeout(() => forgetRun(run), FINISHED_RUN_TTL_MS);
  timer.unref?.();
}

function forgetRun(run: AssistantRun): void {
  registry.runs.delete(run.id);
  if (run.conversationId && registry.byConversation.get(run.conversationId) === run.id) {
    registry.byConversation.delete(run.conversationId);
  }
}

/** Lượt `runId` của chính người gọi; của người khác hoặc đã quên thì null như nhau. */
export function findAssistantRun(userId: string, runId: string): AssistantRun | null {
  const run = registry.runs.get(runId);
  return run && run.userId === userId ? run : null;
}

/** Lượt mới nhất của cuộc (của chính người gọi), kể cả lượt vừa xong còn giữ để phát lại. */
export function findConversationRun(userId: string, conversationId: string): AssistantRun | null {
  const runId = registry.byConversation.get(conversationId);
  return runId ? findAssistantRun(userId, runId) : null;
}

/** Cuộc đang có lượt chưa xong (để không chạy hai lượt song song trên cùng cuộc). */
export function hasActiveConversationRun(userId: string, conversationId: string): boolean {
  const run = findConversationRun(userId, conversationId);
  return run !== null && !run.finished;
}

/** Dừng lượt theo yêu cầu của người dùng; trả false nếu không có lượt đang chạy. */
export function stopAssistantRun(run: AssistantRun | null): boolean {
  if (!run || run.finished) return false;
  run.controller.abort();
  return true;
}

/**
 * Nghe một lượt: phát lại mọi sự kiện đã có rồi nhận tiếp tới khi xong. Trả hàm thôi nghe (kết nối đóng); thôi nghe
 * không dừng lượt.
 */
export function subscribeAssistantRun(run: AssistantRun, listener: RunListener): () => void {
  for (const event of run.events) listener.onEvent(event);
  if (run.finished) {
    listener.onEnd();
    return () => undefined;
  }
  run.listeners.add(listener);
  return () => {
    run.listeners.delete(listener);
  };
}

/** Thân phản hồi NDJSON của một lượt (gửi lượt mới và nối lại dùng chung); trình duyệt đóng kết nối thì chỉ thôi nghe. */
export function assistantRunResponseBody(run: AssistantRun): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = subscribeAssistantRun(run, {
        onEvent: (event) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            // Luồng đã đóng do trình duyệt rời đi
          }
        },
        onEnd: () => {
          try {
            controller.close();
          } catch {
            // Đã đóng
          }
        },
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });
}

/** Tiêu đề phản hồi chung của luồng lượt chạy: mã lượt để dừng, mốc bắt đầu cho đồng hồ của thẻ Tiến trình. */
export function assistantRunHeaders(run: AssistantRun, requestId: string): Record<string, string> {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Accel-Buffering": "no",
    "x-request-id": requestId,
    "x-assistant-run-id": run.id,
    "x-assistant-run-started-at": String(run.startedAt),
  };
}
