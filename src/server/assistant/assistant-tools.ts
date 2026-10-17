/**
 * Bộ công cụ chỉ đọc của Trợ lý. Danh tính và quyền chỉ lấy từ ctx (server); tham số của model được kiểm bằng zod `.strict()`.
 * `runAssistantTool` không bao giờ ném lỗi: mọi lỗi thành JSON `{ "error": … }` gửi lại cho model.
 */
import { z } from "zod";
import type { AssistantSourceRef, AssistantStep, AssistantToolName } from "@/contracts/assistant";
import { ASSISTANT_TOOL_NAMES } from "@/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import type { GatewayToolDefinition } from "@/server/services/agent-gateway";
import {
  clip,
  formatDmy,
  errorContent,
  fitToolContent,
  formatArgIssues,
  isAccessDenial,
  OVERSIZE_MESSAGE,
  parseRawArgs,
  quotedLabel,
  ToolAccessDenied,
  ToolFailure,
  toolErrorMessage,
  type AssistantToolContext,
  type AssistantToolOutcome,
  type ToolRun,
} from "./assistant-tool-shared";
import {
  DOCUMENT_LIST_LIMIT,
  DOCUMENT_SEARCH_LIMIT,
  DOCUMENT_DETAIL_LISTS,
  DOCUMENT_LIST_LISTS,
  GetDocumentArgs,
  ListDocumentsArgs,
  listDocumentItems,
  listReadableDocuments,
  listTypeLabel,
  readDocumentDetail,
  resolveDocumentType,
  documentSource,
  type ListDocumentsInput,
} from "./assistant-tool-documents";
import {
  GetTaskArgs,
  ListTasksArgs,
  SearchArgs,
  TASK_LIST_LIMIT,
  TASK_SEARCH_LIMIT,
  listReadableTasks,
  readTaskDetail,
  resolveTaskId,
  searchReadableTasks,
  taskSource,
  toTaskSummary,
  type ListTasksInput,
} from "./assistant-tool-tasks";
import {
  InboxArgs,
  ListMeetingsArgs,
  listReadableMeetings,
  meetingRangeLabel,
  readInbox,
  type ListMeetingsInput,
} from "./assistant-tool-agenda";

export { ASSISTANT_TOOL_RESULT_MAX_CHARS, RESTRICTED_MESSAGE, ToolFailure } from "./assistant-tool-shared";
export type { AssistantToolContext, AssistantToolOutcome } from "./assistant-tool-shared";

type ToolHandler = (rawArgs: unknown, ctx: AssistantToolContext) => Promise<AssistantToolOutcome>;

interface ToolSpec<A extends z.ZodType> {
  description: string;
  schema: A;
  /** Nhãn khi lỗi xảy ra trước khi có tham số. */
  failLabel: string;
  label: (args: z.output<A>) => string;
  run: (args: z.output<A>, ctx: AssistantToolContext) => Promise<ToolRun>;
}

interface RegisteredTool {
  description: string;
  schema: z.ZodType;
  handle: ToolHandler;
}

/** Đăng ký một tool: kiểm tham số, chạy, đóng gói outcome; mọi lỗi đổi thành JSON lỗi. */
function register<A extends z.ZodType>(name: AssistantToolName, spec: ToolSpec<A>): RegisteredTool {
  const handle: ToolHandler = async (rawArgs, ctx) => {
    let label = spec.failLabel;
    try {
      const parsed = spec.schema.safeParse(parseRawArgs(rawArgs));
      if (!parsed.success) throw formatArgIssues(parsed.error);
      const args = parsed.data as z.output<A>;
      label = spec.label(args);
      const run = await spec.run(args, ctx);
      const fitted = fitToolContent(run.payload, run.lists);
      if (!fitted.fits) return failure(name, run.label ?? label, OVERSIZE_MESSAGE);
      return {
        ok: true,
        content: fitted.content,
        step: { tool: name, label: run.label ?? label, count: run.count, ok: true },
        sources: run.sources,
        detailed: run.detailed,
      };
    } catch (error) {
      return failure(name, label, toolErrorMessage(error, name));
    }
  };
  return { description: spec.description, schema: spec.schema, handle };
}

function failure(tool: AssistantStep["tool"], label: string, message: string): AssistantToolOutcome {
  return {
    ok: false,
    content: errorContent(message),
    step: { tool, label, count: null, ok: false },
    sources: [],
    detailed: false,
  };
}

