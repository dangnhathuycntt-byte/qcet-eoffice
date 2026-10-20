"use client";

import * as React from "react";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { ASSISTANT_TITLE_MAX } from "@qcet/contracts/assistant";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { IconSidebarCompose, IconSidebarPanelRight } from "@/components/layout/sidebar-rounded-icons";
import { AssistantHistoryMenu, type AssistantHistoryState } from "@/components/assistant/assistant-history-menu";
import { AssistantSettingsButton } from "@/components/assistant/assistant-settings-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuActionItem, MenuContent, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Thanh đầu trang 48px có kẻ dưới, như thanh đầu của Linear Agent. */
const HEADER_CLASS =
  "flex min-h-12 shrink-0 items-center gap-1 border-b border-border/60 px-3 md:px-4 max-md:pt-[env(safe-area-inset-top,0px)]";

export interface AssistantHeaderProps {
  /** Tên cuộc đang mở; đang tải thì là chữ chung, không có là cuộc mới. */
  title: string | null;
  /** Mã cuộc đang mở: có thì hiện menu "…" (đổi tên, xóa). */
  activeId: string | null;
  /** Tiêu đề thật đang tải: mục "Đổi tên" bị vô hiệu, không đổi tên theo chữ tạm. */
  titleLoading?: boolean;
  /** Lịch sử trò chuyện cho menu thả xuống từ tên cuộc. */
  history: AssistantHistoryState;
  onNewChat: () => void;
  onRename: (title: string) => void;
  onDeleteRequest: () => void;
  /**
   * Cột bên (đề xuất, tệp, nguồn của cuộc): có thì hiện nút bật/tắt, chỉ ở màn rộng như chính cột đó. Icon panel phải
   * như Linear (người dùng gửi ảnh 19/10/2026); `progress` (vd. "Đã tạo 3/48") ghi trong tooltip và nhãn đọc màn hình.
   */
  sidePanel?: { open: boolean; onToggle: () => void; progress?: string };
}

/**
 * Thanh đầu trang của Trợ lý, như Linear Agent: bên trái nút cuộc mới, rồi tên cuộc là nút mở menu lịch sử
 * (`AssistantHistoryMenu`); bên phải là menu "…" của cuộc đang mở. Đổi tên diễn ra ngay trên thanh.
 */
