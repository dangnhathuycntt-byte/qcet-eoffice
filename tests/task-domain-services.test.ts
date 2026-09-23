import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  taskPolicy,
  taskQueryService,
  taskCommandService,
  canUserCreateTask,
  canUserUpdateTask,
  canUserApproveTask,
  canUserDeleteTask,
  canUserSubmitDeliverable,
  canUserReviewDeliverable,
  canUserTransitionStatus,
  isPrivilegedUser,
  isDepartmentLeader,
} from '../src/server/tasks';
import { TaskScope, TaskStatus, TaskPriority, TaskActorRole, DeliverableReviewStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../src/server/api/request-context';
import { getSystemReferenceDate } from '../src/lib/academic-calendar';


describe('Task Domain Services & Policy Layer Tests (Phase 4 & Phase 5)', () => {
  let adminUser: AuthenticatedUser;
  let managerUser: AuthenticatedUser;
  let staffUser1: AuthenticatedUser;
  let staffUser2: AuthenticatedUser;
  let otherDeptManager: AuthenticatedUser;

  let testDept1Id: string;
  let testDept2Id: string;
  const createdTaskIds: string[] = [];

  before(async () => {
    // 1. Setup test departments
    const departments = await prisma.organizationalUnit.findMany({ take: 2 });
    assert.ok(departments.length >= 2, 'Need at least 2 departments for boundary testing');
    testDept1Id = departments[0].id;
    testDept2Id = departments[1].id;

    // 2. Setup mock authenticated users
    adminUser = {
      id: 'mock-admin-01',
      email: 'admin@cdktcnqn.edu.vn',
      name: 'Ban Giám Hiệu 1',
      role: 'BAN_GIAM_HIEU',

    };

    managerUser = {
      id: 'mock-manager-01',
      email: 'truongphong@cdktcnqn.edu.vn',
      name: 'Trưởng phòng Đào tạo',
      role: 'TRUONG_PHONG',

    };

    staffUser1 = {
      id: 'mock-staff-01',
      email: 'chuyenvien1@cdktcnqn.edu.vn',
      name: 'Chuyên viên 1',
      role: 'CHUYEN_VIEN',

    };

    staffUser2 = {
      id: 'mock-staff-02',
      email: 'chuyenvien2@cdktcnqn.edu.vn',
      name: 'Chuyên viên 2',
      role: 'CHUYEN_VIEN',

    };

    otherDeptManager = {
      id: 'mock-manager-02',
      email: 'truongphong2@cdktcnqn.edu.vn',
      name: 'Trưởng phòng Khác',
      role: 'TRUONG_PHONG',

    };

    // Ensure users exist or pick real database users for DB relations
    const realUsers = await prisma.user.findMany({ take: 4 });
    if (realUsers.length >= 4) {
      staffUser1.id = realUsers[0].id;
      staffUser2.id = realUsers[1].id;
      adminUser.id = realUsers.find(u => u.role === 'BAN_GIAM_HIEU' || u.role === 'ADMIN')?.id || realUsers[2].id;
      managerUser.id = realUsers[3].id;
    }
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.document.updateMany({
        where: { linkedTaskId: { in: createdTaskIds } },
        data: { linkedTaskId: null },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      const allTasks = await prisma.task.findMany({
        where: { id: { in: createdTaskIds } },
        select: { id: true, parentTaskId: true },
      });
      const subtaskIds = allTasks.filter(t => t.parentTaskId).map(t => t.id);
      const parentIds = allTasks.filter(t => !t.parentTaskId).map(t => t.id);

      if (subtaskIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: subtaskIds } } });
      }
      if (parentIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: parentIds } } });
      }
    }
  });

  describe('1. Task Policy & Authorization Rules', () => {
    test('canUserCreateTask: enforces scope authority (Role Is Not Scope)', () => {
      // SCHOOL scope requires privileged role
      const adminCanCreateSchool = canUserCreateTask(adminUser, { scope: TaskScope.SCHOOL });
      assert.strictEqual(adminCanCreateSchool.allowed, true);

      const staffCanCreateSchool = canUserCreateTask(staffUser1, { scope: TaskScope.SCHOOL });
      assert.strictEqual(staffCanCreateSchool.allowed, false);
      assert.match(staffCanCreateSchool.reason || '', /Ban Giám hiệu hoặc Quản trị viên/i);

      // DEPARTMENT scope requires authority over that unit (P0-06): a leader of
      // it, or a privileged actor. INDIVIDUAL remains open to any authenticated user.
      const managerCanCreateDept = canUserCreateTask(managerUser, { scope: TaskScope.DEPARTMENT, departmentId: testDept1Id });
      assert.strictEqual(managerCanCreateDept.allowed, true);

      const staffCanCreateIndiv = canUserCreateTask(staffUser1, { scope: TaskScope.INDIVIDUAL, departmentId: testDept1Id });
      assert.strictEqual(staffCanCreateIndiv.allowed, true);

      // P0-06 regression: an actor without unit authority creates PERSONAL tasks
      // only. Previously DEPARTMENT scope was ungated here, so a staff account
      // could create a unit task by calling the API directly.
      const staffCanCreateDept = canUserCreateTask(staffUser1, {
        scope: TaskScope.DEPARTMENT,

      });
      assert.strictEqual(staffCanCreateDept.allowed, false);
      assert.match(staffCanCreateDept.reason || '', /cá nhân/i);

      // A leader of a DIFFERENT unit must not create in this one.
      const foreignLeader = { ...managerUser, departmentId: 'dept-not-theirs' };
      const foreignLeaderDept = canUserCreateTask(foreignLeader, {
        scope: TaskScope.DEPARTMENT,

      });
      assert.strictEqual(foreignLeaderDept.allowed, false);

      // Subtask exception: an INHERITED scope is not re-adjudicated, so a staff
      // member can still add a subtask to a unit task they work on.
      const staffSubtask = canUserCreateTask(staffUser1, {
        scope: TaskScope.DEPARTMENT,

        scopeExplicit: false,
      });
      assert.strictEqual(staffSubtask.allowed, true);
    });

    test('canUserUpdateTask: verifies update permissions across roles', () => {
      const taskInDept1 = {
        createdById: staffUser1.id,

        assignees: [{ userId: staffUser1.id }, { userId: staffUser2.id }],
      };

      // Creator can update
      assert.strictEqual(canUserUpdateTask(staffUser1, taskInDept1).allowed, true);

      // Assignee can update
      assert.strictEqual(canUserUpdateTask(staffUser2, taskInDept1).allowed, true);

      // Department leader of dept1 can update
      assert.strictEqual(canUserUpdateTask(managerUser, taskInDept1).allowed, true);

      // Admin can update
      assert.strictEqual(canUserUpdateTask(adminUser, taskInDept1).allowed, true);

      // Manager of OTHER department cannot update
      const otherDeptUpdate = canUserUpdateTask(otherDeptManager, taskInDept1);
      assert.strictEqual(otherDeptUpdate.allowed, false);
      assert.match(otherDeptUpdate.reason || '', /Bạn không có quyền chỉnh sửa/i);
    });

    test('canUserApproveTask: enforces Segregation of Duties (chống tự duyệt)', () => {
      const taskDept1 = {
        scope: TaskScope.DEPARTMENT,
        createdById: managerUser.id,

        assignees: [{ userId: staffUser1.id }],
      };

      // Assignee cannot approve their own task (SoD violation)
      const selfApproval = canUserApproveTask(staffUser1, taskDept1);
      assert.strictEqual(selfApproval.allowed, false);
      assert.match(selfApproval.reason || '', /Segregation of Duties/i);

      // Manager of department CAN approve
      const managerApproval = canUserApproveTask(managerUser, taskDept1);
      assert.strictEqual(managerApproval.allowed, true);

      // Admin CAN approve
      const adminApproval = canUserApproveTask(adminUser, taskDept1);
      assert.strictEqual(adminApproval.allowed, true);

      // When assignee has active delegation, approval is allowed
      const delegatedApproval = canUserApproveTask(staffUser1, taskDept1, { activeDelegation: true });
      assert.strictEqual(delegatedApproval.allowed, true);
    });

    test('canUserApproveTask: enforces School Scope approval restrictions', () => {
      const schoolTask = {
        scope: TaskScope.SCHOOL,
        createdById: adminUser.id,

        assignees: [{ userId: staffUser1.id }],
      };

      // Manager cannot approve school task without delegation
      const managerSchoolApproval = canUserApproveTask(managerUser, schoolTask);
      assert.strictEqual(managerSchoolApproval.allowed, false);
      assert.match(managerSchoolApproval.reason || '', /Chỉ Ban Giám hiệu hoặc Quản trị viên/i);

      // Admin can approve school task
      const adminSchoolApproval = canUserApproveTask(adminUser, schoolTask);
      assert.strictEqual(adminSchoolApproval.allowed, true);
    });

    test('canUserReviewDeliverable: enforces Segregation of Duties on deliverable approval', () => {
      const task = {
        createdById: managerUser.id,

      };
      const deliverable = {
        uploadedById: staffUser1.id,
      };

      // Submitter cannot approve their own deliverable
      const selfReview = canUserReviewDeliverable(staffUser1, deliverable, task);
      assert.strictEqual(selfReview.allowed, false);
      assert.match(selfReview.reason || '', /Separation of Duties/i);

      // Department manager can review
      const managerReview = canUserReviewDeliverable(managerUser, deliverable, task);
      assert.strictEqual(managerReview.allowed, true);

      // Other department manager cannot review
      const unrelatedReview = canUserReviewDeliverable(otherDeptManager, deliverable, task);
      assert.strictEqual(unrelatedReview.allowed, false);
    });

    test('canUserDeleteTask: restricts deletion to creator or privileged role', () => {
      const task = { createdById: staffUser1.id };

      assert.strictEqual(canUserDeleteTask(staffUser1, task).allowed, true);
      assert.strictEqual(canUserDeleteTask(adminUser, task).allowed, true);
      assert.strictEqual(canUserDeleteTask(staffUser2, task).allowed, false);
    });
  });

  describe('2. Task Command Service (Atomic Mutations)', () => {
    let createdRootTaskId: string;
    let createdSubtaskId: string;

    test('createTask: creates root task with single DRI and deduplicated collaborators', async () => {
      const task = await taskCommandService.createTask(
        { user: adminUser },
        {
          title: 'Nhiệm vụ kiểm thử dịch vụ miền Canonical',
          description: 'Mô tả nhiệm vụ kiểm thử toàn diện',
          leadUnitId: testDept1Id,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          priority: 'high',
          scope: 'department',
          academicMonth: 11,
          academicYear: '2026-2027',
          assigneeId: staffUser1.id,
          collaboratorIds: [staffUser2.id, staffUser1.id], // duplicate staffUser1
        }
      );

      assert.ok(task?.id);
      createdRootTaskId = task.id;
      createdTaskIds.push(task.id);

      assert.strictEqual(task.title, 'Nhiệm vụ kiểm thử dịch vụ miền Canonical');
      assert.match(task.code, /^NV-2026-11-\d{3}$/);
      assert.strictEqual(task.scope, TaskScope.DEPARTMENT);
      assert.strictEqual(task.priority, TaskPriority.HIGH);

      // Verify single DRI and collaborator in DB (Phase 9: TaskAssignee → TaskActor)
      const actors = await prisma.taskActor.findMany({ where: { taskId: task.id } });
      const owners = actors.filter(a => a.role === TaskActorRole.DRI && a.isPrimaryDRI);
      const collabs = actors.filter(a => a.role === TaskActorRole.COLLABORATOR);

      assert.strictEqual(owners.length, 1);
      assert.strictEqual(owners[0].userId, staffUser1.id);
      assert.strictEqual(collabs.length, 1);
      assert.strictEqual(collabs[0].userId, staffUser2.id);
    });

    test('createTask: enforces canUserCreateTask authority and rejects non-privileged user creating SCHOOL scope', async () => {
      await assert.rejects(
        async () => {
          await taskCommandService.createTask(
            { user: staffUser1 },
            {
              title: 'Nhiệm vụ cấp trường trái quyền',
              leadUnitId: testDept1Id,
              dueDate: new Date('2026-11-20T17:00:00.000Z'),
              scope: 'school',
            }
          );
        },
        /Chỉ Ban Giám hiệu hoặc Quản trị viên/i
      );
    });

    test('createTask: prevents actor spoofing for non-privileged user and allows for privileged user', async () => {
      // 1. Non-privileged user attempts to spoof creatorId.
      // Actor is a unit leader (still NOT privileged — isPrivilegedUser is
      // ADMIN-only) because P0-06 restricts an explicit DEPARTMENT scope to a
      // leader of that unit; the anti-spoofing intent is unchanged.
      const staffCreatedTask = await taskCommandService.createTask(
        { user: managerUser },
        {
          title: 'Nhiệm vụ kiểm thử chống mạo danh creatorId',
          leadUnitId: testDept1Id,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          scope: 'department',
          creatorId: adminUser.id, // Attempt to spoof admin
        }
      );
      assert.ok(staffCreatedTask?.id);
      createdTaskIds.push(staffCreatedTask.id);
      assert.strictEqual(
        staffCreatedTask.createdById,
        managerUser.id,
        'Non-privileged user cannot spoof creatorId; must be user.id'
      );

      // 2. Privileged user can specify creatorId
      const adminCreatedTask = await taskCommandService.createTask(
        { user: adminUser },
        {
          title: 'Nhiệm vụ do BGH tạo hộ cấp dưới',
          leadUnitId: testDept1Id,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          scope: 'department',
          creatorId: staffUser1.id,
        }
      );
      assert.ok(adminCreatedTask?.id);
      createdTaskIds.push(adminCreatedTask.id);
      assert.strictEqual(
        adminCreatedTask.createdById,
        staffUser1.id,
        'Privileged user can specify effective creatorId'
      );
    });

    test('createTask: creates subtask and inherits department and academic metadata', async () => {
      const subtask = await taskCommandService.createTask(
        { user: staffUser1 },
        {
          title: 'Nhiệm vụ con giai đoạn 1',
          dueDate: new Date('2026-11-15T17:00:00.000Z'),
          parentTaskId: createdRootTaskId,
          assigneeId: staffUser2.id,
        }
      );

      assert.ok(subtask?.id);
      createdSubtaskId = subtask.id;
      createdTaskIds.push(subtask.id);

      assert.strictEqual(subtask.parentTaskId, createdRootTaskId);
      assert.strictEqual(subtask.departmentId, testDept1Id);
      assert.strictEqual(subtask.academicMonth, 11);
      assert.strictEqual(subtask.academicYear, '2026-2027');
    });

    test('updateTask: updates progress, priority, and assigns new DRI atomically', async () => {
      const updated = await taskCommandService.updateTask(
        { user: managerUser },
        createdRootTaskId,
        {
          progressPercent: 50,
          priority: 'urgent',
          assigneeId: staffUser2.id,
          collaboratorIds: [staffUser1.id],
        }
      );

      assert.strictEqual(updated.progressPercent, 50);
      assert.strictEqual(updated.priority, TaskPriority.URGENT);

      const actors2 = await prisma.taskActor.findMany({ where: { taskId: createdRootTaskId } });
      const owner = actors2.find(a => a.role === TaskActorRole.DRI && a.isPrimaryDRI);
      const collab = actors2.find(a => a.role === TaskActorRole.COLLABORATOR);

      assert.strictEqual(owner?.userId, staffUser2.id);
      assert.strictEqual(collab?.userId, staffUser1.id);
    });

    test('submitDeliverable and reviewDeliverable: runs complete approval workflow with SoD enforcement', async () => {
      // 0. Unrelated user attempts to submit deliverable -> rejected by canUserSubmitDeliverable
      await assert.rejects(
        async () => {
          await taskCommandService.submitDeliverable(
            { user: otherDeptManager },
            createdRootTaskId,
            {
              title: 'Minh chứng trái phép.pdf',
              fileUrl: 'https://qcet.edu.vn/files/unauthorized.pdf',
            }
          );
        },
        /Bạn không có quyền nộp minh chứng/i
      );

      // 1. Staff submits deliverable with attempted actor spoofing (uploadedById: adminUser.id)
      const deliverable = await taskCommandService.submitDeliverable(
        { user: staffUser2 },
        createdRootTaskId,
        {
          title: 'Báo cáo hoàn thành giai đoạn 1.pdf',
          fileUrl: 'https://qcet.edu.vn/files/report-01.pdf',
          fileType: 'PDF',
          uploadedById: adminUser.id, // Attempt to spoof admin
        }
      );

      assert.ok(deliverable.id);
      assert.strictEqual(deliverable.reviewStatus, DeliverableReviewStatus.PENDING);
      assert.strictEqual(
        deliverable.uploadedById,
        staffUser2.id,
        'uploadedById must always be authenticated user.id; client spoofing ignored'
      );

      // Verify task status moved to WAITING_APPROVAL
      const taskAfterSubmit = await prisma.task.findUnique({ where: { id: createdRootTaskId } });
      assert.strictEqual(taskAfterSubmit?.status, TaskStatus.WAITING_APPROVAL);

      // 2. Submitter attempts to review their own deliverable -> should fail with 403
      await assert.rejects(
        async () => {
          await taskCommandService.reviewDeliverable(
            { user: staffUser2 },
            createdRootTaskId,
            {
              deliverableId: deliverable.id,
              reviewStatus: 'APPROVED',
            }
          );
        },
        /Separation of Duties/i
      );

      // 3. Manager reviews deliverable with APPROVED -> task becomes COMPLETED
      const reviewed = await taskCommandService.reviewDeliverable(
        { user: managerUser },
        createdRootTaskId,
        {
          deliverableId: deliverable.id,
          reviewStatus: 'APPROVED',
          reviewNote: 'Đã nghiệm thu đạt chuẩn',
        }
      );

      assert.strictEqual(reviewed.reviewStatus, DeliverableReviewStatus.APPROVED);

      // All deliverables approved -> task completed
      const taskAfterApproval = await prisma.task.findUnique({ where: { id: createdRootTaskId } });
      assert.strictEqual(taskAfterApproval?.status, TaskStatus.COMPLETED);
      assert.strictEqual(taskAfterApproval?.progressPercent, 100);
      assert.ok(taskAfterApproval?.completedAt);
    });

    test('deleteTask: cascade deletes subtasks, deliverables, assignees, and unlinks documents', async () => {
      const deleteResult = await taskCommandService.deleteTask(
        { user: adminUser },
        createdRootTaskId
      );

      assert.strictEqual(deleteResult.success, true);

      // Both root task and subtask must be deleted
      const checkRoot = await prisma.task.findUnique({ where: { id: createdRootTaskId } });
      const checkSub = await prisma.task.findUnique({ where: { id: createdSubtaskId } });

      assert.strictEqual(checkRoot, null);
      assert.strictEqual(checkSub, null);
    });
  });

  describe('3. Task Query Service (Reads, Scopes, and Metrics)', () => {
    let metricTaskId: string;

    before(async () => {
      // Create a test task for query service assertions
      const t = await taskCommandService.createTask(
        { user: adminUser },
        {
          title: 'Nhiệm vụ kiểm thử TaskQueryService',
          leadUnitId: testDept1Id,
          dueDate: new Date('2026-10-15T17:00:00.000Z'),
          priority: 'normal',
          scope: 'department',
          academicMonth: 10,
          academicYear: '2026-2027',
          assigneeId: staffUser1.id,
        }
      );
      metricTaskId = t.id;
      createdTaskIds.push(t.id);
    });

    test('queryTasks: queries tasks by department and academic month with canonical pagination', async () => {
      const result = await taskQueryService.queryTasks(
        { user: staffUser1 },
        {

          academicMonth: 10,
          academicYear: '2026-2027',
        }
      );

      assert.ok(Array.isArray(result.tasks));
      assert.strictEqual(typeof result.total, 'number');
      assert.ok(result.total >= 1);
      assert.strictEqual(result.page, 1);
      assert.ok(result.pagination.totalPages >= 1);

      const found = result.tasks.find(t => t.id === metricTaskId);
      assert.ok(found, 'Should find the created task in query results');
      assert.strictEqual(found.title, 'Nhiệm vụ kiểm thử TaskQueryService');
    });

    test('queryTasks: supports scope=my and assignedTo=me', async () => {
      const myResult = await taskQueryService.queryTasks(
        { user: staffUser1 },
        { scope: 'my' }
      );

      assert.ok(Array.isArray(myResult.tasks));
      const hasMetricTask = myResult.tasks.some(t => t.id === metricTaskId);
      assert.strictEqual(hasMetricTask, true);

      // Verify for user2 who is not assigned
      const user2Result = await taskQueryService.queryTasks(
        { user: staffUser2 },
        { scope: 'my' }
      );
      const user2HasTask = user2Result.tasks.some(t => t.id === metricTaskId);
      assert.strictEqual(user2HasTask, false);
    });

    test('queryTasks: combines scope=my and assignedTo using AND when both are passed', async () => {
      // Both match staffUser1 -> task found
      const matchResult = await taskQueryService.queryTasks(
        { user: staffUser1 },
        { scope: 'my', assignedTo: staffUser1.id }
      );
      const hasMetricTask = matchResult.tasks.some(t => t.id === metricTaskId);
      assert.strictEqual(hasMetricTask, true);

      // scope=my is staffUser1, but assignedTo is staffUser2 (who is not assigned to metricTask)
      // If assignedTo overwrote scope, or if scope overwrote assignedTo, results would be wrong.
      // With AND combination, it returns empty because no task has both assigned as primary owner
      const mismatchResult = await taskQueryService.queryTasks(
        { user: staffUser1 },
        { scope: 'my', assignedTo: staffUser2.id }
      );
      const mismatchHasTask = mismatchResult.tasks.some(t => t.id === metricTaskId);
      assert.strictEqual(mismatchHasTask, false);
    });

    test('getTaskById: returns clean TaskDetailDTO and removes raw Prisma entity', async () => {
      const detail = await taskQueryService.getTaskById(metricTaskId);
      assert.ok(detail);
      assert.strictEqual(detail.success, true);
      assert.strictEqual(detail.task.id, metricTaskId);
      assert.strictEqual(detail.task.title, 'Nhiệm vụ kiểm thử TaskQueryService');
      assert.strictEqual((detail as any).raw, undefined, 'raw property must be completely removed');

      const entity = await taskQueryService.getTaskEntityForInternalUse(metricTaskId);
      assert.ok(entity);
      // Phase 9: department dropped, check leadUnit instead
      assert.ok(entity.leadUnitId !== undefined || entity.actors !== undefined);
    });

    test('getTaskMetrics: aggregates task statistics with canonical reference date comparison', async () => {
      const metrics = await taskQueryService.getTaskMetrics(
        { user: adminUser },
        {

          academicMonth: 10,
          academicYear: '2026-2027',
        }
      );

      assert.strictEqual(typeof metrics.total, 'number');
      assert.strictEqual(typeof metrics.completed, 'number');
      assert.strictEqual(typeof metrics.inProgress, 'number');
      assert.strictEqual(typeof metrics.waitingApproval, 'number');
      assert.strictEqual(typeof metrics.overdue, 'number');
      assert.strictEqual(typeof metrics.completionRate, 'number');
      assert.strictEqual(metrics.referenceDate, getSystemReferenceDate());
      assert.ok(metrics.completionRate >= 0 && metrics.completionRate <= 100);
    });
  });
});
