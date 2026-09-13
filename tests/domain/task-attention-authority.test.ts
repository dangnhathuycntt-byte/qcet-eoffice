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

import {
  resolveUserAttention,
  canUserReviewTask,
  isUserAuthorizedApprover,
} from '../../src/domain/tasks/attention-resolver';

// A single WAITING_APPROVAL task, reviewed by different actors.
const awaitingTask = {
  id: 'task-att-1',
  status: 'WAITING_APPROVAL',
  createdById: 'creator-1',
  leadAssigneeId: 'assignee-1',
  departmentId: 'dept-cntt',
};

describe('T04.1 Approval attention is actor-specific (capability, not status)', () => {
  it('gives requires_my_approval to the actor the server grants review capability', () => {
    const reviewer = { userId: 'user-a', canApprove: true };
    const attentions = resolveUserAttention(awaitingTask, reviewer);
    assert.equal(attentions.includes('requires_my_approval'), true);
    assert.equal(canUserReviewTask(awaitingTask, reviewer), true);
  });

  it('withholds requires_my_approval from an actor the server says cannot review', () => {
    const nonReviewer = { userId: 'user-b', canApprove: false };
    const attentions = resolveUserAttention(awaitingTask, nonReviewer);
    assert.equal(
      attentions.includes('requires_my_approval'),
      false,
      'WAITING_APPROVAL alone must not surface approval attention to a non-reviewer'
    );
    assert.equal(canUserReviewTask(awaitingTask, nonReviewer), false);
  });

  it('distinguishes reviewer vs non-reviewer for the SAME task and same role', () => {
    const sameRoleBase = { role: 'STAFF', positionCode: 'CHUYEN_VIEN', departmentId: 'dept-cntt' };
    const reviewer = { ...sameRoleBase, userId: 'u-1', canApprove: true };
    const nonReviewer = { ...sameRoleBase, userId: 'u-2', canApprove: false };

    assert.equal(resolveUserAttention(awaitingTask, reviewer).includes('requires_my_approval'), true);
    assert.equal(
      resolveUserAttention(awaitingTask, nonReviewer).includes('requires_my_approval'),
      false
    );
  });

  it('requires actor identity: no authenticated userId yields no approval attention', () => {
    const anonymous = { userId: '', canApprove: true } as any;
    assert.equal(resolveUserAttention(awaitingTask, anonymous).length, 0);
    assert.equal(canUserReviewTask(awaitingTask, anonymous), false);
  });
});

describe('T04.2 Server capability is authoritative over role heuristics', () => {
  it('does NOT grant approval attention to an executive the server marks canApprove = false', () => {
    const executiveDenied = {
      userId: 'exec-1',
      role: 'EXECUTIVE',
      positionCode: 'HIEU_TRUONG',
      canApprove: false,
    };
    assert.equal(isUserAuthorizedApprover(awaitingTask, executiveDenied), false);
    assert.equal(canUserReviewTask(awaitingTask, executiveDenied), false);
    assert.equal(
      resolveUserAttention(awaitingTask, executiveDenied).includes('requires_my_approval'),
      false,
      'Server Truth Wins: explicit denial overrides executive role'
    );
  });

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

  it('honors an explicit server grant even for a role without heuristic authority', () => {
    const delegatedReviewer = {
      userId: 'u-delegated',
      role: 'STAFF',
      positionCode: 'CHUYEN_VIEN',
      canApprove: true,
    };
    assert.equal(canUserReviewTask(awaitingTask, delegatedReviewer), true);
    assert.equal(
      resolveUserAttention(awaitingTask, delegatedReviewer).includes('requires_my_approval'),
      true
    );
  });
});

describe('T04.3 Segregation of Duties still governs capability', () => {
  it('prohibits a maker (creator) from approval attention even with capability', () => {
    const creatorWithCapability = { userId: 'creator-1', canApprove: true };
    assert.equal(canUserReviewTask(awaitingTask, creatorWithCapability), false);
    assert.equal(
      resolveUserAttention(awaitingTask, creatorWithCapability).includes('requires_my_approval'),
      false
    );
  });

  it('prohibits a lead assignee from approval attention even with capability', () => {
    const assigneeWithCapability = { userId: 'assignee-1', canApprove: true };
    assert.equal(canUserReviewTask(awaitingTask, assigneeWithCapability), false);
  });
});

describe('T04.4 Approval attention is gated on approvable lifecycle', () => {
  it('withholds approval attention for non-approvable statuses even with capability', () => {
    const capable = { userId: 'u-9', canApprove: true };
    for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE']) {
      const task = { ...awaitingTask, status };
      assert.equal(
        canUserReviewTask(task, capable),
        false,
        `status ${status} must not produce approval attention`
      );
      assert.equal(
        resolveUserAttention(task, capable).includes('requires_my_approval'),
        false
      );
    }
  });

  it('produces approval attention for PENDING_EXECUTIVE_APPROVAL only with capability', () => {
    const execTask = { ...awaitingTask, status: 'PENDING_EXECUTIVE_APPROVAL' };
    assert.equal(
      resolveUserAttention(execTask, { userId: 'x', canApprove: true }).includes('requires_my_approval'),
      true
    );
    assert.equal(
      resolveUserAttention(execTask, { userId: 'y', canApprove: false }).includes('requires_my_approval'),
      false
    );
  });
});

describe('T04.5 Legacy heuristic fallback is preserved when no capability is supplied', () => {
  it('still resolves executive and matching unit head without an explicit canApprove verdict', () => {
    const executive = { userId: 'exec-9', role: 'EXECUTIVE', positionCode: 'HIEU_TRUONG' };
    const matchingHead = {
      userId: 'head-9',
      role: 'TRUONG_PHONG',
      positionCode: 'TRUONG_PHONG',
      departmentId: 'dept-cntt',
    };
    const otherHead = {
      userId: 'head-other',
      role: 'TRUONG_PHONG',
      positionCode: 'TRUONG_PHONG',
      departmentId: 'dept-kinhte',
    };

    assert.equal(resolveUserAttention(awaitingTask, executive).includes('requires_my_approval'), true);
    assert.equal(resolveUserAttention(awaitingTask, matchingHead).includes('requires_my_approval'), true);
    assert.equal(resolveUserAttention(awaitingTask, otherHead).includes('requires_my_approval'), false);
  });
});