export function AssistantHeader({
  title,
  activeId,
  titleLoading = false,
  history,
  onNewChat,
  onRename,
  onDeleteRequest,
  sidePanel,
}: AssistantHeaderProps) {
  // Lưu mã cuộc đang đổi tên: đổi sang cuộc khác thì tự thoát chế độ này, không cần đồng bộ bằng effect
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const cancelledRef = React.useRef(false);
  // Tên lúc mở ô đổi tên: so với tên này, không so với tiêu đề hiện tại (tiêu đề có thể vừa tải xong trong lúc gõ)
  const renameBaseRef = React.useRef("");
  const renaming = activeId !== null && renamingId === activeId;
  // Đổi tên kết thúc bằng Enter/Esc thì trả tiêu điểm về nút "…"; kết thúc do bấm chỗ khác thì không cướp tiêu điểm
  const restoreFocusRef = React.useRef(false);
  const moreTriggerRef = React.useRef<HTMLElement>(null);

  const startRename = () => {
    cancelledRef.current = false;
    renameBaseRef.current = title ?? "";
    setDraft(renameBaseRef.current);
    setRenamingId(activeId);
  };

  const finishRename = () => {
    if (!renaming) return;
    const next = draft.trim();
    const save = !cancelledRef.current && next !== "" && next !== renameBaseRef.current;
    setRenamingId(null);
    if (save) onRename(next);
  };

  // Ô đổi tên đã rời cây giao diện; nút "…" vừa hiện lại thì đưa tiêu điểm về đó
  React.useEffect(() => {
    if (renaming || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    moreTriggerRef.current?.focus();
  }, [renaming]);

  return (
    <header className={HEADER_CLASS}>
      <MobileMenuButton className="-ml-1.5 mr-0.5 md:hidden max-md:size-11" />

      {/* Cuộc mới ở bên trái như Linear Agent; điện thoại để bên phải cho bên trái đỡ chật */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-md" onClick={onNewChat} aria-label="Cuộc trò chuyện mới" className="shrink-0 max-md:hidden">
            <IconSidebarCompose className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" sideOffset={6}>
          Cuộc trò chuyện mới
        </TooltipContent>
      </Tooltip>

      {renaming ? (
        <div className="min-w-0 max-w-72 flex-1">
          <Input
            compact
            autoFocus
            aria-label="Tên cuộc trò chuyện"
            value={draft}
            maxLength={ASSISTANT_TITLE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              // Đang chốt chữ IME thì Enter không lưu
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter") {
                e.preventDefault();
                restoreFocusRef.current = true;
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                // Chặn Esc lan ra ngoài (dừng lượt, đóng popover đang mở)
                e.preventDefault();
                e.stopPropagation();
                cancelledRef.current = true;
                restoreFocusRef.current = true;
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      ) : (
        // Tên cuộc vẫn là tiêu đề trang (h1), bên trong là nút mở menu lịch sử
        <h1 className="flex min-w-0 text-compact font-medium">
          <AssistantHistoryMenu title={title ?? "Cuộc trò chuyện mới"} history={history} activeId={activeId} />
        </h1>
      )}

      {/* Nút icon cỡ header trang (icon-md: 32px, icon 14px) như trang Nhiệm vụ; menu "…" rộng như menu "…" khác */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {/* Điện thoại: cuộc mới nằm bên phải để bên trái không quá chật */}
        <Button variant="ghost" size="icon-md" onClick={onNewChat} aria-label="Cuộc trò chuyện mới" className="size-11 md:hidden">
          <IconSidebarCompose className="size-4" />
        </Button>

        {activeId !== null && !renaming ? (
          // Khi đổi tên, menu này rời khỏi cây giao diện để tiêu điểm không quay lại nút "…" và cướp ô đổi tên
          <MenuRoot modal={false}>
            <MenuTrigger asChild ref={moreTriggerRef}>
              <Button variant="ghost" size="icon-md" aria-label="Thao tác với cuộc trò chuyện" className="max-md:size-11">
                <Ellipsis />
              </Button>
            </MenuTrigger>
            <MenuContent align="end" className="w-56 min-w-0" mobileSheet sheetTitle="Cuộc trò chuyện">
              <MenuActionItem leading={<Pencil />} onClick={startRename} disabled={titleLoading}>
                Đổi tên
              </MenuActionItem>
              <MenuSeparator className="my-1 border-t border-border/40" />
              <MenuActionItem leading={<Trash2 />} destructive onClick={onDeleteRequest}>
                Xóa
              </MenuActionItem>
            </MenuContent>
          </MenuRoot>
        ) : null}

        {/* Cài đặt đứng sau "…" (người dùng yêu cầu 20/10/2026: nút "…" qua trái); cột bên vẫn sát mép phải */}
        <AssistantSettingsButton className="max-md:size-11" />

        {sidePanel ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                onClick={sidePanel.onToggle}
                aria-label={`${sidePanel.open ? "Ẩn cột bên" : "Hiện cột bên"}${sidePanel.progress ? `: ${sidePanel.progress}` : ""}`}
                aria-pressed={sidePanel.open}
                // Đang mở thể hiện bằng khối đặc trong icon, không thêm nền; nằm sát mép phải, sau "…" (người dùng yêu cầu 19/10/2026)
                className={cn("max-xl:hidden", sidePanel.open && "text-foreground")}
              >
                <IconSidebarPanelRight size={14} active={sidePanel.open} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" sideOffset={6}>
              {sidePanel.open ? "Ẩn cột bên" : "Hiện cột bên"}
              {sidePanel.progress ? ` · ${sidePanel.progress}` : ""}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </header>
  );
}
