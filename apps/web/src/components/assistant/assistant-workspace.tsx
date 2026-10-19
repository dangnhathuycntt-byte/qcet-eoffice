"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AssistantContextRef, AssistantConversationSummaryDTO } from "@qcet/contracts/assistant";
import {
  ASSISTANT_CONVERSATION_EVENT,
  contextTypeLabel,
  conversationIdFromPath,
  conversationOutline,
  shouldApplyRenamedTitle,
  type AssistantConversationEventDetail,
} from "@/components/assistant/assistant-model";
import { assistantErrorText } from "@/components/assistant/assistant-client";
import { AssistantComposer, AssistantFootnote } from "@/components/assistant/assistant-composer";
import { AssistantHeader } from "@/components/assistant/assistant-header";
import { AssistantSidePanel, hasOutline } from "@/components/assistant/assistant-side-panel";
import { AssistantStartList } from "@/components/assistant/assistant-start";
import { AssistantThread } from "@/components/assistant/assistant-thread";
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import { useAssistantHistory } from "@/components/assistant/use-assistant-history";
import { useCreateTaskLauncher } from "@/components/assistant/use-create-task-launcher";
import { useStickToBottom } from "@/components/assistant/use-stick-to-bottom";
import type { ProposalTarget } from "@/components/assistant/assistant-model";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { useIsPhone } from "@/hooks/use-is-phone";
import { cn } from "@/lib/utils";

/** Người dùng ẩn cột bên thì nhớ cho lần sau (chỉ trình duyệt này; lỗi bộ nhớ thì coi như đang hiện). */
const SIDE_PANEL_STORAGE_KEY = "qcet.assistant.sidePanel";

function readSidePanelHidden(): boolean {
  try {
    return window.localStorage.getItem(SIDE_PANEL_STORAGE_KEY) === "hidden";
  } catch {
    return false;
  }
}

function writeSidePanelHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(SIDE_PANEL_STORAGE_KEY, "hidden");
    else window.localStorage.removeItem(SIDE_PANEL_STORAGE_KEY);
  } catch {
    // Không lưu được thì chỉ mất lựa chọn ở lần sau
  }
}

/** Báo cho khung chat nổi (đang ẩn ở trang này nhưng vẫn gắn) biết cuộc vừa mở, đổi tên hay bị xóa. */
function announceConversationChange(detail: AssistantConversationEventDetail) {
  window.dispatchEvent(new CustomEvent<AssistantConversationEventDetail>(ASSISTANT_CONVERSATION_EVENT, { detail }));
}

export interface AssistantWorkspaceProps {
  /** Cuộc trò chuyện theo URL (`/assistant/[id]`); không có là cuộc mới. */
  conversationId?: string;
  /** Mục mở sẵn từ `?context=task:<id>|document:<id>`; chỉ dùng cho cuộc mới. */
  initialContext?: AssistantContextRef | null;
}

/**
 * Trang Trợ lý trong một khung, như Linear Agent: thanh đầu trang (lịch sử là menu thả xuống từ tên cuộc), khung tin,
 * ô soạn. Chưa có tin thì màn đầu căn giữa (ô soạn, rồi thẻ gợi ý hoặc cuộc gần đây); đã có tin thì tin cuộn ở trên và
 * ô soạn dính đáy. Ô soạn luôn ở cùng vị trí trong cây giao diện nên không mất tiêu điểm khi chuyển giữa hai trạng thái.
 */
