"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AssistantConversationActivityDTO, AssistantConversationSummaryDTO } from "@qcet/contracts/assistant";
import { formatConversationTime, groupConversationsByRecency } from "@qcet/shared/domain/assistant/assistant-history";
import {
  assistantErrorText,
  conversationActivityRequest,
  deleteConversationRequest,
  listConversationsRequest,
} from "@/components/assistant/assistant-client";
import { ConversationRowsSkeleton } from "@/components/assistant/conversation-rows-skeleton";
import { AssistantDockPanel } from "@/components/assistant/assistant-dock-panel";
import {
  ASSISTANT_ASK_EVENT,
  ASSISTANT_CONVERSATION_EVENT,
  contextTypeLabel,
  conversationIdFromPath,
  type AssistantAskEventDetail,
  type AssistantConversationEventDetail,
} from "@/components/assistant/assistant-model";
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import { useCreateTaskLauncher } from "@/components/assistant/use-create-task-launcher";
import { useSaveSkillDialog } from "@/components/assistant/assistant-settings-dialog";
import { useStickToBottom } from "@/components/assistant/use-stick-to-bottom";
import { IconSidebarAssistant, IconSidebarClose, IconSidebarHistory } from "@/components/layout/sidebar-rounded-icons";
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
/** Phím tắt mở/thu nhỏ khung chat như ⌘J của Linear Agent (ghi trong tooltip theo cách ghi ⌘B của sidebar). */
const TOGGLE_SHORTCUT = ["⌘", "J"] as const;

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
  // Cuộc lên khung nổi thì cũng thành một chip ở thanh dưới (giữ khi mở cuộc khác)
  if (value) upsertDockTab(value);
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

/* ---------------------------------------------------------------------------------------------------------------
 * Các chip cuộc trò chuyện ở thanh dưới, như các tab chat ở thanh Agent của Linear (người dùng yêu cầu 19/10/2026: "trải
 * ngang nhiều lịch sử"): cuộc từng mở ở khung nổi giữ chip tới khi đóng bằng ×, bấm chip để chuyển cuộc. Nhớ theo trình
 * duyệt như cuộc đang mở, đọc bộ nhớ một lần khi tải trang.
 * ------------------------------------------------------------------------------------------------------------- */

/** `seen`: mốc tin mới nhất (giờ máy chủ) lúc người dùng xem cuộc lần cuối; tin mới hơn thì chip có chấm chưa đọc. */
interface DockTab extends DockConversation {
  seen?: string;
}

const DOCK_TABS_STORAGE_KEY = "qcet.assistant.dockTabs";
/** Cuộc đang chạy khi mới có chip: coi như chưa xem gì, trả lời xong thì có chấm. */
const SEEN_NOTHING = "1970-01-01T00:00:00.000Z";
/** Hỏi trạng thái các chip: nhanh khi có cuộc đang chạy, chậm khi không. */
const ACTIVITY_POLL_RUNNING_MS = 4_000;
const ACTIVITY_POLL_IDLE_MS = 30_000;
/** Quá số chip này thì bỏ chip cũ nhất (không phải cuộc đang mở); cuộc vẫn còn trong lịch sử. */
const MAX_DOCK_TABS = 5;
let dockTabsValue: string | null | undefined;

function readDockTabsRaw(): string | null {
  if (dockTabsValue === undefined) {
    try {
      dockTabsValue = window.localStorage.getItem(DOCK_TABS_STORAGE_KEY);
    } catch {
      dockTabsValue = null;
    }
  }
  return dockTabsValue;
}

function parseDockTabs(raw: string | null): DockTab[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: unknown) => {
      const base = parseDock(JSON.stringify(item));
      if (!base) return [];
      const seen = (item as { seen?: unknown }).seen;
      return [typeof seen === "string" ? { ...base, seen } : base];
    });
  } catch {
    return [];
  }
}

function writeDockTabs(tabs: DockTab[]) {
  const raw = tabs.length > 0 ? JSON.stringify(tabs) : null;
  if (raw === readDockTabsRaw()) return;
  dockTabsValue = raw;
  try {
    if (raw) window.localStorage.setItem(DOCK_TABS_STORAGE_KEY, raw);
    else window.localStorage.removeItem(DOCK_TABS_STORAGE_KEY);
  } catch {
    // Bộ nhớ bị chặn: vẫn giữ trong tab này
  }
  dockListeners.forEach((listener) => listener());
}

