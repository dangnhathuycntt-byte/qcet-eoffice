import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateTaskForm,
  getInitialTaskFormData,
  CATEGORY_OPTIONS,
  isFormDirty,
  takeFormSnapshot,
  resolveCreateTaskIdentity,
  type CreateTaskFormData,
  type CreateTaskPersonnelRef,
} from "../src/components/dashboard/create-task-modal";

describe("CreateTaskModal Helpers", () => {
  test("getInitialTaskFormData returns clean initial state", () => {
    const data = getInitialTaskFormData();
    assert.equal(data.level, "TRUONG");
    assert.equal(data.category, "CHUYEN_DOI_SO");
    assert.equal(data.title, "");
    assert.equal(data.leadAssigneeName, "");
    assert.equal(data.dueDate, "");
    assert.equal(data.description, "");
    assert.deepEqual(data.coAssignees, []);
    assert.equal(data.parentTaskId, undefined);
  });

  test("validateTaskForm validates required fields", () => {
    const invalidData: CreateTaskFormData = {
      level: "TRUONG",
      category: "CHUYEN_DOI_SO",
      title: "   ",
      leadAssigneeName: "",
      dueDate: "",
      description: "",
      coAssignees: [],
    };
    const errors = validateTaskForm(invalidData);
    assert.ok(errors.title, "Expected title error");
    assert.ok(errors.leadAssigneeName, "Expected leadAssigneeName error");
    assert.ok(errors.dueDate, "Expected dueDate error");

    const validData: CreateTaskFormData = {
      level: "TRUONG",
      category: "ATTT",
      title: "Kiểm tra an ninh mạng",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      description: "Mô tả chi tiết",
      coAssignees: ["Vinh"],
    };
    const noErrors = validateTaskForm(validData);
    assert.equal(Object.keys(noErrors).length, 0);
  });

  test("validateTaskForm requires parentTaskId when level is DON_VI if school tasks are provided or required", () => {
    const unitTaskWithoutParent: CreateTaskFormData = {
      level: "DON_VI",
      category: "CNTT",
      title: "Nâng cấp switch mạng phòng máy",
      leadAssigneeName: "Nguyễn Văn A",
      dueDate: "2026-09-25",
      description: "Bảo trì định kỳ",
      coAssignees: [],
      parentTaskId: "",
    };
    const errors = validateTaskForm(unitTaskWithoutParent);
    assert.equal(errors.title, undefined);
    assert.equal(errors.leadAssigneeName, undefined);
    assert.equal(errors.dueDate, undefined);
  });

});

// ──────────────────────────────────────────────────────────────────
// T4 Task 4: Draft guard, dirty-tracking, prefill, idempotency
// ──────────────────────────────────────────────────────────────────
describe("Task 4 — Form close guard & dirty state", () => {
  const blank = getInitialTaskFormData();

  test("Form rỗng (chưa thay đổi) → isFormDirty trả false", () => {
    const baseline = takeFormSnapshot(blank);
    const current = takeFormSnapshot(blank);
    assert.equal(isFormDirty(current, baseline), false);
  });

  test("Điền title → isFormDirty trả true; xóa lại → false", () => {
    const baseline = takeFormSnapshot(blank);
    const filled: CreateTaskFormData = { ...blank, title: "Kiểm tra mạng" };
    assert.equal(isFormDirty(filled, baseline), true);

    const cleared: CreateTaskFormData = { ...blank, title: "" };
    assert.equal(isFormDirty(cleared, baseline), false);
  });

  test("takeFormSnapshot tạo bản sao độc lập (coAssignees không shared reference)", () => {
    const original: CreateTaskFormData = { ...blank, coAssignees: ["Alice"] };
    const snap = takeFormSnapshot(original);
    original.coAssignees.push("Bob");
    assert.equal(snap.coAssignees.length, 1, "snapshot không bị ảnh hưởng khi original thay đổi");
    assert.equal(snap.coAssignees[0], "Alice");
  });

  test("isFormDirty phát hiện thay đổi coAssignees", () => {
    const baseline = takeFormSnapshot(blank);
    const withCo: CreateTaskFormData = { ...blank, coAssignees: ["Vinh"] };
    assert.equal(isFormDirty(withCo, baseline), true);
  });

  test("isFormDirty phát hiện thay đổi leadAssigneeName", () => {
    const baseline = takeFormSnapshot(blank);
    const changed: CreateTaskFormData = { ...blank, leadAssigneeName: "Trần Hùng" };
    assert.equal(isFormDirty(changed, baseline), true);
  });

  test("isFormDirty phát hiện thay đổi dueDate", () => {
    const baseline = takeFormSnapshot(blank);
    const changed: CreateTaskFormData = { ...blank, dueDate: "2026-10-01" };
    assert.equal(isFormDirty(changed, baseline), true);
  });

  test("isFormDirty phát hiện thay đổi description", () => {
    const baseline = takeFormSnapshot(blank);
    const changed: CreateTaskFormData = { ...blank, description: "Mô tả mới" };
    assert.equal(isFormDirty(changed, baseline), true);
  });

  test("isFormDirty phát hiện thay đổi priority", () => {
    const baseline = takeFormSnapshot({ ...blank, priority: "MEDIUM" });
    const changed: CreateTaskFormData = { ...blank, priority: "HIGH" };
    assert.equal(isFormDirty(changed, baseline), true);
  });

  test("isFormDirty bỏ qua khoảng trắng thừa ở title", () => {
    const baseline = takeFormSnapshot({ ...blank, title: "Tên việc" });
    const withSpaces: CreateTaskFormData = { ...blank, title: "  Tên việc  " };
    assert.equal(isFormDirty(withSpaces, baseline), false, "Whitespace thừa không được coi là dirty");
  });
});

