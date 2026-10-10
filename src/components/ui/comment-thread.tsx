"use client";

import * as React from "react";
import { Send, Paperclip, CornerDownRight, MoreHorizontal } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { FileTile } from "./file-dropzone";
import { cn } from "@/lib/utils";

export interface CommentAttachment {
  id: string;
  name: string;
  size?: string;
  href?: string;
}

export interface CommentData {
  id: string;
  author: {
    name: string;
    title?: string;
    avatarUrl?: string;
    isLeader?: boolean;
  };
  content: string;
  createdAt: string | Date;
  attachments?: CommentAttachment[];
  replies?: CommentData[];
}

export interface CommentThreadProps extends React.HTMLAttributes<HTMLDivElement> {
  comments: CommentData[];
  onAddComment?: (text: string) => void;
  currentUser?: {
    name: string;
    avatarUrl?: string;
  };
  placeholder?: string;
}

/**
 * Khối hội thoại ý kiến chỉ đạo / thảo luận văn bản & nhiệm vụ trường học.
 */
export function CommentThread({
  comments,
  onAddComment,
  currentUser = { name: "Cán bộ xử lý" },
  placeholder = "Nhập ý kiến chỉ đạo hoặc phản hồi...",
  className,
  ...props
}: CommentThreadProps) {
  const [draft, setDraft] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddComment?.(draft);
    setDraft("");
  };

  const formatTime = (val: string | Date) => {
    if (typeof val === "string") return val;
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(val);
  };

  return (
    <div className={cn("flex flex-col gap-4 w-full", className)} {...props}>
      {/* Danh sách bình luận */}
      <div className="flex flex-col gap-3.5">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3 text-xs">
            <UserAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} size="sm" />
            <div className="flex-1 rounded-xl bg-secondary p-3 border-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-foreground">{c.author.name}</span>
                  {c.author.isLeader ? (
                    <span className="rounded-md bg-selected px-1.5 py-0.5 text-xs font-semibold text-primary">
                      Lãnh đạo
                    </span>
                  ) : null}
                  {c.author.title ? (
                    <span className="text-xs text-muted-foreground">({c.author.title})</span>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(c.createdAt)}
                </span>
              </div>

              {/* Nội dung ý kiến */}
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {c.content}
              </p>

              {/* Tệp đính kèm nếu có */}
              {c.attachments && c.attachments.length > 0 ? (
                <div className="mt-2.5 flex flex-col gap-1 pt-1">
                  {c.attachments.map((att) => (
                    <FileTile key={att.id} name={att.name} size={att.size} href={att.href} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Khung soạn thảo ý kiến */}
      {onAddComment ? (
        <form onSubmit={handleSubmit} className="flex items-start gap-2.5 pt-2">
          <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size="sm" />
          <div className="flex-1 flex flex-col gap-2 rounded-xl border-0 bg-secondary p-3 focus-within:bg-selected">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Đính kèm tệp"
                  title="Đính kèm tệp"
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 relative before:absolute before:-inset-1.5 before:content-[''] cursor-pointer"
                >
                  <Paperclip className="size-3.5" />
                </button>
                <span className="text-xs text-muted-foreground">Nhấn Enter để gửi ý kiến</span>
              </div>
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1"
              >
                <Send className="size-3.5" />
                <span>Gửi</span>
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
