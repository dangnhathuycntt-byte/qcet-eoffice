import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  taskStateMachine,
  TaskStateMachine,
  normalizeTaskStatus,
  categorizeRole,
  normalizeScope,
  type ActorContext,
  type TaskContext,
} from '../src/domain/tasks/state-machine';

describe('Task State Machine & Permission Matrix Contract Tests (Phase 19 & Phase 21)', () => {
  const staffActor: ActorContext = {
    id: 'user-staff-01',
    role: 'CHUYEN_VIEN',
    departmentId: 'dept-cntt',
  };

  const giangVienActor: ActorContext = {
    id: 'user-gv-01',
    role: 'GIANG_VIEN',
    departmentId: 'dept-cntt',
  };

  const managerActor: ActorContext = {
    id: 'user-mgr-01',
    role: 'TRUONG_PHONG',
    departmentId: 'dept-cntt',
  };

  const otherDeptManagerActor: ActorContext = {
    id: 'user-mgr-02',
    role: 'TRUONG_PHONG',
    departmentId: 'dept-kinhte',
  };

  const executiveActor: ActorContext = {
    id: 'user-bgh-01',
    role: 'BAN_GIAM_HIEU',
    departmentId: null,
  };

  const adminActor: ActorContext = {
    id: 'user-admin-01',
    role: 'ADMIN',
    departmentId: null,
  };

  const baseDepartmentTask: TaskContext = {
    id: 'task-dept-01',
    scope: 'DEPARTMENT',
    departmentId: 'dept-cntt',
    createdById: 'user-mgr-01',
    primaryOwnerId: 'user-staff-99',
    assigneeIds: ['user-staff-99'],
  };

  const baseSchoolTask: TaskContext = {
    id: 'task-school-01',
    scope: 'SCHOOL',
    departmentId: 'dept-cntt',
    createdById: 'user-bgh-01',
    primaryOwnerId: 'user-staff-99',
    assigneeIds: ['user-staff-99'],
  };

  describe('1. Normalization & Synonym Handling', () => {
    it('normalizes status synonyms correctly', () => {
      assert.strictEqual(normalizeTaskStatus('NEW'), 'NEW');
      assert.strictEqual(normalizeTaskStatus('TODO'), 'NEW');
      assert.strictEqual(normalizeTaskStatus('NOT_STARTED'), 'NEW');
      assert.strictEqual(normalizeTaskStatus('IN_PROGRESS'), 'IN_PROGRESS');
      assert.strictEqual(normalizeTaskStatus('WAITING_APPROVAL'), 'WAITING_APPROVAL');
      assert.strictEqual(normalizeTaskStatus('NEEDS_REVIEW'), 'WAITING_APPROVAL');
      assert.strictEqual(normalizeTaskStatus('COMPLETED'), 'COMPLETED');
      assert.strictEqual(normalizeTaskStatus('DONE'), 'COMPLETED');
      assert.strictEqual(normalizeTaskStatus('CANCELLED'), 'CANCELLED');
      assert.strictEqual(normalizeTaskStatus('CANCELED'), 'CANCELLED');
    });

    it('categorizes roles into standard hierarchy', () => {
      assert.strictEqual(categorizeRole('ADMIN'), 'EXECUTIVE');
      assert.strictEqual(categorizeRole('BAN_GIAM_HIEU'), 'EXECUTIVE');
      assert.strictEqual(categorizeRole('HIEU_TRUONG'), 'EXECUTIVE');
      assert.strictEqual(categorizeRole('TRUONG_PHONG'), 'MANAGER');
      assert.strictEqual(categorizeRole('TRUONG_DON_VI'), 'MANAGER');
      assert.strictEqual(categorizeRole('CHUYEN_VIEN'), 'STAFF');
      assert.strictEqual(categorizeRole('GIANG_VIEN'), 'STAFF');
      assert.strictEqual(categorizeRole('VAN_THU'), 'OTHER');
    });

    it('normalizes task scopes correctly', () => {
      assert.strictEqual(normalizeScope('SCHOOL'), 'SCHOOL');
      assert.strictEqual(normalizeScope('TRUONG'), 'SCHOOL');
      assert.strictEqual(normalizeScope('DEPARTMENT'), 'DEPARTMENT');
      assert.strictEqual(normalizeScope('DON_VI'), 'DEPARTMENT');
      assert.strictEqual(normalizeScope('INDIVIDUAL'), 'INDIVIDUAL');
      assert.strictEqual(normalizeScope('CA_NHAN'), 'INDIVIDUAL');
    });
  });

  describe('2. Legal State Transitions', () => {
    it('allows starting task: NEW -> IN_PROGRESS by Staff', () => {
      const res = taskStateMachine.canTransition(staffActor, baseDepartmentTask, 'NEW', 'IN_PROGRESS');
      assert.strictEqual(res.allowed, true);
    });

    it('allows starting task using synonym: NOT_STARTED -> IN_PROGRESS', () => {
      const res = taskStateMachine.canTransition(staffActor, baseDepartmentTask, 'NOT_STARTED', 'IN_PROGRESS');
      assert.strictEqual(res.allowed, true);
    });

    it('allows submitting task for review: IN_PROGRESS -> WAITING_APPROVAL by Staff', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask,
        'IN_PROGRESS',
        'WAITING_APPROVAL'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows submitting task using synonym: IN_PROGRESS -> NEEDS_REVIEW', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask,
        'IN_PROGRESS',
        'NEEDS_REVIEW'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows approving department task: WAITING_APPROVAL -> COMPLETED by Unit Manager (non-maker)', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows approving school task: WAITING_APPROVAL -> COMPLETED by Executive (non-maker)', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseSchoolTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows rejecting review: WAITING_APPROVAL -> IN_PROGRESS by Unit Manager', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows rejecting review: WAITING_APPROVAL -> IN_PROGRESS by Executive', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseSchoolTask,
        'WAITING_APPROVAL',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows no-op transition (fromStatus === toStatus)', () => {
      const res = taskStateMachine.canTransition(staffActor, baseDepartmentTask, 'IN_PROGRESS', 'IN_PROGRESS');
      assert.strictEqual(res.allowed, true);
    });
  });

  describe('3. Illegal Transitions & Transition Graph Integrity', () => {
    it('prohibits direct jump from NEW -> COMPLETED without approval', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseDepartmentTask,
        'NEW',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'INVALID_TRANSITION');
    });

    it('prohibits direct jump from NOT_STARTED -> COMPLETED', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'NOT_STARTED',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'INVALID_TRANSITION');
    });

    it('prohibits skipping progress: NEW -> WAITING_APPROVAL', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask,
        'NEW',
        'WAITING_APPROVAL'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'INVALID_TRANSITION');
    });

    it('prohibits skipping review: IN_PROGRESS -> COMPLETED', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'IN_PROGRESS',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'INVALID_TRANSITION');
    });

    it('prohibits moving backwards: WAITING_APPROVAL -> NEW', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'NEW'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'INVALID_TRANSITION');
    });
  });

  describe('4. Maker-Checker / Segregation of Duties (SoD) Invariants', () => {
    it('rejects DRI attempting to approve their own task with MAKER_CANNOT_BE_CHECKER (sole assignee)', () => {
      const taskWhereManagerIsDri: TaskContext = {
        id: 'task-mgr-sole-dri',
        scope: 'DEPARTMENT',
        departmentId: 'dept-cntt',
        createdById: 'user-admin-01',
        primaryOwnerId: managerActor.id,
        assigneeIds: [managerActor.id],
      };

      const res = taskStateMachine.canTransition(
        managerActor,
        taskWhereManagerIsDri,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('rejects Executive attempting to approve their own task when they are the primaryOwner', () => {
      const taskWhereExecutiveIsDri: TaskContext = {
        id: 'task-exec-dri',
        scope: 'SCHOOL',
        departmentId: null,
        createdById: executiveActor.id,
        driId: executiveActor.id,
        assigneeIds: [executiveActor.id],
      };

      const res = taskStateMachine.canTransition(
        executiveActor,
        taskWhereExecutiveIsDri,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('rejects deliverable creator attempting to approve task with MAKER_CANNOT_BE_CHECKER', () => {
      const taskWithUploadedDeliverable: TaskContext = {
        id: 'task-with-deliverable',
        scope: 'DEPARTMENT',
        departmentId: 'dept-cntt',
        createdById: 'user-admin-01',
        primaryOwnerId: 'other-user',
        assigneeIds: ['other-user'],
        deliverableUploadedByIds: [managerActor.id], // Manager uploaded the deliverable
      };

      const res = taskStateMachine.canTransition(
        managerActor,
        taskWithUploadedDeliverable,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('identifies maker through assignees object with roleInTask PRIMARY_OWNER', () => {
      const taskWithAssigneeObj: TaskContext = {
        id: 'task-obj',
        scope: 'DEPARTMENT',
        departmentId: 'dept-cntt',
        createdById: 'user-admin-01',
        assignees: [
          { userId: managerActor.id, roleInTask: 'PRIMARY_OWNER' },
          { userId: staffActor.id, roleInTask: 'COLLABORATOR' },
        ],
      };

      const res = taskStateMachine.canTransition(
        managerActor,
        taskWithAssigneeObj,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });
  });

  describe('5. Role Authority & Scope Boundary Contract', () => {
    it('prohibits Staff (CHUYEN_VIEN) from approving tasks', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_APPROVER');
    });

    it('prohibits Giang Vien from approving tasks', () => {
      const res = taskStateMachine.canTransition(
        giangVienActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_APPROVER');
    });

    it('prohibits Staff from rejecting or sending back tasks', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_APPROVER');
    });

    it('prohibits Manager from approving SCHOOL scope tasks without executive role', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseSchoolTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE');
    });

    it('prohibits Manager from approving department tasks outside their department', () => {
      const res = taskStateMachine.canTransition(
        otherDeptManagerActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'DEPARTMENT_MISMATCH');
    });

    it('allows Manager with active delegation to approve department task', () => {
      const delegatedManager: ActorContext = {
        ...otherDeptManagerActor,
        delegatedTaskIds: [baseDepartmentTask.id],
      };
      const res = taskStateMachine.canTransition(
        delegatedManager,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows Executive (BAN_GIAM_HIEU) to approve SCHOOL scope task', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseSchoolTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows Admin to approve any department task when not maker', () => {
      const res = taskStateMachine.canTransition(
        adminActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });
  });

  describe('6. Terminal State Protection (COMPLETED / CANCELLED)', () => {
    it('prohibits Staff from reopening COMPLETED -> IN_PROGRESS', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask,
        'COMPLETED',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'TERMINAL_STATE_LOCKED');
    });

    it('prohibits Manager from reopening COMPLETED -> IN_PROGRESS', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'COMPLETED',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'TERMINAL_STATE_LOCKED');
    });

    it('allows Executive (BAN_GIAM_HIEU) to reopen COMPLETED -> IN_PROGRESS', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseDepartmentTask,
        'COMPLETED',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows Admin to reopen CANCELLED -> IN_PROGRESS', () => {
      const res = taskStateMachine.canTransition(
        adminActor,
        baseSchoolTask,
        'CANCELLED',
        'IN_PROGRESS'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('prohibits moving from COMPLETED to any non-IN_PROGRESS status', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseDepartmentTask,
        'COMPLETED',
        'WAITING_APPROVAL'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'TERMINAL_STATE_LOCKED');
    });
  });

  describe('7. Task Cancellation Authority', () => {
    it('allows Executive to cancel active tasks', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        baseSchoolTask,
        'IN_PROGRESS',
        'CANCELLED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows Task Creator to cancel task', () => {
      const taskCreatedByStaff: TaskContext = {
        ...baseDepartmentTask,
        createdById: staffActor.id,
      };
      const res = taskStateMachine.canTransition(
        staffActor,
        taskCreatedByStaff,
        'NEW',
        'CANCELLED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('prohibits unauthorized non-creator Staff from cancelling tasks', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        baseDepartmentTask, // created by managerActor
        'IN_PROGRESS',
        'CANCELLED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_CANCELLATION');
    });
  });
});
