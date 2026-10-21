"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { TaskIconCopy, TaskIconLink, TaskIconView } from "@qcet/shared/lib/icons/task-icons";
import { AgentIcon } from "@/components/icons/agent-icon";
import { askAssistantInDock } from "@/components/assistant/assistant-model";
import { MenuActionItem, MenuContent, MenuRoot, MenuSeparator } from "@/components/ui/menu";
import { useFeedback } from "@/components/ui/feedback-layer";
import { useRuntimeFeature } from "@/lib/runtime-features";
import {
  canCancelMeeting,
  meetingPath,
  meetingSummaryText,
  type MeetingRow,
} from "@/components/meetings/meeting-list-model";

/** Điểm chuột phải, hoặc phần tử (nút "⋯", hàng đang có tiêu điểm khi mở bằng bàn phím, hàng nhấn giữ trên điện thoại). */
export type MeetingMenuAnchor = { x: number; y: number } | HTMLElement;

export interface MeetingRowMenuProps {
  meeting: MeetingRow | null;
  anchor: MeetingMenuAnchor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: (meeting: MeetingRow) => void;
}

const icon = "size-4 text-muted-foreground";

/**
 * Menu thao tác một cuộc họp (chuột phải, nút "⋯", phím Menu/Shift+F10, nhấn giữ trên điện thoại thành bottom sheet), cùng
 * kiểu menu chuột phải của bảng Nhiệm vụ. Thao tác sửa chỉ hiện khi máy chủ cho phép (`availableActions` của hàng).
 */
export function MeetingRowMenu({ meeting, anchor, open, onOpenChange, onCancel }: MeetingRowMenuProps) {
  const router = useRouter();
  const feedback = useFeedback();
  // Cờ Trợ lý chỉ tải khi menu mở lần đầu
  const assistantOn = useRuntimeFeature("assistant", open);

  const positionAnchor = React.useMemo(() => {
    if (!anchor || anchor instanceof HTMLElement) return anchor ?? undefined;
    return { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0) };
  }, [anchor]);

  if (!meeting) return null;

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      feedback.notifySuccess(done);
    } catch {
      feedback.notifyError("Không sao chép được");
    }
  };

  // Khung chat nổi hỏi về cuộc họp; không có khung (điện thoại) thì mở trang Trợ lý với cuộc họp làm ngữ cảnh
  const askAssistant = () => {
    if (!askAssistantInDock({ type: "meeting", id: meeting.id })) {
      router.push(`/assistant?context=${encodeURIComponent(`meeting:${meeting.id}`)}`);
    }
  };

  return (
    <MenuRoot open={open} onOpenChange={onOpenChange}>
      <MenuContent
        anchor={positionAnchor}
        mobileSheet
        sheetTitle={meeting.title}
        aria-label={`Thao tác cuộc họp ${meeting.title}`}
        positionerClassName="z-50"
        className="w-56"
      >
        <MenuActionItem leading={<TaskIconView className={icon} />} shortcut="Enter" onClick={() => router.push(meetingPath(meeting.id))}>
          Xem chi tiết
        </MenuActionItem>
        <MenuSeparator className="my-1 border-t border-border/40" />
        <MenuActionItem
          leading={<TaskIconLink className={icon} />}
          onClick={() => void copy(`${window.location.origin}${meetingPath(meeting.id)}`, "Đã sao chép liên kết")}
        >
          Sao chép liên kết
        </MenuActionItem>
        <MenuActionItem leading={<TaskIconCopy className={icon} />} onClick={() => void copy(meetingSummaryText(meeting), "Đã sao chép thông tin cuộc họp")}>
          Sao chép tên, giờ, địa điểm
        </MenuActionItem>
        {assistantOn ? (
          <MenuActionItem leading={<AgentIcon className={icon} />} onClick={askAssistant}>
            Hỏi Trợ lý
          </MenuActionItem>
        ) : null}
        {canCancelMeeting(meeting) ? (
          <>
            <MenuSeparator className="my-1 border-t border-border/40" />
            <MenuActionItem destructive leading={<CalendarX2 className="size-4" />} onClick={() => onCancel(meeting)}>
              Hủy cuộc họp
            </MenuActionItem>
          </>
        ) : null}
      </MenuContent>
    </MenuRoot>
  );
}
