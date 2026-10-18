import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DocumentSecurityLevel, DocumentStatus, DocumentType, MeetingStatus, OutgoingDocumentStatus, TaskActorRole, TaskPriority, TaskScope, TaskStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { loadAuthorizationContext } from '../src/server/authorization/authorization-context-service';
import type { AuthorizationContext } from '../src/server/authorization/authorization-context';
import {
  ASSISTANT_TOOL_DEFINITIONS,
  describeAssistantContext,
  resolveAssistantContextSource,
  runAssistantTool,
  RESTRICTED_MESSAGE,
  ToolFailure,
  type AssistantToolContext,
  type AssistantToolOutcome,
} from '../src/server/assistant/assistant-tools';
import {
  clip,
  fitToolContent,
  GENERIC_READ_ERROR,
  NOT_FOUND_MESSAGE,
  OVERSIZE_MESSAGE,
  redactContact,
} from '../src/server/assistant/assistant-tool-shared';
import { ASSISTANT_TOOL_NAMES } from '../src/contracts/assistant';

const TODAY = '2026-10-17';
const rand = crypto.randomBytes(4).toString('hex');
const RAND = rand.toUpperCase();
const token = `W2D${RAND}`;
// Năm riêng theo lượt chạy: số đăng ký (loại, năm, số) không đụng dữ liệu còn sót của bài test khác trên qcet_test.
const docYear = 2090 + (parseInt(rand, 16) % 10);
const emails = {
  a: `a_${rand}@qcet.edu.vn`,
  b: `b_${rand}@qcet.edu.vn`,
  rector: `rector_${rand}@qcet.edu.vn`,
  admin: `admin_${rand}@qcet.edu.vn`,
};

const created = {
  units: [] as string[],
  users: [] as string[],
  positions: [] as string[],
  tasks: [] as string[],
  documents: [] as string[],
  meetings: [] as string[],
};

let userA: { id: string; name: string };
let userB: { id: string; name: string };
let rectorUser: { id: string; name: string };
let adminUser: { id: string; name: string };
let unitA: { id: string };
let unitB: { id: string };
let taskA: { id: string; code: string };
let taskB: { id: string; code: string };
let subTaskIds: string[] = [];
let docOk: { id: string; number: string };
let docMat: { id: string; number: string };
let docRestricted: { id: string };
let docOtherB: { id: string };
let docRestrictedNote: { id: string; number: string };
let docLinked: { id: string };
let outDocOk: { id: string };
let outDocMat: { id: string };
let meetingA1: string;
let meetingA2: string;
let meetingA3: string;
let meetingB1: string;

let ctxA: AssistantToolContext;
let ctxB: AssistantToolContext;
let ctxRector: AssistantToolContext;
let ctxAdmin: AssistantToolContext;

function contextFor(authz: AuthorizationContext): AssistantToolContext {
  return { authz, userId: authz.userId, today: TODAY };
}

/** Mọi nội dung gửi cho model đều được kiểm: không có email, ghi chú hay đường dẫn tệp. */
/** Số điện thoại của người hỏi A, gán trong before(); không được xuất hiện trong bất kỳ kết quả nào. */
const PHONE_A = '0912345678';

function assertNoPrivateFields(outcome: AssistantToolOutcome): void {
  for (const email of Object.values(emails)) {
    assert.ok(!outcome.content.includes(email), `Nội dung chứa email: ${outcome.content.slice(0, 120)}`);
  }
  assert.ok(!outcome.content.includes(PHONE_A), 'Nội dung chứa số điện thoại');
  assert.ok(!/"notes"/.test(outcome.content), 'Nội dung chứa khóa notes');
  assert.ok(!/fileUrl/.test(outcome.content), 'Nội dung chứa fileUrl');
  assert.ok(!/"minutes"|"agenda"|"positionAssignments"/.test(outcome.content), 'Nội dung chứa trường nội bộ của họp');
  assert.ok(outcome.content.length <= 6000, `Nội dung vượt trần: ${outcome.content.length}`);
}

function parsed(outcome: AssistantToolOutcome): Record<string, unknown> {
  return JSON.parse(outcome.content) as Record<string, unknown>;
}

describe('Trợ lý: định nghĩa tool và tham số', () => {
  it('đủ tool theo ASSISTANT_TOOL_NAMES, tham số đóng và không kèm $schema', () => {
    assert.deepEqual(
      ASSISTANT_TOOL_DEFINITIONS.map((definition) => definition.function.name).sort(),
      [...ASSISTANT_TOOL_NAMES].sort()
    );
    for (const definition of ASSISTANT_TOOL_DEFINITIONS) {
      assert.equal(definition.type, 'function');
      assert.equal(definition.function.parameters.additionalProperties, false, definition.function.name);
      assert.equal('$schema' in definition.function.parameters, false, definition.function.name);
      assert.ok(definition.function.description.length > 20, definition.function.name);
    }
  });

  it('tool lạ trả lỗi "Không có công cụ" và không ném lỗi', async () => {
    const outcome = await runAssistantTool('xoa_nhiem_vu', '{}', ctxA);
    assert.equal(outcome.ok, false);
    assert.deepEqual(JSON.parse(outcome.content), { error: 'Không có công cụ xoa_nhiem_vu.' });
    assert.equal(outcome.step.tool, 'unknown');
    assert.equal(outcome.step.count, null);
    assert.equal(outcome.detailed, false);
  });

  it('JSON hỏng bị từ chối', async () => {
    const outcome = await runAssistantTool('get_task', '{"id": ', ctxA);
    assert.equal(outcome.ok, false);
    assert.deepEqual(JSON.parse(outcome.content), { error: 'Tham số không hợp lệ: không phải JSON.' });
    assert.equal(outcome.step.count, null);
  });

  it('tham số lạ (userId) bị từ chối, không chạy truy vấn', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ userId: userB.id }), ctxA);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.content, '{"error":"Tham số không hợp lệ: không được có tham số \\"userId\\"."}');
    assert.equal(outcome.sources.length, 0);
  });

  it('giá trị enum sai bị từ chối (status ngoài danh sách đóng)', async () => {
    const outcome = await runAssistantTool('list_tasks', '{"status":"dang_lam"}', ctxA);
    assert.equal(outcome.ok, false);
    assert.match(parsed(outcome).error as string, /^Tham số không hợp lệ: "status" không hợp lệ/);
  });

  it('get_task phải có đúng một trong id hoặc code', async () => {
    const none = await runAssistantTool('get_task', '{}', ctxA);
    const both = await runAssistantTool('get_task', JSON.stringify({ id: taskA.id, code: taskA.code }), ctxA);
    assert.equal(none.ok, false);
    assert.equal(both.ok, false);
    assert.match(parsed(none).error as string, /Cần đúng một trong id hoặc code/);
  });

  it('list_meetings từ chối khoảng quá 31 ngày, đảo ngược và ngày không có thật', async () => {
    const tooLong = await runAssistantTool('list_meetings', '{"from":"2026-10-01","to":"2026-11-15"}', ctxA);
    const reversed = await runAssistantTool('list_meetings', '{"from":"2026-10-26","to":"2026-10-20"}', ctxA);
    const invalid = await runAssistantTool('list_meetings', '{"from":"2026-02-30","to":"2026-02-30"}', ctxA);
    assert.equal(tooLong.ok, false);
    assert.equal(reversed.ok, false);
    assert.equal(invalid.ok, false);
  });

  it('thiếu ngữ cảnh phân quyền thì từ chối đóng (không lộ dữ liệu), không ném lỗi', async () => {
    const noAuthz = { authz: undefined, userId: userA.id, today: TODAY } as unknown as AssistantToolContext;
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: taskA.id }), noAuthz);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.content, JSON.stringify({ error: NOT_FOUND_MESSAGE }));
  });

  it('lỗi ngoài dự kiến chỉ trả câu lỗi đọc chung, không lộ chi tiết lỗi', async () => {
    const throwing = new Proxy({}, { get: () => { throw new Error('lỗi nội bộ thử nghiệm'); } }) as AuthorizationContext;
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: taskA.id }), { authz: throwing, userId: userA.id, today: TODAY });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.content, JSON.stringify({ error: GENERIC_READ_ERROR }));
    assert.ok(!outcome.content.includes('thử nghiệm'));
  });
});

