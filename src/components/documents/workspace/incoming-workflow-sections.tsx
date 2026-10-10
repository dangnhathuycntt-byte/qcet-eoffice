"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const actions = getIncomingActions(status, role);
  if (actions.length === 0) return null;

  const primaryIndex = actions.findIndex((a) => !a.destructive);

  async function run(key: string, body: Record<string, unknown>, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    setPending(key);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }));
        window.alert(err.error ?? "Thao tác thất bại");
        return;
      }
      onDone?.();
    } catch {
      window.alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Thao tác xử lý văn bản">
      {actions.map((action, i) => (
        <Button
          key={action.key}
          size="sm"
          variant={i === primaryIndex ? "default" : "ghost"}
          className={cn(action.destructive && "text-destructive hover:text-destructive")}
          disabled={pending !== null}
          onClick={() => run(action.key, action.body, action.confirmMsg)}
        >
          {pending === action.key ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : null}
          {action.label}
        </Button>
      ))}
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
