import { NextRequest } from "next/server";
import { z } from "zod";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { ApiError, PayloadTooLargeError, ValidationError } from "@/server/api/errors";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { parseAndValidateJson } from "@/server/api/validation";
import { isFeatureEnabled } from "@/features/flags";
import { getTodayIctDate } from "@/lib/academic-calendar";
import { TASK_AGENT_PRIORITIES, TASK_AGENT_SUBTASKS_MAX, TASK_AGENT_SUBTASK_DESCRIPTION_MAX, type TaskAgentContentPart } from "@/domain/tasks/task-agent-draft";
import { checkTaskAgentAttachments, TASK_AGENT_ATTACHMENT_MAX_FILES } from "@/domain/tasks/task-agent-attachments";
import type { TaskAgentStreamEvent } from "@/domain/tasks/task-agent-stream";
import { draftTaskWithAgent } from "@/server/services/task-agent-service";
import { prepareTaskAgentAttachment } from "@/server/services/task-agent-attachments";

const text = (max: number) => z.string().max(max);

const AgentDraftRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: text(2000).min(1) }))
    .min(1)
    .max(10)
    .refine((list) => list[list.length - 1]?.role === "user", "Tin nhắn cuối phải của người dùng"),
  departmentName: text(200),
  parentTaskTitle: text(255).optional(),
  // Danh sách nhân sự chỉ để mô hình gợi ý người chủ trì; quyền giao việc vẫn do POST /api/tasks kiểm khi tạo.
  personnel: z
    .array(z.object({ id: text(128).min(1), name: text(200), position: text(200).nullish() }))
    .max(200),
  draft: z.object({
    title: text(255).optional(),
    description: text(8000).optional(),
    priority: z.enum(TASK_AGENT_PRIORITIES).optional(),
    leadAssigneeId: text(128).optional(),
    startDate: text(10).optional(),
    dueDate: text(10).optional(),
    // Việc con đang có (ngữ cảnh để Agent không đề xuất trùng); giới hạn như việc con tạo kèm
    subtasks: z
      .array(
        z.object({
          title: text(255),
          description: text(TASK_AGENT_SUBTASK_DESCRIPTION_MAX).optional(),
          assigneeId: text(128).optional(),
          dueDate: text(10).optional(),
        }),
      )
      .max(TASK_AGENT_SUBTASKS_MAX)
      .optional(),
  }),
  // Thứ tự khớp các trường `files` của multipart: tệp thứ i thuộc tin nhắn messages[messageIndex]
  attachments: z
    .array(z.object({ messageIndex: z.number().int().min(0).max(9) }))
    .max(TASK_AGENT_ATTACHMENT_MAX_FILES)
    .default([]),
});

type AgentDraftRequest = z.infer<typeof AgentDraftRequestSchema>;

/** Body multipart (có tệp) tối đa 11MB, dưới mức middleware cắt (12MB). */
const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;

// Tên tệp đi vào prompt: bỏ ký tự điều khiển, ngoặc vuông (dùng làm dấu bọc tệp) và cắt ngắn
const cleanFileName = (name: string) => name.replace(/[\u0000-\u001f\u007f[\]]/g, " ").trim().slice(0, 120) || "tệp";

async function readAgentRequest(req: NextRequest): Promise<{ body: AgentDraftRequest; files: File[] }> {
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const body = await parseAndValidateJson(req, AgentDraftRequestSchema, { maxBytes: 64 * 1024 });
    if (body.attachments.length > 0) throw new ValidationError("Tệp đính kèm phải gửi bằng multipart/form-data");
    return { body, files: [] };
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_MULTIPART_BYTES) {
    throw new PayloadTooLargeError("Tổng dung lượng tệp đính kèm vượt 10MB.");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // Middleware cắt body quá cỡ làm formData() ném lỗi (như /api/upload)
    throw new PayloadTooLargeError("Không đọc được tệp đính kèm. Tổng dung lượng có thể vượt 10MB.");
  }
  const raw = form.get("payload");
  let json: unknown;
  try {
    json = typeof raw === "string" && raw.length <= 64 * 1024 ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  const parsed = AgentDraftRequestSchema.safeParse(json);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || "Dữ liệu gửi Agent không hợp lệ");
  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (files.length !== parsed.data.attachments.length) throw new ValidationError("Số tệp không khớp danh sách đính kèm");
  return { body: parsed.data, files };
}

/**
 * Soạn nháp nhiệm vụ bằng Agent: chỉ trả gợi ý điền form, không tạo hay ghi gì vào CSDL, không lưu tệp đính kèm.
 * Lỗi trước khi soạn (CSRF, đăng nhập, cờ, giới hạn tần suất, dữ liệu, tệp) trả JSON RFC 9457 kèm mã HTTP;
 * sau đó trả NDJSON (`TaskAgentStreamEvent`): các bước, suy nghĩ (nếu model có), rồi kết quả hoặc lỗi.
 */
export async function POST(req: NextRequest) {
  let requestId: string = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("taskAgent")) {
      throw new ApiError(503, "FEATURE_DISABLED", "Agent soạn nhiệm vụ đang tắt.");
    }
    await assertRateLimit(authUser.id, "AI_DRAFT");
    const { body, files } = await readAgentRequest(req);

    const named = files.map((file) => ({ file, name: cleanFileName(file.name) }));
    const attachmentError = checkTaskAgentAttachments(named.map(({ file, name }) => ({ name, size: file.size })));
    if (attachmentError) throw new ValidationError(attachmentError);
    const attachments = new Map<number, TaskAgentContentPart[]>();
    const steps: string[] = [];
    for (const [i, { file, name }] of named.entries()) {
      const { messageIndex } = body.attachments[i];
      if (body.messages[messageIndex]?.role !== "user") throw new ValidationError("Tệp đính kèm phải thuộc tin nhắn của người dùng");
      const prepared = await prepareTaskAgentAttachment(name, Buffer.from(await file.arrayBuffer()));
      attachments.set(messageIndex, [...(attachments.get(messageIndex) ?? []), ...prepared.parts]);
      // Chỉ kể bước cho tệp của lượt đang hỏi; tệp các lượt trước vẫn gửi lại làm ngữ cảnh
      if (messageIndex === body.messages.length - 1) steps.push(prepared.step);
    }

    const upstream = new AbortController();
    const onClientAbort = () => upstream.abort();
    req.signal.addEventListener("abort", onClientAbort);
    const encoder = new TextEncoder();
    const startedAt = Date.now();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: TaskAgentStreamEvent) => {
          if (!upstream.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          for (const label of steps) send({ type: "step", label });
          const result = await draftTaskWithAgent(
            {
              today: getTodayIctDate(),
              departmentName: body.departmentName,
              personnel: body.personnel,
              draft: body.draft,
              parentTaskTitle: body.parentTaskTitle,
            },
            body.messages,
            { attachments, signal: upstream.signal, onThinking: (delta) => send({ type: "thinking", delta }) },
          );
          send({ type: "result", data: { ...result, steps, durationMs: Date.now() - startedAt } });
        } catch (error) {
          const known = error instanceof ApiError ? error : null;
          send({
            type: "error",
            error: { code: known?.code ?? "AGENT_UNAVAILABLE", message: known?.message ?? "Agent chưa trả lời được. Thầy/Cô thử lại sau." },
          });
        } finally {
          req.signal.removeEventListener("abort", onClientAbort);
          try {
            controller.close();
          } catch {
            // Luồng đã đóng do trình duyệt hủy
          }
        }
      },
      cancel() {
        upstream.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Accel-Buffering": "no",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
