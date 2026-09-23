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
  type TaskAuthorizationDecision,
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
    createdById: 'user-creator-99',
    primaryOwnerId: 'user-staff-99',
    assigneeIds: ['user-staff-99'],
  };

  const baseSchoolTask: TaskContext = {
    id: 'task-school-01',
    scope: 'SCHOOL',
    departmentId: 'dept-cntt',
    createdById: 'user-creator-99',
    primaryOwnerId: 'user-staff-99',
    assigneeIds: ['user-staff-99'],
  };

  describe('1. Normalization & Synonym Handling', () => {
    it('normalizes status synonyms correctly', () => {
      assert.strictEqual(normalizeTaskStatus('NEW'), 'NOT_STARTED');
      assert.strictEqual(normalizeTaskStatus('TODO'), 'NOT_STARTED');
      assert.strictEqual(normalizeTaskStatus('NOT_STARTED'), 'NOT_STARTED');
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

    it('prohibits moving backwards: WAITING_APPROVAL -> NOT_STARTED / NEW', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'NOT_STARTED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'INVALID_TRANSITION');

      const resNew = taskStateMachine.canTransition(
        managerActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'NEW'
      );
      assert.strictEqual(resNew.allowed, false);
      assert.strictEqual(resNew.code, 'INVALID_TRANSITION');
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

    it('rejects task creator attempting to approve their own task (Creator cannot self-approve)', () => {
      const taskCreatedByManager: TaskContext = {
        id: 'task-created-by-mgr',
        scope: 'DEPARTMENT',
        departmentId: 'dept-cntt',
        createdById: managerActor.id,
        primaryOwnerId: 'user-staff-99',
        assigneeIds: ['user-staff-99'],
      };

      const res = taskStateMachine.canTransition(
        managerActor,
        taskCreatedByManager,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('rejects submitter attempting to approve their own task (Submitter cannot self-approve)', () => {
      const taskSubmittedByManager: TaskContext = {
        id: 'task-submitted-by-mgr',
        scope: 'DEPARTMENT',
        departmentId: 'dept-cntt',
        createdById: 'user-admin-01',
        primaryOwnerId: 'user-staff-99',
        assigneeIds: ['user-staff-99'],
        submittedByUserId: managerActor.id,
      };

      const res = taskStateMachine.canTransition(
        managerActor,
        taskSubmittedByManager,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('enforces delegation invariant: Actor with delegation who is a Maker CANNOT approve', () => {
      const delegatedManagerAsMaker: ActorContext = {
        ...managerActor,
        isDelegated: true,
        delegatedTaskIds: ['task-delegated-maker'],
      };

      const taskWhereActorIsDri: TaskContext = {
        id: 'task-delegated-maker',
        scope: 'DEPARTMENT',
        departmentId: 'dept-cntt',
        createdById: 'user-admin-01',
        primaryOwnerId: managerActor.id,
        assigneeIds: [managerActor.id],
      };

      const res = taskStateMachine.canTransition(
        delegatedManagerAsMaker,
        taskWhereActorIsDri,
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

  describe('8. Unit Leader Roles Compatibility Shim (WI-1.2)', () => {
    const deanActor: ActorContext = {
      id: 'user-dean-01',
      role: 'TRUONG_KHOA',
      departmentId: 'dept-cntt',
    };

    const viceDeanActor: ActorContext = {
      id: 'user-vice-dean-01',
      role: 'PHO_TRUONG_KHOA',
      departmentId: 'dept-cntt',
    };

    const centerDirectorActor: ActorContext = {
      id: 'user-dir-01',
      role: 'GIAM_DOC_TRUNG_TAM',
      departmentId: 'dept-cntt',
    };

    const viceDirectorActor: ActorContext = {
      id: 'user-vice-dir-01',
      role: 'PHO_GIAM_DOC_TRUNG_TAM',
      departmentId: 'dept-cntt',
    };

    it('categorizes TRUONG_KHOA, PHO_TRUONG_KHOA, GIAM_DOC_TRUNG_TAM, PHO_GIAM_DOC_TRUNG_TAM as MANAGER', () => {
      assert.strictEqual(categorizeRole('TRUONG_KHOA'), 'MANAGER');
      assert.strictEqual(categorizeRole('PHO_TRUONG_KHOA'), 'MANAGER');
      assert.strictEqual(categorizeRole('GIAM_DOC_TRUNG_TAM'), 'MANAGER');
      assert.strictEqual(categorizeRole('PHO_GIAM_DOC_TRUNG_TAM'), 'MANAGER');
    });

    it('allows TRUONG_KHOA to approve department tasks when not maker', () => {
      const res = taskStateMachine.canTransition(
        deanActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows PHO_TRUONG_KHOA to approve department tasks when not maker', () => {
      const res = taskStateMachine.canTransition(
        viceDeanActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows GIAM_DOC_TRUNG_TAM to approve department tasks when not maker', () => {
      const res = taskStateMachine.canTransition(
        centerDirectorActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows PHO_GIAM_DOC_TRUNG_TAM to approve department tasks when not maker', () => {
      const res = taskStateMachine.canTransition(
        viceDirectorActor,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, true);
    });

    it('prohibits TRUONG_KHOA from approving department tasks of a different department', () => {
      const otherDean: ActorContext = {
        ...deanActor,
        departmentId: 'dept-dien-tu',
      };
      const res = taskStateMachine.canTransition(
        otherDean,
        baseDepartmentTask,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'DEPARTMENT_MISMATCH');
    });

    it('prohibits TRUONG_KHOA from approving tasks where they are the maker (SoD enforcement)', () => {
      const taskWhereDeanIsDRI: TaskContext = {
        ...baseDepartmentTask,
        driId: deanActor.id,
      };
      const res = taskStateMachine.canTransition(
        deanActor,
        taskWhereDeanIsDRI,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });
  });

  describe('9. Pure Domain Authority via TaskAuthorizationDecision Interface (WI-3.3 / ADR-002)', () => {
    // Non-maker task for approval testing
    const nonMakerDeptTask: TaskContext = {
      id: 'task-auth-dec-01',
      scope: 'DEPARTMENT',
      departmentId: 'dept-cntt',
      createdById: 'user-creator-99',
      primaryOwnerId: 'user-staff-99',
      assigneeIds: ['user-staff-99'],
    };

    const nonMakerSchoolTask: TaskContext = {
      id: 'task-auth-dec-02',
      scope: 'SCHOOL',
      departmentId: 'dept-cntt',
      createdById: 'user-creator-99',
      primaryOwnerId: 'user-staff-99',
      assigneeIds: ['user-staff-99'],
    };

    it('allows Staff (CHUYEN_VIEN) to approve when authDecision.canApprove is true and non-maker (Role is not scope)', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: true }
      );
      assert.strictEqual(res.allowed, true);
    });

    it('allows Giang Vien to approve SCHOOL task when authDecision.canApprove is true', () => {
      const res = taskStateMachine.canTransition(
        giangVienActor,
        nonMakerSchoolTask,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: true }
      );
      assert.strictEqual(res.allowed, true);
    });

    it('prohibits Unit Manager from approving when authDecision.canApprove is false (capability revoked)', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: false }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_APPROVER');
    });

    it('prohibits Executive (BAN_GIAM_HIEU) from approving when authDecision.canApprove is false', () => {
      const res = taskStateMachine.canTransition(
        executiveActor,
        nonMakerSchoolTask,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: false }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_APPROVER');
    });

    it('HARD INVARIANT: Maker CANNOT approve even if authDecision.canApprove is true (Creator)', () => {
      const taskCreatedByStaff: TaskContext = {
        ...nonMakerDeptTask,
        createdById: staffActor.id,
      };

      const res = taskStateMachine.canTransition(
        staffActor,
        taskCreatedByStaff,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: true }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('HARD INVARIANT: Maker CANNOT approve even if authDecision.canApprove is true (DRI / Primary Owner)', () => {
      const taskWhereStaffIsDri: TaskContext = {
        ...nonMakerDeptTask,
        primaryOwnerId: staffActor.id,
        assigneeIds: [staffActor.id],
      };

      const res = taskStateMachine.canTransition(
        staffActor,
        taskWhereStaffIsDri,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: true }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('HARD INVARIANT: Maker CANNOT approve even if authDecision.canApprove is true (Executive is maker)', () => {
      const taskWhereExecutiveIsCreator: TaskContext = {
        ...nonMakerSchoolTask,
        createdById: executiveActor.id,
      };

      const res = taskStateMachine.canTransition(
        executiveActor,
        taskWhereExecutiveIsCreator,
        'WAITING_APPROVAL',
        'COMPLETED',
        { canApprove: true }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('allows Staff to reject when authDecision.canReject is true', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        'IN_PROGRESS',
        { canReject: true }
      );
      assert.strictEqual(res.allowed, true);
    });

    it('prohibits rejection when authDecision.canReject is false', () => {
      const res = taskStateMachine.canTransition(
        managerActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        'IN_PROGRESS',
        { canReject: false }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_APPROVER');
    });

    it('allows cancellation when authDecision.canCancel is true for non-creator Staff', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        nonMakerDeptTask,
        'IN_PROGRESS',
        'CANCELLED',
        { canCancel: true }
      );
      assert.strictEqual(res.allowed, true);
    });

    it('prohibits cancellation when authDecision.canCancel is false even for creator', () => {
      const taskCreatedByManager: TaskContext = {
        ...nonMakerDeptTask,
        createdById: managerActor.id,
      };

      const res = taskStateMachine.canTransition(
        managerActor,
        taskCreatedByManager,
        'IN_PROGRESS',
        'CANCELLED',
        { canCancel: false }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_CANCELLATION');
    });

    it('enforces canStart: false blocking task start from NOT_STARTED', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        nonMakerDeptTask,
        'NOT_STARTED',
        'IN_PROGRESS',
        { canStart: false }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_ACTION');
    });

    it('enforces canSubmit: false blocking task review submission from IN_PROGRESS', () => {
      const res = taskStateMachine.canTransition(
        staffActor,
        nonMakerDeptTask,
        'IN_PROGRESS',
        'WAITING_APPROVAL',
        { canSubmit: false }
      );
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, 'UNAUTHORIZED_ACTION');
    });

    it('getAllowedTransitions respects authDecision pure capabilities', () => {
      const staffTransitions = taskStateMachine.getAllowedTransitions(
        staffActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        { canApprove: true, canReject: true }
      );

      const completedT = staffTransitions.find((t) => t.status === 'COMPLETED');
      const inProgressT = staffTransitions.find((t) => t.status === 'IN_PROGRESS');

      assert.strictEqual(completedT?.allowed, true);
      assert.strictEqual(inProgressT?.allowed, true);
    });

    it('backward compatibility: falls back to role checks when authDecision fields are undefined', () => {
      // Empty authDecision -> should behave identically to legacy role checks
      const emptyDecisionRes = taskStateMachine.canTransition(
        staffActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        'COMPLETED',
        {}
      );
      assert.strictEqual(emptyDecisionRes.allowed, false);
      assert.strictEqual(emptyDecisionRes.code, 'UNAUTHORIZED_APPROVER');

      const managerRes = taskStateMachine.canTransition(
        managerActor,
        nonMakerDeptTask,
        'WAITING_APPROVAL',
        'COMPLETED',
        {}
      );
      assert.strictEqual(managerRes.allowed, true);
    });
  });
});
