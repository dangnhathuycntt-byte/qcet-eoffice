/**
 * Meeting State Machine Formalization Test Suite (WI-6.1a / Issue #75)
 *
 * Verifies:
 * 1. Canonical transitions:
 *    - DRAFT_AGENDA -> [INVITED, CANCELLED]
 *    - INVITED -> [HELD, CANCELLED]
 *    - HELD -> [MINUTES_DRAFT, CANCELLED]
 *    - MINUTES_DRAFT -> [MINUTES_CONFIRMED, CANCELLED]
 *    - MINUTES_CONFIRMED -> [] (terminal)
 *    - CANCELLED -> [] (terminal)
 * 2. Invalid forward transitions (skip-stage prevention).
 * 3. Invalid backward transitions (regression prevention).
 * 4. Terminal state protection (immutability).
 * 5. canTransition, assertTransition, isMeetingFinalized, assertMeetingNotFinalized exports.
 * 6. MeetingStateMachine class facade parity.
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

import {
  MeetingStatus,
  MEETING_STATUSES,
  ALLOWED_MEETING_TRANSITIONS,
  TERMINAL_MEETING_STATUSES,
  canTransition,
  assertTransition,
  isMeetingFinalized,
  assertMeetingNotFinalized,
  InvalidMeetingStateTransitionError,
  FinalizedMeetingError,
  MeetingStateMachine,
} from '../../src/domain/meetings';

// Barrel export reachability proof via alias
import {
  canTransition as barrelCanTransition,
  assertTransition as barrelAssertTransition,
  isMeetingFinalized as barrelIsMeetingFinalized,
  assertMeetingNotFinalized as barrelAssertMeetingNotFinalized,
  MeetingStateMachine as BarrelMeetingStateMachine,
} from '@/domain/meetings';

describe('WI-6.1a: Meeting State Machine Formalization', () => {
  describe('1. Canonical Statuses & Definitions', () => {
    it('exports all 6 canonical meeting statuses', () => {
      const expectedStatuses: MeetingStatus[] = [
        'DRAFT_AGENDA',
        'INVITED',
        'HELD',
        'MINUTES_DRAFT',
        'MINUTES_CONFIRMED',
        'CANCELLED',
      ];
      assert.deepEqual([...MEETING_STATUSES], expectedStatuses);
      assert.equal(MEETING_STATUSES.length, 6);
    });

    it('identifies terminal statuses correctly', () => {
      assert.deepEqual([...TERMINAL_MEETING_STATUSES], ['MINUTES_CONFIRMED', 'CANCELLED']);
    });

    it('barrel export resolves identical functions', () => {
      assert.equal(canTransition, barrelCanTransition);
      assert.equal(assertTransition, barrelAssertTransition);
      assert.equal(isMeetingFinalized, barrelIsMeetingFinalized);
      assert.equal(assertMeetingNotFinalized, barrelAssertMeetingNotFinalized);
      assert.equal(MeetingStateMachine, BarrelMeetingStateMachine);
    });
  });

  describe('2. canTransition - Valid Transitions', () => {
    it('allows DRAFT_AGENDA -> INVITED', () => {
      assert.equal(canTransition('DRAFT_AGENDA', 'INVITED'), true);
    });

    it('allows DRAFT_AGENDA -> CANCELLED', () => {
      assert.equal(canTransition('DRAFT_AGENDA', 'CANCELLED'), true);
    });

    it('allows INVITED -> HELD', () => {
      assert.equal(canTransition('INVITED', 'HELD'), true);
    });

    it('allows INVITED -> CANCELLED', () => {
      assert.equal(canTransition('INVITED', 'CANCELLED'), true);
    });

    it('allows HELD -> MINUTES_DRAFT', () => {
      assert.equal(canTransition('HELD', 'MINUTES_DRAFT'), true);
    });

    it('allows HELD -> CANCELLED', () => {
      assert.equal(canTransition('HELD', 'CANCELLED'), true);
    });

    it('allows MINUTES_DRAFT -> MINUTES_CONFIRMED', () => {
      assert.equal(canTransition('MINUTES_DRAFT', 'MINUTES_CONFIRMED'), true);
    });

    it('allows MINUTES_DRAFT -> CANCELLED', () => {
      assert.equal(canTransition('MINUTES_DRAFT', 'CANCELLED'), true);
    });
  });

  describe('3. canTransition - Invalid Forward & Skip-Stage Transitions', () => {
    it('denies skipping stages from DRAFT_AGENDA', () => {
      assert.equal(canTransition('DRAFT_AGENDA', 'HELD'), false);
      assert.equal(canTransition('DRAFT_AGENDA', 'MINUTES_DRAFT'), false);
      assert.equal(canTransition('DRAFT_AGENDA', 'MINUTES_CONFIRMED'), false);
    });

    it('denies skipping stages from INVITED', () => {
      assert.equal(canTransition('INVITED', 'MINUTES_DRAFT'), false);
      assert.equal(canTransition('INVITED', 'MINUTES_CONFIRMED'), false);
    });

    it('denies skipping stages from HELD', () => {
      assert.equal(canTransition('HELD', 'MINUTES_CONFIRMED'), false);
    });
  });

  describe('4. canTransition - Invalid Backward Transitions (Anti-Regression)', () => {
    it('denies backward transitions from INVITED to DRAFT_AGENDA', () => {
      assert.equal(canTransition('INVITED', 'DRAFT_AGENDA'), false);
    });

    it('denies backward transitions from HELD to prior states', () => {
      assert.equal(canTransition('HELD', 'INVITED'), false);
      assert.equal(canTransition('HELD', 'DRAFT_AGENDA'), false);
    });

    it('denies backward transitions from MINUTES_DRAFT to prior states', () => {
      assert.equal(canTransition('MINUTES_DRAFT', 'HELD'), false);
      assert.equal(canTransition('MINUTES_DRAFT', 'INVITED'), false);
      assert.equal(canTransition('MINUTES_DRAFT', 'DRAFT_AGENDA'), false);
    });
  });

  describe('5. Terminal State Immutability Protection', () => {
    it('denies all outgoing transitions from MINUTES_CONFIRMED', () => {
      for (const target of MEETING_STATUSES) {
        assert.equal(
          canTransition('MINUTES_CONFIRMED', target),
          false,
          'MINUTES_CONFIRMED should not transition to ' + target
        );
      }
    });

    it('denies all outgoing transitions from CANCELLED', () => {
      for (const target of MEETING_STATUSES) {
        assert.equal(
          canTransition('CANCELLED', target),
          false,
          'CANCELLED should not transition to ' + target
        );
      }
    });

    it('denies self-transitions (no-op loop is not a valid state transition)', () => {
      for (const status of MEETING_STATUSES) {
        assert.equal(
          canTransition(status, status),
          false,
          'Self-transition ' + status + ' -> ' + status + ' should be false'
        );
      }
    });

    it('handles unknown or malformed statuses gracefully', () => {
      assert.equal(canTransition('UNKNOWN_STATUS', 'INVITED'), false);
      assert.equal(canTransition('INVITED', 'UNKNOWN_STATUS'), false);
      assert.equal(canTransition('', ''), false);
    });
  });

  describe('6. assertTransition Assertions & Errors', () => {
    it('does not throw for valid transitions', () => {
      assert.doesNotThrow(() => assertTransition('DRAFT_AGENDA', 'INVITED'));
      assert.doesNotThrow(() => assertTransition('INVITED', 'HELD'));
      assert.doesNotThrow(() => assertTransition('HELD', 'MINUTES_DRAFT'));
      assert.doesNotThrow(() => assertTransition('MINUTES_DRAFT', 'MINUTES_CONFIRMED'));
      assert.doesNotThrow(() => assertTransition('DRAFT_AGENDA', 'CANCELLED'));
      assert.doesNotThrow(() => assertTransition('INVITED', 'CANCELLED'));
      assert.doesNotThrow(() => assertTransition('HELD', 'CANCELLED'));
      assert.doesNotThrow(() => assertTransition('MINUTES_DRAFT', 'CANCELLED'));
    });

    it('throws InvalidMeetingStateTransitionError for invalid transition with proper metadata', () => {
      assert.throws(
        () => assertTransition('DRAFT_AGENDA', 'MINUTES_CONFIRMED'),
        (err: any) => {
          assert.ok(err instanceof InvalidMeetingStateTransitionError);
          assert.equal(err.name, 'InvalidMeetingStateTransitionError');
          assert.equal(err.code, 'INVALID_WORKFLOW_STATE');
          assert.equal(err.statusCode, 400);
          assert.equal(err.from, 'DRAFT_AGENDA');
          assert.equal(err.to, 'MINUTES_CONFIRMED');
          assert.ok(err.message.includes('DRAFT_AGENDA'));
          assert.ok(err.message.includes('MINUTES_CONFIRMED'));
          return true;
        }
      );
    });

    it('throws InvalidMeetingStateTransitionError when attempting to transition from terminal states', () => {
      assert.throws(
        () => assertTransition('MINUTES_CONFIRMED', 'HELD'),
        (err: any) => {
          assert.ok(err instanceof InvalidMeetingStateTransitionError);
          assert.equal(err.from, 'MINUTES_CONFIRMED');
          assert.equal(err.to, 'HELD');
          return true;
        }
      );

      assert.throws(
        () => assertTransition('CANCELLED', 'INVITED'),
        (err: any) => {
          assert.ok(err instanceof InvalidMeetingStateTransitionError);
          assert.equal(err.from, 'CANCELLED');
          assert.equal(err.to, 'INVITED');
          return true;
        }
      );
    });
  });

  describe('7. isMeetingFinalized & assertMeetingNotFinalized', () => {
    it('correctly identifies finalized states', () => {
      assert.equal(isMeetingFinalized('MINUTES_CONFIRMED'), true);
      assert.equal(isMeetingFinalized('CANCELLED'), true);
      assert.equal(isMeetingFinalized('DRAFT_AGENDA'), false);
      assert.equal(isMeetingFinalized('INVITED'), false);
      assert.equal(isMeetingFinalized('HELD'), false);
      assert.equal(isMeetingFinalized('MINUTES_DRAFT'), false);
      assert.equal(isMeetingFinalized('RANDOM_STATUS'), false);
    });

    it('assertMeetingNotFinalized does not throw on active states', () => {
      assert.doesNotThrow(() => assertMeetingNotFinalized('DRAFT_AGENDA', 'chỉnh sửa chương trình'));
      assert.doesNotThrow(() => assertMeetingNotFinalized('INVITED', 'thêm thành viên'));
      assert.doesNotThrow(() => assertMeetingNotFinalized('HELD', 'soạn biên bản'));
      assert.doesNotThrow(() => assertMeetingNotFinalized('MINUTES_DRAFT', 'cập nhật biên bản'));
    });

    it('assertMeetingNotFinalized throws FinalizedMeetingError on terminal states', () => {
      assert.throws(
        () => assertMeetingNotFinalized('MINUTES_CONFIRMED', 'mời thành viên tham dự'),
        (err: any) => {
          assert.ok(err instanceof FinalizedMeetingError);
          assert.equal(err.name, 'FinalizedMeetingError');
          assert.equal(err.code, 'INVALID_WORKFLOW_STATE');
          assert.equal(err.statusCode, 400);
          assert.equal(err.status, 'MINUTES_CONFIRMED');
          assert.ok(err.message.includes('mời thành viên tham dự'));
          assert.ok(err.message.includes('MINUTES_CONFIRMED'));
          return true;
        }
      );

      assert.throws(
        () => assertMeetingNotFinalized('CANCELLED'),
        (err: any) => {
          assert.ok(err instanceof FinalizedMeetingError);
          assert.equal(err.status, 'CANCELLED');
          assert.ok(err.message.includes('CANCELLED'));
          return true;
        }
      );
    });
  });

  describe('8. MeetingStateMachine Facade Parity', () => {
    it('facade static methods delegate correctly to standalone functions', () => {
      assert.equal(
        MeetingStateMachine.canTransition('INVITED', 'HELD'),
        canTransition('INVITED', 'HELD')
      );
      assert.equal(
        MeetingStateMachine.isFinalized('MINUTES_CONFIRMED'),
        isMeetingFinalized('MINUTES_CONFIRMED')
      );
      assert.doesNotThrow(() => MeetingStateMachine.assertTransition('HELD', 'MINUTES_DRAFT'));
      assert.doesNotThrow(() => MeetingStateMachine.assertNotFinalized('INVITED', 'test'));
      assert.throws(() => MeetingStateMachine.assertTransition('CANCELLED', 'HELD'));
      assert.throws(() => MeetingStateMachine.assertNotFinalized('CANCELLED', 'test'));
    });

    it('exposes STATUSES and TRANSITIONS maps on the facade class', () => {
      assert.deepEqual(MeetingStateMachine.STATUSES, MEETING_STATUSES);
      assert.deepEqual(MeetingStateMachine.TRANSITIONS, ALLOWED_MEETING_TRANSITIONS);
      assert.deepEqual(MeetingStateMachine.TERMINAL_STATUSES, TERMINAL_MEETING_STATUSES);
    });
  });
});
