"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { OfficialDocument } from "@/types/document";
import type { DocumentAuditApiResponse, DocumentTimelineStep } from "@/types/document-audit";
import { cn } from "@/lib/utils";
import { fetchDocumentAuditTimeline, isEmptyTimeline } from "@/lib/documents/audit-timeline-client";
import { formatShortDateTime } from "@/lib/documents/incoming-workflow";

export type {
  DocumentTimelineStep,
  DocumentAuditLogItem,
  DocumentAuditApiResponse,
} from "@/types/document-audit";

export interface DocumentAuditTimelineProps {
  documentId: string;
  /** Giữ để tương thích; không dùng để dựng lịch sử. Lịch sử chỉ lấy từ API. */
  initialDoc?: OfficialDocument | null;
  className?: string;
  /** Giữ để tương thích: timeline luôn nằm trong một phân mục đã có tiêu đề riêng. */
  bare?: boolean;
  /** Đổi giá trị (ví dụ bước xử lý) để tải lại lịch sử sau một thao tác. */
  refreshKey?: unknown;
}

const DOT: Record<DocumentTimelineStep["status"], string> = {
  completed: "bg-foreground/70",
  current: "bg-background ring-[1.5px] ring-primary",
  pending: "bg-background ring-1 ring-border",
  rejected: "bg-destructive",
};

/**
 * Luân chuyển của văn bản: mỗi bước một dòng (tiêu đề, thời điểm), dòng phụ chỉ cho bước đã làm
 * hoặc đang làm (người thực hiện, đơn vị, ghi chú). Nhật ký thao tác chi tiết thu gọn bên dưới.
 */
export function DocumentAuditTimeline({ documentId, className, refreshKey }: DocumentAuditTimelineProps) {
  const [timelineData, setTimelineData] = React.useState<DocumentAuditApiResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showLogs, setShowLogs] = React.useState<boolean>(false);

  const abortRef = React.useRef<AbortController | null>(null);

  const fetchTimeline = React.useCallback(async () => {
    if (!documentId) return;
    // Hủy yêu cầu trước để kết quả cũ không ghi đè lịch sử của văn bản/lần thử mới.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const result = await fetchDocumentAuditTimeline(documentId, fetch, controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok) {
      setTimelineData(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [documentId]);

  // Đổi văn bản: bỏ lịch sử cũ ngay. Tải lại cùng văn bản (refreshKey) thì giữ nội dung trong lúc chờ.
  React.useEffect(() => {
    setTimelineData(null);
  }, [documentId]);

  React.useEffect(() => {
    fetchTimeline();
    return () => abortRef.current?.abort();
  }, [fetchTimeline, refreshKey]);

  const steps = timelineData?.steps ?? [];
  const auditLogs = timelineData?.auditLogs ?? [];

  return (
    <div className={cn("pb-1", className)} data-slot="document-audit-timeline">
      {loading && !timelineData ? (
        <div className="space-y-2.5 py-1 motion-safe:animate-pulse" aria-label="Đang tải luân chuyển">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-muted" />
              <span className="h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : null}

      {error && !timelineData ? (
        <p role="alert" className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
          Không tải được luân chuyển.
          <button
            type="button"
            onClick={fetchTimeline}
            className="cursor-pointer rounded-sm text-foreground underline decoration-border underline-offset-3 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Thử lại
          </button>
        </p>
      ) : null}

      {timelineData && isEmptyTimeline(timelineData) ? (
        <p className="py-1 text-compact text-muted-foreground">Chưa có lịch sử luân chuyển.</p>
      ) : null}

      {timelineData && !isEmptyTimeline(timelineData) ? (
        <ol>
          {steps.map((step, index) => {
            const done = step.status === "completed";
            const current = step.status === "current";
            const active = done || current || step.status === "rejected";
            const who = [step.actorName, step.departmentName, step.assignedToName ? `Chủ trì: ${step.assignedToName}` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={step.id || step.key} className="relative flex gap-3 pb-3 last:pb-0">
                {index < steps.length - 1 ? (
                  <span aria-hidden className="absolute bottom-0 left-[3.5px] top-4 w-px bg-border" />
                ) : null}
                <span aria-hidden className={cn("relative mt-[5px] size-2 shrink-0 rounded-full", DOT[step.status])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-compact",
                        current ? "font-medium text-foreground" : active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                    {current ? <span className="shrink-0 text-xs text-primary">Đang thực hiện</span> : null}
                    {step.timestamp ? (
                      <time dateTime={step.timestamp} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatShortDateTime(step.timestamp)}
                      </time>
                    ) : null}
                  </div>
                  {active && who ? <p className="mt-0.5 text-xs text-muted-foreground">{who}</p> : null}
                  {active && step.notes ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{step.notes}</p> : null}
                  {current && step.deadline ? (
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">Hạn {formatShortDateTime(step.deadline)}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {auditLogs.length > 0 ? (
        <Collapsible.Root open={showLogs} onOpenChange={setShowLogs} className="mt-3">
          <Collapsible.Trigger className="-mx-1 inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className={cn("size-3 transition-transform motion-reduce:transition-none", showLogs && "rotate-90")} strokeWidth={1.5} aria-hidden />
            Nhật ký thao tác
            <span className="tabular-nums">{auditLogs.length}</span>
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <ul className="space-y-2 pt-1">
              {auditLogs.map((log) => (
                <li key={log.id} className="text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 text-foreground">{log.actionLabel}</span>
                    <time dateTime={log.timestamp} className="shrink-0 tabular-nums text-muted-foreground">
                      {formatShortDateTime(log.timestamp)}
                    </time>
                  </div>
                  <p className="text-muted-foreground">
                    {log.actorName}
                    {log.notes ? ` · ${log.notes}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      ) : null}
    </div>
  );
}
