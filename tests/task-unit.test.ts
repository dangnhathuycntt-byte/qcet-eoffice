import test from "node:test";
import assert from "node:assert/strict";
import { getTaskUnitId } from "../src/lib/tasks/task-unit";

test("đơn vị chủ trì ưu tiên hơn mã đơn vị chung", () => {
  assert.equal(getTaskUnitId({ leadDepartmentId: "dept-lead", departmentId: "dept-other" }), "dept-lead");
});

test("không có đơn vị chủ trì thì dùng departmentId, rồi department.id", () => {
  assert.equal(getTaskUnitId({ departmentId: "dept-a" }), "dept-a");
  assert.equal(getTaskUnitId({ department: { id: "dept-b" } }), "dept-b");
});

test("không xác định được đơn vị thì trả undefined (không giới hạn)", () => {
  assert.equal(getTaskUnitId(null), undefined);
  assert.equal(getTaskUnitId({}), undefined);
  assert.equal(getTaskUnitId({ department: "Khoa CNTT" }), undefined);
});
