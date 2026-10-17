"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/ui/feedback-layer";

/** Hộp tạo nhiệm vụ của app: tải khi bấm lần đầu, không nặng thêm lúc mở trang. */
const CreateTaskModal = dynamic(() => import("@/components/tasks/create/create-task-modal").then((mod) => mod.CreateTaskModal), {
  ssr: false,
});

/**
 * Thẻ "Tạo nhiệm vụ" ở màn đầu trang Trợ lý mở hộp tạo nhiệm vụ chuẩn: người dùng tự điền và bấm
 * Tạo, máy chủ kiểm quyền `task.create`. Trợ lý vẫn chỉ đọc (ADR-009), không tham gia tạo. Hộp gắn từ lần bấm đầu rồi
 * giữ lại để đóng còn hiệu ứng.
 */
export function useCreateTaskLauncher(): { openCreateTask: () => void; createTaskModal: React.ReactNode } {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [createTaskOpen, setCreateTaskOpen] = React.useState(false);
  const [createTaskMounted, setCreateTaskMounted] = React.useState(false);

  const openCreateTask = React.useCallback(() => {
    setCreateTaskMounted(true);
    setCreateTaskOpen(true);
  }, []);

  const createTaskModal = createTaskMounted ? (
    <CreateTaskModal
      isOpen={createTaskOpen}
      onClose={() => setCreateTaskOpen(false)}
      onCreated={(task, { subtasks }) => {
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
