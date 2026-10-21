/**
 * Giao diện Trợ lý (W1-UI, làm lại ở W2-R): mô hình thuần, render tĩnh các khối chính, và hợp đồng mã nguồn của
 * phần nối vào sidebar, bảng lệnh, khung trang và điều hướng (không thêm vào CANONICAL_ROUTES, không đổi phím tắt 1–6).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import * as fs from "fs";
import * as path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ASSISTANT_MESSAGE_MAX,
  type AssistantConversationSummaryDTO,
  type AssistantMessageDTO,
  type AssistantSourceRef,
} from "@qcet/contracts/assistant";
import {
  ASSISTANT_EXAMPLES,
  appendUniqueById,
  assistantHttpErrorMessage,
  conversationIdFromPath,
  conversationOutline,
  describeContextTarget,
  followUpSuggestions,
  formatDurationVi,
  pendingProposals,
  isSendKey,
  isStopKey,
  markProposalCreated,
  markReplyAborted,
  markReplyInterrupted,
  parseAssistantContextParam,
  questionMessageBefore,
  unansweredQuestion,
  retryMissesAttachments,
  setProposalDismissed,
  ASSISTANT_ATTACHMENT_ONLY_PROMPT,
  reduceAssistantReply,
  shouldApplyRenamedTitle,
  streamingThreadMessage,
  threadMessageFromDto,
  userThreadMessage,
  ASSISTANT_NO_ANSWER_MESSAGE,
  ASSISTANT_SERVER_ERROR_MESSAGE,
  type ThreadMessage,
} from "../apps/web/src/components/assistant/assistant-model";
import { AgentReplyText, AgentWorkLog, CopyMessageButton } from "../apps/web/src/components/agent-chat/agent-chat-parts";
import { nextRevealCount, revealSpeed, safeRevealEnd } from "../apps/web/src/components/agent-chat/use-smooth-text";
import {
  AssistantRequestError,
  resumeAssistantTurn,
  stopAssistantRunRequest,
  streamAssistantTurn,
} from "../apps/web/src/components/assistant/assistant-client";
import { AssistantComposer, AssistantFootnote } from "../apps/web/src/components/assistant/assistant-composer";
import { AgentModelsProvider } from "../apps/web/src/components/agent-chat/agent-models";
import { parseAgentModels } from "@qcet/shared/domain/agent/agent-models";
import { TASK_AGENT_ATTACHMENT_ACCEPT } from "@qcet/shared/domain/tasks/task-agent-attachments";
import { AssistantThread } from "../apps/web/src/components/assistant/assistant-thread";
import { AssistantSidePanel, hasOutline } from "../apps/web/src/components/assistant/assistant-side-panel";
import { AssistantHeader } from "../apps/web/src/components/assistant/assistant-header";
import { AssistantStartList } from "../apps/web/src/components/assistant/assistant-start";
import { listErrorText } from "../apps/web/src/components/assistant/use-assistant-history";
import { isAssistantPath, isRouteActive, resolveBreadcrumb } from "../apps/web/src/lib/navigation/active-matcher";
import { CANONICAL_ROUTES } from "../apps/web/src/lib/navigation/canonical-navigation-registry";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const SOURCE: AssistantSourceRef = {
  type: "task",
  id: "t1",
  code: "NV-2026-09-001",
  title: "Chuẩn bị hội nghị",
  href: "/tasks/t1",
};

describe("Trợ lý UI: tham số ngữ cảnh", () => {
  test("đọc đúng task, document và meeting, bỏ qua dạng sai", () => {
    assert.deepEqual(parseAssistantContextParam("task:abc123"), { type: "task", id: "abc123" });
    assert.deepEqual(parseAssistantContextParam("document:d-9"), { type: "document", id: "d-9" });
    // Cuộc họp là ngữ cảnh từ 21/10/2026 (bấm "Tạo biên bản" mở Trợ lý gắn với cuộc họp)
    assert.deepEqual(parseAssistantContextParam("meeting:1"), { type: "meeting", id: "1" });
    assert.equal(parseAssistantContextParam("user:1"), null);
    assert.equal(parseAssistantContextParam("task"), null);
    assert.equal(parseAssistantContextParam(":abc"), null);
    assert.equal(parseAssistantContextParam("task:"), null);
    assert.equal(parseAssistantContextParam("task:" + "x".repeat(65)), null);
    assert.equal(parseAssistantContextParam(undefined), null);
    assert.deepEqual(parseAssistantContextParam(["task:a", "document:b"]), { type: "task", id: "a" });
  });
});

describe("Trợ lý UI: thông báo lỗi HTTP", () => {
  test("429 có câu riêng; lỗi 4xx giữ detail rồi message; thiếu cả hai thì là câu dự phòng", () => {
    assert.equal(assistantHttpErrorMessage(429, { detail: "x" }), "Thầy/Cô gửi hơi nhanh. Chờ một phút rồi thử lại.");
    assert.equal(assistantHttpErrorMessage(400, { detail: "Câu hỏi quá dài." }), "Câu hỏi quá dài.");
    assert.equal(assistantHttpErrorMessage(400, { message: "Nhập câu hỏi" }), "Nhập câu hỏi");
    assert.equal(assistantHttpErrorMessage(404, null), "Trợ lý chưa trả lời được. Thầy/Cô thử lại sau.");
    assert.equal(assistantHttpErrorMessage(400, { detail: "   " }), "Trợ lý chưa trả lời được. Thầy/Cô thử lại sau.");
  });

  test("5xx luôn là câu chung, không lộ detail thô (kể cả khi máy chủ gửi 'Internal server error' hay câu của cờ tắt)", () => {
    assert.equal(assistantHttpErrorMessage(500, { detail: "Internal server error", code: "INTERNAL_ERROR" }), ASSISTANT_SERVER_ERROR_MESSAGE);
    assert.equal(assistantHttpErrorMessage(503, { detail: "Trợ lý đang tắt.", code: "FEATURE_DISABLED" }), ASSISTANT_SERVER_ERROR_MESSAGE);
    assert.equal(assistantHttpErrorMessage(502, { detail: "Gateway timeout nội bộ" }), ASSISTANT_SERVER_ERROR_MESSAGE);
    assert.equal(assistantHttpErrorMessage(500, null), ASSISTANT_SERVER_ERROR_MESSAGE);
    assert.equal(ASSISTANT_SERVER_ERROR_MESSAGE, "Trợ lý đang gặp sự cố. Thầy/Cô thử lại sau.");
  });

  test("mã INTERNAL_ERROR dù gắn với 4xx cũng không hiện chuỗi kỹ thuật", () => {
    assert.equal(assistantHttpErrorMessage(400, { detail: "Internal server error", code: "INTERNAL_ERROR" }), ASSISTANT_SERVER_ERROR_MESSAGE);
  });

  test("lỗi tải lịch sử: 5xx không lộ chuỗi thô của máy chủ, 4xx giữ lời máy chủ, lỗi mạng dùng câu chung", () => {
    assert.equal(listErrorText(new AssistantRequestError(500, "Internal server error")), "Chưa tải được lịch sử.");
    assert.equal(listErrorText(new AssistantRequestError(503, "Trợ lý đang tắt.")), "Chưa tải được lịch sử.");
    assert.equal(listErrorText(new AssistantRequestError(400, "Tham số không hợp lệ.")), "Tham số không hợp lệ.");
    assert.equal(listErrorText(new TypeError("Failed to fetch")), "Chưa tải được lịch sử.");
  });
});

describe("Trợ lý UI: gom sự kiện NDJSON vào một lượt", () => {
  test("bước, suy nghĩ, chữ và nguồn gom đúng; done gắn mã bản ghi và thời gian", () => {
    let reply: ThreadMessage = streamingThreadMessage("reply-1");
    reply = reduceAssistantReply(reply, { type: "step", step: { tool: "get_task", label: "Đọc nhiệm vụ NV-2026-09-001", count: 1, ok: true } });
    reply = reduceAssistantReply(reply, { type: "thinking", delta: "Cần đọc " });
    reply = reduceAssistantReply(reply, { type: "thinking", delta: "nhiệm vụ." });
    reply = reduceAssistantReply(reply, { type: "text", delta: "Nhiệm vụ " });
    reply = reduceAssistantReply(reply, { type: "text", delta: "NV-2026-09-001 đang chạy." });
    reply = reduceAssistantReply(reply, { type: "sources", sources: [SOURCE] });
    reply = reduceAssistantReply(reply, { type: "done", messageId: "m-9", status: "complete", durationMs: 4200 });

    assert.equal(reply.content, "Nhiệm vụ NV-2026-09-001 đang chạy.");
    assert.equal(reply.thinking, "Cần đọc nhiệm vụ.");
    assert.equal(reply.steps.length, 1);
    assert.deepEqual(reply.sources, [SOURCE]);
    assert.equal(reply.status, "complete");
    assert.equal(reply.id, "m-9");
    assert.equal(reply.durationMs, 4200);
    assert.equal(reply.key, "reply-1", "khóa React giữ nguyên trong suốt lượt");
  });

  test("lỗi có mã bản ghi thì tin lưu được; không có thì chỉ hiện lỗi tạm", () => {
    const base = streamingThreadMessage("reply-2");
    const saved = reduceAssistantReply(base, { type: "error", messageId: "m-err", error: { code: "AGENT_UNAVAILABLE", message: "Gateway lỗi" } });
    assert.equal(saved.status, "error");
    assert.equal(saved.id, "m-err");
    assert.equal(saved.errorMessage, "Gateway lỗi");
    const transient = reduceAssistantReply(base, { type: "error", error: { code: "X", message: "Lỗi" } });
    assert.equal(transient.id, null);
  });

  test("ngắt giữa chừng chỉ tác động tin đang chạy", () => {
    const streaming = streamingThreadMessage("reply-3");
    assert.equal(markReplyInterrupted(streaming).status, "error");
    assert.equal(markReplyAborted(streaming).status, "aborted");
    const done: ThreadMessage = { ...streaming, status: "complete" };
    assert.equal(markReplyInterrupted(done), done);
    assert.equal(markReplyAborted(done), done);
  });

  test("đề xuất nhiệm vụ: gom theo thứ tự, thẻ hiện khi chữ xong và có nút mở hộp; lượt chỉ soạn ghi \"Đã soạn đề xuất\"", () => {
    const proposal = {
      title: "Chuẩn bị hội thảo chuyển đổi số",
      dueDate: "2026-10-30",
      leadAssigneeName: "chị Lan",
      priority: "HIGH" as const,
      subtasks: [{ title: "Đặt hội trường", assigneeName: "anh Minh" }],
    };
    let reply = streamingThreadMessage("reply-p");
    reply = reduceAssistantReply(reply, { type: "step", step: { tool: "propose_task", label: "Soạn đề xuất “Chuẩn bị hội thảo”", count: null, ok: true } });
    reply = reduceAssistantReply(reply, { type: "proposal", proposal });
    reply = reduceAssistantReply(reply, { type: "proposal", proposal: { title: "Gửi giấy mời dự hội thảo" } });
    const opened: Array<{ replyKey: string; index: number; title: string }> = [];
    const onOpen = (target: { replyKey: string; index: number; proposal: { title: string } }) =>
      void opened.push({ replyKey: target.replyKey, index: target.index, title: target.proposal.title });
    const onDismissProposal = () => undefined;
    const render = (message: ThreadMessage, onOpenProposal?: typeof onOpen) =>
      renderToStaticMarkup(
        React.createElement(AssistantThread, {
          thread: [userThreadMessage("u1", "Tạo nhiệm vụ hội thảo"), message],
          detailStatus: "ready",
          detailError: null,
          onRetry: () => undefined,
          onNewChat: () => undefined,
          listRef: { current: null },
          onScroll: () => undefined,
          onOpenProposal,
          onDismissProposal: onOpenProposal ? onDismissProposal : undefined,
        }),
      );
    const streamingHtml = render(reply, onOpen);
    assert.ok(streamingHtml.includes("Đang soạn đề xuất…"));
    assert.equal(streamingHtml.includes("Xem lại và tạo"), false, "đang chạy thì chưa hiện thẻ");

    reply = reduceAssistantReply(reply, { type: "text", delta: "Tôi đã soạn đề xuất." });
    reply = reduceAssistantReply(reply, { type: "done", messageId: "m-p", status: "complete", durationMs: 2000 });
    assert.deepEqual(reply.proposals?.map((item) => item.title), ["Chuẩn bị hội thảo chuyển đổi số", "Gửi giấy mời dự hội thảo"]);
    const html = render(reply, onOpen);
    for (const text of ["Đã soạn đề xuất trong 2 giây", "Đề xuất nhiệm vụ", "30/10/2026", "chị Lan", "Cao", "Việc con", "Đặt hội trường", "anh Minh"]) {
      assert.ok(html.includes(text), text);
    }
    assert.equal((html.match(/Xem lại và tạo/g) ?? []).length, 2);
    // Hai thao tác như mẫu xác nhận của agent, bên phải như chân hộp thoại: Bỏ qua (ghost) rồi nút chính sát mép
    assert.equal((html.match(/>Bỏ qua</g) ?? []).length, 2);
    assert.ok(html.indexOf(">Bỏ qua<") < html.indexOf("Xem lại và tạo"), "nút chính đứng sau, sát mép phải");
    // Người dùng bỏ nhãn "Chưa tạo" và lời nhắc trường thiếu (18/10/2026); lưới chỉ có trường có giá trị
    for (const text of ["Chưa tạo", "Chưa chọn", "Cần chọn", "nhắn thêm"]) assert.equal(html.includes(text), false, text);
    assert.equal((html.match(/<dl/g) ?? []).length, 1, "đề xuất chỉ có tiêu đề thì không có lưới thuộc tính");
    const readOnly = render(reply);
    assert.equal(readOnly.includes("Xem lại và tạo") || readOnly.includes("Bỏ qua"), false, "không có nơi mở hộp thì thẻ không có nút");

    // Bỏ qua thẻ đầu: thu gọn một hàng "Đã bỏ qua đề xuất", có Hoàn tác; hoàn tác thì thẻ đầy đủ trở lại
    const dismissed = setProposalDismissed([reply], "reply-p", 0, true)[0];
    assert.deepEqual(dismissed.dismissedProposals, [0]);
    assert.equal(setProposalDismissed([reply], "reply-p", 5, true)[0], reply, "đề xuất không có thì không đổi");
    const dismissedHtml = render(dismissed, onOpen);
    assert.ok(dismissedHtml.includes('aria-label="Đã bỏ qua đề xuất: Chuẩn bị hội thảo chuyển đổi số"') && dismissedHtml.includes("Hoàn tác"));
    assert.equal((dismissedHtml.match(/Xem lại và tạo/g) ?? []).length, 1);
    assert.equal(dismissedHtml.includes("Đặt hội trường"), false, "thẻ đã bỏ qua không còn lưới");
    assert.deepEqual(setProposalDismissed([dismissed], "reply-p", 0, false)[0].dismissedProposals, []);

    // Tạo xong từ thẻ thứ hai: thẻ đó báo "Đã tạo" kèm mã và lối mở, không còn nút; thẻ đầu giữ nguyên
    const created = markProposalCreated([reply], "reply-p", 1, { id: "t-9", code: "NV-2026-10-009" })[0];
    assert.equal(markProposalCreated([reply], "khac", 1, { id: "t-9", code: null })[0], reply, "tin khác không đổi");
    const createdHtml = render(created, onOpen);
    assert.equal((createdHtml.match(/Xem lại và tạo/g) ?? []).length, 1);
    assert.ok(createdHtml.includes("Đã tạo nhiệm vụ NV-2026-10-009") && createdHtml.includes('href="/tasks/t-9"') && createdHtml.includes("Mở nhiệm vụ"));
    assert.ok(createdHtml.includes('role="status"'), "trạng thái đã tạo được đọc cho trình đọc màn hình");
    assert.ok(createdHtml.includes('aria-label="Đã tạo nhiệm vụ: Gửi giấy mời dự hội thảo"'));
    assert.equal((createdHtml.match(/>Bỏ qua</g) ?? []).length, 1, "thẻ đã tạo thu gọn, không còn chân thẻ; thẻ đầu giữ nguyên");
    // Lượt đọc tệp gửi kèm rồi soạn đề xuất vẫn ghi "Đã soạn đề xuất"
    const withFile = { ...reply, steps: [{ tool: "attachment" as const, label: "Đọc tệp qd.pdf", count: null, ok: true }, ...reply.steps] };
    assert.ok(render(withFile).includes("Đã soạn đề xuất trong 2 giây"));
    // Thẻ lưu ở máy chủ: mở lại cuộc thì thẻ và trạng thái (đã tạo, bỏ qua) vẫn còn, như ChatGPT
    const base = { id: "m-p", role: "assistant" as const, content: "x", status: "complete" as const, sources: [], steps: [], durationMs: 1, createdAt: "2026-10-18T00:00:00Z" };
    assert.equal(threadMessageFromDto({ ...base, proposals: [] }).proposals, undefined, "tin không có thẻ");
    const reloaded = threadMessageFromDto({
      ...base,
      proposals: [
        { proposal: { title: "Chuẩn bị hội thảo chuyển đổi số" }, task: null, dismissed: true },
        { proposal: { title: "Gửi giấy mời dự hội thảo" }, task: { id: "t-9", code: "NV-2026-10-009" }, dismissed: false },
      ],
    });
    assert.deepEqual(reloaded.proposals?.map((item) => item.title), ["Chuẩn bị hội thảo chuyển đổi số", "Gửi giấy mời dự hội thảo"]);
    assert.deepEqual(reloaded.dismissedProposals, [0]);
    assert.deepEqual(reloaded.proposalTasks, { 1: { id: "t-9", code: "NV-2026-10-009" } });
    const reloadedHtml = render({ ...reloaded, key: "reply-p" }, onOpen);
    assert.ok(reloadedHtml.includes("Đã bỏ qua đề xuất") && reloadedHtml.includes("Đã tạo nhiệm vụ NV-2026-10-009"));
    assert.equal(reloadedHtml.includes("Xem lại và tạo"), false);
  });

  test("hoàn tất với status error và không có chữ: tin hiện câu lỗi và nút 'Thử lại'", () => {
    const reply = reduceAssistantReply(streamingThreadMessage("reply-empty"), { type: "done", messageId: "m-empty", status: "error", durationMs: 900 });
    assert.equal(reply.status, "error");
    assert.equal(reply.content, "");
    const html = renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread: [userThreadMessage("u1", "Hỏi"), reply],
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
      }),
    );
    assert.ok(html.includes(ASSISTANT_NO_ANSWER_MESSAGE));
    assert.ok(html.includes("Thử lại"));
  });

  test("đổi tên xong chỉ áp lên thanh đầu khi vẫn đang mở đúng cuộc đó", () => {
    assert.equal(shouldApplyRenamedTitle("c-1", "c-1"), true);
    assert.equal(shouldApplyRenamedTitle("c-2", "c-1"), false, "đã mở cuộc khác trong lúc chờ");
    assert.equal(shouldApplyRenamedTitle(null, "c-1"), false, "không còn cuộc nào đang mở");
  });

  test("Thử lại gửi lại đúng câu hỏi ngay trước tin lỗi", () => {
    const thread: ThreadMessage[] = [
      userThreadMessage("u1", "Việc của tôi sắp tới hạn"),
      streamingThreadMessage("a1"),
      userThreadMessage("u2", "Văn bản đến hôm nay"),
      streamingThreadMessage("a2"),
    ];
    assert.equal(questionMessageBefore(thread, "a1")?.content, "Việc của tôi sắp tới hạn");
    assert.equal(questionMessageBefore(thread, "a2")?.content, "Văn bản đến hôm nay");
    assert.equal(questionMessageBefore(thread, "missing"), null);
  });
});

describe("Trợ lý UI: DTO lịch sử và nhãn ngữ cảnh", () => {
  test("đổi DTO tin thành tin hiển thị giữ đủ nguồn, bước và thời gian", () => {
    const dto: AssistantMessageDTO = {
      id: "m-1",
      role: "assistant",
      content: "Có 2 nhiệm vụ.",
      status: "complete",
      sources: [SOURCE],
      steps: [{ tool: "list_tasks", label: "Xem nhiệm vụ của Thầy/Cô", count: 2, ok: true }],
      proposals: [],
      durationMs: 3100,
      createdAt: "2026-10-17T03:00:00.000Z",
    };
    const message = threadMessageFromDto(dto);
    assert.equal(message.key, "m-1");
    assert.equal(message.id, "m-1");
    assert.deepEqual(message.sources, [SOURCE]);
    assert.equal(message.steps.length, 1);
    assert.equal(message.durationMs, 3100);
    assert.equal(message.status, "complete");
  });

  test("nhãn mục đang hỏi: mã và tiêu đề của nhiệm vụ; số và trích yếu của văn bản", () => {
    assert.equal(describeContextTarget("task", { code: "NV-2026-09-001", title: "Chuẩn bị hội nghị" }), "NV-2026-09-001 Chuẩn bị hội nghị");
    assert.equal(describeContextTarget("document", { originalNumber: "123/QĐ-UBND", summary: "Phân công" }), "123/QĐ-UBND · Phân công");
    assert.equal(describeContextTarget("task", null), null);
    assert.equal(describeContextTarget("task", {}), null);
  });

  test("trang lịch sử mới nối vào cuối và bỏ mục đã có (con trỏ đổi mốc làm trang sau lặp lại)", () => {
    const prev = [{ id: "a", title: "Một" }, { id: "b", title: "Hai" }];
    const next = [{ id: "b", title: "Hai" }, { id: "c", title: "Ba" }];
    assert.deepEqual(appendUniqueById(prev, next).map((item) => item.id), ["a", "b", "c"]);
    assert.deepEqual(appendUniqueById([], []), []);
  });

  test("màn đầu có ba thẻ ví dụ như Linear Agent: tạo nhiệm vụ (không gửi câu hỏi) và hai câu hỏi", () => {
    // Người dùng bỏ bốn dòng gợi ý cũ, cho tạo nhiệm vụ ngay (17/10/2026)
    assert.deepEqual(
      ASSISTANT_EXAMPLES.map((example) => [example.id, example.prompt ?? null]),
      [
        ["create-task", null],
        ["due-soon", "Việc của tôi sắp tới hạn tuần này"],
        ["pending-documents", "Văn bản đến đang chờ xử lý"],
      ],
    );
  });
});

describe("Trợ lý UI: phím gửi", () => {
  const key = (overrides: Partial<{ key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }>) => ({
    key: "Enter",
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
    ...overrides,
  });

  test("Enter gửi, Shift+Enter và phím khác không gửi, IME đang chốt chữ không gửi", () => {
    assert.equal(isSendKey(key({})), true);
    assert.equal(isSendKey(key({ shiftKey: true })), false);
    assert.equal(isSendKey(key({ key: "a", keyCode: 65 })), false);
    assert.equal(isSendKey(key({ isComposing: true })), false);
    assert.equal(isSendKey(key({ keyCode: 229 })), false);
  });
});

describe("Trợ lý UI: màn đầu (căn giữa, không cột phụ)", () => {
  const noop = () => undefined;
  const summary = (id: string, title: string, lastMessageAt = "2026-10-17T03:00:00.000Z"): AssistantConversationSummaryDTO => ({
    id,
    title,
    titleEdited: false,
    contextType: null,
    contextId: null,
    createdAt: lastMessageAt,
    lastMessageAt,
  });

  test("màn đầu không có câu tiêu đề lớn, chỉ ô soạn và danh sách như Linear Agent", () => {
    for (const rel of ["apps/web/src/components/assistant/assistant-start.tsx", "apps/web/src/components/assistant/assistant-workspace.tsx"]) {
      const src = read(rel);
      assert.equal(src.includes("Thầy/Cô cần tìm gì trong công việc?"), false, `${rel}: người dùng đã bỏ câu tiêu đề`);
      assert.equal(src.includes("AssistantStartHeading"), false, rel);
    }
  });

  test("chưa có cuộc nào thì hiện thẻ ví dụ (icon sidebar, tên, mô tả) có nút ẩn, không có danh sách gần đây", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantStartList, { items: [], status: "ready", now: new Date(), onSuggest: noop, onCreateTask: noop }),
    );
    assert.ok(html.includes("Bắt đầu với vài gợi ý") && html.includes('aria-label="Ẩn gợi ý"'));
    for (const example of ASSISTANT_EXAMPLES) {
      assert.ok(html.includes(example.title) && html.includes(example.description), `thiếu thẻ: ${example.title}`);
    }
    assert.equal(html.includes("Cuộc trò chuyện gần đây"), false);
    const src = read("apps/web/src/components/assistant/assistant-start.tsx");
    assert.ok(src.includes('"create-task": IconSidebarTasks') && src.includes('"pending-documents": IconSidebarInboxIn'), "icon cùng bộ với sidebar");
    assert.equal(/from "lucide-react"/.test(src) && /Calendar|TriangleAlert|Inbox/.test(src.split("\n").find((l) => l.includes("lucide-react")) ?? ""), false, "không còn icon Lucide của gợi ý cũ");
    assert.ok(src.includes("prompt ? onSuggest(prompt) : onCreateTask()"), "thẻ hỏi gửi câu, thẻ tạo nhiệm vụ mở hộp tạo");
    assert.ok(src.includes('"qcet.assistant.examplesHidden"'), "ẩn thẻ nhớ theo trình duyệt");
  });

  test("gợi ý và lịch sử không hiện cùng lúc: đã có cuộc thì chỉ hiện tối đa ba cuộc gần đây; thẻ chỉ hiện khi chưa có cuộc nào", () => {
    const items = [summary("a", "Một"), summary("b", "Hai"), summary("c", "Ba"), summary("d", "Bốn")];
    const render = (props: Record<string, unknown>) =>
      renderToStaticMarkup(
        React.createElement(AssistantStartList, { items, status: "ready", now: new Date("2026-10-17T10:00:00+07:00"), onSuggest: noop, onCreateTask: noop, ...props }),
      );
    const withHistory = render({});
    assert.equal(withHistory.includes("Bắt đầu với vài gợi ý"), false, "đã có lịch sử thì bỏ thẻ gợi ý");
    assert.ok(withHistory.includes('href="/assistant/a"') && withHistory.includes('href="/assistant/c"'));
    assert.equal(withHistory.includes('href="/assistant/d"'), false, "chỉ ba cuộc");
    assert.ok(render({ items: [] }).includes("Bắt đầu với vài gợi ý"), "trang trống thì có thẻ gợi ý");
    const loading = render({ items: [], status: "loading" });
    assert.ok(loading.includes('aria-busy="true"') && !loading.includes("Bắt đầu với vài gợi ý"), "đang tải thì giữ chỗ, không hiện thẻ rồi đổi sang lịch sử");
  });

  test("\"Xem lại và tạo\" mang tệp của lượt hỏi sang hộp tạo việc: đính kèm cuối mô tả và đặt sẵn ở ô soạn của Agent", () => {
    const chatHook = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(chatHook.includes("questionMessageBefore(thread, replyKey)?.attachments"), "lấy tệp của đúng câu hỏi sinh ra tin trả lời");
    const launcher = read("apps/web/src/components/assistant/use-create-task-launcher.tsx");
    assert.ok(launcher.includes("setContextFiles(next && files ? files : [])") && launcher.includes("initialContextFiles={contextFiles}"), "chỉ mang tệp khi mở từ đề xuất");
    const modal = read("apps/web/src/components/tasks/create/create-task-modal.tsx");
    assert.ok(modal.includes('type: "attachment"') && modal.includes("await uploadFile(file)"), "tải lên rồi thêm khối tệp, không dùng khối ảnh");
    // Điền đề xuất thay cả mô tả: tệp chỉ thêm sau khi đề xuất đã điền, vào mô tả đang có lúc tải xong
    assert.ok(/applyAgentDraftRef\.current\(proposalToTaskDraft[\s\S]{0,200}attachContextFiles\(contextFilesRef\.current\)/.test(modal));
    assert.ok(modal.includes("parseContentToBlocks(formRef.current.formData.description)"));
    assert.ok(modal.includes("if (contextUploadingRef.current) return;") && modal.includes('"Đang đính kèm tệp…"'), "đang tải tệp thì chưa cho tạo");
    const panel = read("apps/web/src/components/tasks/create/task-agent-panel.tsx");
    assert.ok(panel.includes("seededFilesRef.current === initialFiles") && panel.includes("addFiles(initialFiles)"), "tệp đặt sẵn ở ô soạn Agent một lần, qua cùng kiểm tra tệp");
  });

  test("thẻ \"Tạo nhiệm vụ\" mở hộp tạo nhiệm vụ chuẩn, tải khi cần và báo đã tạo kèm lối mở", () => {
    const launcher = read("apps/web/src/components/assistant/use-create-task-launcher.tsx");
    assert.ok(launcher.includes('import("@/components/tasks/create/create-task-modal")'), "tải hộp khi cần, không nặng lúc mở trang");
    assert.ok(launcher.includes("createTaskMounted ? (") && launcher.includes("isOpen={createTaskOpen}"), "gắn từ lần bấm đầu, đóng còn hiệu ứng");
    assert.ok(launcher.includes('label: "Mở nhiệm vụ"'), "tạo xong có lối mở nhiệm vụ");
    assert.ok(read("apps/web/src/components/assistant/assistant-workspace.tsx").includes("useCreateTaskLauncher()"));
    // Khung chat nổi không có chip gợi ý (17/10) nhưng thẻ đề xuất nhiệm vụ mở hộp ngay trên trang đang xem (ADR-010)
    const dock = read("apps/web/src/components/assistant/assistant-dock.tsx");
    // Tạo xong thì thẻ của đúng đề xuất đó chuyển sang "Đã tạo"; tệp của lượt hỏi đi kèm sang hộp
    const opensProposal = "openCreateTask(proposal, (task) => chat.proposalCreated(replyKey, index, task), chat.filesForReply(replyKey))";
    assert.ok(dock.includes("useCreateTaskLauncher()") && dock.includes(opensProposal) && dock.includes("{createTaskModal}"));
    assert.ok(read("apps/web/src/components/assistant/assistant-workspace.tsx").includes(opensProposal));
    // Bỏ qua thẻ được ở cả hai nơi; trạng thái thẻ lưu ở máy chủ, bỏ qua lưu lỗi thì trả thẻ về
    for (const file of ["assistant-dock.tsx", "assistant-workspace.tsx"]) {
      assert.ok(read(`apps/web/src/components/assistant/${file}`).includes("onDismissProposal={chat.proposalDismissed}"), file);
    }
    assert.ok(read("apps/web/src/components/assistant/assistant-dock-panel.tsx").includes("onDismissProposal={onDismissProposal}"));
    // Bỏ qua/Hoàn tác của thẻ danh sách: một request cho cả nhóm ở cả hai nơi (giới hạn ghi 60 request/phút)
    for (const file of ["assistant-dock.tsx", "assistant-workspace.tsx"]) {
      assert.ok(read(`apps/web/src/components/assistant/${file}`).includes("onDismissProposals={chat.proposalsDismissed}"), file);
    }
    assert.ok(read("apps/web/src/components/assistant/assistant-dock-panel.tsx").includes("onDismissProposals={onDismissProposals}"));
    const chatHook = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(chatHook.includes("saveProposal(replyKey, { index, taskId: task.id }") && chatHook.includes("saveProposal(replyKey, { index, dismissed }"));
    assert.ok(chatHook.includes("setThread((prev) => setProposalDismissed(prev, replyKey, index, !dismissed))"), "lưu lỗi thì hoàn lại");
    assert.ok(chatHook.includes("saveProposal(replyKey, { indexes, dismissed }"), "cả nhóm một lần lưu");
    // Tên do mô hình đặt cập nhật thanh đầu (đúng cuộc đang mở) và danh sách
    assert.ok(chatHook.includes('if (event.type === "title") {') && chatHook.includes("if (activeIdRef.current === event.conversation.id) setActiveTitle(event.conversation.title);"));
    assert.ok(launcher.includes("notifyCard({ id: task.id, code: task.code ?? null });\n          return;"), "mở từ thẻ: báo cho thẻ, không thêm toast trùng");
  });

  test("ô soạn màn đầu có giới hạn độ dài, chip mục đang hỏi và chân trang chỉ đọc", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantComposer, {
        value: "",
        onChange: noop,
        onSubmit: noop,
        onStop: noop,
        pending: false,
        disabled: false,
        context: { label: "NV-2026-09-001 Chuẩn bị hội nghị", onRemove: noop },
        error: null,
        variant: "hero",
      }),
    );
    assert.ok(html.includes(`maxLength="${ASSISTANT_MESSAGE_MAX}"`));
    assert.ok(html.includes("Đang hỏi về:"));
    assert.ok(html.includes("NV-2026-09-001 Chuẩn bị hội nghị"));
    assert.ok(html.includes('data-variant="hero"'));
    assert.ok(html.includes("Hỏi về nhiệm vụ, văn bản, lịch họp…"));
  });

  test("bộ chọn model ở ô soạn chỉ hiện khi máy chủ cho từ hai model; mặc định là TASK_AGENT_MODEL", () => {
    const composer = (catalog: ReturnType<typeof parseAgentModels>) =>
      renderToStaticMarkup(
        React.createElement(AgentModelsProvider, {
          catalog,
          children: React.createElement(AssistantComposer, {
            value: "",
            onChange: noop,
            onSubmit: noop,
            onStop: noop,
            pending: false,
            disabled: false,
            context: null,
            error: null,
          }),
        }),
      );
    const picker = composer(parseAgentModels("opus-4.6,gemini-3.8-flash", "sonnet-4.6"));
    assert.ok(picker.includes("Model: ") && picker.includes("Claude Sonnet 4.6"), "nút hiện model mặc định khi chưa chọn");
    assert.equal(composer(parseAgentModels(undefined, "sonnet-4.6")).includes("Model: "), false, "một model thì không có bộ chọn");
    assert.equal(composer(null).includes("Model: "), false, "Trợ lý tắt thì không có bộ chọn");
    const chat = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(chat.includes("const { model } = useAgentModel();") && chat.includes("...(model ? { model } : {}),"), "lượt gửi mang model đã chọn");
    const route = read("apps/api/src/app/api/assistant/chat/route.ts");
    assert.ok(route.includes("!isAllowedAgentModel(getAgentModelCatalog(), body.model)") && route.includes('"MODEL_NOT_ALLOWED"'), "máy chủ kiểm model theo danh sách cho phép");
  });

  test("ô soạn nhận ảnh/tệp như Agent tạo nhiệm vụ: nút ghim, thẻ tệp chờ gửi, chỉ có tệp vẫn gửi được", () => {
    const composer = (props: Partial<React.ComponentProps<typeof AssistantComposer>>) =>
      renderToStaticMarkup(
        React.createElement(AssistantComposer, {
          value: "",
          onChange: noop,
          onSubmit: noop,
          onStop: noop,
          pending: false,
          disabled: false,
          context: null,
          error: null,
          ...props,
        }),
      );
    const file = new File(["Họp lúc 9 giờ"], "ghi-chu.txt", { type: "text/plain" });
    const html = composer({ attachments: [{ id: "a1", file, kind: "text" }], onAddAttachments: noop, onRemoveAttachment: noop });
    assert.ok(html.includes('aria-label="Đính kèm ảnh hoặc tệp"'), "có nút ghim");
    assert.ok(html.includes(`accept="${TASK_AGENT_ATTACHMENT_ACCEPT}"`), "cùng loại tệp với Agent tạo nhiệm vụ");
    assert.ok(html.includes("ghi-chu.txt") && html.includes('aria-label="Bỏ tệp ghi-chu.txt"'), "thẻ tệp chờ gửi bỏ được");
    const sendTag = html.match(/<button[^>]*aria-label="Gửi cho Trợ lý"[^>]*>/)?.[0] ?? "";
    assert.ok(sendTag && !/\sdisabled=""/.test(sendTag), "chỉ có tệp, chưa gõ chữ vẫn gửi được");
    const emptyTag = composer({}).match(/<button[^>]*aria-label="Gửi cho Trợ lý"[^>]*>/)?.[0] ?? "";
    assert.ok(/\sdisabled=""/.test(emptyTag), "không chữ, không tệp thì nút gửi tắt");
    assert.equal(composer({}).includes("Đính kèm ảnh hoặc tệp"), false, "không truyền onAddAttachments thì không có nút ghim");
    assert.equal(ASSISTANT_ATTACHMENT_ONLY_PROMPT, "Tóm tắt tệp đính kèm.");

    const thread = renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread: [userThreadMessage("u1", "Tóm tắt giúp", [{ id: "a1", file, kind: "text" }])],
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
      }),
    );
    assert.ok(thread.indexOf("ghi-chu.txt") < thread.indexOf("Tóm tắt giúp"), "tệp đã gửi hiện trên câu hỏi");
    const chat = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(
      chat.includes("if (fromComposer && restored && attachmentsRef.current.length === 0) setAttachments(sentAttachments);"),
      "máy chủ từ chối thì trả tệp về ô soạn cùng chữ, chỉ khi ô soạn còn trống",
    );
    assert.ok(read("apps/web/src/components/assistant/assistant-workspace.tsx").includes("void chat.send(text, restoreDraft, []);"), "gợi ý không lấy tệp đang chờ");
    const dock = read("apps/web/src/components/assistant/assistant-dock.tsx");
    assert.equal(dock.match(/chat\.clearAttachments\(\);/g)?.length, 2, "khung nổi bỏ tệp chờ cùng chữ nháp khi mở cuộc mới hoặc cuộc khác");
    assert.ok(read("apps/web/src/components/assistant/assistant-dock-panel.tsx").includes("onAddAttachments={onAddAttachments}"), "khung chat nổi cũng gửi được tệp");
  });

  test("Thử lại câu hỏi từng kèm tệp mà tệp không còn trong phiên thì không gửi thiếu tệp", () => {
    const file = new File(["x"], "so-do.png", { type: "image/png" });
    const reply: ThreadMessage = {
      ...streamingThreadMessage("r1"),
      status: "error",
      steps: [{ tool: "attachment", label: "Xem ảnh so-do.png", count: null, ok: true }],
    };
    assert.equal(retryMissesAttachments(userThreadMessage("u1", "Ảnh này nói gì?"), reply), true, "mở lại từ lịch sử: tệp đã mất");
    assert.equal(retryMissesAttachments(userThreadMessage("u1", "Ảnh này nói gì?", [{ id: "a1", file, kind: "image" }]), reply), false, "còn tệp trong phiên");
    assert.equal(retryMissesAttachments(userThreadMessage("u1", "Việc trễ hạn?"), { ...reply, steps: [] }), false, "câu hỏi không kèm tệp");
    const chat = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(chat.includes("setSendError(ASSISTANT_RETRY_ATTACHMENTS_GONE);"), "báo đính kèm lại thay vì gửi");
    assert.ok(
      chat.includes("if (id === activeIdRef.current) {") && chat.includes("return sent ? { ...message, attachments: sent } : message;"),
      "tải lại đúng cuộc thì giữ tệp đã gửi trong phiên (thẻ đề xuất do máy chủ trả)",
    );
  });

  test("Agent tạo nhiệm vụ dùng chung bộ chọn model và thẻ tệp với Trợ lý", () => {
    const panel = read("apps/web/src/components/tasks/create/task-agent-panel.tsx");
    assert.ok(panel.includes('<AgentModelPicker positionerClassName="z-50" />') && panel.includes("...(model ? { model } : {}),"), "chọn model ở ô soạn (menu nổi trên hộp z-50) và gửi kèm lượt");
    assert.ok(panel.includes('from "@/components/agent-chat/agent-attachments"') && !panel.includes("function AttachmentCard"), "thẻ tệp dùng chung");
    const route = read("apps/api/src/app/api/tasks/agent-draft/route.ts");
    assert.ok(route.includes("!isAllowedAgentModel(getAgentModelCatalog(), body.model)"), "máy chủ kiểm model theo cùng danh sách");
  });

  test("ô soạn chạm max-h-40 thì cuộn được: overflow-y-auto đi cùng overflow-hidden của autoResize", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantComposer, {
        value: "",
        onChange: noop,
        onSubmit: noop,
        onStop: noop,
        pending: false,
        disabled: false,
        context: null,
        error: null,
      }),
    );
    const textareaTag = html.match(/<textarea[^>]*>/)?.[0] ?? "";
    assert.ok(textareaTag.includes("max-h-40") && textareaTag.includes("overflow-y-auto"), textareaTag);
    assert.ok(textareaTag.includes("overflow-hidden"), "autoResize vẫn đặt overflow-hidden; overflow-y-auto phải đi sau trong CSS");
  });

  test("chân trang chỉ đọc ghi đủ câu, không còn ký hiệu · ngăn cách", () => {
    const html = renderToStaticMarkup(React.createElement(AssistantFootnote));
    assert.ok(html.includes("Trợ lý AI chỉ đọc dữ liệu Thầy/Cô được xem và có thể sai. Kiểm tra lại ở nguồn."));
    assert.equal(html.includes("·"), false);
    // Chỉ ở màn đầu, ở đáy khung như ChatGPT (ngoài cụm căn giữa); đang chat thì ẩn, ô soạn có đệm dưới thay chỗ
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(/<\/div>\s*\{\/\* Chân trang chỉ ở màn đầu[^}]*\*\/\}\s*\{start \? <AssistantFootnote \/> : null\}\s*<\/div>/.test(workspace), "chân trang là con trực tiếp của khung cuộn, sau cụm căn giữa, chỉ ở màn đầu");
    assert.ok(workspace.includes('!start && "pb-4"'), "đang chat: ô soạn cách đáy 16px");
  });
});

describe("Trợ lý UI: đường dẫn là nguồn chuẩn của cuộc đang mở", () => {
  test("/assistant là cuộc mới, /assistant/<id> lấy đúng mã, sai tiền tố thì không", () => {
    assert.equal(conversationIdFromPath("/assistant"), null);
    assert.equal(conversationIdFromPath("/assistant/"), null);
    assert.equal(conversationIdFromPath("/assistant/c-new"), "c-new");
    assert.equal(conversationIdFromPath("/assistant/a%20b"), "a b");
    assert.equal(conversationIdFromPath("/assistants/abc"), null);
    assert.equal(conversationIdFromPath("/inbox"), null);
  });

  test("Esc dừng lượt, trừ khi đang chốt IME hoặc ô khác đã xử lý phím", () => {
    assert.equal(isStopKey({ key: "Escape", defaultPrevented: false, isComposing: false }), true);
    assert.equal(isStopKey({ key: "Escape", defaultPrevented: false, isComposing: true }), false);
    assert.equal(isStopKey({ key: "Escape", defaultPrevented: true, isComposing: false }), false);
    assert.equal(isStopKey({ key: "Enter", defaultPrevented: false, isComposing: false }), false);
  });

  test("lỗi trong lúc trả lời không xóa chữ đã có", () => {
    const partial = reduceAssistantReply(streamingThreadMessage("r-x"), { type: "text", delta: "Đã có một phần" });
    const failed = reduceAssistantReply(partial, { type: "error", error: { code: "AGENT_UNAVAILABLE", message: "Gateway lỗi" } });
    assert.equal(failed.content, "Đã có một phần");
    assert.equal(failed.status, "error");
  });

  test("dừng/hủy lượt trước khi có mã cuộc vẫn làm mới lịch sử, nhưng không làm mới sau khi đã rời trang", () => {
    const chat = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(
      chat.includes("if (activeIdRef.current || (controller.signal.aborted && !unmountedRef.current)) void callbacksRef.current.onTurnSettled();"),
      "điều kiện làm mới phải gồm lượt đã dừng/hủy",
    );
    assert.ok(chat.includes("unmountedRef.current = true"), "rời trang phải đánh dấu");
  });

  test("khung làm việc lấy cuộc từ đường dẫn, Esc đi qua isStopKey, lượt mới luôn cuộn xuống", () => {
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("usePathname()") && workspace.includes("conversationIdFromPath(pathname)"), "cuộc đang mở phải theo đường dẫn");
    assert.ok((workspace.match(/stickToBottomRef\.current = true/g) ?? []).length >= 2, "gửi và gợi ý đều phải cuộn xuống");
    const composer = read("apps/web/src/components/assistant/assistant-composer.tsx");
    assert.ok(composer.includes("isStopKey(event)"));
    assert.equal(/safe-area-inset-bottom/.test(composer), false, "đáy điện thoại đã do app-shell đệm, không đệm hai lần");
  });

  test("đổi tên kết thúc bằng phím thì trả tiêu điểm về nút '…'; bấm chỗ khác thì không cướp tiêu điểm", () => {
    const header = read("apps/web/src/components/assistant/assistant-header.tsx");
    assert.ok(header.includes("restoreFocusRef.current = true"), "Enter/Esc phải đánh dấu trả tiêu điểm");
    assert.ok(header.includes("moreTriggerRef.current?.focus()"), "phải đưa tiêu điểm về nút '…'");
    assert.ok(header.includes("<MenuTrigger asChild ref={moreTriggerRef}>"), "nút '…' phải có ref");
    // Chỉ Enter và Esc đánh dấu; kết thúc do onBlur (bấm chỗ khác) thì không
    assert.equal((header.match(/restoreFocusRef\.current = true/g) ?? []).length, 2, "chỉ Enter và Esc đánh dấu");
  });

  test("đổi tên so với tên lúc mở ô (không so với tiêu đề hiện tại), và 'Đổi tên' tắt khi tiêu đề thật chưa tải xong", () => {
    const header = read("apps/web/src/components/assistant/assistant-header.tsx");
    assert.ok(header.includes("renameBaseRef.current = title ?? \"\""), "lưu tên lúc mở ô");
    assert.ok(header.includes("next !== renameBaseRef.current"), "so với tên đã lưu");
    assert.equal(/next !== title\b/.test(header), false, "không so với tiêu đề hiện tại");
    assert.ok(header.includes("disabled={titleLoading}"), "mục Đổi tên bị vô hiệu khi đang tải");
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("titleLoading={activeId !== null && activeTitle === null}"));
  });

  test("tên cuộc đổi xong không ghi đè tiêu đề khi người dùng đã mở cuộc khác", () => {
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("shouldApplyRenamedTitle(chat.readActiveId(), id)"), "phải kiểm cuộc đang mở sau await");
    assert.equal(/chat\.setActiveTitle\(updated\.title\)/.test(workspace), true);
  });

  test("vùng chạm điện thoại 44px cho nút bỏ mục, tải thêm, sao chép, thử lại và cuộc mới", () => {
    const composer = read("apps/web/src/components/assistant/assistant-composer.tsx");
    assert.ok(composer.includes("max-md:size-11") && composer.includes("max-md:-my-3"), "nút bỏ mục đang hỏi");
    // Lịch sử trên điện thoại là bottom sheet của menu: mọi hàng (kể cả Tải thêm, Thử lại) cao 40px theo SHEET_POPUP_CLASS
    assert.ok(read("apps/web/src/components/assistant/assistant-history-menu.tsx").includes("mobileSheet"), "lịch sử điện thoại");
    const thread = read("apps/web/src/components/assistant/assistant-thread.tsx");
    assert.ok(thread.includes("phoneTouchTarget"), "sao chép bật vùng chạm điện thoại");
    assert.ok(thread.includes('onClick={onNewChat} className="max-md:h-11"'), "nút cuộc mới khi lỗi");
    assert.ok(thread.includes("max-md:[&_button]:min-h-11"), "Thử lại của lượt lỗi");
    const header = read("apps/web/src/components/assistant/assistant-header.tsx");
    assert.ok(header.includes("max-md:size-11") && header.includes("size-11 md:hidden"), "nút lịch sử, cuộc mới và menu trên điện thoại");
  });

  test("nút sao chép chỉ đổi vùng chạm khi khung Trợ lý bật; panel Agent nhiệm vụ giữ nguyên", () => {
    const plain = renderToStaticMarkup(React.createElement(CopyMessageButton, { text: "a" }));
    assert.equal(plain.includes("max-md:size-11"), false, "mặc định không đổi");
    const phone = renderToStaticMarkup(React.createElement(CopyMessageButton, { text: "a", phoneTouchTarget: true }));
    assert.ok(phone.includes("max-md:size-11"));
  });

  test("nút 'Đã đọc dữ liệu' có vùng chạm 44px trên điện thoại trong khung Trợ lý, còn panel Agent nhiệm vụ giữ nguyên", () => {
    const props = { seconds: 3, steps: ["Đọc nhiệm vụ NV-2026-09-001"] };
    const plain = renderToStaticMarkup(React.createElement(AgentWorkLog, props));
    assert.equal(plain.includes("max-md:h-11"), false, "mặc định không đổi (panel Agent nhiệm vụ)");
    const phone = renderToStaticMarkup(React.createElement(AgentWorkLog, { ...props, phoneTouchTarget: true }));
    assert.ok(phone.includes("max-md:h-11") && phone.includes("max-md:-my-3.5"), "vùng chạm 44px, bố cục giữ 16px");
    const reply: ThreadMessage = {
      ...streamingThreadMessage("ok-log"),
      status: "complete",
      content: "Có một việc.",
      durationMs: 3000,
      steps: [{ tool: "list_tasks", label: "Xem việc của Thầy/Cô", count: 1, ok: true }],
    };
    const threadHtml = renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread: [userThreadMessage("u", "Hỏi"), reply],
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
      }),
    );
    assert.ok(threadHtml.includes("max-md:h-11"), "khung Trợ lý truyền phoneTouchTarget cho nút mở bước");
  });

  test("ô soạn ở cùng một vị trí trong cây giao diện cho cả hai trạng thái (không mất tiêu điểm khi có tin đầu)", () => {
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.equal((workspace.match(/<AssistantComposer/g) ?? []).length, 1, "chỉ một ô soạn, đổi biến thể bằng prop");
    assert.ok(workspace.includes('variant={start ? "hero" : "dock"}'));
  });
});

describe("Trợ lý UI: thanh đầu trang và menu lịch sử (như Linear Agent)", () => {
  const noop = () => undefined;
  const history = {
    items: [],
    contextItems: [],
    status: "ready",
    error: null,
    moreError: null,
    hasMore: false,
    loadingMore: false,
    loadMore: async () => undefined,
    retry: async () => undefined,
    refresh: async () => undefined,
    upsert: noop,
    rename: async () => ({}) as never,
    remove: async () => undefined,
  } as unknown as React.ComponentProps<typeof AssistantHeader>["history"];
  const renderHeader = (title: string | null, activeId: string | null) =>
    renderToStaticMarkup(
      React.createElement(AssistantHeader, { title, activeId, history, onNewChat: noop, onRename: noop, onDeleteRequest: noop }),
    );

  test("thanh đầu trang: cuộc mới bên trái, tên cuộc là tiêu đề trang và là nút mở menu lịch sử; chưa có cuộc thì không có '…'", () => {
    const html = renderHeader(null, null);
    const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
    assert.ok(h1.includes("Cuộc trò chuyện mới") && h1.includes('aria-haspopup="menu"'), "tên cuộc nằm trong h1 và mở menu");
    assert.ok(html.indexOf('aria-label="Cuộc trò chuyện mới"') < html.indexOf("<h1"), "nút cuộc mới ở bên trái tên cuộc");
    assert.equal(html.includes("Thao tác với cuộc trò chuyện"), false);
    assert.equal(html.includes("Mở lịch sử trò chuyện"), false, "không còn nút mở panel");
  });

  test("thanh đầu trang: đang mở một cuộc thì tên cuộc trên nút, có menu '…' (đổi tên, xóa)", () => {
    const html = renderHeader("Lịch họp tuần này", "c-1");
    const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
    assert.ok(h1.includes("Lịch họp tuần này"));
    assert.ok(html.includes('aria-label="Thao tác với cuộc trò chuyện"'));
    const header = read("apps/web/src/components/assistant/assistant-header.tsx");
    assert.ok(header.includes('className="w-56 min-w-0"'), 'menu "…" rộng như các menu "…" khác');
    assert.equal(header.includes('size="icon-sm"'), false, "nút icon cỡ header trang (icon-md) như trang Nhiệm vụ");
  });

  test("menu lịch sử: thả xuống từ tên cuộc, nhóm theo ngày, hàng 32px như menu ở thanh dưới; không có mục cuộc mới", () => {
    const menu = read("apps/web/src/components/assistant/assistant-history-menu.tsx");
    assert.ok(menu.includes("<MenuRoot modal={false} onOpenChange={(open) => open && void refresh()}>"), "không khóa cuộn trang; mở thì làm mới");
    assert.ok(menu.includes('align="start"') && menu.includes('className="w-96 min-w-0 max-h-[min(30rem,var(--available-height))] overflow-y-auto overscroll-contain"'), "rộng 384px như menu ở thanh dưới, cuộn trong menu");
    assert.ok(menu.includes("mobileSheet") && menu.includes('sheetTitle="Lịch sử trò chuyện"'), "điện thoại là bottom sheet");
    assert.equal(menu.includes("MenuActionItem") || menu.includes("onNewChat"), false, "người dùng bỏ mục Cuộc trò chuyện mới (đã có nút soạn mới cạnh tên cuộc, 17/10)");
    assert.ok(menu.includes('const CONTEXT_GROUP_LABEL = "Về mục này";') && menu.includes("groupConversationsByRecency("), "nhóm Về mục này rồi nhóm theo ngày");
    assert.ok(menu.includes('const ROW_CLASS = "h-8 gap-3 pl-9 pr-3 text-compact";'), "tên thụt vào so với nhãn nhóm như Linear");
    assert.ok(menu.includes('render={<Link href={`/assistant/${encodeURIComponent(item.id)}`} />}'), "hàng là liên kết thật");
    assert.ok(menu.includes('aria-current={current ? "page" : undefined}'));
    assert.ok(menu.includes("{current ? <span>Hiện tại</span> : null}") && !menu.includes("selected"), "cuộc đang mở chỉ thêm chữ Hiện tại, không tô nền");
    assert.equal(menu.includes("ngày kể từ tin nhắn cuối"), false, "người dùng bỏ dòng lưu trữ ở chân menu (17/10)");
    assert.ok(menu.includes('{history.loadingMore ? "Đang tải…" : "Tải thêm"}') && menu.includes("<MenuOptionItem"), "tải thêm không đóng menu");
    assert.ok(menu.includes('{history.status === "error" ? ('), "chỉ lỗi trang đầu có Thử lại");
    assert.ok(menu.includes('<ConversationRowsSkeleton count={3} withTime rowClassName="h-8 pl-9 pr-3 max-md:h-10 max-md:px-3" />'), "skeleton cùng hình hàng");
    const ui = read("apps/web/src/components/ui/menu.tsx");
    assert.ok(ui.includes("export const MenuLinkItem") && ui.includes("<BaseMenu.LinkItem") && ui.includes("closeOnClick = true, ...props"), "ui/menu có hàng liên kết, bấm xong đóng menu");
  });

  test("rà soát đối kháng vòng 4 (17/10): mở lại menu không mất trang đã tải, lỗi được đọc, tiêu điểm không rơi, tên cắt có tooltip", () => {
    const hook = read("apps/web/src/components/assistant/use-assistant-history.ts");
    assert.ok(hook.includes("setItems((prev) => appendUniqueById(page.items, prev));") && hook.includes("if (!loadedMoreRef.current) setNextCursor(page.nextCursor);"), "làm mới lặng lẽ gộp trang đầu, giữ các cuộc đã Tải thêm và con trỏ");
    assert.ok(/if \(!silent\) \{\n\s+\/\/[^\n]*\n\s+setStatus\("loading"\);\n\s+setError\(null\);/.test(hook), "Thử lại bỏ câu lỗi cũ");
    const menu = read("apps/web/src/components/assistant/assistant-history-menu.tsx");
    assert.ok(menu.includes('<span className="sr-only">Lịch sử trò chuyện: </span>'), "tên nút nói rõ là mở lịch sử");
    assert.ok(menu.includes('<span role="alert">{history.error}</span>') && menu.includes('<p role="alert" className="px-3 py-1 text-xs text-destructive">'), "lỗi trong menu tự báo");
    assert.ok(menu.includes('popup?.hasAttribute("data-open") && (document.activeElement === document.body'), "Thử lại/Tải thêm mất đi thì tiêu điểm về khung menu");
    assert.ok(menu.includes('<TooltipContent side="top" hidden={!titleCut}>') && menu.includes("onPointerEnter={measure}"), "tên cắt có tooltip");
    const start = read("apps/web/src/components/assistant/assistant-start.tsx");
    assert.ok(start.includes('const showExamples = !examplesHidden && recent.length === 0 && status === "ready";'), "tải lỗi thì chưa biết trống: không hiện thẻ");
    const errorHtml = renderToStaticMarkup(
      React.createElement(AssistantStartList, { items: [], status: "error", error: "Chưa tải được lịch sử.", onRetry: () => undefined, now: new Date(), onSuggest: () => undefined, onCreateTask: () => undefined }),
    );
    assert.ok(errorHtml.includes("Chưa tải được lịch sử.") && errorHtml.includes("Thử lại") && !errorHtml.includes("Bắt đầu với vài gợi ý"), "màn đầu báo lỗi kèm Thử lại");
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("if (isPhone || document.activeElement !== document.body) return;") && workspace.includes("}, [detailStatus, activeRouteId, isPhone]);"), "chọn cuộc xong tiêu điểm về ô soạn");
  });

  test("không còn panel lịch sử trái, xem nhanh hay drawer; màn đầu lấy cuộc gần đây từ cùng danh sách", () => {
    assert.equal(fs.existsSync(path.join(ROOT, "apps/web/src/components/assistant/assistant-history-drawer.tsx")), false);
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    for (const gone of ["AssistantHistorySidebar", "AssistantHistorySheet", "useHistoryPeek", "panelOpen"]) {
      assert.equal(workspace.includes(gone), false, `còn ${gone}`);
    }
    assert.ok(workspace.includes("history={history}") && workspace.includes("items={history.items}"));
    assert.equal(read("apps/web/src/app/globals.css").includes("data-assistant-peek"), false);
    assert.equal(read("apps/web/src/components/layout/global-shortcuts-modal.tsx").includes("Tìm cuộc trò chuyện (trang Trợ lý)"), false, "không còn ô tìm nên bỏ phím /");
  });

  test("xóa cuộc đang mở từ menu '…': chỉ về cuộc mới khi vẫn đang ở cuộc vừa xóa", () => {
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    const confirm = workspace.slice(workspace.indexOf("const confirmDelete = "), workspace.indexOf("const requestDelete = "));
    assert.ok(confirm.includes("await history.remove(id)"));
    assert.ok(confirm.includes("if (chat.readActiveId() === id) {"), "đã mở cuộc khác trong lúc chờ thì giữ màn đang xem");
    assert.ok(workspace.includes("entityName={deleteTarget?.title || undefined}"), "hộp xác nhận nêu đúng tên cuộc bị xóa");
  });
});

describe("Trợ lý UI: hiển thị trạng thái lượt và nguồn", () => {
  const renderThread = (thread: ThreadMessage[], context: AssistantSourceRef | null = null, pending = false) =>
    renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread,
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
        context,
        pending,
      }),
    );

  test("đang có lượt khác thì 'Thử lại' của tin lỗi cũ ẩn đi; rảnh thì hiện lại", () => {
    const failed: ThreadMessage = { ...streamingThreadMessage("er-p"), status: "error", errorMessage: "Gateway lỗi" };
    const thread = [userThreadMessage("u-p", "Hỏi"), failed];
    assert.ok(renderThread(thread).includes("Thử lại"));
    const busy = renderThread(thread, null, true);
    assert.ok(busy.includes("Gateway lỗi"), "câu lỗi vẫn hiện");
    assert.equal(busy.includes("Thử lại"), false, "nút không bấm được khi đang có lượt");
  });

  test("chuỗi dài không khoảng trắng xuống dòng trong bong bóng người dùng và đoạn trả lời", () => {
    const long = "https://example.org/" + "a".repeat(200);
    const html = renderThread([userThreadMessage("u-long", long)]);
    const bubble = html.match(/<p class="[^"]*max-w-\[80%\][^"]*"/)?.[0] ?? "";
    assert.ok(bubble.includes("break-words"), bubble);
    const reply = renderToStaticMarkup(React.createElement(AgentReplyText, { text: long }));
    assert.ok(reply.startsWith('<div class="') && reply.includes("break-words"), "đoạn trả lời dùng chung (cả panel Agent)");
  });

  test("gửi lại từ 'Thử lại' khi đang có lượt không xóa lỗi đang hiện (chặn trước khi xóa)", () => {
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    const suggest = workspace.slice(workspace.indexOf("const suggest = "), workspace.indexOf("const retry = "));
    const guardAt = suggest.indexOf("if (pending) return;");
    assert.ok(guardAt >= 0, "suggest phải kiểm pending");
    assert.ok(guardAt < suggest.indexOf("setActionError(null)"), "kiểm pending trước khi xóa lỗi");
    assert.ok(workspace.includes("pending={pending}"), "khung truyền pending xuống tin");
  });

  test("lượt đã dừng hiện 'Đã dừng'; lượt lỗi hiện câu lỗi và 'Thử lại'", () => {
    const aborted: ThreadMessage = { ...streamingThreadMessage("ab"), status: "aborted", content: "Phần đã có" };
    const failed: ThreadMessage = { ...streamingThreadMessage("er"), status: "error", errorMessage: "Gateway lỗi" };
    const html = renderThread([userThreadMessage("u1", "Hỏi"), aborted, userThreadMessage("u2", "Hỏi tiếp"), failed]);
    assert.ok(html.includes("Đã dừng"));
    assert.ok(html.includes("Phần đã có"));
    assert.ok(html.includes("Gateway lỗi"));
    assert.ok(html.includes("Thử lại"));
  });

  test("tin người dùng là bong bóng xám căn phải, giới hạn 80% cột", () => {
    const html = renderThread([userThreadMessage("u1", "Hỏi việc của tôi")]);
    assert.ok(html.includes("bg-muted"));
    assert.ok(html.includes("max-w-[80%]"));
  });

  test("danh sách Nguồn chỉ hiện tối đa sáu link", () => {
    const sources: AssistantSourceRef[] = Array.from({ length: 8 }, (_, i) => ({
      type: "task",
      id: `s${i + 1}`,
      code: `NV-${i + 1}`,
      title: `Nhiệm vụ ${i + 1}`,
      href: `/tasks/s${i + 1}`,
    }));
    const reply: ThreadMessage = { ...streamingThreadMessage("ok"), status: "complete", content: "Có tám việc.", sources };
    const html = renderThread([userThreadMessage("u", "Hỏi"), reply]);
    assert.equal(html.split('href="/tasks/s').length - 1, 6);
  });

  test("cuộc có ngữ cảnh hiện một dòng nhỏ dẫn tới mục đó", () => {
    const html = renderThread([userThreadMessage("u", "Hỏi")], SOURCE);
    assert.ok(html.includes('href="/tasks/t1"'));
    assert.ok(html.includes("NV-2026-09-001 Chuẩn bị hội nghị"));
  });
});

describe("Trợ lý UI: điều hướng và khung trang", () => {
  test("đường dẫn /assistant và /assistant/<id> dùng khung hai cột, không nhầm tiền tố", () => {
    assert.equal(isAssistantPath("/assistant"), true);
    assert.equal(isAssistantPath("/assistant/abc"), true);
    assert.equal(isAssistantPath("/assistants"), false);
    assert.equal(isAssistantPath("/inbox"), false);
  });

  test("mục sidebar Trợ lý vẫn sáng khi mở một cuộc (khớp đường con), không sáng nhầm /assistants", () => {
    assert.equal(isRouteActive("/assistant", "/assistant/abc"), true);
    assert.equal(isRouteActive("/assistant", "/assistant"), true);
    assert.equal(isRouteActive("/assistant", "/assistants"), false);
  });

  test("tiêu đề breadcrumb của Trợ lý, kể cả trang chi tiết cuộc", () => {
    assert.deepEqual(resolveBreadcrumb("/assistant"), ["QCET E-Office", "Trợ lý"]);
    assert.deepEqual(resolveBreadcrumb("/assistant/abc"), ["QCET E-Office", "Trợ lý"]);
  });

  test("Trợ lý không nằm trong CANONICAL_ROUTES nên phím tắt 1–6 không đổi", () => {
    assert.equal(CANONICAL_ROUTES.some((route) => route.href.startsWith("/assistant")), false);
  });

  test("mục sidebar nằm sau Lịch công tác và chỉ hiện theo cờ", () => {
    const src = read("apps/web/src/components/layout/sidebar-nav-list.tsx");
    const calendarAt = src.indexOf('id: "calendar"');
    const assistantAt = src.indexOf('id: "assistant"');
    assert.ok(calendarAt > 0 && assistantAt > calendarAt, "Trợ lý phải đứng sau Lịch công tác");
    assert.ok(src.includes('feature: "assistant"'));
    assert.ok(src.includes('useRuntimeFeature("assistant")'));
    assert.ok(src.includes("navGroups.map"), "danh sách hiển thị phải đi qua bộ lọc theo cờ");
  });

  test("bảng lệnh chỉ thêm mục Trợ lý khi cờ bật và không gán phím tắt", () => {
    const src = read("apps/web/src/components/layout/command-search-modal.tsx");
    const at = src.indexOf('id: "nav-assistant"');
    assert.ok(at > 0, "thiếu mục nav-assistant");
    const block = src.slice(at, at + 600);
    assert.ok(src.includes("...(assistantEnabled"), "mục phải nằm trong điều kiện cờ");
    assert.equal(/shortcut:/.test(block), false, "mục Trợ lý không được có phím tắt");
  });

  test("app-shell dùng nhánh khung cao cho Trợ lý ở cả bốn chỗ như Hộp thư", () => {
    const src = read("apps/web/src/components/layout/app-shell.tsx");
    const uses = src.match(/isFullHeightPane/g) ?? [];
    assert.ok(uses.length >= 5, `cần ít nhất 5 chỗ dùng isFullHeightPane (có ${uses.length})`);
    assert.ok(src.includes("const isAssistant = assistantEnabled && isAssistantPath(pathname)"), "cờ tắt thì 404 dùng khung thường có thanh đầu");
  });

  test("hai trang server đều chặn khi cờ tắt và kiểm đăng nhập", () => {
    for (const rel of ["apps/web/src/app/assistant/page.tsx", "apps/web/src/app/assistant/[id]/page.tsx"]) {
      const src = read(rel);
      assert.ok(src.includes("(await getRuntimeConfig())?.features.assistant"), `${rel}: thiếu kiểm cờ`);
      assert.ok(src.includes("notFound()"), `${rel}: thiếu notFound`);
      assert.ok(src.includes("redirect("), `${rel}: thiếu chuyển hướng đăng nhập`);
    }
  });
});

describe("Trợ lý UI: quy tắc giao diện trong mã nguồn", () => {
  const dir = path.join(ROOT, "apps/web/src/components/assistant");
  const files = [
    ...fs.readdirSync(dir).map((name) => path.join("apps/web/src/components/assistant", name)),
    "apps/web/src/app/assistant/page.tsx",
    "apps/web/src/app/assistant/[id]/page.tsx",
    "apps/web/src/app/assistant/loading.tsx",
    "apps/web/src/app/assistant/error.tsx",
  ];

  test("không có cỡ chữ lẻ, palette thô, cỡ chữ ngoài thang (text-sm/base/lg) hay chữ 'Quá hạn'", () => {
    for (const rel of files) {
      const src = read(rel);
      assert.equal(/text-\[\d/.test(src), false, `${rel}: cỡ chữ tùy ý`);
      assert.equal(/\b(rose|amber)-\d/.test(src), false, `${rel}: palette tín hiệu thô`);
      assert.equal(/\btext-(sm|base|lg)\b/.test(src), false, `${rel}: cỡ chữ ngoài thang của Trợ lý`);
      assert.equal(src.includes("Quá hạn"), false, `${rel}: dùng "Trễ hạn"`);
    }
  });

  test("thành phần giao diện không import mã máy chủ", () => {
    for (const rel of files.filter((f) => f.startsWith("apps/web/src/components/"))) {
      const src = read(rel);
      assert.equal(/from ["']@\/server\//.test(src), false, `${rel}: import máy chủ`);
      assert.equal(/from ["']@\/lib\/prisma["']/.test(src), false, `${rel}: import Prisma`);
    }
  });

  test("không còn file lịch sử cũ (cột, popover, panel trái); lịch sử điện thoại là bottom sheet, không phải hộp thoại", () => {
    for (const old of ["assistant-history-pane.tsx", "assistant-history-popover.tsx", "assistant-history-drawer.tsx"]) {
      assert.equal(fs.existsSync(path.join(ROOT, "apps/web/src/components/assistant", old)), false, old);
    }
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.equal(workspace.includes("StandardDialog"), false);
  });

  test("rà soát đối kháng vòng 2 (17/10): điện thoại không bật bàn phím ảo, tạo nhiệm vụ báo đúng, tên cuộc gần đây có tooltip", () => {
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("onExamplesDismissed={isPhone ? undefined :") && workspace.includes("if (!isPhone) composerRef.current?.focus();"), "điện thoại không bật bàn phím ảo khi chạm X hay thẻ");
    assert.ok(read("apps/web/src/components/assistant/use-create-task-launcher.tsx").includes("if (subtasks && subtasks.failed.length > 0) return;"), "việc con lỗi thì không báo thêm \"đã tạo\"");
    assert.ok(read("apps/web/src/components/tasks/create/create-task-modal.tsx").includes("onCreated?.(created, { subtasks });"));
    assert.ok(read("apps/web/src/components/assistant/assistant-start.tsx").includes("<TooltipContent side=\"top\" hidden={!titleCut}>"), "tên cuộc gần đây bị cắt có tooltip");
  });
});

describe("Chữ trả lời hiện dần (useSmoothText)", () => {
  /** Mô phỏng hook: chữ tới một lần (`backlog`), khung 16ms; trả thời gian hiện hết và số ký tự sau 200ms. */
  const simulate = (backlog: number) => {
    const speed = revealSpeed(backlog);
    let shown = 0;
    let frames = 0;
    let at200 = 0;
    while (shown < backlog && frames < 2000) {
      shown += nextRevealCount(backlog - shown, 16, speed);
      frames++;
      if (frames * 16 <= 200) at200 = shown;
    }
    return { ms: frames * 16, at200 };
  };

  test("chữ tới nhỏ giọt chạy theo tốc độ nền 90 ký tự/giây, cộng dồn phần lẻ, không vượt phần đã có", () => {
    assert.equal(revealSpeed(10), 90);
    const perSecond = Array.from({ length: 60 }, () => nextRevealCount(500, 1000 / 60, 90)).reduce((sum, n) => sum + n, 0);
    assert.ok(Math.abs(perSecond - 90) < 1e-6);
    assert.equal(nextRevealCount(3, 100, 90), 3);
    assert.equal(nextRevealCount(0, 16, 90), 0);
  });

  test("chữ tới cả cục chạy đều trong khoảng 1,5 giây: không bung ra một mảng lớn rồi nhỏ giọt", () => {
    for (const backlog of [900, 3000]) {
      const { ms, at200 } = simulate(backlog);
      assert.ok(ms >= 1400 && ms <= 1650, `${backlog} ký tự hiện hết sau ${ms}ms`);
      // Đều: 200ms đầu chỉ hiện khoảng 200/1500 phần
      assert.ok(at200 / backlog < 0.16, `200ms đầu đã hiện ${Math.round((at200 / backlog) * 100)}%`);
    }
  });

  test("khung hình dài (tab ẩn rồi quay lại) không bù cả quãng nghỉ", () => {
    assert.equal(nextRevealCount(500, 5000, 90), nextRevealCount(500, 100, 90));
  });

  test("điểm cắt không tách emoji hay dấu kết hợp tiếng Việt", () => {
    const emoji = "Xong 👍 rồi";
    const cut = safeRevealEnd(emoji, emoji.indexOf("👍") + 1);
    assert.equal(emoji.slice(0, cut).endsWith("👍"), true);
    const decomposed = "Thu\u0301c"; // "Thúc" dạng tách dấu
    assert.equal(decomposed.slice(0, safeRevealEnd(decomposed, 3)), "Thu\u0301");
    assert.equal(safeRevealEnd("abc", 99), 3);
    assert.equal(safeRevealEnd("abc", -1), 0);
  });

  test("khung tin dùng chữ đã làm mượt và chỉ hiện nguồn, nút sao chép khi chữ đã hiện hết", () => {
    const thread = read("apps/web/src/components/assistant/assistant-thread.tsx");
    assert.ok(thread.includes("const reply = useSmoothText(message.content, streaming)"));
    assert.ok(thread.includes("<AgentReplyText text={reply.text}"));
    // Khung suy nghĩ khi đang trả lời cũng chạy dần
    assert.ok(thread.includes("const thinking = useSmoothText(message.thinking, streaming)"));
    assert.ok(thread.includes('<p className="whitespace-pre-wrap">{thinking.text}</p>'));
    assert.ok(thread.includes("const settled = !streaming && !reply.revealing"));
    assert.ok(thread.includes("{settled && message.content ? ("));
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(read("apps/web/src/components/assistant/use-stick-to-bottom.ts").includes("new ResizeObserver("), "bám đáy khi chữ hiện dần làm cột cao lên");
    assert.ok(workspace.includes("useStickToBottom(thread, activeId, !start)"), "trang Trợ lý dùng hook bám đáy chung với khung chat nổi");
  });
});

