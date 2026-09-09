import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getLiveDashboardData } from "../src/lib/server/dashboard-service";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";

test("getLiveDashboardData returns valid structure with zero NaN", async () => {
  const data = await getLiveDashboardData();
  assert.ok(data.stats.totalSchoolTasks > 0);
  assert.ok(!isNaN(data.stats.averageSchoolProgressPercent));
  assert.ok(!isNaN(data.stats.completionRate ?? 0));
  assert.ok(Array.isArray(data.departmentHealth));
  for (const dept of data.departmentHealth) {
    assert.ok(!isNaN(dept.averageProgressPercent), `dept ${dept.departmentId} averageProgressPercent is NaN`);
    assert.ok(!isNaN(dept.completionRate ?? 0), `dept ${dept.departmentId} completionRate is NaN`);
  }
});

test("getLiveDashboardData integrates both School and independent Unit tasks, excluding CANCELLED", async () => {
  const data = await getLiveDashboardData();
  assert.ok(data.tasks.length > 0);

  // Check no tasks have CANCELLED status
  const cancelledTasks = data.tasks.filter((t) => (t.status as string) === "CANCELLED");
  assert.equal(cancelledTasks.length, 0, "No CANCELLED tasks should be present in live dashboard tasks");

  // Check that independent unit tasks (DEPARTMENT scope) are included
  const departmentTasks = data.tasks.filter(
    (t) => (t as any).scope === "DEPARTMENT" || t.categoryLabel === "Chuyên môn" || t.categoryLabel === "Chuyên môn Khoa/Phòng"
  );
  assert.ok(departmentTasks.length > 0, "Should include independent unit/department tasks");

  // Check that school tasks are present
  const schoolTasks = data.tasks.filter(
    (t) => (t as any).scope === "SCHOOL" || t.categoryLabel === "Chỉ đạo cấp Trường"
  );
  assert.ok(schoolTasks.length > 0, "Should include school tasks");
});

test("getLiveDashboardData unifies reference date and adheres to zero hardcoded dates", async () => {
  const refDate = getSystemReferenceDate();
  const data = await getLiveDashboardData();

  // Upcoming items overdue check matches isTaskPastDue with getSystemReferenceDate()
  for (const item of data.upcoming) {
    const expectedOverdue = isTaskPastDue(item.dueDate, refDate);
    assert.equal(
      item.isOverdue,
      expectedOverdue,
      `Item ${item.id} (${item.title}) with dueDate ${item.dueDate} overdue status must match isTaskPastDue at ${refDate}`
    );
  }

  // Source code verification: zero hardcoded "2026-09-07", "2026-09-09", unanchored "new Date()" in overdue checks, or "as any" on status
  const serviceCode = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/server/dashboard-service.ts"),
    "utf8"
  );
  assert.equal(serviceCode.includes('"2026-09-07"'), false, "Must not contain hardcoded 2026-09-07");
  assert.equal(serviceCode.includes('"2026-09-09"'), false, "Must not contain hardcoded 2026-09-09");
  assert.equal(serviceCode.includes("status: t.status as any"), false, "Must not use as any on t.status");
  assert.equal(serviceCode.includes("t.dueDate < new Date()"), false, "Must not use unanchored new Date() for overdue comparison");
});

test("departmentHealth accurately calculates averageProgressPercent from task progressPercent", async () => {
  const data = await getLiveDashboardData();
  assert.ok(data.departmentHealth);
  assert.ok(data.departmentHealth.length >= 11);

  for (const dept of data.departmentHealth) {
    assert.ok(typeof dept.averageProgressPercent === "number");
    assert.ok(typeof dept.completionRate === "number");
    assert.ok(dept.averageProgressPercent >= 0 && dept.averageProgressPercent <= 100);
    assert.ok(dept.completionRate! >= 0 && dept.completionRate! <= 100);
  }
});
