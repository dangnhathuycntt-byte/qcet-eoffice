/**
 * Test Suite: Completion Is Lifecycle-Only (T03)
 *
 * Invariant under test:
 * - Completion is derived SOLELY from the canonical terminal lifecycle status
 *   COMPLETED (and its alias DONE).
 * - Progress is never a completion signal: WAITING_APPROVAL with
 *   progressPercent = 100 is NOT completed.
 * - CANCELLED is terminal but is NOT "completed".
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

import {
  isTaskLifecycleComplete,
  deriveTaskCompletion,
  mapDbStatusToLifecycle,
} from '../../src/domain/tasks/canonical-semantics';

// Barrel reachability proof: the new helpers must resolve from '@/domain/tasks'.
import {
  isTaskLifecycleComplete as barrelIsTaskLifecycleComplete,
  deriveTaskCompletion as barrelDeriveTaskCompletion,
} from '@/domain/tasks';

describe('T03.1 Completion is derived solely from the COMPLETED lifecycle', () => {
  it('reports COMPLETED (and DONE alias) as completed', () => {
    assert.equal(isTaskLifecycleComplete('COMPLETED'), true);
    assert.equal(isTaskLifecycleComplete('completed'), true);
    assert.equal(isTaskLifecycleComplete('DONE'), true);

    assert.deepEqual(deriveTaskCompletion({ status: 'COMPLETED' }), {
      lifecycle: 'COMPLETED',
      completed: true,
    });
    assert.equal(deriveTaskCompletion({ status: 'DONE' }).completed, true);
  });

  it('never reports WAITING_APPROVAL with progressPercent = 100 as completed', () => {
    const awaitingReview = { status: 'WAITING_APPROVAL', progressPercent: 100 };

    assert.equal(mapDbStatusToLifecycle('WAITING_APPROVAL'), 'WAITING_APPROVAL');
    assert.equal(isTaskLifecycleComplete('WAITING_APPROVAL'), false);
    assert.deepEqual(deriveTaskCompletion(awaitingReview), {
      lifecycle: 'WAITING_APPROVAL',
      completed: false,
    });
  });

  it('never reports PENDING_EXECUTIVE_APPROVAL with progressPercent = 100 as completed', () => {
    assert.equal(isTaskLifecycleComplete('PENDING_EXECUTIVE_APPROVAL'), false);
    assert.equal(
      deriveTaskCompletion({ status: 'PENDING_EXECUTIVE_APPROVAL', progressPercent: 100 }).completed,
      false
    );
  });

  it('ignores progressPercent entirely: 100% does not imply completion', () => {
    for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE', 'WAITING_APPROVAL']) {
      assert.equal(
        deriveTaskCompletion({ status, progressPercent: 100 }).completed,
        false,
        `status ${status} at progressPercent=100 must NOT be completed`
      );
      assert.equal(isTaskLifecycleComplete(status), false);
    }
  });

  it('treats CANCELLED as terminal but NOT completed', () => {
    assert.equal(isTaskLifecycleComplete('CANCELLED'), false);
    assert.equal(isTaskLifecycleComplete('CANCELED'), false);
    assert.equal(deriveTaskCompletion({ status: 'CANCELLED', progressPercent: 100 }).completed, false);
  });

  it('is safe for empty, null, and undefined input', () => {
    assert.equal(isTaskLifecycleComplete(''), false);
    assert.equal(isTaskLifecycleComplete(null), false);
    assert.equal(isTaskLifecycleComplete(undefined), false);
    assert.equal(deriveTaskCompletion(null).completed, false);
    assert.equal(deriveTaskCompletion(undefined).completed, false);
  });

  it('exposes the same helpers through the @/domain/tasks barrel', () => {
    assert.equal(barrelIsTaskLifecycleComplete('COMPLETED'), true);
    assert.equal(barrelIsTaskLifecycleComplete('WAITING_APPROVAL'), false);
    assert.equal(
      barrelDeriveTaskCompletion({ status: 'WAITING_APPROVAL', progressPercent: 100 }).completed,
      false
    );
  });
});