const TOOLS: Record<AssistantToolName, RegisteredTool> = {
  search: register("search", {
    description:
      "Tìm nhiệm vụ và văn bản Thầy/Cô được xem theo từ khóa. Dùng khi chưa biết mã hoặc Thầy/Cô nêu tên việc. " +
      "Truyền từ khóa tiếng Việt có dấu. Nếu không thấy, thử từ khóa khác ngắn hơn, hoặc dùng mã (ví dụ NV-2026-09-001).",
    schema: SearchArgs,
    failLabel: "Tìm trong dữ liệu",
    label: (args) => `Tìm ${quotedLabel(args.query)}`,
    run: async (args, ctx) => {
      const wantTasks = !args.types || args.types.includes("task");
      const wantDocuments = !args.types || args.types.includes("document");
      const tasks = wantTasks ? await searchReadableTasks(ctx.authz, args.query) : null;
      const documents = wantDocuments
        ? await listReadableDocuments(ctx.authz, { query: args.query, limit: DOCUMENT_SEARCH_LIMIT })
        : null;

      const taskItems = tasks ? tasks.dtos.slice(0, TASK_SEARCH_LIMIT).map(toTaskSummary) : [];
      const documentItems = documents ? listDocumentItems(documents.documents.slice(0, DOCUMENT_SEARCH_LIMIT)) : [];
      const sources: AssistantSourceRef[] = [
        ...(tasks ? tasks.dtos.slice(0, TASK_SEARCH_LIMIT).map((dto) => taskSource(dto.id, dto.code, dto.title)) : []),
        ...(documents
          ? documents.documents.slice(0, DOCUMENT_SEARCH_LIMIT).map((doc) => documentSource(doc))
          : []),
      ];
      const taskTotal = tasks?.total ?? 0;
      const documentTotal = documents?.total ?? 0;
      const truncated = taskTotal > taskItems.length || documentTotal > documentItems.length;
      return {
        payload: {
          ...(tasks ? { tasksTotal: taskTotal, tasks: taskItems } : {}),
          ...(documents ? { documentsTotal: documentTotal, documents: documentItems } : {}),
          ...(truncated ? { truncated: true } : {}),
        },
        lists: ["tasks", "documents"],
        count: taskTotal + documentTotal,
        sources,
        detailed: false,
      };
    },
  }),

  list_tasks: register("list_tasks", {
    description:
      "Liệt kê nhiệm vụ Thầy/Cô được xem. view: related = việc Thầy/Cô tham gia (mặc định), unit = việc của đơn vị, " +
      "all = mọi việc Thầy/Cô được xem. status = overdue là trễ hạn; không truyền status thì lấy mọi trạng thái. " +
      "Số lượng lấy từ total, không tự đếm.",
    schema: ListTasksArgs,
    failLabel: "Xem nhiệm vụ",
    label: (args: ListTasksInput) => {
      if (args.status === "overdue") return "Xem nhiệm vụ trễ hạn";
      if (args.view === "unit") return "Xem nhiệm vụ của đơn vị";
      if (args.view === "all") return "Xem toàn bộ nhiệm vụ";
      return "Xem nhiệm vụ của Thầy/Cô";
    },
    run: async (args, ctx) => {
      const result = await listReadableTasks(ctx.authz, args, ctx.today);
      const items = result.dtos.map(toTaskSummary);
      const limit = args.limit ?? TASK_LIST_LIMIT;
      return {
        payload: {
          total: result.total,
          ...(result.total > items.length ? { truncated: true } : {}),
          tasks: items,
        },
        lists: ["tasks"],
        count: result.total,
        sources: result.dtos.slice(0, limit).map((dto) => taskSource(dto.id, dto.code, dto.title)),
        detailed: false,
      };
    },
  }),

  get_task: register("get_task", {
    description:
      "Xem chi tiết một nhiệm vụ: mô tả, người tham gia, việc con, nhiệm vụ cha. Truyền đúng một trong id hoặc code (mã như NV-2026-09-001).",
    schema: GetTaskArgs,
    failLabel: "Đọc nhiệm vụ",
    label: (args) => (args.code ? `Đọc nhiệm vụ ${args.code.toUpperCase()}` : "Đọc nhiệm vụ"),
    run: async (args, ctx) => {
      const taskId = await resolveTaskId(args);
      const detail = await readTaskDetail(ctx.authz, taskId);
      return {
        payload: detail.view,
        lists: ["subTasks", "participants"],
        count: 1,
        sources: [detail.self, ...detail.related],
        detailed: true,
        label: `Đọc nhiệm vụ ${String(detail.view.code)}`,
      };
    },
  }),

  list_documents: register("list_documents", {
    description:
      "Liệt kê văn bản Thầy/Cô được xem. type: incoming = văn bản đến, outgoing = văn bản đi, internal = tờ trình nội bộ. " +
      "bucket (chỉ dùng với incoming hoặc outgoing) là nhóm trong sổ: pending, done, issued, recalled. " +
      "status là trạng thái xử lý theo mã. query tìm theo trích yếu, số hiệu hoặc cơ quan ban hành. " +
      "Văn bản mật hoặc hạn chế không được trả; excludedRestricted cho biết số văn bản bị loại vì vậy.",
    schema: ListDocumentsArgs,
    failLabel: "Xem văn bản",
    label: (args: ListDocumentsInput) =>
      args.query ? `Tìm ${listTypeLabel(args.type)} ${quotedLabel(args.query)}` : `Xem ${listTypeLabel(args.type)}`,
    run: async (args, ctx) => {
      const limit = args.limit ?? DOCUMENT_LIST_LIMIT;
      const result = await listReadableDocuments(ctx.authz, {
        type: resolveDocumentType(args.type),
        bucket: args.bucket,
        status: args.status,
        query: args.query,
        limit,
      });
      const items = listDocumentItems(result.documents);
      return {
        payload: {
          total: result.total,
          ...(result.total > items.length ? { truncated: true } : {}),
          excludedRestricted: result.excludedRestricted,
          documents: items,
        },
        lists: DOCUMENT_LIST_LISTS,
        count: result.total,
        sources: result.documents.map((doc) => documentSource(doc)),
        detailed: false,
      };
    },
  }),

  get_document: register("get_document", {
    description:
      "Xem chi tiết một văn bản theo id (lấy từ list_documents hoặc search): trích yếu, người chủ trì, người ký, " +
      "nhiệm vụ liên kết, chỉ đạo và tên tệp đính kèm.",
    schema: GetDocumentArgs,
    failLabel: "Đọc văn bản",
    label: () => "Đọc văn bản",
    run: async (args, ctx) => {
      const detail = await readDocumentDetail(ctx.authz, args.id);
      return {
        payload: detail.view,
        lists: DOCUMENT_DETAIL_LISTS,
        count: 1,
        sources: [detail.self, ...detail.related],
        detailed: true,
        label: `Đọc văn bản ${String(detail.view.number)}`,
      };
    },
  }),

  my_inbox: register("my_inbox", {
    description:
      "Liệt kê việc cần xử lý của Thầy/Cô trong hộp việc: nhiệm vụ, văn bản, hồ sơ, ủy quyền. Không có tham số.",
    schema: InboxArgs,
    failLabel: "Xem việc cần xử lý",
    label: () => "Xem việc cần xử lý",
    run: async (_args, ctx) => {
      const inbox = await readInbox(ctx.userId);
      return {
        payload: {
          total: inbox.total,
          ...(inbox.truncated ? { truncated: true } : {}),
          items: inbox.items,
        },
        lists: ["items"],
        count: inbox.total,
        sources: inbox.sources,
        detailed: false,
      };
    },
  }),

  list_meetings: register("list_meetings", {
    description:
      "Liệt kê lịch họp Thầy/Cô được xem trong khoảng ngày. from và to theo YYYY-MM-DD (giờ Việt Nam), " +
      "from đến to tính cả hai đầu, tối đa 31 ngày. query tìm theo tên cuộc họp hoặc mã.",
    schema: ListMeetingsArgs,
    failLabel: "Xem lịch họp",
    label: (args: ListMeetingsInput) => meetingRangeLabel(args),
    run: async (args, ctx) => {
      const result = await listReadableMeetings(ctx.authz, args);
      return {
        payload: {
          total: result.total,
          ...(result.truncated ? { truncated: true } : {}),
          meetings: result.items,
        },
        lists: ["meetings"],
        count: result.total,
        sources: result.sources,
        detailed: false,
      };
    },
  }),
};

