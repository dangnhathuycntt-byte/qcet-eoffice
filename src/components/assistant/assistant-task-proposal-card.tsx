"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ListPlus } from "lucide-react";
import type { AssistantTaskProposal } from "@/contracts/assistant";
import { formatDisplayDate } from "@/lib/format/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import type { AssistantProposalTask } from "@/components/assistant/assistant-model";

/** Số việc con hiện trên thẻ; còn lại gộp thành "và n việc con khác" (hộp tạo nhiệm vụ có đủ). */
const SHOWN_SUBTASKS = 5;

/** Trường bắt buộc của hộp tạo nhiệm vụ mà đề xuất còn thiếu, ghi bằng lời ở chân thẻ. */
function missingRequired(proposal: AssistantTaskProposal): string | null {
  const missing = [proposal.dueDate ? null : "hạn", proposal.leadAssigneeName ? null : "người chủ trì"].filter(Boolean);
  return missing.length > 0 ? `Còn thiếu ${missing.join(" và ")}, chọn trong hộp.` : null;
}

/**
 * Thẻ đề xuất nhiệm vụ dưới câu trả lời (propose_task, ADR-010), theo mẫu xem trước hành động của agent: tên đối tượng,
 * giá trị nguyên văn theo nhãn, nội dung dài thu gọn, nút ghi rõ việc sẽ làm, trạng thái ghi bằng chữ (Microsoft Learn,
 * agentconsent.dev; người dùng yêu cầu cải thiện 18/10/2026). Chưa tạo gì: nút mở hộp tạo nhiệm vụ đã điền sẵn, người
 * dùng xem lại và tự bấm Tạo. Tạo xong thì thẻ thu gọn còn tiêu đề và lối mở nhiệm vụ (thay cho toast), không còn nút
 * để khỏi tạo trùng.
 */
export function AssistantTaskProposalCard({
  proposal,
  created = null,
  onOpen,
}: {
  proposal: AssistantTaskProposal;
  created?: AssistantProposalTask | null;
  onOpen?: () => void;
}) {
  if (created) return <CreatedProposalCard title={proposal.title} task={created} />;
  const subtasks = proposal.subtasks ?? [];
  const hidden = subtasks.length - SHOWN_SUBTASKS;
  const missing = missingRequired(proposal);
  return (
    <section
      aria-label={`Đề xuất nhiệm vụ: ${proposal.title}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListPlus className="size-3.5 shrink-0" aria-hidden />
            Đề xuất nhiệm vụ
          </p>
          <Badge variant="secondary" className="font-normal text-muted-foreground">
            Chưa tạo
          </Badge>
        </div>
        <p className="break-words text-compact font-medium text-foreground">{proposal.title}</p>
        {proposal.description ? (
          // Mô tả đầy đủ ở hộp tạo nhiệm vụ; thẻ chỉ giữ hai dòng để các trường dễ đọc lướt
          <p className="line-clamp-2 whitespace-pre-line break-words text-xs text-muted-foreground" title={proposal.description}>
            {proposal.description}
          </p>
        ) : null}
      </div>

      {/* Hạn và chủ trì là trường bắt buộc của hộp: luôn hiện, thiếu thì ghi để Thầy/Cô biết cần chọn */}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Hạn</dt>
        <dd className={proposal.dueDate ? "text-foreground tabular-nums" : "text-muted-foreground"}>
          {proposal.dueDate ? formatDisplayDate(proposal.dueDate) : "Chưa chọn"}
        </dd>
        {proposal.startDate ? (
          <>
            <dt className="text-muted-foreground">Bắt đầu</dt>
            <dd className="text-foreground tabular-nums">{formatDisplayDate(proposal.startDate)}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Chủ trì</dt>
        <dd className={proposal.leadAssigneeName ? "truncate text-foreground" : "text-muted-foreground"} title={proposal.leadAssigneeName}>
          {proposal.leadAssigneeName ?? "Chưa chọn"}
        </dd>
        {proposal.priority && proposal.priority !== "NONE" ? (
          <>
            <dt className="text-muted-foreground">Ưu tiên</dt>
            <dd className="flex">
              {/* Hộp dùng MEDIUM, chỉ báo dùng NORMAL (như toSignalPriority của hộp tạo nhiệm vụ) */}
              <PrioritySignalBars priority={proposal.priority === "MEDIUM" ? "NORMAL" : proposal.priority} showLabel />
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

      {onOpen ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button size="sm" className="max-md:min-h-11" onClick={onOpen}>
            Xem lại và tạo
          </Button>
          <p className="text-xs text-muted-foreground">{missing ?? "Mở hộp tạo nhiệm vụ để xem lại rồi bấm Tạo."}</p>
        </div>
      ) : null}
    </section>
  );
}

/** Thẻ sau khi tạo: một khối gọn, trạng thái bằng chữ và lối mở nhiệm vụ (đọc cho trình đọc màn hình khi đổi). */
function CreatedProposalCard({ title, task }: { title: string; task: AssistantProposalTask }) {
  return (
    <section
      aria-label={`Đã tạo nhiệm vụ: ${title}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
        <Check className="size-3.5 text-foreground" />
      </span>
      <div role="status" className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-compact font-medium text-foreground" title={title}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">Đã tạo nhiệm vụ{task.code ? ` ${task.code}` : ""}</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0 text-foreground max-md:min-h-11">
        <Link href={`/tasks/${encodeURIComponent(task.id)}`}>
          Mở nhiệm vụ
          <ArrowUpRight aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