describe("Trợ lý UI: thanh dưới và khung chat nổi trên mọi trang (như Linear)", () => {
  test("khung trang chừa chỗ thanh dưới theo cờ đọc ở server, trừ trang Trợ lý; điện thoại không có", () => {
    const shell = read("apps/web/src/components/layout/app-shell.tsx");
    assert.ok(shell.includes('const ASSISTANT_STATUSBAR_RESERVE = "1.75rem";'));
    assert.ok(shell.includes("const showAssistantBar = assistantEnabled && !isAssistant;"), "trang Trợ lý tự là khung chat");
    assert.ok(shell.includes('"--app-statusbar": showAssistantBar ? ASSISTANT_STATUSBAR_RESERVE : "0px"'));
    assert.ok(shell.includes("md:pb-[var(--app-statusbar)]"), "chỉ máy tính chừa chỗ");
    assert.ok(shell.includes("md:h-[calc(100dvh-16px-var(--app-statusbar))]") && shell.includes("md:min-h-[calc(100dvh-44px-var(--app-statusbar))]"), "các khung cao cố định và khung thường đều trừ phần chừa");
    assert.ok(shell.includes('import("@/components/assistant/assistant-dock")') && shell.includes("ssr: false"), "tải sau, không nặng khung trang");
    assert.ok(shell.includes("{assistantEnabled ? <AssistantDock /> : null}"), "luôn gắn khi bật cờ để lượt đang chạy không bị hủy khi sang trang Trợ lý");
    const layout = read("apps/web/src/app/layout.tsx");
    assert.ok(
      layout.includes("const runtimeConfig = await getRuntimeConfig();") &&
        layout.includes("const assistantEnabled = runtimeConfig?.features.assistant ?? false;") &&
        layout.includes("assistantEnabled={assistantEnabled}"),
      "cờ đọc ở server cùng nguồn với trang Trợ lý, không giật bố cục sau hydrate",
    );
    assert.ok(layout.includes("agentModels={agentModels}") && shell.includes("<AgentModelsProvider catalog={agentModels}>"), "danh sách model đọc ở server, chung trang Trợ lý và khung chat nổi");
  });

  test("khung chat nổi dùng lại hook chat (không đổi URL), luồng tin, ô soạn; lịch sử chỉ tải khi mở menu", () => {
    const dock = read("apps/web/src/components/assistant/assistant-dock.tsx");
    const panel = read("apps/web/src/components/assistant/assistant-dock-panel.tsx");
    assert.ok(read("apps/web/src/components/assistant/use-assistant-chat.ts").includes("if (syncUrl) window.history.replaceState("), "trang khác không bị đổi URL");
    assert.ok(dock.includes("syncUrl: false") && dock.includes("conversationId: activated ? dock?.id : undefined"), "chưa mở khung thì chưa tải chi tiết cuộc nhớ sẵn");
    assert.ok(dock.includes("{hidden ? null : (\n        <aside") && dock.includes("const hidden = isAssistantPath(pathname);"), "trang Trợ lý gỡ hẳn thanh: menu lịch sử đang mở đóng theo, không trôi lên góc trang");
    assert.ok(dock.includes('z-30 hidden h-9 items-center justify-end gap-0.5 bg-sidebar px-2 md:flex"'), "điện thoại không có thanh");
    assert.ok(dock.includes('<Link href="/assistant" onClick={onNavigate}') && dock.includes("onNavigate={() => setOpen(false)}"), "bấm Mở trang Trợ lý thì đóng menu ngay");
    assert.ok(dock.includes("{open ? (\n          <DockHistoryList"), "danh sách lịch sử chỉ tải khi mở menu");
    assert.ok(dock.includes(">Hiện tại</span>"), "cuộc đang ở khung nổi ghi Hiện tại như Linear");
    assert.equal(dock.includes('addEventListener("storage"'), false, "tab khác đổi cuộc không được hủy lượt đang chạy ở tab này");
    assert.ok(panel.includes("<AssistantThread\n          compact") && panel.includes('<AssistantComposer\n          variant="dock"'), "dùng lại luồng tin và ô soạn của trang Trợ lý");
    assert.ok(panel.includes("fixed bottom-9 right-4 z-30 flex h-150") && panel.includes("w-100"), "400 × 600px, đáy ngang đáy khung trang, cùng lớp popover để menu nổi trên khung");
    assert.ok(panel.includes("rounded-[calc(var(--radius-xl)+0.5rem)]"), "góc bo đồng tâm với ô soạn (16px + lề 8px)");
    assert.ok(panel.includes("panelRef.current?.contains(event.target)"), "Esc trong menu/hộp thoại (portal) không thu nhỏ khung");
    assert.ok(panel.includes("<AgentEmptyPattern trackRef={emptyRef} />"), "màn trống chỉ còn lưới icon");
    for (const removed of ["ASSISTANT_EXAMPLES", "onCreateTask", "Trợ lý chỉ đọc dữ liệu và có thể sai"]) {
      assert.equal(panel.includes(removed), false, `người dùng bỏ cho gọn (17/10): ${removed}`);
    }
    assert.ok(panel.includes("disabled={pending}>") || panel.includes("onClick={onExpand} disabled={pending}"), "đang trả lời thì chưa mở toàn trang");
    assert.ok(read("apps/web/src/components/agent-chat/agent-chat-parts.tsx").includes("export function AgentEmptyPattern("), "lưới nền dùng chung với Agent soạn nhiệm vụ");
  });

  test("rà soát đối kháng vòng 3 (17/10): lớp nổi không bị che, cuộc của tab giữ trong tab, lượt đang chạy không bị bỏ ngang", () => {
    for (const file of ["apps/web/src/components/tasks/table/components/batch-action-bar.tsx", "apps/web/src/components/documents/registry/document-bulk-toolbar.tsx", "apps/web/src/components/pwa/pwa-sync-status.tsx"]) {
      assert.ok(read(file).includes("md:bottom-[calc(1.5rem+var(--app-statusbar,0px))]"), `${file}: nổi trên thanh dưới`);
    }
    assert.ok(read("apps/web/src/components/pwa/pwa-install-prompt.tsx").includes("md:bottom-[calc(1rem+var(--app-statusbar,0px))]"));

    const dock = read("apps/web/src/components/assistant/assistant-dock.tsx");
    const store = dock.slice(dock.indexOf("function readDockRaw"), dock.indexOf("function parseDock"));
    assert.equal((store.match(/localStorage\.getItem/g) ?? []).length, 1, "bộ nhớ chỉ đọc một lần, sau đó dùng biến của tab");
    assert.ok(store.includes("if (dockValue === undefined)") && store.includes("dockValue = raw;"));
    assert.ok(dock.includes("if (dock && !pending) newChat();"), "nút Trợ lý khi đang trả lời chỉ mở khung, không hủy lượt");
    assert.ok(dock.includes("aria-expanded={dock ? undefined : showingNewChat}"), "có cuộc thì nút Trợ lý không phải nút bật/tắt");
    assert.ok(dock.includes('{pending ? <Spinner size="xs" /> : null}') && dock.includes('{pending ? <span className="sr-only">, đang trả lời</span> : null}'), "chip báo lượt vẫn chạy khi thu nhỏ, cả cho trình đọc màn hình");
    assert.ok(dock.includes("useStickToBottom(thread, activeId, panelOpen && !hidden && !start)"), "khung gắn lại sau trang Trợ lý vẫn bám đáy");
    assert.ok(dock.includes('const composerReady = panelOpen && !hidden && (detailStatus === "idle" || detailStatus === "ready");'), "chờ ô soạn mở khóa rồi mới đưa tiêu điểm");
    assert.ok(dock.includes("if (wasHiddenRef.current && !hidden) reload();"), "từ trang Trợ lý quay lại thì tải lại cuộc");
    assert.ok(read("apps/web/src/components/assistant/use-assistant-chat.ts").includes("if (id && !turnRef.current) void openConversation(id);"), "tải lại không chen vào lượt đang chạy");

    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("announceConversationChange({ id, title: updated.title });") && workspace.includes("announceConversationChange({ id, deleted: true });"), "trang Trợ lý báo đổi tên, xóa");
    assert.ok(dock.includes("window.addEventListener(ASSISTANT_CONVERSATION_EVENT, onChange);") && dock.includes('if ("deleted" in detail) return newChat();'), "khung bỏ cuộc đã xóa, chip theo tên mới");

    const panel = read("apps/web/src/components/assistant/assistant-dock-panel.tsx");
    assert.ok(panel.includes("max-md:hidden"), "điện thoại không có khung (thanh dưới cũng ẩn)");
    assert.ok(panel.includes("stopScope={panelRef}") && read("apps/web/src/components/assistant/assistant-composer.tsx").includes("stopScope"), "Esc ở trang dưới không dừng lượt của khung");
    assert.ok(panel.includes('<div role="status" aria-live="polite" className="sr-only">'), "trình đọc màn hình biết lượt bắt đầu");
    assert.ok(dock.includes('className="flex h-8 w-full items-center gap-3 rounded-lg px-3'), "hàng lịch sử 32px theo thang");
    assert.ok(dock.includes('<IconSidebarHistory className="size-3.5" />') && !dock.includes('from "lucide-react"'), "icon thanh dưới cùng bộ icon sidebar (lưới 16, nét 1,25px)");
  });

  test("thanh dưới giữ nhiều chip cuộc trò chuyện như tab chat của Linear: bấm để chuyển, × để bỏ chip, nhớ theo trình duyệt", () => {
    const dock = read("apps/web/src/components/assistant/assistant-dock.tsx");
    assert.ok(dock.includes('const DOCK_TABS_STORAGE_KEY = "qcet.assistant.dockTabs";') && dock.includes("const MAX_DOCK_TABS = 5;"));
    assert.ok(dock.includes("if (value) upsertDockTab(value);"), "cuộc nào lên khung nổi cũng thành chip");
    assert.ok(dock.includes("{shownTabs.map((tab) => {") && dock.includes("<DockChip"), "mỗi cuộc một chip");
    assert.ok(dock.includes("switchTo(tab);\n                      openPanel();"), "bấm chip khác thì mở cuộc đó");
    assert.ok(dock.includes("onClose={() => closeTab(tab.id)}") && dock.includes("removeDockTab(id);"), "× bỏ chip, cuộc vẫn ở lịch sử");
    assert.ok(dock.includes('if ("deleted" in detail) removeDockTab(detail.id);'), "cuộc bị xóa ở trang Trợ lý thì mất chip");
    assert.ok(dock.includes('className="flex min-w-0 flex-1 items-center justify-end gap-0.5"'), "chip co lại khi chật, không đè nút Trợ lý");
  });

  test("chip không mở cũng có vòng quay khi cuộc đang chạy và chấm khi có trả lời mới từ lần xem trước", () => {
    const dock = read("apps/web/src/components/assistant/assistant-dock.tsx");
    assert.ok(dock.includes("conversationActivityRequest(tabIds.split(\",\"), controller.signal)"), "hỏi máy chủ trạng thái các chip");
    assert.ok(dock.includes("timer = setTimeout(poll, running ? ACTIVITY_POLL_RUNNING_MS : ACTIVITY_POLL_IDLE_MS);"), "đang chạy thì hỏi dày hơn");
    assert.ok(dock.includes("item.lastMessageAt > tab.seen"), "tin mới hơn lần xem trước thì có chấm");
    assert.ok(dock.includes("} else if (tab.seen === undefined || left || item.id === viewedRef.current) {"), "đang xem hoặc vừa rời khi đã xong thì ghi đã xem");
    assert.ok(dock.includes("pending={active && activated ? pending : Boolean(activity[tab.id]?.running)}"));
    assert.ok(dock.includes("unread={(active && unread) || tabUnread(tab)}"));
    assert.ok(dock.includes("const viewedId = hidden ? conversationIdFromPath(pathname) : shownOpen ? (dock?.id ?? null) : null;"), "đang xem ở trang Trợ lý cũng tính");
  });

  test("skeleton danh sách cuộc trò chuyện là vạch tên (và vạch giờ) như hàng thật, không phải khối xám kín hàng", () => {
    const skeleton = read("apps/web/src/components/assistant/conversation-rows-skeleton.tsx");
    assert.ok(skeleton.includes('<Skeleton className={cn("h-3", TITLE_WIDTHS[i % TITLE_WIDTHS.length])} />'), "vạch tên dài ngắn khác nhau");
    assert.ok(skeleton.includes('<Skeleton className="ml-auto h-2.5 w-8 shrink-0" />'), "vạch giờ bên phải");
    const uses = {
      "apps/web/src/components/assistant/assistant-dock.tsx": '<ConversationRowsSkeleton count={3} withTime rowClassName="h-8 px-3" />',
      "apps/web/src/components/assistant/assistant-history-menu.tsx": '<ConversationRowsSkeleton count={3} withTime rowClassName="h-8 pl-9 pr-3 max-md:h-10 max-md:px-3" />',
      "apps/web/src/components/assistant/assistant-start.tsx": '<ConversationRowsSkeleton count={RECENT_COUNT} withTime className="gap-0.5" rowClassName="h-8 px-4 max-md:h-11" />',
    };
    for (const [file, use] of Object.entries(uses)) {
      const src = read(file);
      assert.ok(src.includes(use), `${file}: cùng chiều cao, lề với hàng thật`);
      assert.equal(/<Skeleton key=\{i\} className="h-(8|9) w-full/.test(src), false, `${file}: không còn khối kín hàng`);
    }
  });
});

