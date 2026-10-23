import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTGOING_STEP_ACTIONS,
  describeOutgoingWaiting,
  formatReturnedNote,
  isReturnedNote,
  outgoingStepSlugsForState,
  returnedReasonOf,
} from '@qcet/shared/domain/documents/outgoing-steps';
import { getLedgerStepLabel } from '@qcet/shared/lib/documents/document-ledger-format';
import { OUTGOING_DOCUMENT_TRANSITIONS } from '../apps/api/src/server/documents/state-machine';
import type { OutgoingDocumentStatus } from '@qcet/contracts/documents';

describe('thao tác theo bước của văn bản đi khớp máy trạng thái (V-05)', () => {
  it('mọi thao tác đổi trạng thái đều là bước chuyển hợp lệ', () => {
    for (const [from, list] of Object.entries(OUTGOING_STEP_ACTIONS)) {
      for (const step of list ?? []) {
        if (step.to === null) continue;
        const allowed = (OUTGOING_DOCUMENT_TRANSITIONS as Record<string, readonly string[]>)[from] ?? [];
        assert.ok(allowed.includes(step.to), `${step.action}: ${from} -> ${step.to}`);
      }
    }
  });

  it('cấp số ở bước ký chức danh, đóng dấu ở bước đã cấp số, trả lại dự thảo bằng reject-content', () => {
    const at = (status: OutgoingDocumentStatus) => (OUTGOING_STEP_ACTIONS[status] ?? []).map((a) => a.action);
    assert.deepEqual(at('AUTHORIZED_SIGN'), ['sign', 'assign-number']);
    assert.deepEqual(at('NUMBERED'), ['organization-sign']);
    assert.deepEqual(at('CONTENT_REVIEW'), ['approve-content', 'reject-content', 'withdraw-content-review']);
    assert.equal(OUTGOING_STEP_ACTIONS.CONTENT_REVIEW?.find((a) => a.action === 'reject-content')?.requiresNote, true);
    assert.deepEqual(at('ORGANIZATION_SIGNED'), [], 'phát hành làm ở khối nơi nhận');
    assert.ok(!Object.values(OUTGOING_STEP_ACTIONS).flat().some((a) => (a?.action as string) === 'revision'), 'revision là sửa đổi sau phát hành, không phải trả lại dự thảo');
  });
});

describe('bước đang chờ của văn bản đi', () => {
  it('ký chức danh và cấp số là hai bước liên tiếp ở AUTHORIZED_SIGN: chỉ hiện thao tác của đúng bước', () => {
    assert.deepEqual(outgoingStepSlugsForState('AUTHORIZED_SIGN', null), ['sign']);
    assert.deepEqual(outgoingStepSlugsForState('AUTHORIZED_SIGN', new Date()), ['assign-number']);
    assert.deepEqual(outgoingStepSlugsForState('ORGANIZATION_SIGNED', null), []);
    assert.deepEqual(outgoingStepSlugsForState('ISSUED', null), []);
  });

  it('nêu ai đang giữ bước và việc đang chờ; nháp và đã phát hành không chờ ai', () => {
    const since = new Date('2026-10-23T02:12:00.000Z');
    assert.deepEqual(describeOutgoingWaiting({ status: 'CONTENT_REVIEW', contentReviewSubmittedAt: since, contentReviewerName: 'Lê Văn Thí' }), {
      who: 'Lê Văn Thí',
      task: 'duyệt nội dung',
      since: since.toISOString(),
    });
    assert.equal(describeOutgoingWaiting({ status: 'CONTENT_REVIEW' })?.who, 'Trưởng đơn vị');
    assert.equal(describeOutgoingWaiting({ status: 'FORMAT_CHECK', formatReviewSubmittedAt: since })?.task, 'kiểm tra thể thức');
    assert.equal(describeOutgoingWaiting({ status: 'AUTHORIZED_SIGN' })?.task, 'ký');
    assert.equal(describeOutgoingWaiting({ status: 'AUTHORIZED_SIGN', authorizedSignedAt: since })?.task, 'cấp số');
    assert.equal(describeOutgoingWaiting({ status: 'NUMBERED' })?.task, 'đóng dấu cơ quan');
    assert.equal(describeOutgoingWaiting({ status: 'ORGANIZATION_SIGNED' })?.task, 'phát hành');
    assert.equal(describeOutgoingWaiting({ status: 'DRAFT' }), null);
    assert.equal(describeOutgoingWaiting({ status: 'ISSUED' }), null);
  });
});

describe('dự thảo bị trả lại', () => {
  it('ghi chú trả lại ghi và đọc ngược được, kể cả bản ghi cũ dùng câu mặc định', () => {
    assert.equal(formatReturnedNote('Cần bổ sung căn cứ'), '[Trả lại]: Cần bổ sung căn cứ');
    assert.equal(formatReturnedNote('  '), '[Trả lại]');
    assert.equal(returnedReasonOf('[Trả lại]: Cần bổ sung căn cứ'), 'Cần bổ sung căn cứ');
    assert.equal(returnedReasonOf('[Trả lại]'), null);
    assert.equal(returnedReasonOf('[Trả lại soạn thảo để chỉnh sửa nội dung]'), null, 'câu mặc định cũ không phải lý do');
    assert.equal(isReturnedNote('[Trả lại soạn thảo để chỉnh sửa nội dung]'), true);
    assert.equal(isReturnedNote('Nội dung đạt'), false);
    assert.equal(isReturnedNote(null), false);
  });

  it('chip "Cần sửa" chỉ cho dự thảo văn bản đi đã bị trả lại; nháp mới vẫn là "Nháp"', () => {
    assert.equal(getLedgerStepLabel('CHO_PHAN_CONG', 'DRAFT', 'VAN_BAN_DI', true).label, 'Cần sửa');
    assert.equal(getLedgerStepLabel('CHO_PHAN_CONG', 'DRAFT', 'VAN_BAN_DI', false).label, 'Nháp');
    assert.equal(getLedgerStepLabel('CHO_PHAN_CONG', 'DRAFT', 'VAN_BAN_DI').label, 'Nháp');
    assert.equal(getLedgerStepLabel('CHO_PHAN_CONG', 'CONTENT_REVIEW', 'VAN_BAN_DI', true).label, 'Chờ duyệt', 'đã trình lại thì hết Cần sửa');
  });
});
