/** T-03: hàm thuần cho nhắc tên trong ô soạn bình luận. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterMentionCandidates,
  findMentionQuery,
  insertMention,
  MENTION_ALL_ID,
  MENTION_ALL_MAX,
  MENTION_ALL_NAME,
  offersMentionAll,
  resolveMentionIds,
  splitMentions,
} from '@qcet/shared/domain/tasks/comment-mentions';

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

  test('tách "@Tên" đã biết để tô màu; tên dài khớp trước; email và tên lạ giữ nguyên', () => {
    const names = ['Đặng Nhật Huy', 'Đặng Nhật', 'Trần Văn Hải'];
    assert.deepEqual(splitMentions('@Đặng Nhật Huy và @Trần Văn Hải, xem giúp.', names), [
      { text: '@Đặng Nhật Huy', mention: true },
      { text: ' và ', mention: false },
      { text: '@Trần Văn Hải', mention: true },
      { text: ', xem giúp.', mention: false },
    ]);
    assert.deepEqual(splitMentions('gửi a@Trần Văn Hải.vn và @Người Lạ', names), [
      { text: 'gửi a@Trần Văn Hải.vn và @Người Lạ', mention: false },
    ]);
    assert.deepEqual(splitMentions('không nhắc ai', names), [{ text: 'không nhắc ai', mention: false }]);
  });
});

/** Người dùng 21/10/2026: "thêm cái tag everyone" (gõ tay 6 người cùng đơn vị cho một bình luận). */
describe('"@Tất cả" nhắc mọi người trong danh sách nhắc được', () => {
  const all = { id: MENTION_ALL_ID, name: MENTION_ALL_NAME };

  test('hiện khi chưa gõ gì hoặc gõ tat/all/every/moi (không dấu); ẩn khi gõ tên người, dưới 2 người hoặc quá trần', () => {
    for (const query of ['', 'tat', 'Tất', 'tatca', 'all', 'every', 'moi']) assert.equal(offersMentionAll(people, query), true, query);
    assert.equal(offersMentionAll(people, 'trinh'), false);
    assert.equal(offersMentionAll(people.slice(0, 1), ''), false, 'một người thì nhắc thẳng người đó');
    const many = Array.from({ length: MENTION_ALL_MAX + 1 }, (_, i) => ({ id: `u${i}`, name: `Người ${i}` }));
    assert.equal(offersMentionAll(many, ''), false, 'quá 30 người thì chọn từng người');
    assert.equal(offersMentionAll(many.slice(0, MENTION_ALL_MAX), ''), true);
  });

  test('chèn một token "@Tất cả", gửi mã của mọi người; xóa token thì không nhắc ai; tô màu như một lần nhắc', () => {
    const inserted = insertMention('@', 1, 0, all);
    assert.equal(inserted.text, '@Tất cả ');
    const body = `${inserted.text}xem qua nhé`;
    assert.deepEqual(resolveMentionIds(body, [all], people).sort(), ['a', 'b', 'c']);
    assert.deepEqual(resolveMentionIds('xem qua nhé', [all], people), []);
    assert.deepEqual(resolveMentionIds('@Tất cảnh báo', [all], people), [], 'chữ dính sau không phải token');
    assert.deepEqual(splitMentions(body, [MENTION_ALL_NAME]), [
      { text: '@Tất cả', mention: true },
      { text: ' xem qua nhé', mention: false },
    ]);
  });
});
