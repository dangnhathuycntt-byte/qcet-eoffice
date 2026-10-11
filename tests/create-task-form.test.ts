import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isCreateTaskFormDirty,
  validateCreateTaskForm,
  type CreateTaskFormData,
} from "../src/hooks/use-create-task-form";

const blank: CreateTaskFormData = {
  title: "",
  summary: "",
  description: "",
  priority: "MEDIUM",
  level: "DON_VI",
  selectedDeptCode: "CNTT",
  leadAssigneeId: "",
  startDate: "",
  dueDate: "",
  category: "CHUYEN_DOI_SO",
};

const valid: CreateTaskFormData = {
  ...blank,
  title: "Rà soát đề cương môn học",
  leadAssigneeId: "u-hung",
  dueDate: "2026-10-30",
};

describe("validateCreateTaskForm — trường bắt buộc", () => {
  test("form đủ tên, người phụ trách, thời hạn thì không lỗi", () => {
    assert.deepEqual(validateCreateTaskForm(valid), {});
  });

  test("thiếu tên, người phụ trách, thời hạn báo đúng từng trường", () => {
    const errors = validateCreateTaskForm(blank);
    assert.equal(errors.title, "Vui lòng nhập tên nhiệm vụ.");
    assert.equal(errors.lead, "Vui lòng chọn người phụ trách.");
    assert.equal(errors.dueDate, "Vui lòng chọn thời hạn.");
  });

  test("tên chỉ có khoảng trắng hoặc dưới 3 ký tự bị chặn", () => {
    assert.equal(validateCreateTaskForm({ ...valid, title: "   " }).title, "Vui lòng nhập tên nhiệm vụ.");
    assert.equal(validateCreateTaskForm({ ...valid, title: " ab " }).title, "Tên nhiệm vụ phải có ít nhất 3 ký tự.");
  });

  test("không có nhiệm vụ cha thì không kiểm hạn nhiệm vụ con", () => {
    assert.equal(validateCreateTaskForm({ ...valid, dueDate: "2030-01-01" }).dueDate, undefined);
  });
});

describe("isCreateTaskFormDirty — hỏi trước khi đóng", () => {
  test("form trống chưa sửa thì không dirty", () => {
    assert.equal(isCreateTaskFormDirty(blank, blank), false);
  });

  test("điền tên, mô tả, thời hạn, người phụ trách hoặc đổi ưu tiên thì dirty", () => {
    assert.equal(isCreateTaskFormDirty({ ...blank, title: "Họp giao ban" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, description: "Nội dung" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, dueDate: "2026-10-30" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, leadAssigneeId: "u-hung" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, priority: "HIGH" }, blank), true);
  });

  test("chỉ thêm khoảng trắng hoặc sửa rồi hoàn tác thì không dirty", () => {
    assert.equal(isCreateTaskFormDirty({ ...blank, title: "   " }, blank), false);
    const edited = { ...blank, title: "Họp" };
    assert.equal(isCreateTaskFormDirty({ ...edited, title: "" }, blank), false);
  });

  test("giá trị điền sẵn khi mở form (tên, người phụ trách, hạn) không tính là thay đổi", () => {
    const prefilled = { ...blank, title: "Nhiệm vụ từ văn bản", leadAssigneeId: "u-hung", dueDate: "2026-10-30" };
    assert.equal(isCreateTaskFormDirty(prefilled, prefilled), false);
    assert.equal(isCreateTaskFormDirty({ ...prefilled, title: "Nhiệm vụ đã sửa" }, prefilled), true);
  });
});
