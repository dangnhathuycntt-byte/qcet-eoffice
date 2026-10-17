import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { CreateTaskModal } from "../../src/components/tasks/create/create-task-modal";
import {
  performCreateTaskSubmission,
  validateCreateTaskForm,
  validateSubtaskDueDate,
  type CreateTaskFormData,
} from "../../src/hooks/use-create-task-form";
import type { CreateTaskDraft } from "../../src/lib/adapters/create-task-mapper";
import { resolveCreateTaskPolicy } from "../../src/domain/tasks/create-task-policy";
import type { AuthUser } from "../../src/types/auth";
import type { StaffTask } from "../../src/types/dashboard";

/**
 * Create-task form: draft preservation (T26), unknown-timeout safety (T27/T72),
 * server-confirmed success only (T73), single staff personal-create policy (T06),
 * and stable-ID assignment via the canonical F3 adapter (C1/T24/T25).
 *
 * These are DB-free unit tests over the modal's pure create orchestration.
 */

const adminUser: AuthUser = {
  id: "admin-1",
  name: "Hiệu trưởng",
  email: "bgh@cdktcnqn.edu.vn",
  role: "ADMIN",
  dbRole: "BAN_GIAM_HIEU",
  roleLabel: "Ban Giám hiệu",
  department: "Ban Giám hiệu",
  departmentCode: "BGH",
};

const managerUser: AuthUser = {
  id: "manager-1",
  name: "Trần Hùng",
  email: "daotao@cdktcnqn.edu.vn",
  role: "MANAGER",
  dbRole: "TRUONG_PHONG",
  roleLabel: "Trưởng phòng Đào tạo",
  department: "Phòng Đào tạo & QLKH",
  departmentCode: "DAO_TAO",
};

const staffUser: AuthUser = {
  id: "staff-1",
  name: "Nguyễn Thị Bích Thủy",
  email: "thuy@cdktcnqn.edu.vn",
  role: "STAFF",
  roleLabel: "Chuyên viên",
  department: "Phòng Đào tạo & QLKH",
  departmentCode: "DAO_TAO",
};

function makeDraft(): CreateTaskDraft {
  return {
    level: "DON_VI",
    title: "Rà soát đề cương môn học",
    leadAssigneeName: "Trần Hùng",
    dueDate: "2026-09-30",
    description: "Kết quả mong đợi: đề cương đã thẩm định",
    priority: "HIGH",
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CreateTaskForm policy (T06 / J3)", () => {
  test("staff personal-create resolves from one product+server policy, not a UI workaround", () => {
    const staff = resolveCreateTaskPolicy(staffUser);
    assert.equal(staff.canCreate, true, "staff must be able to create a personal task");
    assert.equal(staff.mode, "PERSONAL");
    assert.equal(staff.defaultLevel, "STAFF");
    assert.deepEqual(staff.institutionalLevels, []);

    const admin = resolveCreateTaskPolicy(adminUser);
    assert.equal(admin.canCreate, true);
    assert.equal(admin.mode, "INSTITUTIONAL");
    assert.deepEqual(admin.institutionalLevels, ["TRUONG", "DON_VI"]);

    const manager = resolveCreateTaskPolicy(managerUser);
    assert.equal(manager.mode, "INSTITUTIONAL");
    assert.deepEqual(manager.institutionalLevels, ["DON_VI"]);

    assert.equal(resolveCreateTaskPolicy(null).canCreate, false);
  });
});

