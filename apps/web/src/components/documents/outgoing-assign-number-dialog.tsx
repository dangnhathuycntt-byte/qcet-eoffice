"use client";

import * as React from "react";
import type { OutgoingNumberPreview } from "@qcet/contracts/types/document";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogForm, StandardDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { readApiErrorMessage } from "@/lib/documents/api-error";
import { OUTGOING_NOTATION_ERROR, isValidOutgoingNotation } from "@qcet/shared/domain/documents/outgoing-notation";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; preview: OutgoingNumberPreview };

/**
 * Cấp số cho văn bản đi đã ký chức danh (spec Văn bản G2, G3): xem trước số sẽ cấp, sửa ký hiệu và ngày ban hành rồi cấp.
 * Số, ký hiệu mặc định và khoảng ngày do máy chủ tính (`previewAssignNumber`); máy chủ kiểm lại khi nhận. Số xem trước có
 * thể lệch nếu người khác cấp trước; số cấp thật hiện ngay sau khi cấp.
 */
export function OutgoingAssignNumberDialog({
  open,
  onOpenChange,
  documentId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onAssigned: (numberStr: string | null) => void;
}) {
  const [load, setLoad] = React.useState<Load>({ state: "loading" });
  const [notation, setNotation] = React.useState("");
  const [issuedDate, setIssuedDate] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notationError, setNotationError] = React.useState<string | null>(null);
  const notationRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoad({ state: "loading" });
    setError(null);
    setNotationError(null);
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/actions/assign-number/preview`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(await readApiErrorMessage(res, `Không tải được thông tin cấp số (${res.status}).`));
        const preview = ((await res.json()) as { data: OutgoingNumberPreview }).data;
        setNotation(preview.notation);
        setIssuedDate(preview.issuedDate);
        setLoad({ state: "ready", preview });
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoad({ state: "error", message: err instanceof Error ? err.message : "Không tải được thông tin cấp số." });
      }
    })();
    return () => controller.abort();
  }, [open, documentId]);

  // Có dữ liệu thì đưa con trỏ vào ô Ký hiệu (hộp mở lúc chưa có ô nào để focus)
  React.useEffect(() => {
    if (load.state === "ready") notationRef.current?.focus();
  }, [load.state]);

  async function submit() {
    if (load.state !== "ready") return;
    const value = notation.trim();
    if (!isValidOutgoingNotation(value)) {
      setNotationError(OUTGOING_NOTATION_ERROR);
      notationRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/assign-number`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeNotation: value, issuedDate }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, `Không cấp được số (${res.status}).`));
      // Lệnh trả chính bản ghi quy trình (không bọc `data`)
      const body = (await res.json().catch(() => null)) as { outgoingNumberStr?: string | null } | null;
      onAssigned(body?.outgoingNumberStr ?? null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cấp được số, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  const preview = load.state === "ready" ? load.preview : null;
  const previewNumberStr = preview ? `${preview.number}/${notation.trim() || preview.notation}` : null;

  return (
    <StandardDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title="Cấp số văn bản"
      description="Số cấp liên tục trong năm và không đổi sau khi cấp."
      size="sm"
      compact
    >
      {load.state === "error" ? (
        <div className="space-y-4">
          <InlineAlert variant="error">{load.message}</InlineAlert>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <DialogForm onSubmit={() => void submit()}>
          <div aria-busy={load.state === "loading"}>
            {preview ? (
              <FormField label="Số sẽ cấp">
                <p className="flex h-7 items-center text-compact font-medium tabular-nums">{previewNumberStr}</p>
              </FormField>
            ) : (
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-48" />
              </div>
            )}
          </div>
          <FormField label="Ký hiệu" error={notationError ?? undefined}>
            <Input
              ref={notationRef}
              compact
              value={notation}
              disabled={!preview}
              aria-invalid={notationError ? true : undefined}
              onChange={(event) => {
                setNotation(event.target.value);
                setNotationError(null);
              }}
            />
          </FormField>
          <FormField label="Ngày ban hành">
            <VietnameseDatePicker
              variant="input"
              triggerClassName="h-8 w-full rounded-md px-2 font-sans text-compact sm:h-7"
              className="w-full"
              periodPicker={false}
              clearable={false}
              value={issuedDate}
              onChange={(day) => setIssuedDate(day)}
              minDate={preview?.minIssuedDate}
              maxDate={preview?.maxIssuedDate}
              disabled={!preview}
            />
          </FormField>
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={pending} disabled={!preview}>
              Cấp số
            </Button>
          </DialogFooter>
        </DialogForm>
      )}
    </StandardDialog>
  );
}
