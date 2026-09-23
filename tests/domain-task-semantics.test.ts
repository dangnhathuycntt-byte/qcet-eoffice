/**
 * Test Suite: Canonical Task Semantics, Status Mapping & Attention Resolver
 *
 * Requirements:
 * 1. mapDbStatusToLifecycle: Complete mapping of all DB statuses to TaskLifecycleStatus.
 * 2. mapLifecycleToKanbanColumn: Projection to 4 Kanban columns (NEW, IN_PROGRESS, NEEDS_REVIEW, COMPLETED).
 * 3. 85-Task Delta Resolution: Prove 75 NOT_STARTED + 9 WAITING_APPROVAL all map to valid columns.
 * 4. Segregation of Duties (SoD): Makers (creators, assignees, submitters) CANNOT have 'requires_my_approval'.
 * 5. Maker Attention: 'requires_my_action' for assignees/co-assignees on NOT_STARTED / IN_PROGRESS.
 * 6. Checker Attention: 'requires_my_approval' on WAITING_APPROVAL / PENDING_EXECUTIVE_APPROVAL for authorized checkers.
 * 7. Temporal Attention: 'overdue' when dueDate < now and status !== 'COMPLETED'.
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

import {
  mapDbStatusToLifecycle,
  mapLifecycleToKanbanColumn,
  mapLifecycleToKanban,
  projectTaskToKanban,
  verify85TaskDeltaResolution,
  reconcileTaskCounts,
  KANBAN_COLUMNS,
} from '../src/domain/tasks/canonical-semantics';

import {
  resolveUserAttention,
  isTaskMaker,
  isTaskAssignee,
  isUserAuthorizedApprover,
  isTaskDueSoon,
} from '../src/domain/tasks/attention-resolver';

describe('1. Canonical Task Status Lifecycle Mapping', () => {
  it('maps all canonical DB statuses to TaskLifecycleStatus', () => {
    assert.equal(mapDbStatusToLifecycle('NOT_STARTED'), 'NOT_STARTED');
    assert.equal(mapDbStatusToLifecycle('IN_PROGRESS'), 'IN_PROGRESS');
    assert.equal(mapDbStatusToLifecycle('WAITING_APPROVAL'), 'WAITING_APPROVAL');
    assert.equal(mapDbStatusToLifecycle('PENDING_EXECUTIVE_APPROVAL'), 'PENDING_EXECUTIVE_APPROVAL');
    assert.equal(mapDbStatusToLifecycle('COMPLETED'), 'COMPLETED');
    assert.equal(mapDbStatusToLifecycle('CANCELLED'), 'CANCELLED');
  });

  it('handles lowercase, mixed-case, and whitespace gracefully', () => {
    assert.equal(mapDbStatusToLifecycle(' not_started '), 'NOT_STARTED');
    assert.equal(mapDbStatusToLifecycle('in_progress'), 'IN_PROGRESS');
    assert.equal(mapDbStatusToLifecycle('waiting_approval'), 'WAITING_APPROVAL');
    assert.equal(mapDbStatusToLifecycle('pending_executive_approval'), 'PENDING_EXECUTIVE_APPROVAL');
    assert.equal(mapDbStatusToLifecycle('completed'), 'COMPLETED');
    assert.equal(mapDbStatusToLifecycle('cancelled'), 'CANCELLED');
  });

  it('handles legacy aliases cleanly', () => {
    assert.equal(mapDbStatusToLifecycle('NEW'), 'NOT_STARTED');
    assert.equal(mapDbStatusToLifecycle('TODO'), 'NOT_STARTED');
    assert.equal(mapDbStatusToLifecycle('DOING'), 'IN_PROGRESS');
    assert.equal(mapDbStatusToLifecycle('NEEDS_REVIEW'), 'WAITING_APPROVAL');
    assert.equal(mapDbStatusToLifecycle('DONE'), 'COMPLETED');
    assert.equal(mapDbStatusToLifecycle('CANCELED'), 'CANCELLED');
  });

  it('falls back safely for empty or unknown status', () => {
    assert.equal(mapDbStatusToLifecycle(''), 'NOT_STARTED');
    assert.equal(mapDbStatusToLifecycle('UNKNOWN_STATUS'), 'IN_PROGRESS');
  });
});

describe('2. Kanban Column Projection', () => {
  it('maps each TaskLifecycleStatus to valid KanbanColumn', () => {
    assert.equal(mapLifecycleToKanbanColumn('NOT_STARTED'), 'NEW');
    assert.equal(mapLifecycleToKanbanColumn('IN_PROGRESS'), 'IN_PROGRESS');
    assert.equal(mapLifecycleToKanbanColumn('WAITING_APPROVAL'), 'NEEDS_REVIEW');
    assert.equal(mapLifecycleToKanbanColumn('PENDING_EXECUTIVE_APPROVAL'), 'NEEDS_REVIEW');
    assert.equal(mapLifecycleToKanbanColumn('COMPLETED'), 'COMPLETED');
    assert.equal(mapLifecycleToKanbanColumn('CANCELLED'), 'COMPLETED');
  });

  it('projects IN_PROGRESS with isOverdue = false', () => {
    const normalInProgress = mapLifecycleToKanban('IN_PROGRESS');
    assert.equal(normalInProgress.column, 'IN_PROGRESS');
    assert.equal(normalInProgress.isOverdue, false);
  });
});

describe('3. Historical 85-Task Delta Elimination Proof', () => {
  it('demonstrates that legacy naive status matching drops tasks because DB status strings do not match column IDs', () => {
    // 75 NOT_STARTED + 9 WAITING_APPROVAL = 84 tasks (OVERDUE removed from DB)
    const legacyDataset: Array<{ id: string; status: string }> = [
      ...Array.from({ length: 75 }, (_, i) => ({ id: `ns-${i}`, status: 'NOT_STARTED' })),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `wa-${i}`, status: 'WAITING_APPROVAL' })),
    ];

    assert.equal(legacyDataset.length, 84);

    // In a naive system matching strictly against Kanban column names ['NEW', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED']
    const kanbanColumnSet = new Set<string>(['NEW', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED']);
    const droppedCount = legacyDataset.filter((t) => !kanbanColumnSet.has(t.status)).length;
    assert.equal(droppedCount, 84, 'Naive grouping drops all 84 tasks because DB status strings do not match column IDs');
  });

  it('eliminates the task delta completely via canonical mapping', () => {
    const legacyDataset: Array<{ id: string; status: string }> = [
      ...Array.from({ length: 75 }, (_, i) => ({ id: `ns-${i}`, status: 'NOT_STARTED' })),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `wa-${i}`, status: 'WAITING_APPROVAL' })),
    ];

    const result = verify85TaskDeltaResolution(legacyDataset);

    assert.equal(result.total, 84);
    assert.equal(result.mappedCount, 84);
    assert.equal(result.unmappedCount, 0);
    assert.equal(result.deltaResolved, true);

    // Exact expected column distribution
    assert.equal(result.columnCounts.NEW, 75, '75 NOT_STARTED tasks correctly map to NEW column');
    assert.equal(result.columnCounts.NEEDS_REVIEW, 9, '9 WAITING_APPROVAL tasks correctly map to NEEDS_REVIEW column');
    assert.equal(result.columnCounts.IN_PROGRESS, 0);
    assert.equal(result.columnCounts.COMPLETED, 0);
  });
});

describe('4. Segregation of Duties (SoD) Enforcement', () => {
  const leaderUser = {
    userId: 'user-leader-1',
    role: 'TRUONG_PHONG',
    positionCode: 'TRUONG_PHONG',

  };

  const executiveUser = {
    userId: 'user-bgh-1',
    role: 'EXECUTIVE',
    positionCode: 'HIEU_TRUONG',
  };

  it('prohibits task creator from having requires_my_approval on their own task (even if Unit Head)', () => {
    const taskCreatedByLeader = {
      id: 'task-1',
      status: 'WAITING_APPROVAL',
      createdById: 'user-leader-1', // Creator is leaderUser
      leadAssigneeId: 'user-staff-1',

    };

    assert.equal(isTaskMaker(taskCreatedByLeader, leaderUser.userId), true);

    const attentions = resolveUserAttention(taskCreatedByLeader, leaderUser);
    assert.equal(
      attentions.includes('requires_my_approval'),
      false,
      'SoD: Task creator cannot have requires_my_approval on own task'
    );
  });

  it('prohibits task creator from having requires_my_approval even if Executive / Hiệu trưởng', () => {
    const taskCreatedByExecutive = {
      id: 'task-2',
      status: 'PENDING_EXECUTIVE_APPROVAL',
      createdById: 'user-bgh-1', // Executive created this task
      leadAssigneeId: 'user-leader-1',
    };

    assert.equal(isTaskMaker(taskCreatedByExecutive, executiveUser.userId), true);

    const attentions = resolveUserAttention(taskCreatedByExecutive, executiveUser);
    assert.equal(
      attentions.includes('requires_my_approval'),
      false,
      'SoD: Executive creator cannot approve own task'
    );
  });

  it('prohibits lead assignee / primary owner from approving their own task', () => {
    const taskLeadByLeader = {
      id: 'task-3',
      status: 'WAITING_APPROVAL',
      createdById: 'user-bgh-1',
      leadAssigneeId: 'user-leader-1', // Leader is lead assignee

    };

    assert.equal(isTaskMaker(taskLeadByLeader, leaderUser.userId), true);

    const attentions = resolveUserAttention(taskLeadByLeader, leaderUser);
    assert.equal(
      attentions.includes('requires_my_approval'),
      false,
      'SoD: Lead assignee cannot have requires_my_approval on own task'
    );
  });

  it('prohibits submitter / deliverable uploader from approving their own task', () => {
    const taskSubmittedByLeader = {
      id: 'task-4',
      status: 'WAITING_APPROVAL',
      createdById: 'user-bgh-1',
      leadAssigneeId: 'user-staff-1',

      deliverables: [{ id: 'deliv-1', uploadedById: 'user-leader-1' }],
    };

    assert.equal(isTaskMaker(taskSubmittedByLeader, leaderUser.userId), true);

    const attentions = resolveUserAttention(taskSubmittedByLeader, leaderUser);
    assert.equal(
      attentions.includes('requires_my_approval'),
      false,
      'SoD: Deliverable uploader cannot have requires_my_approval on own task'
    );
  });

  it('allows authorized checker to have requires_my_approval when NOT a maker', () => {
    const taskForReview = {
      id: 'task-5',
      status: 'WAITING_APPROVAL',
      createdById: 'user-staff-1',
      leadAssigneeId: 'user-staff-2',

    };

    assert.equal(isTaskMaker(taskForReview, leaderUser.userId), false);

    const attentions = resolveUserAttention(taskForReview, leaderUser);
    assert.equal(
      attentions.includes('requires_my_approval'),
      true,
      'Authorized non-maker checker receives requires_my_approval'
    );
  });
});

describe('5. Maker Attention: requires_my_action', () => {
  const staffUser = {
    userId: 'user-staff-1',
    role: 'STAFF',
    positionCode: 'CHUYEN_VIEN',
  };

  it('assigns requires_my_action when user is lead assignee and task is NOT_STARTED', () => {
    const task = {
      id: 'task-ns',
      status: 'NOT_STARTED',
      leadAssigneeId: 'user-staff-1',
    };

    const attentions = resolveUserAttention(task, staffUser);
    assert.equal(attentions.includes('requires_my_action'), true);
  });

  it('assigns requires_my_action when user is lead assignee and task is IN_PROGRESS', () => {
    const task = {
      id: 'task-ip',
      status: 'IN_PROGRESS',
      leadAssigneeId: 'user-staff-1',
    };

    const attentions = resolveUserAttention(task, staffUser);
    assert.equal(attentions.includes('requires_my_action'), true);
  });

  it('assigns requires_my_action when user is co-assignee / collaborator', () => {
    const task = {
      id: 'task-collab',
      status: 'IN_PROGRESS',
      leadAssigneeId: 'user-staff-other',
      collaborators: [{ userId: 'user-staff-1' }],
    };

    assert.equal(isTaskAssignee(task, staffUser.userId), true);
    const attentions = resolveUserAttention(task, staffUser);
    assert.equal(attentions.includes('requires_my_action'), true);
  });

  it('does NOT assign requires_my_action when task is COMPLETED or CANCELLED', () => {
    const completedTask = {
      id: 'task-done',
      status: 'COMPLETED',
      leadAssigneeId: 'user-staff-1',
    };

    const attentions = resolveUserAttention(completedTask, staffUser);
    assert.equal(attentions.includes('requires_my_action'), false);
  });

  it('does NOT assign requires_my_action when user is not assigned', () => {
    const unassignedTask = {
      id: 'task-other',
      status: 'IN_PROGRESS',
      leadAssigneeId: 'user-someone-else',
    };

    const attentions = resolveUserAttention(unassignedTask, staffUser);
    assert.equal(attentions.includes('requires_my_action'), false);
  });
});

describe('6. Checker Attention: requires_my_approval Authority Tiers', () => {
  const executive = {
    userId: 'exec-1',
    role: 'EXECUTIVE',
    positionCode: 'HIEU_TRUONG',
  };

  const unitHeadCntt = {
    userId: 'head-cntt',
    role: 'TRUONG_PHONG',
    positionCode: 'TRUONG_PHONG',

  };

  const unitHeadKinhTe = {
    userId: 'head-kt',
    role: 'TRUONG_PHONG',
    positionCode: 'TRUONG_PHONG',

  };

  const staff = {
    userId: 'staff-1',
    role: 'STAFF',
    positionCode: 'CHUYEN_VIEN',

  };

  it('handles WAITING_APPROVAL: Executive and matching Unit Head have approval; other Unit Head and Staff do not', () => {
    const deptTask = {
      id: 'task-dept-1',
      status: 'WAITING_APPROVAL',
      createdById: 'creator-99',
      leadAssigneeId: 'assignee-99',

    };

    // Executive can approve
    const execAttentions = resolveUserAttention(deptTask, executive);
    assert.equal(execAttentions.includes('requires_my_approval'), true);

    // Matching Unit Head can approve
    const matchingHeadAttentions = resolveUserAttention(deptTask, unitHeadCntt);
    assert.equal(matchingHeadAttentions.includes('requires_my_approval'), true);

    // Other Unit Head cannot approve
    const otherHeadAttentions = resolveUserAttention(deptTask, unitHeadKinhTe);
    assert.equal(otherHeadAttentions.includes('requires_my_approval'), false);

    // Staff cannot approve
    const staffAttentions = resolveUserAttention(deptTask, staff);
    assert.equal(staffAttentions.includes('requires_my_approval'), false);
  });

  it('handles PENDING_EXECUTIVE_APPROVAL: ONLY Executive has approval authority', () => {
    const execTask = {
      id: 'task-exec-1',
      status: 'PENDING_EXECUTIVE_APPROVAL',
      createdById: 'creator-99',
      leadAssigneeId: 'assignee-99',

    };

    // Executive CAN approve
    const execAttentions = resolveUserAttention(execTask, executive);
    assert.equal(execAttentions.includes('requires_my_approval'), true);

    // Unit Head CANNOT approve PENDING_EXECUTIVE_APPROVAL
    const unitHeadAttentions = resolveUserAttention(execTask, unitHeadCntt);
    assert.equal(
      unitHeadAttentions.includes('requires_my_approval'),
      false,
      'Unit Head cannot approve PENDING_EXECUTIVE_APPROVAL'
    );
  });
});

describe('7. Temporal Attention: overdue Calculation', () => {
  const baseUser = {
    userId: 'user-1',
    role: 'STAFF',
  };

  const fixedNow = new Date('2026-09-10T12:00:00Z');

  it('assigns overdue when dueDate < now and status !== COMPLETED', () => {
    const overdueTask = {
      id: 'task-od-1',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-01', // in past relative to fixedNow
    };

    const attentions = resolveUserAttention(overdueTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('overdue'), true);
  });

  it('does NOT assign overdue when status === COMPLETED even if dueDate is in the past', () => {
    const completedTask = {
      id: 'task-od-completed',
      status: 'COMPLETED',
      dueDate: '2026-09-01',
    };

    const attentions = resolveUserAttention(completedTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('overdue'), false);
  });

  it('does NOT assign overdue when dueDate is in the future', () => {
    const futureTask = {
      id: 'task-future',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-20', // in future relative to fixedNow
    };

    const attentions = resolveUserAttention(futureTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('overdue'), false);
  });

  it('assigns overdue when task has isOverdue flag set', () => {
    const statusOverdueTask = {
      id: 'task-status-od',
      status: 'IN_PROGRESS',
      isOverdue: true,
      dueDate: '2026-09-20',
    };

    const attentions = resolveUserAttention(statusOverdueTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('overdue'), true);
  });
});

describe('8. Compound Attention Type Resolution', () => {
  it('correctly resolves multiple attention types for assigned user with overdue task', () => {
    const overdueTaskForAssignee = {
      id: 'task-compound',
      status: 'IN_PROGRESS',
      leadAssigneeId: 'user-lead-1',
      dueDate: '2026-09-01',
    };

    const attentions = resolveUserAttention(overdueTaskForAssignee, {
      userId: 'user-lead-1',
      role: 'STAFF',
      now: new Date('2026-09-10T12:00:00Z'),
    });

    assert.equal(attentions.includes('requires_my_action'), true);
    assert.equal(attentions.includes('overdue'), true);
    assert.equal(attentions.length, 2);
  });
});

describe('9. Temporal Attention: due_soon Calculation & Window Consistency', () => {
  const baseUser = {
    userId: 'user-1',
    role: 'STAFF',
  };

  // Fixed reference date: 2026-09-10 in ICT
  const fixedNow = new Date('2026-09-10T12:00:00Z');

  it('assigns due_soon when dueDate is today (diffDays = 0)', () => {
    const taskDueToday = {
      id: 'task-due-today',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-10',
    };

    const attentions = resolveUserAttention(taskDueToday, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('due_soon'), true);
    assert.equal(attentions.includes('overdue'), false);
  });

  it('assigns due_soon when dueDate is within 3 days (1, 2, 3 days ahead)', () => {
    for (const day of [1, 2, 3]) {
      const taskDueSoon = {
        id: `task-due-${day}`,
        status: 'IN_PROGRESS',
        dueDate: `2026-09-${10 + day}`,
      };

      const attentions = resolveUserAttention(taskDueSoon, { ...baseUser, now: fixedNow });
      assert.equal(
        attentions.includes('due_soon'),
        true,
        `Task due on 2026-09-${10 + day} should be flagged as due_soon`
      );
      assert.equal(attentions.includes('overdue'), false);
    }
  });

  it('does NOT assign due_soon when dueDate is more than 3 days ahead', () => {
    const taskDueLater = {
      id: 'task-due-later',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-14', // 4 days ahead
    };

    const attentions = resolveUserAttention(taskDueLater, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('due_soon'), false);
  });

  it('does NOT assign due_soon when task is already overdue', () => {
    const pastTask = {
      id: 'task-past',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-09', // 1 day in the past
    };

    const attentions = resolveUserAttention(pastTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('overdue'), true);
    assert.equal(attentions.includes('due_soon'), false, 'Overdue task must not be due_soon');
  });

  it('does NOT assign due_soon when task has isOverdue flag even with future date', () => {
    const statusOverdueTask = {
      id: 'task-status-od',
      status: 'IN_PROGRESS',
      isOverdue: true,
      dueDate: '2026-09-12', // 2 days ahead
    };

    const attentions = resolveUserAttention(statusOverdueTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('overdue'), true);
    assert.equal(attentions.includes('due_soon'), false);
  });

  it('does NOT assign due_soon when task is COMPLETED', () => {
    const completedTask = {
      id: 'task-completed-soon',
      status: 'COMPLETED',
      dueDate: '2026-09-11', // 1 day ahead
    };

    const attentions = resolveUserAttention(completedTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('due_soon'), false);
    assert.equal(attentions.includes('overdue'), false);
  });

  it('does NOT assign due_soon when task is CANCELLED', () => {
    const cancelledTask = {
      id: 'task-cancelled-soon',
      status: 'CANCELLED',
      dueDate: '2026-09-11',
    };

    const attentions = resolveUserAttention(cancelledTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('due_soon'), false);
    assert.equal(attentions.includes('overdue'), false);
  });

  it('does NOT assign due_soon when dueDate is missing or invalid', () => {
    const noDueDateTask = {
      id: 'task-no-date',
      status: 'IN_PROGRESS',
      dueDate: null,
    };

    const attentions = resolveUserAttention(noDueDateTask, { ...baseUser, now: fixedNow });
    assert.equal(attentions.includes('due_soon'), false);
  });

  it('isTaskDueSoon helper computes directly with custom window and ICT timezone', () => {
    assert.equal(isTaskDueSoon('2026-09-12', '2026-09-10', 3), true);
    assert.equal(isTaskDueSoon('2026-09-13', '2026-09-10', 3), true);
    assert.equal(isTaskDueSoon('2026-09-14', '2026-09-10', 3), false);
    assert.equal(isTaskDueSoon('2026-09-09', '2026-09-10', 3), false);
    assert.equal(isTaskDueSoon(null, '2026-09-10', 3), false);
  });
});

describe('10. Compound Attentions with due_soon & Orthogonality from Lifecycle Status', () => {
  const fixedNow = new Date('2026-09-10T12:00:00Z');

  it('resolves compound attention: requires_my_action + due_soon for assigned maker', () => {
    const task = {
      id: 'task-maker-due-soon',
      status: 'IN_PROGRESS',
      assigneeId: 'user-staff-1',
      dueDate: '2026-09-12',
    };

    const attentions = resolveUserAttention(task, {
      userId: 'user-staff-1',
      role: 'STAFF',
      now: fixedNow,
    });

    assert.equal(attentions.includes('requires_my_action'), true);
    assert.equal(attentions.includes('due_soon'), true);
    assert.equal(attentions.includes('overdue'), false);
    assert.equal(attentions.includes('requires_my_approval'), false);
  });

  it('resolves compound attention: requires_my_approval + due_soon for authorized checker', () => {
    const task = {
      id: 'task-checker-due-soon',
      status: 'WAITING_APPROVAL',
      createdById: 'user-other',
      assigneeId: 'user-other-2',

      dueDate: '2026-09-11',
    };

    const attentions = resolveUserAttention(task, {
      userId: 'user-head-1',
      role: 'TRUONG_PHONG',
      positionCode: 'TRUONG_PHONG',

      now: fixedNow,
    });

    assert.equal(attentions.includes('requires_my_approval'), true);
    assert.equal(attentions.includes('due_soon'), true);
    assert.equal(attentions.includes('requires_my_action'), false);
    assert.equal(attentions.includes('overdue'), false);
  });

  it('attention is orthogonal from lifecycle: NOT_STARTED task can be due_soon', () => {
    const notStartedDueSoon = {
      id: 'task-ns-soon',
      status: 'NOT_STARTED',
      leadAssigneeId: 'user-1',
      dueDate: '2026-09-11',
    };

    const attentions = resolveUserAttention(notStartedDueSoon, {
      userId: 'user-1',
      role: 'STAFF',
      now: fixedNow,
    });

    assert.equal(attentions.includes('requires_my_action'), true);
    assert.equal(attentions.includes('due_soon'), true);
  });
});

describe('11. Task Count Invariants, CANCELLED Accounting, and Detailed Projection', () => {
  it('projects CANCELLED task to COMPLETED by default and EXCLUDED when excludeCancelled is requested', () => {
    const defaultProj = projectTaskToKanban('CANCELLED');
    assert.equal(defaultProj.column, 'COMPLETED');
    assert.equal(defaultProj.isExcluded, false);
    assert.equal(defaultProj.isOverdue, false);

    const excludedProj = projectTaskToKanban('CANCELLED', { excludeCancelled: true });
    assert.equal(excludedProj.isExcluded, true);
    assert.equal(excludedProj.exclusionReason, 'CANCELLED');
  });

  it('satisfies invariant mapped + intentionallyExcluded = total across diverse dataset', () => {
    const dataset = [
      ...Array.from({ length: 75 }, (_, i) => ({ id: `ns-${i}`, status: 'NOT_STARTED' })),
      ...Array.from({ length: 294 }, (_, i) => ({ id: `ip-${i}`, status: 'IN_PROGRESS' })),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `wa-${i}`, status: 'WAITING_APPROVAL' })),
      ...Array.from({ length: 16 }, (_, i) => ({ id: `cp-${i}`, status: 'COMPLETED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `can-${i}`, status: 'CANCELLED' })),
    ];

    assert.equal(dataset.length, 404);

    // Scenario A: Without excluding CANCELLED
    const resultAll = reconcileTaskCounts(dataset, { excludeCancelled: false });
    assert.equal(resultAll.total, 404);
    assert.equal(resultAll.mappedCount, 404);
    assert.equal(resultAll.intentionallyExcludedCount, 0);
    assert.equal(resultAll.unmappedCount, 0);
    assert.equal(resultAll.invariantSatisfied, true);
    assert.equal(resultAll.deltaBreakdown.total85DeltaRecovered, 84);

    // Scenario B: With CANCELLED intentionally excluded
    const resultExcluded = reconcileTaskCounts(dataset, { excludeCancelled: true });
    assert.equal(resultExcluded.total, 404);
    assert.equal(resultExcluded.mappedCount, 394);
    assert.equal(resultExcluded.intentionallyExcludedCount, 10);
    assert.equal(resultExcluded.exclusionCounts.CANCELLED, 10);
    assert.equal(resultExcluded.unmappedCount, 0);
    assert.equal(
      resultExcluded.mappedCount + resultExcluded.intentionallyExcludedCount,
      resultExcluded.total,
      'mapped + intentionallyExcluded === total'
    );
    assert.equal(resultExcluded.invariantSatisfied, true);
    assert.equal(resultExcluded.deltaBreakdown.total85DeltaRecovered, 84);
  });

  it('maps BLOCKED status to IN_PROGRESS without throwing or dropping', () => {
    assert.equal(mapDbStatusToLifecycle('BLOCKED'), 'IN_PROGRESS');
    const proj = mapLifecycleToKanban('IN_PROGRESS');
    assert.equal(proj.column, 'IN_PROGRESS');
  });
});

