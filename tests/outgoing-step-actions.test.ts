import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OUTGOING_STEP_ACTIONS } from '../src/lib/documents/outgoing-step-actions';
import { OUTGOING_DOCUMENT_TRANSITIONS } from '../src/lib/documents/state-machine';
import type { OutgoingDocumentStatus } from '../src/contracts/documents';

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
    assert.deepEqual(at('CONTENT_REVIEW'), ['approve-content', 'reject-content']);
    assert.equal(OUTGOING_STEP_ACTIONS.CONTENT_REVIEW?.find((a) => a.action === 'reject-content')?.requiresNote, true);
    assert.deepEqual(at('ORGANIZATION_SIGNED'), [], 'phát hành làm ở khối nơi nhận');
    assert.ok(!Object.values(OUTGOING_STEP_ACTIONS).flat().some((a) => a?.action === 'revision'), 'revision là sửa đổi sau phát hành, không phải trả lại dự thảo');
  });
});
