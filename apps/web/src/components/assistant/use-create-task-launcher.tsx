"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/ui/feedback-layer";
import type { AssistantProposalTask, AssistantTaskProposal } from "@qcet/contracts/assistant";
import type { ProposalTarget } from "@/components/assistant/assistant-model";

/** Hộp tạo nhiệm vụ của app: tải khi bấm lần đầu, không nặng thêm lúc mở trang. */
const CreateTaskModal = dynamic(() => import("@/components/tasks/create/create-task-modal").then((mod) => mod.CreateTaskModal), {
  ssr: false,
});

/** Hộp "Tạo tất cả" đề xuất: cũng chỉ tải khi bấm lần đầu. */
const AssistantBulkCreateDialog = dynamic(
  () => import("@/components/assistant/assistant-bulk-create-dialog").then((mod) => mod.AssistantBulkCreateDialog),
  { ssr: false },
);

type BulkCreated = (item: ProposalTarget, task: AssistantProposalTask) => Promise<void> | void;

/**
 * Hộp tạo nhiệm vụ chuẩn của Trợ lý: thẻ "Tạo nhiệm vụ" ở màn đầu mở hộp trống, thẻ đề xuất (propose_task, ADR-010) mở
 * hộp đã điền sẵn. Người dùng xem lại và tự bấm Tạo, máy chủ kiểm quyền `task.create`; Trợ lý không ghi gì. Hộp gắn từ
 * lần bấm đầu rồi giữ lại để đóng còn hiệu ứng.
 */
export function useCreateTaskLauncher(): {
  /**
   * `onCreated` báo nhiệm vụ vừa tạo cho nơi mở (thẻ đề xuất chuyển sang "Đã tạo"). `files`: tệp của lượt hỏi sinh ra đề
   * xuất, hộp đính kèm vào mô tả và đưa vào ô soạn của Agent để giữ ngữ cảnh. Tệp đã lưu cần tải về (promise) thì mở hộp
   * khi tải xong, để hộp nhận đủ tệp ngay lúc áp đề xuất.
   */
  openCreateTask: (
    proposal?: AssistantTaskProposal,
    onCreated?: (task: { id: string; code: string | null }) => void,
    files?: File[] | Promise<File[]>,
  ) => void;
  /**
   * "Tạo tất cả": hộp xem các đề xuất còn chờ và tự bấm Tạo một lần; `onCreated` báo từng nhiệm vụ vừa tạo cho thẻ của
   * nó (trả promise thì hộp chờ lưu xong mới tạo cái tiếp theo).
   */
  openBulkCreate: (items: ProposalTarget[], onCreated: BulkCreated) => void;
  /** Gắn cả hộp tạo nhiệm vụ lẫn hộp "Tạo tất cả". */
  createTaskModal: React.ReactNode;
} {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [createTaskOpen, setCreateTaskOpen] = React.useState(false);
  const [createTaskMounted, setCreateTaskMounted] = React.useState(false);
  // Đề xuất đang mở; đặt cùng lượt render với lúc mở để hộp dựng lại theo đúng đề xuất này
  const [proposal, setProposal] = React.useState<AssistantTaskProposal | null>(null);
  const [contextFiles, setContextFiles] = React.useState<File[]>([]);
  const onCreatedRef = React.useRef<((task: { id: string; code: string | null }) => void) | null>(null);
  const [bulk, setBulk] = React.useState<{ open: boolean; items: ProposalTarget[]; onCreated: BulkCreated } | null>(null);

  const openBulkCreate = React.useCallback((items: ProposalTarget[], onCreated: BulkCreated) => {
    if (items.length > 0) setBulk({ open: true, items, onCreated });
  }, []);

  const openCreateTask = React.useCallback(
    (next?: AssistantTaskProposal, onCreated?: (task: { id: string; code: string | null }) => void, pendingFiles?: File[] | Promise<File[]>) => {
      const open = (files?: File[]) => {
        setProposal(next ?? null);
        setContextFiles(next && files ? files : []);
        onCreatedRef.current = onCreated ?? null;
        setCreateTaskMounted(true);
        setCreateTaskOpen(true);
      };
      if (pendingFiles instanceof Promise) void pendingFiles.then(open, () => open());
      else open(pendingFiles);
    },
    [],
  );

  const bulkDialog = bulk ? (
    <AssistantBulkCreateDialog
      open={bulk.open}
      items={bulk.items}
      onClose={() => setBulk((prev) => (prev ? { ...prev, open: false } : prev))}
      onCreated={bulk.onCreated}
    />
  ) : null;

  const taskModal = createTaskMounted ? (
    <CreateTaskModal
      isOpen={createTaskOpen}
      onClose={() => setCreateTaskOpen(false)}
      initialProposal={proposal ?? undefined}
      initialContextFiles={contextFiles}
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

  const createTaskModal = (
    <>
      {taskModal}
      {bulkDialog}
    </>
  );

  return { openCreateTask, openBulkCreate, createTaskModal };
}
