"use client";

import * as React from "react";
import type {
  AssistantAttachmentDTO,
  AssistantContextRef,
  AssistantConversationSummaryDTO,
  AssistantSourceRef,
  AssistantStreamEvent,
} from "@qcet/contracts/assistant";
import {
  AssistantRequestError,
  assistantErrorText,
  getConversationRequest,
  resumeAssistantTurn,
  stopAssistantRunRequest,
  streamAssistantTurn,
  updateProposalRequest,
  type AssistantRunInfo,
} from "@/components/assistant/assistant-client";
import { useFeedback } from "@/components/ui/feedback-layer";
import {
  ASSISTANT_ATTACHMENT_ONLY_PROMPT,
  ASSISTANT_RETRY_ATTACHMENTS_GONE,
  describeContextTarget,
  markProposalCreated,
  markReplyAborted,
  markReplyInterrupted,
  questionMessageBefore,
  reduceAssistantReply,
  retryMissesAttachments,
  setProposalDismissed,
  streamingThreadMessage,
  threadMessageFromDto,
  unansweredQuestion,
  userThreadMessage,
  type AssistantProposalTask,
  type ThreadMessage,
} from "@/components/assistant/assistant-model";
import { useAgentModel } from "@/components/agent-chat/agent-models";
import { createChatAttachment, type ChatAttachment } from "@/components/agent-chat/agent-attachments";
import { ASSISTANT_ATTACHMENT_WORDING, checkTaskAgentAttachments } from "@qcet/shared/domain/tasks/task-agent-attachments";

export type DetailStatus = "idle" | "loading" | "ready" | "error";

const OPEN_ERROR_MESSAGE = "Chưa mở được cuộc trò chuyện. Thầy/Cô thử lại.";

interface UseAssistantChatOptions {
  /** Cuộc trò chuyện theo URL (`/assistant/[id]`); không có là cuộc mới. */
  conversationId?: string;
  /** Mục mở sẵn từ `?context=`; chỉ dùng cho cuộc mới và bỏ đi sau lượt đầu. */
  initialContext: AssistantContextRef | null;
  onUpsert: (summary: AssistantConversationSummaryDTO) => void;
  onTurnSettled: () => void;
  /** Cuộc mới có mã thì đổi URL thành `/assistant/[id]` (trang Trợ lý). Khung chat nổi ở trang khác tắt đi. */
  syncUrl?: boolean;
}

/**
 * Trạng thái khung chat: đang mở cuộc nào, tin hiển thị, lượt đang chạy. Mỗi lượt đọc NDJSON và áp sự kiện
 * vào đúng tin trả lời bằng khóa cố định, nên tin không bị lẫn khi lượt bị dừng hoặc chuyển cuộc.
 */
/** Cặp hỏi–đáp cuối đang được "Tạo lại"/"Sửa": khóa trong luồng và mã câu hỏi ở máy chủ. */
interface ReplacedTurn {
  questionKey: string;
  replyKey: string;
  questionId: string;
}

