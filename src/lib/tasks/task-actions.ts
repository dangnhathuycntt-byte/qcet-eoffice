import type { TaskPriority, TaskStatus } from "@/types/dashboard";

export interface TaskActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
}

/**
 * Shared Task Action Layer (Plan v2 §13 / REQ-20 / Task Actions Engine)
 * Consolidates all task mutations into dedicated, typed domain commands.
 * All surfaces (Table, Context Menu, Detail View, Kanban) route through this layer.
 * Canonical status transitions: NOT_STARTED, IN_PROGRESS, WAITING_APPROVAL, COMPLETED, CANCELLED.
 */

/**
 * 1. Dedicated Command: updateTaskStatus
 * POST /api/tasks/[id]/actions/update-status
 * Transitions task lifecycle state according to domain State Machine rules.
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  note?: string,
  expectedVersion?: number
): Promise<TaskActionResult<{ taskId: string; status: TaskStatus; version: number; progressPercent?: number }>> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        note: note || undefined,
        expectedVersion,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.reason || errJson.message || `Lỗi cập nhật trạng thái (${res.status})`,
        code: errJson.code,
        fromStatus: errJson.fromStatus,
        toStatus: errJson.toStatus,
        reason: errJson.reason,
      };
    }

    const json = await res.json().catch(() => ({}));
    return { ok: true, data: json.data || json };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

/**
 * 2. Dedicated Command: submitTaskResult
 * POST /api/tasks/[id]/actions/submit-result
 * Submits work results / deliverables for Maker-Checker review.
 */
export async function submitTaskResult(
  taskId: string,
  payload: {
    summary?: string;
    title?: string;
    note?: string;
    reportUrl?: string;
    deliverableId?: string;
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
    completionRate?: number;
    expectedVersion?: number;
  }
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/submit-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi nộp kết quả (${res.status})`,
        code: errJson.code,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

/**
 * 3. Dedicated Command: approveTask
 * POST /api/tasks/[id]/actions/approve
 * Formal institutional approval of task results.
 */
export async function approveTask(
  taskId: string,
  options?: {
    stepId?: string;
    note?: string;
    allowBypass?: boolean;
    expectedVersion?: number;
  }
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options || {}),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi phê duyệt nhiệm vụ (${res.status})`,
        code: errJson.code,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

/**
 * 4. Dedicated Command: cancelTask
 * POST /api/tasks/[id]/actions/cancel
 * Explicit cancellation with required reason.
 */
export async function cancelTask(
  taskId: string,
  reason: string,
  expectedVersion?: number
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, expectedVersion }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi hủy nhiệm vụ (${res.status})`,
        code: errJson.code,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

/**
 * 5. Dedicated Command: startTask
 * POST /api/tasks/[id]/actions/start
 * Explicit start of a NOT_STARTED task.
 */
export async function startTask(
  taskId: string,
  note?: string,
  expectedVersion?: number
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, expectedVersion }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi bắt đầu nhiệm vụ (${res.status})`,
        code: errJson.code,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

/**
 * 6. Dedicated Command: updateTaskProgress
 * POST /api/tasks/[id]/actions/update-progress
 * Updates execution progress percentage (0-100%).
 */
export async function updateTaskProgress(
  taskId: string,
  progressPercent: number,
  note?: string,
  expectedVersion?: number
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/update-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressPercent, note, expectedVersion }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi cập nhật tiến độ (${res.status})`,
        code: errJson.code,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function updateTaskPriority(
  taskId: string,
  priority: TaskPriority
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi cập nhật độ ưu tiên (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function updateTaskAssignee(
  taskId: string,
  assigneeId: string,
  assigneeName?: string
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}/actions/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAssigneeId: assigneeId,
        newAssigneeName: assigneeName,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi phân công người chủ trì (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function updateTaskStartDate(
  taskId: string,
  startDate: string | null
): Promise<TaskActionResult> {
  try {
    const formattedStartDate = startDate && startDate.length === 10
      ? new Date(`${startDate}T00:00:00.000+07:00`).toISOString()
      : startDate || null;

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: formattedStartDate }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi thay đổi ngày bắt đầu (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function updateTaskDueDate(
  taskId: string,
  dueDate: string
): Promise<TaskActionResult> {
  try {
    const formattedDueDate = dueDate && dueDate.length === 10
      ? new Date(`${dueDate}T23:59:59.000+07:00`).toISOString()
      : dueDate || null;

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: formattedDueDate }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi thay đổi hạn hoàn thành (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function deleteTask(
  taskId: string,
  reason?: string
): Promise<TaskActionResult> {
  try {
    // Check if task cancel action or direct delete
    const res = await fetch(`/api/tasks/${taskId}/actions/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || "Hủy nhiệm vụ từ menu thao tác" }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi hủy nhiệm vụ (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function deleteDeliverable(
  taskId: string,
  deliverableId: string
): Promise<TaskActionResult> {
  try {
    const res = await fetch(
      `/api/tasks/${taskId}/deliverables?deliverableId=${encodeURIComponent(deliverableId)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi xóa tài liệu minh chứng (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}

export async function updateTaskCollaborators(
  taskId: string,
  collaboratorIds: string[]
): Promise<TaskActionResult> {
  try {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorIds }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi cập nhật người phối hợp (${res.status})`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi mạng hoặc máy chủ không phản hồi",
    };
  }
}
