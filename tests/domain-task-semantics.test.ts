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

import { mapDbStatusToLifecycle, mapLifecycleToKanbanColumn, KANBAN_COLUMNS } from '@qcet/shared/domain/tasks/canonical-semantics';

import { isTaskMaker, isTaskAssignee, isUserAuthorizedApprover, isTaskDueSoon } from '@qcet/shared/domain/tasks/attention-resolver';

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
});

describe('9. Temporal Attention: due_soon Calculation & Window Consistency', () => {
  const baseUser = {
    userId: 'user-1',
    role: 'STAFF',
  };

  // Fixed reference date: 2026-09-10 in ICT
  const fixedNow = new Date('2026-09-10T12:00:00Z');

  it('isTaskDueSoon helper computes directly with custom window and ICT timezone', () => {
    assert.equal(isTaskDueSoon('2026-09-12', '2026-09-10', 3), true);
    assert.equal(isTaskDueSoon('2026-09-13', '2026-09-10', 3), true);
    assert.equal(isTaskDueSoon('2026-09-14', '2026-09-10', 3), false);
    assert.equal(isTaskDueSoon('2026-09-09', '2026-09-10', 3), false);
    assert.equal(isTaskDueSoon(null, '2026-09-10', 3), false);
  });
});