export function useAssistantChat({ conversationId, initialContext, onUpsert, onTurnSettled, syncUrl = true }: UseAssistantChatOptions) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const activeIdRef = React.useRef<string | null>(null);
  const [activeTitle, setActiveTitle] = React.useState<string | null>(null);
  const [activeContext, setActiveContext] = React.useState<AssistantSourceRef | null>(null);
  const [thread, setThread] = React.useState<ThreadMessage[]>([]);
  const [detailStatus, setDetailStatus] = React.useState<DetailStatus>(conversationId ? "loading" : "idle");
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [pendingContext, setPendingContext] = React.useState<AssistantContextRef | null>(initialContext);
  const [contextLabel, setContextLabel] = React.useState<string | null>(null);
  // Ảnh/tệp chờ gửi ở ô soạn; gửi xong thì nằm trong tin hỏi của luồng (máy chủ lưu bản của nó, báo qua sự kiện `attachments`)
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const previewUrlsRef = React.useRef(new Set<string>());
  // Đọc tệp chờ gửi và luồng tin mới nhất trong callback ổn định (đổi cuộc, thu hồi ảnh xem trước)
  const attachmentsRef = React.useRef(attachments);
  attachmentsRef.current = attachments;
  const threadRef = React.useRef<ThreadMessage[]>([]);
  threadRef.current = thread;
  const turnRef = React.useRef<AbortController | null>(null);
  // Lượt ở máy chủ của lượt đang hiện (để nút Dừng hủy đúng lượt); bấm Dừng khi chưa có mã thì dừng ngay khi có
  const runRef = React.useRef<string | null>(null);
  const stopPendingRef = React.useRef(false);
  const detailRef = React.useRef<AbortController | null>(null);
  const unmountedRef = React.useRef(false);
  const turnSeq = React.useRef(0);
  const callbacksRef = React.useRef({ onUpsert, onTurnSettled });
  const { showToast } = useFeedback();
  const showToastRef = React.useRef(showToast);
  showToastRef.current = showToast;
  // Model chọn ở ô soạn (chung trang Trợ lý và khung chat nổi); không có danh sách thì để máy chủ dùng model mặc định
  const { model } = useAgentModel();
  React.useEffect(() => {
    callbacksRef.current = { onUpsert, onTurnSettled };
  });

  const initialType = initialContext?.type ?? null;
  const initialId = initialContext?.id ?? null;
  const ctxType = pendingContext?.type ?? null;
  const ctxId = pendingContext?.id ?? null;

  // Mở từ URL khác (?context= đổi) khi chưa có cuộc nào: lấy mục mới làm ngữ cảnh chờ gửi
  React.useEffect(() => {
    if (activeIdRef.current) return;
    setPendingContext(initialType && initialId ? { type: initialType, id: initialId } : null);
  }, [initialType, initialId]);

  // Nhãn của mục đang chờ gửi (mã và tiêu đề), lấy từ đúng API chi tiết mà người dùng đã có quyền đọc
  React.useEffect(() => {
    setContextLabel(null);
    if (!ctxType || !ctxId) return;
    const controller = new AbortController();
    const url =
      ctxType === "task"
        ? `/api/tasks/${encodeURIComponent(ctxId)}`
        : `/api/documents/${encodeURIComponent(ctxId)}`;
    fetch(url, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: unknown } | null) => {
        if (!controller.signal.aborted) setContextLabel(describeContextTarget(ctxType, body?.data ?? null));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [ctxType, ctxId]);

  const revokePreviews = (list: ChatAttachment[]) => {
    for (const a of list) {
      if (!a.previewUrl) continue;
      URL.revokeObjectURL(a.previewUrl);
      previewUrlsRef.current.delete(a.previewUrl);
    }
  };

  /**
   * Thu hồi ảnh xem trước không còn hiện ở đâu (tin đã gửi của cuộc vừa rời), giữ ảnh của tệp chờ gửi và của `keep`.
   * Khung chat nổi gắn suốt phiên nên không chờ được tới lúc gỡ khung.
   */
  const releasePreviews = React.useCallback((keep: ChatAttachment[] = []) => {
    const kept = new Set([...attachmentsRef.current, ...keep].flatMap((a) => (a.previewUrl ? [a.previewUrl] : [])));
    for (const url of previewUrlsRef.current) {
      if (kept.has(url)) continue;
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(url);
    }
  }, []);

  const resetChat = React.useCallback(() => {
    releasePreviews();
    turnRef.current?.abort();
    turnRef.current = null;
    detailRef.current?.abort();
    detailRef.current = null;
    activeIdRef.current = null;
    setActiveId(null);
    setActiveTitle(null);
    setActiveContext(null);
    setThread([]);
    setDetailStatus("idle");
    setDetailError(null);
    setPending(false);
    setSendError(null);
  }, [releasePreviews]);

  const openConversation = React.useCallback(async (id: string) => {
    // Tải lại đúng cuộc đang mở (khung chat nổi quay lại): giữ tệp đã gửi trong phiên theo mã tin, để ảnh xem trước trên
    // câu hỏi không phải tải lại. Tệp đã lưu và thẻ đề xuất thì máy chủ trả cùng chi tiết cuộc.
    const carried = new Map<string, ChatAttachment[]>();
    if (id === activeIdRef.current) {
      for (const { id: messageId, attachments: sent } of threadRef.current) {
        if (messageId && sent) carried.set(messageId, sent);
      }
    }
    releasePreviews([...carried.values()].flat());
    turnRef.current?.abort();
    turnRef.current = null;
    detailRef.current?.abort();
    const controller = new AbortController();
    detailRef.current = controller;
    activeIdRef.current = id;
    setActiveId(id);
    setActiveTitle(null);
    setActiveContext(null);
    setThread([]);
    setDetailStatus("loading");
    setDetailError(null);
    setPending(false);
    setSendError(null);
    try {
      const detail = await getConversationRequest(id, controller.signal);
      if (controller.signal.aborted) return;
      setActiveTitle(detail.title);
      setActiveContext(detail.context);
      const messages = detail.messages.map((dto) => {
        const message = threadMessageFromDto(dto);
        const sent = carried.get(dto.id);
        return sent ? { ...message, attachments: sent } : message;
      });
      setThread(messages);
      setDetailStatus("ready");
      // Câu hỏi cuối chưa có trả lời: lượt có thể còn chạy ở máy chủ (rời trang, tải lại khi đang trả lời)
      const question = unansweredQuestion(messages);
      if (question) void resumeTurnRef.current(id, question.key);
    } catch (error) {
      if (controller.signal.aborted) return;
      setDetailError(assistantErrorText(error, OPEN_ERROR_MESSAGE));
      setDetailStatus("error");
    }
  }, [releasePreviews]);

  // Đổi cuộc theo URL (quay lại, mở từ danh sách). Tạo cuộc mới qua URL không chạy ở đây vì `replaceState` không đổi prop.
  React.useEffect(() => {
    if (conversationId === activeIdRef.current) return;
    if (!conversationId) {
      if (activeIdRef.current) resetChat();
      return;
    }
    void openConversation(conversationId);
  }, [conversationId, openConversation, resetChat]);

  // Rời trang thì hủy lượt đang chạy và lần tải chi tiết. Xóa luôn mã đang mở: Strict Mode (dev) chạy lại effect
  // mở cuộc sau khi dọn, và nếu còn mã cũ thì lần mở đó bỏ qua, chi tiết đã hủy không bao giờ tải lại.
  React.useEffect(() => {
    unmountedRef.current = false;
    const previewUrls = previewUrlsRef.current;
    return () => {
      unmountedRef.current = true;
      turnRef.current?.abort();
      detailRef.current?.abort();
      activeIdRef.current = null;
      // Đóng khung chat: thu hồi ảnh xem trước của tệp chờ gửi và tệp đã gửi
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  /** Thêm tệp vào ô soạn (nút ghim, dán, kéo thả); quá giới hạn của một lượt thì báo lỗi và không thêm tệp nào. */
  const addAttachments = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const problem = checkTaskAgentAttachments([...attachments.map((a) => a.file), ...incoming], ASSISTANT_ATTACHMENT_WORDING);
    if (problem) {
      setSendError(problem);
      return;
    }
    setSendError(null);
    // Tạo ngoài updater: updater phải thuần (Strict Mode gọi hai lần sẽ tạo thừa object URL)
    const created = incoming.map((file) => createChatAttachment(file, previewUrlsRef.current));
    setAttachments((prev) => [...prev, ...created]);
  };

  /** Bỏ hết tệp chờ gửi, cùng lúc với chữ nháp (khung chat nổi mở cuộc khác, cuộc mới). */
  const clearAttachments = () => {
    revokePreviews(attachmentsRef.current);
    setAttachments([]);
  };

  const removeAttachment = (id: string) => {
    revokePreviews(attachments.filter((a) => a.id === id));
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  /**
   * Nút Dừng (Esc): hủy lượt ở máy chủ rồi thôi đọc. Rời trang, đổi cuộc hay cuộc mới chỉ thôi đọc (lượt vẫn chạy, mở
   * lại cuộc thì nối lại), nên không gọi hàm này. Máy chủ chưa trả mã lượt thì dừng ngay khi có mã.
   */
  const stop = React.useCallback(() => {
    const controller = turnRef.current;
    if (!controller) return;
    const runId = runRef.current;
    if (!runId) {
      stopPendingRef.current = true;
      return;
    }
    void stopAssistantRunRequest(runId).catch(() => undefined);
    controller.abort();
  }, []);

  /** Lượt `controller` vừa có mã ở máy chủ: nhớ để Dừng; người dùng đã bấm Dừng trước đó thì dừng luôn. */
  const runStarted = (run: AssistantRunInfo, controller: AbortController) => {
    if (turnRef.current !== controller) return;
    runRef.current = run.id;
    if (!stopPendingRef.current) return;
    void stopAssistantRunRequest(run.id).catch(() => undefined);
    controller.abort();
  };

  /** Lượt `controller` kết thúc: bỏ trạng thái lượt, trừ khi lượt khác đã thế chỗ. Trả true nếu còn là lượt hiện tại. */
  const releaseTurn = (controller: AbortController): boolean => {
    if (turnRef.current !== controller) return false;
    turnRef.current = null;
    runRef.current = null;
    stopPendingRef.current = false;
    return true;
  };

  /**
   * Áp sự kiện của một lượt vào luồng, dùng chung cho gửi lượt mới và nối lại lượt đang chạy: `userKey`, `replyKey` là
   * khóa của câu hỏi và tin trả lời của lượt; `turn.settled` thành true khi có `done` hoặc `error`.
   */
  const turnEventHandler =
    (controller: AbortController, userKey: string, replyKey: string, turn: { settled: boolean }, isNewChat: boolean) =>
    (event: AssistantStreamEvent) => {
      if (controller.signal.aborted) return;
      if (event.type === "conversation") {
        const id = event.conversation.id;
        activeIdRef.current = id;
        setActiveId(id);
        setActiveTitle(event.conversation.title);
        setDetailStatus("ready");
        if (isNewChat) {
          // Đổi URL không tải lại khung: danh sách và khung chat vẫn giữ nguyên
          if (syncUrl) window.history.replaceState(null, "", `/assistant/${encodeURIComponent(id)}`);
          setPendingContext(null);
        }
        callbacksRef.current.onUpsert(event.conversation);
        setThread((prev) => prev.map((m) => (m.key === userKey ? { ...m, id: event.userMessageId } : m)));
        return;
      }
      if (event.type === "context") {
        setActiveContext(event.source);
        return;
      }
      if (event.type === "attachments") {
        // Tệp của câu hỏi đã lưu: "Thử lại" gửi mã thay cho tệp, mở lại cuộc vẫn còn
        setThread((prev) => prev.map((m) => (m.key === userKey ? { ...m, storedAttachments: event.attachments } : m)));
        return;
      }
      if (event.type === "title") {
        // Tên do mô hình đặt cho cuộc mới; người dùng đã chuyển sang cuộc khác thì chỉ cập nhật danh sách
        if (activeIdRef.current === event.conversation.id) setActiveTitle(event.conversation.title);
        callbacksRef.current.onUpsert(event.conversation);
        return;
      }
      if (event.type === "done" || event.type === "error") turn.settled = true;
      setThread((prev) => prev.map((m) => (m.key === replyKey ? reduceAssistantReply(m, event) : m)));
    };

  /**
   * Nối lại lượt của câu hỏi cuối chưa có trả lời (người dùng rời trang, đổi cuộc hay tải lại khi lượt còn chạy): máy chủ
   * phát lại từ đầu lượt rồi gửi tiếp, tin trả lời hiện như đang chạy và Dừng được. Máy chủ không còn lượt nào (khởi động
   * lại giữa chừng) thì báo lượt bị gián đoạn để người dùng thử lại.
   */
  const resumeTurn = async (conversationId: string, userKey: string) => {
    const controller = new AbortController();
    turnRef.current = controller;
    const replyKey = `reply-${++turnSeq.current}`;
    const turn = { settled: false };
    let started = false;
    const interrupted = () => setThread((prev) => [...prev, markReplyInterrupted(streamingThreadMessage(replyKey))]);
    setPending(true);
    try {
      const found = await resumeAssistantTurn(
        conversationId,
        controller.signal,
        (run) => {
          started = true;
          setThread((prev) => [...prev, streamingThreadMessage(replyKey, run.startedAt)]);
          runStarted(run, controller);
        },
        turnEventHandler(controller, userKey, replyKey, turn, false),
      );
      if (!found && !controller.signal.aborted) interrupted();
      else if (!turn.settled) setThread((prev) => prev.map((m) => (m.key === replyKey ? markReplyInterrupted(m) : m)));
    } catch {
      if (!started && !controller.signal.aborted) interrupted();
      else setThread((prev) => prev.map((m) => (m.key === replyKey ? (controller.signal.aborted ? markReplyAborted(m) : markReplyInterrupted(m)) : m)));
    } finally {
      if (releaseTurn(controller)) {
        setPending(false);
        if (turn.settled) void callbacksRef.current.onTurnSettled();
      }
    }
  };
  // openConversation (ổn định qua các lần render) gọi bản mới nhất
  const resumeTurnRef = React.useRef(resumeTurn);
  resumeTurnRef.current = resumeTurn;

  // Tải lại cuộc đang mở từ máy chủ (khung chat nổi quay lại sau khi cuộc đổi ở trang Trợ lý); đang trả lời thì thôi
  const reload = React.useCallback(() => {
    const id = activeIdRef.current;
    if (id && !turnRef.current) void openConversation(id);
  }, [openConversation]);

  // Đọc mã cuộc đang mở ngay lúc gọi (sau `await` để biết người dùng đã đổi cuộc chưa; state trong closure đã cũ)
  const readActiveId = React.useCallback(() => activeIdRef.current, []);

  /**
   * Gửi một lượt kèm tệp đang chờ ở ô soạn; gợi ý và thử lại truyền `resend` (tệp của câu hỏi cũ hoặc không tệp, ô soạn
   * giữ nguyên) và `resendStored` (tệp đã lưu của câu hỏi cũ, gửi bằng mã). Server từ chối trước khi trả lời: bỏ hai tin
   * vừa thêm, trả câu hỏi về ô nhập qua `restoreDraft`; tệp về ô soạn cùng chữ, chỉ khi ô soạn còn trống (đã gõ câu khác
   * hay thêm tệp khác thì không trộn vào).
   */
  const send = async (
    raw: string,
    restoreDraft: (text: string) => boolean,
    resend?: ChatAttachment[],
    resendStored: AssistantAttachmentDTO[] = [],
    replaces?: ReplacedTurn,
  ) => {
    const fromComposer = resend === undefined;
    const sentAttachments = resend ?? attachments;
    const hasFiles = sentAttachments.length > 0 || resendStored.length > 0;
    const message = raw.trim() || (hasFiles ? ASSISTANT_ATTACHMENT_ONLY_PROMPT : "");
    if (!message || turnRef.current || detailStatus === "loading" || detailStatus === "error") return;
    const seq = ++turnSeq.current;
    const userKey = `user-${seq}`;
    const replyKey = `reply-${seq}`;
    const isNewChat = activeIdRef.current === null;
    const context = isNewChat ? pendingContext : null;
    const controller = new AbortController();
    turnRef.current = controller;
    const turn = { settled: false };

    setPending(true);
    setSendError(null);
    if (fromComposer) setAttachments([]);
    // "Tạo lại"/"Sửa": cặp hỏi–đáp cuối rời luồng ngay, máy chủ từ chối thì trả lại đúng chỗ
    const isReplaced = (m: ThreadMessage) => m.key === replaces?.questionKey || m.key === replaces?.replyKey;
    const replaced = replaces ? threadRef.current.filter(isReplaced) : [];
    setThread((prev) => [
      ...(replaces ? prev.filter((m) => !isReplaced(m)) : prev),
      userThreadMessage(userKey, message, sentAttachments, resendStored),
      streamingThreadMessage(replyKey, Date.now()),
    ]);

    try {
      await streamAssistantTurn(
        {
          conversationId: activeIdRef.current ?? undefined,
          message,
          ...(context ? { context } : {}),
          ...(model ? { model } : {}),
          ...(resendStored.length > 0 ? { attachmentIds: resendStored.map((attachment) => attachment.id) } : {}),
          ...(replaces ? { replacesMessageId: replaces.questionId } : {}),
        },
        controller.signal,
        turnEventHandler(controller, userKey, replyKey, turn, isNewChat),
        sentAttachments.map((a) => a.file),
        (run) => runStarted(run, controller),
      );
      if (!turn.settled) setThread((prev) => prev.map((m) => (m.key === replyKey ? markReplyInterrupted(m) : m)));
    } catch (error) {
      if (error instanceof AssistantRequestError && replaces) {
        setThread((prev) => [...prev.filter((m) => m.key !== userKey && m.key !== replyKey), ...replaced]);
        setSendError(error.message);
      } else if (error instanceof AssistantRequestError) {
        setThread((prev) => prev.filter((m) => m.key !== userKey && m.key !== replyKey));
        const restored = restoreDraft(raw.trim());
        if (fromComposer && restored && attachmentsRef.current.length === 0) setAttachments(sentAttachments);
        // Không trả tệp về ô soạn: tin hỏi đã bỏ khỏi luồng nên ảnh xem trước của lượt này không còn hiện ở đâu
        else if (fromComposer) revokePreviews(sentAttachments);
        setSendError(error.message);
      } else if (controller.signal.aborted) {
        setThread((prev) => prev.map((m) => (m.key === replyKey ? markReplyAborted(m) : m)));
      } else {
        setThread((prev) => prev.map((m) => (m.key === replyKey ? markReplyInterrupted(m) : m)));
      }
    } finally {
      releaseTurn(controller);
      setPending(false);
      // Có mã cuộc, hoặc dừng/hủy trước khi nhận sự kiện conversation (cuộc server có thể đã tạo): làm mới lịch sử.
      // Đã rời trang thì thôi.
      if (activeIdRef.current || (controller.signal.aborted && !unmountedRef.current)) void callbacksRef.current.onTurnSettled();
    }
  };

  /**
   * Thử lại câu hỏi ngay trước tin trả lời `replyKey`, kèm tệp của nó: tệp đã lưu thì gửi mã (không tải lên lại), chưa
   * lưu thì gửi bản trong phiên. Câu hỏi từng kèm tệp mà tệp không còn ở đâu thì không gửi thiếu tệp: đưa câu về ô soạn
   * và nhắc đính kèm lại.
   */
  const retry = (replyKey: string, restoreDraft: (text: string) => boolean) => {
    const question = questionMessageBefore(thread, replyKey);
    if (!question) return;
    if (retryMissesAttachments(question, thread.find((m) => m.key === replyKey))) {
      if (question.content !== ASSISTANT_ATTACHMENT_ONLY_PROMPT) restoreDraft(question.content);
      setSendError(ASSISTANT_RETRY_ATTACHMENTS_GONE);
      return;
    }
    if (question.storedAttachments?.length) void send(question.content, restoreDraft, [], question.storedAttachments);
    else void send(question.content, restoreDraft, question.attachments ?? []);
  };

  /**
   * "Tạo lại" câu trả lời cuối, hoặc gửi câu hỏi cuối đã sửa (`text`), như ChatGPT và Claude: cặp hỏi–đáp cuối được thay
   * (máy chủ đánh dấu, không hiện và không vào lịch sử mô hình), tệp của câu hỏi gửi lại như "Thử lại". Chỉ khi câu hỏi
   * đã có mã ở máy chủ và câu trả lời đã xong.
   */
  const replaceLast = (restoreDraft: (text: string) => boolean, text?: string) => {
    const reply = thread[thread.length - 1];
    if (!reply || reply.role !== "assistant" || reply.status === "streaming") return;
    const question = questionMessageBefore(thread, reply.key);
    if (!question?.id) return;
    if (retryMissesAttachments(question, reply)) {
      setSendError(ASSISTANT_RETRY_ATTACHMENTS_GONE);
      return;
    }
    const replaces: ReplacedTurn = { questionKey: question.key, replyKey: reply.key, questionId: question.id };
    const content = text?.trim() || question.content;
    if (question.storedAttachments?.length) void send(content, restoreDraft, [], question.storedAttachments, replaces);
    else void send(content, restoreDraft, question.attachments ?? [], [], replaces);
  };

  /**
   * Tệp của câu hỏi sinh ra tin trả lời `replyKey`, để "Xem lại và tạo" mang theo vào hộp tạo việc: bản `File` gốc còn
   * trong phiên (không chia sẻ ảnh xem trước của luồng chat), hoặc tải lại tệp đã lưu (mở lại cuộc). Tệp tải lỗi bị bỏ.
   */
  const filesForReply = (replyKey: string): File[] | Promise<File[]> => {
    const local = questionMessageBefore(thread, replyKey)?.attachments ?? [];
    if (local.length > 0) return local.map((attachment) => attachment.file);
    const stored = questionMessageBefore(thread, replyKey)?.storedAttachments ?? [];
    if (stored.length === 0) return [];
    return Promise.all(
      stored.map(async (attachment) => {
        try {
          const res = await fetch(attachment.url, { credentials: "same-origin" });
          if (!res.ok) return null;
          const blob = await res.blob();
          return new File([blob], attachment.name, { type: blob.type });
        } catch {
          return null;
        }
      }),
    ).then((files) => files.filter((file): file is File => file !== null));
  };

  /**
   * Lưu trạng thái thẻ đề xuất ở máy chủ để thoát ra vào lại vẫn còn (như ChatGPT); giao diện đã đổi trước. Tin trả lời
   * lỗi không có mã thì thẻ chỉ còn trong phiên. Promise xong khi đã lưu hoặc đã báo lỗi (không ném), để "Tạo tất cả"
   * lưu xong thẻ này mới tạo nhiệm vụ tiếp theo.
   */
  const saveProposal = React.useCallback(
    (replyKey: string, change: Parameters<typeof updateProposalRequest>[1], failure: string, revert?: () => void): Promise<void> => {
      const messageId = threadRef.current.find((m) => m.key === replyKey)?.id;
      if (!messageId) return Promise.resolve();
      // Câu riêng cho thẻ (câu lỗi chung của Trợ lý nói về lượt trả lời, dễ hiểu nhầm)
      return updateProposalRequest(messageId, change).then(
        () => undefined,
        () => {
          revert?.();
          showToastRef.current({ variant: "error", message: failure });
        },
      );
    },
    [],
  );

  /** Người dùng đã tạo nhiệm vụ từ thẻ đề xuất: thẻ chuyển sang "Đã tạo" kèm lối mở. */
  const proposalCreated = React.useCallback(
    (replyKey: string, index: number, task: AssistantProposalTask): Promise<void> => {
      setThread((prev) => markProposalCreated(prev, replyKey, index, task));
      // Nhiệm vụ đã tạo thật nên không trả thẻ về; chỉ báo là lần sau mở lại thẻ có thể còn nút tạo
      return saveProposal(replyKey, { index, taskId: task.id }, "Đã tạo nhiệm vụ nhưng chưa lưu được trạng thái thẻ đề xuất.");
    },
    [saveProposal],
  );

  /** "Bỏ qua" hoặc "Hoàn tác" trên thẻ đề xuất; lưu không được thì trả thẻ về như trước. */
  const proposalDismissed = React.useCallback(
    (replyKey: string, index: number, dismissed: boolean) => {
      setThread((prev) => setProposalDismissed(prev, replyKey, index, dismissed));
      void saveProposal(replyKey, { index, dismissed }, "Chưa lưu được thao tác trên thẻ đề xuất. Thầy/Cô thử lại.", () =>
        setThread((prev) => setProposalDismissed(prev, replyKey, index, !dismissed)),
      );
    },
    [saveProposal],
  );

  /**
   * "Bỏ qua"/"Hoàn tác" nhiều thẻ của cùng tin (thẻ danh sách): một request cho cả nhóm, lưu không được thì trả cả nhóm
   * về như trước.
   */
  const proposalsDismissed = React.useCallback(
    (replyKey: string, indexes: number[], dismissed: boolean) => {
      if (indexes.length === 0) return;
      const apply = (value: boolean) => (prev: ThreadMessage[]) =>
        indexes.reduce((acc, index) => setProposalDismissed(acc, replyKey, index, value), prev);
      setThread(apply(dismissed));
      void saveProposal(replyKey, { indexes, dismissed }, "Chưa lưu được thao tác trên thẻ đề xuất. Thầy/Cô thử lại.", () =>
        setThread(apply(!dismissed)),
      );
    },
    [saveProposal],
  );

  return {
    activeId,
    activeTitle,
    setActiveTitle,
    activeContext,
    thread,
    detailStatus,
    detailError,
    pending,
    sendError,
    pendingContext,
    contextLabel,
    clearPendingContext: () => setPendingContext(null),
    attachments,
    addAttachments,
    removeAttachment,
    clearAttachments,
    send,
    retry,
    replaceLast,
    filesForReply,
    proposalCreated,
    proposalDismissed,
    proposalsDismissed,
    stop,
    reload,
    readActiveId,
    resetChat,
  };
}
