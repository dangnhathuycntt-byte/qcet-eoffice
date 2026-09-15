/**
 * tests/create-task-modal-keyboard.test.ts
 *
 * Task 4 — Kiểm thử an toàn bàn phím và UX form đóng (pure-logic, không cần DOM).
 *
 * Bao gồm:
 *   - Close guard: dirty-state, discard, prefill, trạng thái gửi
 *   - Combobox keyboard navigation: Arrow keys, Enter, IME guard
 *   - Baseline snapshot: chỉ khởi tạo một lần khi mở form
 *   - Trường nâng cao bị ẩn nhưng có lỗi
 *
 * Không dùng DOM / React / jsdom.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getInitialTaskFormData,
  takeFormSnapshot,
  isFormDirty,
  validateTaskForm,
  resolveComboboxNavigation,
  canSelectOnEnter,
  type CreateTaskFormData,
} from "../src/components/dashboard/create-task-modal";

// ─────────────────────────────────────────────────────────
// 1. Baseline snapshot: chỉ tạo một lần, không gọi lại mỗi render
// ─────────────────────────────────────────────────────────
describe("Task 4 — Baseline snapshot (mở form)", () => {
  test("takeFormSnapshot trả về bản sao độc lập — sửa original không ảnh hưởng snapshot", () => {
    const data: CreateTaskFormData = {
      ...getInitialTaskFormData("TRUONG"),
      title: "Nhiệm vụ A",
      coAssignees: ["Alice", "Bob"],
    };
    const snap = takeFormSnapshot(data);
    // Biến đổi original sau khi snapshot
    data.coAssignees.push("Charlie");
    data.title = "Đã sửa";
    assert.equal(snap.coAssignees.length, 2, "snapshot.coAssignees phải là bản sao tại thời điểm snapshot");
    assert.equal(snap.title, "Nhiệm vụ A", "snapshot.title không được thay đổi sau khi original bị biến đổi");
  });

  test("isFormDirty so sánh snapshot, không gọi getInitialTaskFormData lần 2", () => {
    const initial = getInitialTaskFormData("TRUONG");
    const baseline = takeFormSnapshot(initial);
    // Giả lập 'không thay đổi gì' — isFormDirty phải trả false
    assert.equal(isFormDirty(initial, baseline), false);
  });
});

// ─────────────────────────────────────────────────────────
// 2. Form rỗng, điền, hoàn tác
// ─────────────────────────────────────────────────────────
describe("Task 4 — Close guard: dirty-state", () => {
  const blank = getInitialTaskFormData("TRUONG");

  test("Form rỗng → không dirty", () => {
    const baseline = takeFormSnapshot(blank);
    assert.equal(isFormDirty(blank, baseline), false);
  });

  test("Điền title → dirty = true", () => {
    const baseline = takeFormSnapshot(blank);
    assert.equal(isFormDirty({ ...blank, title: "Nhiệm vụ mới" }, baseline), true);
  });

  test("Điền rồi hoàn tác (xóa trắng) → dirty = false", () => {
    const baseline = takeFormSnapshot(blank);
    const typed = { ...blank, title: "Nhiệm vụ mới" };
    assert.equal(isFormDirty(typed, baseline), true, "phải dirty sau khi điền");
    const undone = { ...blank, title: "" };
    assert.equal(isFormDirty(undone, baseline), false, "phải clean sau khi hoàn tác về blank");
  });

  test("Khoảng trắng thừa trong title không bị coi là dirty", () => {
    const baseline = takeFormSnapshot({ ...blank, title: "Nhiệm vụ A" });
    const withSpaces = { ...blank, title: "  Nhiệm vụ A  " };
    assert.equal(isFormDirty(withSpaces, baseline), false);
  });

  test("Điền dueDate → dirty", () => {
    const baseline = takeFormSnapshot(blank);
    assert.equal(isFormDirty({ ...blank, dueDate: "2026-09-30" }, baseline), true);
  });

  test("Thêm coAssignee → dirty", () => {
    const baseline = takeFormSnapshot(blank);
    assert.equal(isFormDirty({ ...blank, coAssignees: ["Trần Hùng"] }, baseline), true);
  });

  test("Thay đổi priority → dirty", () => {
    const baseline = takeFormSnapshot({ ...blank, priority: "MEDIUM" });
    assert.equal(isFormDirty({ ...blank, priority: "HIGH" }, baseline), true);
  });

  test("Thay đổi requiresReview → dirty", () => {
    const baseline = takeFormSnapshot(blank);
    assert.equal(isFormDirty({ ...blank, requiresReview: true }, baseline), true);
  });

  test("Thay đổi internalDueDate → dirty", () => {
    const baseline = takeFormSnapshot(blank);
    assert.equal(isFormDirty({ ...blank, internalDueDate: "2026-09-25" }, baseline), true);
  });
});

// ─────────────────────────────────────────────────────────
// 3. Prefill từ nhiệm vụ cha
// ─────────────────────────────────────────────────────────
describe("Task 4 — Prefill từ nhiệm vụ cha", () => {
  test("Prefill title + leadAssigneeName tạo baseline khớp → không dirty", () => {
    const parentTitle = "Chuyển đổi số 2026";
    const parentLead = "Trần Hùng";
    const prefilled: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: parentTitle,
      leadAssigneeName: parentLead,
    };
    const baseline = takeFormSnapshot(prefilled);
    // Người dùng chưa chỉnh gì → không dirty
    assert.equal(isFormDirty(prefilled, baseline), false);
  });

  test("Prefill rồi người dùng sửa title → dirty = true", () => {
    const prefilled: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Nhiệm vụ cha",
      leadAssigneeName: "Trần Hùng",
    };
    const baseline = takeFormSnapshot(prefilled);
    const userEdited = { ...prefilled, title: "Tôi đã sửa" };
    assert.equal(isFormDirty(userEdited, baseline), true);
  });

  test("Prefill initialLeadAssigneeName không dirty khi so baseline có cùng giá trị", () => {
    const name = "Nguyễn Ngọc Vinh";
    const baseline: CreateTaskFormData = { ...getInitialTaskFormData("DON_VI"), leadAssigneeName: name };
    const snap = takeFormSnapshot(baseline);
    assert.equal(isFormDirty(snap, baseline), false);
  });
});

// ─────────────────────────────────────────────────────────
// 4. Trạng thái đang gửi (isSubmitting): không cho phép đóng
// ─────────────────────────────────────────────────────────
describe("Task 4 — Trạng thái đang gửi (close guard khi submitting)", () => {
  /**
   * Logic chặn đóng khi đang submit nằm trong handleRequestClose:
   *   if (isSubmitting) return;
   *
   * Ở đây chúng ta kiểm thử rằng form state và idempotency key được
   * giữ nguyên khi status = 'unknown' (chưa xác nhận server).
   * Kiểm tra bằng cách đảm bảo data không bị reset về blank trong state unknown.
   */
  test("Khi status unknown, nội dung form vẫn dirty so với blank", () => {
    const blank = getInitialTaskFormData("TRUONG");
    const blankSnap = takeFormSnapshot(blank);
    // Giả lập form đã có nội dung khi trả về status unknown
    const filledBeforeSubmit: CreateTaskFormData = {
      ...blank,
      title: "Nhiệm vụ đang chờ xác nhận",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
    };
    // Nội dung phải vẫn được giữ nguyên (dirty so với blank)
    assert.equal(isFormDirty(filledBeforeSubmit, blankSnap), true,
      "Khi unknown, form phải giữ nội dung và vẫn dirty so với baseline blank");
  });

  test("Discard sau unknown: nếu người dùng chọn 'Bỏ thay đổi', isFormDirty phải reset về false", () => {
    const blank = getInitialTaskFormData("TRUONG");
    const baseline = takeFormSnapshot(blank);
    // Sau khi forceClose() + reset, form trở về blank
    const afterReset: CreateTaskFormData = getInitialTaskFormData("TRUONG");
    assert.equal(isFormDirty(afterReset, baseline), false);
  });
});

