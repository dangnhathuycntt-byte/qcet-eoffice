"use client";

import * as React from "react";
import type { AssistantContextRef, AssistantConversationSummaryDTO, AssistantSourceRef } from "@/contracts/assistant";
import {
  AssistantRequestError,
  assistantErrorText,
  getConversationRequest,
  streamAssistantTurn,
} from "@/components/assistant/assistant-client";
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
  streamingThreadMessage,
  threadMessageFromDto,
  userThreadMessage,
  type AssistantProposalTask,
  type ThreadMessage,
} from "@/components/assistant/assistant-model";
import { useAgentModel } from "@/components/agent-chat/agent-models";
import { createChatAttachment, type ChatAttachment } from "@/components/agent-chat/agent-attachments";
import { ASSISTANT_ATTACHMENT_WORDING, checkTaskAgentAttachments } from "@/domain/tasks/task-agent-attachments";

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
  // Ảnh/tệp chờ gửi ở ô soạn; gửi xong thì nằm trong tin hỏi của luồng (chỉ trong phiên, máy chủ không lưu)
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const previewUrlsRef = React.useRef(new Set<string>());
  // Đọc tệp chờ gửi và luồng tin mới nhất trong callback ổn định (đổi cuộc, thu hồi ảnh xem trước)
  const attachmentsRef = React.useRef(attachments);
  attachmentsRef.current = attachments;
  const threadRef = React.useRef<ThreadMessage[]>([]);
  threadRef.current = thread;
  const turnRef = React.useRef<AbortController | null>(null);
  const detailRef = React.useRef<AbortController | null>(null);
  const unmountedRef = React.useRef(false);
  const turnSeq = React.useRef(0);
  const callbacksRef = React.useRef({ onUpsert, onTurnSettled });
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
    // Tải lại đúng cuộc đang mở (khung chat nổi quay lại): giữ tệp đã gửi và thẻ đề xuất nhiệm vụ trong phiên theo mã
    // tin, để còn ảnh trên câu hỏi, "Thử lại" vẫn gửi kèm tệp và thẻ vẫn mở được. Máy chủ không lưu hai thứ này.
    const carried = new Map<string, Pick<ThreadMessage, "attachments" | "proposals" | "proposalTasks">>();
    if (id === activeIdRef.current) {
      for (const { id: messageId, attachments: sent, proposals, proposalTasks } of threadRef.current) {
        if (!messageId || (!sent && !proposals)) continue;
        carried.set(messageId, {
          ...(sent ? { attachments: sent } : {}),
          ...(proposals ? { proposals } : {}),
          ...(proposalTasks ? { proposalTasks } : {}),
        });
      }
    }
    releasePreviews([...carried.values()].flatMap((kept) => kept.attachments ?? []));
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
      setThread(
        detail.messages.map((dto) => {
          const message = threadMessageFromDto(dto);
          const kept = carried.get(dto.id);
          return kept ? { ...message, ...kept } : message;
        }),
      );
      setDetailStatus("ready");
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

  const stop = React.useCallback(() => turnRef.current?.abort(), []);

  // Tải lại cuộc đang mở từ máy chủ (khung chat nổi quay lại sau khi cuộc đổi ở trang Trợ lý); đang trả lời thì thôi
  const reload = React.useCallback(() => {
    const id = activeIdRef.current;
    if (id && !turnRef.current) void openConversation(id);
  }, [openConversation]);

  // Đọc mã cuộc đang mở ngay lúc gọi (sau `await` để biết người dùng đã đổi cuộc chưa; state trong closure đã cũ)
  const readActiveId = React.useCallback(() => activeIdRef.current, []);

  /**
   * Gửi một lượt kèm tệp đang chờ ở ô soạn; gợi ý và thử lại truyền `resend` (tệp của câu hỏi cũ hoặc không tệp, ô soạn
   * giữ nguyên). Server từ chối trước khi trả lời: bỏ hai tin vừa thêm, trả câu hỏi về ô nhập qua `restoreDraft`; tệp về
   * ô soạn cùng chữ, chỉ khi ô soạn còn trống (đã gõ câu khác hay thêm tệp khác thì không trộn vào).
   */
  const send = async (raw: string, restoreDraft: (text: string) => boolean, resend?: ChatAttachment[]) => {
    const fromComposer = resend === undefined;
    const sentAttachments = resend ?? attachments;
    const message = raw.trim() || (sentAttachments.length > 0 ? ASSISTANT_ATTACHMENT_ONLY_PROMPT : "");
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
    setThread((prev) => [...prev, userThreadMessage(userKey, message, sentAttachments), streamingThreadMessage(replyKey)]);

    try {
      await streamAssistantTurn(
        {
          conversationId: activeIdRef.current ?? undefined,
          message,
          ...(context ? { context } : {}),
          ...(model ? { model } : {}),
        },
        controller.signal,
        (event) => {
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
          if (event.type === "done" || event.type === "error") turn.settled = true;
          setThread((prev) => prev.map((m) => (m.key === replyKey ? reduceAssistantReply(m, event) : m)));
        },
        sentAttachments.map((a) => a.file),
      );
      if (!turn.settled) setThread((prev) => prev.map((m) => (m.key === replyKey ? markReplyInterrupted(m) : m)));
    } catch (error) {
      if (error instanceof AssistantRequestError) {
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
      if (turnRef.current === controller) turnRef.current = null;
      setPending(false);
      // Có mã cuộc, hoặc dừng/hủy trước khi nhận sự kiện conversation (cuộc server có thể đã tạo): làm mới lịch sử.
      // Đã rời trang thì thôi.
      if (activeIdRef.current || (controller.signal.aborted && !unmountedRef.current)) void callbacksRef.current.onTurnSettled();
    }
  };

  /**
   * Thử lại câu hỏi ngay trước tin trả lời `replyKey`, kèm tệp đã gửi trong phiên. Câu hỏi từng kèm tệp mà tệp không còn
   * (tải lại trang; máy chủ không lưu tệp) thì không gửi thiếu tệp: đưa câu về ô soạn và nhắc đính kèm lại.
   */
  const retry = (replyKey: string, restoreDraft: (text: string) => boolean) => {
    const question = questionMessageBefore(thread, replyKey);
    if (!question) return;
    if (retryMissesAttachments(question, thread.find((m) => m.key === replyKey))) {
      if (question.content !== ASSISTANT_ATTACHMENT_ONLY_PROMPT) restoreDraft(question.content);
      setSendError(ASSISTANT_RETRY_ATTACHMENTS_GONE);
      return;
    }
    void send(question.content, restoreDraft, question.attachments ?? []);
  };

  /** Người dùng đã tạo nhiệm vụ từ thẻ đề xuất: thẻ chuyển sang "Đã tạo" (chỉ trong phiên, như thẻ). */
  const proposalCreated = React.useCallback((replyKey: string, index: number, task: AssistantProposalTask) => {
    setThread((prev) => markProposalCreated(prev, replyKey, index, task));
  }, []);

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
    proposalCreated,
    stop,
    reload,
    readActiveId,
    resetChat,
  };
}
