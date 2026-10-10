"use client";

import * as React from "react";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "@/types/document";
import type { LedgerStepKind } from "@/lib/documents/document-ledger-format";
import { formatLedgerDate } from "@/lib/documents/document-ledger-format";
import { buildIncomingQuotes } from "@/lib/documents/incoming-workflow";
import { type DocumentViewModel } from "@/lib/documents/document-view-model";
import { CreateTaskModal } from "@/components/tasks/create/create-task-modal";
import { DocumentAuditTimeline } from "../document-audit-timeline";
import { OutgoingActionPanel } from "../outgoing-action-panel";
import { OutgoingRecipientsPanel } from "../outgoing-recipients-panel";
import { IncomingDirectives, IncomingWorkflowActions, IncomingWorkflowDetails, getIncomingAttributes } from "./incoming-workflow-sections";
import { SubmissionApprovalPanel } from "./submission-approval-panel";
import { DocumentEditActions } from "./document-edit";
import { OutgoingWorkflowStepper } from "../outgoing-workflow-stepper";
import { CollapsibleSection, DetailsPopover, DocumentTitleBlock, InspectorRow, LinkedTaskSection, MetaInline, SectionHeading } from "../document-detail-parts";

const STEP_STATUS: Record<LedgerStepKind, string> = {
  new: "NOT_STARTED",
  progress: "IN_PROGRESS",
  review: "WAITING_APPROVAL",
  done: "COMPLETED",
};

/** Thuộc tính đã hiện ở dòng metadata của tiêu đề: không lặp lại ở mục "Thông tin" (SPEC §17.3, ý 4). */
const SUMMARY_LABELS = new Set(["Cơ quan ban hành", "Ngày ban hành", "Mức khẩn"]);

function SummaryMeta({ vm, details }: { vm: DocumentViewModel; details?: React.ReactNode }) {
  const authority = vm.detailRows.find((row) => row.label === "Cơ quan ban hành")?.value;
  const issued = vm.detailRows.find((row) => row.label === "Ngày ban hành")?.value;
  return (
    <div className="flex flex-col gap-1">
      <MetaInline
        items={[
          authority ? <span key="authority" className="text-foreground/80">{authority}</span> : null,
          vm.documentNumber ? <span key="number" className="font-mono">{vm.documentNumber}</span> : null,
          issued ? <span key="issued" className="tabular-nums">Ban hành {issued}</span> : null,
        ]}
      />
      <MetaInline
        items={[
          <span key="status" className="inline-flex items-center gap-1.5 text-foreground">
            <TaskStatusCircle status={STEP_STATUS[vm.step.kind]} />
            {vm.step.label}
          </span>,
          vm.urgency ? (
            <span key="urgency" className={cn("font-medium", vm.urgency.tone === "danger" ? "text-destructive" : "text-warning")}>
              {vm.urgency.label}
            </span>
          ) : null,
          vm.dueDate ? (
            <span key="due" className="tabular-nums">
              Hạn {formatLedgerDate(vm.dueDate)}
            </span>
          ) : null,
          // Cùng nhãn và màu với cột hạn trong danh sách (`getLedgerDueNote`)
          vm.dueDate && vm.dueNote ? (
            <span
              key="due-note"
              className={cn(
                "tabular-nums",
                vm.dueNote.tone === "danger" ? "font-medium text-destructive" : vm.dueNote.tone === "warning" ? "text-warning" : undefined,
              )}
            >
              {vm.dueNote.text}
            </span>
          ) : null,
          details,
        ]}
      />
    </div>
  );
}