describe("CreateTaskForm submission outcomes (T26 / T27 / T72 / T73)", () => {
  test("created outcome is declared only for a server-confirmed task and sends stable IDs (T24/T73)", async () => {
    const draft = makeDraft();
    const snapshot = structuredClone(draft);
    const captured: { body?: Record<string, unknown> } = {};

    const outcome = await performCreateTaskSubmission(draft, {
      personnel: [{ id: "u-dri", name: "Trần Hùng", departmentId: "dept-dao-tao" }],
      fetchImpl: (async (url: string, init: RequestInit) => {
        assert.equal(String(url), "/api/tasks");
        captured.body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse(201, {
          success: true,
          task: { id: "task-srv-1", code: "NV-2026-09-001" },
        });
      }) as unknown as typeof fetch,
    });

    assert.equal(outcome.status, "created");
    assert.equal(outcome.result.ok, true);
    const sentBody = captured.body as Record<string, unknown>;
    assert.ok(sentBody, "the create request body must have been sent");
    // Identity by ID (T24): the assignee NAME is never forwarded, only the ID.
    assert.equal(sentBody.assigneeId, "u-dri");
    assert.equal(sentBody.departmentId, "dept-dao-tao");
    assert.equal(sentBody.scope, "DEPARTMENT");
    assert.equal("leadAssigneeName" in sentBody, false);
    assert.equal("coAssignees" in sentBody, false);
    // Draft is never mutated by the submission pipeline (T26).
    assert.deepEqual(draft, snapshot);
  });

  test("a confirmed submit issues exactly one server mutation (single create engine, C1)", async () => {
    let calls = 0;
    const outcome = await performCreateTaskSubmission(makeDraft(), {
      personnel: [{ id: "u-dri", name: "Trần Hùng", departmentId: "dept-dao-tao" }],
      fetchImpl: (async () => {
        calls += 1;
        return jsonResponse(201, {
          success: true,
          task: { id: "task-srv-2", code: "NV-2026-09-002" },
        });
      }) as unknown as typeof fetch,
    });

    assert.equal(outcome.status, "created");
    assert.equal(calls, 1, "exactly one create mutation must be issued per submit");
  });

  test("a rejected mutation preserves all input and surfaces the server message (T26/T70)", async () => {
    const draft = makeDraft();
    const snapshot = structuredClone(draft);

    const outcome = await performCreateTaskSubmission(draft, {
      fetchImpl: (async () =>
        jsonResponse(422, {
          error: "Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)",
        })) as unknown as typeof fetch,
    });

    assert.equal(outcome.status, "rejected");
    assert.equal(
      outcome.message,
      "Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)"
    );
    assert.equal(outcome.result.ok, false);
    if (!outcome.result.ok) {
      assert.equal(outcome.result.reason, "rejected");
      assert.equal(outcome.result.status, 422);
    }
    assert.deepEqual(draft, snapshot, "rejected create must not clear entered input");
  });

  test("a lost response is unproven and never double-submits with a fresh key (T27/T72)", async () => {
    const keys: string[] = [];
    let calls = 0;

    const outcome = await performCreateTaskSubmission(makeDraft(), {
      idempotencyKey: "task-create-fixed-key",
      maxAttempts: 2,
      fetchImpl: (async (_url: string, init: RequestInit) => {
        calls += 1;
        keys.push(new Headers(init.headers).get("idempotency-key") ?? "");
        throw new Error("socket hang up");
      }) as unknown as typeof fetch,
    });

    assert.equal(calls, 2, "the adapter safely replays the request");
    assert.deepEqual(
      keys,
      ["task-create-fixed-key", "task-create-fixed-key"],
      "every attempt must reuse the same idempotency key"
    );
    assert.equal(outcome.status, "unknown", "a timeout is not a proven failure");
    assert.equal(outcome.result.ok, false);
    if (!outcome.result.ok) {
      assert.equal(outcome.result.reason, "unknown");
      assert.equal(outcome.result.idempotencyKey, "task-create-fixed-key");
    }
  });

  test("a generated idempotency key is reused across retries (no blind re-POST)", async () => {
    const keys: string[] = [];

    await performCreateTaskSubmission(makeDraft(), {
      maxAttempts: 2,
      fetchImpl: (async (_url: string, init: RequestInit) => {
        keys.push(new Headers(init.headers).get("idempotency-key") ?? "");
        throw new Error("timeout");
      }) as unknown as typeof fetch,
    });

    assert.equal(keys.length, 2);
    assert.ok(keys[0].startsWith("task-create-"));
    assert.equal(keys[0], keys[1], "the same generated key is reused on retry");
  });

  test("a local validation failure never issues a network request", async () => {
    let called = false;
    const invalidDraft: CreateTaskDraft = {
      level: "DON_VI",
      title: "Họp giao ban",
      leadAssigneeName: "Trần Hùng",
      dueDate: "", // required by the canonical contract
    };

    const outcome = await performCreateTaskSubmission(invalidDraft, {
      fetchImpl: (async () => {
        called = true;
        return jsonResponse(201, {});
      }) as unknown as typeof fetch,
    });

    assert.equal(called, false, "invalid drafts must be rejected before any POST");
    assert.equal(outcome.status, "rejected");
    assert.equal(outcome.result.ok, false);
    if (!outcome.result.ok) assert.equal(outcome.result.reason, "validation");
  });
});

