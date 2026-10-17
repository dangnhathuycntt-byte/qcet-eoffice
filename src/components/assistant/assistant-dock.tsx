"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AssistantConversationSummaryDTO } from "@/contracts/assistant";
import { formatConversationTime } from "@/domain/assistant/assistant-history";
import { assistantErrorText, deleteConversationRequest, listConversationsRequest } from "@/components/assistant/assistant-client";
import { ConversationRowsSkeleton } from "@/components/assistant/conversation-rows-skeleton";
import { AssistantDockPanel } from "@/components/assistant/assistant-dock-panel";
import { ASSISTANT_CONVERSATION_EVENT, type AssistantConversationEventDetail } from "@/components/assistant/assistant-model";
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import { useStickToBottom } from "@/components/assistant/use-stick-to-bottom";
import { IconSidebarAssistant, IconSidebarHistory } from "@/components/layout/sidebar-rounded-icons";
import { isAssistantPath } from "@/lib/navigation/active-matcher";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { useFeedback } from "@/components/ui/feedback-layer";
import { focusRingClass } from "@/components/ui/focus-ring";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Số cuộc trong menu lịch sử của thanh dưới. */
const HISTORY_COUNT = 8;

/* ---------------------------------------------------------------------------------------------------------------
 * Cuộc đang mở trong khung nổi: nhớ theo trình duyệt (mã và tên) để tải lại trang vẫn còn chip. Bộ nhớ chỉ đọc một
 * lần khi tải trang, sau đó giá trị nằm trong biến của tab: tab khác ghi đè không được đổi cuộc (và hủy lượt đang
 * chạy) ở tab này; lần tải trang sau lấy cuộc mới nhất.
 * ------------------------------------------------------------------------------------------------------------- */

interface DockConversation {
  id: string;
  title: string | null;
}

const DOCK_STORAGE_KEY = "qcet.assistant.dock";
const dockListeners = new Set<() => void>();
/** Giá trị của tab (`undefined`: chưa đọc bộ nhớ). */
let dockValue: string | null | undefined;

function readDockRaw(): string | null {
  if (dockValue === undefined) {
    try {
      dockValue = window.localStorage.getItem(DOCK_STORAGE_KEY);
    } catch {
      dockValue = null;
    }
  }
  return dockValue;
}

function writeDock(value: DockConversation | null) {
  const raw = value ? JSON.stringify(value) : null;
  if (raw === readDockRaw()) return;
  dockValue = raw;
  try {
    if (raw) window.localStorage.setItem(DOCK_STORAGE_KEY, raw);
    else window.localStorage.removeItem(DOCK_STORAGE_KEY);
  } catch {
    // Bộ nhớ bị chặn: vẫn giữ trong tab này
  }
  dockListeners.forEach((listener) => listener());
}

function parseDock(raw: string | null): DockConversation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DockConversation> | null;
    if (!value || typeof value.id !== "string" || !value.id) return null;
    return { id: value.id, title: typeof value.title === "string" ? value.title : null };
  } catch {
    return null;
  }
}

function subscribeDock(listener: () => void) {
  dockListeners.add(listener);
  return () => {
    dockListeners.delete(listener);
  };
}

/**
 * Thanh dưới và khung chat nổi của Trợ lý trên mọi trang (máy tính), như thanh dưới của Linear: bên phải là chip cuộc
 * đang mở, nút "Trợ lý" (cuộc mới) và nút lịch sử. Trang Trợ lý tự là khung chat nên ẩn thanh và khung, nhưng vẫn giữ
 * trạng thái để lượt đang chạy không bị hủy khi chuyển sang đó. Điện thoại không có (thanh dưới trùng thanh điều hướng
 * dưới; mở Trợ lý từ menu).
 */
