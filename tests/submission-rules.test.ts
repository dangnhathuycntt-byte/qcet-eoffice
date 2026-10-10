/** V-06: quy tắc thuần của luồng duyệt tờ trình nội bộ. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedDecisions,
  canSubmitFrom,
  canWithdraw,
  decisionRequiresNote,
  documentStatusFor,
  planUnitSteps,
  resolveOutcome,
  statusAfter,
} from '../src/domain/documents/submission-rules';

describe('V-06 quy tắc luồng duyệt tờ trình', () => {
  test('người trình là trưởng đơn vị thì bỏ bước đơn vị đó nhưng giữ đơn vị liên quan khác', () => {
    const plan = planUnitSteps({ involvedUnitIds: ['A', 'B', 'A', ''], headOfUnitIds: new Set(['A']) });
    assert.deepEqual(plan.pendingUnitIds, ['B']);
    assert.deepEqual(plan.skippedUnitIds, ['A']);
  });

  test('không có đơn vị nào phải duyệt thì lên thẳng lãnh đạo', () => {
    const plan = planUnitSteps({ involvedUnitIds: ['A'], headOfUnitIds: new Set(['A']) });
    assert.deepEqual(plan.pendingUnitIds, []);
  });

  test('chỉ lãnh đạo được Không phê duyệt; đơn vị chỉ Đồng ý hoặc Cần bổ sung', () => {
    assert.deepEqual(allowedDecisions('UNIT_HEAD'), ['APPROVE', 'REVISION']);
    assert.deepEqual(allowedDecisions('LEADER'), ['APPROVE', 'REVISION', 'REJECT']);
    assert.equal(decisionRequiresNote('APPROVE'), false);
    assert.equal(decisionRequiresNote('REVISION'), true);
    assert.equal(decisionRequiresNote('REJECT'), true);
  });

  test('duyệt song song: đủ đồng ý mới lên lãnh đạo; một bước Cần bổ sung đưa cả tờ trình về người trình (AC-V06-1)', () => {
    assert.equal(resolveOutcome({ stage: 'UNIT_HEAD', decision: 'APPROVE', pendingUnitStepsAfter: 1 }).kind, 'WAIT_OTHERS');
    assert.equal(resolveOutcome({ stage: 'UNIT_HEAD', decision: 'APPROVE', pendingUnitStepsAfter: 0 }).kind, 'GO_LEADER');
    assert.equal(resolveOutcome({ stage: 'UNIT_HEAD', decision: 'REVISION', pendingUnitStepsAfter: 3 }).kind, 'NEEDS_REVISION');
    assert.equal(resolveOutcome({ stage: 'LEADER', decision: 'APPROVE', pendingUnitStepsAfter: 0 }).kind, 'APPROVED');
    assert.equal(resolveOutcome({ stage: 'LEADER', decision: 'REJECT', pendingUnitStepsAfter: 0 }).kind, 'REJECTED');
  });

  test('trạng thái luồng và trạng thái chung của văn bản', () => {
    assert.equal(statusAfter({ kind: 'GO_LEADER' }), 'WAITING_LEADER');
    assert.equal(documentStatusFor('WAITING_UNIT_HEAD'), 'CHO_PHE_DUYET');
    assert.equal(documentStatusFor('APPROVED'), 'DA_HOAN_THANH');
    assert.equal(documentStatusFor('NEEDS_REVISION'), 'CHO_PHAN_CONG');
  });

  test('trình được khi chưa có luồng, nháp hoặc cần bổ sung; rút lại chỉ khi chưa ai mở', () => {
    assert.equal(canSubmitFrom(null), true);
    assert.equal(canSubmitFrom('DRAFT'), true);
    assert.equal(canSubmitFrom('NEEDS_REVISION'), true);
    assert.equal(canSubmitFrom('WAITING_LEADER'), false);
    assert.equal(canSubmitFrom('APPROVED'), false);
    assert.equal(canWithdraw('WAITING_UNIT_HEAD', null, 0), true);
    assert.equal(canWithdraw('WAITING_UNIT_HEAD', new Date(), 0), false, 'đã có người mở');
    assert.equal(canWithdraw('WAITING_UNIT_HEAD', null, 1), false, 'đã có bước được quyết định');
    assert.equal(canWithdraw('APPROVED', null, 0), false);
  });
});