describe("Task 4 — Prefill không ghi đè nội dung đang nhập", () => {
  test("Snapshot baseline chỉ nên lấy một lần khi mở form; prefill từ initialTitle tạo baseline với title đó", () => {
    // Mô phỏng: khi mở form với initialTitle, baseline có title = initialTitle
    const initialTitle = "Nhiệm vụ cha được truyền vào";
    const baseline: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: initialTitle,
      leadAssigneeName: "",
      dueDate: "",
    };
    const snap = takeFormSnapshot(baseline);

    // Form hiển thị đúng giá trị prefill
    assert.equal(snap.title, initialTitle);
    // Người dùng chưa nhập gì → không dirty
    assert.equal(isFormDirty(snap, baseline), false);

    // Người dùng sửa title → dirty
    const userEdited: CreateTaskFormData = { ...baseline, title: "Tôi đã sửa" };
    assert.equal(isFormDirty(userEdited, baseline), true);
  });

  test("Prefill initialLeadAssigneeName không dirty khi so với baseline có cùng giá trị", () => {
    const prefillName = "Trần Hùng";
    const baseline: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      leadAssigneeName: prefillName,
    };
    const snap = takeFormSnapshot(baseline);
    assert.equal(isFormDirty(snap, baseline), false);
  });
});

describe("Task 4 — resolveCreateTaskIdentity (idempotency guard)", () => {
  const personnel: CreateTaskPersonnelRef[] = [
    { id: "u1", name: "Trần Hùng", departmentId: "dept-dao-tao" },
    { id: "u2", name: "Nguyễn Ngọc Vinh", departmentId: "dept-cntt" },
  ];

  test("INSTITUTIONAL mode: tìm đúng người theo tên (case-insensitive)", () => {
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "trần hùng" },
      personnel,
      undefined,
      "INSTITUTIONAL"
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.assigneeId, "u1");
      assert.equal(result.departmentId, "dept-dao-tao");
    }
  });

  test("INSTITUTIONAL mode: tên không có trong danh mục → ok: false, field: leadAssigneeName", () => {
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "Người Lạ Không Có Trong Danh Mục" },
      personnel,
      undefined,
      "INSTITUTIONAL"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.field, "leadAssigneeName");
    }
  });

  test("INSTITUTIONAL mode: tên rỗng → ok: false, field: leadAssigneeName", () => {
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "" },
      personnel,
      undefined,
      "INSTITUTIONAL"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.field, "leadAssigneeName");
    }
  });

  test("PERSONAL mode: actor có trong directory → resolve bằng actor.id", () => {
    const actor = { id: "u1", name: "Trần Hùng" };
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "" },
      personnel,
      actor,
      "PERSONAL"
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.assigneeId, "u1");
      assert.equal(result.departmentId, "dept-dao-tao");
    }
  });

  test("PERSONAL mode: actor không có trong directory → ok: false, field: form", () => {
    const actor = { id: "u-unknown", name: "Người Ngoài" };
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "" },
      personnel,
      actor,
      "PERSONAL"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.field, "form");
    }
  });

  test("Directory rỗng → ok: false với field: form (không crash)", () => {
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "Trần Hùng" },
      [],
      undefined,
      "INSTITUTIONAL"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.field, "form");
    }
  });

  test("Personnel undefined → ok: false (không crash)", () => {
    const result = resolveCreateTaskIdentity(
      { leadAssigneeName: "Trần Hùng" },
      undefined,
      undefined,
      "INSTITUTIONAL"
    );
    assert.equal(result.ok, false);
  });
});

describe("Task 4 — Trường nâng cao bị ẩn có lỗi", () => {
  test("internalDueDate > dueDate tạo lỗi ngay cả khi advanced panel đang ẩn", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Test task",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-15",
      internalDueDate: "2026-09-20", // muộn hơn dueDate → lỗi
    };
    const errors = validateTaskForm(form);
    assert.ok(errors.internalDueDate, "internalDueDate lỗi phải được phát hiện");
  });

  test("requiredDeliverables bắt buộc cho DON_VI requiresReview ngay cả khi panel ẩn", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Test task",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-15",
      requiresReview: true,
      requiredDeliverables: "",
    };
    const errors = validateTaskForm(form);
    assert.ok(errors.requiredDeliverables, "requiredDeliverables lỗi phải được phát hiện");
  });
});

describe("Task 4 — Single DRI & collaborator constraint", () => {
  test("leadAssigneeName và coAssignees trùng nhau → validation error", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("TRUONG"),
      title: "Test task",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      coAssignees: ["Trần Hùng"], // Trùng với DRI
    };
    const errors = validateTaskForm(form);
    assert.ok(errors.coAssignees, "Phải phát hiện DRI trùng với collaborator");
    assert.ok(errors.coAssignees.includes("không thể đồng thời"));
  });

  test("coAssignees không trùng DRI → không có lỗi coAssignees", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("TRUONG"),
      title: "Test task",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      coAssignees: ["Nguyễn Ngọc Vinh"],
    };
    const errors = validateTaskForm(form);
    assert.equal(errors.coAssignees, undefined);
  });
});