describe('Trợ lý: nhiệm vụ theo phạm vi người hỏi', () => {
  it('người tham gia đọc được nhiệm vụ của mình, có nguồn và cờ chi tiết', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: taskA.id }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.detailed, true);
    assert.equal(outcome.step.count, 1);
    const body = parsed(outcome);
    assert.equal(body.code, taskA.code);
    assert.ok(
      (body.participants as Array<{ name: string; roleLabel: string; isPrimaryDRI: boolean }>).some(
        (person) => person.name === userA.name && person.roleLabel === 'Chủ trì' && person.isPrimaryDRI
      )
    );
    assert.equal(outcome.sources[0].href, `/tasks/${taskA.id}`);
    assertNoPrivateFields(outcome);
  });

  it('nhiệm vụ không liên quan trả đúng câu "không tìm thấy", giống hệt id không tồn tại', async () => {
    const hidden = await runAssistantTool('get_task', JSON.stringify({ id: taskB.id }), ctxA);
    const missing = await runAssistantTool('get_task', JSON.stringify({ id: crypto.randomUUID() }), ctxA);
    assert.equal(hidden.ok, false);
    assert.equal(hidden.content, JSON.stringify({ error: NOT_FOUND_MESSAGE }));
    assert.equal(hidden.content, missing.content);
    assert.equal(hidden.step.ok, false);
  });

  it('người không liên quan tra theo mã cũng nhận cùng câu trả lời', async () => {
    const hidden = await runAssistantTool('get_task', JSON.stringify({ code: taskA.code }), ctxB);
    const missing = await runAssistantTool('get_task', JSON.stringify({ code: `NV-KHONG-CO-${rand}` }), ctxB);
    assert.equal(hidden.content, JSON.stringify({ error: NOT_FOUND_MESSAGE }));
    assert.equal(hidden.content, missing.content);
  });

  it('tra theo mã không phân biệt hoa thường', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ code: `  ${taskA.code.toLowerCase()} ` }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal(parsed(outcome).id, taskA.id);
  });

  it('list_tasks chỉ liệt kê việc người hỏi đọc được', async () => {
    const outcome = await runAssistantTool('list_tasks', '{}', ctxA);
    assert.equal(outcome.ok, true);
    const ids = (parsed(outcome).tasks as Array<{ id: string }>).map((task) => task.id);
    assert.ok(ids.includes(taskA.id));
    assert.ok(!ids.includes(taskB.id));
    assertNoPrivateFields(outcome);
  });

  it('list_tasks với view all vẫn không lộ việc không liên quan', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ view: 'all' }), ctxA);
    const ids = (parsed(outcome).tasks as Array<{ id: string }>).map((task) => task.id);
    assert.ok(ids.includes(taskA.id));
    assert.ok(!ids.includes(taskB.id));
  });

  it('list_tasks status overdue dùng mốc ngày của lượt hỏi (việc hạn 10/10 đang trễ)', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ status: 'overdue' }), ctxA);
    const tasks = parsed(outcome).tasks as Array<{ id: string; isOverdue: boolean }>;
    const mine = tasks.find((task) => task.id === taskA.id);
    assert.ok(mine, 'việc trễ hạn phải có trong danh sách');
    assert.equal(mine.isOverdue, true);
  });

  it('nhiệm vụ có nhiều việc con: nội dung không vượt trần, cắt phần tử cuối và đánh dấu truncated', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: taskA.id }), ctxA);
    const body = parsed(outcome);
    assert.equal(body.truncated, true);
    assert.ok((body.subTasks as unknown[]).length < subTaskIds.length);
    assertNoPrivateFields(outcome);
  });

  it('search theo từ khóa chỉ thấy nhiệm vụ đọc được', async () => {
    const asA = await runAssistantTool('search', JSON.stringify({ query: token, types: ['task'] }), ctxA);
    const asB = await runAssistantTool('search', JSON.stringify({ query: token, types: ['task'] }), ctxB);
    const idsA = (parsed(asA).tasks as Array<{ id: string }>).map((task) => task.id);
    const idsB = (parsed(asB).tasks as Array<{ id: string }>).map((task) => task.id);
    assert.ok(idsA.includes(taskA.id));
    assert.ok(!idsB.includes(taskA.id));
    assert.ok(!idsA.includes(taskB.id));
    assertNoPrivateFields(asA);
  });

  it('hộp việc chứa việc Thầy/Cô là chủ trì và không chứa việc của người khác', async () => {
    const asA = await runAssistantTool('my_inbox', '{}', ctxA);
    const asB = await runAssistantTool('my_inbox', '{}', ctxB);
    assert.equal(asA.ok, true);
    assert.ok(asA.content.includes(taskA.code));
    assert.ok(!asB.content.includes(taskA.code));
    assertNoPrivateFields(asA);
  });

  it('nguồn ngữ cảnh: người có quyền nhận nguồn và mô tả, người khác nhận null', async () => {
    const source = await resolveAssistantContextSource(ctxA.authz, { type: 'task', id: taskA.id });
    const denied = await resolveAssistantContextSource(ctxB.authz, { type: 'task', id: taskA.id });
    assert.equal(source?.code, taskA.code);
    assert.equal(denied, null);

    const described = await describeAssistantContext(ctxA, { type: 'task', id: taskA.id });
    assert.ok(described);
    assert.ok(described.summary.includes(taskA.code));
    assert.ok(described.summary.length <= 2000);
    assert.equal(await describeAssistantContext(ctxB, { type: 'task', id: taskA.id }), null);
  });
});

