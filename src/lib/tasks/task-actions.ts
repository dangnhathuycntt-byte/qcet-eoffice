import type { TaskPriority, TaskStatus } from "@/types/dashboard";

export interface TaskActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Shared Task Action Layer (Plan v2 §13 / REQ-20)
 * Consolidates all task mutations into a single authoritative client layer.
 * All surfaces (Table, Context Menu, Detail View, Kanban) must route through this layer.
 */

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  note?: string
): Promise<TaskActionResult> {
  let actionUrl = `/api/tasks/${taskId}/actions/update-progress`;
  let actionBody: Record<string, unknown> = { note };

  if (newStatus === "IN_PROGRESS") {
    actionUrl = `/api/tasks/${taskId}/actions/start`;
    actionBody = { note };
  } else if (newStatus === "COMPLETED") {
    actionUrl = `/api/tasks/${taskId}/actions/approve`;
    actionBody = { note: note || "Phê duyệt hoàn thành nhiệm vụ" };
  } else if (newStatus === "CANCELLED") {
    actionUrl = `/api/tasks/${taskId}/actions/cancel`;
    actionBody = { reason: note || "Hủy nhiệm vụ" };
  } else if (newStatus === "NEEDS_REVIEW" || newStatus === "WAITING_APPROVAL") {
    actionUrl = `/api/tasks/${taskId}/actions/submit-result`;
    actionBody = { note: note || "Nộp kết quả chờ phê duyệt", completionRate: 100 };
  }

  try {
    const res = await fetch(actionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actionBody),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error || errJson.message || `Lỗi cập nhật trạng thái (${res.status})`,
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