/** Thêm chip cho cuộc (cuối hàng, sát nút Trợ lý) hoặc cập nhật tên; quá số chip thì bỏ chip cũ nhất. */
function upsertDockTab(item: DockConversation) {
  const tabs = parseDockTabs(readDockTabsRaw());
  const index = tabs.findIndex((tab) => tab.id === item.id);
  let next: DockTab[];
  if (index >= 0) {
    // Tên đang tải (null) thì giữ tên đã nhớ
    next = tabs.map((tab, i) => (i === index ? { ...tab, title: item.title ?? tab.title } : tab));
  } else {
    next = [...tabs, item];
    while (next.length > MAX_DOCK_TABS) next.splice(next.findIndex((tab) => tab.id !== item.id), 1);
  }
  writeDockTabs(next);
}

/** Cuộc đổi tên ở trang Trợ lý: chip của nó (nếu có) theo tên mới. */
function upsertDockTabTitle(id: string, title: string) {
  if (parseDockTabs(readDockTabsRaw()).some((tab) => tab.id === id)) upsertDockTab({ id, title });
}

/** Ghi mốc đã xem của chip (giờ máy chủ của tin mới nhất). */
function markDockTabSeen(id: string, seen: string) {
  const tabs = parseDockTabs(readDockTabsRaw());
  if (!tabs.some((tab) => tab.id === id && tab.seen !== seen)) return;
  writeDockTabs(tabs.map((tab) => (tab.id === id ? { ...tab, seen } : tab)));
}

function removeDockTab(id: string) {
  writeDockTabs(parseDockTabs(readDockTabsRaw()).filter((tab) => tab.id !== id));
}

function subscribeDock(listener: () => void) {
  dockListeners.add(listener);
  return () => {
    dockListeners.delete(listener);
  };
}

/**
 * Thanh dưới và khung chat nổi của Trợ lý trên mọi trang (máy tính), như thanh Agent của Linear: bên phải là chip cuộc
 * đang mở (như tab chat của Linear: tên ngắn, × để đóng, vòng quay khi đang trả lời, chấm khi có trả lời mới lúc thu
 * nhỏ), nút "Trợ lý" (cuộc mới) và nút lịch sử; ⌘/Ctrl+J mở hoặc thu nhỏ khung. Cuộc mở ở trang Trợ lý thành chip khi
 * rời trang. Trang Trợ lý tự là khung chat nên ẩn thanh và khung, nhưng vẫn giữ trạng thái để lượt đang chạy không bị
 * hủy khi chuyển sang đó. Điện thoại không có (thanh dưới trùng thanh điều hướng dưới; mở Trợ lý từ menu).
 */