describe('Trợ lý: văn bản loại trừ mật và hạn chế', () => {
  it('danh sách không có văn bản mật, không có văn bản hạn chế và đếm số bị loại', async () => {
    const outcome = await runAssistantTool('list_documents', '{}', ctxA);
    assert.equal(outcome.ok, true);
    const numbers = (parsed(outcome).documents as Array<{ number: string }>).map((doc) => doc.number);
    assert.ok(numbers.includes(docOk.number));
    assert.ok(!numbers.includes(docMat.number));
    assert.ok(!outcome.content.includes('Văn bản hạn chế'));
    assert.ok(!outcome.content.includes('Tài liệu mật'));
    assert.ok((parsed(outcome).excludedRestricted as number) >= 2);
    assertNoPrivateFields(outcome);
  });

  it('tìm kiếm văn bản không lộ văn bản mật hoặc hạn chế', async () => {
    const outcome = await runAssistantTool('search', JSON.stringify({ query: token, types: ['document'] }), ctxA);
    const numbers = (parsed(outcome).documents as Array<{ number: string }>).map((doc) => doc.number);
    assert.ok(numbers.includes(docOk.number));
    assert.ok(!outcome.content.includes('Văn bản hạn chế'));
    assert.ok(!outcome.content.includes('Tài liệu mật'));
    assertNoPrivateFields(outcome);
  });

  it('get_document văn bản thường đọc được, không có ghi chú hay tệp', async () => {
    const outcome = await runAssistantTool('get_document', JSON.stringify({ id: docOk.id }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.detailed, true);
    assert.equal(parsed(outcome).number, docOk.number);
    assert.equal(outcome.sources[0].href, `/documents?docId=${encodeURIComponent(docOk.id)}`);
    assertNoPrivateFields(outcome);
  });

  it('văn bản hạn chế mà người hỏi có quan hệ trực tiếp vẫn bị loại ở get_document', async () => {
    const outcome = await runAssistantTool('get_document', JSON.stringify({ id: docRestricted.id }), ctxA);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.content, JSON.stringify({ error: RESTRICTED_MESSAGE }));
    assert.equal(outcome.detailed, false);
  });

  it('văn bản mật bị trả câu không tìm thấy, người không liên quan cũng vậy', async () => {
    const asA = await runAssistantTool('get_document', JSON.stringify({ id: docMat.id }), ctxA);
    const asB = await runAssistantTool('get_document', JSON.stringify({ id: docMat.id }), ctxB);
    const missing = await runAssistantTool('get_document', JSON.stringify({ id: crypto.randomUUID() }), ctxB);
    assert.equal(asA.content, JSON.stringify({ error: NOT_FOUND_MESSAGE }));
    assert.equal(asB.content, JSON.stringify({ error: NOT_FOUND_MESSAGE }));
    assert.equal(asB.content, missing.content);
  });

  it('người không liên quan không đọc được văn bản thường của người khác', async () => {
    const outcome = await runAssistantTool('get_document', JSON.stringify({ id: docOk.id }), ctxB);
    assert.equal(outcome.content, JSON.stringify({ error: NOT_FOUND_MESSAGE }));
  });

  it('Hiệu trưởng vẫn không thấy văn bản mật hay hạn chế trong danh sách', async () => {
    const outcome = await runAssistantTool('list_documents', JSON.stringify({ query: token }), ctxRector);
    const numbers = (parsed(outcome).documents as Array<{ number: string }>).map((doc) => doc.number);
    assert.ok(numbers.includes(docOk.number));
    assert.ok(!numbers.includes(docMat.number));
    assert.ok(!outcome.content.includes('Văn bản hạn chế'));
    assert.ok(!outcome.content.includes('Tài liệu mật'));
    assertNoPrivateFields(outcome);
  });

  it('quản trị hệ thống không có chức danh không nhận văn bản nghiệp vụ', async () => {
    const outcome = await runAssistantTool('list_documents', '{}', ctxAdmin);
    assert.equal(outcome.ok, true);
    assert.equal(parsed(outcome).total, 0);
    assert.deepEqual(parsed(outcome).documents, []);
  });

  it('nguồn ngữ cảnh văn bản: thường có nguồn, hạn chế hoặc không liên quan thì null', async () => {
    const source = await resolveAssistantContextSource(ctxA.authz, { type: 'document', id: docOk.id });
    const restricted = await resolveAssistantContextSource(ctxA.authz, { type: 'document', id: docRestricted.id });
    const outsider = await resolveAssistantContextSource(ctxB.authz, { type: 'document', id: docOk.id });
    const owner = await resolveAssistantContextSource(ctxB.authz, { type: 'document', id: docOtherB.id });
    assert.equal(source?.code, docOk.number);
    assert.equal(restricted, null);
    assert.equal(outsider, null);
    assert.equal(owner?.id, docOtherB.id);
  });
});

