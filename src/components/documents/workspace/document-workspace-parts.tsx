"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "@/types/document";
import type { LedgerStepKind } from "@/lib/documents/document-ledger-format";
import { formatLedgerDate } from "@/lib/documents/document-ledger-format";
import { type DocumentViewModel, type ViewFile } from "@/lib/documents/document-view-model";
import {
  parseFilesListPreference,
  resolveFilesListOpen,
  type FilesListPreference,
} from "@/lib/documents/file-viewer-state";
import { DocumentAuditTimeline } from "../document-audit-timeline";
import { OutgoingActionPanel } from "../outgoing-action-panel";
import { OutgoingWorkflowStepper } from "../outgoing-workflow-stepper";
import { AttachmentRow, CollapsibleSection, DetailsPopover, DocumentTitleBlock, LinkedTaskSection, MetaInline } from "../document-detail-parts";

const STEP_STATUS: Record<LedgerStepKind, string> = {
  new: "NOT_STARTED",
  progress: "IN_PROGRESS",
  review: "WAITING_APPROVAL",
  done: "COMPLETED",
};

/** Tiêu đề (trích yếu) và dòng metadata: dùng chung cho Quick View và Full Page. */
export function DocumentSummaryBlock({ vm, titleAs }: { vm: DocumentViewModel; titleAs?: React.ElementType }) {
  return (
    <DocumentTitleBlock
      titleAs={titleAs}
      title={vm.title}
      meta={
        <MetaInline
          items={[
            <span key="status" className="inline-flex items-center gap-1.5 text-foreground">
              <TaskStatusCircle status={STEP_STATUS[vm.step.kind]} />
              {vm.step.label}
            </span>,
            vm.urgency ? (
              <span key="urgency" className={cn("font-medium", vm.urgency.tone === "danger" ? "text-destructive" : "text-foreground")}>
                {vm.urgency.label}
              </span>
            ) : null,
            vm.dueDate ? (
              <span key="due" className="tabular-nums">
                Hạn {formatLedgerDate(vm.dueDate)}
                {vm.dueNote ? (
                  <span className={cn("ml-1", vm.dueNote.tone === "danger" ? "text-destructive" : "text-muted-foreground")}>
                    {vm.dueNote.text.charAt(0).toLowerCase() + vm.dueNote.text.slice(1)}
                  </span>
                ) : null}
              </span>
            ) : null,
            vm.documentNumber ? <span key="number" className="font-mono">{vm.documentNumber}</span> : null,
            <DetailsPopover key="details" rows={vm.detailRows} />,
          ]}
        />
      }
    />
  );
}

/**
 * Phần thông tin theo loại văn bản: thao tác (văn bản đi), nhiệm vụ liên kết, luân chuyển/quy trình.
 * Dùng chung cho Quick View và panel thông tin ở Full Page.
 */
export function DocumentInfoSections({
  vm,
  item,
  onWorkflowUpdate,
}: {
  vm: DocumentViewModel;
  item: DocumentItem | null;
  onWorkflowUpdate?: () => void;
}) {
  const outgoingStatus = (item?.outgoingWorkflow as { status?: string } | null | undefined)?.status ?? "DRAFT";
  return (
    <>
      {vm.kind === "outgoing" && item ? (
        <OutgoingActionPanel
          documentId={vm.id}
          status={outgoingStatus as never}
          currentUserId=""
          className="border-0 bg-transparent p-0 [&>h3]:sr-only"
          onActionSuccess={onWorkflowUpdate}
        />
      ) : null}

      <LinkedTaskSection
        hideWhenEmpty={vm.kind === "outgoing"}
        createHref={vm.kind === "outgoing" ? undefined : "/tasks"}
        task={vm.linkedTask}
      />

      {vm.kind === "outgoing" ? (
        <CollapsibleSection title="Quy trình xử lý" summary={vm.step.label}>
          <OutgoingWorkflowStepper
            workflow={{ status: outgoingStatus, createdAt: (item as { createdAt?: string } | null)?.createdAt ?? null } as never}
            className="border-0 bg-transparent p-0 [&>h3]:sr-only"
          />
        </CollapsibleSection>
      ) : (
        <CollapsibleSection title="Luân chuyển và lịch sử">
          <DocumentAuditTimeline documentId={vm.id} bare />
        </CollapsibleSection>
      )}
    </>
  );
}

const FILES_PREF_KEY = "qcet_document_files_pref";

function readFilesPref(): FilesListPreference | null {
  try {
    return parseFilesListPreference(localStorage.getItem(FILES_PREF_KEY));
  } catch {
    return null;
  }
}

/**
 * Danh sách tệp đính kèm ở Quick View, thu gọn được (D15): mở khi ≤ 5 tệp, thu gọn khi nhiều hơn,
 * lựa chọn của người dùng được nhớ. Chọn một dòng để chuyển tệp trong trình xem bên dưới.
 */
export function AttachedFilesSection({
  files,
  activeId,
  onSelect,
}: {
  files: ViewFile[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [preference, setPreference] = React.useState<FilesListPreference | null>(null);
  React.useEffect(() => setPreference(readFilesPref()), []);
  const open = resolveFilesListOpen(files.length, preference);
  const toggle = (next: boolean) => {
    const value: FilesListPreference = next ? "open" : "closed";
    setPreference(value);
    try {
      localStorage.setItem(FILES_PREF_KEY, value);
    } catch {
      // Không lưu được lựa chọn: vẫn dùng được trong phiên này
    }
  };
  if (files.length < 2) return null;
  return (
    <Collapsible.Root open={open} onOpenChange={toggle} className="group/sec" data-slot="attached-files">
      <Collapsible.Trigger className="-mx-2 flex h-8 w-[calc(100%+1rem)] cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight className="size-3.5 shrink-0 transition-transform duration-150 group-data-[open]/sec:rotate-90 motion-reduce:transition-none" strokeWidth={1.5} aria-hidden />
        <span className="text-foreground/90">Tệp đính kèm</span>
        <span className="font-normal tabular-nums">{files.length}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="pt-1">
        {files.map((file) => (
          <AttachmentRow
            key={file.id}
            fileName={file.name}
            fileUrl={file.url}
            fileSize={file.sizeBytes}
            selected={file.id === activeId}
            onSelect={() => onSelect(file.id)}
          />
        ))}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
