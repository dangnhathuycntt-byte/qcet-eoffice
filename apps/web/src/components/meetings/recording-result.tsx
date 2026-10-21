"use client";

import * as React from "react";
import { Copy, FileEdit } from "lucide-react";
import type { MeetingRecordingDetail } from "@qcet/contracts/meeting-recordings";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useFeedback } from "@/components/ui/feedback-layer";
import { composeRecordingMinutes } from "@qcet/shared/domain/meetings/minutes-format";
import { MinutesText } from "@/components/meetings/minutes-text";

/**
 * Kết quả của một bản ghi đã xử lý xong. Mọi chữ là văn bản thuần (không HTML): nội dung do mô hình soạn từ lời nói,
 * chỉ là bản nháp để người soạn biên bản đọc lại, sửa rồi mới dùng.
 *
 * Một tầng duy nhất (người dùng chê "chỗ này dày thông tin quá", ảnh 21/10/2026: trước đó là khung cảnh báo, nhãn "Biên bản
 * đề xuất", khung nền chứa biên bản, các khung "Việc được giao" rồi hàng nút): biên bản đề xuất kẻ trái như trích dẫn, hiện
 * đúng chữ sẽ được điền khi bấm "Dùng làm biên bản nháp" (biên bản, Quyết định, Việc được giao ghép bằng `composeRecordingMinutes`),
 * lời nhắc AI thành một dòng chữ mờ cạnh nút.
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
  const text = React.useMemo(() => composeRecordingMinutes(detail), [detail]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess("Đã sao chép biên bản đề xuất.");
    } catch {
      notifyError("Không sao chép được. Thầy/Cô chọn chữ và sao chép thủ công.");
    }
  };

  return (
    <div className="space-y-2.5 pt-1.5">
      {detail.error && <InlineAlert variant="warning">{detail.error}</InlineAlert>}

      {text ? (
        <div className="border-l-2 border-border pl-3">
          <MinutesText text={text} />
        </div>
      ) : null}

      {detail.transcript && (
        <details className="group">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">Xem bản chép lời</summary>
          <div className="thin-scrollbar mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-foreground">
            {detail.transcript}
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex shrink-0 items-center gap-1">
          {onUseAsMinutes && (
            <Button size="sm" variant="toolbar" onClick={() => onUseAsMinutes(text)}>
              <FileEdit />
              Dùng làm biên bản nháp
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void copy()}>
            <Copy />
            Sao chép
          </Button>
        </div>
        <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
          {!onUseAsMinutes && minutesHint ? `${minutesHint} ` : ""}AI soạn từ ghi âm, có thể nghe nhầm tên và con số; Thầy/Cô đọc lại trước khi dùng.
        </p>
      </div>
    </div>
  );
}