export function AssistantDock() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const hidden = isAssistantPath(pathname);
  const { showToast } = useFeedback();
  const dock = parseDock(React.useSyncExternalStore(subscribeDock, readDockRaw, () => null));
  const [panelOpen, setPanelOpen] = React.useState(false);
  // Chưa mở khung lần nào kể từ khi tải trang thì chưa tải chi tiết cuộc nhớ sẵn (chip dùng tên đã nhớ)
  const [activated, setActivated] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const chipRef = React.useRef<HTMLButtonElement>(null);
  const agentRef = React.useRef<HTMLButtonElement>(null);

  const chat = useAssistantChat({
    conversationId: activated ? dock?.id : undefined,
    initialContext: null,
    onUpsert: () => undefined,
    onTurnSettled: () => undefined,
    syncUrl: false,
  });
  const { thread, pending, activeId, activeTitle, detailStatus } = chat;
  const start = thread.length === 0 && (detailStatus === "idle" || detailStatus === "ready");
  // Khung gắn lại sau khi trang Trợ lý ẩn nó cũng tính là cột tin vừa gắn (bám đáy lại)
  const { listRef, stickToBottomRef, onScroll } = useStickToBottom(thread, activeId, panelOpen && !hidden && !start);

  // Cuộc mới vừa có mã, hoặc tên cuộc vừa có: nhớ lại để chip và lần tải trang sau dùng. Chi tiết đang tải (tên chưa
  // có) thì giữ tên đã nhớ của đúng cuộc đó, chip không nháy về chữ chung
  React.useEffect(() => {
    if (!activeId) return;
    const stored = parseDock(readDockRaw());
    writeDock({ id: activeId, title: activeTitle ?? (stored?.id === activeId ? stored.title : null) });
  }, [activeId, activeTitle]);

  const openPanel = () => {
    setActivated(true);
    setPanelOpen(true);
  };
  // Mở khung thì con trỏ vào ô soạn (như Linear). Mở cuộc đã có thì ô soạn khóa tới khi tải xong, nên chờ ô sẵn sàng;
  // tiêu điểm đã ở trong khung (menu, nút) thì không giành lại
  const composerReady = panelOpen && !hidden && (detailStatus === "idle" || detailStatus === "ready");
  React.useEffect(() => {
    if (!composerReady) return;
    const frame = requestAnimationFrame(() => {
      const input = composerRef.current;
      if (input && !input.closest('[data-slot="assistant-dock-panel"]')?.contains(document.activeElement)) input.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [composerReady]);

  // Từ trang Trợ lý quay lại: cuộc có thể đã có thêm tin ở đó, tải lại (đang trả lời thì thôi)
  const wasHiddenRef = React.useRef(hidden);
  const reload = chat.reload;
  React.useEffect(() => {
    if (wasHiddenRef.current && !hidden) reload();
    wasHiddenRef.current = hidden;
  }, [hidden, reload]);

  /** Thu nhỏ: giữ cuộc (chip còn), trả tiêu điểm về chip; đóng hẳn thì chip đã gỡ nên về nút "Trợ lý". */
  const minimize = () => {
    setPanelOpen(false);
    requestAnimationFrame(() => (chipRef.current ?? agentRef.current)?.focus({ preventScroll: true }));
  };

  const newChat = () => {
    chat.resetChat();
    writeDock(null);
    setDraft("");
    chat.clearAttachments();
  };

  // Cuộc đổi tên hay bị xóa ở trang Trợ lý: cập nhật chip, hoặc bỏ cuộc đã xóa khỏi khung
  const onConversationChangeRef = React.useRef<(detail: AssistantConversationEventDetail) => void>(() => undefined);
  onConversationChangeRef.current = (detail) => {
    if (detail.id !== parseDock(readDockRaw())?.id) return;
    if ("deleted" in detail) return newChat();
    writeDock({ id: detail.id, title: detail.title });
    if (chat.readActiveId() === detail.id) chat.setActiveTitle(detail.title);
  };
  React.useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<AssistantConversationEventDetail>).detail;
      if (detail) onConversationChangeRef.current(detail);
    };
    window.addEventListener(ASSISTANT_CONVERSATION_EVENT, onChange);
    return () => window.removeEventListener(ASSISTANT_CONVERSATION_EVENT, onChange);
  }, []);

  // Máy chủ từ chối lượt vừa gửi: trả câu về ô soạn khi ô còn trống; báo cho hook biết để tệp đi cùng chữ
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const restoreDraft = (text: string) => {
    if (draftRef.current.trim()) return false;
    setDraft(text);
    return true;
  };
  const canSend = !pending && detailStatus !== "loading" && detailStatus !== "error";
  const send = (text: string) => {
    stickToBottomRef.current = true;
    void chat.send(text, restoreDraft);
  };

  const confirmDelete = async () => {
    const id = dock?.id;
    if (!id) return;
    setDeleting(true);
    try {
      await deleteConversationRequest(id);
      setDeleteOpen(false);
      newChat();
    } catch (error) {
      setDeleteOpen(false);
      showToast({ variant: "error", message: assistantErrorText(error, "Chưa xóa được cuộc trò chuyện. Thầy/Cô thử lại.") });
    } finally {
      setDeleting(false);
    }
  };

  const showingNewChat = panelOpen && !dock;
  const chipTitle = activeId === dock?.id && activeTitle ? activeTitle : (dock?.title ?? "Cuộc trò chuyện");

  return (
    <>
      {/* Trang Trợ lý: gỡ hẳn thanh (không chỉ ẩn bằng CSS) để menu lịch sử đang mở đóng theo, không mất chỗ neo mà trôi
          lên góc trang; trạng thái chat nằm ở đây nên vẫn còn */}
      {hidden ? null : (
        <aside
          aria-label="Trợ lý"
          data-slot="assistant-statusbar"
          // Phủ phần dưới khung trang (8px lề dưới khung + phần chừa `--app-statusbar`), nút cao 28px nằm giữa: cách đáy
          // khung 4px như thanh dưới của Linear
          className="fixed bottom-0 left-[var(--sidebar-w)] right-0 z-30 hidden h-9 items-center justify-end gap-0.5 bg-sidebar px-2 md:flex"
        >
          {dock ? (
            <Button
              ref={chipRef}
              variant="ghost"
              size="sm"
              aria-expanded={panelOpen}
              onClick={() => (panelOpen ? minimize() : openPanel())}
              className="max-w-56 font-normal"
            >
              {/* Thu nhỏ khi đang trả lời: vòng quay cho biết lượt vẫn chạy; tên nút đọc kèm trạng thái (Button tự đặt
                  aria-busy theo `loading`, mà `loading` lại khóa nút) */}
              {pending ? <Spinner size="xs" /> : null}
              <span className="truncate">{chipTitle}</span>
              {pending ? <span className="sr-only">, đang trả lời</span> : null}
            </Button>
          ) : null}
          <Button
            ref={agentRef}
            variant="ghost"
            size="sm"
            // Chỉ là nút bật/tắt khi chưa có cuộc; có cuộc thì bấm là mở cuộc mới, chip mới là nút bật/tắt
            aria-expanded={dock ? undefined : showingNewChat}
            onClick={() => {
              // Đang mở cuộc mới thì bấm lại là thu nhỏ; đang có cuộc thì mở cuộc mới (cuộc cũ vẫn ở lịch sử). Đang trả lời
              // thì chỉ mở khung của lượt đó, không bỏ ngang lượt; muốn cuộc mới thì dùng mục trong menu "…"
              if (showingNewChat) return minimize();
              if (dock && !pending) newChat();
              openPanel();
            }}
            className="font-normal"
          >
            <IconSidebarAssistant className="size-3.5" />
            Trợ lý
          </Button>
          <DockHistoryButton
            activeId={dock?.id ?? null}
            onOpen={(item) => {
              if (item.id !== dock?.id) {
                setDraft("");
                chat.clearAttachments();
                writeDock({ id: item.id, title: item.title });
              }
              openPanel();
            }}
          />
        </aside>
      )}

      {panelOpen && !hidden ? (
        <AssistantDockPanel
          title={dock ? chipTitle : null}
          conversationId={dock?.id ?? null}
          thread={thread}
          detailStatus={detailStatus}
          detailError={chat.detailError}
          context={chat.activeContext}
          pending={pending}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => {
            const text = draft.trim();
            if ((!text && chat.attachments.length === 0) || !canSend) return;
            setDraft("");
            send(text);
          }}
          onRetry={(replyKey) => {
            if (!canSend) return;
            // Gửi lại cả tệp của câu hỏi đó (còn trong phiên); tệp đang chờ ở ô soạn giữ nguyên
            stickToBottomRef.current = true;
            chat.retry(replyKey, restoreDraft);
          }}
          onStop={chat.stop}
          sendError={chat.sendError}
          attachments={chat.attachments}
          onAddAttachments={chat.addAttachments}
          onRemoveAttachment={chat.removeAttachment}
          onNewChat={newChat}
          onMinimize={minimize}
          onExpand={() => {
            setPanelOpen(false);
            router.push(dock ? `/assistant/${encodeURIComponent(dock.id)}` : "/assistant");
          }}
          onClose={() => {
            // Đóng hẳn: bỏ cuộc khỏi thanh dưới (vẫn còn trong lịch sử); lượt đang chạy bị dừng
            newChat();
            minimize();
          }}
          onDeleteRequest={() => setDeleteOpen(true)}
          listRef={listRef}
          onThreadScroll={onScroll}
          composerRef={composerRef}
        />
      ) : null}

      <DestructiveConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Xóa cuộc trò chuyện"
        entityLabel="cuộc trò chuyện"
        entityName={chipTitle}
        description="Tin nhắn và nguồn đã lưu trong cuộc này cũng bị xóa."
        confirmLabel="Xóa"
        irreversible
        isConfirming={deleting}
      />
    </>
  );
}