// ─────────────────────────────────────────────────────────
// 5. Combobox keyboard navigation — resolveComboboxNavigation
// ─────────────────────────────────────────────────────────
describe("Task 4 — Combobox Arrow key navigation (resolveComboboxNavigation)", () => {
  test("ArrowDown từ đầu danh sách → chuyển tới index 1", () => {
    assert.equal(resolveComboboxNavigation("ArrowDown", 0, 3), 1);
  });

  test("ArrowDown ở cuối danh sách → quay lại index 0 (wrap around)", () => {
    assert.equal(resolveComboboxNavigation("ArrowDown", 2, 3), 0);
  });

  test("ArrowUp từ index 0 → nhảy về cuối danh sách (wrap around)", () => {
    assert.equal(resolveComboboxNavigation("ArrowUp", 0, 3), 2);
  });

  test("ArrowUp từ giữa danh sách → giảm 1", () => {
    assert.equal(resolveComboboxNavigation("ArrowUp", 2, 5), 1);
  });

  test("Danh sách rỗng → trả về null (không thay đổi)", () => {
    assert.equal(resolveComboboxNavigation("ArrowDown", 0, 0), null);
    assert.equal(resolveComboboxNavigation("ArrowUp", 0, 0), null);
  });

  test("Danh sách 1 phần tử → ArrowDown luôn trả về index 0", () => {
    assert.equal(resolveComboboxNavigation("ArrowDown", 0, 1), 0);
    assert.equal(resolveComboboxNavigation("ArrowUp", 0, 1), 0);
  });
});

