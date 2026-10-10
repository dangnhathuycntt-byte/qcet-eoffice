import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentBucketWhere, parseDocumentBucket } from '../src/lib/documents/document-sidebar-buckets';

describe('nhóm "Đã thu hồi" ở menu Văn bản đi (V-05)', () => {
  test('nhận giá trị recalled từ URL', () => {
    assert.equal(parseDocumentBucket('recalled'), 'recalled');
    assert.equal(parseDocumentBucket('khong-co'), '');
  });

  test('văn bản đi lọc đúng trạng thái RECALLED của luồng phát hành', () => {
    assert.deepEqual(buildDocumentBucketWhere('VAN_BAN_DI', 'recalled'), { outgoingWorkflow: { is: { status: 'RECALLED' } } });
  });

  test('văn bản đến không khớp nhóm thu hồi (không trả về toàn bộ)', () => {
    assert.deepEqual(buildDocumentBucketWhere('VAN_BAN_DEN', 'recalled'), { id: { in: [] } });
  });
});
