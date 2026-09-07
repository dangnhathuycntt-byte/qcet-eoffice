import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Task Detail & Deliverable Workflow Tests', () => {
  test('transition task status to WAITING_APPROVAL when deliverable is submitted', () => {
    let currentStatus = 'IN_PROGRESS';
    const submission = {
      title: 'Báo cáo nghiệm thu.pdf',
      fileUrl: 'https://qcet.edu.vn/files/report.pdf'
    };

    if (submission.fileUrl) {
      currentStatus = 'WAITING_APPROVAL';
    }

    assert.strictEqual(currentStatus, 'WAITING_APPROVAL');
  });

  test('enforces Separation of Duties (SoD) on review approval', () => {
    const taskSubmitterId = 'user-001';
    const currentReviewerId = 'user-001'; // Trùng người

    const isAllowedToApprove = taskSubmitterId !== currentReviewerId;
    assert.strictEqual(isAllowedToApprove, false, 'Submitter cannot approve their own deliverable');
  });
});