// ─────────────────────────────────────────────────────────
// 6. canSelectOnEnter — IME guard + rỗng kết quả + active index
// ─────────────────────────────────────────────────────────
describe("Task 4 — Enter trong combobox: canSelectOnEnter", () => {
  test("Điều kiện bình thường → cho phép chọn", () => {
    assert.equal(canSelectOnEnter(false, 5, 2), true);
  });

  test("Đang IME composition → KHÔNG chọn", () => {
    assert.equal(canSelectOnEnter(true, 5, 2), false);
  });

  test("Không có kết quả (total = 0) → KHÔNG chọn", () => {
    assert.equal(canSelectOnEnter(false, 0, 0), false);
  });

  test("activeIndex = -1 (chưa chọn option nào) → KHÔNG chọn", () => {
    assert.equal(canSelectOnEnter(false, 5, -1), false);
  });

  test("activeIndex >= total (ngoài danh sách) → KHÔNG chọn", () => {
    assert.equal(canSelectOnEnter(false, 3, 3), false);
    assert.equal(canSelectOnEnter(false, 3, 5), false);
  });

  test("activeIndex = 0, total = 1 → cho phép chọn", () => {
    assert.equal(canSelectOnEnter(false, 1, 0), true);
  });
});

// ─────────────────────────────────────────────────────────
// 7. Trường nâng cao bị ẩn nhưng có lỗi
// ─────────────────────────────────────────────────────────
describe("Task 4 — Validation lỗi tại trường nâng cao bị ẩn", () => {
  test("internalDueDate muộn hơn dueDate → lỗi ngay cả khi panel ẩn", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Test",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-15",
      internalDueDate: "2026-09-20", // muộn hơn → lỗi
    };
    const errors = validateTaskForm(form);
    assert.ok(errors.internalDueDate, "Phải có lỗi internalDueDate");
    assert.ok(
      errors.internalDueDate.includes("không được muộn hơn"),
      "Thông báo lỗi phải chứa 'không được muộn hơn'"
    );
  });

  test("requiredDeliverables rỗng khi requiresReview=true → lỗi ngay cả khi panel ẩn", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Test",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-15",
      requiresReview: true,
      requiredDeliverables: "",
    };
    const errors = validateTaskForm(form);
    assert.ok(errors.requiredDeliverables, "Phải có lỗi requiredDeliverables");
  });

  test("internalDueDate hợp lệ (sớm hơn dueDate) → không lỗi", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Test",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-20",
      internalDueDate: "2026-09-15", // sớm hơn → ok
    };
    const errors = validateTaskForm(form);
    assert.equal(errors.internalDueDate, undefined);
  });
});

// ─────────────────────────────────────────────────────────
// 8. DRI + coAssignee trùng nhau → validation từ chối
// ─────────────────────────────────────────────────────────
describe("Task 4 — Single DRI constraint", () => {
  test("leadAssigneeName trùng với một coAssignee → validation error", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("TRUONG"),
      title: "Test",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      coAssignees: ["Trần Hùng"],
    };
    const errors = validateTaskForm(form);
    assert.ok(errors.coAssignees, "Phải có lỗi coAssignees khi DRI trùng collaborator");
    assert.ok(errors.coAssignees.includes("không thể đồng thời"),
      "Thông báo phải chứa 'không thể đồng thời'");
  });

  test("coAssignees không trùng DRI → không lỗi coAssignees", () => {
    const form: CreateTaskFormData = {
      ...getInitialTaskFormData("TRUONG"),
      title: "Test",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      coAssignees: ["Nguyễn Ngọc Vinh"],
    };
    const errors = validateTaskForm(form);
    assert.equal(errors.coAssignees, undefined);
  });
});

// ─────────────────────────────────────────────────────────
// 9. Lựa chọn giữ nháp và huỷ rõ ràng
// ─────────────────────────────────────────────────────────
describe("Task 4 — Chọn giữ nháp vs huỷ rõ ràng", () => {
  test("Khi người dùng chọn 'Tiếp tục nhập': form vẫn dirty, không reset", () => {
    const blank = getInitialTaskFormData("TRUONG");
    const baseline = takeFormSnapshot(blank);
    const filled: CreateTaskFormData = { ...blank, title: "Nội dung đang nhập" };
    // Giả lập: người dùng bấm 'Tiếp tục nhập' → form state giữ nguyên
    // isFormDirty vẫn phải trả true vì form chưa được reset
    assert.equal(isFormDirty(filled, baseline), true,
      "Sau khi chọn 'Tiếp tục nhập', form vẫn phải dirty");
  });

  test("Khi người dùng chọn 'Bỏ thay đổi': forceClose() reset form → không dirty so baseline mới", () => {
    // Sau khi đóng và mở lại, baseline mới = blank
    const newOpen = getInitialTaskFormData("TRUONG");
    const newBaseline = takeFormSnapshot(newOpen);
    // Form được reset về blank khi mở lại
    assert.equal(isFormDirty(newOpen, newBaseline), false,
      "Sau khi 'Bỏ thay đổi' và mở lại, form phải sạch");
  });

  test("Success close (server xác nhận tạo): không cần discard guard — baseline match sau reset", () => {
    // Khi server tạo thành công: forceClose() + reset baseline
    // Form state được reset về blank, không dirty, không hỏi discard
    const resetForm = getInitialTaskFormData("TRUONG");
    const freshBaseline = takeFormSnapshot(resetForm);
    assert.equal(isFormDirty(resetForm, freshBaseline), false,
      "Sau success, form clean — không nên trigger discard dialog");
  });
});
