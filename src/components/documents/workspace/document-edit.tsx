"use client";

import * as React from "react";
import { Loader2, Paperclip, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StandardDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "@/types/document";

/** Giới hạn của `POST /api/upload`: chặn sớm để báo đúng tên tệp. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const URGENCY_OPTIONS = [
  { value: "THUONG", label: "Thường" },
  { value: "KHAN", label: "Khẩn" },
  { value: "THUONG_KHAN", label: "Thượng khẩn" },
  { value: "HOA_TOC", label: "Hỏa tốc" },
];

/** Ngày nghiệp vụ theo giờ Việt Nam, dạng YYYY-MM-DD cho ô nhập ngày. */
function toDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const errorMessageOf = (json: unknown): string | null => {
  const body = json as { error?: unknown; message?: unknown } | null;
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.message === "string") return body.message;
  return null;
};

interface EditValues {
  summary: string;
  originalNumber: string;
  issuingAuthority: string;
  category: string;
  urgency: string;
  dueDate: string;
  notes: string;
}

const initialValues = (item: DocumentItem): EditValues => ({
  summary: item.summary ?? "",
  originalNumber: item.originalNumber ?? "",
  issuingAuthority: item.issuingAuthority ?? "",
  category: item.category ?? "",
  urgency: (item.urgency as string | undefined) || "THUONG",
  dueDate: toDateInput(item.dueDate),
  notes: item.notes ?? "",
});

/** Sửa thông tin văn bản: chỉ gửi trường đã đổi qua `PATCH /api/documents/[id]` (server kiểm quyền và bất biến). */
export function DocumentEditDialog({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: DocumentItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [values, setValues] = React.useState<EditValues>(() => initialValues(item));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isOutgoing = item.type === "VAN_BAN_DI";

  React.useEffect(() => {
    if (open) {
      setValues(initialValues(item));
      setError(null);
    }
  }, [open, item]);

  const set = (key: keyof EditValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.summary.trim().length < 2) {
      setError("Trích yếu cần ít nhất 2 ký tự.");
      return;
    }
    if (!isOutgoing && (!values.originalNumber.trim() || !values.issuingAuthority.trim())) {
      setError("Số/ký hiệu và cơ quan ban hành không được để trống.");
      return;
    }
    const before = initialValues(item);
    const changes: Record<string, string | null> = {};
    (Object.keys(values) as (keyof EditValues)[]).forEach((key) => {
      if (values[key].trim() !== before[key].trim()) changes[key] = values[key].trim() || null;
    });
    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        setError(errorMessageOf(await res.json().catch(() => null)) ?? "Không lưu được thay đổi. Vui lòng thử lại.");
        return;
      }
      onOpenChange(false);
      onSaved?.();
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StandardDialog compact open={open} onOpenChange={(next) => !saving && onOpenChange(next)} title="Sửa thông tin văn bản" size="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-3 pt-1">
        <FormField label="Trích yếu" required>
          <Textarea value={values.summary} onChange={(e) => set("summary")(e.target.value)} rows={3} maxLength={2000} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          {!isOutgoing ? (
            <FormField label="Số / Ký hiệu" required>
              <Input value={values.originalNumber} onChange={(e) => set("originalNumber")(e.target.value)} maxLength={100} />
            </FormField>
          ) : null}
          {!isOutgoing ? (
            <FormField label="Cơ quan ban hành" required>
              <Input value={values.issuingAuthority} onChange={(e) => set("issuingAuthority")(e.target.value)} maxLength={255} />
            </FormField>
          ) : null}
          <FormField label="Loại văn bản">
            <Input value={values.category} onChange={(e) => set("category")(e.target.value)} maxLength={100} />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Mức khẩn</span>
            <Select
              compact
              positionerClassName="z-[70]"
              aria-label="Mức khẩn"
              options={URGENCY_OPTIONS}
              value={values.urgency}
              onValueChange={(val) => val && set("urgency")(String(val))}
            />
          </div>
          <FormField label="Hạn xử lý" optional>
            <Input type="date" value={values.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Ghi chú" optional>
          <Textarea value={values.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} maxLength={2000} />
        </FormField>
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : null}
            Lưu
          </Button>
        </div>
      </form>
    </StandardDialog>
  );
}

/** Tải một tệp lên rồi gắn vào văn bản. Ném lỗi có thông điệp tiếng Việt khi thất bại. */
export async function attachFileToDocument(documentId: string, file: File): Promise<void> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`"${file.name}" vượt quá 10MB.`);
  const form = new FormData();
  form.append("file", file);
  const uploaded = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
  const uploadedJson = await uploaded.json().catch(() => null);
  if (!uploaded.ok) throw new Error(errorMessageOf(uploadedJson) ?? `Không tải lên được "${file.name}".`);
  const fileId = (uploadedJson as { fileId?: string } | null)?.fileId;
  if (!fileId) throw new Error(`Không tải lên được "${file.name}".`);
  const attached = await fetch(`/api/documents/${documentId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fileId }),
  });
  if (!attached.ok) {
    throw new Error(errorMessageOf(await attached.json().catch(() => null)) ?? `Không gắn được "${file.name}" vào văn bản.`);
  }
}

/**
 * Bổ sung tệp: tải lên `POST /api/upload` rồi gắn vào văn bản qua `POST /api/documents/[id]/attachments`.
 * Trả về ô chọn tệp ẩn (phải được dựng), hàm mở hộp chọn tệp và trạng thái; dùng cho nút và mục menu.
 */
export function useAddDocumentFiles(documentId: string, onAdded?: () => void) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function addFiles(files: File[]) {
    setBusy(true);
    setError(null);
    let added = 0;
    try {
      for (const file of files) {
        await attachFileToDocument(documentId, file);
        added += 1;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không bổ sung được tệp. Vui lòng thử lại.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      if (added > 0) onAdded?.();
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      hidden
      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) void addFiles(files);
      }}
    />
  );

  return { input, open: () => inputRef.current?.click(), busy, error };
}

/** Nút bổ sung tệp; `children` là nhãn nút (thanh thao tác ở Full Page, trạng thái chưa có tệp). */
export function AddDocumentFileButton({
  documentId,
  onAdded,
  className,
  children = "Thêm tệp",
}: {
  documentId: string;
  onAdded?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const { input, open, busy, error } = useAddDocumentFiles(documentId, onAdded);
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      {input}
      <Button variant="ghost" size="sm" disabled={busy} onClick={open}>
        {busy ? <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} /> : <Paperclip className="size-3.5" strokeWidth={1.5} />}
        {busy ? "Đang tải lên…" : children}
      </Button>
      {error ? <span role="alert" className="pt-1 text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

/** Thao tác phụ (sau thao tác theo bước): sửa thông tin, bổ sung tệp. Chỉ hiện khi server cho phép. */
export function DocumentEditActions({ item, onChanged }: { item: DocumentItem | null; onChanged?: () => void }) {
  const [editing, setEditing] = React.useState(false);
  if (!item?.canEdit) return null;
  return (
    <div className="-ml-2 flex flex-wrap items-start gap-1" role="group" aria-label="Chỉnh sửa văn bản">
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" strokeWidth={1.5} />
        Sửa thông tin
      </Button>
      <AddDocumentFileButton documentId={item.id} onAdded={onChanged} />
      <DocumentEditDialog item={item} open={editing} onOpenChange={setEditing} onSaved={onChanged} />
    </div>
  );
}
