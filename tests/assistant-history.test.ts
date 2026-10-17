import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_RETENTION_DAYS } from '@/contracts/assistant';
import {
  deriveConversationTitle,
  formatConversationTime,
  groupConversationsByRecency,
  retentionCutoff,
} from '@/domain/assistant/assistant-history';

// Thời điểm cố định theo lịch ICT: 17/10/2026 10:00. Test không phụ thuộc giờ máy.
const NOW = new Date('2026-10-17T10:00:00+07:00');

describe('deriveConversationTitle', () => {
  it('gộp khoảng trắng và giữ nguyên dấu tiếng Việt', () => {
    assert.equal(deriveConversationTitle('  Việc  của   tôi\n\n  sắp tới hạn  '), 'Việc của tôi sắp tới hạn');
  });

  it('bỏ ký hiệu đầu dòng #, -, *, >, • kể cả khi lẫn nhau', () => {
    assert.equal(deriveConversationTitle('## Nhiệm vụ trễ hạn'), 'Nhiệm vụ trễ hạn');
    assert.equal(deriveConversationTitle('- Văn bản đến'), 'Văn bản đến');
    assert.equal(deriveConversationTitle('> • * Lịch họp tuần này'), 'Lịch họp tuần này');
  });

  it('rỗng hoặc chỉ có khoảng trắng thì dùng tiêu đề mặc định', () => {
    assert.equal(deriveConversationTitle('   \n  '), 'Cuộc trò chuyện mới');
    assert.equal(deriveConversationTitle(''), 'Cuộc trò chuyện mới');
  });

  it('câu đúng 80 ký tự giữ nguyên, không thêm "…"', () => {
    const text = 'a'.repeat(80);
    assert.equal(deriveConversationTitle(text), text);
  });

  it('câu dài cắt ở ranh giới từ, tổng không vượt 80 ký tự và kết thúc bằng "…"', () => {
    const text =
      'Tôi muốn biết các nhiệm vụ đang được giao cho đơn vị của tôi trong tháng này và các văn bản đến đang chờ xử lý';
    const title = deriveConversationTitle(text);
    assert.ok(title.endsWith('…'));
    assert.ok(Array.from(title).length <= 80);
    const body = title.slice(0, -1);
    assert.ok(text.startsWith(body));
    // Ký tự ngay sau phần giữ lại phải là khoảng trắng: không cắt giữa từ
    assert.equal(text.charAt(body.length), ' ');
  });

  it('chuỗi dài không có khoảng trắng bị cắt cứng, vẫn đúng 80 ký tự', () => {
    const title = deriveConversationTitle('a'.repeat(120));
    assert.equal(Array.from(title).length, 80);
    assert.ok(title.endsWith('…'));
  });
});

describe('retentionCutoff', () => {
  const EXPECTED_JUL_19_ICT = '2026-07-18T17:00:00.000Z'; // 00:00 ICT ngày 19/07/2026

  it('mặc định là ASSISTANT_RETENTION_DAYS ngày lịch ICT, mốc là 00:00 ICT', () => {
    assert.equal(ASSISTANT_RETENTION_DAYS, 90);
    assert.equal(retentionCutoff(NOW).toISOString(), EXPECTED_JUL_19_ICT);
  });

  it('không đổi trong cùng một ngày ICT, kể cả sát nửa đêm', () => {
    assert.equal(retentionCutoff(new Date('2026-10-17T00:00:00+07:00')).toISOString(), EXPECTED_JUL_19_ICT);
    assert.equal(retentionCutoff(new Date('2026-10-17T23:59:59+07:00')).toISOString(), EXPECTED_JUL_19_ICT);
  });

  it('sang ngày ICT mới thì mốc tiến một ngày', () => {
    assert.equal(
      retentionCutoff(new Date('2026-10-18T00:00:00+07:00')).toISOString(),
      '2026-07-19T17:00:00.000Z',
    );
  });

  it('tính theo ngày ICT, không theo UTC: 01:00 ICT ngày 17 (là 18:00Z ngày 16) vẫn là ngày 17', () => {
    assert.equal(retentionCutoff(new Date('2026-10-16T18:00:00Z')).toISOString(), EXPECTED_JUL_19_ICT);
  });

  it('nhận số ngày tùy chọn', () => {
    assert.equal(retentionCutoff(NOW, 1).toISOString(), '2026-10-15T17:00:00.000Z');
  });
});

