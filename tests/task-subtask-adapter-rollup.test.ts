import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mapPrismaTaskToSchoolTask,
  mapPrismaTaskToStaffTask,
} from "../src/lib/adapters/task-db-adapter";

describe("Task Subtask Adapter & Rollup Suite", () => {
  describe("mapPrismaTaskToSchoolTask", () => {
    test("preserves parentTask metadata and subtasks with accurate rollup metrics", () => {
      const rawParentTask: any = {
        id: "school-task-100",
        code: "NV-2026-09-100",
        title: "Xây dựng khung năng lực chuyển đổi số và DACUM 2026",
        description: "Chỉ đạo toàn diện kế hoạch chuyển đổi số khối hành chính và đào tạo",
        scope: "SCHOOL",
        status: "IN_PROGRESS",
        priority: "HIGH",
        progressPercent: 0, // Should be rolled up from subtasks
        academicMonth: 9,
        academicYear: "2026-2027",
        startDate: new Date("2026-09-01T08:00:00+07:00"),
        dueDate: new Date("2026-09-30T17:00:00+07:00"),
        departmentId: "bgh",
        department: {
          id: "bgh",
          name: "Ban Giám hiệu",
          shortName: "BGH",
        },
        parentTaskId: null,
        parentTask: null,
        assignees: [
          {
            userId: "user-dri-01",
            roleInTask: "PRIMARY_OWNER",
            user: { id: "user-dri-01", name: "TS. Lê Hoàng B", avatarUrl: "/avatars/dri.jpg" },
          },
          {
            userId: "user-collab-01",
            roleInTask: "COLLABORATOR",
            user: { id: "user-collab-01", name: "ThS. Đỗ C", avatarUrl: null },
          },
          {
            userId: "user-collab-02",
            roleInTask: "COLLABORATOR",
            user: { id: "user-collab-02", name: "KS. Phạm D", avatarUrl: null },
          },
        ],
        subTasks: [
          {
            id: "sub-01",
            code: "NV-2026-09-101",
            title: "Khảo sát hạ tầng mạng và an toàn thông tin",
            description: "Đánh giá hiện trạng hạ tầng mạng máy tính",
            scope: "DEPARTMENT",
            status: "COMPLETED",
            priority: "HIGH",
            progressPercent: 100,
            academicMonth: 9,
            academicYear: "2026-2027",
            startDate: new Date("2026-09-02T08:00:00+07:00"),
            dueDate: new Date("2026-09-15T17:00:00+07:00"),
            departmentId: "khoa-cntt",
            department: { id: "khoa-cntt", name: "Khoa CNTT" },
            assignees: [
              {
                userId: "user-sub-01",
                roleInTask: "PRIMARY_OWNER",
                user: { id: "user-sub-01", name: "ThS. Nguyễn Văn A", avatarUrl: "/avatars/a.jpg" },
              },
            ],
          },
          {
            id: "sub-02",
            code: "NV-2026-09-102",
            title: "Tổ chức hội thảo DACUM với chuyên gia doanh nghiệp",
            description: "Mời 10 chuyên gia đầu ngành đóng góp ý kiến",
            scope: "DEPARTMENT",
            status: "IN_PROGRESS",
            priority: "URGENT",
            progressPercent: 50,
            academicMonth: 9,
            academicYear: "2026-2027",
            startDate: new Date("2026-09-10T08:00:00+07:00"),
            dueDate: new Date("2026-09-25T17:00:00+07:00"),
            departmentId: "phong-daotao",
            department: { id: "phong-daotao", name: "Phòng Đào tạo" },
            assignees: [
              {
                userId: "user-sub-02",
                roleInTask: "PRIMARY_OWNER",
                user: { id: "user-sub-02", name: "TS. Trần Thị E", avatarUrl: null },
              },
              {
                userId: "user-sub-03",
                roleInTask: "COLLABORATOR",
                user: { id: "user-sub-03", name: "KS. Vũ F", avatarUrl: null },
              },
            ],
          },
          {
            id: "sub-03",
            code: "NV-2026-09-103",
            title: "Hoàn thiện báo cáo phân tích chức danh nghề",
            description: "Tổng hợp biểu đồ DACUM thành văn bản chính thức",
            scope: "DEPARTMENT",
            status: "NOT_STARTED",
            priority: "NORMAL",
            progressPercent: 0,
            academicMonth: 9,
            academicYear: "2026-2027",
            startDate: new Date("2026-09-15T08:00:00+07:00"),
            dueDate: new Date("2026-09-30T17:00:00+07:00"),
            departmentId: "phong-qlcl",
            department: { id: "phong-qlcl", name: "Phòng QLCL" },
            assignees: [
              {
                userId: "user-sub-04",
                roleInTask: "PRIMARY_OWNER",
                user: { id: "user-sub-04", name: "CN. Hoàng G", avatarUrl: null },
              },
            ],
          },
        ],
      };

      const mapped = mapPrismaTaskToSchoolTask(rawParentTask);

      // Single DRI & Collaborator assertions
      assert.equal(mapped.id, "school-task-100");
      assert.equal(mapped.code, "NV-2026-09-100");
      assert.equal(mapped.assignedTo, "TS. Lê Hoàng B");
      assert.equal(mapped.leadAssigneeName, "TS. Lê Hoàng B");
      assert.equal(mapped.leadAssigneeId, "user-dri-01");
      assert.equal(mapped.leadAssigneeAvatar, "/avatars/dri.jpg");
      assert.deepEqual(mapped.coAssignees, ["ThS. Đỗ C", "KS. Phạm D"]);
      assert.deepEqual(mapped.collaborators, ["ThS. Đỗ C", "KS. Phạm D"]);

      // Subtask metrics
      assert.equal(mapped.totalSubTasks, 3);
      assert.equal(mapped.completedSubTasks, 1);
      // Rollup calculation: (100 + 50 + 0) / 3 = 50%
      assert.equal(mapped.progress, 50);
      assert.equal(mapped.progressPercent, 50);

      // Subtasks mapped content & context preservation
      assert.ok(Array.isArray(mapped.subTasks));
      assert.equal(mapped.subTasks!.length, 3);

      const sub1 = mapped.subTasks![0];
      assert.equal(sub1.id, "sub-01");
      assert.equal(sub1.code, "NV-2026-09-101");
      assert.equal(sub1.assigneeName, "ThS. Nguyễn Văn A");
      assert.equal(sub1.parentSchoolTaskId, "school-task-100");
      assert.equal(sub1.parentSchoolTaskTitle, "Xây dựng khung năng lực chuyển đổi số và DACUM 2026");
      assert.equal(sub1.parentSchoolTaskCode, "NV-2026-09-100");
      assert.equal(sub1.parentTaskScope, "SCHOOL");

      const sub2 = mapped.subTasks![1];
      assert.equal(sub2.id, "sub-02");
      assert.equal(sub2.assigneeName, "TS. Trần Thị E");
      assert.equal(sub2.parentSchoolTaskId, "school-task-100");
      assert.ok(sub2.collaborators && sub2.collaborators.length === 1);
      assert.equal(sub2.collaborators![0].name, "KS. Vũ F");
      assert.ok(sub2.coAssignees && sub2.coAssignees.length === 1);
    });

    test("preserves parent progressPercent when explicitly greater than zero", () => {
      const rawTaskWithExplicitProgress: any = {
        id: "school-task-200",
        code: "NV-2026-09-200",
        title: "Dự án nâng cấp hệ thống phần mềm",
        scope: "SCHOOL",
        status: "IN_PROGRESS",
        priority: "HIGH",
        progressPercent: 85, // Explicitly set to 85%
        academicMonth: 9,
        academicYear: "2026-2027",
        startDate: new Date("2026-09-01T08:00:00Z"),
        dueDate: new Date("2026-09-30T17:00:00Z"),
        assignees: [
          {
            userId: "dri-1",
            roleInTask: "PRIMARY_OWNER",
            user: { name: "ThS. Phạm H" },
          },
        ],
        subTasks: [
          {
            id: "sub-201",
            title: "Kiểm thử tự động",
            status: "IN_PROGRESS",
            progressPercent: 20,
            dueDate: new Date("2026-09-20T17:00:00Z"),
            assignees: [
              {
                userId: "sub-dri",
                roleInTask: "PRIMARY_OWNER",
                user: { name: "KS. Mai K" },
              },
            ],
          },
        ],
      };

      const mapped = mapPrismaTaskToSchoolTask(rawTaskWithExplicitProgress);
      assert.equal(mapped.progress, 85);
      assert.equal(mapped.progressPercent, 85);
      assert.equal(mapped.totalSubTasks, 1);
      assert.equal(mapped.completedSubTasks, 0);
    });

    test("maps hierarchical child task with parentTask reference properly", () => {
      const rawChildTask: any = {
        id: "child-task-300",
        code: "NV-2026-09-300",
        title: "Tổ chức lớp tập huấn an toàn thông tin cơ sở",
        scope: "DEPARTMENT",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        progressPercent: 40,
        academicMonth: 9,
        academicYear: "2026-2027",
        startDate: new Date("2026-09-05T08:00:00Z"),
        dueDate: new Date("2026-09-28T17:00:00Z"),
        parentTaskId: "parent-root-50",
        parentTask: {
          id: "parent-root-50",
          code: "NV-2026-ROOT-50",
          title: "Chiến lược bảo đảm an toàn dữ liệu số QCET",
          scope: "SCHOOL",
        },
        assignees: [
          {
            userId: "user-dri-300",
            roleInTask: "PRIMARY_OWNER",
            user: { name: "TS. Đoàn N" },
          },
        ],
      };

      const mapped = mapPrismaTaskToSchoolTask(rawChildTask);
      assert.equal(mapped.parentTaskId, "parent-root-50");
      assert.equal(mapped.parentTaskTitle, "Chiến lược bảo đảm an toàn dữ liệu số QCET");
      assert.equal(mapped.parentTaskCode, "NV-2026-ROOT-50");
      assert.deepEqual(mapped.parentTask, {
        id: "parent-root-50",
        code: "NV-2026-ROOT-50",
        title: "Chiến lược bảo đảm an toàn dữ liệu số QCET",
        scope: "SCHOOL",
      });
    });
  });

  describe("mapPrismaTaskToStaffTask", () => {
    test("safely maps single DRI, collaborators, parent task breadcrumbs and status", () => {
      const rawPrismaRecord: any = {
        id: "task-sub-500",
        code: "NV-2026-09-500",
        title: "Triển khai cài đặt hệ thống chữ ký số VNPT-CA",
        description: "Cài đặt token và phần mềm ký số cho 11 phòng ban",
        scope: "DEPARTMENT",
        status: "WAITING_APPROVAL",
        priority: "HIGH",
        progressPercent: 90,
        academicMonth: 9,
        academicYear: "2026-2027",
        startDate: new Date("2026-09-01T08:00:00+07:00"),
        dueDate: new Date("2026-09-25T17:00:00+07:00"),
        updatedAt: new Date("2026-09-24T10:30:00+07:00"),
        departmentId: "phong-cntt",
        department: {
          id: "phong-cntt",
          name: "Phòng CNTT & Truyền thông",
          shortName: "P.CNTT",
        },
        parentTaskId: "parent-root-99",
        parentTask: {
          id: "parent-root-99",
          code: "NV-2026-09-099",
          title: "Hiện đại hóa hạ tầng điều hành điện tử",
          scope: "SCHOOL",
        },
        assignees: [
          {
            userId: "dri-uid-1",
            roleInTask: "PRIMARY_OWNER",
            user: { id: "dri-uid-1", name: "KS. Đặng Minh V", avatarUrl: "/avatars/v.png" },
          },
          {
            userId: "collab-uid-2",
            roleInTask: "COLLABORATOR",
            user: { id: "collab-uid-2", name: "CN. Ngô Q", avatarUrl: null },
          },
        ],
        deliverables: [
          {
            id: "deliv-10",
            title: "Bien_ban_ban_giao_token.pdf",
            fileUrl: "https://qcet.edu.vn/docs/bb-token.pdf",
            reviewStatus: "PENDING",
            createdAt: new Date("2026-09-24T09:00:00+07:00"),
          },
        ],
        dacumTaskDefId: "dacum-def-88",
      };

      const staffTask = mapPrismaTaskToStaffTask(rawPrismaRecord);

      // DRI assertions
      assert.equal(staffTask.id, "task-sub-500");
      assert.equal(staffTask.code, "NV-2026-09-500");
      assert.equal(staffTask.title, "Triển khai cài đặt hệ thống chữ ký số VNPT-CA");
      assert.equal(staffTask.assigneeName, "KS. Đặng Minh V");
      assert.equal(staffTask.assigneeId, "dri-uid-1");
      assert.equal(staffTask.assigneeAvatar, "/avatars/v.png");
      assert.equal(staffTask.assignedTo, "KS. Đặng Minh V");

      // Collaborators / Co-assignees assertions
      assert.ok(staffTask.collaborators);
      assert.equal(staffTask.collaborators!.length, 1);
      assert.equal(staffTask.collaborators![0].id, "collab-uid-2");
      assert.equal(staffTask.collaborators![0].name, "CN. Ngô Q");
      assert.ok(staffTask.coAssignees);
      assert.equal(staffTask.coAssignees!.length, 1);
      assert.equal(staffTask.coAssignees![0].id, "collab-uid-2");

      // Parent Task Breadcrumbs
      assert.equal(staffTask.parentSchoolTaskId, "parent-root-99");
      assert.equal(staffTask.parentSchoolTaskTitle, "Hiện đại hóa hạ tầng điều hành điện tử");
      assert.equal(staffTask.parentSchoolTaskCode, "NV-2026-09-099");
      assert.equal(staffTask.parentTaskScope, "SCHOOL");

      // Status mapping
      assert.equal(staffTask.status, "NEEDS_REVIEW");

      // Deliverable & Review requirements
      assert.equal(staffTask.requiresReview, true);
      assert.equal(staffTask.deliverables?.length, 1);
      assert.equal(staffTask.deliverables?.[0].name, "Bien_ban_ban_giao_token.pdf");
      assert.equal(staffTask.deliverables?.[0].url, "https://qcet.edu.vn/docs/bb-token.pdf");

      // Dates
      assert.equal(staffTask.dueDate, "2026-09-25");
      assert.equal(staffTask.internalDueDate, "2026-09-25");
      assert.equal(staffTask.updatedAt, "2026-09-24");
    });

    test("handles tasks with no collaborators and no parentTask gracefully", () => {
      const minimalRecord: any = {
        id: "task-solo-1",
        code: "NV-SOLO-1",
        title: "Bảo dưỡng máy in văn phòng",
        scope: "DEPARTMENT",
        status: "NOT_STARTED",
        priority: "LOW",
        progressPercent: 0,
        academicMonth: 9,
        academicYear: "2026-2027",
        startDate: new Date("2026-09-01T00:00:00Z"),
        dueDate: new Date("2026-09-10T00:00:00Z"),
        assignees: [],
        deliverables: [],
      };

      const staffTask = mapPrismaTaskToStaffTask(minimalRecord);
      assert.equal(staffTask.id, "task-solo-1");
      assert.equal(staffTask.assigneeName, "Chưa phân công");
      assert.equal(staffTask.assigneeId, undefined);
      assert.equal(staffTask.status, "NEW");
      assert.equal(staffTask.parentSchoolTaskId, "");
      assert.equal(staffTask.parentSchoolTaskTitle, undefined);
      assert.equal(staffTask.parentSchoolTaskCode, undefined);
      assert.deepEqual(staffTask.collaborators, []);
      assert.deepEqual(staffTask.coAssignees, []);
    });
  });

  describe("getLiveDashboardData Service Integration", () => {
    test("populates parent task relations, subtasks hierarchy, and rollup metrics", async () => {
      const { getLiveDashboardData } = await import("../src/lib/server/dashboard-service");
      const result = await getLiveDashboardData();

      assert.ok(result);
      assert.ok(Array.isArray(result.tasks));
      assert.ok(result.tasks.length > 0);

      // Find any task that has subtasks
      const taskWithSubs = result.tasks.find((t) => t.subTasks && t.subTasks.length > 0);
      if (taskWithSubs) {
        assert.ok(taskWithSubs.totalSubTasks! >= taskWithSubs.subTasks!.length);
        assert.ok(typeof taskWithSubs.progressPercent === "number");

        const firstSub = taskWithSubs.subTasks![0];
        assert.equal(firstSub.parentSchoolTaskId, taskWithSubs.id);
        assert.equal(firstSub.parentSchoolTaskTitle, taskWithSubs.title);
        assert.equal(firstSub.parentSchoolTaskCode, taskWithSubs.code);
        assert.ok(Array.isArray(firstSub.collaborators));
        assert.ok(Array.isArray(firstSub.coAssignees));
      }

      // Check leadAssigneeName presence across all tasks
      for (const t of result.tasks) {
        assert.ok(typeof t.leadAssigneeName === "string");
        assert.ok(Array.isArray(t.coAssignees));
        assert.ok(Array.isArray(t.subTasks));
      }
    });
  });
});