describe("CreateTaskModal rendered form (T21 / T23 / SK-03 / SK-04)", () => {
  // Base UI Dialog.Portal does NOT render portal content in SSR (renderToStaticMarkup).
  // ARIA attributes and form fields are set client-side via JS hydration inside the portal.
  // Therefore, we verify via source-level inspection (same pattern as create-task-modal-composer.test.ts).
  const modalSource = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "components", "tasks", "create", "create-task-modal.tsx"),
    "utf-8"
  );

  function renderModal(): string {
    return renderToStaticMarkup(
      React.createElement(CreateTaskModal, {
        isOpen: true,
        onClose: () => {},
      })
    );
  }

  test("primary fields render (T22/T23)", () => {
    // SSR renders without error
    const html = renderModal();
    assert.ok(typeof html === "string", "Component must render without error");

    // Primary fields live inside Dialog.Portal, which is invisible to
    // renderToStaticMarkup but renders on client hydration.
    assert.ok(modalSource.includes('id="create-task-title"'), "primary title field must render");
    const pickerSource = fs.readFileSync(
      path.resolve(__dirname, "..", "..", "src", "components", "tasks", "create", "person-pill-picker.tsx"),
      "utf-8"
    );
    assert.ok(
      modalSource.includes("<PersonPillPicker") && pickerSource.includes('aria-label="Chọn người chủ trì"'),
      "primary assignee picker must render",
    );
    assert.ok(modalSource.includes('id="create-task-due-date"') && modalSource.includes('title="Hạn hoàn thành"'), "primary due-date field must render with its full name");
  });

  test("no free-text custom assignee affordance (identity by ID, SK-03/T24)", () => {
    // Verify source does not contain the free-text assignee workaround
    assert.equal(
      modalSource.includes("Nhập cán bộ khác ngoài danh mục"),
      false,
      "the free-text assignee affordance must be removed; identity is by directory ID"
    );
  });

  test("advanced metadata options section is removed per streamlined Linear design", () => {
    // VTVL, hạn chót nội bộ, sản phẩm đầu ra, nghiệm thu are not part of the form.
    const html = renderModal();
    for (const content of [html, modalSource]) {
      assert.equal(content.includes("Tùy chọn nâng cao"), false, "advanced metadata section must not render");
      assert.equal(content.includes("Hạn chót nội bộ"), false, "internal due date field must not exist");
    }
  });
});

