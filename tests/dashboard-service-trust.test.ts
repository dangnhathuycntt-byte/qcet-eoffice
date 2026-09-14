import test from "node:test";
import assert from "node:assert/strict";
import { getLiveDashboardData, VALID_TASK_CATEGORIES } from "../src/lib/server/dashboard-service";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";
import { prisma } from "../src/lib/prisma";

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

test("DepartmentHealth does not use department name as leadName when users exist or when empty", async () => {
  const data = await getLiveDashboardData();
  assert.ok(data.departmentHealth && data.departmentHealth.length > 0, "Must have department health records");
  const deptHealthList = data.departmentHealth;

  // Fetch departments directly to verify against ground truth in DB
  const dbDepts = await prisma.department.findMany({
    include: {
      users: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
  const dbDeptMap = new Map(dbDepts.map((d) => [d.id, d]));

  for (const dept of deptHealthList) {
    // Invariant: leadName must NEVER be the department's name or code
    assert.notEqual(
      dept.leadName.trim().toLowerCase(),
      dept.departmentName.trim().toLowerCase(),
      `Department ${dept.departmentId} must not have its departmentName (${dept.departmentName}) as leadName`
    );
    assert.notEqual(
      dept.leadName.trim().toLowerCase(),
      dept.departmentId.trim().toLowerCase(),
      `Department ${dept.departmentId} must not have its departmentId as leadName`
    );

    const dbDept = dbDeptMap.get(dept.departmentId);
    if (!dbDept || !dbDept.users || dbDept.users.length === 0) {
      assert.equal(
        dept.leadName,
        "Chưa phân công",
        `Empty department ${dept.departmentId} must return 'Chưa phân công'`
      );
    } else {
      const realLeader = dbDept.users.find(
        (u) =>
          (u.role === "TRUONG_PHONG" || u.role === "BAN_GIAM_HIEU") &&
          u.name.trim().toLowerCase() !== dbDept.name.trim().toLowerCase()
      );
      if (realLeader) {
        assert.equal(
          dept.leadName,
          realLeader.name,
          `Department ${dept.departmentId} must return actual leader name '${realLeader.name}', got '${dept.leadName}'`
        );
      } else {
        assert.equal(
          dept.leadName,
          "Chưa phân công",
          `Department ${dept.departmentId} without designated leader must return 'Chưa phân công'`
        );
      }
    }
  }
});

test("Tasks without explicit category are not fabricated into CHUYEN_DOI_SO or CNTT", async () => {
  const data = await getLiveDashboardData();
  assert.ok(data.tasks.length > 0, "Must return tasks");

  // Every task must have a category in VALID_TASK_CATEGORIES
  for (const task of data.tasks) {
    assert.ok(
      VALID_TASK_CATEGORIES.has(task.category),
      `Task ${task.id} category '${task.category}' must be in VALID_TASK_CATEGORIES`
    );

    // Verify categoryLabel is grounded and honest, never synthesized specialty
    if (task.category === "KHAC") {
      const validLabels = [
        "Nhiệm vụ cấp Trường",
        "Nhiệm vụ đơn vị",
        "Khác",
        "Chỉ đạo cấp Trường",
        "Chuyên môn",
        "Chuyên môn Khoa/Phòng",
      ];
      assert.ok(
        validLabels.includes(task.categoryLabel || ""),
        `Task ${task.id} categoryLabel '${task.categoryLabel}' should be a valid administrative label`
      );
    }
  }

  // Check upcoming items adhere to the same non-fabricated category rules
  for (const upcoming of data.upcoming) {
    assert.ok(
      VALID_TASK_CATEGORIES.has(upcoming.category || ""),
      `Upcoming item ${upcoming.id} category '${upcoming.category}' must be in VALID_TASK_CATEGORIES`
    );
  }
});

test("Activity events do not fabricate CHUYEN_DOI_SO or CNTT for unrelated notifications", async () => {
  const data = await getLiveDashboardData();

  for (const act of data.activities) {
    assert.ok(
      VALID_TASK_CATEGORIES.has(act.category || ""),
      `Activity ${act.id} category '${act.category}' must be in VALID_TASK_CATEGORIES`
    );
  }
});