describe('Trợ lý: lịch họp theo phạm vi người hỏi', () => {
  it('người hỏi chỉ thấy họp mình tổ chức hoặc tham gia; mốc cuối ngày không lấy họp nửa đêm ngày kế', async () => {
    const outcome = await runAssistantTool('list_meetings', JSON.stringify({ from: '2026-10-20', to: '2026-10-20' }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal(parsed(outcome).total, 2);
    const titles = (parsed(outcome).meetings as Array<{ title: string }>).map((meeting) => meeting.title);
    assert.ok(titles.every((title) => title.includes(token)));
    assertNoPrivateFields(outcome);
  });

  it('họp đúng 00:00 ngày kế được tính cho ngày đó', async () => {
    const outcome = await runAssistantTool('list_meetings', JSON.stringify({ from: '2026-10-21', to: '2026-10-21' }), ctxA);
    assert.equal(parsed(outcome).total, 1);
  });

  it('cuộc họp của người khác không xuất hiện với người không liên quan', async () => {
    const outcome = await runAssistantTool('list_meetings', JSON.stringify({ from: '2026-10-20', to: '2026-10-20' }), ctxB);
    const meetings = parsed(outcome).meetings as Array<{ id: string }>;
    assert.equal(parsed(outcome).total, 1);
    assert.ok(meetings.every((meeting) => meeting.id === meetingB1));
  });

  it('hơn 20 cuộc trong ngày: chỉ hiện 20 cuộc sớm nhất, sắp tăng dần theo giờ bắt đầu, có total và truncated', async () => {
    const day = '2026-10-25';
    const firstStart = Date.parse(`${day}T07:00:00+07:00`);
    // Tạo theo thứ tự tăng dần; dịch vụ trả giảm dần nên thứ tự này chưa đủ để chứng minh việc sắp xếp
    for (let index = 0; index < 22; index += 1) {
      const meeting = await prisma.meeting.create({
        data: {
          title: `Họp ${token} sáng ${String(index).padStart(2, '0')}`,
          organizerId: userA.id,
          startTime: new Date(firstStart + index * 15 * 60_000),
          status: MeetingStatus.DRAFT_AGENDA,
        },
      });
      created.meetings.push(meeting.id);
    }
    const outcome = await runAssistantTool('list_meetings', JSON.stringify({ from: day, to: day }), ctxA);
    assert.equal(outcome.ok, true);
    const body = parsed(outcome);
    assert.equal(body.total, 22);
    assert.equal(body.truncated, true);
    const meetings = body.meetings as Array<{ title: string; start: string }>;
    assert.deepEqual(
      meetings.map((meeting) => meeting.title),
      Array.from({ length: 20 }, (_, index) => `Họp ${token} sáng ${String(index).padStart(2, '0')}`)
    );
    const starts = meetings.map((meeting) => meeting.start);
    assert.deepEqual(starts, [...starts].sort());
    assert.equal(starts[0], '2026-10-25 07:00');
    assertNoPrivateFields(outcome);
  });

  it('hơn 100 cuộc trong khoảng: vẫn hiện 20 cuộc sớm nhất của cả khoảng, không phải 20 trong 100 cuộc muộn nhất', async () => {
    const day = '2026-10-28';
    const firstStart = Date.parse(`${day}T06:00:00+07:00`);
    const titles = Array.from({ length: 105 }, (_, index) => `Họp ${token} lớn ${String(index).padStart(3, '0')}`);
    await prisma.meeting.createMany({
      data: titles.map((title, index) => ({
        title,
        organizerId: userA.id,
        startTime: new Date(firstStart + index * 10 * 60_000),
        status: MeetingStatus.DRAFT_AGENDA,
      })),
    });
    try {
      const outcome = await runAssistantTool('list_meetings', JSON.stringify({ from: day, to: day }), ctxA);
      assert.equal(outcome.ok, true);
      const body = parsed(outcome);
      assert.equal(body.total, 105);
      assert.equal(body.truncated, true);
      const meetings = body.meetings as Array<{ title: string; start: string }>;
      assert.deepEqual(
        meetings.map((meeting) => meeting.title),
        titles.slice(0, 20)
      );
      assert.equal(meetings[0].start, '2026-10-28 06:00');
      assertNoPrivateFields(outcome);
    } finally {
      await prisma.meeting.deleteMany({ where: { organizerId: userA.id, title: { startsWith: `Họp ${token} lớn ` } } });
    }
  });
});

describe('Trợ lý: lỗ hổng đã chặn sau rà soát', () => {
  it('ghi chú hạn chế viết lẫn trong câu bị loại ở cả danh sách lẫn chi tiết', async () => {
    const list = await runAssistantTool('list_documents', JSON.stringify({ query: docRestrictedNote.number }), ctxA);
    const numbers = (parsed(list).documents as Array<{ number: string }>).map((doc) => doc.number);
    assert.ok(!numbers.includes(docRestrictedNote.number));
    const detail = await runAssistantTool('get_document', JSON.stringify({ id: docRestrictedNote.id }), ctxA);
    assert.equal(detail.ok, false);
    assert.equal(detail.content, JSON.stringify({ error: RESTRICTED_MESSAGE }));
  });

  it('excludedRestricted không dò được văn bản mật, và người không liên quan không thấy con số nào', async () => {
    const hieuTruongByNumber = await runAssistantTool('list_documents', JSON.stringify({ query: docMat.number }), ctxRector);
    const ownerByNumber = await runAssistantTool('list_documents', JSON.stringify({ query: docMat.number }), ctxA);
    const strangerByToken = await runAssistantTool('list_documents', JSON.stringify({ query: token }), ctxB);
    assert.equal(parsed(hieuTruongByNumber).excludedRestricted, 0);
    assert.equal(parsed(ownerByNumber).excludedRestricted, 0);
    assert.equal(parsed(strangerByToken).excludedRestricted, 0);
  });

  it('văn bản gắn nhiệm vụ không đọc được: chi tiết không lộ nhiệm vụ và không có nguồn nhiệm vụ', async () => {
    const outcome = await runAssistantTool('get_document', JSON.stringify({ id: docLinked.id }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal(parsed(outcome).linkedTask, null);
    assert.ok(!outcome.sources.some((source) => source.id === taskB.id));
    assertNoPrivateFields(outcome);
  });

  it('hộp việc đưa văn bản đi thường đang chờ duyệt nội dung, không đưa văn bản đi mật', async () => {
    const outcome = await runAssistantTool('my_inbox', '{}', ctxA);
    assert.equal(outcome.ok, true);
    assert.ok(outcome.sources.some((source) => source.id === outDocOk.id));
    assert.ok(!outcome.sources.some((source) => source.id === outDocMat.id));
    assert.ok(!outcome.content.includes('mật W2D'));
    assertNoPrivateFields(outcome);
  });
});

describe('Trợ lý: che liên hệ và kích thước kết quả', () => {
  it('clip che email và số điện thoại trong chữ tự do, giữ nguyên mã nhiệm vụ và số văn bản', () => {
    assert.equal(
      clip('Liên hệ hoc.vien@qcet.edu.vn hoặc 0912 345 678, số khác +84 912345678.', 200),
      'Liên hệ [email] hoặc [số điện thoại], số khác [số điện thoại].'
    );
    assert.equal(clip('NV-2026-09-001 số 2026/CV-12', 100), 'NV-2026-09-001 số 2026/CV-12');
  });

  it('redactContact không quay lui bậc hai: 200.000 ký tự liền nhau chạy dưới 200ms', () => {
    const started = performance.now();
    const out = redactContact('a'.repeat(200_000));
    assert.ok(performance.now() - started < 200, 'quá chậm');
    assert.equal(out, 'a'.repeat(200_000));
  });

  it('email ghép sát ký tự lớp local-part vẫn được che hết, không lộ phần sau', () => {
    assert.equal(redactContact('a@b.cc_nguyen@x.vn'), '[email][email]');
    assert.equal(redactContact('a@b.cc+d@e.ff'), '[email][email]');
  });

  it('mã nhiệm vụ và số văn bản thường không bị che (link nguồn khớp theo mã)', () => {
    const text = 'NV-2026-09-001, 123/QĐ-CĐQC, 45/2026/TB-UBND';
    assert.equal(redactContact(text), text);
  });

  it('ngày giờ dạng 01.02.2026 08:00 không bị coi là số điện thoại; số di động và cố định đều được che', () => {
    for (const text of ['Hạn 01.02.2026 08:00', 'Họp 05-11-2026 14:00 phòng B', 'Năm 2026 có 0 việc']) {
      assert.equal(redactContact(text), text);
    }
    assert.equal(redactContact('Gọi 0912 345 678 nhé'), 'Gọi [số điện thoại] nhé');
    assert.equal(redactContact('Bàn 0243.123.4567'), 'Bàn [số điện thoại]');
    assert.equal(redactContact('+84 24 3123 4567'), '[số điện thoại]');
  });

  it('fitToolContent báo không vừa khi cắt hết mảng vẫn quá trần, và outcome lúc đó là lỗi', () => {
    const fitted = fitToolContent({ tasks: [], note: 'x'.repeat(7000) }, ['tasks']);
    assert.equal(fitted.fits, false);
    assert.equal(fitted.content, JSON.stringify({ error: OVERSIZE_MESSAGE }));
    const fitsCleanly = fitToolContent({ tasks: [{ id: 'a' }, { id: 'b' }] }, ['tasks']);
    assert.equal(fitsCleanly.fits, true);
  });
});

describe('Trợ lý: liên hệ trong chữ tự do được che trong nội dung và nguồn', () => {
  const contactToken = `W2DLH${RAND}`;
  const parentCode = `NV-W2D-${RAND}-LH`;
  const childCode = `NV-W2D-${RAND}-LHC`;
  const common = {
    scope: TaskScope.DEPARTMENT,
    priority: TaskPriority.NORMAL,
    academicMonth: 10,
    academicYear: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00+07:00'),
    dueDate: new Date('2026-12-01T00:00:00+07:00'),
    status: TaskStatus.IN_PROGRESS,
  };
  let parentId = '';
  let childId = '';
  let docId = '';
  let meetingId = '';
  const docNumber = `LH-${RAND}-${PHONE_A}`;
  const redactedNumber = `LH-${RAND}-[số điện thoại]`;
  const parentTitle = `Liên hệ ${PHONE_A} hoặc ${emails.a} ${contactToken}`;

  before(async () => {
    const parent = await prisma.task.create({
      data: {
        ...common,
        code: parentCode,
        title: parentTitle,
        createdById: userA.id,
        leadUnitId: unitA.id,
        actors: { create: [{ userId: userA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
      },
    });
    parentId = parent.id;
    const child = await prisma.task.create({
      data: {
        ...common,
        code: childCode,
        title: `Việc con gọi ${PHONE_A} ${contactToken}`,
        createdById: userA.id,
        leadUnitId: unitA.id,
        parentTaskId: parent.id,
        actors: { create: [{ userId: userA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
      },
    });
    childId = child.id;
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: (parseInt(rand, 16) % 1_000_000) + 1020,
        documentYear: docYear,
        originalNumber: docNumber,
        issuedDate: new Date('2026-10-01T00:00:00+07:00'),
        issuingAuthority: `Sở GDĐT, ĐT ${PHONE_A}`,
        category: 'Công văn',
        summary: `Công văn liên hệ ${contactToken}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: userA.id,
        leadUserId: userA.id,
        status: DocumentStatus.CHO_PHAN_CONG,
        linkedTaskId: parent.id,
        attachments: {
          create: [{ fileName: `Hồ sơ ${PHONE_A}.pdf`, fileUrl: `/uploads/${rand}.pdf`, fileSize: 1, mimeType: 'application/pdf' }],
        },
      },
    });
    docId = doc.id;
    const meeting = await prisma.meeting.create({
      data: {
        title: `Họp ${contactToken}`,
        organizerId: userA.id,
        startTime: new Date('2026-12-15T09:00:00+07:00'),
        status: MeetingStatus.DRAFT_AGENDA,
        location: `Phòng 201, ĐT ${PHONE_A}`,
      },
    });
    meetingId = meeting.id;
  });

  after(async () => {
    await prisma.meeting.deleteMany({ where: { id: meetingId } });
    await prisma.document.deleteMany({ where: { id: docId } });
    await prisma.taskActor.deleteMany({ where: { taskId: { in: [childId, parentId] } } });
    await prisma.task.deleteMany({ where: { id: childId } });
    await prisma.task.deleteMany({ where: { id: parentId } });
  });

  it('get_task: tiêu đề, việc con và nguồn của nhiệm vụ không lộ email hay số điện thoại; mã giữ nguyên', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: parentId }), ctxA);
    assert.equal(outcome.ok, true);
    assertNoPrivateFields(outcome);
    const body = parsed(outcome);
    assert.equal(body.title, `Liên hệ [số điện thoại] hoặc [email] ${contactToken}`);
    assert.equal(body.code, parentCode);
    assert.deepEqual((body.subTasks as Array<{ title: string }>).map((sub) => sub.title), [`Việc con gọi [số điện thoại] ${contactToken}`]);
    assert.equal(outcome.sources[0].title, body.title);
    assert.equal(outcome.sources[0].code, parentCode);
    assert.ok(outcome.sources.every((source) => !source.title.includes(PHONE_A) && !source.title.includes(emails.a)));
  });

  it('get_task việc con: việc cha đọc được có tiêu đề đã che trong nội dung và nguồn', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: childId }), ctxA);
    assert.equal(outcome.ok, true);
    assertNoPrivateFields(outcome);
    const body = parsed(outcome);
    assert.equal((body.parentTask as { title: string }).title, `Liên hệ [số điện thoại] hoặc [email] ${contactToken}`);
    assert.equal(body.title, `Việc con gọi [số điện thoại] ${contactToken}`);
    assert.ok(outcome.sources.some((source) => source.id === parentId && source.code === parentCode && !source.title.includes(PHONE_A)));
  });

  it('search nhiệm vụ: kết quả và nguồn có tiêu đề đã che', async () => {
    const outcome = await runAssistantTool('search', JSON.stringify({ query: contactToken, types: ['task'] }), ctxA);
    assert.equal(outcome.ok, true);
    assertNoPrivateFields(outcome);
    const tasks = parsed(outcome).tasks as Array<{ id: string; title: string }>;
    assert.equal(tasks.find((task) => task.id === parentId)?.title, `Liên hệ [số điện thoại] hoặc [email] ${contactToken}`);
    assert.ok(outcome.sources.some((source) => source.id === parentId && source.code === parentCode));
  });

  it('get_document: số và cơ quan ban hành có số điện thoại được che; nhiệm vụ liên kết cũng vậy', async () => {
    const outcome = await runAssistantTool('get_document', JSON.stringify({ id: docId }), ctxA);
    assert.equal(outcome.ok, true);
    assertNoPrivateFields(outcome);
    const body = parsed(outcome);
    assert.equal(body.number, redactedNumber);
    assert.equal(body.issuingAuthority, 'Sở GDĐT, ĐT [số điện thoại]');
    assert.deepEqual(body.attachments, ['Hồ sơ [số điện thoại].pdf']);
    assert.equal((body.linkedTask as { title: string }).title, `Liên hệ [số điện thoại] hoặc [email] ${contactToken}`);
    assert.equal(outcome.sources[0].code, redactedNumber);
    assert.ok(outcome.sources.some((source) => source.id === parentId && !source.title.includes(PHONE_A)));
  });

  it('list_documents: số và cơ quan ban hành đã che; số văn bản thường (văn bản có sẵn) giữ nguyên trong nội dung và nguồn', async () => {
    const outcome = await runAssistantTool('list_documents', JSON.stringify({ query: contactToken }), ctxA);
    assert.equal(outcome.ok, true);
    assertNoPrivateFields(outcome);
    const items = parsed(outcome).documents as Array<{ id: string; number: string; issuingAuthority: string }>;
    const item = items.find((doc) => doc.id === docId);
    assert.equal(item?.number, redactedNumber);
    assert.equal(item?.issuingAuthority, 'Sở GDĐT, ĐT [số điện thoại]');
    assert.equal(outcome.sources.find((source) => source.id === docId)?.code, redactedNumber);

    const plain = await runAssistantTool('list_documents', JSON.stringify({ query: token }), ctxA);
    const plainItem = (parsed(plain).documents as Array<{ id: string; number: string }>).find((doc) => doc.id === docOk.id);
    assert.equal(plainItem?.number, docOk.number);
    assert.equal(plain.sources.find((source) => source.id === docOk.id)?.code, docOk.number);
  });

  it('list_meetings: địa điểm có số điện thoại được che', async () => {
    const outcome = await runAssistantTool(
      'list_meetings',
      JSON.stringify({ from: '2026-12-15', to: '2026-12-15', query: contactToken }),
      ctxA
    );
    assert.equal(outcome.ok, true);
    assertNoPrivateFields(outcome);
    const meetings = parsed(outcome).meetings as Array<{ id: string; location: string }>;
    assert.equal(meetings.find((meeting) => meeting.id === meetingId)?.location, 'Phòng 201, ĐT [số điện thoại]');
  });
});

describe('Trợ lý: ngữ cảnh văn bản bị loại vì hạn chế', () => {
  it('người đọc được văn bản hạn chế nhận lỗi riêng, không phải "không tìm thấy"', async () => {
    for (const doc of [docRestrictedNote, docRestricted]) {
      await assert.rejects(
        describeAssistantContext(ctxA, { type: 'document', id: doc.id }),
        (error: unknown) => error instanceof ToolFailure && error.userMessage === RESTRICTED_MESSAGE
      );
      assert.equal(await resolveAssistantContextSource(ctxA.authz, { type: 'document', id: doc.id }), null);
    }
  });

  it('người không đọc được văn bản mật hoặc thường của người khác vẫn nhận null, không lộ tồn tại', async () => {
    assert.equal(await describeAssistantContext(ctxA, { type: 'document', id: docMat.id }), null);
    assert.equal(await describeAssistantContext(ctxB, { type: 'document', id: docOk.id }), null);
  });
});

describe('Trợ lý: giới hạn kích thước', () => {
  it('danh sách có thể bị cắt nhưng luôn đúng trần và mang cờ truncated khi còn nữa', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ limit: 1 }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal(parsed(outcome).truncated, true);
    assert.equal((parsed(outcome).tasks as unknown[]).length, 1);
  });
});

describe('Trợ lý: việc cha chỉ hiện khi người hỏi đọc được', () => {
  let parentTask: { id: string; code: string };
  let childTask: { id: string };

  before(async () => {
    // Việc cha thuộc đơn vị A; việc con do B làm chủ trì nên B đọc được con nhưng không đọc được cha
    parentTask = await prisma.task.create({
      data: {
        code: `NV-W2D-${RAND}-PARENT`,
        title: `Việc cha ${token}`,
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        academicMonth: 10,
        academicYear: '2026-2027',
        startDate: new Date('2026-09-01T00:00:00+07:00'),
        status: TaskStatus.IN_PROGRESS,
        dueDate: new Date('2026-12-01T00:00:00+07:00'),
        createdById: userA.id,
        leadUnitId: unitA.id,
        actors: { create: [{ userId: userA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
      },
      select: { id: true, code: true },
    });
    childTask = await prisma.task.create({
      data: {
        code: `NV-W2D-${RAND}-CHILD`,
        title: `Việc con của việc cha ${token}`,
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        academicMonth: 10,
        academicYear: '2026-2027',
        startDate: new Date('2026-09-01T00:00:00+07:00'),
        status: TaskStatus.IN_PROGRESS,
        dueDate: new Date('2026-12-01T00:00:00+07:00'),
        createdById: userB.id,
        leadUnitId: unitB.id,
        parentTaskId: parentTask.id,
        actors: { create: [{ userId: userB.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
      },
      select: { id: true },
    });
  });

  after(async () => {
    await prisma.taskActor.deleteMany({ where: { taskId: { in: [childTask.id, parentTask.id] } } });
    await prisma.task.deleteMany({ where: { id: childTask.id } });
    await prisma.task.deleteMany({ where: { id: parentTask.id } });
  });

  it('không đọc được việc cha: việc con vẫn đọc được, nhưng bỏ trường parentTask và không có nguồn hay mã của việc cha', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: childTask.id }), ctxB);
    assert.equal(outcome.ok, true);
    assert.equal('parentTask' in parsed(outcome), false);
    assert.ok(outcome.sources.every((source) => source.id !== parentTask.id));
    assert.ok(!outcome.content.includes(parentTask.code));
    assert.ok(!outcome.content.includes(`Việc cha ${token}`));
    assertNoPrivateFields(outcome);
  });

  it('đọc được việc cha: parentTask có mã và tên, kèm nguồn của việc cha', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: subTaskIds[0] }), ctxA);
    assert.equal(outcome.ok, true);
    assert.deepEqual(parsed(outcome).parentTask, { code: taskA.code, title: `Báo cáo ${token} của A` });
    assert.ok(outcome.sources.some((source) => source.id === taskA.id && source.href === `/tasks/${taskA.id}`));
  });

  it('việc không có việc cha: parentTask là null như trước', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: taskA.id }), ctxA);
    assert.equal(outcome.ok, true);
    assert.equal('parentTask' in parsed(outcome), true);
    assert.equal(parsed(outcome).parentTask, null);
  });
});

before(async () => {
  const unitIdA = `W2D_UA_${rand}`;
  const unitIdB = `W2D_UB_${rand}`;
  const unitIdBgh = `W2D_BGH_${rand}`;
  unitA = await prisma.organizationalUnit.create({
    data: { id: unitIdA, code: unitIdA, name: 'Phòng W2D A', type: 'DEPARTMENT' as any, status: 'ACTIVE' as any },
  });
  unitB = await prisma.organizationalUnit.create({
    data: { id: unitIdB, code: unitIdB, name: 'Phòng W2D B', type: 'DEPARTMENT' as any, status: 'ACTIVE' as any },
  });
  const bgh = await prisma.organizationalUnit.create({
    data: { id: unitIdBgh, code: unitIdBgh, name: 'Ban Giám hiệu W2D', type: 'SCHOOL' as any, status: 'ACTIVE' as any },
  });
  created.units.push(unitA.id, unitB.id, bgh.id);

  userA = await prisma.user.create({
    data: { email: emails.a, name: `Chuyên viên A ${rand}`, role: 'CHUYEN_VIEN', isActive: true },
  });
  userB = await prisma.user.create({
    data: { email: emails.b, name: `Chuyên viên B ${rand}`, role: 'CHUYEN_VIEN', isActive: true },
  });
  rectorUser = await prisma.user.create({
    data: { email: emails.rector, name: `Hiệu trưởng W2D ${rand}`, role: 'BAN_GIAM_HIEU', isActive: true },
  });
  adminUser = await prisma.user.create({
    data: { email: emails.admin, name: `Quản trị W2D ${rand}`, role: 'ADMIN', isActive: true },
  });
  created.users.push(userA.id, userB.id, rectorUser.id, adminUser.id);
  await prisma.user.update({ where: { id: userA.id }, data: { phone: PHONE_A } });

  const hieuTruong = await prisma.positionDefinition.upsert({
    where: { code: 'HIEU_TRUONG' },
    update: { isLeadership: true },
    create: { code: 'HIEU_TRUONG', title: 'Hiệu trưởng', group: 'LDPU', isLeadership: true },
  });
  const rectorAssignment = await prisma.positionAssignment.create({
    data: {
      userId: rectorUser.id,
      positionDefinitionId: hieuTruong.id,
      unitId: bgh.id,
      type: 'PRIMARY' as any,
      status: 'ACTIVE' as any,
      effectiveFrom: new Date('2020-01-01'),
    },
  });
  created.positions.push(rectorAssignment.id);

  const dueOld = new Date('2026-10-10T00:00:00+07:00');
  // startDate tường minh: CSDL ràng buộc due_date >= start_date, mặc định start_date là lúc tạo bản ghi
  const taskCommon = {
    scope: TaskScope.DEPARTMENT,
    priority: TaskPriority.NORMAL,
    academicMonth: 10,
    academicYear: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00+07:00'),
  };
  taskA = await prisma.task.create({
    data: {
      code: `NV-W2D-${RAND}-A`,
      title: `Báo cáo ${token} của A`,
      ...taskCommon,
      status: TaskStatus.IN_PROGRESS,
      dueDate: dueOld,
      createdById: userA.id,
      leadUnitId: unitA.id,
      actors: { create: [{ userId: userA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
    },
  });
  taskB = await prisma.task.create({
    data: {
      code: `NV-W2D-${RAND}-B`,
      title: `Việc của B ${token}`,
      ...taskCommon,
      status: TaskStatus.IN_PROGRESS,
      dueDate: new Date('2026-12-01T00:00:00+07:00'),
      createdById: userB.id,
      leadUnitId: unitB.id,
      actors: { create: [{ userId: userB.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
    },
  });
  created.tasks.push(taskA.id, taskB.id);

  for (let index = 1; index <= 22; index += 1) {
    const sub = await prisma.task.create({
      data: {
        code: `NV-W2D-${RAND}-S${index}`,
        title: `Việc con ${index} ${token} ${'x'.repeat(200)}`,
        ...taskCommon,
        // COMPLETED (đủ completedAt/progress theo ràng buộc CSDL): không chiếm chỗ trong hộp việc (tối đa 20 việc đang làm)
        status: TaskStatus.COMPLETED,
        progressPercent: 100,
        completedAt: new Date('2026-10-01T00:00:00+07:00'),
        dueDate: new Date('2026-12-01T00:00:00+07:00'),
        createdById: userA.id,
        leadUnitId: unitA.id,
        parentTaskId: taskA.id,
        actors: { create: [{ userId: userA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
      },
    });
    subTaskIds.push(sub.id);
  }
  created.tasks.push(...subTaskIds);

  const baseNumber = (parseInt(rand, 16) % 1_000_000) + 1000;
  docOk = {
    id: '',
    number: `CV-${rand}-OK`,
  };
  const okRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: baseNumber,
      documentYear: docYear,
      originalNumber: docOk.number,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Sở GDĐT',
      category: 'Công văn',
      summary: `Công văn thường ${token}`,
      securityLevel: DocumentSecurityLevel.THUONG,
      registeredById: userA.id,
      leadUserId: userA.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  docOk.id = okRow.id;

  docMat = { id: '', number: `MAT-${rand}` };
  const matRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: baseNumber + 1,
      documentYear: docYear,
      originalNumber: docMat.number,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Bộ Công an',
      category: 'Công văn',
      summary: `Tài liệu mật ${token}`,
      securityLevel: DocumentSecurityLevel.MAT,
      registeredById: userA.id,
      leadUserId: userA.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  docMat.id = matRow.id;

  const restrictedRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: baseNumber + 2,
      documentYear: docYear,
      originalNumber: `HC-${rand}`,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'UBND Tỉnh',
      category: 'Tờ trình',
      summary: `Văn bản hạn chế ${token}`,
      securityLevel: DocumentSecurityLevel.THUONG,
      notes: 'RESTRICTED',
      registeredById: userA.id,
      leadUserId: userA.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  docRestricted = { id: restrictedRow.id };

  const otherRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: baseNumber + 3,
      documentYear: docYear,
      originalNumber: `B-${rand}`,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Sở GDĐT',
      category: 'Công văn',
      summary: `Văn bản của B ${token}`,
      securityLevel: DocumentSecurityLevel.THUONG,
      registeredById: userB.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  docOtherB = { id: otherRow.id };

  // Ghi chú có mẫu "restricted" viết lẫn trong câu: danh sách và chi tiết phải cùng loại trừ.
  const restrictedNoteRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: baseNumber + 4,
      documentYear: docYear,
      originalNumber: `HCN-${rand}`,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Sở GDĐT',
      category: 'Công văn',
      summary: `Văn bản ghi chú ${token}`,
      securityLevel: DocumentSecurityLevel.THUONG,
      notes: 'Tài liệu restricted nội bộ',
      registeredById: userA.id,
      leadUserId: userA.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  docRestrictedNote = { id: restrictedNoteRow.id, number: `HCN-${rand}` };

  // Văn bản gắn nhiệm vụ mà A không đọc được (B là người tham gia).
  const linkedRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: baseNumber + 5,
      documentYear: docYear,
      originalNumber: `LK-${rand}`,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Sở GDĐT',
      category: 'Công văn',
      summary: `Văn bản liên kết ${token}`,
      securityLevel: DocumentSecurityLevel.THUONG,
      registeredById: userA.id,
      leadUserId: userA.id,
      status: DocumentStatus.CHO_PHAN_CONG,
      linkedTaskId: taskB.id,
    },
  });
  docLinked = { id: linkedRow.id };

  // Văn bản đi chờ A duyệt nội dung: một thường, một mật (hộp việc chỉ được đưa văn bản thường).
  const outOkRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: baseNumber + 6,
      documentYear: docYear,
      originalNumber: `DI-${rand}-OK`,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Sở GDĐT',
      category: 'Công văn',
      summary: 'Công văn đi thường W2D',
      securityLevel: DocumentSecurityLevel.THUONG,
      registeredById: userB.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  const outMatRow = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: baseNumber + 7,
      documentYear: docYear,
      originalNumber: `DI-${rand}-MAT`,
      issuedDate: new Date('2026-10-01T00:00:00+07:00'),
      issuingAuthority: 'Bộ Công an',
      category: 'Công văn',
      summary: 'Công văn đi mật W2D',
      securityLevel: DocumentSecurityLevel.MAT,
      registeredById: userB.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    },
  });
  outDocOk = { id: outOkRow.id };
  outDocMat = { id: outMatRow.id };
  for (const row of [outOkRow, outMatRow]) {
    await prisma.documentOutgoingWorkflow.create({
      data: { documentId: row.id, status: OutgoingDocumentStatus.CONTENT_REVIEW, contentReviewerId: userA.id },
    });
  }

  created.documents.push(
    docOk.id,
    docMat.id,
    docRestricted.id,
    docOtherB.id,
    docRestrictedNote.id,
    docLinked.id,
    outDocOk.id,
    outDocMat.id
  );

  const meetingA = await prisma.meeting.create({
    data: { title: `Họp ${token} 1`, organizerId: userA.id, startTime: new Date('2026-10-20T09:00:00+07:00'), status: MeetingStatus.DRAFT_AGENDA },
  });
  const meetingA2Row = await prisma.meeting.create({
    data: { title: `Họp ${token} 2`, organizerId: userA.id, startTime: new Date('2026-10-20T23:30:00+07:00'), status: MeetingStatus.INVITED },
  });
  const meetingA3Row = await prisma.meeting.create({
    data: { title: `Họp ${token} 3`, organizerId: userA.id, startTime: new Date('2026-10-21T00:00:00+07:00'), status: MeetingStatus.DRAFT_AGENDA },
  });
  const meetingBRow = await prisma.meeting.create({
    data: { title: `Họp B ${token}`, organizerId: userB.id, startTime: new Date('2026-10-20T09:30:00+07:00'), status: MeetingStatus.DRAFT_AGENDA },
  });
  meetingA1 = meetingA.id;
  meetingA2 = meetingA2Row.id;
  meetingA3 = meetingA3Row.id;
  meetingB1 = meetingBRow.id;
  created.meetings.push(meetingA1, meetingA2, meetingA3, meetingB1);

  ctxA = contextFor(await loadAuthorizationContext(userA.id));
  ctxB = contextFor(await loadAuthorizationContext(userB.id));
  ctxRector = contextFor(await loadAuthorizationContext(rectorUser.id));
  ctxAdmin = contextFor(await loadAuthorizationContext(adminUser.id));
});

after(async () => {
  await prisma.meeting.deleteMany({ where: { id: { in: created.meetings } } });
  await prisma.document.deleteMany({ where: { id: { in: created.documents } } });
  await prisma.taskActor.deleteMany({ where: { taskId: { in: created.tasks } } });
  await prisma.task.deleteMany({ where: { id: { in: subTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: created.tasks.filter((id) => !subTaskIds.includes(id)) } } });
  await prisma.positionAssignment.deleteMany({ where: { id: { in: created.positions } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.organizationalUnit.deleteMany({ where: { id: { in: created.units } } });
});
