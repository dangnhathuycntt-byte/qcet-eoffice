"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/pwa/storage-manager";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { getTaskAgentAttachmentKind, type TaskAgentAttachmentKind } from "@/domain/tasks/task-agent-attachments";

/** Ảnh/tệp gửi kèm tin nhắn ở ô soạn của Agent tạo nhiệm vụ và Trợ lý; máy chủ không lưu tệp. */
export interface ChatAttachment {
  id: string;
  file: File;
  kind: TaskAgentAttachmentKind;
  /** Ảnh xem trước (object URL), thu hồi khi bỏ tệp hoặc đóng khung chat. */
  previewUrl?: string;
}

/** Tạo mục đính kèm; ảnh có object URL xem trước, ghi vào `previewUrls` để nơi giữ tệp thu hồi khi đóng. */
export function createChatAttachment(file: File, previewUrls: Set<string>): ChatAttachment {
  const kind = getTaskAgentAttachmentKind(file.name) ?? "text";
  let previewUrl: string | undefined;
  if (kind === "image") {
    previewUrl = URL.createObjectURL(file);
    previewUrls.add(previewUrl);
  }
  return { id: crypto.randomUUID(), file, kind, previewUrl };
}

const RING = "shadow-[0_0_0_0.5px_rgb(0_0_0/0.09),0_3px_6px_-2px_rgb(0_0_0/0.02),0_1px_1px_0_rgb(0_0_0/0.04)]";

/** Thẻ ảnh/tệp như Linear: ảnh hiện hình thu nhỏ, tệp hiện icon loại tệp, tên và dung lượng. */
export function AttachmentCard({ attachment, onRemove, compact = false }: { attachment: ChatAttachment; onRemove?: () => void; compact?: boolean }) {
  const { file } = attachment;
  const remove = onRemove ? (
    <Button
      variant="toolbar"
      size="icon-xs"
      onClick={onRemove}
      aria-label={`Bỏ tệp ${file.name}`}
      title="Bỏ tệp"
      // Nhìn 20px; điện thoại nới vùng chạm ra 44px bằng ::after (nút đã absolute nên không dùng touch-target-expand-44)
      className="absolute -top-1.5 -right-1.5 size-5 rounded-full sm:size-5 max-md:after:absolute max-md:after:-inset-3 max-md:after:content-[''] [&_svg:not([class*='size-'])]:size-3"
    >
      <X />
    </Button>
  ) : null;
  if (attachment.kind === "image" && attachment.previewUrl) {
    return (
      <div className="relative shrink-0">
        {/* Ảnh cục bộ (object URL) nên không qua next/image */}
        <img src={attachment.previewUrl} alt={file.name} title={file.name} className={cn("rounded-lg object-cover", RING, compact ? "size-14" : "size-24")} />
        {remove}
      </div>
    );
  }
  return (
    <div className={cn("relative flex min-w-0 items-center gap-2 rounded-lg bg-background px-2.5 py-2", RING, compact ? "w-[calc(50%-0.1875rem)]" : "w-60 max-w-full")}>
      <FileTypeIcon fileName={file.name} mimeType={file.type} className="size-6" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-compact text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</p>
      </div>
      {remove}
    </div>
  );
}