/** Kế hoạch nhiều đầu việc (người dùng gửi kế hoạch năm 19/10/2026): thẻ danh sách, cột bên, "Tạo tất cả". */
describe("Trợ lý UI: kế hoạch nhiều đề xuất", () => {
  const plan = Array.from({ length: 8 }, (_, i) => ({
    title: `Đầu việc ${i + 1} của kế hoạch tháng ${i < 4 ? 8 : 9}/2026`,
    dueDate: i < 4 ? "2026-08-31" : "2026-09-30",
    leadAssigneeName: "Đặng Nhật Huy",
  }));
  const reply: ThreadMessage = {
    ...streamingThreadMessage("reply-plan"),
    id: "m-plan",
    status: "complete",
    content: "Tôi đã soạn 8 đề xuất.",
    durationMs: 3000,
    proposals: plan,
    proposalTasks: { 0: { id: "t-1", code: "NV-2026-08-009" } },
    dismissedProposals: [7],
    sources: [SOURCE],
  };
  const question = userThreadMessage("u-plan", "Tạo nhiệm vụ theo kế hoạch", [], [
    { id: "f-1", name: "Ke-hoach-nam-hoc.docx", size: 120_000, kind: "docx", url: "/api/file-objects/f-1" },
  ]);

  test("gom cả cuộc: đề xuất kèm trạng thái theo vị trí, tệp đã lưu, nguồn không trùng; chỉ đề xuất còn chờ vào \"Tạo tất cả\"", () => {
    const outline = conversationOutline([question, reply, { ...reply, key: "reply-2", proposals: undefined, sources: [SOURCE] }]);
    assert.equal(outline.proposals.length, 8);
    assert.deepEqual(outline.proposals[0], { replyKey: "reply-plan", index: 0, proposal: plan[0], created: { id: "t-1", code: "NV-2026-08-009" }, dismissed: false, streaming: false });
    assert.equal(outline.proposals[7].dismissed, true);
    assert.deepEqual(outline.files.map((file) => file.id), ["f-1"]);
    assert.deepEqual(outline.sources, [SOURCE]);
    assert.deepEqual(pendingProposals(outline.proposals).map((item) => item.index), [1, 2, 3, 4, 5, 6]);
    // Lượt chưa xong: đề xuất hiện nhưng chưa thao tác được
    const live = conversationOutline([{ ...reply, status: "streaming" }]);
    assert.equal(pendingProposals(live.proposals).length, 0);
    assert.equal(hasOutline(conversationOutline([userThreadMessage("u", "chào")])), false);
  });

  test("từ PROPOSAL_LIST_MIN đề xuất: một thẻ danh sách gọn có \"Tạo tất cả\" thay cho từng thẻ lớn", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread: [question, reply],
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
        onOpenProposal: () => undefined,
        onDismissProposal: () => undefined,
        onCreateProposals: () => undefined,
      }),
    );
    assert.ok(html.includes('aria-label="Đề xuất 8 nhiệm vụ"'));
    assert.ok(html.includes("Đã tạo 1/8") && html.includes("Tạo tất cả (6)"), "chỉ đếm đề xuất còn chờ");
    assert.ok(html.includes('href="/tasks/t-1"') && html.includes("NV-2026-08-009"), "đề xuất đã tạo mở nhiệm vụ");
    assert.ok(html.includes("Xem thêm 2 đề xuất"), "hiện sẵn 6 hàng");
    assert.equal(html.includes(">Xem lại và tạo<"), false, "không còn thẻ lớn từng đề xuất");
    assert.ok(html.includes('aria-label="Xem lại và tạo: Đầu việc 2 của kế hoạch tháng 8/2026"'), "hàng còn chờ mở hộp tạo riêng");
  });

  test("bỏ qua hết: thẻ danh sách thu gọn một hàng có Hoàn tác; xong mà còn đề xuất đã bỏ qua thì có Hoàn tác bỏ qua", () => {
    const render = (patch: Partial<ThreadMessage>) =>
      renderToStaticMarkup(
        React.createElement(AssistantThread, {
          thread: [question, { ...reply, ...patch }],
          detailStatus: "ready",
          detailError: null,
          onRetry: () => undefined,
          onNewChat: () => undefined,
          listRef: { current: null },
          onScroll: () => undefined,
          onOpenProposal: () => undefined,
          onDismissProposal: () => undefined,
          onCreateProposals: () => undefined,
        }),
      );
    const all = render({ proposalTasks: {}, dismissedProposals: [0, 1, 2, 3, 4, 5, 6, 7] });
    assert.ok(all.includes('aria-label="Đã bỏ qua 8 đề xuất nhiệm vụ"') && all.includes("Đã bỏ qua tất cả đề xuất") && all.includes(">Hoàn tác<"));
    assert.equal(all.includes("Tạo tất cả"), false);
    assert.equal(all.includes("Đầu việc 1 của kế hoạch"), false, "không còn hàng mờ chiếm chỗ");

    const settled = render({ proposalTasks: { 0: { id: "t-1", code: "NV-2026-08-009" }, 1: { id: "t-2", code: "NV-2026-08-010" } }, dismissedProposals: [2, 3, 4, 5, 6, 7] });
    assert.ok(settled.includes("Đã tạo 2/8 · bỏ qua 6") && settled.includes(">Hoàn tác bỏ qua<"));
    assert.equal(settled.includes("Tạo tất cả"), false);
    assert.ok(settled.includes(">Đã bỏ qua</span>"), "hàng đã bỏ qua ghi chữ thay cho dấu gạch");
    assert.ok(settled.includes('aria-label="Xem lại và tạo: Đầu việc 3 của kế hoạch tháng 8/2026"'), "hàng đã bỏ qua vẫn mở lại được");
  });

  test("cột bên là thẻ nổi: đề xuất gom theo hạn có tiến độ, tệp và nguồn đã dùng; không có nút X", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantSidePanel, {
        outline: conversationOutline([question, reply]),
        onOpenProposal: () => undefined,
        onCreateProposals: () => undefined,
      }),
    );
    for (const text of ["Đề xuất nhiệm vụ", "1/8 đã tạo", "Tạo tất cả (6)", "Hạn 31/08/2026", "Hạn 30/09/2026", "Tệp", "Ke-hoach-nam-hoc.docx", "Nguồn đã dùng", "NV-2026-09-001"]) {
      assert.ok(html.includes(text), text);
    }
    assert.equal((html.match(/Hạn 31\/08\/2026/g) ?? []).length, 1, "ngày ghi ở tiêu đề nhóm, hàng không lặp lại");
    assert.ok(html.includes("rounded-xl") && html.includes("shadow-menu") && !html.includes("border-l"), "thẻ nổi, không kẻ chia trang");
    assert.equal(html.includes("Ẩn cột bên"), false, "bật/tắt chỉ ở thanh đầu");
  });

  test("cột bên: một nhóm không hạn thì không ghi \"Chưa có hạn\"; chưa tạo gì thì không có thanh tiến độ rỗng; bỏ qua hết thì ghi Đã bỏ qua", () => {
    const render = (patch: Partial<ThreadMessage>) =>
      renderToStaticMarkup(
        React.createElement(AssistantSidePanel, {
          outline: conversationOutline([question, { ...reply, ...patch }]),
          onOpenProposal: () => undefined,
          onCreateProposals: () => undefined,
        }),
      );
    assert.ok(render({}).includes('role="progressbar"'), "đã tạo một nhiệm vụ thì có tiến độ");
    const undated = render({ proposals: plan.map(({ title }) => ({ title })), proposalTasks: {}, dismissedProposals: [] });
    assert.equal(undated.includes("Chưa có hạn"), false);
    assert.equal(undated.includes('role="progressbar"'), false);
    assert.ok(undated.includes("0/8 đã tạo") && undated.includes("Tạo tất cả (8)"));
    const mixed = render({ proposals: plan.map((item, i) => (i < 4 ? item : { title: item.title })), proposalTasks: {}, dismissedProposals: [] });
    assert.ok(mixed.includes("Hạn 31/08/2026") && mixed.includes("Chưa có hạn"), "có nhóm có hạn thì nhóm không hạn vẫn ghi");
    const dismissed = render({ proposalTasks: {}, dismissedProposals: [0, 1, 2, 3, 4, 5, 6, 7] });
    assert.match(dismissed, /role="status"[^>]*>Đã bỏ qua</, "đầu thẻ ghi Đã bỏ qua thay cho 0/8 đã tạo");
    assert.equal(dismissed.includes("đã tạo"), false);
    assert.equal(dismissed.includes("Tạo tất cả"), false);
  });

  test("thanh đầu có nút cột bên với icon panel phải kiểu Linear, tiến độ trong nhãn; trang và khung nổi nối \"Tạo tất cả\"", () => {
    const history = { items: [], status: "ready", error: null, hasMore: false, loadingMore: false, loadMore: async () => undefined, retry: async () => undefined, query: "", setQuery: () => undefined } as never;
    const html = renderToStaticMarkup(
      React.createElement(AssistantHeader, {
        title: "Kế hoạch năm",
        activeId: "c1",
        history,
        onNewChat: () => undefined,
        onRename: () => undefined,
        onDeleteRequest: () => undefined,
        sidePanel: { open: true, onToggle: () => undefined, progress: "Đã tạo 1/8" },
      }),
    );
    assert.ok(html.includes('aria-label="Ẩn cột bên: Đã tạo 1/8"') && html.includes('aria-pressed="true"'));
    assert.ok(read("apps/web/src/components/assistant/assistant-header.tsx").includes("<IconSidebarPanelRight size={14} active={sidePanel.open} />"));
    const workspace = read("apps/web/src/components/assistant/assistant-workspace.tsx");
    assert.ok(workspace.includes("onCreateProposals={createProposals}") && workspace.includes("<AssistantSidePanel"));
    assert.ok(read("apps/web/src/components/assistant/assistant-dock-panel.tsx").includes("onCreateProposals={onCreateProposals}"));
    const launcher = read("apps/web/src/components/assistant/use-create-task-launcher.tsx");
    assert.ok(launcher.includes('import("@/components/assistant/assistant-bulk-create-dialog")'), "hộp tạo tất cả tải khi cần");
  });

  test("\"Tạo tất cả\" tạo lần lượt qua POST /api/tasks, giữ khóa idempotency khi chưa rõ kết quả, chạm giới hạn thì chờ rồi tạo tiếp", () => {
    const dialog = read("apps/web/src/components/assistant/assistant-bulk-create-dialog.tsx");
    assert.ok(dialog.includes("performCreateTaskSubmission(") && dialog.includes("idempotencyKey: idempotencyKeys.current.get(key)"));
    assert.ok(dialog.includes("outcome.result.status === 429") && dialog.includes("retryAfterSeconds ?? RATE_LIMIT_FALLBACK_SECONDS"));
    assert.ok(dialog.includes("await onCreated(item, task)"), "lưu thẻ xong mới tạo cái tiếp theo");
    const chatHook = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(chatHook.includes("return saveProposal(replyKey, { index, taskId: task.id }"));
  });
});