/** Đủ 7 tool theo ASSISTANT_TOOL_NAMES; tham số lấy từ zod nên khớp với lúc kiểm. */
export const ASSISTANT_TOOL_DEFINITIONS: GatewayToolDefinition[] = ASSISTANT_TOOL_NAMES.map((name) => {
  const tool = TOOLS[name];
  const parameters = z.toJSONSchema(tool.schema, { io: "input" }) as Record<string, unknown>;
  delete parameters.$schema;
  return { type: "function", function: { name, description: tool.description, parameters } };
});

/** Chạy một tool theo tên và tham số JSON của model. Không ném lỗi. */
export async function runAssistantTool(
  name: string,
  rawArgs: string,
  ctx: AssistantToolContext
): Promise<AssistantToolOutcome> {
  const tool = Object.prototype.hasOwnProperty.call(TOOLS, name) ? TOOLS[name as AssistantToolName] : undefined;
  if (!tool) {
    return failure("unknown", "Công cụ không xác định", `Không có công cụ ${clip(name, 60)}.`);
  }
  try {
    return await tool.handle(rawArgs, ctx);
  } catch (error) {
    return failure(name as AssistantToolName, "Công cụ", toolErrorMessage(error, name));
  }
}

/**
 * Nguồn ngữ cảnh đã kiểm quyền, hoặc null khi không đọc được. Văn bản người hỏi đọc được nhưng bị loại (mật/hạn chế)
 * thì ném ToolFailure với RESTRICTED_MESSAGE, để không báo nhầm là "không tìm thấy hoặc không có quyền".
 */
