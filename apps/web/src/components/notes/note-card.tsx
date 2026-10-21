"use client";

import * as React from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import type { PersonalNoteSummary } from "@qcet/contracts/personal-notes";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { IconSidebarCalendar, IconSidebarTasks } from "@/components/layout/sidebar-rounded-icons";
import { cn } from "@/lib/utils";

/** Ghi chú gắn với cuộc họp/nhiệm vụ: nhãn nhỏ cuối thẻ, cùng icon với mục đó ở sidebar (liên kết nằm trong hộp sửa). */
const NOTE_ENTITY = {
  meeting: { Icon: IconSidebarCalendar, label: "Cuộc họp" },
  task: { Icon: IconSidebarTasks, label: "Nhiệm vụ" },
} as const;

/**
 * Một thẻ trong lưới kiểu Google Keep: tiêu đề, đoạn đầu nội dung giữ xuống dòng (cắt sau 12 dòng), nhãn nơi gắn. Bấm thẻ mở
 * hộp sửa. Nút ghim (góc trên) và xóa (góc dưới) hiện khi rê chuột hoặc khi tiêu điểm trong thẻ; máy cảm ứng dùng nút trong
 * hộp sửa. Hai nút nằm cạnh vùng bấm chứ không lồng trong nó (nút trong nút không hợp lệ).
 */
export function NoteCard({
  item,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  item: PersonalNoteSummary;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const title = item.title.trim();
  const preview = item.preview;
  const entity = item.entityType ? NOTE_ENTITY[item.entityType] : null;
  const actionClass = "absolute opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100";
  return (
    <div className="group relative rounded-lg border border-border bg-card transition-shadow hover:shadow-sm">
      {/* Chừa 36px dưới cho nút xóa như thanh công cụ của thẻ Keep */}
      <Pressable onClick={onOpen} className="block w-full rounded-lg px-4 pb-9 pt-3 text-left focus-visible:ring-inset">
        {title && <span className="line-clamp-3 break-words pr-5 text-sm font-medium text-foreground">{title}</span>}
        {preview ? (
          <span className={cn("line-clamp-12 whitespace-pre-wrap break-words text-compact text-foreground", title ? "mt-1" : "pr-5")}>
            {preview}
          </span>
        ) : (
          !title && <span className="block text-compact text-muted-foreground">Ghi chú trống</span>
        )}
        {entity && (
          <span className="mt-3 inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground">
            <entity.Icon size={12} className="size-3" />
            {entity.label}
          </span>
        )}
      </Pressable>
      <Button
        variant="ghost"
        size="icon-xs"
        title={item.pinned ? "Bỏ ghim" : "Ghim"}
        aria-label={item.pinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú"}
        aria-pressed={item.pinned}
        onClick={onTogglePin}
        className={cn(actionClass, "right-1.5 top-1.5")}
      >
        {item.pinned ? <PinOff /> : <Pin />}
      </Button>
      <Button variant="ghost" size="icon-xs" title="Xóa ghi chú" aria-label="Xóa ghi chú" onClick={onDelete} className={cn(actionClass, "bottom-1.5 right-1.5")}>
        <Trash2 />
      </Button>
    </div>
  );
}