describe("Trợ lý UI: tiến độ trực tiếp của lượt dài", () => {
  const renderThread = (message: ThreadMessage) =>
    renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread: [userThreadMessage("u1", "Soạn nhiệm vụ theo kế hoạch"), message],
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
      }),
    );

  test("thời lượng dưới một phút ghi giây, từ một phút ghi phút và giây", () => {
    assert.equal(formatDurationVi(2), "2 giây");
    assert.equal(formatDurationVi(59.6), "1 phút");
    assert.equal(formatDurationVi(238), "3 phút 58 giây");
    assert.equal(formatDurationVi(120), "2 phút");
  });

  test("đang chạy: đồng hồ từ lúc gửi và số đề xuất đã soạn cạnh nhãn; xong thì nhãn ghi tổng thời gian theo phút", () => {
    let reply = streamingThreadMessage("r-long", Date.now() - 65_000);
    reply = reduceAssistantReply(reply, { type: "step", step: { tool: "propose_task", label: "Soạn đề xuất “Tuyển sinh”", count: null, ok: true } });
    reply = ["Tuyển sinh đợt 3", "Rà soát chương trình", "Báo cáo tháng"].reduce(
      (acc, title) => reduceAssistantReply(acc, { type: "proposal", proposal: { title } }),
      reply,
    );
    const live = renderThread(reply);
    assert.ok(live.includes("Đang soạn đề xuất…"));
    assert.ok(live.includes("3 đề xuất · 1 phút 5 giây"), "số đề xuất và đồng hồ");

    // Đề xuất đang viết dở (sự kiện proposal_started) đếm trước khi thẻ tới
    let drafting = streamingThreadMessage("r-drafting", Date.now() - 30_000);
    drafting = reduceAssistantReply(drafting, { type: "step", step: { tool: "propose_task", label: "Soạn đề xuất", count: null, ok: true } });
    for (let i = 0; i < 5; i++) drafting = reduceAssistantReply(drafting, { type: "proposal_started" });
    assert.ok(renderThread(drafting).includes("5 đề xuất · 30 giây"));

    const quick = renderThread(streamingThreadMessage("r-quick", Date.now() - 2_000));
    assert.equal(quick.includes('data-slot="assistant-run-progress"'), false, "trả lời nhanh không hiện đồng hồ");

    const done = reduceAssistantReply(reply, { type: "done", messageId: "m-long", status: "complete", durationMs: 238_000 });
    const html = renderThread(done);
    assert.ok(html.includes("Đã soạn đề xuất trong 3 phút 58 giây"));
    assert.equal(html.includes('data-slot="assistant-run-progress"'), false);
  });
});

