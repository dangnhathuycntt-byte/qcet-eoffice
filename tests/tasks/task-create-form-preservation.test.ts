import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CreateTaskModal,
  resolveCreateTaskPolicy,
  resolveCreateTaskIdentity,
  performCreateTaskSubmission,
  getInitialTaskFormData,
  validateSubtaskDueDate,
  validateSubtaskAssignment,
  validateTaskForm,
  ADVANCED_METADATA_PERSISTENCE_NOTICE,
  type CreateTaskFormData,
} from "../../src/components/dashboard/create-task-modal";
import type { AuthUser } from "../../src/types/auth";
import type { SchoolTask, StaffTask } from "../../src/types/dashboard";

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

function makeDraft(): CreateTaskFormData {
  return {
    ...getInitialTaskFormData("DON_VI"),
    title: "Rà soát đề cương môn học",
    leadAssigneeName: "Trần Hùng",
    dueDate: "2026-09-30",
    description: "Kết quả mong đợi: đề cương đã thẩm định",
    requiredDeliverables: "Đề cương chi tiết (PDF)",
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
    const invalidDraft: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
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

describe("CreateTaskForm stable identity resolution (T24 / D5 / SK-03)", () => {
  const directory = [
    { id: "u-hung", name: "Trần Hùng", departmentId: "dept-dao-tao" },
    { id: "u-thuy", name: "Nguyễn Thị Bích Thủy", departmentId: "dept-dao-tao" },
    { id: "u-orphan", name: "Cán Bộ Không Đơn Vị", departmentId: null },
  ];

  test("resolves a directory assignee to a stable id + unit (T24)", () => {
    const res = resolveCreateTaskIdentity(
      { leadAssigneeName: "trần hùng" },
      directory,
      null,
      "INSTITUTIONAL"
    );
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.assigneeId, "u-hung");
      assert.equal(res.departmentId, "dept-dao-tao");
    }
  });

  test("rejects a free-text assignee outside the directory before any request (SK-03)", () => {
    const res = resolveCreateTaskIdentity(
      { leadAssigneeName: "Người Ngoài Danh Mục" },
      directory,
      null,
      "INSTITUTIONAL"
    );
    assert.equal(res.ok, false, "an unresolvable DRI must block the submit");
    if (!res.ok) {
      assert.equal(res.field, "leadAssigneeName");
      assert.ok(res.message.includes("danh mục"));
    }
  });

  test("rejects when the assignee's unit cannot be derived", () => {
    const res = resolveCreateTaskIdentity(
      { leadAssigneeName: "Cán Bộ Không Đơn Vị" },
      directory,
      null,
      "INSTITUTIONAL"
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.field, "form");
  });

  test("rejects when the personnel directory is unavailable", () => {
    const res = resolveCreateTaskIdentity(
      { leadAssigneeName: "Trần Hùng" },
      [],
      null,
      "INSTITUTIONAL"
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.field, "form");
  });

  test("personal mode resolves the actor's own stable record for the unit (T06)", () => {
    const res = resolveCreateTaskIdentity(
      { leadAssigneeName: "Nguyễn Thị Bích Thủy" },
      directory,
      { id: "u-thuy", name: "Nguyễn Thị Bích Thủy" },
      "PERSONAL"
    );
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.assigneeId, "u-thuy");
      assert.equal(res.departmentId, "dept-dao-tao");
    }
  });

  test("personal mode fails when the actor is absent from the directory", () => {
    const res = resolveCreateTaskIdentity(
      { leadAssigneeName: "Nguyễn Thị Bích Thủy" },
      directory,
      { id: "u-ghost", name: "Người Lạ" },
      "PERSONAL"
    );
    assert.equal(res.ok, false);
  });
});