export function AssistantDock() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const hidden = isAssistantPath(pathname);
  const { showToast } = useFeedback();
  const dock = parseDock(React.useSyncExternalStore(subscribeDock, readDockRaw, () => null));
  const tabs = parseDockTabs(React.useSyncExternalStore(subscribeDock, readDockTabsRaw, () => null));
  // Cuộc đang mở nhớ từ trước khi có chip (bản cũ) vẫn hiện chip
  const shownTabs: DockTab[] = dock && !tabs.some((tab) => tab.id === dock.id) ? [...tabs, dock] : tabs;
  const [panelOpen, setPanelOpen] = React.useState(false);
  // Chưa mở khung lần nào kể từ khi tải trang thì chưa tải chi tiết cuộc nhớ sẵn (chip dùng tên đã nhớ)
  const [activated, setActivated] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  // Trả lời xong lúc khung đang thu nhỏ: chấm trên chip tới khi mở khung (như chỉ báo "unread" của tab chat Linear)
  const [unread, setUnread] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const chipRef = React.useRef<HTMLButtonElement>(null);
  const agentRef = React.useRef<HTMLButtonElement>(null);

  // Thẻ đề xuất nhiệm vụ trong khung mở hộp tạo nhiệm vụ của app ngay trên trang đang xem (ADR-010)
  const { openCreateTask, openBulkCreate, createTaskModal } = useCreateTaskLauncher();
  const { openSaveSkill, saveSkillDialog } = useSaveSkillDialog();

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
    setUnread(false);
  };

  /** × trên chip: bỏ chip khỏi thanh dưới (cuộc vẫn ở lịch sử, lượt đang chạy vẫn chạy ở máy chủ); chip đang mở thì đóng khung. */
  const closeTab = (id: string) => {
    if (id === dock?.id) {
      newChat();
      minimize();
    }
    removeDockTab(id);
  };

  /** Đưa cuộc khác lên chip (chọn ở lịch sử, hoặc vừa mở ở trang Trợ lý): bỏ chữ nháp và tệp đang chờ của cuộc cũ. */
  const switchTo = (item: DockConversation) => {
    if (item.id === parseDock(readDockRaw())?.id) return;
    setDraft("");
    chat.clearAttachments();
    setUnread(false);
    writeDock(item);
  };

  const shownOpen = panelOpen && !hidden;
  const wasPendingRef = React.useRef(pending);
  React.useEffect(() => {
    if (wasPendingRef.current && !pending && !shownOpen) setUnread(true);
    wasPendingRef.current = pending;
  }, [pending, shownOpen]);
  React.useEffect(() => {
    if (shownOpen) setUnread(false);
  }, [shownOpen]);

  // Chip của cuộc không mở (người dùng sang cuộc khác, rời trang khi lượt còn chạy): hỏi máy chủ cuộc nào đang chạy
  // (vòng quay) và tin mới nhất lúc nào; mới hơn lần xem trước thì có chấm, như tab chat của Linear. Cuộc đang xem
  // (khung nổi mở, hoặc đang ở trang Trợ lý của cuộc đó) thì ghi là đã xem.
  const [activity, setActivity] = React.useState<Record<string, AssistantConversationActivityDTO>>({});
  const viewedId = hidden ? conversationIdFromPath(pathname) : shownOpen ? (dock?.id ?? null) : null;
  const viewedRef = React.useRef(viewedId);
  // Cuộc vừa rời: lần hỏi sau ghi đã xem nếu lượt đã xong (còn chạy thì trả lời xong sẽ có chấm)
  const leftRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    const previous = viewedRef.current;
    if (previous && previous !== viewedId) leftRef.current.add(previous);
    viewedRef.current = viewedId;
  }, [viewedId]);
  const tabIds = shownTabs.map((tab) => tab.id).join(",");
  React.useEffect(() => {
    if (!tabIds || !window.matchMedia("(min-width: 768px)").matches) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let running = false;
      try {
        const { items } = await conversationActivityRequest(tabIds.split(","), controller.signal);
        if (controller.signal.aborted) return;
        setActivity(Object.fromEntries(items.map((item) => [item.id, item])));
        const stored = parseDockTabs(readDockTabsRaw());
        for (const item of items) {
          const tab = stored.find((entry) => entry.id === item.id);
          const left = leftRef.current.delete(item.id);
          if (!tab) continue;
          if (item.running) {
            running = true;
            if (tab.seen === undefined) markDockTabSeen(item.id, SEEN_NOTHING);
          } else if (tab.seen === undefined || left || item.id === viewedRef.current) {
            markDockTabSeen(item.id, item.lastMessageAt);
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      timer = setTimeout(poll, running ? ACTIVITY_POLL_RUNNING_MS : ACTIVITY_POLL_IDLE_MS);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [tabIds, viewedId, pathname]);
  const tabUnread = (tab: DockTab) => {
    const item = activity[tab.id];
    return Boolean(item && !item.running && tab.id !== viewedId && tab.seen !== undefined && item.lastMessageAt > tab.seen);
  };

  const toggleRef = React.useRef<() => void>(() => undefined);
  toggleRef.current = () => (panelOpen ? minimize() : openPanel());
  // ⌘/Ctrl+J ở mọi trang (kể cả khi đang gõ), trừ trang Trợ lý (đã là khung chat) và khi đang mở hộp thoại
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyJ" && event.key.toLowerCase() !== "j") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat) return;
      if (isAssistantPath(window.location.pathname) || document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]')) return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Cuộc mở ở trang Trợ lý: lên chip, trừ khi khung đang trả lời hay đang soạn dở chữ, tệp cho cuộc khác. Cuộc đổi tên
  // hay bị xóa ở trang Trợ lý: cập nhật chip, hoặc bỏ cuộc đã xóa khỏi khung
  const onConversationChangeRef = React.useRef<(detail: AssistantConversationEventDetail) => void>(() => undefined);
  onConversationChangeRef.current = (detail) => {
    const current = parseDock(readDockRaw());
    if ("opened" in detail) {
      if (detail.id === current?.id) {
        if (detail.title && detail.title !== current.title) writeDock({ id: detail.id, title: detail.title });
      } else if (!pending && !draftRef.current.trim() && chat.attachments.length === 0) {
        switchTo({ id: detail.id, title: detail.title });
      }
      return;
    }
    if ("deleted" in detail) removeDockTab(detail.id);
    else if (detail.title) upsertDockTabTitle(detail.id, detail.title);
    if (detail.id !== current?.id) return;
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

  // "Hỏi Trợ lý" từ menu nhiệm vụ: cuộc mới với nhiệm vụ làm ngữ cảnh ngay trong khung nổi, không sang trang Trợ lý.
  // Cuộc đang mở (kể cả đang trả lời: lượt vẫn chạy ở máy chủ) về lịch sử. Điện thoại không có khung nên không nhận.
  const onAskRef = React.useRef<(detail: AssistantAskEventDetail) => void>(() => undefined);
  onAskRef.current = (detail) => {
    if (hidden || !window.matchMedia("(min-width: 768px)").matches) return;
    detail.handled = true;
    newChat();
    chat.setPendingContext(detail.context);
    openPanel();
  };
  React.useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<AssistantAskEventDetail>).detail;
      if (detail) onAskRef.current(detail);
    };
    window.addEventListener(ASSISTANT_ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASSISTANT_ASK_EVENT, onAsk);
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
      removeDockTab(id);
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
          {/* Chip như tab chat ở thanh Agent của Linear: mỗi cuộc từng mở ở khung nổi một chip, co lại khi chật */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5">
            {shownTabs.map((tab) => {
              const active = tab.id === dock?.id;
              return (
                <DockChip
                  key={tab.id}
                  ref={active ? chipRef : undefined}
                  title={active ? chipTitle : (tab.title ?? "Cuộc trò chuyện")}
                  open={active && panelOpen}
                  // Cuộc đang mở trong khung biết lượt chạy ngay; chip khác (và chip chưa tải cuộc) theo trạng thái máy chủ
                  pending={active && activated ? pending : Boolean(activity[tab.id]?.running)}
                  unread={(active && unread) || tabUnread(tab)}
                  onToggle={() => {
                    if (!active) {
                      switchTo(tab);
                      openPanel();
                    } else if (panelOpen) minimize();
                    else openPanel();
                  }}
                  onClose={() => closeTab(tab.id)}
                />
              );
            })}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
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
                className={cn(
                  "font-normal text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground aria-expanded:bg-sidebar-accent",
                  showingNewChat && "bg-sidebar-accent text-foreground",
                )}
              >
                <IconSidebarAssistant className="size-3.5" />
                Trợ lý
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" shortcut={dock ? undefined : TOGGLE_SHORTCUT}>
              {dock ? "Cuộc trò chuyện mới" : "Mở Trợ lý"}
            </TooltipContent>
          </Tooltip>
          <DockHistoryButton
            activeId={dock?.id ?? null}
            onOpen={(item) => {
              switchTo({ id: item.id, title: item.title });
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
          composerContext={
            chat.pendingContext && !activeId
              ? { label: chat.contextLabel ?? contextTypeLabel(chat.pendingContext.type), onRemove: chat.clearPendingContext }
              : null
          }
          pending={pending}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => {
            const text = draft.trim();
            if ((!text && chat.attachments.length === 0) || !canSend) return;
            setDraft("");
            send(text);
          }}
          onFollowUp={(prompt) => {
            if (!canSend) return;
            stickToBottomRef.current = true;
            // Câu gợi ý có sẵn: không lấy tệp đang chờ ở ô soạn
            void chat.send(prompt, restoreDraft, []);
          }}
          onReplaceLast={(text) => {
            if (!canSend) return;
            stickToBottomRef.current = true;
            chat.replaceLast(restoreDraft, text);
          }}
          onRetry={(replyKey) => {
            if (!canSend) return;
            // Gửi lại cả tệp của câu hỏi đó (còn trong phiên); tệp đang chờ ở ô soạn giữ nguyên
            stickToBottomRef.current = true;
            chat.retry(replyKey, restoreDraft);
          }}
          onOpenProposal={({ replyKey, index, proposal }) =>
            openCreateTask(proposal, (task) => chat.proposalCreated(replyKey, index, task), chat.filesForReply(replyKey))
          }
          onDismissProposal={chat.proposalDismissed}
          onDismissProposals={chat.proposalsDismissed}
          onCreateProposals={(items) => openBulkCreate(items, (item, task) => chat.proposalCreated(item.replyKey, item.index, task))}
          onStop={chat.stop}
          onActionChange={chat.actionChanged}
          onSaveSkill={openSaveSkill}
          onPickSkill={chat.selectSkill}
          selectedSkill={chat.skill ? { name: chat.skill.name, onRemove: () => chat.selectSkill(null) } : null}
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
            // Đóng hẳn: bỏ chip của cuộc khỏi thanh dưới (vẫn còn trong lịch sử, lượt đang chạy vẫn chạy ở máy chủ)
            if (dock) return closeTab(dock.id);
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
      {createTaskModal}
      {saveSkillDialog}
    </>
  );
}

/**
 * Một chip cuộc trò chuyện ở thanh dưới, như tab chat ở thanh Agent của Linear: chữ nhạt, rê chuột hay đang mở thì nền và
 * × hiện ra. Thanh nằm trên nền canvas như sidebar nên dùng màu hover/đang chọn của sidebar (accent thường gần trùng nền).
 * Chỉ chip của cuộc đang mở biết lượt đang chạy và trả lời mới.
 */
const DockChip = React.forwardRef<
  HTMLButtonElement,
  { title: string; open: boolean; pending: boolean; unread: boolean; onToggle: () => void; onClose: () => void }
>(function DockChip({ title, open, pending, unread, onToggle, onClose }, ref) {
  return (
    <div
      className={cn(
        "group/chip relative flex min-w-0 max-w-56 items-center rounded-md transition-colors hover:bg-sidebar-accent/60",
        open && "bg-sidebar-accent hover:bg-sidebar-accent",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={onToggle}
            className={cn(
              // Button mặc định không co (shrink-0): chip phải co để tên dài cắt "…" trong 224px, không đè nút bên cạnh
              "min-w-0 shrink justify-start pr-7 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground",
              open && "text-foreground",
            )}
          >
            {/* Thu nhỏ khi đang trả lời: vòng quay cho biết lượt vẫn chạy; tên nút đọc kèm trạng thái (Button tự đặt
                aria-busy theo `loading`, mà `loading` lại khóa nút) */}
            {pending ? <Spinner size="xs" /> : null}
            <span className="truncate">{title}</span>
            {unread && !pending ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
            {pending ? <span className="sr-only">, đang trả lời</span> : null}
            {unread && !pending ? <span className="sr-only">, có trả lời mới</span> : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-80" shortcut={TOGGLE_SHORTCUT}>
          <span className="block truncate">{title}</span>
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Đóng cuộc trò chuyện ${title}`}
        title="Đóng"
        // Bỏ chip khỏi thanh dưới (cuộc vẫn còn trong lịch sử, lượt đang chạy vẫn chạy ở máy chủ)
        onClick={onClose}
        className={cn(
          "absolute right-0.5 size-6 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-foreground focus-visible:opacity-100 group-hover/chip:opacity-100 motion-reduce:transition-none",
          open && "opacity-100",
        )}
      >
        <IconSidebarClose className="size-3" />
      </Button>
    </div>
  );
});

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
            <Button variant="ghost" size="icon-sm" aria-label="Lịch sử trò chuyện" className="hover:bg-sidebar-accent/60 aria-expanded:bg-sidebar-accent">
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
      {/* Chia theo thời gian (Hôm nay, Hôm qua, 7 ngày qua, từng tháng) như lịch sử chat của Linear và menu ở trang Trợ lý */}
      {groupConversationsByRecency(state.items, now).map((group) => (
        <div key={group.key} className="flex flex-col">
          <p className="flex h-7 select-none items-center px-3 text-xs text-muted-foreground">{group.label}</p>
          <ul className="flex flex-col gap-px" aria-label={group.label}>
            {group.items.map((item) => {
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
        </div>
      ))}
      <div className="mt-1 border-t border-border/60 pt-1">
        <Link href="/assistant" onClick={onNavigate} className={cn("flex h-8 items-center rounded-lg px-3 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground", focusRingClass)}>
          Mở trang Trợ lý
        </Link>
      </div>
    </div>
  );
}
