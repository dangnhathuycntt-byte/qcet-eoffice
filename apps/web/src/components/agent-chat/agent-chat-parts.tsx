"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, FileText, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import type { AssistantSourceRef } from "@qcet/contracts/assistant";
import { linkSourceCodes } from "@qcet/shared/domain/assistant/assistant-sources";
import { parseAgentReply, type AgentReplyInline } from "@qcet/shared/domain/tasks/agent-reply-format";

/** Chữ trong một đoạn; có `sources` thì mã của nguồn thành link tới trang của nó. */
function linkedNodes(text: string, sources?: AssistantSourceRef[]): React.ReactNode {
  if (!sources || sources.length === 0) return text;
  return linkSourceCodes(text, sources).map((part, j) =>
    part.href ? (
      <Link key={j} href={part.href} title={part.title} className="underline decoration-border underline-offset-2 hover:decoration-foreground">
        {part.text}
      </Link>
    ) : (
      <React.Fragment key={j}>{part.text}</React.Fragment>
    ),
  );
}

export function ReplyInline({ parts, sources }: { parts: AgentReplyInline[]; sources?: AssistantSourceRef[] }) {
  return parts.map((part, i) =>
    part.bold ? (
      <strong key={i} className="font-semibold">
        {linkedNodes(part.text, sources)}
      </strong>
    ) : (
      <React.Fragment key={i}>{linkedNodes(part.text, sources)}</React.Fragment>
    ),
  );
}

/** Gom mục con (cấp 1) vào mục cấp 0 đứng trước; mục con đứng đầu danh sách thì thành mục cấp 0. */
function groupListItems(items: AgentReplyInline[][], depths?: number[]) {
  const groups: { item: AgentReplyInline[]; children: AgentReplyInline[][] }[] = [];
  items.forEach((item, index) => {
    const parent = groups[groups.length - 1];
    if (depths?.[index] && parent) parent.children.push(item);
    else groups.push({ item, children: [] });
  });
  return groups;
}

/**
 * Câu trả lời có định dạng (đoạn, tiêu đề, danh sách, trích dẫn, chữ đậm, bảng) theo nhịp của Linear (đo ảnh 16/10/2026):
 * chữ 13px dòng ~21px, đoạn cách 16px, tiêu đề sát danh sách 6px, mục cách 6px, thụt 24px.
 * `sources`: mã nguồn trong chữ thành link (chỉ nguồn đã đọc trong lượt).
 */
