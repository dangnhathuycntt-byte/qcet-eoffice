"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/ui/feedback-layer";
import type { AssistantTaskProposal } from "@/contracts/assistant";

/** Hộp tạo nhiệm vụ của app: tải khi bấm lần đầu, không nặng thêm lúc mở trang. */
const CreateTaskModal = dynamic(() => import("@/components/tasks/create/create-task-modal").then((mod) => mod.CreateTaskModal), {
  ssr: false,
});

/**
 * Hộp tạo nhiệm vụ chuẩn của Trợ lý: thẻ "Tạo nhiệm vụ" ở màn đầu mở hộp trống, thẻ đề xuất (propose_task, ADR-010) mở
 * hộp đã điền sẵn. Người dùng xem lại và tự bấm Tạo, máy chủ kiểm quyền `task.create`; Trợ lý không ghi gì. Hộp gắn từ
 * lần bấm đầu rồi giữ lại để đóng còn hiệu ứng.
 */
export function useCreateTaskLauncher(): {
  /** `onCreated` báo nhiệm vụ vừa tạo cho nơi mở (thẻ đề xuất chuyển sang "Đã tạo"). */
  openCreateTask: (proposal?: AssistantTaskProposal, onCreated?: (task: { id: string; code: string | null }) => void) => void;
  createTaskModal: React.ReactNode;
} {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [createTaskOpen, setCreateTaskOpen] = React.useState(false);
  const [createTaskMounted, setCreateTaskMounted] = React.useState(false);
  // Đề xuất đang mở; đặt cùng lượt render với lúc mở để hộp dựng lại theo đúng đề xuất này
  const [proposal, setProposal] = React.useState<AssistantTaskProposal | null>(null);
  const onCreatedRef = React.useRef<((task: { id: string; code: string | null }) => void) | null>(null);

  const openCreateTask = React.useCallback((next?: AssistantTaskProposal, onCreated?: (task: { id: string; code: string | null }) => void) => {
    setProposal(next ?? null);
    onCreatedRef.current = onCreated ?? null;
    setCreateTaskMounted(true);
    setCreateTaskOpen(true);
  }, []);

  const createTaskModal = createTaskMounted ? (
    <CreateTaskModal
      isOpen={createTaskOpen}
      onClose={() => setCreateTaskOpen(false)}
      initialProposal={proposal ?? undefined}
      onCreated={(task, { subtasks }) => {
        const notifyCard = onCreatedRef.current;
        onCreatedRef.current = null;
        // Mở từ thẻ đề xuất: thẻ tự chuyển sang "Đã tạo" kèm lối mở, không báo thêm toast trùng
        if (notifyCard) {
          notifyCard({ id: task.id, code: task.code ?? null });
          return;
        }
        // Việc con lỗi một phần thì hộp đã báo cảnh báo kèm "Mở nhiệm vụ"; không báo thêm "đã tạo" mâu thuẫn
        if (subtasks && subtasks.failed.length > 0) return;
        showToast({
          variant: "success",
          message: "Đã tạo nhiệm vụ.",
          action: { label: "Mở nhiệm vụ", onClick: () => router.push(`/tasks/${encodeURIComponent(task.id)}`) },
        });
      }}
    />
  ) : null;

  return { openCreateTask, createTaskModal };
}
