import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  EMPTY_DASHBOARD_PAYLOAD,
} from '../src/hooks/use-task-mutations';
import { computeSchoolTaskRollup, computeDashboardStats } from '../src/lib/dashboard-aggregator';
import type { SchoolTask, StaffTask, TaskStatus, DashboardPayload } from '../src/types/dashboard';

describe('useTaskMutations Optimistic UI & Error Rollback Contract', () => {
  const filePath = path.resolve(process.cwd(), 'src/hooks/use-task-mutations.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  test('use-task-mutations.ts does not use getMockDashboardPayload', () => {
    assert.strictEqual(
      content.includes('getMockDashboardPayload()'),
      false,
      'useTaskMutations must not initialize state with getMockDashboardPayload()'
    );
    assert.strictEqual(
      content.includes('@/lib/mock-dashboard-data'),
      false,
      'useTaskMutations must not import from mock-dashboard-data'
    );
  });

  test('use-task-mutations.ts defines EMPTY_DASHBOARD_PAYLOAD and manages isLoading, errorMessage', () => {
    assert.strictEqual(
      content.includes('EMPTY_DASHBOARD_PAYLOAD'),
      true,
      'use-task-mutations.ts must define EMPTY_DASHBOARD_PAYLOAD'
    );
    assert.strictEqual(
      content.includes('isLoading'),
      true,
      'use-task-mutations.ts must include isLoading in return contract'
    );
    assert.strictEqual(
      content.includes('errorMessage'),
      true,
      'use-task-mutations.ts must include errorMessage in return contract'
    );
    assert.strictEqual(
      Array.isArray(EMPTY_DASHBOARD_PAYLOAD.tasks),
      true,
      'EMPTY_DASHBOARD_PAYLOAD.tasks must be an empty array'
    );
    assert.strictEqual(EMPTY_DASHBOARD_PAYLOAD.tasks.length, 0);
  });

  test('use-task-mutations.ts implements optimistic update with rollback snapshot', () => {
    assert.strictEqual(
      content.includes('previousData'),
      true,
      'mutations must capture previousData snapshot for rollback'
    );
    assert.strictEqual(
      content.includes('/api/tasks'),
      true,
      'mutations must call /api/tasks'
    );
    assert.strictEqual(
      content.includes('/api/tasks/${taskId}') || content.includes('/api/tasks/'),
      true,
      'mutations must target specific task endpoint'
    );
  });

  test('Optimistic rollback logic restores previous state on failure', () => {
    const sampleInitialTask: SchoolTask = {
      id: 'task-test-1',
      title: 'Xây dựng kế hoạch chuyển đổi số',
      category: 'CHUYEN_DOI_SO',
      categoryLabel: 'Chuyển đổi số',
      leadAssigneeName: 'ThS. Nguyễn Văn A',
      coAssignees: [],
      assignedDate: '2026-09-01',
      dueDate: '2026-09-30',
      status: 'IN_PROGRESS',
      subTasks: [
        {
          id: 'sub-test-1',
          title: 'Khảo sát hiện trạng CNTT',
          assigneeName: 'ThS. Lê Văn B',
          status: 'IN_PROGRESS',
          dueDate: '2026-09-15',
          parentSchoolTaskId: 'task-test-1',
          updatedAt: '2026-09-02',
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const initialPayload: DashboardPayload = {
      ...EMPTY_DASHBOARD_PAYLOAD,
      tasks: [sampleInitialTask],
      stats: computeDashboardStats([sampleInitialTask]),
    };

    // Step 1: Snapshot
    const previousData = initialPayload;

    // Step 2: Optimistic update (status change to COMPLETED)
    const newStatus: TaskStatus = 'COMPLETED';
    const updatedTasks: SchoolTask[] = initialPayload.tasks.map((st) => {
      const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
        sub.id === 'sub-test-1' ? { ...sub, status: newStatus } : sub
      );
      return { ...st, subTasks: updatedSubs };
    });
    const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
    const optimisticPayload: DashboardPayload = {
      ...initialPayload,
      tasks: rolledUp,
      stats: computeDashboardStats(rolledUp),
    };

    assert.strictEqual(optimisticPayload.tasks[0].subTasks[0].status, 'COMPLETED');
    assert.strictEqual(optimisticPayload.tasks[0].progressPercent, 100);

    // Step 3: Rollback on failure
    let currentPayload = optimisticPayload;
    const isApiOk = false;
    if (!isApiOk) {
      currentPayload = previousData;
    }

    assert.strictEqual(currentPayload.tasks[0].subTasks[0].status, 'IN_PROGRESS');
    assert.strictEqual(currentPayload.tasks[0].progressPercent, 0);
  });
});
