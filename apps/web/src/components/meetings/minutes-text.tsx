"use client";

import * as React from "react";
import { minutesToReplyMarkup } from "@qcet/shared/domain/meetings/minutes-format";
import { AgentReplyText } from "@/components/agent-chat/agent-chat-parts";

/**
 * Biên bản, nội dung cuộc họp và biên bản đề xuất của AI: chữ thuần dựng thành tiêu đề mục và danh sách thật (gạch đầu dòng
 * thụt treo, ý con lồng một cấp) bằng cùng bộ dựng với câu trả lời của Agent, thay vì một khối `whitespace-pre-wrap` có dấu
 * "-"/"+" gõ tay (người dùng chê "nhìn kiểu gì ui ux cũng chưa tốt", ảnh 21/10/2026). Không chèn HTML.
 */
export function MinutesText({ text }: { text: string }) {
  const markup = React.useMemo(() => minutesToReplyMarkup(text), [text]);
  return <AgentReplyText text={markup} />;
}
