"use client";

import * as React from "react";
import Link from "next/link";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion, type Transition } from "motion/react";
import { CalendarDays, Check, ChevronDown, FileText, ListChecks, X } from "lucide-react";
import type { AssistantSourceRef } from "@qcet/contracts/assistant";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { focusRingClass } from "@/components/ui/focus-ring";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { formatBytes } from "@/lib/pwa/storage-manager";
import { formatDisplayDate } from "@qcet/shared/lib/format/date";
import { motionTransition } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { ProposalListRow } from "@/components/assistant/assistant-task-proposal-card";
import { useElapsedSeconds } from "@/components/assistant/use-elapsed-seconds";
import {
  formatDurationVi,
  pendingProposals,
  type ConversationOutline,
  type ConversationProgress,
  type ConversationProposalItem,
  type ProposalTarget,
} from "@/components/assistant/assistant-model";

const SOURCE_ICON: Record<AssistantSourceRef["type"], React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  task: ListChecks,
  document: FileText,
  meeting: CalendarDays,
};

const INSTANT: Transition = { duration: 0 };
const RAIL_HIDDEN = { opacity: 0, scale: 0.97, y: -4 };
const CARD_HIDDEN = { opacity: 0, y: -4 };
const ROW_HIDDEN = { opacity: 0, y: 4 };

const ROW_LINK_CLASS = cn("flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-compact hover:bg-accent", focusRingClass);
const META_CLASS = "shrink-0 text-xs font-normal text-muted-foreground tabular-nums";

type CardId = "progress" | "proposals" | "files" | "sources";
const CARD_IDS: readonly CardId[] = ["progress", "proposals", "files", "sources"];

/** Thẻ người dùng thu gọn thì nhớ cho lần sau (chỉ trình duyệt này; lỗi bộ nhớ thì coi như đều mở). */
const COLLAPSED_STORAGE_KEY = "qcet.assistant.railCollapsed";

function readCollapsed(): CardId[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? CARD_IDS.filter((id) => raw.includes(id)) : [];
  } catch {
    return [];
  }
}

function writeCollapsed(ids: readonly CardId[]) {
  try {
    if (ids.length > 0) window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(ids));
    else window.localStorage.removeItem(COLLAPSED_STORAGE_KEY);
  } catch {
    // Không lưu được thì chỉ mất lựa chọn ở lần sau
  }
}

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

/** Bảng bên có gì để hiện: tiến trình, đề xuất, tệp hoặc nguồn. Không có thì trang không chừa cột và không có nút bật. */
export function hasOutline(outline: ConversationOutline): boolean {
  return outline.progress !== null || outline.proposals.length > 0 || outline.files.length > 0 || outline.sources.length > 0;
}

/**
 * Một thẻ nổi của cột bên, như các thẻ của session rail trong Claude (Progress, Outputs, Context): nền popover bo góc,
 * tiêu đề là nút thu gọn/mở (mẫu disclosure: nút nằm trong h2, aria-expanded). Thẻ mới xuất hiện giữa chừng (lượt đầu
 * có tệp, có đề xuất) thì mờ dần vào.
 */
function RailCard({
  title,
  meta,
  collapsed,
  onToggle,
  still,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  still: boolean;
  children: React.ReactNode;
}) {
  const bodyId = React.useId();
  return (
    <m.section
      aria-label={title}
      data-slot="assistant-rail-card"
      className="flex shrink-0 flex-col rounded-xl bg-popover text-popover-foreground shadow-menu"
      initial={CARD_HIDDEN}
      animate={{ opacity: 1, y: 0, transition: still ? INSTANT : motionTransition.dropdown }}
      exit={{ ...CARD_HIDDEN, transition: still ? INSTANT : motionTransition.dropdownExit }}
    >
      <h2 className="text-compact font-medium text-foreground">
        <Pressable
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="group/rail flex h-10 w-full items-center gap-2 rounded-xl px-4 text-left"
        >
          <span className="min-w-0 truncate">{title}</span>
          {/* Mũi tên ngay sau tên (như đầu mục thu gọn của sidebar Linear), chỉ hiện khi rê chuột hoặc khi thẻ đang thu
              gọn; số liệu bên phải vẫn sát mép thẻ */}
          <ChevronDown
            aria-hidden
            className={cn(
              "-ml-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-[opacity,rotate] duration-150 group-hover/rail:opacity-100 group-focus-visible/rail:opacity-100 motion-reduce:transition-none",
              collapsed && "-rotate-90 opacity-100",
            )}
          />
          <span className="flex-1" />
          {meta}
        </Pressable>
      </h2>
      {collapsed ? null : (
        <div id={bodyId} className="flex flex-col gap-1.5 px-2 pb-3">
          {children}
        </div>
      )}
    </m.section>
  );
}

