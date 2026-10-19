"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ListPlus, Minus } from "lucide-react";
import type { AssistantTaskProposal } from "@qcet/contracts/assistant";
import { formatDisplayDate } from "@qcet/shared/lib/format/date";
import { Button } from "@/components/ui/button";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import type { AssistantProposalTask } from "@/components/assistant/assistant-model";

/** Số việc con hiện trên thẻ; còn lại gộp thành "và n việc con khác" (hộp tạo nhiệm vụ có đủ). */
const SHOWN_SUBTASKS = 5;

/**
 * Thẻ đề xuất nhiệm vụ dưới câu trả lời (propose_task, ADR-010), theo mẫu xem trước hành động của agent (người dùng yêu
 * cầu cải thiện bằng tra cứu 18/10/2026; nguồn trong DESIGN.md): tên đối tượng, giá trị nguyên văn theo nhãn, nội dung
 * dài thu gọn, nút ghi rõ việc sẽ làm cùng một nút từ chối nhẹ. Chưa tạo gì: nút mở hộp tạo
 * nhiệm vụ đã điền sẵn, người dùng xem lại, chọn trường còn thiếu và tự bấm Tạo. Tạo xong hoặc bỏ qua thì thẻ thu gọn một hàng.
 */
export function AssistantTaskProposalCard({
  proposal,
  created = null,
  dismissed = false,
  onOpen,
  onDismissedChange,
}: {
  proposal: AssistantTaskProposal;
  created?: AssistantProposalTask | null;
  dismissed?: boolean;
  onOpen?: () => void;
  onDismissedChange?: (dismissed: boolean) => void;
}) {
  // Bỏ qua / Hoàn tác làm mất nút vừa bấm: chuyển tiêu điểm sang nút đối ứng, chỉ khi do chính người dùng bấm
  const focusNext = React.useRef<"undo" | "open" | null>(null);
  const undoRef = React.useRef<HTMLButtonElement>(null);
  const openRef = React.useRef<HTMLButtonElement>(null);
  React.useLayoutEffect(() => {
    if (focusNext.current === "undo" && dismissed) undoRef.current?.focus();
    if (focusNext.current === "open" && !dismissed) openRef.current?.focus();
    focusNext.current = null;
  }, [dismissed]);

  if (created) {
    return (
      <CompactProposalRow
        label={`Đã tạo nhiệm vụ: ${proposal.title}`}
        icon={<Check className="size-3.5 text-foreground" />}
        title={proposal.title}
        status={`Đã tạo nhiệm vụ${created.code ? ` ${created.code}` : ""}`}
      >
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-foreground max-md:min-h-11">
          <Link href={`/tasks/${encodeURIComponent(created.id)}`}>
            Mở nhiệm vụ
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </CompactProposalRow>
    );
  }
  if (dismissed) {
    return (
      <CompactProposalRow
        label={`Đã bỏ qua đề xuất: ${proposal.title}`}
        icon={<Minus className="size-3.5 text-muted-foreground" />}
        title={proposal.title}
        status="Đã bỏ qua đề xuất"
        muted
      >
        {onDismissedChange ? (
          <Button
            ref={undoRef}
            variant="ghost"
            size="sm"
            className="shrink-0 max-md:min-h-11"
            onClick={() => {
              focusNext.current = "open";
              onDismissedChange(false);
            }}
          >
            Hoàn tác
          </Button>
        ) : null}
      </CompactProposalRow>
    );
  }

  const subtasks = proposal.subtasks ?? [];
  const hidden = subtasks.length - SHOWN_SUBTASKS;
  const priority = proposal.priority && proposal.priority !== "NONE" ? proposal.priority : null;
  const hasFields = Boolean(proposal.dueDate || proposal.startDate || proposal.leadAssigneeName || priority || subtasks.length > 0);
  return (
    <section
      aria-label={`Đề xuất nhiệm vụ: ${proposal.title}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
    >
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListPlus className="size-3.5 shrink-0" aria-hidden />
          Đề xuất nhiệm vụ
        </p>
        <p className="break-words text-compact font-medium text-foreground">{proposal.title}</p>
        {proposal.description ? (
          // Mô tả đầy đủ ở hộp tạo nhiệm vụ; thẻ chỉ giữ hai dòng để các trường dễ đọc lướt
          <p className="line-clamp-2 whitespace-pre-line break-words text-xs text-muted-foreground" title={proposal.description}>
            {proposal.description}
          </p>
        ) : null}
      </div>

      {/* Chỉ trường có giá trị: không ghi "Chưa chọn", không nhắc trường thiếu (người dùng bỏ lời nhắc, 18/10/2026) */}
      {hasFields ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-xs">
          {proposal.dueDate ? (
            <>
              <dt className="text-muted-foreground">Hạn</dt>
              <dd className="text-foreground tabular-nums">{formatDisplayDate(proposal.dueDate)}</dd>
            </>
          ) : null}
          {proposal.startDate ? (
            <>
              <dt className="text-muted-foreground">Bắt đầu</dt>
              <dd className="text-foreground tabular-nums">{formatDisplayDate(proposal.startDate)}</dd>
            </>
          ) : null}
          {proposal.leadAssigneeName ? (
            <>
              <dt className="text-muted-foreground">Chủ trì</dt>
              <dd className="truncate text-foreground" title={proposal.leadAssigneeName}>
                {proposal.leadAssigneeName}
              </dd>
            </>
          ) : null}
          {priority ? (
            <>
              <dt className="text-muted-foreground">Ưu tiên</dt>
              <dd className="flex">
                {/* Hộp dùng MEDIUM, chỉ báo dùng NORMAL (như toSignalPriority của hộp tạo nhiệm vụ) */}
                <PrioritySignalBars priority={priority === "MEDIUM" ? "NORMAL" : priority} showLabel />
              </dd>
            </>
          ) : null}
          {subtasks.length > 0 ? (
            <>
              <dt className="self-start text-muted-foreground">Việc con</dt>
              <dd className="flex min-w-0 flex-col gap-0.5">
                <ul className="flex flex-col gap-0.5">
                  {subtasks.slice(0, SHOWN_SUBTASKS).map((item) => (
                    // Người và hạn đứng ngay sau tên việc (không đẩy ra mép phải thẻ rộng)
                    <li key={item.title} className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate text-foreground" title={item.title}>
                        {item.title}
                      </span>
                      {item.assigneeName || item.dueDate ? (
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {[item.assigneeName, item.dueDate ? formatDisplayDate(item.dueDate) : null].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {hidden > 0 ? <span className="text-muted-foreground">và {hidden} việc con khác</span> : null}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {onOpen ? (
        // Bên phải như chân hộp thoại của app: từ chối nhẹ (ghost) trước, nút chính sát mép (người dùng yêu cầu 18/10/2026)
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onDismissedChange ? (
            <Button
              variant="ghost"
              size="sm"
              className="max-md:min-h-11"
              onClick={() => {
                focusNext.current = "undo";
                onDismissedChange(true);
              }}
            >
              Bỏ qua
            </Button>
          ) : null}
          <Button ref={openRef} size="sm" className="max-md:min-h-11" onClick={onOpen}>
            Xem lại và tạo
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Thẻ đã trả lời (đã tạo, đã bỏ qua): một hàng gọn, trạng thái bằng chữ đọc cho trình đọc màn hình khi đổi. */
function CompactProposalRow({
  label,
  icon,
  title,
  status,
  muted = false,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  status: string;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
        {icon}
      </span>
      <div role="status" className="flex min-w-0 flex-1 flex-col">
        <p className={muted ? "truncate text-compact text-muted-foreground" : "truncate text-compact font-medium text-foreground"} title={title}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      {children}
    </section>
  );
}
