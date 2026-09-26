"use client";

import * as React from "react";
import {
  Paperclip,
  Plus,
  ExternalLink,
  FileText,
  Trash2,
  Check,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/lib/task-detail-helpers";

export interface DeliverableItem {
  id: string;
  title: string;
  fileUrl?: string;
  notes?: string;
  uploadedBy?: { id: string; name: string; avatarUrl?: string };
  reviewer?: { id: string; name: string };
  status?: "PENDING" | "APPROVED" | "REJECTED" | string;
  createdAt?: string;
}

export interface TaskEvidenceSectionProps {
  taskId: string;
  deliverables: DeliverableItem[];
  canEdit?: boolean;
  onAddDeliverable?: (title: string, fileUrl?: string, notes?: string) => Promise<void> | void;
  onDeleteDeliverable?: (deliverableId: string) => Promise<void> | void;
  className?: string;
}

export function TaskEvidenceSection({
  taskId,
  deliverables = [],
  canEdit = true,
  onAddDeliverable,
  onDeleteDeliverable,
  className,
}: TaskEvidenceSectionProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onAddDeliverable) {
        await onAddDeliverable(title.trim(), fileUrl.trim() || undefined, notes.trim() || undefined);
      } else {
        await fetch(`/api/tasks/${taskId}/deliverables`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            fileUrl: fileUrl.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        });
      }
      setTitle("");
      setFileUrl("");
      setNotes("");
      setIsAdding(false);
    } catch {
      // transient
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section data-slot="task-evidence-section" className={cn("space-y-3 cursor-default", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-primary shrink-0" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold text-foreground">
            Sản phẩm bàn giao & Minh chứng ({deliverables.length})
          </h2>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/80 bg-background hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            title="Đính kèm minh chứng hoặc liên kết kết quả"
            aria-label="Đính kèm minh chứng hoặc liên kết kết quả"
          >
            <Plus className="size-3.5 text-primary" strokeWidth={1.5} />
            <span>Thêm minh chứng</span>
          </button>
        )}
      </div>

      {/* Add Evidence Form */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="p-3.5 rounded-xl border border-primary/40 bg-primary/5 space-y-3 animate-in fade-in-0 duration-150"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Tên minh chứng / sản phẩm *</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Báo cáo kết quả khảo sát, Quyết định phê duyệt..."
              className="w-full text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Đường dẫn tệp / liên kết lưu trữ</label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/... hoặc https://..."
              className="w-full text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ghi chú bổ sung</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mô tả nội dung hoặc lưu ý..."
              rows={2}
              className="w-full text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md border border-border bg-background transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Check className="size-3.5" strokeWidth={1.5} />
              )}
              <span>Lưu minh chứng</span>
            </button>
          </div>
        </form>
      )}

      {/* Deliverables List */}
      {deliverables.length === 0 && !isAdding ? (
        <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Chưa có sản phẩm bàn giao hoặc minh chứng nào được đính kèm.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden rounded"
            >
              <Plus className="size-3" strokeWidth={1.5} />
              <span>Thêm minh chứng đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
          {deliverables.map((item) => {
            const isApproved = item.status === "APPROVED";
            const isRejected = item.status === "REJECTED";

            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors group/evidence"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <FileText className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-foreground truncate max-w-sm">
                        {item.title}
                      </h4>

                      {/* Approval Status badge */}
                      {item.status && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border",
                            isApproved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isRejected
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          {isApproved && <ShieldCheck className="size-3" strokeWidth={1.5} />}
                          {isApproved ? "Đã duyệt" : isRejected ? "Từ chối" : "Chờ duyệt"}
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {item.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 flex-wrap pt-0.5">
                      {item.uploadedBy?.name && <span>Bởi: {item.uploadedBy.name}</span>}
                      {item.createdAt && <span>• {formatDetailDate(item.createdAt)}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.fileUrl && (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                      title="Mở liên kết minh chứng"
                    >
                      <ExternalLink className="size-3 text-muted-foreground" strokeWidth={1.5} />
                      <span className="hidden sm:inline text-[11px]">Mở tệp</span>
                    </a>
                  )}

                  {canEdit && onDeleteDeliverable && (
                    <button
                      type="button"
                      onClick={() => onDeleteDeliverable(item.id)}
                      className="opacity-0 group-hover/evidence:opacity-100 p-1 text-muted-foreground hover:text-rose-600 rounded transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:opacity-100"
                      title="Xóa minh chứng"
                      aria-label="Xóa minh chứng"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
