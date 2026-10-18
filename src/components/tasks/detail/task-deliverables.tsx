"use client";

import * as React from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { confirmAction } from "@/components/ui/confirm-host";
import { formatDetailDate } from "@/lib/task-detail-helpers";
import { isSafeUrl } from "@qcet/shared/lib/url-utils";
import { cn } from "@/lib/utils";
import { TaskAddPanel, TaskPanelActions } from "./task-add-chip";

export interface TaskDeliverableItem {
  id: string;
  title: string;
  fileUrl?: string;
  reviewStatus?: string;
  createdAt?: string;
}

const REVIEW_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ duyệt", className: "text-warning" },
  APPROVED: { label: "Đã duyệt", className: "text-muted-foreground" },
  REVISION_REQUIRED: { label: "Cần làm lại", className: "text-destructive" },
};

/** Đọc minh chứng từ cả hai mapper (staff: name/url, school và API: title/fileUrl), không tự điền dữ liệu thiếu. */
export function toTaskDeliverableItems(raw: unknown): TaskDeliverableItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const item = d as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const title = String(item.title ?? item.name ?? "").trim();
    if (!id || !title) return [];
    const fileUrl = item.fileUrl ?? item.url;
    const reviewStatus = item.reviewStatus ?? item.status;
    const createdAt = item.createdAt ?? item.submittedAt;
    return [{
      id,
      title,
      fileUrl: typeof fileUrl === "string" && fileUrl ? fileUrl : undefined,
      reviewStatus: typeof reviewStatus === "string" ? reviewStatus : undefined,
      createdAt: typeof createdAt === "string" && createdAt ? createdAt : undefined,
    }];
  });
}

/**
 * Minh chứng của nhiệm vụ (người duyệt cần xem trước khi duyệt). Có minh chứng thì hiện thành khối;
 * chưa có thì là mục "Minh chứng" trong menu "+ Thêm" (chỉ khi được nộp: task.submit_result).
 */
export function TaskDeliverables({
  deliverables,
  canSubmit,
  canDelete,
  onAdd,
  onDelete,
  className,
}: {
  deliverables: TaskDeliverableItem[];
  canSubmit: boolean;
  canDelete: boolean;
  onAdd: (title: string, fileUrl: string) => Promise<void>;
  onDelete: (id: string) => Promise<void> | void;
  className?: string;
}) {
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const close = () => {
    setAdding(false);
    setTitle("");
    setFileUrl("");
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdd(title.trim(), fileUrl.trim());
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nộp minh chứng");
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div className="space-y-1.5">
      <Input
        autoFocus
        aria-label="Tên minh chứng"
        placeholder="Tên minh chứng"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        type="url"
        aria-label="Liên kết tệp"
        placeholder="Liên kết tệp (https://…)"
        value={fileUrl}
        onChange={(e) => setFileUrl(e.target.value)}
      />
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      <TaskPanelActions onCancel={close}>
        <Button variant="outline" size="xs" disabled={busy || !title.trim() || !fileUrl.trim()} onClick={() => void submit()}>
          Nộp
        </Button>
      </TaskPanelActions>
    </div>
  );

  if (deliverables.length === 0) {
    if (!canSubmit) return null;
    return <TaskAddPanel entry="evidence" label="Minh chứng" open={adding} onOpenChange={(open) => (open ? setAdding(true) : close())} panel={form} />;
  }

  return (
    <section aria-label="Minh chứng" className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-compact font-semibold text-foreground tracking-tight">Minh chứng</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{deliverables.length}</span>
        {canSubmit && !adding ? (
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setAdding(true)}>
            Thêm
          </Button>
        ) : null}
      </div>

      <ul className="space-y-0.5">
        {deliverables.map((item) => {
          const status = item.reviewStatus ? REVIEW_STATUS[item.reviewStatus] : undefined;
          const safeUrl = item.fileUrl && isSafeUrl(item.fileUrl) ? item.fileUrl : undefined;
          return (
            <li key={item.id} className="flex min-h-8 items-center gap-2 text-compact">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {safeUrl ? (
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" title={item.title} className="min-w-0 truncate text-foreground hover:underline">
                  {item.title}
                </a>
              ) : (
                <span title={item.title} className="min-w-0 truncate text-foreground">{item.title}</span>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {item.createdAt ? <span className="tabular-nums">{formatDetailDate(item.createdAt)}</span> : null}
                {status ? <span className={status.className}>{status.label}</span> : null}
              </span>
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Xóa minh chứng ${item.title}`}
                  title="Xóa minh chứng"
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: "Xóa minh chứng?",
                      description: `Minh chứng “${item.title}” sẽ bị gỡ khỏi nhiệm vụ.`,
                      destructive: true,
                    });
                    if (ok) void onDelete(item.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {adding ? form : null}
    </section>
  );
}
