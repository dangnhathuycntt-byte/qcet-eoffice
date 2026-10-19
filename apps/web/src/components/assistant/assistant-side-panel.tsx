"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, FileText, ListChecks } from "lucide-react";
import type { AssistantSourceRef } from "@qcet/contracts/assistant";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { focusRingClass } from "@/components/ui/focus-ring";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { formatBytes } from "@/lib/pwa/storage-manager";
import { formatDisplayDate } from "@qcet/shared/lib/format/date";
import { cn } from "@/lib/utils";
import { ProposalListRow } from "@/components/assistant/assistant-task-proposal-card";
import {
  pendingProposals,
  type ConversationOutline,
  type ConversationProposalItem,
  type ProposalTarget,
} from "@/components/assistant/assistant-model";

const SOURCE_ICON: Record<AssistantSourceRef["type"], React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  task: ListChecks,
  document: FileText,
  meeting: CalendarDays,
};

const ROW_LINK_CLASS = cn("flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-compact hover:bg-accent", focusRingClass);

/** Đề xuất liền nhau cùng hạn gom một nhóm (kế hoạch theo tháng): tiêu đề nhóm ghi hạn, hàng không lặp ngày. */
function groupByDue(items: readonly ConversationProposalItem[]): Array<{ due: string | null; items: ConversationProposalItem[] }> {
  const groups: Array<{ due: string | null; items: ConversationProposalItem[] }> = [];
  for (const item of items) {
    const due = item.proposal.dueDate ?? null;
    const last = groups[groups.length - 1];
    if (last && last.due === due) last.items.push(item);
    else groups.push({ due, items: [item] });
  }
  return groups;
}

/** Bảng bên có gì để hiện: đề xuất, tệp hoặc nguồn. Không có thì trang không chừa cột và không có nút bật. */
export function hasOutline(outline: ConversationOutline): boolean {
  return outline.proposals.length > 0 || outline.files.length > 0 || outline.sources.length > 0;
}

/** Một mục của thẻ (như Progress, Outputs của Claude): tên mục chữ thường đậm vừa, kẻ ngang giữa các mục trong thẻ. */
function Section({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5 border-b border-border/60 px-2 py-3 last:border-b-0">
      <div className="flex min-h-6 items-center gap-2 px-2">
        <h2 className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

/**
 * Cột phải của trang Trợ lý, như cột Progress/Outputs của Claude (người dùng gửi ảnh 19/10/2026: "cột bên phải mình dư,
 * học hỏi tận dụng như Claude"): gom những gì cuộc trò chuyện sinh ra và dùng tới. Đề xuất nhiệm vụ có tiến độ đã tạo,
 * bấm hàng để xem lại và tạo, "Tạo tất cả" cho các đề xuất còn chờ; tệp đã gửi mở lại được; nguồn Trợ lý đã dẫn mở
 * đúng trang. Là thẻ nổi bo góc cách mép như popover (người dùng sửa 19/10/2026: "dạng popover nổi chứ không phải line
 * chia trang"), cao theo nội dung, quá cao thì cuộn trong thẻ. Chỉ có ở màn rộng (xl); bật/tắt bằng nút trên thanh đầu,
 * không có nút X (người dùng bỏ 19/10/2026).
 */
export function AssistantSidePanel({
  outline,
  onOpenProposal,
  onCreateProposals,
}: {
  outline: ConversationOutline;
  onOpenProposal: (target: ProposalTarget) => void;
  onCreateProposals: (items: ProposalTarget[]) => void;
}) {
  const { proposals, files, sources } = outline;
  const waiting = pendingProposals(proposals);
  const created = proposals.filter((item) => item.created).length;
  return (
    // ml-3: thanh cuộn của cột tin cách thẻ một khoảng như lề trên và phải, không dính sát mép thẻ
    <aside
      aria-label="Trong cuộc trò chuyện"
      data-slot="assistant-side-panel"
      className="relative ml-3 mr-3 mt-3 hidden max-h-[calc(100%-1.5rem)] w-80 shrink-0 flex-col self-start overflow-y-auto rounded-xl bg-popover text-popover-foreground shadow-menu thin-scrollbar xl:flex"
    >

      {proposals.length > 0 ? (
        <Section
          title="Đề xuất nhiệm vụ"
          meta={
            <span role="status" className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {created}/{proposals.length} đã tạo
            </span>
          }
        >
          <Progress value={created} max={proposals.length} aria-label="Tiến độ tạo nhiệm vụ từ đề xuất" className="px-2" />
          {waiting.length > 1 ? (
            // Nút phụ: nút chính "Tạo tất cả" đã ở thẻ trong cột tin, cột bên giữ yên như cột Progress của Claude
            <Button variant="toolbar" size="sm" className="mx-2 my-1" onClick={() => onCreateProposals(waiting)}>
              Tạo tất cả ({waiting.length})
            </Button>
          ) : null}
          {/* Danh sách cuộn riêng trong mục như Progress của Claude, để mục Tệp và Nguồn bên dưới vẫn thấy */}
          {/* relative: chữ sr-only (định vị tuyệt đối) của hàng ở lại trong vùng cuộn, không kéo dài cả trang */}
          <div className="relative flex max-h-[min(55dvh,480px)] flex-col gap-1 overflow-y-auto thin-scrollbar">
            {groupByDue(proposals).map((group, i) => (
              <div key={i} className="flex flex-col">
                {group.due ? (
                  <p className="px-2 pb-0.5 pt-1.5 text-xs text-muted-foreground tabular-nums">Hạn {formatDisplayDate(group.due)}</p>
                ) : (
                  <p className="px-2 pb-0.5 pt-1.5 text-xs text-muted-foreground">Chưa có hạn</p>
                )}
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li key={`${item.replyKey}:${item.index}`}>
                      <ProposalListRow item={item} onOpen={() => onOpenProposal(item)} hideDue />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {files.length > 0 ? (
        <Section title="Tệp" meta={<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{files.length}</span>}>
          <ul className="flex flex-col">
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noopener noreferrer" aria-label={`Mở tệp ${file.name}`} className={ROW_LINK_CLASS}>
                  <FileTypeIcon fileName={file.name} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-foreground" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {sources.length > 0 ? (
        <Section title="Nguồn đã dùng" meta={<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{sources.length}</span>}>
          <ul className="flex flex-col">
            {sources.map((source) => {
              const Icon = SOURCE_ICON[source.type];
              return (
                <li key={`${source.type}:${source.id}`}>
                  <Link href={source.href} className={ROW_LINK_CLASS}>
                    <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    {source.code ? <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{source.code}</span> : null}
                    <span className="min-w-0 flex-1 truncate text-foreground" title={source.title}>
                      {source.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </aside>
  );
}