/**
 * Nút lịch sử ở thanh dưới: menu nổi phía trên liệt kê vài cuộc gần đây (cuộc đang ở khung nổi ghi "Hiện tại") như
 * Linear. Danh sách chỉ tải khi mở menu, không tải ở mỗi trang.
 */
function DockHistoryButton({ activeId, onOpen }: { activeId: string | null; onOpen: (item: AssistantConversationSummaryDTO) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Lịch sử trò chuyện">
              <IconSidebarHistory className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Lịch sử trò chuyện</TooltipContent>
      </Tooltip>
      {/* Rộng 384px như menu lịch sử của Linear (người dùng gửi ảnh 17/10/2026): ngoại lệ có chủ đích so với popover
          224–256px, vì tên cuộc trò chuyện dài; hàng vẫn 32px theo thang */}
      <PopoverContent side="top" align="end" sideOffset={6} className="w-96 p-1">
        {open ? (
          <DockHistoryList
            activeId={activeId}
            onOpen={(item) => {
              setOpen(false);
              onOpen(item);
            }}
            onNavigate={() => setOpen(false)}
          />
        ) : null}
      </PopoverContent>
    </PopoverRoot>
  );
}

function DockHistoryList({
  activeId,
  onOpen,
  onNavigate,
}: {
  activeId: string | null;
  onOpen: (item: AssistantConversationSummaryDTO) => void;
  /** Bấm "Mở trang Trợ lý": đóng menu ngay, không chờ trang chuyển. */
  onNavigate: () => void;
}) {
  const [state, setState] = React.useState<{ status: "loading" | "ready" | "error"; items: AssistantConversationSummaryDTO[] }>({
    status: "loading",
    items: [],
  });
  const [attempt, setAttempt] = React.useState(0);
  const now = new Date();

  React.useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: "loading" }));
    listConversationsRequest({}, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setState({ status: "ready", items: page.items.slice(0, HISTORY_COUNT) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, status: "error" }));
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="flex flex-col">
      {state.status === "loading" && state.items.length === 0 ? (
        <ConversationRowsSkeleton count={3} withTime rowClassName="h-8 px-3" />
      ) : null}
      {state.status === "error" ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>Chưa tải được lịch sử.</span>
          <Button variant="ghost" size="xs" onClick={() => setAttempt((n) => n + 1)}>
            Thử lại
          </Button>
        </div>
      ) : null}
      {state.status === "ready" && state.items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Chưa có cuộc trò chuyện nào.</p>
      ) : null}
      {state.items.length > 0 ? (
        <ul className="flex flex-col gap-px" aria-label="Cuộc trò chuyện gần đây">
          {state.items.map((item) => {
            const time = formatConversationTime(item.lastMessageAt, now);
            return (
              <li key={item.id}>
                <Pressable
                  onClick={() => onOpen(item)}
                  aria-current={item.id === activeId ? "true" : undefined}
                  className="flex h-8 w-full items-center gap-3 rounded-lg px-3 text-left text-compact text-foreground transition-colors hover:bg-accent/50"
                >
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.id === activeId ? <span className="shrink-0 text-xs text-muted-foreground">Hiện tại</span> : null}
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title={time.full}>
                    {time.short}
                  </span>
                </Pressable>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-1 border-t border-border/60 pt-1">
        <Link href="/assistant" onClick={onNavigate} className={cn("flex h-8 items-center rounded-lg px-3 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground", focusRingClass)}>
          Mở trang Trợ lý
        </Link>
      </div>
    </div>
  );
}
