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
 * Một thẻ trong lưới kiểu Google Keep: ảnh ở đầu thẻ tràn mép (một ảnh rộng hết thẻ, nhiều ảnh lưới 2–3 cột vuông), tiêu đề,
 * đoạn đầu nội dung giữ xuống dòng (tiêu đề khối in đậm, cắt sau 12 dòng), nhãn nơi gắn. Bấm thẻ mở hộp sửa (bấm ảnh trong hộp
 * mới xem lớn, như Keep). Nút ghim (góc trên) và xóa (góc dưới) hiện khi rê chuột hoặc khi tiêu điểm trong thẻ; máy cảm ứng
 * dùng nút trong hộp sửa. Hai nút nằm cạnh vùng bấm chứ không lồng trong nó (nút trong nút không hợp lệ).
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
  const lines = item.previewLines;
  const images = item.images;
  const entity = item.entityType ? NOTE_ENTITY[item.entityType] : null;
  const actionClass = "absolute opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100";
  const hasText = Boolean(title) || lines.length > 0;
  return (
    <div className="group relative rounded-lg border border-border bg-card transition-shadow hover:shadow-low">
      {/* Chừa 36px dưới cho nút xóa như thanh công cụ của thẻ Keep */}
      <Pressable onClick={onOpen} className="block w-full overflow-hidden rounded-lg pb-9 text-left focus-visible:ring-inset">
        {images.length > 0 && (
          <span
            data-slot="note-card-images"
            className={cn("grid gap-0.5", images.length === 1 ? "grid-cols-1" : images.length === 2 || images.length === 4 ? "grid-cols-2" : "grid-cols-3")}
          >
            {images.map((image, index) => (
              // Ảnh qua API tệp có kiểm quyền nên không qua next/image
              <img
                key={`${image.url}-${index}`}
                src={image.url}
                alt={image.caption || "Hình ảnh"}
                loading="lazy"
                draggable={false}
                className={cn("block w-full bg-muted object-cover", images.length === 1 ? "max-h-72 min-h-16" : "aspect-square")}
              />
            ))}
          </span>
        )}
        <span className={cn("block px-4", hasText || !images.length ? "pt-3" : "pt-0")}>
          {title && <span className="line-clamp-3 break-words pr-5 text-sm font-medium text-foreground">{title}</span>}
          {lines.length > 0 ? (
            <span className={cn("line-clamp-12 whitespace-pre-wrap break-words text-compact text-foreground", title ? "mt-1" : "pr-5")}>
              {lines.map((line, index) => (
                <React.Fragment key={index}>
                  {index > 0 && "\n"}
                  {line.heading ? <span className="font-semibold">{line.text}</span> : line.text}
                </React.Fragment>
              ))}
            </span>
          ) : (
            !title && !images.length && <span className="block text-compact text-muted-foreground">Ghi chú trống</span>
          )}
          {entity && (
            <span className="mt-3 inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground">
              <entity.Icon size={12} className="size-3" />
              {entity.label}
            </span>
          )}
        </span>
      </Pressable>
      <Button
        variant="ghost"
        size="icon-xs"
        title={item.pinned ? "Bỏ ghim" : "Ghim"}
        aria-label={item.pinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú"}
        aria-pressed={item.pinned}
        onClick={onTogglePin}
        className={cn(actionClass, "right-1.5 top-1.5", images.length > 0 && "bg-card/90 shadow-low hover:bg-card")}
      >
        {item.pinned ? <PinOff /> : <Pin />}
      </Button>
      <Button variant="ghost" size="icon-xs" title="Xóa ghi chú" aria-label="Xóa ghi chú" onClick={onDelete} className={cn(actionClass, "bottom-1.5 right-1.5")}>
        <Trash2 />
      </Button>
    </div>
  );
}
