"use client";

import * as React from "react";
import type { OutgoingReviewer } from "@qcet/contracts/types/document";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogForm, StandardDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { readApiErrorMessage } from "@/lib/documents/api-error";

/**
 * Trình dự thảo văn bản đi cho người duyệt nội dung: người soạn chọn người duyệt (mặc định trưởng đơn vị soạn) và có thể
 * để lại lời nhắn. Danh sách do server tính (`outgoingStep.reviewers`), server kiểm lại khi nhận.
 */
export function OutgoingSubmitDialog({
  open,
  onOpenChange,
  documentId,
  reviewers,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  reviewers: OutgoingReviewer[];
  onSubmitted: (reviewer: OutgoingReviewer | null) => void;
}) {
  const defaultReviewerId = (reviewers.find((r) => r.recommended) ?? reviewers[0])?.id ?? "";
  const [reviewerId, setReviewerId] = React.useState(defaultReviewerId);
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Mở lại hộp thì bắt đầu từ mặc định, không giữ lựa chọn và lỗi của lần trước
  React.useEffect(() => {
    if (!open) return;
    setReviewerId(defaultReviewerId);
    setMessage("");
    setError(null);
  }, [open, defaultReviewerId]);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/submit-content-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(reviewerId ? { contentReviewerId: reviewerId } : {}), ...(message.trim() ? { notes: message.trim() } : {}) }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, `Không gửi duyệt được (${res.status}).`));
      onSubmitted(reviewers.find((r) => r.id === reviewerId) ?? null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi duyệt được, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <StandardDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title="Trình duyệt nội dung"
      description="Người duyệt sẽ thấy dự thảo trong hàng chờ của mình; bạn rút lại được khi họ chưa quyết."
      size="sm"
      compact
      // Ô đầu tiên nhận focus khi mở (không phải nút đóng): chọn người duyệt, hoặc lời nhắn khi không có danh sách
      initialFocus={() => bodyRef.current?.querySelector<HTMLElement>('[role="combobox"], textarea') ?? true}
    >
      <div ref={bodyRef}>
        <DialogForm onSubmit={() => void submit()}>
          {reviewers.length > 0 ? (
            <FormField label="Người duyệt">
              <Select
                compact
                positionerClassName="z-50"
                value={reviewerId}
                onValueChange={(value) => setReviewerId(value ?? "")}
                options={reviewers.map((r) => ({ value: r.id, label: `${r.name} · ${r.title}` }))}
              />
            </FormField>
          ) : (
            <p className="text-compact text-muted-foreground">Dự thảo sẽ chờ người có thẩm quyền duyệt nội dung.</p>
          )}
          <FormField label="Lời nhắn" optional>
            <Textarea compact rows={2} className="min-h-14" value={message} onChange={(event) => setMessage(event.target.value)} />
          </FormField>
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Gửi duyệt
            </Button>
          </DialogFooter>
        </DialogForm>
      </div>
    </StandardDialog>
  );
}
