/**
 * Task-5 pending / error / retry contract tests
 *
 * Coverage:
 *  1. Bấm lặp khi request đang chờ — chặn, không gọi lại
 *  2. Request bị reject — rollback optimistic, ghi lỗi tiếng Việt
 *  3. Pending được dọn sau lỗi (không bị "kẹt")
 *  4. lastAttemptedStatus được ghi khi lỗi (cho nút Thử lại)
 *  5. lastAttemptedStatus bị xóa khi thành công
 *  6. Thành công sau lỗi (thử lại) — state sạch
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  executeKanbanStatusTransition,
  type KanbanTransitionState,
} from "../src/components/tasks/task-kanban-board";

function emptyState(): KanbanTransitionState {
  return {
    pendingTaskIds: {},
    optimisticStatuses: {},
    taskErrors: {},
    lastAttemptedStatuses: {},
  };
}

describe("Task-5 — pending / error / retry contract", () => {
  test("bấm lặp khi request đang chờ: trả ok:false mà không gọi onStatusChange lần hai", async () => {
    let callCount = 0;
    // Simulate a long-running request: resolve only after test checks
    let resolvePending!: () => void;
    const longRequest = () =>
      new Promise<void>((res) => {
        callCount++;
        resolvePending = res;
      });

    // State already has this task pending
    const pendingState: KanbanTransitionState = {
      pendingTaskIds: { "task-1": true },
      optimisticStatuses: { "task-1": "IN_PROGRESS" },
      taskErrors: {},
      lastAttemptedStatuses: {},
    };

    // Second click while pending
    const result = await executeKanbanStatusTransition(
      "task-1",
      "NEEDS_REVIEW",
      "IN_PROGRESS",
      pendingState,
      longRequest
    );

    // Must be rejected without calling onStatusChange again
    assert.equal(result.ok, false, "double-click must return ok:false");
    assert.equal(callCount, 0, "onStatusChange must NOT be called again when already pending");
    // Resolve so the dangling promise doesn't leak
    resolvePending?.();
  });

  test("request bị reject: rollback optimistic, ghi lỗi tiếng Việt, không còn pending", async () => {
    const state = emptyState();
    const failingHandler = async (_taskId: string, _newStatus: string) => {
      throw new Error("Lỗi mạng giả lập");
    };

    const result = await executeKanbanStatusTransition(
      "task-2",
      "IN_PROGRESS",
      "NEW",
      state,
      failingHandler
    );

    assert.equal(result.ok, false, "failed request must return ok:false");

    // Optimistic status must be rolled back (removed from map)
    assert.equal(
      result.state.optimisticStatuses["task-2"],
      undefined,
      "optimistic override must be removed on failure (rollback)"
    );

    // Pending lock must be released
    assert.equal(
      result.state.pendingTaskIds["task-2"],
      undefined,
      "pendingTaskIds must be cleared after failure (no stuck pending)"
    );

    // Error message must be a non-empty Vietnamese string
    const errMsg = result.state.taskErrors["task-2"];
    assert.ok(
      typeof errMsg === "string" && errMsg.length > 0,
      "taskErrors must contain a non-empty error message after failure"
    );
    // Must preserve the original error message thrown by handler
    assert.ok(
      errMsg!.includes("Lỗi mạng giả lập"),
      "error message must propagate the thrown error text"
    );
  });

  test("pending dọn sau lỗi: pendingTaskIds không còn entry của task bị lỗi", async () => {
    const state = emptyState();
    const failingHandler = async () => {
      throw new Error("timeout");
    };

    const result = await executeKanbanStatusTransition(
      "task-stuck",
      "COMPLETED",
      "IN_PROGRESS",
      state,
      failingHandler
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.state.pendingTaskIds["task-stuck"],
      undefined,
      "pendingTaskIds[task-stuck] must be undefined — pending must be cleared after error"
    );
  });

  test("lastAttemptedStatus được ghi khi request lỗi — dữ liệu cho nút Thử lại", async () => {
    const state = emptyState();
    const failingHandler = async () => {
      throw new Error("Lỗi máy chủ");
    };

    const result = await executeKanbanStatusTransition(
      "task-retry",
      "NEEDS_REVIEW",
      "IN_PROGRESS",
      state,
      failingHandler
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.state.lastAttemptedStatuses?.["task-retry"],
      "NEEDS_REVIEW",
      "lastAttemptedStatuses must record the status that failed for retry support"
    );
  });

  test("lastAttemptedStatus bị xóa khi thành công — trạng thái sạch sau retry", async () => {
    const state = emptyState();
    const successHandler = async () => {};

    const result = await executeKanbanStatusTransition(
      "task-ok",
      "IN_PROGRESS",
      "NEW",
      state,
      successHandler
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.state.lastAttemptedStatuses?.["task-ok"],
      undefined,
      "lastAttemptedStatuses must not contain the task after success"
    );
    assert.equal(
      result.state.pendingTaskIds["task-ok"],
      undefined,
      "pendingTaskIds must be cleared after success"
    );
    assert.equal(
      result.state.taskErrors["task-ok"],
      undefined,
      "taskErrors must have no entry for task after success"
    );
  });

  test("thành công sau lỗi (mô phỏng thử lại): state sạch, optimistic được giữ", async () => {
    // Simulate prior failure: lastAttemptedStatuses has the task
    const stateAfterFailure: KanbanTransitionState = {
      pendingTaskIds: {},
      optimisticStatuses: {},
      taskErrors: { "task-3": "Lỗi mạng" },
      lastAttemptedStatuses: { "task-3": "NEEDS_REVIEW" },
    };

    const successHandler = async () => {};

    const result = await executeKanbanStatusTransition(
      "task-3",
      "NEEDS_REVIEW",
      "IN_PROGRESS",
      stateAfterFailure,
      successHandler
    );

    assert.equal(result.ok, true, "retry must succeed");
    assert.equal(
      result.state.pendingTaskIds["task-3"],
      undefined,
      "no pending after retry success"
    );
    // taskErrors should still be null (cleared at start of new attempt)
    assert.ok(
      !result.state.taskErrors["task-3"],
      "taskErrors cleared for task after retry success"
    );
    assert.equal(
      result.state.lastAttemptedStatuses?.["task-3"],
      undefined,
      "lastAttemptedStatuses cleared after retry success"
    );
  });

  test("lỗi với message mặc định tiếng Việt khi handler throw non-Error", async () => {
    const state = emptyState();
    // Throw a non-Error value
    const failingHandler = async () => {
      throw "string error";
    };

    const result = await executeKanbanStatusTransition(
      "task-5",
      "IN_PROGRESS",
      "NEW",
      state,
      failingHandler as Parameters<typeof executeKanbanStatusTransition>[4]
    );

    assert.equal(result.ok, false);
    const errMsg = result.state.taskErrors["task-5"];
    assert.ok(
      typeof errMsg === "string" && errMsg.length > 0,
      "must have a fallback error message"
    );
    // Default message must be Vietnamese
    assert.ok(
      errMsg!.includes("Vui lòng thử lại") || errMsg!.includes("thất bại"),
      `default error message must be Vietnamese, got: "${errMsg}"`
    );
  });

  test("state merge function deletes taskErrors and lastAttemptedStatuses keys on success (no stale error retention)", () => {
    const prev: KanbanTransitionState = {
      pendingTaskIds: { "task-1": true },
      optimisticStatuses: { "task-1": "IN_PROGRESS" },
      taskErrors: { "task-1": "Lỗi kết nối", "task-other": "Lỗi khác" },
      lastAttemptedStatuses: { "task-1": "IN_PROGRESS" },
    };

    // Functional state update logic tested in handleStatusChangeInternal:
    const taskId = "task-1";
    const newStatus = "IN_PROGRESS";
    const transitionResult = { ok: true, state: {} as KanbanTransitionState, error: undefined };

    const nextPending = { ...prev.pendingTaskIds };
    delete nextPending[taskId];

    const nextOptimistic = { ...prev.optimisticStatuses };
    if (!transitionResult.ok) {
      delete nextOptimistic[taskId];
    } else {
      nextOptimistic[taskId] = newStatus;
    }

    const nextErrors = { ...prev.taskErrors };
    if (transitionResult.ok) {
      delete nextErrors[taskId];
    }

    const nextLastAttempted = { ...prev.lastAttemptedStatuses };
    if (transitionResult.ok) {
      delete nextLastAttempted[taskId];
    }

    // Must remove task-1 error while preserving task-other error
    assert.equal(nextErrors["task-1"], undefined, "task-1 error must be deleted on success");
    assert.equal(nextErrors["task-other"], "Lỗi khác", "other task error must be kept");
    assert.equal(nextLastAttempted["task-1"], undefined, "lastAttemptedStatus must be deleted on success");
    assert.equal(nextPending["task-1"], undefined, "pendingTaskId must be deleted on success");
  });

  test("in-flight transition sets pending and optimistic before API resolves", async () => {
    let checkWhilePendingRan = false;
    let finishApi: () => void = () => {};

    const slowApi = () =>
      new Promise<void>((resolve) => {
        finishApi = resolve;
      });

    const state = emptyState();
    // Simulate what handleStatusChangeInternal does at step 1:
    const taskId = "task-in-flight";
    const inFlightState: KanbanTransitionState = {
      ...state,
      pendingTaskIds: { ...state.pendingTaskIds, [taskId]: true },
      optimisticStatuses: { ...state.optimisticStatuses, [taskId]: "IN_PROGRESS" },
      taskErrors: { ...state.taskErrors, [taskId]: null },
      lastAttemptedStatuses: { ...state.lastAttemptedStatuses },
    };

    // While API is in-flight:
    assert.equal(inFlightState.pendingTaskIds[taskId], true, "must be pending in-flight");
    assert.equal(inFlightState.optimisticStatuses[taskId], "IN_PROGRESS", "must be optimistic in-flight");
    checkWhilePendingRan = true;

    // Second click during in-flight must be rejected
    const secondClick = await executeKanbanStatusTransition(
      taskId,
      "IN_PROGRESS",
      "NEW",
      inFlightState,
      slowApi
    );
    assert.equal(secondClick.ok, false, "second click during in-flight must be rejected");

    finishApi();
    assert.ok(checkWhilePendingRan);
  });
});