export function AssistantWorkspace({ conversationId, initialContext = null }: AssistantWorkspaceProps) {
  const router = useRouter();
  // Đường dẫn là nguồn chuẩn: sau `replaceState` (cuộc mới đã có mã) prop không đổi, còn Back/menu thì đổi cả hai
  const pathname = usePathname() ?? "";
  const activeRouteId = conversationIdFromPath(pathname) ?? conversationId ?? null;
  const [draft, setDraft] = React.useState("");
  const isPhone = useIsPhone();
  const { openCreateTask, openBulkCreate, createTaskModal } = useCreateTaskLauncher();
  // Đọc lựa chọn ẩn cột bên sau khi gắn (máy chủ không có localStorage), để HTML ban đầu khớp nhau
  const [sidePanelHidden, setSidePanelHidden] = React.useState(false);
  React.useEffect(() => setSidePanelHidden(readSidePanelHidden()), []);
  const toggleSidePanel = () => {
    const hidden = !sidePanelHidden;
    setSidePanelHidden(hidden);
    writeSidePanelHidden(hidden);
  };
  // Cuộc đang chờ xác nhận xóa (cuộc đang mở, từ menu "…" của thanh đầu)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; title: string | null } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  const history = useAssistantHistory(initialContext);
  const chat = useAssistantChat({
    conversationId: activeRouteId ?? undefined,
    initialContext,
    onUpsert: history.upsert,
    onTurnSettled: history.refresh,
  });

  const { thread, pending, activeId, activeTitle, activeContext, detailStatus } = chat;
  // Màn đầu: chưa có tin và không đang mở hay lỗi một cuộc
  const start = thread.length === 0 && (detailStatus === "idle" || detailStatus === "ready");
  const outline = React.useMemo(() => conversationOutline(thread), [thread]);
  const showSidePanelToggle = !start && hasOutline(outline);

  // Cuộc đang mở ở đây thành chip ở thanh dưới khi rời trang (như tab chat ở thanh Agent của Linear)
  React.useEffect(() => {
    if (activeId) announceConversationChange({ id: activeId, title: activeTitle, opened: true });
  }, [activeId, activeTitle]);

  // Đang ở đáy thì tin mới tự cuộn theo; người dùng kéo lên đọc thì không bị kéo xuống
  const { listRef, stickToBottomRef, onScroll: onThreadScroll } = useStickToBottom(thread, activeId, !start);

  // Chọn cuộc từ menu lịch sử thì trang dựng lại và tiêu điểm rơi xuống body: đưa về ô soạn khi ô đã mở khóa (máy
  // tính; điện thoại không bật bàn phím ảo). Tiêu điểm đang ở chỗ khác thì không giành
  React.useEffect(() => {
    if (isPhone || document.activeElement !== document.body) return;
    composerRef.current?.focus({ preventScroll: true });
  }, [detailStatus, activeRouteId, isPhone]);

  // Máy chủ từ chối lượt vừa gửi: trả câu về ô soạn khi ô còn trống; báo cho hook biết để tệp đi cùng chữ
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const restoreDraft = (text: string) => {
    if (draftRef.current.trim()) return false;
    setDraft(text);
    return true;
  };

  const canSubmit = !pending && detailStatus !== "loading" && detailStatus !== "error";

  const submit = () => {
    const text = draft.trim();
    if ((!text && chat.attachments.length === 0) || !canSubmit) return;
    setDraft("");
    setActionError(null);
    // Lượt mới luôn cuộn xuống, kể cả khi người dùng đang đọc lên trên
    stickToBottomRef.current = true;
    void chat.send(text, restoreDraft);
  };

  const suggest = (text: string) => {
    // Đang có lượt khác: chat.send sẽ bỏ qua, nên không xóa lỗi đang hiện và không đưa tiêu điểm đi
    if (pending) return;
    setActionError(null);
    stickToBottomRef.current = true;
    // Gợi ý là câu có sẵn: không lấy tệp đang chờ ở ô soạn
    void chat.send(text, restoreDraft, []);
    // Nút gợi ý rời khỏi màn khi có tin: đưa tiêu điểm về ô nhập như khi gửi bằng Enter. Điện thoại thì không, kẻo bàn
    // phím ảo bật lên che câu trả lời vừa hiện
    if (!isPhone) composerRef.current?.focus();
  };

  const retry = (replyKey: string) => {
    if (pending) return;
    setActionError(null);
    stickToBottomRef.current = true;
    // Gửi lại cả tệp của câu hỏi đó (còn trong phiên); tệp đang chờ ở ô soạn giữ nguyên
    chat.retry(replyKey, restoreDraft);
    if (!isPhone) composerRef.current?.focus();
  };

  const newChat = () => {
    chat.resetChat();
    chat.clearPendingContext();
    setActionError(null);
    router.push("/assistant");
  };

  const renameConversation = async (id: string, next: string) => {
    setActionError(null);
    try {
      const updated = await history.rename(id, next);
      announceConversationChange({ id, title: updated.title });
      // Người dùng có thể đã mở cuộc khác trong lúc chờ: chỉ đổi tiêu đề thanh đầu khi vẫn là cuộc vừa đổi tên
      if (shouldApplyRenamedTitle(chat.readActiveId(), id)) chat.setActiveTitle(updated.title);
    } catch (error) {
      setActionError(assistantErrorText(error, "Chưa đổi được tên. Thầy/Cô thử lại."));
    }
  };

  const confirmDelete = async () => {
    const id = deleteTarget?.id;
    if (!id) return;
    setDeleting(true);
    setActionError(null);
    try {
      await history.remove(id);
      announceConversationChange({ id, deleted: true });
      setDeleteTarget(null);
      // Người dùng có thể đã mở cuộc khác trong lúc chờ: chỉ về cuộc mới khi vẫn đang ở cuộc vừa xóa
      if (chat.readActiveId() === id) {
        chat.resetChat();
        router.replace("/assistant");
      }
    } catch (error) {
      setDeleteTarget(null);
      setActionError(assistantErrorText(error, "Chưa xóa được cuộc trò chuyện. Thầy/Cô thử lại."));
    } finally {
      setDeleting(false);
    }
  };

  const openProposal = ({ replyKey, index, proposal }: ProposalTarget) =>
    openCreateTask(proposal, (task) => chat.proposalCreated(replyKey, index, task), chat.filesForReply(replyKey));
  const createProposals = (items: ProposalTarget[]) =>
    openBulkCreate(items, (item, task) => chat.proposalCreated(item.replyKey, item.index, task));

  const requestDelete = (conversation: Pick<AssistantConversationSummaryDTO, "id" | "title">) => {
    setDeleteTarget({ id: conversation.id, title: conversation.title });
  };

  const title = activeTitle ?? (activeId ? "Cuộc trò chuyện" : null);
  const contextChip =
    chat.pendingContext && !activeId
      ? {
          label: chat.contextLabel ?? contextTypeLabel(chat.pendingContext.type),
          onRemove: chat.clearPendingContext,
        }
      : null;

  return (
    <div data-slot="assistant-workspace" className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AssistantHeader
          title={title}
          activeId={activeId}
          titleLoading={activeId !== null && activeTitle === null}
          history={history}
          onNewChat={newChat}
          onRename={(next) => {
            if (activeId) void renameConversation(activeId, next);
          }}
          onDeleteRequest={() => {
            if (activeId) requestDelete({ id: activeId, title: activeTitle ?? "" });
          }}
          sidePanel={
            showSidePanelToggle
              ? {
                  open: !sidePanelHidden,
                  onToggle: toggleSidePanel,
                  progress: outline.proposals.length
                    ? `Đã tạo ${outline.proposals.filter((item) => item.created).length}/${outline.proposals.length}`
                    : undefined,
                }
              : undefined
          }
        />

        <div role="status" aria-live="polite" className="sr-only">
          {pending ? "Trợ lý đang trả lời." : ""}
        </div>

        {/* Dưới thanh đầu: cột tin và cột bên (màn rộng) cạnh nhau, như cột Progress của Claude */}
        <div className="flex min-h-0 flex-1">
          {/* Khung cuộn ngoài: màn đầu căn giữa bằng m-auto nên khi màn thấp thì phần trên vẫn cuộn tới được */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
            <div className={cn("flex min-h-0 flex-col", start ? "m-auto w-full gap-5 py-6" : "flex-1")}>
              {/* Màn đầu không có tiêu đề, chỉ ô soạn và danh sách như Linear Agent (người dùng bỏ câu hỏi lớn 17/10/2026) */}
              {start ? null : (
                <AssistantThread
                  thread={thread}
                  detailStatus={detailStatus}
                  detailError={chat.detailError}
                  onRetry={retry}
                  onNewChat={newChat}
                  listRef={listRef}
                  onScroll={onThreadScroll}
                  context={activeContext}
                  pending={pending}
                  onOpenProposal={openProposal}
                  onDismissProposal={chat.proposalDismissed}
                  onCreateProposals={createProposals}
                />
              )}

              {/* Cột 752px (chữ 704px) như ô soạn và cột tin của Linear Agent, đo cùng tỉ lệ 17/10/2026 */}
              <div className={cn("mx-auto w-full max-w-[752px] shrink-0 px-4 md:px-6", !start && "pb-4")}>
                <AssistantComposer
                  variant={start ? "hero" : "dock"}
                  value={draft}
                  onChange={setDraft}
                  onSubmit={submit}
                  onStop={chat.stop}
                  pending={pending}
                  disabled={detailStatus === "loading" || detailStatus === "error"}
                  context={contextChip}
                  error={chat.sendError ?? actionError}
                  inputRef={composerRef}
                  attachments={chat.attachments}
                  onAddAttachments={chat.addAttachments}
                  onRemoveAttachment={chat.removeAttachment}
                />
              </div>

              {start ? (
                <AssistantStartList
                  items={history.items}
                  status={history.status}
                  now={new Date()}
                  onSuggest={suggest}
                  onCreateTask={openCreateTask}
                  onExamplesDismissed={isPhone ? undefined : () => composerRef.current?.focus()}
                  error={history.error}
                  onRetry={() => void history.retry()}
                />
              ) : null}
            </div>

            {/* Chân trang chỉ ở màn đầu, nằm ở đáy như ChatGPT (cụm ô soạn căn giữa phần còn lại); đang chat thì ẩn */}
            {start ? <AssistantFootnote /> : null}
          </div>

          {showSidePanelToggle && !sidePanelHidden ? (
            <AssistantSidePanel
              outline={outline}
              onOpenProposal={openProposal}
              onCreateProposals={createProposals}
            />
          ) : null}
        </div>

      </div>

      {createTaskModal}

      <DestructiveConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Xóa cuộc trò chuyện"
        entityLabel="cuộc trò chuyện"
        entityName={deleteTarget?.title || undefined}
        description="Tin nhắn và nguồn đã lưu trong cuộc này cũng bị xóa."
        confirmLabel="Xóa"
        irreversible
        isConfirming={deleting}
      />
    </div>
  );
}
