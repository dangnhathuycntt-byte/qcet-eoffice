import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getLiveDashboardData, VALID_TASK_CATEGORIES } from "../src/lib/server/dashboard-service";
import { prisma } from "../src/lib/prisma";

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

test("Source code static audit: complete eradication of synthetic fallbacks and placeholder lead names", () => {
  const serviceCode = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/server/dashboard-service.ts"),
    "utf8"
  );

  // Invariant 1: No fake specialty category based on scope
  assert.equal(
    serviceCode.includes('const category = isSchool ? "CHUYEN_DOI_SO" : "CNTT"'),
    false,
    "dashboard-service.ts must not fabricate category based on isSchool scope"
  );

  // Invariant 2: No using department name as leadName
  assert.equal(
    serviceCode.includes("leadName: d.name"),
    false,
    "dashboard-service.ts must not set leadName: d.name"
  );

  // Invariant 3: No fabricating CHUYEN_DOI_SO / CNTT from resolution notifications
  assert.equal(
    serviceCode.includes('category: n.category === "resolution" ? "CHUYEN_DOI_SO" : "CNTT"'),
    false,
    "dashboard-service.ts must not fabricate category based on notification category"
  );

  // Invariant 4: Must export VALID_TASK_CATEGORIES
  assert.ok(
    serviceCode.includes("export const VALID_TASK_CATEGORIES"),
    "dashboard-service.ts must export VALID_TASK_CATEGORIES"
  );
});
