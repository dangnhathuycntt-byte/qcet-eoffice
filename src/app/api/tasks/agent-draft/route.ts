import { NextRequest } from "next/server";
import { z } from "zod";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { ApiError, ValidationError } from "@/server/api/errors";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { cleanAttachmentFileName, readJsonOrMultipart } from "@/server/api/json-or-multipart";
import { isFeatureEnabled } from "@/features/flags";
import { getTodayIctDate } from "@/lib/academic-calendar";
import { TASK_AGENT_PRIORITIES, TASK_AGENT_SUBTASKS_MAX, TASK_AGENT_SUBTASK_DESCRIPTION_MAX, type TaskAgentContentPart } from "@/domain/tasks/task-agent-draft";
import { checkTaskAgentAttachments, TASK_AGENT_ATTACHMENT_MAX_FILES } from "@/domain/tasks/task-agent-attachments";
import type { TaskAgentStreamEvent } from "@/domain/tasks/task-agent-stream";
import { draftTaskWithAgent } from "@/server/services/task-agent-service";
import { readGatewayConfig } from "@/server/services/agent-gateway";
import { getAgentModelCatalog } from "@/config/runtime";
import { isAllowedAgentModel } from "@/domain/agent/agent-models";
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
  // Model chọn ở ô soạn (chung với Trợ lý); server chỉ nhận model trong TASK_AGENT_MODELS hoặc model mặc định
  model: z.string().trim().min(1).max(64).optional(),
});

type AgentDraftRequest = z.infer<typeof AgentDraftRequestSchema>;

async function readAgentRequest(req: NextRequest): Promise<{ body: AgentDraftRequest; files: File[] }> {
  const { body, files, multipart } = await readJsonOrMultipart(req, AgentDraftRequestSchema, {
    jsonMaxBytes: 64 * 1024,
    invalidMessage: "Dữ liệu gửi Agent không hợp lệ",
  });
  if (!multipart && body.attachments.length > 0) throw new ValidationError("Tệp đính kèm phải gửi bằng multipart/form-data");
  if (files.length !== body.attachments.length) throw new ValidationError("Số tệp không khớp danh sách đính kèm");
  return { body, files };
}

/**
 * Soạn nháp nhiệm vụ bằng Agent: chỉ trả gợi ý điền form, không tạo hay ghi gì vào CSDL, không lưu tệp đính kèm.
 * Lỗi trước khi soạn (CSRF, đăng nhập, cờ, cấu hình gateway, giới hạn tần suất, dữ liệu, model, tệp) trả JSON RFC 9457 kèm mã HTTP;
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
    // Thiếu cấu hình gateway thì báo 503 trước khi trừ lượt gọi và trước khi đọc tệp, như Trợ lý
    const gatewayConfig = readGatewayConfig();
    await assertRateLimit(authUser.id, "AI_DRAFT");
    const { body, files } = await readAgentRequest(req);
    if (body.model && !isAllowedAgentModel(getAgentModelCatalog(), body.model)) {
      throw new ApiError(400, "MODEL_NOT_ALLOWED", "Model này không dùng được cho Agent. Thầy/Cô chọn model khác.");
    }
    const config = body.model ? { ...gatewayConfig, model: body.model } : gatewayConfig;

    const named = files.map((file) => ({ file, name: cleanAttachmentFileName(file.name) }));
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
            { attachments, config, signal: upstream.signal, onThinking: (delta) => send({ type: "thinking", delta }) },
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
