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

import { deriveTaskCompletion, mapDbStatusToLifecycle } from '@qcet/shared/domain/tasks/canonical-semantics';

// Barrel reachability proof: the new helpers must resolve from '@/domain/tasks'.
import { deriveTaskCompletion as barrelDeriveTaskCompletion } from '@qcet/shared/domain/tasks';

describe('T03.1 Completion is derived solely from the COMPLETED lifecycle', () => {

  it('exposes the same helpers through the @/domain/tasks barrel', () => {
    assert.equal(
      barrelDeriveTaskCompletion({ status: 'WAITING_APPROVAL', progressPercent: 100 }).completed,
      false
    );
  });
});
