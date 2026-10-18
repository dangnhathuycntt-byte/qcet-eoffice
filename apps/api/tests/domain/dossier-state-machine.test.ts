/**
 * Work Dossier State Machine & Archival Governance Test Suite (Issue #77 / WI-6.2a)
 *
 * Invariants Tested:
 * 1. Complete State Topology & Lifecycle Transitions (100% matrix coverage):
 *    - OPEN -> [ACTIVE, CLOSED]
 *    - ACTIVE -> [CLOSED, READY_FOR_ARCHIVE]
 *    - CLOSED -> [ACTIVE, READY_FOR_ARCHIVE]
 *    - READY_FOR_ARCHIVE -> [SUBMITTED_TO_ARCHIVE, ACTIVE]
 *    - SUBMITTED_TO_ARCHIVE -> [ACCEPTED, READY_FOR_ARCHIVE]
 *    - ACCEPTED -> [ARCHIVED]
 *    - ARCHIVED -> [] (terminal)
 * 2. Terminal State Protection:
 *    - ARCHIVED dossiers are immutable historical records with 0 outgoing transitions.
 * 3. Immutability Guards:
 *    - Content modifications (add/remove items) are permitted ONLY in OPEN and ACTIVE.
 *    - CLOSED, READY_FOR_ARCHIVE, SUBMITTED_TO_ARCHIVE, ACCEPTED, ARCHIVED are immutable.
 * 4. Error Behavior:
 *    - Invalid transitions throw InvalidTransitionError with diagnostic context.
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

import {
  DossierStatus,
  DOSSIER_TRANSITIONS,
  TERMINAL_DOSSIER_STATUSES,
  IMMUTABLE_DOSSIER_STATUSES,
  canTransition,
  assertTransition,
  isDossierImmutable,
  assertDossierNotImmutable,
  isTerminalState,
} from '../../src/domain/dossiers/state-machine';
import { InvalidTransitionError } from '../../src/server/api/errors';

describe('WI-6.2a: Work Dossier State Machine Formalization (Issue #77)', () => {
  const ALL_STATUSES: DossierStatus[] = [
    DossierStatus.OPEN,
    DossierStatus.ACTIVE,
    DossierStatus.CLOSED,
    DossierStatus.READY_FOR_ARCHIVE,
    DossierStatus.SUBMITTED_TO_ARCHIVE,
    DossierStatus.ACCEPTED,
    DossierStatus.ARCHIVED,
  ];

  describe('1. State Space & Transition Topology Invariants', () => {
    it('defines exactly 7 distinct dossier lifecycle states', () => {
      assert.equal(ALL_STATUSES.length, 7);
      const uniqueStatuses = new Set(ALL_STATUSES);
      assert.equal(uniqueStatuses.size, 7);
    });

    it('contains configuration for every state in DOSSIER_TRANSITIONS', () => {
      for (const status of ALL_STATUSES) {
        assert.ok(
          Array.isArray(DOSSIER_TRANSITIONS[status]),
          `Transition configuration missing for state: ${status}`
        );
      }
    });

    it('matches the exact expected outgoing transitions specified in WI-6.2a', () => {
      assert.deepEqual(DOSSIER_TRANSITIONS.OPEN, ['ACTIVE', 'CLOSED']);
      assert.deepEqual(DOSSIER_TRANSITIONS.ACTIVE, ['CLOSED', 'READY_FOR_ARCHIVE']);
      assert.deepEqual(DOSSIER_TRANSITIONS.CLOSED, ['ACTIVE', 'READY_FOR_ARCHIVE']);
      assert.deepEqual(DOSSIER_TRANSITIONS.READY_FOR_ARCHIVE, ['SUBMITTED_TO_ARCHIVE', 'ACTIVE']);
      assert.deepEqual(DOSSIER_TRANSITIONS.SUBMITTED_TO_ARCHIVE, ['ACCEPTED', 'READY_FOR_ARCHIVE']);
      assert.deepEqual(DOSSIER_TRANSITIONS.ACCEPTED, ['ARCHIVED']);
      assert.deepEqual(DOSSIER_TRANSITIONS.ARCHIVED, []);
    });
  });

  describe('2. 100% Permitted Transitions Matrix', () => {
    it('allows OPEN -> ACTIVE (auto-activation on adding initial documents)', () => {
      assert.equal(canTransition('OPEN', 'ACTIVE'), true);
      assert.doesNotThrow(() => assertTransition('OPEN', 'ACTIVE'));
    });

    it('allows OPEN -> CLOSED (closing an empty or unexecuted dossier)', () => {
      assert.equal(canTransition('OPEN', 'CLOSED'), true);
      assert.doesNotThrow(() => assertTransition('OPEN', 'CLOSED'));
    });

    it('allows ACTIVE -> CLOSED (closing active dossier upon completion)', () => {
      assert.equal(canTransition('ACTIVE', 'CLOSED'), true);
      assert.doesNotThrow(() => assertTransition('ACTIVE', 'CLOSED'));
    });

    it('allows ACTIVE -> READY_FOR_ARCHIVE (direct preparation for archival)', () => {
      assert.equal(canTransition('ACTIVE', 'READY_FOR_ARCHIVE'), true);
      assert.doesNotThrow(() => assertTransition('ACTIVE', 'READY_FOR_ARCHIVE'));
    });

    it('allows CLOSED -> ACTIVE (reopening closed dossier for additional items)', () => {
      assert.equal(canTransition('CLOSED', 'ACTIVE'), true);
      assert.doesNotThrow(() => assertTransition('CLOSED', 'ACTIVE'));
    });

    it('allows CLOSED -> READY_FOR_ARCHIVE (marking closed dossier ready for submission)', () => {
      assert.equal(canTransition('CLOSED', 'READY_FOR_ARCHIVE'), true);
      assert.doesNotThrow(() => assertTransition('CLOSED', 'READY_FOR_ARCHIVE'));
    });

    it('allows READY_FOR_ARCHIVE -> SUBMITTED_TO_ARCHIVE (submitting to institutional archives)', () => {
      assert.equal(canTransition('READY_FOR_ARCHIVE', 'SUBMITTED_TO_ARCHIVE'), true);
      assert.doesNotThrow(() => assertTransition('READY_FOR_ARCHIVE', 'SUBMITTED_TO_ARCHIVE'));
    });

    it('allows READY_FOR_ARCHIVE -> ACTIVE (withdrawing back to active processing)', () => {
      assert.equal(canTransition('READY_FOR_ARCHIVE', 'ACTIVE'), true);
      assert.doesNotThrow(() => assertTransition('READY_FOR_ARCHIVE', 'ACTIVE'));
    });

    it('allows SUBMITTED_TO_ARCHIVE -> ACCEPTED (archivist formal acceptance of transfer)', () => {
      assert.equal(canTransition('SUBMITTED_TO_ARCHIVE', 'ACCEPTED'), true);
      assert.doesNotThrow(() => assertTransition('SUBMITTED_TO_ARCHIVE', 'ACCEPTED'));
    });

    it('allows SUBMITTED_TO_ARCHIVE -> READY_FOR_ARCHIVE (archivist rejection/return for revisions)', () => {
      assert.equal(canTransition('SUBMITTED_TO_ARCHIVE', 'READY_FOR_ARCHIVE'), true);
      assert.doesNotThrow(() => assertTransition('SUBMITTED_TO_ARCHIVE', 'READY_FOR_ARCHIVE'));
    });

    it('allows ACCEPTED -> ARCHIVED (repository shelving and final historical archiving)', () => {
      assert.equal(canTransition('ACCEPTED', 'ARCHIVED'), true);
      assert.doesNotThrow(() => assertTransition('ACCEPTED', 'ARCHIVED'));
    });
  });

  describe('3. Terminal State Invariants (ARCHIVED)', () => {
    it('identifies ARCHIVED as the only terminal state', () => {
      assert.equal(isTerminalState('ARCHIVED'), true);
      assert.deepEqual(TERMINAL_DOSSIER_STATUSES, ['ARCHIVED']);

      for (const status of ALL_STATUSES) {
        if (status !== 'ARCHIVED') {
          assert.equal(
            isTerminalState(status),
            false,
            `State ${status} should not be terminal`
          );
        }
      }
    });

    it('enforces 0 outgoing transitions from ARCHIVED to any state', () => {
      for (const target of ALL_STATUSES) {
        assert.equal(
          canTransition('ARCHIVED', target),
          false,
          `ARCHIVED must not transition to ${target}`
        );

        assert.throws(
          () => assertTransition('ARCHIVED', target),
          (err: any) => {
            assert.ok(err instanceof InvalidTransitionError);
            assert.equal(err.code, 'INVALID_TRANSITION');
            assert.match(err.message, /Không thể chuyển trạng thái hồ sơ công việc/);
            return true;
          }
        );
      }
    });
  });

  describe('4. Exhaustive 7x7 Matrix Disallowed Transitions Validation', () => {
    // 11 valid transitions out of 49 total combinations
    const VALID_PAIRS = new Set([
      'OPEN->ACTIVE',
      'OPEN->CLOSED',
      'ACTIVE->CLOSED',
      'ACTIVE->READY_FOR_ARCHIVE',
      'CLOSED->ACTIVE',
      'CLOSED->READY_FOR_ARCHIVE',
      'READY_FOR_ARCHIVE->SUBMITTED_TO_ARCHIVE',
      'READY_FOR_ARCHIVE->ACTIVE',
      'SUBMITTED_TO_ARCHIVE->ACCEPTED',
      'SUBMITTED_TO_ARCHIVE->READY_FOR_ARCHIVE',
      'ACCEPTED->ARCHIVED',
    ]);

    it('verifies all 49 transitions strictly adhere to the specification', () => {
      let validCount = 0;
      let invalidCount = 0;

      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          const key = `${from}->${to}`;
          const isPermitted = canTransition(from, to);

          if (VALID_PAIRS.has(key)) {
            assert.equal(isPermitted, true, `Expected ${key} to be allowed`);
            validCount++;
          } else {
            assert.equal(isPermitted, false, `Expected ${key} to be prohibited`);
            assert.throws(
              () => assertTransition(from, to),
              (err: any) => {
                assert.ok(err instanceof InvalidTransitionError);
                return true;
              }
            );
            invalidCount++;
          }
        }
      }

      assert.equal(validCount, 11);
      assert.equal(invalidCount, 38);
      assert.equal(validCount + invalidCount, 49);
    });

    it('prohibits skipping lifecycle stages', () => {
      // Skipping from OPEN directly to ARCHIVED
      assert.equal(canTransition('OPEN', 'ARCHIVED'), false);
      // Skipping from ACTIVE directly to ARCHIVED
      assert.equal(canTransition('ACTIVE', 'ARCHIVED'), false);
      // Skipping from CLOSED directly to ACCEPTED
      assert.equal(canTransition('CLOSED', 'ACCEPTED'), false);
      // Skipping from READY_FOR_ARCHIVE directly to ARCHIVED
      assert.equal(canTransition('READY_FOR_ARCHIVE', 'ARCHIVED'), false);
    });

    it('prohibits self-transitions', () => {
      for (const status of ALL_STATUSES) {
        assert.equal(
          canTransition(status, status),
          false,
          `Self-transition for ${status} must return false`
        );
      }
    });

    it('handles invalid/unknown status gracefully', () => {
      assert.equal(canTransition('NON_EXISTENT' as any, 'ACTIVE'), false);
      assert.equal(canTransition('OPEN', 'NON_EXISTENT' as any), false);
    });
  });

  describe('5. assertTransition Diagnostic Context', () => {
    it('includes dossierId in error message when provided', () => {
      assert.throws(
        () => assertTransition('OPEN', 'ARCHIVED', { dossierId: 'DOS-2026-001' }),
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          assert.match(err.message, /cho hồ sơ DOS-2026-001/);
          return true;
        }
      );
    });

    it('includes custom details in error message when provided', () => {
      assert.throws(
        () =>
          assertTransition('CLOSED', 'ARCHIVED', {
            dossierId: 'DOS-2026-002',
            details: 'Hồ sơ chưa nộp lưu vào văn thư',
          }),
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          assert.match(err.message, /Hồ sơ chưa nộp lưu vào văn thư/);
          return true;
        }
      );
    });
  });

  describe('6. Immutability Invariants (isDossierImmutable & assertDossierNotImmutable)', () => {
    it('marks OPEN and ACTIVE as mutable', () => {
      assert.equal(isDossierImmutable('OPEN'), false);
      assert.equal(isDossierImmutable('ACTIVE'), false);

      assert.doesNotThrow(() => assertDossierNotImmutable('OPEN'));
      assert.doesNotThrow(() => assertDossierNotImmutable('ACTIVE'));
      assert.doesNotThrow(() => assertDossierNotImmutable('ACTIVE', 'thêm tài liệu vào'));
    });

    it('marks CLOSED, READY_FOR_ARCHIVE, SUBMITTED_TO_ARCHIVE, ACCEPTED, ARCHIVED as immutable', () => {
      const immutableList: DossierStatus[] = [
        'CLOSED',
        'READY_FOR_ARCHIVE',
        'SUBMITTED_TO_ARCHIVE',
        'ACCEPTED',
        'ARCHIVED',
      ];

      assert.deepEqual(IMMUTABLE_DOSSIER_STATUSES, immutableList);

      for (const status of immutableList) {
        assert.equal(
          isDossierImmutable(status),
          true,
          `Status ${status} must be marked immutable`
        );

        assert.throws(
          () => assertDossierNotImmutable(status, 'thêm tài liệu vào'),
          (err: any) => {
            assert.ok(err instanceof InvalidTransitionError);
            assert.match(err.message, /Không thể thêm tài liệu vào hồ sơ đã đóng hoặc đã nộp lưu trữ/);
            assert.match(err.message, new RegExp(status));
            return true;
          }
        );

        assert.throws(
          () => assertDossierNotImmutable(status, 'xóa tài liệu khỏi'),
          (err: any) => {
            assert.ok(err instanceof InvalidTransitionError);
            assert.match(err.message, /Không thể xóa tài liệu khỏi hồ sơ đã đóng hoặc đã nộp lưu trữ/);
            return true;
          }
        );
      }
    });

    it('uses default action description when not specified', () => {
      assert.throws(
        () => assertDossierNotImmutable('ARCHIVED'),
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          assert.match(err.message, /Không thể thay đổi hồ sơ đã đóng hoặc đã nộp lưu trữ/);
          return true;
        }
      );
    });
  });
});
