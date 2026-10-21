"use client";

import * as React from "react";
import { Copy, FileEdit } from "lucide-react";
import type { MeetingRecordingDetail } from "@qcet/contracts/meeting-recordings";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useFeedback } from "@/components/ui/feedback-layer";
import { MinutesText } from "@/components/meetings/minutes-text";

/** Biên bản đề xuất kèm quyết định và việc được giao, thành một khối chữ để điền vào ô soạn biên bản. */
export function composeMinutesText(detail: MeetingRecordingDetail): string {
  const sections = [detail.minutesDraft?.trim() ?? ""];
  if (detail.decisions.length > 0) sections.push(["Quyết định:", ...detail.decisions.map((decision) => `- ${decision}`)].join("\n"));
  if (detail.actionItems.length > 0) {
    sections.push(
      [
        "Việc được giao:",
        ...detail.actionItems.map((item) => {
          const extra = [item.owner, item.deadline ? `hạn ${item.deadline}` : null].filter(Boolean).join(", ");
          return `- ${item.task}${extra ? ` (${extra})` : ""}`;
        }),
      ].join("\n")
    );
  }
  return sections.filter(Boolean).join("\n\n");
}

/**
 * Kết quả của một bản ghi đã xử lý xong. Mọi chữ là văn bản thuần (không HTML): nội dung do mô hình soạn từ lời nói,
 * chỉ là bản nháp để người soạn biên bản đọc lại, sửa rồi mới dùng.
 */
export function RecordingResult({
  detail,
  onUseAsMinutes,
  minutesHint,
}: {
  detail: MeetingRecordingDetail;
  /** Có thì hiện nút điền vào ô soạn biên bản. */
  onUseAsMinutes?: (text: string) => void;
  /** Giải thích vì sao chưa điền thẳng vào biên bản được (cuộc họp chưa chuyển sang "Đã họp"). */
  minutesHint?: string;
}) {
  const { notifySuccess, notifyError } = useFeedback();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(composeMinutesText(detail));
      notifySuccess("Đã sao chép biên bản đề xuất.");
    } catch {
      notifyError("Không sao chép được. Thầy/Cô chọn chữ và sao chép thủ công.");
    }
  };

  return (
    // Bề ngang theo cột chính của trang chi tiết (`READING_COLUMN_CLASS`), không tự đặt thêm
    <div className="space-y-3 pt-2">
      <InlineAlert variant="info">Bản nháp do AI soạn từ ghi âm, có thể nghe nhầm tên và con số. Thầy/Cô đọc lại trước khi dùng.</InlineAlert>
      {detail.error && <InlineAlert variant="warning">{detail.error}</InlineAlert>}

      {detail.minutesDraft && (
        <section>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">Biên bản đề xuất</h4>
          <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
            <MinutesText text={detail.minutesDraft} />
          </div>
        </section>
      )}

      {detail.decisions.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">Quyết định</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-compact text-foreground">
            {detail.decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        </section>
      )}

      {detail.actionItems.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">Việc được giao</h4>
          <ul className="space-y-1 text-compact text-foreground">
            {detail.actionItems.map((item, index) => (
              <li key={index} className="rounded-md border border-border/40 px-3 py-1.5">
                <span className="block">{item.task}</span>
                <span className="block text-xs text-muted-foreground">
                  {[item.owner ? `Giao cho: ${item.owner}` : "Chưa rõ người nhận", item.deadline ? `Hạn: ${item.deadline}` : null].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.transcript && (
        <details className="group">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">Xem bản chép lời</summary>
          <div className="thin-scrollbar mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-foreground">
            {detail.transcript}
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {onUseAsMinutes && (
          <Button size="sm" onClick={() => onUseAsMinutes(composeMinutesText(detail))}>
            <FileEdit />
            Dùng làm biên bản nháp
          </Button>
        )}
        <Button size="sm" variant="toolbar" onClick={() => void copy()}>
          <Copy />
          Sao chép
        </Button>
        {!onUseAsMinutes && minutesHint && <span className="text-xs text-muted-foreground">{minutesHint}</span>}
      </div>
    </div>
  );
}
