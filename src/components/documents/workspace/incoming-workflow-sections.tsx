"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirmAction } from "@/components/ui/confirm-host";
import { useDepartmentList } from "@/hooks/use-department-list";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "@/types/document";
import { formatLedgerDate } from "@/lib/documents/document-ledger-format";
import { buildIncomingQuotes, formatShortDateTime, getIncomingActions } from "@/lib/documents/incoming-workflow";
import { InspectorRow, SectionHeading } from "../document-detail-parts";

/** Thao tác theo bước của văn bản đến; hiện theo vai trò, server kiểm quyền khi thực thi. */
export function IncomingWorkflowActions({
  documentId,
  status,
  onDone,
}: {
  documentId: string;
  status: string;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const [pending, setPending] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ key: string; input: "reason" | "unit" | "person" } | null>(null);
  const [reason, setReason] = React.useState("");
  const [unitId, setUnitId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [driUserId, setDriUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { departments, isLoading: isDepartmentsLoading } = useDepartmentList({ enabled: form?.input === "unit" });
  const { personnel, isLoading: isPersonnelLoading } = usePersonnelList({ enabled: form?.input === "person" });
  const actions = getIncomingActions(status, role);
  if (actions.length === 0) return null;

  const primaryIndex = actions.findIndex((a) => !a.destructive);

  async function post(key: string, body: Record<string, unknown>): Promise<boolean> {
    setPending(key);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.detail || err?.error || "Thao tác thất bại");
        return false;
      }
      onDone?.();
      return true;
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function run(action: (typeof actions)[number]) {
    if (action.input) {
      setForm({ key: action.key, input: action.input });
      setError(null);
      return;
    }
    if (!(await confirmAction({ title: action.confirmMsg, confirmLabel: action.label }))) return;
    await post(action.key, action.body);
  }

  async function submitForm() {
    if (!form) return;
    const body =
      form.input === "reason"
        ? { reason: reason.trim() }
        : form.input === "person"
          ? { driUserId, instruction: note.trim() || undefined }
          : { leadUnitId: unitId, note: note.trim() || undefined };
    if (await post(form.key, body)) {
      setForm(null);
      setReason("");
      setUnitId(null);
      setDriUserId(null);
      setNote("");
    }
  }

  const formReady = form?.input === "reason" ? reason.trim().length >= 3 : form?.input === "person" ? Boolean(driUserId) : Boolean(unitId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Thao tác xử lý văn bản">
        {actions.map((action, i) => (
          <Button
            key={action.key}
            size="sm"
            variant={i === primaryIndex ? "default" : "ghost"}
            className={cn(action.destructive && "text-destructive hover:text-destructive")}
            disabled={pending !== null}
            onClick={() => void run(action)}
          >
            {pending === action.key ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : null}
            {action.label}
          </Button>
        ))}
      </div>

      {form?.input === "reason" && (
        <div className="space-y-1.5">
          <Textarea
            compact
            value={reason}
            maxLength={1000}
            aria-label="Lý do trả lại"
            placeholder="Lý do trả lại (bắt buộc)"
            onChange={(e) => setReason(e.target.value)}
            className="min-h-16"
          />
        </div>
      )}
      {form?.input === "unit" && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Đơn vị nhận văn bản"
            placeholder={isDepartmentsLoading ? "Đang tải danh sách đơn vị..." : "— Chọn đơn vị nhận —"}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            value={unitId}
            onValueChange={(val) => setUnitId(val || null)}
          />
          <Textarea
            compact
            value={note}
            maxLength={1000}
            aria-label="Ghi chú chuyển đơn vị"
            placeholder="Ghi chú (không bắt buộc)"
            onChange={(e) => setNote(e.target.value)}
            className="min-h-12"
          />
        </div>
      )}
      {form?.input === "person" && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Người xử lý văn bản"
            placeholder={isPersonnelLoading ? "Đang tải danh sách..." : "— Chọn người xử lý —"}
            options={personnel.map((p) => ({ value: p.id, label: p.name }))}
            value={driUserId}
            onValueChange={(val) => setDriUserId(val || null)}
          />
          <Textarea
            compact
            value={note}
            maxLength={1000}
            aria-label="Ý kiến phân công"
            placeholder="Ý kiến phân công (không bắt buộc)"
            onChange={(e) => setNote(e.target.value)}
            className="min-h-12"
          />
        </div>
      )}
      {form && (
        <div className="flex gap-1.5">
          <Button size="xs" disabled={pending !== null || !formReady} onClick={() => void submitForm()}>
            {form.input === "reason" ? "Trả lại văn bản" : form.input === "person" ? "Phân công" : "Chuyển văn bản"}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => { setForm(null); setError(null); }}>
            Hủy
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Thuộc tính quy trình văn bản đến (chưa có ở tiêu đề): nhãn, giá trị, có dùng font mono. */
export function getIncomingAttributes(item: DocumentItem): [string, React.ReactNode, boolean][] {
  const wf = (item.incomingWorkflow ?? {}) as {
    resolutionSummary?: string | null;
    dossierId?: string | null;
    unitAssignments?: { driUser?: { name?: string | null } | null }[];
  };
  const assignees = (wf.unitAssignments ?? []).map((a) => a.driUser?.name).filter(Boolean).join(", ");
  // Số đến, hạn xử lý, mức khẩn đã nằm ở tiêu đề và dòng trạng thái: không lặp lại ở đây.
  const attributes: [string, React.ReactNode, boolean][] = [
    ["Ngày đến", formatLedgerDate(item.registeredDate), false],
    ["Loại văn bản", item.category, false],
    ["Chủ trì", item.leadUnitName, false],
    ["Phụ trách", assignees, false],
    ["Kết quả", wf.resolutionSummary, false],
    ["Hồ sơ lưu", wf.dossierId, true],
  ];
  return attributes.filter(([, value]) => Boolean(value));
}

/** Ý kiến chỉ đạo của văn bản đến; không có thì không dựng gì. */
export function IncomingDirectives({ item }: { item: DocumentItem }) {
  const quotes = buildIncomingQuotes(item);
  if (quotes.length === 0) return null;
  return (
    <section aria-label="Ý kiến chỉ đạo">
      <SectionHeading count={quotes.length}>Ý kiến chỉ đạo</SectionHeading>
      <div className="space-y-3">
        {quotes.map((q) => (
          <figure key={q.id} className="border-l-2 border-border pl-3">
            {q.text ? <blockquote className="text-compact leading-relaxed text-foreground">{q.text}</blockquote> : null}
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {q.who}
              {q.at ? <> · <span className="tabular-nums">{formatShortDateTime(q.at)}</span></> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * Thuộc tính (chỉ những gì chưa có ở tiêu đề) và ý kiến chỉ đạo. Luân chuyển dùng chung
 * `DocumentAuditTimeline` (dữ liệu từ server) nên không dựng thêm danh sách bước ở đây.
 */
export function IncomingWorkflowDetails({ item }: { item: DocumentItem }) {
  const visibleAttributes = getIncomingAttributes(item);
  return (
    <>
      {visibleAttributes.length > 0 ? (
        <section aria-label="Thuộc tính">
          <SectionHeading>Thuộc tính</SectionHeading>
          <div className="pb-1">
            {visibleAttributes.map(([label, value, mono]) => (
              <InspectorRow key={label} label={label} mono={mono}>{value}</InspectorRow>
            ))}
          </div>
        </section>
      ) : null}
      <IncomingDirectives item={item} />
    </>
  );
}