describe('groupConversationsByRecency', () => {
  it('xếp theo Hôm nay, Hôm qua, 7 ngày qua, rồi tháng giảm dần; giữ thứ tự đầu vào và bỏ nhóm rỗng', () => {
    const items = [
      { id: 'h', lastMessageAt: '2026-07-20T10:00:00+07:00' },
      { id: 'a', lastMessageAt: '2026-10-17T08:00:00+07:00' },
      { id: 'g', lastMessageAt: '2026-09-02T08:00:00+07:00' },
      { id: 'c', lastMessageAt: '2026-10-15T12:00:00+07:00' },
      { id: 'f', lastMessageAt: '2026-09-30T20:00:00+07:00' },
      { id: 'b', lastMessageAt: '2026-10-16T23:59:00+07:00' },
      { id: 'e', lastMessageAt: '2026-10-09T09:00:00+07:00' },
      { id: 'd', lastMessageAt: '2026-10-10T09:00:00+07:00' },
      { id: 'i', lastMessageAt: '2026-10-18T00:30:00+07:00' },
    ];
    const groups = groupConversationsByRecency(items, NOW);
    assert.deepEqual(
      groups.map((g) => [g.label, g.items.map((x) => x.id)]),
      [
        ['Hôm nay', ['a', 'i']],
        ['Hôm qua', ['b']],
        ['7 ngày qua', ['c', 'd']],
        ['Tháng 10/2026', ['e']],
        ['Tháng 9/2026', ['g', 'f']],
        ['Tháng 7/2026', ['h']],
      ],
    );
  });

  it('ranh giới nửa đêm ICT: 23:59:59 hôm qua là "Hôm qua", 00:00:00 hôm nay là "Hôm nay"', () => {
    const now = new Date('2026-10-17T00:00:30+07:00');
    const groups = groupConversationsByRecency(
      [
        { id: 'yesterday', lastMessageAt: '2026-10-16T23:59:59+07:00' },
        { id: 'today', lastMessageAt: '2026-10-17T00:00:00+07:00' },
      ],
      now,
    );
    assert.deepEqual(groups.map((g) => [g.label, g.items.map((x) => x.id)]), [
      ['Hôm nay', ['today']],
      ['Hôm qua', ['yesterday']],
    ]);
  });

  it('nhóm theo ngày ICT: 18:00Z ngày 16 (01:00 ngày 17 ICT) là "Hôm nay"', () => {
    const groups = groupConversationsByRecency([{ id: 'x', lastMessageAt: '2026-10-16T18:00:00Z' }], NOW);
    assert.deepEqual(groups.map((g) => g.label), ['Hôm nay']);
  });

  it('danh sách rỗng trả về mảng rỗng', () => {
    assert.deepEqual(groupConversationsByRecency([], NOW), []);
  });
});

describe('formatConversationTime', () => {
  it('trong ngày hiện HH:mm; full ghép giờ và ngày dd/MM/yyyy', () => {
    assert.deepEqual(formatConversationTime('2026-10-17T14:05:00+07:00', NOW), {
      short: '14:05',
      full: '14:05, 17/10/2026',
    });
  });

  it('trong 7 ngày hiện dd/MM, kể cả đúng mốc 7 ngày', () => {
    assert.deepEqual(formatConversationTime('2026-10-14T09:30:00+07:00', NOW), {
      short: '14/10',
      full: '09:30, 14/10/2026',
    });
    assert.equal(formatConversationTime('2026-10-10T09:30:00+07:00', NOW).short, '10/10');
  });

  it('cũ hơn 7 ngày hiện dd/MM/yyyy', () => {
    assert.equal(formatConversationTime('2026-10-09T09:30:00+07:00', NOW).short, '09/10/2026');
    assert.equal(formatConversationTime('2026-09-17T08:00:00+07:00', NOW).short, '17/09/2026');
  });

  it('giờ và ngày lấy theo ICT khi thời điểm lưu ở UTC', () => {
    assert.deepEqual(formatConversationTime('2026-10-16T18:00:00Z', NOW), {
      short: '01:00',
      full: '01:00, 17/10/2026',
    });
  });

  it('thời gian không hợp lệ trả dấu gạch ngang', () => {
    assert.deepEqual(formatConversationTime('khong-hop-le', NOW), { short: '-', full: '-' });
  });
});