async function loadContextRecord(
  authz: AuthorizationContext,
  ref: { type: "task" | "document"; id: string }
): Promise<{ source: AssistantSourceRef; summary: string } | null> {
  try {
    if (ref.type === "task") {
      const detail = await readTaskDetail(authz, ref.id);
      return { source: detail.self, summary: taskContextSummary(detail.view) };
    }
    if (ref.type === "document") {
      const detail = await readDocumentDetail(authz, ref.id);
      return { source: detail.self, summary: documentContextSummary(detail.view) };
    }
    return null;
  } catch (error) {
    if (error instanceof ToolFailure) throw error;
    if (!(error instanceof ToolAccessDenied) && !isAccessDenial(error)) {
      console.error(`[assistant-context] đọc ngữ cảnh lỗi không mong đợi: ${error instanceof Error ? error.name : typeof error}`);
    }
    return null;
  }
}

function taskContextSummary(view: Record<string, unknown>): string {
  const lines = [
    `Nhiệm vụ ${String(view.code)}: ${String(view.title)}`,
    `Trạng thái: ${String(view.statusLabel)}${view.dueDate ? `; hạn: ${formatDmy(String(view.dueDate))}` : ""}; ưu tiên: ${String(view.priority)}`,
    `Đơn vị: ${String(view.unit ?? "chưa có")}; chủ trì: ${String(view.lead ?? "chưa có")}`,
    `Mô tả: ${String(view.description ?? "") || "chưa có"}`,
  ];
  return clip(lines.join("\n"), 2000);
}

function documentContextSummary(view: Record<string, unknown>): string {
  const lines = [
    `Văn bản ${String(view.number)}: ${String(view.summary ?? "")}`,
    `Loại: ${String(view.typeLabel)}; trạng thái: ${String(view.statusLabel)}${view.dueDate ? `; hạn xử lý: ${formatDmy(String(view.dueDate))}` : ""}`,
    `Đơn vị chủ trì: ${String(view.leadUnit ?? "chưa có")}; cơ quan ban hành: ${String(view.issuingAuthority ?? "chưa có")}`,
  ];
  return clip(lines.join("\n"), 2000);
}

/** Nguồn để gắn link; null khi không đọc được hoặc văn bản bị loại (chỉ cần link, không cần câu giải thích). */
export async function resolveAssistantContextSource(
  authz: AuthorizationContext,
  ref: { type: "task" | "document"; id: string }
): Promise<AssistantSourceRef | null> {
  try {
    const record = await loadContextRecord(authz, ref);
    return record ? record.source : null;
  } catch (error) {
    if (error instanceof ToolFailure) return null;
    throw error;
  }
}

/**
 * Nguồn và mô tả ngắn để đưa vào prompt; null khi không đọc được. Ném ToolFailure (RESTRICTED_MESSAGE) khi người hỏi
 * đọc được văn bản nhưng văn bản bị loại vì mật/hạn chế.
 */
export async function describeAssistantContext(
  ctx: AssistantToolContext,
  ref: { type: "task" | "document"; id: string }
): Promise<{ source: AssistantSourceRef; summary: string } | null> {
  return loadContextRecord(ctx.authz, ref);
}
