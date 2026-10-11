/**
 * Test Suite: Actor-Specific Approval Attention (T04)
 *
 * Invariant under test:
 * - Approval attention ('requires_my_approval') is actor-specific: it must be
 *   resolved from the authenticated actor's server-supplied review capability
 *   plus Segregation of Duties, never merely from WAITING_APPROVAL.
 * - A user who cannot review does NOT see the task as waiting-for-them.
 * - An explicit server capability verdict (canApprove) is authoritative over
 *   role/position heuristics (Server Truth Wins).
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

import { canUserReviewTask, isUserAuthorizedApprover } from '../../src/domain/tasks/attention-resolver';

// A single WAITING_APPROVAL task, reviewed by different actors.
const awaitingTask = {
  id: 'task-att-1',
  status: 'WAITING_APPROVAL',
  createdById: 'creator-1',
  leadAssigneeId: 'assignee-1',
  departmentId: 'dept-cntt',
};

describe('T04.2 Server capability is authoritative over role heuristics', () => {

  it('does NOT let a matching unit head override an explicit server denial', () => {
    const unitHeadDenied = {
      userId: 'head-1',
      role: 'TRUONG_PHONG',
      positionCode: 'TRUONG_PHONG',
      departmentId: 'dept-cntt',
      canApprove: false,
    };
    assert.equal(canUserReviewTask(awaitingTask, unitHeadDenied), false);
  });
});

describe('T04.3 Segregation of Duties still governs capability', () => {

  it('prohibits a lead assignee from approval attention even with capability', () => {
    const assigneeWithCapability = { userId: 'assignee-1', canApprove: true };
    assert.equal(canUserReviewTask(awaitingTask, assigneeWithCapability), false);
  });
});
