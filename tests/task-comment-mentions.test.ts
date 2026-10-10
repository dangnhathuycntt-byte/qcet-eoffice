/** T-03: hàm thuần cho nhắc tên trong ô soạn bình luận. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterMentionCandidates,
  findMentionQuery,
  insertMention,
  resolveMentionIds,
} from '../src/domain/tasks/comment-mentions';

const people = [
  { id: 'a', name: 'Nguyễn Thị Hồng Trinh' },
  { id: 'b', name: 'Đặng Nhật Huy' },
  { id: 'c', name: 'Trần Văn Hải' },
];

describe('T-03 nhắc tên', () => {
  test('nhận ra lần nhắc đang gõ ở đầu dòng hoặc sau khoảng trắng', () => {
    assert.deepEqual(findMentionQuery('@hu', 3), { query: 'hu', start: 0 });
    assert.deepEqual(findMentionQuery('Nhờ @tri', 8), { query: 'tri', start: 4 });
    assert.equal(findMentionQuery('email a@b', 9), null, 'không coi @ giữa từ là nhắc tên');
    assert.equal(findMentionQuery('xong rồi', 8), null);
  });

  test('lọc không phân biệt dấu và chữ Đ', () => {
    assert.deepEqual(filterMentionCandidates(people, 'dang').map((p) => p.id), ['b']);
    assert.deepEqual(filterMentionCandidates(people, 'HAI').map((p) => p.id), ['c']);
    assert.equal(filterMentionCandidates(people, '').length, 3);
  });

  test('chèn tên thay cho phần đang gõ và đặt con trỏ sau khoảng trắng', () => {
    const out = insertMention('Nhờ @hu xem', 7, 4, people[1]);
    assert.equal(out.text, 'Nhờ @Đặng Nhật Huy  xem');
    assert.equal(out.caret, 4 + '@Đặng Nhật Huy '.length);
  });

  test('chỉ giữ người còn được nhắc trong nội dung cuối cùng', () => {
    const ids = resolveMentionIds('Nhờ @Đặng Nhật Huy kiểm tra', [people[0], people[1]]);
    assert.deepEqual(ids, ['b']);
  });
});