/** Hạn xử lý kèm ghi chú cùng nhãn và màu với cột hạn của bảng (`getLedgerDueNote`). */
function DueValue({ vm }: { vm: DocumentViewModel }) {
  if (!vm.dueDate) return null;
  return (
    <span className="tabular-nums">
      {formatLedgerDate(vm.dueDate)}
      {vm.dueNote ? (
        <>
          <span aria-hidden className="px-1.5 text-muted-foreground/50">·</span>
          <span
            className={cn(
              vm.dueNote.tone === "danger" ? "font-medium text-destructive" : vm.dueNote.tone === "warning" ? "text-warning" : "text-muted-foreground",
            )}
          >
            {vm.dueNote.text}
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Thuộc tính chính ở Quick View: lưới nhãn–giá trị căn thẳng (thay hai dòng metadata không nhãn).
 * Pane rộng chia hai cột, hẹp một cột; trường trống không hiện.
 */
function QuickProperties({ vm }: { vm: DocumentViewModel }) {
  const authority = vm.detailRows.find((row) => row.label === "Cơ quan ban hành")?.value;
  const issued = vm.detailRows.find((row) => row.label === "Ngày ban hành")?.value;
  const cells: [string, React.ReactNode][] = [
    [
      "Trạng thái",
      <span key="status" className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5">
        <TaskStatusCircle status={STEP_STATUS[vm.step.kind]} />
        {vm.step.label}
        {vm.urgency ? (
          <span className={cn("text-xs font-medium", vm.urgency.tone === "danger" ? "text-destructive" : "text-warning")}>{vm.urgency.label}</span>
        ) : null}
      </span>,
    ],
    ["Hạn xử lý", vm.dueDate ? <DueValue key="due" vm={vm} /> : null],
    ["Số, ký hiệu", vm.documentNumber ? <span key="number" className="tabular-nums">{vm.documentNumber}</span> : null],
    ["Ban hành", issued ? <span key="issued" className="tabular-nums">{issued}</span> : null],
    ["Cơ quan ban hành", authority || null],
  ];
  return (
    <div role="group" aria-label="Thuộc tính chính" className="grid grid-cols-1 gap-x-6 @[560px]/doc:grid-cols-2" data-slot="quick-properties">
      {cells
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([label, value]) => (
          <InspectorRow key={label} label={label} wide>
            {value}
          </InspectorRow>
        ))}
    </div>
  );
}

/**
 * Trích yếu ở Quick View: 16/24px, tối đa 2 dòng; "Xem thêm" chỉ hiện khi thực sự bị cắt.
 * Focus được bằng chương trình (→ trên dòng đang xem trong danh sách chuyển tới đây).
 */
function QuickTitle({ title }: { title: string }) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [overflowing, setOverflowing] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded || typeof ResizeObserver === "undefined") return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, title]);
  return (
    <div>
      <h2
        ref={ref}
        tabIndex={-1}
        data-slot="document-quick-title"
        className={cn(
          "break-words font-sans text-base leading-6 font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          !expanded && "line-clamp-2",
        )}
      >
        {title}
      </h2>
      {overflowing || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="-mx-1 mt-0.5 h-6 cursor-pointer rounded-md px-1 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Tiêu đề (trích yếu) và dòng metadata: dùng chung cho Quick View và Full Page.
 * `variant="quick"`: tiêu đề gọn tối đa 2 dòng, thuộc tính phụ nằm ở mục "Thông tin" thay cho popover "Chi tiết".
 */
export function DocumentSummaryBlock({ vm, titleAs, variant = "full" }: { vm: DocumentViewModel; titleAs?: React.ElementType; variant?: "full" | "quick" }) {
  if (variant === "quick") {
    return (
      <header className="space-y-2">
        {/* Đổi văn bản đưa tiêu đề về trạng thái thu gọn */}
        <QuickTitle key={vm.id} title={vm.title} />
        <QuickProperties vm={vm} />
      </header>
    );
  }
  return (
    <DocumentTitleBlock
      titleAs={titleAs}
      title={vm.title}
      meta={<SummaryMeta vm={vm} details={<DetailsPopover key="details" rows={vm.detailRows} />} />}
    />
  );
}

/** Mục "Thông tin" của Quick View: thuộc tính còn lại, ý kiến chỉ đạo và luân chuyển/quy trình, thu gọn mặc định. */
function QuickInfoSection({ vm, item, outgoingStatus }: { vm: DocumentViewModel; item: DocumentItem | null; outgoingStatus: string }) {
  const rows = vm.detailRows.filter((row) => !SUMMARY_LABELS.has(row.label));
  const shown = new Set(rows.map((row) => row.label));
  const incomingRows = vm.kind === "incoming" && item ? getIncomingAttributes(item).filter(([label]) => !shown.has(label)) : [];
  const directives = vm.kind === "incoming" && item ? buildIncomingQuotes(item).length : 0;
  return (
    <CollapsibleSection title="Chi tiết và luân chuyển" summary={directives > 0 ? `· ${directives} ý kiến chỉ đạo` : undefined}>
      <div className="space-y-3">
        {rows.length + incomingRows.length > 0 ? (
          <div aria-label="Thuộc tính" role="group">
            {rows.map((row) => (
              <InspectorRow key={row.label} label={row.label} mono={row.mono}>{row.value}</InspectorRow>
            ))}
            {incomingRows.map(([label, value, mono]) => (
              <InspectorRow key={label} label={label} mono={mono}>{value}</InspectorRow>
            ))}
          </div>
        ) : null}
        {vm.kind === "incoming" && item ? <IncomingDirectives item={item} /> : null}
        {vm.kind === "outgoing" ? (
          <section aria-label="Quy trình xử lý">
            <SectionHeading>Quy trình xử lý</SectionHeading>
            <OutgoingWorkflowStepper
              workflow={{ status: outgoingStatus, createdAt: (item as { createdAt?: string } | null)?.createdAt ?? null } as never}
              className="border-0 bg-transparent p-0 [&>h3]:sr-only"
            />
          </section>
        ) : (
          <section aria-label="Luân chuyển">
            <SectionHeading>Luân chuyển</SectionHeading>
            {/* Mục "Thông tin" chỉ dựng nội dung khi mở nên nhật ký cũng chỉ tải lúc đó */}
            <DocumentAuditTimeline documentId={vm.id} refreshKey={item?.workflowStatus ?? vm.step.label} />
          </section>
        )}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Phần thông tin theo loại văn bản: thao tác (văn bản đi), nhiệm vụ liên kết, luân chuyển/quy trình.
 * Dùng chung cho Quick View (`variant="quick"`) và panel thông tin ở Full Page.
 * Khi chi tiết còn đang tải (`item` null), không dựng thao tác nào từ dữ liệu dòng danh sách.
 */
export function DocumentInfoSections({
  vm,
  item,
  onWorkflowUpdate,
  variant = "full",
}: {
  vm: DocumentViewModel;
  item: DocumentItem | null;
  onWorkflowUpdate?: () => void;
  variant?: "full" | "quick";
}) {
  const outgoingStatus = (item?.outgoingWorkflow as { status?: string } | null | undefined)?.status ?? "DRAFT";
  const incomingStatus = (item?.incomingWorkflow as { status?: string } | null | undefined)?.status ?? null;
  const isIncoming = vm.kind === "incoming" && item !== null;

  if (variant === "quick") {
    return (
      <>
        {/* Nhiệm vụ liên kết là dòng cuối của lưới thuộc tính (cùng cột nhãn) */}
        <LinkedTaskCreateSection vm={vm} onLinked={onWorkflowUpdate} inline />
        {vm.kind === "submission" && item ? <SubmissionApprovalPanel key={vm.id} documentId={vm.id} onChanged={onWorkflowUpdate} /> : null}
        {vm.kind === "outgoing" && item ? (
          <OutgoingActionPanel
            documentId={vm.id}
            status={outgoingStatus as never}
            currentUserId=""
            className="border-0 bg-transparent p-0 [&>h3]:sr-only"
            onActionSuccess={onWorkflowUpdate}
          />
        ) : null}
        {vm.kind === "outgoing" && item ? <OutgoingRecipientsPanel key={vm.id} documentId={vm.id} onChanged={onWorkflowUpdate} /> : null}
        {/* Chỉ thao tác theo bước ở thân; sửa thông tin/bổ sung tệp nằm trong menu "Thao tác khác" của header */}
        {isIncoming && incomingStatus ? (
          <IncomingWorkflowActions documentId={vm.id} status={incomingStatus} onDone={onWorkflowUpdate} />
        ) : null}
        <QuickInfoSection key={vm.id} vm={vm} item={item} outgoingStatus={outgoingStatus} />
      </>
    );
  }

  return (
    <>
      {vm.kind === "submission" && item ? <SubmissionApprovalPanel key={vm.id} documentId={vm.id} onChanged={onWorkflowUpdate} /> : null}

      {vm.kind === "outgoing" && item ? (
        <OutgoingActionPanel
          documentId={vm.id}
          status={outgoingStatus as never}
          currentUserId=""
          className="border-0 bg-transparent p-0 [&>h3]:sr-only"
          onActionSuccess={onWorkflowUpdate}
        />
      ) : null}

      {vm.kind === "outgoing" && item ? <OutgoingRecipientsPanel key={vm.id} documentId={vm.id} onChanged={onWorkflowUpdate} /> : null}

      {isIncoming && incomingStatus ? (
        <IncomingWorkflowActions documentId={vm.id} status={incomingStatus} onDone={onWorkflowUpdate} />
      ) : null}

      <DocumentEditActions item={item} onChanged={onWorkflowUpdate} />

      <LinkedTaskCreateSection vm={vm} onLinked={onWorkflowUpdate} />

      {vm.kind === "outgoing" ? (
        <CollapsibleSection title="Quy trình xử lý" summary={vm.step.label}>
          <OutgoingWorkflowStepper
            workflow={{ status: outgoingStatus, createdAt: (item as { createdAt?: string } | null)?.createdAt ?? null } as never}
            className="border-0 bg-transparent p-0 [&>h3]:sr-only"
          />
        </CollapsibleSection>
      ) : (
        <>
          {isIncoming && item ? <IncomingWorkflowDetails item={item} /> : null}
          <CollapsibleSection title="Luân chuyển">
            <DocumentAuditTimeline documentId={vm.id} refreshKey={item?.workflowStatus ?? vm.step.label} />
          </CollapsibleSection>
        </>
      )}
    </>
  );
}

/**
 * Nhiệm vụ liên kết. "Tạo nhiệm vụ" mở đúng form tạo nhiệm vụ (không chuyển sang Kho việc),
 * sau đó gắn nhiệm vụ mới vào văn bản qua API cập nhật văn bản (server kiểm quyền liên kết).
 * Tạo xong mà gắn thất bại: giữ nhiệm vụ vừa tạo để gắn lại, không đưa người dùng tạo nhiệm vụ trùng.
 */
function LinkedTaskCreateSection({ vm, onLinked, inline }: { vm: DocumentViewModel; onLinked?: () => void; inline?: boolean }) {
  const [creating, setCreating] = React.useState(false);
  const [unlinkedTaskId, setUnlinkedTaskId] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState(false);
  const canCreate = vm.kind !== "outgoing";

  const link = React.useCallback(
    async (taskId: string) => {
      setLinking(true);
      try {
        const res = await fetch(`/api/documents/${vm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ linkedTaskId: taskId }),
        });
        if (!res.ok) {
          setUnlinkedTaskId(taskId);
          return;
        }
        setUnlinkedTaskId(null);
        onLinked?.();
      } catch {
        setUnlinkedTaskId(taskId);
      } finally {
        setLinking(false);
      }
    },
    [vm.id, onLinked],
  );

  // Đổi văn bản: lỗi gắn của văn bản trước không còn liên quan
  React.useEffect(() => setUnlinkedTaskId(null), [vm.id]);

  const error = unlinkedTaskId ? (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span>Đã tạo nhiệm vụ nhưng chưa gắn được vào văn bản.</span>
      <button
        type="button"
        disabled={linking}
        onClick={() => void link(unlinkedTaskId)}
        className="cursor-pointer rounded-sm text-foreground underline decoration-border underline-offset-3 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {linking ? "Đang gắn…" : "Gắn lại"}
      </button>
      <a
        href={`/tasks/${unlinkedTaskId}`}
        className="rounded-sm text-foreground underline decoration-border underline-offset-3 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Mở nhiệm vụ vừa tạo
      </a>
    </span>
  ) : null;

  return (
    <>
      <LinkedTaskSection
        inline={inline}
        hideWhenEmpty={vm.kind === "outgoing"}
        onCreate={canCreate && !unlinkedTaskId ? () => setCreating(true) : undefined}
        task={vm.linkedTask}
        error={error}
      />
      {canCreate && creating ? (
        <CreateTaskModal
          isOpen
          onClose={() => setCreating(false)}
          initialTitle={vm.title}
          onCreated={(created) => void link(created.id)}
        />
      ) : null}
    </>
  );
}