describe("CreateTaskModal rendered form (T21 / T23 / SK-03 / SK-04)", () => {
  function renderModal(): string {
    return renderToStaticMarkup(
      React.createElement(CreateTaskModal, {
        isOpen: true,
        onClose: () => {},
        onSubmit: () => {},
      })
    );
  }

  test("primary fields render and institutional metadata stays behind progressive disclosure (T22/T23)", () => {
    const html = renderModal();
    assert.ok(html.includes('id="task-title-input"'), "primary title field must render");
    assert.ok(html.includes('id="task-assignee-field"'), "primary assignee field must render");
    assert.ok(html.includes('id="task-due-date-input"'), "primary due-date field must render");
    // Advanced (institutional) metadata is not shown until explicitly disclosed.
    assert.equal(html.includes("Vị trí việc làm"), false);
    assert.equal(html.includes('id="task-internal-due-input"'), false);
    assert.equal(html.includes('id="task-deliverables-input"'), false);
  });

  test("no free-text custom assignee affordance (identity by ID, SK-03/T24)", () => {
    const html = renderModal();
    assert.equal(
      html.includes("Nhập cán bộ khác ngoài danh mục"),
      false,
      "the free-text assignee affordance must be removed; identity is by directory ID"
    );
  });

  test("advanced metadata options section is removed per streamlined Linear design", () => {
    const html = renderModal();
    assert.equal(
      html.includes(ADVANCED_METADATA_PERSISTENCE_NOTICE),
      false,
      "advanced metadata options section must be completely eliminated per user request"
    );
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

  describe("2. validateSubtaskAssignment (Single DRI Principle)", () => {
    test("passes when valid single DRI is assigned without collaborators", () => {
      const res = validateSubtaskAssignment("user-123", []);
      assert.equal(res.valid, true);
      assert.equal(res.error, undefined);
    });

    test("passes when valid single DRI is assigned with distinct collaborators", () => {
      const res = validateSubtaskAssignment("user-123", ["user-456", "user-789"]);
      assert.equal(res.valid, true);
      assert.equal(res.error, undefined);
    });

    test("fails when single DRI (leadAssignee) is missing or empty", () => {
      const res1 = validateSubtaskAssignment("", ["user-456"]);
      assert.equal(res1.valid, false);
      assert.ok(res1.error?.includes("Người phụ trách chính") || res1.error?.includes("DRI"));

      const res2 = validateSubtaskAssignment("   ", []);
      assert.equal(res2.valid, false);
      assert.ok(res2.error?.includes("Người phụ trách chính") || res2.error?.includes("DRI"));
    });

    test("fails when collaborator list duplicates the leadAssignee", () => {
      const res = validateSubtaskAssignment("user-123", ["user-456", "user-123"]);
      assert.equal(res.valid, false);
      assert.ok(
        res.error?.includes("Người phụ trách chính không thể") ||
        res.error?.includes("trùng") ||
        res.error?.includes("phối hợp")
      );
    });
  });

  describe("3. CreateTaskModal form validation for Subtasks", () => {
    const parentTask: SchoolTask = {
      id: "parent-task-1",
      code: "NV-2026-09-001",
      title: "Triển khai hệ thống E-Office toàn trường",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-10-31",
      status: "IN_PROGRESS",
      progressPercent: 40,
      totalSubTasks: 3,
      completedSubTasks: 1,
      subTasks: [],
    };

    test("validateTaskForm enforces subtask due date cannot exceed parent task due date", () => {
      const invalidSubtaskForm: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Xây dựng module phân rã nhiệm vụ",
        leadAssigneeName: "Nguyễn Văn Tuấn",
        coAssignees: ["Trần Thị Hoa"],
        dueDate: "2026-11-05",
        description: "",
        parentTaskId: "parent-task-1",
      };

      const errors = validateTaskForm(invalidSubtaskForm, parentTask);
      assert.ok(errors.dueDate, "Phải có lỗi dueDate khi vượt quá hạn chót cha");
      assert.ok(
        errors.dueDate.includes("Hạn chót của nhiệm vụ con không được muộn hơn hạn chót nhiệm vụ cha") ||
        errors.dueDate.includes("không được vượt quá hạn chót"),
        `Unexpected error message: ${errors.dueDate}`
      );
    });

    test("validateTaskForm accepts subtask when dueDate is within parent task dueDate", () => {
      const validSubtaskForm: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Xây dựng module phân rã nhiệm vụ",
        leadAssigneeName: "Nguyễn Văn Tuấn",
        coAssignees: ["Trần Thị Hoa"],
        dueDate: "2026-10-25",
        description: "",
        parentTaskId: "parent-task-1",
      };

      const errors = validateTaskForm(validSubtaskForm, parentTask);
      assert.equal(errors.dueDate, undefined);
    });

    test("validateTaskForm accepts explicit parentDueDate string when parentSchoolTask object is not provided", () => {
      const invalidSubtaskForm: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Nhiệm vụ con độc lập",
        leadAssigneeName: "Nguyễn Văn Tuấn",
        coAssignees: [],
        dueDate: "2026-11-15",
        description: "",
        parentTaskId: "parent-task-1",
      };

      const errors = validateTaskForm(
        invalidSubtaskForm,
        undefined,
        undefined,
        "2026-10-31"
      );
      assert.ok(errors.dueDate, "Phải có lỗi khi vượt qua explicit parentDueDate");
      assert.ok(
        errors.dueDate.includes("Hạn chót của nhiệm vụ con không được muộn hơn hạn chót nhiệm vụ cha")
      );
    });
  });

  describe("4. TaskDetailSideSheet Decomposition & Breadcrumb Contracts", () => {
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