/**
 * Các bước của thẻ Tiến trình, như Progress của Claude Cowork ("Progress cho biết Claude đang làm gì"): bước xong có dấu
 * tích, bước đang làm quay và nhấp nháy, bước lỗi có dấu X.
 */
function ProgressSteps({ progress }: { progress: ConversationProgress }) {
  return (
    <ol className="flex flex-col">
      {progress.steps.map((step, index) => (
        <li key={`${index}:${step.label}`} className="flex h-7 min-w-0 items-center gap-2 px-2 text-compact">
          {step.state === "running" ? (
            <Spinner size="xs" tone="muted" />
          ) : step.state === "failed" ? (
            <X aria-hidden className="size-3.5 shrink-0 text-destructive" />
          ) : (
            <Check aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn("min-w-0 flex-1 truncate", step.state === "running" ? "animate-text-shimmer" : "text-muted-foreground")}
            title={step.label}
          >
            {step.label}
          </span>
          <span className="sr-only">{step.state === "running" ? "đang làm" : step.state === "failed" ? "lỗi" : "xong"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Đầu thẻ Tiến trình: đồng hồ khi đang chạy, tổng thời gian khi xong, hoặc trạng thái dừng/lỗi. */
function progressMeta(progress: ConversationProgress, elapsed: number | null): string | null {
  if (progress.status === "streaming") return elapsed === null ? "Đang chạy" : formatDurationVi(elapsed);
  if (progress.status === "aborted") return "Đã dừng";
  if (progress.status === "error") return "Lỗi";
  return progress.durationMs === null ? null : formatDurationVi(progress.durationMs / 1000);
}

/**
 * Cột phải của trang Trợ lý: chồng thẻ nổi riêng như session rail của Claude (người dùng yêu cầu 19/10/2026: "nhiều loại
 * popover đi, tách ra: tệp, đề xuất, process…"). Tiến trình của lượt gần nhất; đề xuất nhiệm vụ có tiến độ đã tạo, bấm
 * hàng để xem lại và tạo, "Tạo tất cả" cho các đề xuất còn chờ; tệp đã gửi mở lại được; nguồn Trợ lý đã dẫn mở đúng
 * trang. Thẻ nào không có nội dung thì không hiện; mỗi thẻ thu gọn được. Cả chồng cuộn khi cao quá màn. Chỉ có ở màn
 * rộng (xl); bật/tắt bằng nút trên thanh đầu, không có nút X (người dùng bỏ 19/10/2026).
 */
export function AssistantSidePanel({
  outline,
  onOpenProposal,
  onCreateProposals,
  animated = true,
}: {
  outline: ConversationOutline;
  onOpenProposal: (target: ProposalTarget) => void;
  onCreateProposals: (items: ProposalTarget[]) => void;
  /** false: hiện/ẩn ngay, không chuyển động (lần đầu áp lựa chọn đã lưu của người dùng). */
  animated?: boolean;
}) {
  const { progress, proposals, files, sources } = outline;
  const waiting = pendingProposals(proposals);
  const created = proposals.filter((item) => item.created).length;
  const allDismissed = proposals.length > 0 && proposals.every((item) => item.dismissed && !item.created);
  const groups = groupByDue(proposals);
  // Chỉ một nhóm không hạn thì tiêu đề nhóm thừa: không có gì để phân biệt
  const showGroupHeaders = !(groups.length === 1 && groups[0].due === null);
  const reduceMotion = useReducedMotion();
  const still = !animated || Boolean(reduceMotion);
  const elapsed = useElapsedSeconds(progress?.startedAt, progress?.status === "streaming");
  // Hàng có sẵn khi thẻ mở thì hiện ngay; hàng đến sau (đề xuất đang soạn) mới trượt nhẹ vào
  const [settled, setSettled] = React.useState(false);
  // Đọc thẻ đã thu gọn sau khi gắn (máy chủ không có localStorage), để HTML ban đầu khớp nhau
  const [collapsed, setCollapsed] = React.useState<CardId[]>([]);
  React.useEffect(() => {
    setSettled(true);
    setCollapsed(readCollapsed());
  }, []);
  const toggle = (id: CardId) => {
    const next = collapsed.includes(id) ? collapsed.filter((item) => item !== id) : [...collapsed, id];
    setCollapsed(next);
    writeCollapsed(next);
  };
  const cardProps = (id: CardId) => ({ collapsed: collapsed.includes(id), onToggle: () => toggle(id), still });
  const progressLabel = progress ? progressMeta(progress, elapsed) : null;

  return (
    // Chỗ của cột giãn từ 0 nên cột tin thu hẹp, căn lại mượt; chồng thẻ neo mép phải (justify-end) không trượt theo
    <m.div
      className="hidden shrink-0 justify-end xl:flex"
      initial={{ width: 0 }}
      animate={{ width: "auto", transition: still ? INSTANT : motionTransition.panel }}
      exit={{ width: 0, transition: still ? INSTANT : motionTransition.panelExit }}
    >
      {/* Cả chồng hiện như popover từ góc trên phải, chỗ nút bật trên thanh đầu. Lề 12px quanh chồng để bóng thẻ không bị
          vùng cuộn cắt; relative: chữ sr-only (định vị tuyệt đối) ở lại trong vùng cuộn, không kéo dài cả trang */}
      <m.aside
        aria-label="Trong cuộc trò chuyện"
        data-slot="assistant-side-panel"
        className="relative flex w-86 shrink-0 origin-top-right flex-col gap-3 overflow-y-auto p-3 thin-scrollbar"
        initial={RAIL_HIDDEN}
        animate={{ opacity: 1, scale: 1, y: 0, transition: still ? INSTANT : motionTransition.dropdown }}
        exit={{ ...RAIL_HIDDEN, transition: still ? INSTANT : motionTransition.dropdownExit }}
      >
        <AnimatePresence initial={false}>
          {progress ? (
            <RailCard
              key="progress"
              title="Tiến trình"
              meta={progressLabel ? <span className={META_CLASS}>{progressLabel}</span> : undefined}
              {...cardProps("progress")}
            >
              <ProgressSteps progress={progress} />
            </RailCard>
          ) : null}

          {proposals.length > 0 ? (
            <RailCard
              key="proposals"
              title="Đề xuất nhiệm vụ"
              meta={
                <span role="status" className={META_CLASS}>
                  {allDismissed ? "Đã bỏ qua" : `${created}/${proposals.length} đã tạo`}
                </span>
              }
              {...cardProps("proposals")}
            >
              {/* Thanh tiến độ chỉ khi đã tạo được nhiệm vụ: thanh rỗng không nói thêm gì ngoài số ở đầu thẻ */}
              {created > 0 ? (
                <Progress value={created} max={proposals.length} aria-label="Tiến độ tạo nhiệm vụ từ đề xuất" className="px-2 pb-1" />
              ) : null}
              {waiting.length > 1 ? (
                // Nút phụ: nút chính "Tạo tất cả" đã ở thẻ trong cột tin, cột bên giữ yên như cột Progress của Claude
                <Button variant="toolbar" size="sm" className="mx-2 my-1" onClick={() => onCreateProposals(waiting)}>
                  Tạo tất cả ({waiting.length})
                </Button>
              ) : null}
              {/* Danh sách cuộn riêng trong thẻ, để các thẻ bên dưới vẫn thấy */}
              <div className="relative flex max-h-[min(55dvh,480px)] flex-col gap-1 overflow-y-auto thin-scrollbar">
                {groups.map((group, i) => (
                  <div key={i} className="flex flex-col">
                    {!showGroupHeaders ? null : group.due ? (
                      <p className="px-2 pb-0.5 pt-1.5 text-xs text-muted-foreground tabular-nums">Hạn {formatDisplayDate(group.due)}</p>
                    ) : (
                      <p className="px-2 pb-0.5 pt-1.5 text-xs text-muted-foreground">Chưa có hạn</p>
                    )}
                    <ul className="flex flex-col">
                      {group.items.map((item) => (
                        <m.li
                          key={`${item.replyKey}:${item.index}`}
                          initial={settled && !still ? ROW_HIDDEN : false}
                          animate={{ opacity: 1, y: 0, transition: motionTransition.micro }}
                        >
                          <ProposalListRow item={item} onOpen={() => onOpenProposal(item)} hideDue />
                        </m.li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </RailCard>
          ) : null}

          {files.length > 0 ? (
            <RailCard key="files" title="Tệp" meta={<span className={META_CLASS}>{files.length}</span>} {...cardProps("files")}>
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
            </RailCard>
          ) : null}

          {sources.length > 0 ? (
            <RailCard key="sources" title="Nguồn đã dùng" meta={<span className={META_CLASS}>{sources.length}</span>} {...cardProps("sources")}>
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
            </RailCard>
          ) : null}
        </AnimatePresence>
      </m.aside>
    </m.div>
  );
}