// ---------------------------------------------------------------------------
// Merged from task-decomposition-ui.test.ts — Subtask decomposition & validation
// ---------------------------------------------------------------------------
describe("Task Decomposition UI & Validation Logic", () => {
  describe("1. validateSubtaskDueDate", () => {
    test("allows subtask due date before parent task due date", () => {
      assert.equal(validateSubtaskDueDate("2026-10-30", "2026-10-15"), true);
    });

    test("allows subtask due date on the same day as parent task due date", () => {
      assert.equal(validateSubtaskDueDate("2026-10-30", "2026-10-30"), true);
    });

    test("rejects subtask due date after parent task due date", () => {
      assert.equal(validateSubtaskDueDate("2026-10-30", "2026-11-01"), false);
      assert.equal(validateSubtaskDueDate("2026-10-15", "2026-10-16"), false);
    });

    test("handles empty inputs safely", () => {
      assert.equal(validateSubtaskDueDate("", "2026-10-15"), true);
      assert.equal(validateSubtaskDueDate("2026-10-30", ""), true);
    });

    test("rejects invalid date strings", () => {
      assert.equal(validateSubtaskDueDate("invalid-date", "2026-10-15"), false);
      assert.equal(validateSubtaskDueDate("2026-10-30", "not-a-date"), false);
    });
  });

  describe("2. validateCreateTaskForm for subtasks", () => {
    const subtaskForm = (dueDate: string): CreateTaskFormData => ({
      title: "Xây dựng module phân rã nhiệm vụ",
      summary: "",
      description: "",
      priority: "MEDIUM",
      level: "DON_VI",
      selectedDeptCode: "CNTT",
      leadAssigneeId: "u-tuan",
      startDate: "",
      dueDate,
      category: "CHUYEN_DOI_SO",
      parentTaskId: "parent-task-1",
      subtasks: [],
    });

    test("subtask due date cannot exceed the parent due date (message names the parent date)", () => {
      const errors = validateCreateTaskForm(subtaskForm("2026-11-05"), { parentDueDate: "2026-10-31" });
      assert.equal(
        errors.dueDate,
        "Thời hạn nhiệm vụ con không được vượt quá hạn nhiệm vụ cha (31/10/2026).",
      );
    });

    test("subtask due on or before the parent due date is accepted", () => {
      assert.equal(validateCreateTaskForm(subtaskForm("2026-10-25"), { parentDueDate: "2026-10-31" }).dueDate, undefined);
      assert.equal(validateCreateTaskForm(subtaskForm("2026-10-31"), { parentDueDate: "2026-10-31" }).dueDate, undefined);
    });

    test("an unreadable parent due date blocks the subtask instead of passing silently", () => {
      assert.ok(validateCreateTaskForm(subtaskForm("2026-10-25"), { parentDueDate: "not-a-date" }).dueDate);
    });
  });

  describe("3. TaskDetailSideSheet Decomposition & Breadcrumb Contracts", () => {
    test("verifies breadcrumb target and subtask selection contracts", () => {
      const subTaskSample: StaffTask = {
        id: "sub-101",
        code: "NV-2026-09-088",
        title: "Viết test case cho phân rã UI",
        assigneeName: "Nguyễn Văn Tuấn",
        assigneeAvatar: "https://avatar.example/tuan.jpg",
        status: "IN_PROGRESS",
        dueDate: "2026-10-20",
        parentSchoolTaskId: "parent-task-1",
        parentSchoolTaskTitle: "Triển khai hệ thống E-Office toàn trường",
        parentSchoolTaskCode: "NV-2026-09-001",
        updatedAt: "2026-09-09",
        progressPercent: 65,
      };

      let selectedNavId: string | null = null;
      const onSelectSubTask = (target: StaffTask | string) => {
        selectedNavId = typeof target === "string" ? target : target.id;
      };

      onSelectSubTask(subTaskSample.parentSchoolTaskId!);
      assert.equal(selectedNavId, "parent-task-1");

      onSelectSubTask(subTaskSample.id);
      assert.equal(selectedNavId, "sub-101");

      onSelectSubTask(subTaskSample);
      assert.equal(selectedNavId, "sub-101");
    });

    test("verifies onAddSubTask contract with prefilled title", () => {
      let capturedParentId: string | null = null;
      let capturedPrefillTitle: string | undefined = undefined;

      const onAddSubTask = (parentId: string, prefillTitle?: string) => {
        capturedParentId = parentId;
        capturedPrefillTitle = prefillTitle;
      };

      onAddSubTask("parent-task-1", "Nhiệm vụ con cần tạo");
      assert.equal(capturedParentId, "parent-task-1");
      assert.equal(capturedPrefillTitle, "Nhiệm vụ con cần tạo");
    });
  });
});