describe("Trợ lý UI: gợi ý bước tiếp theo", () => {
  const done = (patch: Partial<ThreadMessage>): ThreadMessage => ({ ...streamingThreadMessage("r"), status: "complete", content: "Xong.", ...patch });
  const question = userThreadMessage("u", "Tóm tắt văn bản");
  const withFile: ThreadMessage = {
    ...question,
    storedAttachments: [{ id: "f1", name: "Ke-hoach.pdf", kind: "pdf", size: 10, url: "/api/x" }],
  };
  const proposals = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Đầu việc ${i + 1}` }));

  test("chỉ suy từ trạng thái lượt: soạn tiếp khi chạm trần hoặc dừng giữa chừng, tiếp tục khi dừng lúc viết, soạn nhiệm vụ từ tệp", () => {
    assert.deepEqual(followUpSuggestions(question, done({ proposals: proposals(60) })).map((s) => s.label), ["Soạn tiếp phần còn lại"]);
    assert.deepEqual(followUpSuggestions(question, done({ proposals: proposals(3), status: "aborted" })).map((s) => s.label), ["Soạn tiếp phần còn lại"]);
    assert.deepEqual(followUpSuggestions(question, done({ proposals: proposals(3), status: "error" })).map((s) => s.label), ["Soạn tiếp phần còn lại"]);
    assert.deepEqual(followUpSuggestions(question, done({ proposals: proposals(6) })), [], "soạn xong dưới trần thì không gợi ý");
    assert.deepEqual(followUpSuggestions(question, done({ status: "aborted" })).map((s) => s.label), ["Tiếp tục"]);
    assert.deepEqual(followUpSuggestions(question, done({ status: "aborted", content: "" })), [], "dừng khi chưa có chữ thì không có gì để tiếp");
    assert.deepEqual(followUpSuggestions(withFile, done({})).map((s) => s.label), ["Soạn nhiệm vụ từ tệp này"]);
    assert.deepEqual(followUpSuggestions(withFile, done({ proposals: proposals(2) })), [], "đã soạn từ tệp thì thôi");
    assert.deepEqual(followUpSuggestions(question, done({})), [], "hỏi đáp thường không có gợi ý");
  });

  test("gợi ý chỉ hiện dưới tin cuối, không hiện khi đang có lượt chạy; bấm gửi đúng câu", () => {
    const sent: string[] = [];
    const render = (thread: ThreadMessage[], pending = false) =>
      renderToStaticMarkup(
        React.createElement(AssistantThread, {
          thread,
          detailStatus: "ready",
          detailError: null,
          onRetry: () => undefined,
          onNewChat: () => undefined,
          listRef: { current: null },
          onScroll: () => undefined,
          pending,
          onFollowUp: (prompt: string) => void sent.push(prompt),
        }),
      );
    const older = { ...done({ status: "aborted" }), key: "r-old" };
    const latest = { ...done({}), key: "r-new" };
    assert.equal(render([question, older, withFile, latest]).match(/Tiếp tục/g), null, "tin cũ không có gợi ý");
    assert.ok(render([question, older, withFile, latest]).includes("Soạn nhiệm vụ từ tệp này"));
    assert.equal(render([withFile, latest], true).includes("Soạn nhiệm vụ từ tệp này"), false);
    assert.ok(read("apps/web/src/components/assistant/assistant-workspace.tsx").includes("onFollowUp={suggest}"));
    assert.ok(read("apps/web/src/components/assistant/assistant-dock-panel.tsx").includes("onFollowUp={onFollowUp}"));
  });
});

describe("Trợ lý UI: cột bên là chồng thẻ riêng (Tiến trình, Đề xuất, Tệp, Nguồn)", () => {
  const step = (tool: "propose_task" | "list_tasks" | "attachment", label: string, ok = true) => ({ tool, label, count: null, ok });

  test("tiến trình: bước soạn đề xuất liền nhau gom một dòng; đang chạy thì dòng cuối là bước đang làm, đếm cả đề xuất đang viết dở", () => {
    const question = userThreadMessage("u", "Soạn nhiệm vụ theo kế hoạch");
    let reply = streamingThreadMessage("r", 1_000);
    assert.deepEqual(conversationOutline([question, reply]).progress?.steps, [{ label: "Suy nghĩ", state: "running" }]);

    reply = reduceAssistantReply(reply, { type: "step", step: step("attachment", "Đọc tệp Ke-hoach.pdf") });
    reply = reduceAssistantReply(reply, { type: "step", step: step("propose_task", "Soạn đề xuất “A”") });
    reply = reduceAssistantReply(reply, { type: "step", step: step("propose_task", "Soạn đề xuất “B”") });
    for (let i = 0; i < 5; i++) reply = reduceAssistantReply(reply, { type: "proposal_started" });
    assert.deepEqual(conversationOutline([question, reply]).progress?.steps, [
      { label: "Đọc tệp Ke-hoach.pdf", state: "done" },
      { label: "Soạn 5 đề xuất", state: "running" },
    ]);

    reply = reduceAssistantReply(reply, { type: "text", delta: "Tôi đã soạn" });
    assert.deepEqual(conversationOutline([question, reply]).progress?.steps.at(-1), { label: "Viết câu trả lời", state: "running" });

    reply = reduceAssistantReply(reply, { type: "step", step: step("list_tasks", "Xem việc của Thầy/Cô", false) });
    reply = reduceAssistantReply(reply, { type: "done", messageId: "m", status: "complete", durationMs: 95_000 });
    const done = conversationOutline([question, reply]).progress;
    assert.deepEqual(done?.steps, [
      { label: "Đọc tệp Ke-hoach.pdf", state: "done" },
      { label: "Soạn 2 đề xuất", state: "done" },
      { label: "Xem việc của Thầy/Cô", state: "failed" },
    ]);
    assert.equal(done?.durationMs, 95_000);
    assert.equal(conversationOutline([question, { ...reply, steps: [] }]).progress, null, "trả lời thường không có thẻ tiến trình");
  });

  test("mỗi loại là một thẻ nổi riêng có tiêu đề bấm thu gọn; thẻ trống không hiện", () => {
    const question = { ...userThreadMessage("u", "Soạn nhiệm vụ"), storedAttachments: [{ id: "f1", name: "Ke-hoach.pdf", kind: "pdf" as const, size: 2048, url: "/api/f1" }] };
    const reply: ThreadMessage = {
      ...reduceAssistantReply(streamingThreadMessage("r"), { type: "step", step: step("propose_task", "Soạn đề xuất “A”") }),
      status: "complete",
      content: "Đã soạn.",
      durationMs: 65_000,
      proposals: [{ title: "Tuyển sinh đợt 3", dueDate: "2026-10-30" }],
    };
    const html = renderToStaticMarkup(
      React.createElement(AssistantSidePanel, {
        outline: conversationOutline([question, reply]),
        onOpenProposal: () => undefined,
        onCreateProposals: () => undefined,
      }),
    );
    assert.equal((html.match(/data-slot="assistant-rail-card"/g) ?? []).length, 3, "Tiến trình, Đề xuất, Tệp; không có nguồn thì không có thẻ Nguồn");
    for (const text of ["Tiến trình", "1 phút 5 giây", "Soạn 1 đề xuất", "Đề xuất nhiệm vụ", "0/1 đã tạo", "Tệp", "Ke-hoach.pdf"]) {
      assert.ok(html.includes(text), text);
    }
    assert.equal(html.includes("Nguồn đã dùng"), false);
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 3, "tiêu đề thẻ là nút thu gọn");
    assert.ok(/<h2[^>]*><button/.test(html), "nút nằm trong tiêu đề (mẫu disclosure)");
  });
});

describe("Trợ lý UI: tạo lại và sửa câu hỏi cuối", () => {
  const render = (thread: ThreadMessage[], pending = false) =>
    renderToStaticMarkup(
      React.createElement(AssistantThread, {
        thread,
        detailStatus: "ready",
        detailError: null,
        onRetry: () => undefined,
        onNewChat: () => undefined,
        listRef: { current: null },
        onScroll: () => undefined,
        pending,
        onRegenerate: () => undefined,
        onEditQuestion: () => undefined,
      }),
    );
  const q = (key: string, id: string | null, content: string): ThreadMessage => ({ ...userThreadMessage(key, content), id });
  const a = (key: string, patch: Partial<ThreadMessage> = {}): ThreadMessage => ({ ...streamingThreadMessage(key), id: `m-${key}`, status: "complete", content: "Trả lời.", ...patch });

  test("chỉ cặp hỏi–đáp cuối có nút sửa và tạo lại; đang chạy, câu hỏi chưa có mã hay tin lỗi thì không", () => {
    const html = render([q("u1", "q1", "Câu 1"), a("r1"), q("u2", "q2", "Câu 2"), a("r2")]);
    assert.equal((html.match(/aria-label="Sửa câu hỏi"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-label="Tạo lại câu trả lời"/g) ?? []).length, 1);
    assert.equal(render([q("u2", "q2", "Câu 2"), a("r2")], true).includes("Tạo lại câu trả lời"), false, "đang có lượt chạy");
    assert.equal(render([q("u2", null, "Câu 2"), a("r2")]).includes("Sửa câu hỏi"), false, "câu hỏi chưa lưu ở máy chủ");
    const failed = render([q("u2", "q2", "Câu 2"), a("r2", { status: "error", content: "" })]);
    assert.equal(failed.includes("Tạo lại câu trả lời"), false, "tin lỗi dùng Thử lại");
    assert.ok(failed.includes("Sửa câu hỏi"), "câu hỏi của tin lỗi vẫn sửa được");
    const withTask = render([q("u2", "q2", "Câu 2"), a("r2", { proposals: [{ title: "Tuyển sinh đợt 3" }], proposalTasks: { 0: { id: "t-1", code: "NV-2026-10-001" } } })]);
    assert.equal(withTask.includes("Tạo lại câu trả lời") || withTask.includes("Sửa câu hỏi"), false, "đề xuất đã thành nhiệm vụ thì giữ dấu, không thay");
  });

  test("hook thay cặp cuối qua replacesMessageId, máy chủ từ chối thì trả cặp cũ; trang và khung nổi đều nối", () => {
    const hook = read("apps/web/src/components/assistant/use-assistant-chat.ts");
    assert.ok(hook.includes("replacesMessageId: replaces.questionId"));
    assert.ok(hook.includes("...replaced]"), "từ chối thì trả lại cặp cũ");
    assert.ok(read("apps/web/src/components/assistant/assistant-workspace.tsx").includes("onEditQuestion={(text) => replaceLast(text)}"));
    assert.ok(read("apps/web/src/components/assistant/assistant-dock-panel.tsx").includes("onEditQuestion={(text) => onReplaceLast(text)}"));
  });
});

describe("Trợ lý UI: lượt chạy tiếp khi rời trang, nối lại khi mở lại cuộc", () => {
  const realFetch = globalThis.fetch;
  const ndjson = (events: unknown[], headers: Record<string, string> = {}) =>
    new Response(events.map((event) => JSON.stringify(event)).join("\n"), { status: 200, headers: { "content-type": "application/x-ndjson", ...headers } });

  test("chỉ nối lại khi câu hỏi cuối đã lưu mà chưa có trả lời", () => {
    const saved = { ...userThreadMessage("u1", "Hỏi"), id: "m-1" };
    assert.equal(unansweredQuestion([saved]), saved);
    assert.equal(unansweredQuestion([saved, { ...streamingThreadMessage("r1"), status: "complete" }]), null, "đã có trả lời thì không hiện hai lần");
    assert.equal(unansweredQuestion([userThreadMessage("u2", "Chưa lưu")]), null);
    assert.equal(unansweredQuestion([]), null);
  });

  test("nối lại: 204 là không có lượt; có lượt thì báo mã và mốc bắt đầu trước sự kiện đầu tiên; Dừng gọi đúng lượt", async () => {
    const calls: string[] = [];
    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${String(input)}`);
        if (String(input).includes("/runs/")) return new Response(JSON.stringify({ stopped: true }), { status: 200 });
        if (String(input).includes("c-idle")) return new Response(null, { status: 204 });
        return ndjson([{ type: "text", delta: "Phát lại" }, { type: "done", messageId: "m-2", status: "complete", durationMs: 10 }], {
          "x-assistant-run-id": "run-1",
          "x-assistant-run-started-at": "1760860800000",
        });
      }) as typeof fetch;
      const signal = new AbortController().signal;
      assert.equal(await resumeAssistantTurn("c-idle", signal, () => assert.fail("không có lượt"), () => assert.fail("không có sự kiện")), false);

      const order: string[] = [];
      const found = await resumeAssistantTurn(
        "c-run",
        signal,
        (run) => order.push(`run:${run.id}:${run.startedAt}`),
        (event) => order.push(event.type),
      );
      assert.equal(found, true);
      assert.deepEqual(order, ["run:run-1:1760860800000", "text", "done"]);

      const runs: string[] = [];
      await streamAssistantTurn({ message: "Hỏi" }, signal, () => undefined, [], (run) => runs.push(run.id));
      assert.deepEqual(runs, ["run-1"], "gửi lượt mới cũng báo mã lượt để Dừng");

      assert.deepEqual(await stopAssistantRunRequest("run-1"), { stopped: true });
      assert.deepEqual(calls, [
        "GET /api/assistant/conversations/c-idle/stream",
        "GET /api/assistant/conversations/c-run/stream",
        "POST /api/assistant/chat",
        "POST /api/assistant/runs/run-1/stop",
      ]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