export function AgentReplyText({ text, sources }: { text: string; sources?: AssistantSourceRef[] }) {
  const blocks = React.useMemo(() => parseAgentReply(text), [text]);
  return (
    // break-words (overflow-wrap kế thừa xuống đoạn, mục, tiêu đề): chuỗi dài không khoảng trắng không tràn cột
    <div className="flex flex-col gap-4 break-words text-compact leading-relaxed text-foreground">
      {blocks.map((block, i) =>
        block.type === "heading" ? (
          <p key={i} className="-mb-2.5 font-semibold">
            <ReplyInline parts={block.inline} sources={sources} />
          </p>
        ) : block.type === "table" ? (
          // Bảng cuộn ngang trong cột khi nhiều cột; chỉ kẻ ngang như bảng danh sách của app, số canh theo tabular-nums
          <div key={i} className="-mx-1 overflow-x-auto px-1 thin-scrollbar">
            <table className="w-full border-collapse text-left tabular-nums">
              <thead>
                <tr className="border-b border-border">
                  {block.header.map((cell, j) => (
                    <th key={j} scope="col" className="py-1.5 pr-4 text-xs font-medium whitespace-nowrap text-muted-foreground last:pr-0">
                      <ReplyInline parts={cell} sources={sources} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, j) => (
                  <tr key={j} className="border-b border-border/60 last:border-b-0">
                    {row.map((cell, k) => (
                      <td key={k} className="py-1.5 pr-4 align-top last:pr-0">
                        <ReplyInline parts={cell} sources={sources} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : block.type === "quote" ? (
          // Trích dẫn ("Lưu ý" của Trợ lý): kẻ trái và chữ phụ như khối suy nghĩ, không hiện dấu `>`
          <p key={i} className="whitespace-pre-wrap border-l-2 border-border pl-3 text-muted-foreground">
            <ReplyInline parts={block.inline} sources={sources} />
          </p>
        ) : block.type === "divider" ? (
          <hr key={i} className="border-border/60" />
        ) : block.type === "list" ? (
          <ul key={i} className={cn("flex flex-col gap-1.5 pl-6 marker:text-muted-foreground", block.ordered ? "list-decimal" : "list-disc")}>
            {groupListItems(block.items, block.depths).map((group, j) => (
              <li key={j} className="pl-0.5">
                <ReplyInline parts={group.item} sources={sources} />
                {group.children.length > 0 ? (
                  // Mục con là danh sách lồng thật (đọc màn hình biết cấp), chấm rỗng như Notion/Linear, cùng nhịp 6px
                  <ul className="mt-1.5 flex list-[circle] flex-col gap-1.5 pl-5">
                    {group.children.map((child, k) => (
                      <li key={k} className="pl-0.5">
                        <ReplyInline parts={child} sources={sources} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            <ReplyInline parts={block.inline} sources={sources} />
          </p>
        ),
      )}
    </div>
  );
}

/**
 * "Đã suy nghĩ trong N giây ▸" như "Worked for N seconds ▸" của Linear: bấm mở suy nghĩ và các bước.
 * `label` (tùy chọn) thay hẳn dòng nhãn mặc định. `phoneTouchTarget` (chỉ khung Trợ lý bật) nới vùng chạm lên 44px
 * trên điện thoại mà không đổi bố cục (lề âm bù phần thừa); panel Agent nhiệm vụ giữ nguyên.
 */
export function AgentWorkLog({
  seconds,
  thinking,
  steps,
  label: customLabel,
  phoneTouchTarget = false,
}: {
  seconds: number;
  thinking?: string;
  steps: string[];
  label?: string;
  phoneTouchTarget?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const label = customLabel ?? (thinking ? `Đã suy nghĩ trong ${seconds} giây` : `Đã soạn trong ${seconds} giây`);
  if (!thinking && steps.length === 0) return <p className="text-xs font-medium text-muted-foreground">{label}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <Pressable
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "-ml-1 inline-flex w-fit items-center gap-1 rounded-sm px-1 text-xs font-medium text-muted-foreground hover:text-foreground",
          phoneTouchTarget && "max-md:-my-3.5 max-md:h-11",
        )}
      >
        {label}
        <Play className={cn("size-2 fill-current transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")} />
      </Pressable>
      {open && (
        <div className="flex flex-col gap-1.5 break-words text-xs leading-relaxed text-muted-foreground motion-safe:animate-[fade-in_0.2s_ease-out]">
          {thinking && <p className="whitespace-pre-wrap border-l-2 border-border pl-3">{thinking}</p>}
          {steps.map((step, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate" title={step}>
                {step}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Nút sao chép câu trả lời. `phoneTouchTarget` (chỉ khung Trợ lý bật) nới vùng chạm lên 44px trên điện thoại;
 * mặc định giữ kích thước cũ cho máy tính và panel Agent nhiệm vụ.
 */
export function CopyMessageButton({ text, phoneTouchTarget = false }: { text: string; phoneTouchTarget?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? "Đã sao chép" : "Sao chép câu trả lời"}
      title={copied ? "Đã sao chép" : "Sao chép"}
      onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}
      className={cn("-ml-1.5 rounded-full", phoneTouchTarget && "max-md:size-11")}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

/**
 * Nền trống kiểu Linear: lưới icon 24px, icon đậm ở một ô (CSS `.agent-pattern*` trong globals.css). Vùng quanh con trỏ
 * chuột trong `trackRef` sáng hơn; rời vùng thì tắt dần. Dùng chung cho khung chat nổi của Trợ lý và Agent soạn nhiệm vụ.
 * Mặc định (khung Trợ lý, không có chữ bên dưới): lưới canh giữa theo icon đậm, mờ dần ra cả bốn phía; đặt trong khối
 * `relative` cao 24px đúng ô của icon đậm. `aboveTitle` (Agent soạn nhiệm vụ): đặt ngay trên tiêu đề, lưới chỉ mờ dần lên
 * trên, icon đậm ở ô giữa hàng cuối.
 */
export function AgentEmptyPattern({
  trackRef,
  aboveTitle = false,
}: {
  trackRef: React.RefObject<HTMLElement | null>;
  aboveTitle?: boolean;
}) {
  const patternRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const area = trackRef.current;
    const pattern = patternRef.current;
    if (!area || !pattern) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = pattern.getBoundingClientRect();
        pattern.style.setProperty("--agent-spot-x", `${e.clientX - rect.left}px`);
        pattern.style.setProperty("--agent-spot-y", `${e.clientY - rect.top}px`);
        pattern.dataset.tracking = "";
      });
    };
    // Giữ vị trí cuối để vệt sáng mờ đi tại chỗ
    const leave = () => {
      cancelAnimationFrame(frame);
      delete pattern.dataset.tracking;
    };
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerleave", leave);
    };
  }, [trackRef]);

  // Lưới 23 ô ngang; chế độ giữa cao 21 ô (số lẻ) để ô giữa trùng lưới 24px
  const centered = !aboveTitle;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -inset-x-4 overflow-hidden",
        centered ? "top-1/2 h-126 -translate-y-1/2" : "bottom-full h-66",
      )}
    >
      <div
        ref={patternRef}
        data-centered={centered ? "" : undefined}
        className="agent-pattern absolute inset-y-0 left-1/2 w-138 -translate-x-1/2 text-foreground"
      >
        <div className="agent-pattern-base absolute inset-0 opacity-20" />
        <div className="agent-pattern-spot absolute inset-0" />
        <div
          className={cn(
            "agent-pattern-featured absolute left-1/2 size-6 -translate-x-1/2",
            centered ? "top-1/2 -translate-y-1/2" : "bottom-0",
          )}
        />
      </div>
    </div>
  );
}
