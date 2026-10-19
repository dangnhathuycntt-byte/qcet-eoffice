import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('_test')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { NextRequest } from 'next/server';
import { TaskPriority, TaskScope, TaskStatus, type AssistantConversation, type AssistantMessage, type User } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { AuditAction } from '@qcet/db/audit';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { resetRateLimits } from '@/server/security/rate-limit';
import { setFeatureFlagOverride, resetFeatureFlagOverrides } from '@/features/flags';
import type { AssistantConversationListDTO, AssistantSourceRef } from '@qcet/contracts/assistant';
import { ValidationError } from '@/server/api/errors';
import {
  appendMessage,
  applyGeneratedTitle,
  createConversation,
  deleteConversation,
  encodeConversationCursor,
  getConversation,
  getConversationDetail,
  replaceLastQuestion,
  listConversations,
  loadModelHistory,
  purgeExpiredConversations,
  renameConversation,
  toConversationSummaryDTO,
  toMessageDTO,
  updateMessageProposal,
  updateMessageProposalsDismissed,
} from '@/server/assistant/assistant-conversations';
import { PATCH as proposalRoute } from '@/app/api/assistant/messages/[id]/proposals/route';
import { GET as listRoute } from '@/app/api/assistant/conversations/route';
import {
  GET as detailRoute,
  PATCH as renameRoute,
  DELETE as deleteRoute,
} from '@/app/api/assistant/conversations/[id]/route';
import { GET as cronRoute } from '@/app/api/cron/assistant-retention/route';

const runId = crypto.randomBytes(4).toString('hex');
const ORIGIN = 'http://localhost:3000';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

const userIds: string[] = [];
const convIds: string[] = [];
const CRON_SECRET = `cron-${runId}`;
const savedCronSecret = process.env.CRON_SECRET;

async function makeUser(label: string): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: `assistant-${label}-${runId}@qcet.edu.vn`,
      name: `Trợ lý ${label} ${runId}`,
      role: 'CHUYEN_VIEN',
      isActive: true,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeConversation(
  userId: string,
  title: string,
  lastMessageAt: Date,
  context: { type: 'task' | 'document'; id: string } | null = null,
): Promise<AssistantConversation> {
  const conversation = await prisma.assistantConversation.create({
    data: {
      userId,
      title,
      contextType: context?.type ?? null,
      contextId: context?.id ?? null,
      createdAt: lastMessageAt,
      lastMessageAt,
    },
  });
  convIds.push(conversation.id);
  return conversation;
}

async function makeMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  createdAt: Date,
  extra: { status?: string; sources?: unknown; steps?: unknown; proposals?: unknown } = {},
): Promise<AssistantMessage> {
  return prisma.assistantMessage.create({
    data: {
      conversationId,
      role,
      content,
      status: extra.status ?? 'complete',
      sources: extra.sources === undefined ? undefined : (extra.sources as object),
      steps: extra.steps === undefined ? undefined : (extra.steps as object),
      proposals: extra.proposals === undefined ? undefined : (extra.proposals as object),
      createdAt,
    },
  });
}

function cookieFor(user: User): string {
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function request(
  path: string,
  options: { method?: string; cookie?: string; origin?: string | null; body?: unknown; headers?: Record<string, string> } = {},
): NextRequest {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.cookie) headers.cookie = options.cookie;
  // Mặc định gửi Origin hợp lệ; truyền null để thử lời gọi thiếu Origin (CSRF)
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin) headers.origin = origin;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`${ORIGIN}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

const routeProps = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Lịch sử Trợ lý (CSDL)', () => {
  let owner: User;
  let stranger: User;
  let pager: User;
  let docId: string;
  let taskId: string;
  let c1: AssistantConversation; // tin mới nhất, có tin hỏi-đáp và nguồn
  let c2: AssistantConversation; // gắn ngữ cảnh văn bản
  let c3: AssistantConversation;
  let c4: AssistantConversation; // quá hạn lưu giữ
  let c5: AssistantConversation; // gắn ngữ cảnh nhiệm vụ
  let strangerConv: AssistantConversation;
  let pages: AssistantConversation[] = [];

  before(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    setFeatureFlagOverride('assistant', true);
    owner = await makeUser('chu');
    stranger = await makeUser('la');
    pager = await makeUser('phan-trang');
    docId = `doc_${runId}`;
    taskId = `task_${runId}`;

    c1 = await makeConversation(owner.id, 'Tuyển sinh tháng này', ago(1 * HOUR));
    await makeMessage(c1.id, 'user', 'Có nhiệm vụ nào về tuyển sinh?', ago(50 * 60_000));
    await makeMessage(c1.id, 'assistant', 'Có một nhiệm vụ đang chạy.', ago(49 * 60_000), {
      sources: [
        { type: 'task', id: taskId, code: 'NV-TEST', title: 'Tuyển sinh', href: `/tasks/${taskId}` },
        { type: 'task', id: 'x' }, // sai dạng, bị bỏ khi đọc
      ],
      steps: [
        { tool: 'list_tasks', label: 'Xem nhiệm vụ', count: 1, ok: true },
        { tool: 'bogus_tool', label: 'Lạ', count: null, ok: true }, // tool lạ, bị bỏ
      ],
    });
    c2 = await makeConversation(owner.id, 'Văn bản đến cần xử lý', ago(2 * HOUR), { type: 'document', id: docId });
    c3 = await makeConversation(owner.id, 'Lịch họp tuần này', ago(3 * HOUR));
    c4 = await makeConversation(owner.id, 'Nhiệm vụ cũ quá hạn', ago(200 * DAY), { type: 'task', id: taskId });
    c5 = await makeConversation(owner.id, 'Việc khác về nhiệm vụ', ago(4 * HOUR), { type: 'task', id: taskId });
    strangerConv = await makeConversation(stranger.id, 'Của người khác', ago(1 * HOUR));

    for (let i = 1; i <= 5; i += 1) {
      pages.push(await makeConversation(pager.id, `Trang ${i}`, ago(i * HOUR)));
    }
  });

  after(async () => {
    // audit_events chỉ cho xóa trên CSDL test (_test/_ci), trigger append-only chặn ở CSDL khác
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: convIds } } });
    await prisma.assistantConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCronSecret;
    resetFeatureFlagOverrides();
  });

  beforeEach(() => {
    resetRateLimits();
    setFeatureFlagOverride('assistant', true);
  });

  describe('dịch vụ', () => {
    it('chỉ chủ nhân thấy cuộc trò chuyện của mình', async () => {
      const list = await listConversations(stranger.id, { limit: 30 });
      const ids = list.items.map((item) => item.id);
      assert.ok(ids.includes(strangerConv.id));
      for (const conv of [c1, c2, c3, c5]) assert.ok(!ids.includes(conv.id));
      assert.equal(await getConversation(stranger.id, c1.id), null);
      assert.equal(await getConversationDetail(stranger.id, c1.id, async () => null), null);
    });

    it('cuộc quá hạn lưu giữ bị ẩn khỏi danh sách, truy cập đơn lẻ và chi tiết', async () => {
      const list = await listConversations(owner.id, { limit: 30 });
      assert.ok(!list.items.some((item) => item.id === c4.id));
      assert.equal(await getConversation(owner.id, c4.id), null);
      assert.equal(await getConversationDetail(owner.id, c4.id, async () => null), null);
    });

    it('tìm theo tiêu đề không phân biệt hoa thường', async () => {
      const list = await listConversations(owner.id, { q: 'TUYỂN SINH', limit: 30 });
      assert.deepEqual(list.items.map((item) => item.id), [c1.id]);
    });

    it('lọc theo ngữ cảnh đúng loại và mã', async () => {
      const list = await listConversations(owner.id, { contextType: 'task', contextId: taskId, limit: 30 });
      assert.deepEqual(list.items.map((item) => item.id), [c5.id]);
    });

    it('phân trang keyset: đi hết các trang, không trùng, nextCursor rỗng ở trang cuối', async () => {
      const first = await listConversations(pager.id, { limit: 2 });
      assert.deepEqual(first.items.map((item) => item.id), [pages[0].id, pages[1].id]);
      // Con trỏ mờ: không còn là id cuộc trò chuyện
      assert.ok(first.nextCursor);
      assert.notEqual(first.nextCursor, pages[1].id);
      assert.equal(first.retentionDays, 90);

      const second = await listConversations(pager.id, { limit: 2, cursor: first.nextCursor ?? undefined });
      assert.deepEqual(second.items.map((item) => item.id), [pages[2].id, pages[3].id]);
      assert.ok(second.nextCursor);

      const third = await listConversations(pager.id, { limit: 2, cursor: second.nextCursor ?? undefined });
      assert.deepEqual(third.items.map((item) => item.id), [pages[4].id]);
      assert.equal(third.nextCursor, null);
    });

    it('con trỏ không giải mã được thì 400, không coi như trang trống', async () => {
      await assert.rejects(
        listConversations(owner.id, { limit: 2, cursor: strangerConv.id }),
        (error: unknown) => error instanceof ValidationError && error.statusCode === 400,
      );
    });

    it('con trỏ mã hóa từ cuộc của người khác không lộ cuộc đó: chỉ trả cuộc của người gọi', async () => {
      const list = await listConversations(owner.id, { limit: 30, cursor: encodeConversationCursor(strangerConv) });
      assert.ok(list.items.length > 0);
      assert.ok(list.items.every((item) => item.id !== strangerConv.id));
    });

    it('chi tiết: tin theo thời gian tăng dần, nguồn và bước được lọc đúng dạng', async () => {
      const detail = await getConversationDetail(owner.id, c1.id, async () => null);
      assert.ok(detail);
      assert.deepEqual(detail.messages.map((m) => m.role), ['user', 'assistant']);
      const answer = detail.messages[1];
      assert.equal(answer.status, 'complete');
      assert.equal(answer.sources.length, 1);
      assert.equal(answer.sources[0].code, 'NV-TEST');
      assert.deepEqual(answer.steps, [{ tool: 'list_tasks', label: 'Xem nhiệm vụ', count: 1, ok: true }]);
      assert.equal(detail.context, null);
    });

    it('ngữ cảnh chỉ hiện khi resolver còn trả nguồn; resolver lỗi thì bỏ qua, không làm hỏng chi tiết', async () => {
      const seen: Array<{ type: string; id: string }> = [];
      const source: AssistantSourceRef = { type: 'document', id: docId, code: 'VB-1', title: 'Văn bản', href: `/documents?docId=${docId}` };
      const withContext = await getConversationDetail(owner.id, c2.id, async (ref) => {
        seen.push(ref);
        return source;
      });
      assert.deepEqual(seen, [{ type: 'document', id: docId }]);
      assert.deepEqual(withContext?.context, source);

      const withoutAccess = await getConversationDetail(owner.id, c2.id, async () => null);
      assert.equal(withoutAccess?.context, null);

      const failing = await getConversationDetail(owner.id, c2.id, async () => {
        throw new Error('lỗi tra cứu');
      });
      assert.ok(failing);
      assert.equal(failing.context, null);
    });

    it('toMessageDTO chuẩn hóa trạng thái lạ và bỏ sources/steps không phải mảng', () => {
      const row = {
        id: 'msg_x',
        conversationId: 'conv_x',
        role: 'assistant',
        content: 'Nội dung',
        status: 'bất thường',
        sources: { not: 'an array' },
        steps: null,
        // Thẻ hỏng (đề xuất sai tham số, có trường lạ) bị bỏ; thẻ đúng giữ, nhiệm vụ chỉ giữ id và mã
        proposals: [
          { proposal: { title: 'Chuẩn bị hội thảo', dueDate: '2026-10-30' }, task: { id: 't-1', code: 'NV-1', extra: 'x' }, dismissed: false },
          { proposal: { title: 'ab' }, task: null, dismissed: false },
          { proposal: { title: 'Gửi giấy mời', leadAssigneeId: 'u-2' }, task: null, dismissed: true },
          'không phải đối tượng',
          { proposal: { title: 'Đặt hội trường' }, dismissed: true },
        ],
        durationMs: null,
        createdAt: new Date('2026-10-17T03:00:00Z'),
      } as unknown as AssistantMessage;
      const dto = toMessageDTO(row);
      assert.equal(dto.status, 'complete');
      assert.deepEqual(dto.sources, []);
      assert.deepEqual(dto.steps, []);
      assert.deepEqual(dto.proposals, [
        { proposal: { title: 'Chuẩn bị hội thảo', dueDate: '2026-10-30' }, task: { id: 't-1', code: 'NV-1' }, dismissed: false },
        { proposal: { title: 'Đặt hội trường' }, task: null, dismissed: true },
      ]);
      assert.equal(dto.createdAt, '2026-10-17T03:00:00.000Z');
    });

    it('appendMessage đặt lastMessageAt đúng bằng thời điểm của tin mới', async () => {
      const conv = await makeConversation(owner.id, 'Tin mới', ago(5 * DAY));
      const message = await appendMessage(conv.id, { role: 'user', content: 'Xin chào' });
      const reloaded = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conv.id } });
      assert.equal(reloaded.lastMessageAt.getTime(), message.createdAt.getTime());
      assert.ok(reloaded.lastMessageAt.getTime() > conv.lastMessageAt.getTime());
      assert.equal(message.status, 'complete');
    });

    it('loadModelHistory bỏ câu hỏi hiện tại (excludeMessageId), tin lỗi và tin rỗng; giữ tin bị dừng', async () => {
      const conv = await makeConversation(owner.id, 'Lịch sử', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'câu 1', ago(50 * 60_000));
      await makeMessage(conv.id, 'assistant', 'trả lời 1', ago(45 * 60_000));
      await makeMessage(conv.id, 'assistant', 'trả lời lỗi', ago(40 * 60_000), { status: 'error' });
      const current = await makeMessage(conv.id, 'user', 'câu 2 hiện tại', ago(30 * 60_000));
      await makeMessage(conv.id, 'assistant', 'trả lời dở', ago(20 * 60_000), { status: 'aborted' });
      await makeMessage(conv.id, 'user', '', ago(10 * 60_000));

      const history = await loadModelHistory(conv.id, { excludeMessageId: current.id });
      assert.deepEqual(history, [
        { role: 'user', content: 'câu 1' },
        { role: 'assistant', content: 'trả lời 1' },
        { role: 'assistant', content: 'trả lời dở' },
      ]);
      assert.ok(!history.some((h) => h.content === 'câu 2 hiện tại'));

      const withCurrent = await loadModelHistory(conv.id, { maxMessages: 12 });
      assert.ok(withCurrent.some((h) => h.content === 'câu 2 hiện tại'));
    });

    it('loadModelHistory giới hạn theo số tin và số ký tự, lấy phần gần nhất theo thứ tự thời gian', async () => {
      const conv = await makeConversation(owner.id, 'Ngân sách', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'aaaa', ago(4 * 60_000));
      await makeMessage(conv.id, 'assistant', 'bbbbbbbbbb', ago(3 * 60_000));
      await makeMessage(conv.id, 'user', 'cc', ago(2 * 60_000));
      await makeMessage(conv.id, 'assistant', 'dd', ago(1 * 60_000));

      // Mỗi câu hỏi đi kèm trả lời đã lưu; câu hỏi không có trả lời không được đưa lại (xem test dưới)
      assert.deepEqual(await loadModelHistory(conv.id, { maxMessages: 2 }), [
        { role: 'user', content: 'cc' },
        { role: 'assistant', content: 'dd' },
      ]);
      assert.deepEqual(await loadModelHistory(conv.id, { maxChars: 11 }), [
        { role: 'user', content: 'cc' },
        { role: 'assistant', content: 'dd' },
      ]);
      assert.deepEqual(await loadModelHistory(conv.id, { maxChars: 14 }), [
        { role: 'assistant', content: 'bbbbbbbbbb' },
        { role: 'user', content: 'cc' },
        { role: 'assistant', content: 'dd' },
      ]);
    });

    it('loadModelHistory không gửi câu hỏi có trả lời lỗi, trả lời rỗng hoặc chưa có trả lời (tránh hai tin user liền nhau)', async () => {
      const conv = await makeConversation(owner.id, 'Câu hỏi bỏ dở', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'U1', ago(50 * 60_000));
      await makeMessage(conv.id, 'assistant', 'A1', ago(49 * 60_000));
      await makeMessage(conv.id, 'user', 'U2 trả lời lỗi', ago(40 * 60_000));
      await makeMessage(conv.id, 'assistant', 'trả lời lỗi dở', ago(39 * 60_000), { status: 'error' });
      await makeMessage(conv.id, 'user', 'U3 chưa có trả lời', ago(30 * 60_000));
      await makeMessage(conv.id, 'user', 'U5 trả lời rỗng đã dừng', ago(25 * 60_000));
      await makeMessage(conv.id, 'assistant', '', ago(24 * 60_000), { status: 'aborted' });
      const current = await makeMessage(conv.id, 'user', 'U4 hiện tại', ago(20 * 60_000));

      assert.deepEqual(await loadModelHistory(conv.id, { excludeMessageId: current.id }), [
        { role: 'user', content: 'U1' },
        { role: 'assistant', content: 'A1' },
      ]);
    });

    it('loadModelHistory kèm khối ghi các đề xuất đã soạn của tin trả lời cũ, để "tiếp tục" không soạn lại từ đầu', async () => {
      const conv = await makeConversation(owner.id, 'Kế hoạch dài', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'Soạn nhiệm vụ theo kế hoạch', ago(50 * 60_000));
      await makeMessage(conv.id, 'assistant', 'Đã soạn 3 đề xuất, còn đầu việc chưa soạn.', ago(49 * 60_000), {
        proposals: [
          { proposal: { title: 'Tuyển sinh đợt 3', dueDate: '2026-10-30' }, task: { id: 't-1', code: 'NV-2026-10-001' }, dismissed: false },
          { proposal: { title: 'Rà soát chương trình đào tạo' }, task: null, dismissed: true },
          { proposal: { title: 'Báo cáo tháng 10', dueDate: '2026-10-31' }, task: null, dismissed: false },
        ],
      });
      // Tin chỉ có thẻ, không kèm lời, vẫn đưa lại (cùng câu hỏi của nó)
      await makeMessage(conv.id, 'user', 'Soạn thêm việc họp giao ban', ago(40 * 60_000));
      await makeMessage(conv.id, 'assistant', '', ago(39 * 60_000), {
        proposals: [{ proposal: { title: 'Họp giao ban tháng 11' }, task: null, dismissed: false }],
      });
      const current = await makeMessage(conv.id, 'user', 'tiếp tục', ago(30 * 60_000));

      assert.deepEqual(await loadModelHistory(conv.id, { excludeMessageId: current.id }), [
        { role: 'user', content: 'Soạn nhiệm vụ theo kế hoạch' },
        {
          role: 'assistant',
          content: [
            'Đã soạn 3 đề xuất, còn đầu việc chưa soạn.',
            '',
            '[Hệ thống ghi lại: lượt này đã gọi propose_task 3 lần, người hỏi thấy các thẻ đề xuất sau]',
            '1. Tuyển sinh đợt 3 (hạn 2026-10-30) · đã tạo NV-2026-10-001',
            '2. Rà soát chương trình đào tạo · đã bỏ qua',
            '3. Báo cáo tháng 10 (hạn 2026-10-31) · chưa tạo',
          ].join('\n'),
        },
        { role: 'user', content: 'Soạn thêm việc họp giao ban' },
        {
          role: 'assistant',
          content: '[Hệ thống ghi lại: lượt này đã gọi propose_task 1 lần, người hỏi thấy các thẻ đề xuất sau]\n1. Họp giao ban tháng 11 · chưa tạo',
        },
      ]);
    });

    it('replaceLastQuestion ("Tạo lại"/"Sửa"): câu hỏi cuối và câu trả lời thành superseded, không hiện, không vào lịch sử; câu cũ hơn thì không đổi gì', async () => {
      const conv = await makeConversation(owner.id, 'Tạo lại', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'Câu 1', ago(50 * 60_000));
      await makeMessage(conv.id, 'assistant', 'Trả lời 1', ago(49 * 60_000));
      const q2 = await makeMessage(conv.id, 'user', 'Câu 2', ago(40 * 60_000));
      await makeMessage(conv.id, 'assistant', 'Trả lời 2', ago(39 * 60_000));

      const older = await prisma.assistantMessage.findFirstOrThrow({ where: { conversationId: conv.id, content: 'Câu 1' } });
      assert.equal(await replaceLastQuestion(conv.id, older.id, 'Câu 1 sửa'), null, 'chỉ thay được câu hỏi cuối');
      assert.equal(await prisma.assistantMessage.count({ where: { conversationId: conv.id, status: 'superseded' } }), 0);

      const replaced = await replaceLastQuestion(conv.id, q2.id, 'Câu 2 sửa');
      assert.equal(replaced?.content, 'Câu 2 sửa');
      const statuses = await prisma.assistantMessage.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'asc' }, select: { content: true, status: true } });
      assert.deepEqual(statuses.map((m) => `${m.content}:${m.status}`), ['Câu 1:complete', 'Trả lời 1:complete', 'Câu 2:superseded', 'Trả lời 2:superseded', 'Câu 2 sửa:complete']);
      const reloaded = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conv.id } });
      assert.equal(reloaded.lastMessageAt.getTime(), replaced?.createdAt.getTime());

      const detail = await getConversationDetail(owner.id, conv.id, async () => null);
      assert.deepEqual(detail?.messages.map((m) => m.content), ['Câu 1', 'Trả lời 1', 'Câu 2 sửa']);
      assert.deepEqual(await loadModelHistory(conv.id, { excludeMessageId: replaced?.id }), [
        { role: 'user', content: 'Câu 1' },
        { role: 'assistant', content: 'Trả lời 1' },
      ]);
      assert.equal(await replaceLastQuestion(conv.id, q2.id, 'Lần nữa'), null, 'câu đã thay không thay lại được');
    });

    it('renameConversation đổi tên và đánh dấu đã sửa tay; người khác không đổi được', async () => {
      const conv = await makeConversation(owner.id, 'Tên cũ', ago(1 * HOUR));
      const renamed = await renameConversation(owner.id, conv.id, 'Tên mới');
      assert.equal(renamed?.title, 'Tên mới');
      assert.equal(renamed?.titleEdited, true);
      assert.equal(await renameConversation(stranger.id, conv.id, 'Chiếm tên'), null);
      const reloaded = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conv.id } });
      assert.equal(reloaded.title, 'Tên mới');
    });

    it('deleteConversation xóa cascade tin nhắn; audit chỉ có số tin, không có tiêu đề hay nội dung', async () => {
      const secretTitle = `Tiêu đề bí mật ${runId}`;
      const secretContent = `Nội dung mật ${runId}`;
      const conv = await makeConversation(owner.id, secretTitle, ago(1 * HOUR));
      for (let i = 0; i < 3; i += 1) {
        await makeMessage(conv.id, 'user', `${secretContent} ${i}`, ago((3 - i) * 60_000));
      }
      const requestId = `req-${runId}`;

      assert.equal(await deleteConversation(stranger.id, conv.id, requestId), false);
      assert.ok(await getConversation(owner.id, conv.id));

      assert.equal(await deleteConversation(owner.id, conv.id, requestId), true);
      assert.equal(await prisma.assistantMessage.count({ where: { conversationId: conv.id } }), 0);
      assert.equal(await prisma.assistantConversation.findUnique({ where: { id: conv.id } }), null);

      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: conv.id, action: AuditAction.ASSISTANT_CONVERSATION_DELETED },
      });
      assert.ok(audit);
      assert.equal(audit.actorId, owner.id);
      assert.equal(audit.requestId, requestId);
      assert.deepEqual(audit.metadata, { messageCount: 3 });
      const serialized = JSON.stringify(audit);
      assert.ok(!serialized.includes(secretTitle));
      assert.ok(!serialized.includes(secretContent));
    });


    it('createConversation lưu ngữ cảnh khi có, để trống khi không có; lọc theo ngữ cảnh thấy đúng cuộc mới', async () => {
      const withContext = await createConversation(owner.id, { title: 'Có ngữ cảnh', context: { type: 'document', id: docId } });
      convIds.push(withContext.id);
      assert.equal(withContext.contextType, 'document');
      assert.equal(withContext.contextId, docId);
      assert.equal(withContext.titleEdited, false);

      const plain = await createConversation(owner.id, { title: 'Không ngữ cảnh' });
      convIds.push(plain.id);
      assert.equal(plain.contextType, null);
      assert.equal(plain.contextId, null);

      const filtered = await listConversations(owner.id, { contextType: 'document', contextId: docId, limit: 30 });
      const ids = filtered.items.map((item) => item.id);
      assert.ok(ids.includes(withContext.id));
      assert.ok(ids.includes(c2.id));
      assert.ok(!ids.includes(plain.id));
    });

    it('phân trang khi hai cuộc cùng thời điểm: id làm khóa phụ, không trùng và không sót', async () => {
      const tieUser = await makeUser('cung-gio');
      const same = ago(7 * HOUR);
      const a = await makeConversation(tieUser.id, 'Cùng giờ A', same);
      const b = await makeConversation(tieUser.id, 'Cùng giờ B', same);

      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const result = await listConversations(tieUser.id, { limit: 1, cursor });
        seen.push(...result.items.map((item) => item.id));
        cursor = result.nextCursor ?? undefined;
        if (!cursor) break;
      }
      assert.equal(cursor, undefined);
      assert.deepEqual([...seen].sort(), [a.id, b.id].sort());
    });

    it('con trỏ vẫn đưa trang sau khi cuộc làm mốc đã bị xóa', async () => {
      const deleter = await makeUser('xoa-moc');
      const items: AssistantConversation[] = [];
      for (let i = 1; i <= 5; i += 1) items.push(await makeConversation(deleter.id, `Xóa mốc ${i}`, ago(i * HOUR)));
      const first = await listConversations(deleter.id, { limit: 2 });
      assert.deepEqual(first.items.map((item) => item.id), [items[0].id, items[1].id]);

      // Cuộc cuối trang bị xóa: con trỏ mang sẵn mốc, không tra lại CSDL nên trang sau vẫn đúng
      await prisma.assistantConversation.delete({ where: { id: items[1].id } });
      const second = await listConversations(deleter.id, { limit: 2, cursor: first.nextCursor ?? undefined });
      assert.deepEqual(second.items.map((item) => item.id), [items[2].id, items[3].id]);
    });

    it('con trỏ của trang đầu không làm trang sau trùng khi cuộc cuối trang vừa nhận tin mới', async () => {
      const bumper = await makeUser('nhan-tin');
      const items: AssistantConversation[] = [];
      for (let i = 1; i <= 5; i += 1) items.push(await makeConversation(bumper.id, `Nhận tin ${i}`, ago(i * HOUR)));
      const first = await listConversations(bumper.id, { limit: 2 });
      assert.deepEqual(first.items.map((item) => item.id), [items[0].id, items[1].id]);

      // Cuộc cuối trang nhận tin mới nên lên đầu danh sách; trang sau không được lặp lại các cuộc đã hiện
      await appendMessage(items[1].id, { role: 'user', content: 'Tin mới sau trang đầu' });
      const second = await listConversations(bumper.id, { limit: 2, cursor: first.nextCursor ?? undefined });
      assert.deepEqual(second.items.map((item) => item.id), [items[2].id, items[3].id]);
    });

    it('đi hết nhiều trang có mốc trùng: mỗi cuộc đúng một lần, không sót', async () => {
      const many = await makeUser('nhieu-trang');
      const tie = ago(2 * HOUR);
      const all: AssistantConversation[] = [];
      for (let i = 1; i <= 7; i += 1) {
        // Ba cuộc đầu cùng thời điểm để khóa phụ id phải làm đúng
        all.push(await makeConversation(many.id, `Nhiều trang ${i}`, i <= 3 ? tie : ago(i * HOUR)));
      }
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const result = await listConversations(many.id, { limit: 3, cursor });
        seen.push(...result.items.map((item) => item.id));
        cursor = result.nextCursor ?? undefined;
        if (!cursor) break;
      }
      assert.equal(cursor, undefined);
      assert.deepEqual([...seen].sort(), all.map((item) => item.id).sort());
    });

    it('xóa đồng thời hai lần: một lần xóa được, lần còn lại trả false không ném lỗi, audit chỉ một bản', async () => {
      const conv = await makeConversation(owner.id, 'Xóa song song', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'tin', ago(1 * 60_000));
      const results = await Promise.all([deleteConversation(owner.id, conv.id), deleteConversation(owner.id, conv.id)]);
      assert.deepEqual([...results].sort(), [false, true]);
      assert.equal(await deleteConversation(owner.id, conv.id), false);
      assert.equal(
        await prisma.auditEvent.count({ where: { entityId: conv.id, action: AuditAction.ASSISTANT_CONVERSATION_DELETED } }),
        1,
      );
    });

    it('q chứa % hoặc _ là chữ thường: "%" chỉ khớp tiêu đề có dấu % thật, "_" không khớp mọi tiêu đề', async () => {
      const percent = await makeConversation(owner.id, 'Tỷ lệ 50% đạt', ago(2 * HOUR));
      const byPercent = await listConversations(owner.id, { q: '%', limit: 30 });
      assert.deepEqual(byPercent.items.map((item) => item.id), [percent.id]);
      assert.deepEqual((await listConversations(owner.id, { q: '50%', limit: 30 })).items.map((i) => i.id), [percent.id]);
      assert.deepEqual((await listConversations(owner.id, { q: '_', limit: 30 })).items, []);
    });

    it('cuộc quá hạn không đổi tên và không xóa được qua dịch vụ, không ghi audit', async () => {
      assert.equal(await renameConversation(owner.id, c4.id, 'Đổi khi quá hạn'), null);
      assert.equal(await deleteConversation(owner.id, c4.id), false);
      const still = await prisma.assistantConversation.findUnique({ where: { id: c4.id } });
      assert.ok(still, 'c4 phải còn trong CSDL để kiểm ẩn do quá hạn');
      assert.equal(still.title, 'Nhiệm vụ cũ quá hạn');
      assert.equal(
        await prisma.auditEvent.count({ where: { entityId: c4.id, action: AuditAction.ASSISTANT_CONVERSATION_DELETED } }),
        0,
      );
    });

    it('toMessageDTO chỉ giữ nguồn có đường dẫn nội bộ; href ngoài, javascript: và // bị bỏ', () => {
      const row = {
        id: 'msg_href',
        role: 'assistant',
        content: 'Nội dung',
        status: 'complete',
        sources: [
          { type: 'task', id: 'a', code: null, title: 'Nội bộ', href: '/tasks/a' },
          { type: 'task', id: 'b', code: null, title: 'Lạ 1', href: 'javascript:alert(1)' },
          { type: 'task', id: 'c', code: null, title: 'Lạ 2', href: 'https://ngoai.example/x' },
          { type: 'task', id: 'd', code: null, title: 'Lạ 3', href: '//ngoai.example/x' },
        ],
        steps: null,
        durationMs: null,
        createdAt: new Date('2026-10-17T03:00:00Z'),
      } as unknown as AssistantMessage;
      assert.deepEqual(
        toMessageDTO(row).sources.map((s) => s.id),
        ['a'],
      );
    });

    it('toConversationSummaryDTO: loại ngữ cảnh lạ thì bỏ cả mã để cặp không lệch', () => {
      const row = {
        id: 'conv_x',
        userId: 'user_x',
        title: 'Tiêu đề',
        titleEdited: false,
        contextType: 'bogus',
        contextId: 'abc',
        createdAt: new Date('2026-10-17T03:00:00Z'),
        updatedAt: new Date('2026-10-17T03:00:00Z'),
        lastMessageAt: new Date('2026-10-17T03:00:00Z'),
      } as AssistantConversation;
      const dto = toConversationSummaryDTO(row);
      assert.equal(dto.contextType, null);
      assert.equal(dto.contextId, null);
    });
  });

  describe('route', () => {
    it('danh sách không có cookie → 401', async () => {
      const res = await listRoute(request('/api/assistant/conversations'));
      assert.equal(res.status, 401);
    });

    it('danh sách: chỉ cuộc của người dùng, header no-store, có retentionDays', async () => {
      // c4 còn trong CSDL nhưng quá hạn: kiểm ẩn mới có ý nghĩa
      assert.ok(await prisma.assistantConversation.findUnique({ where: { id: c4.id } }));
      const res = await listRoute(request('/api/assistant/conversations', { cookie: cookieFor(owner) }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      const body = (await res.json()) as AssistantConversationListDTO;
      const ids = body.items.map((item) => item.id);
      assert.ok(ids.includes(c1.id));
      assert.ok(!ids.includes(c4.id));
      assert.ok(!ids.includes(strangerConv.id));
      assert.equal(body.retentionDays, 90);
    });

    it('danh sách: tham số không hợp lệ → 400', async () => {
      const cookie = cookieFor(owner);
      assert.equal((await listRoute(request('/api/assistant/conversations?limit=0', { cookie }))).status, 400);
      assert.equal((await listRoute(request('/api/assistant/conversations?contextType=task', { cookie }))).status, 400);
      assert.equal((await listRoute(request('/api/assistant/conversations?contextType=bogus&contextId=a', { cookie }))).status, 400);
      assert.equal((await listRoute(request('/api/assistant/conversations?cursor=khong-hop-le', { cookie }))).status, 400);
    });

    it('chi tiết: chủ nhân → 200 kèm tin nhắn', async () => {
      const res = await detailRoute(request(`/api/assistant/conversations/${c1.id}`, { cookie: cookieFor(owner) }), routeProps(c1.id));
      assert.equal(res.status, 200);
      const body = (await res.json()) as { messages: unknown[]; context: unknown };
      assert.equal(body.messages.length, 2);
      assert.equal(body.context, null);
    });

    it('chi tiết: người khác, quá hạn, id không có đều 404 với cùng câu thông báo', async () => {
      const cookie = cookieFor(owner);
      const strangerRes = await detailRoute(
        request(`/api/assistant/conversations/${c1.id}`, { cookie: cookieFor(stranger) }),
        routeProps(c1.id),
      );
      const expiredRes = await detailRoute(request(`/api/assistant/conversations/${c4.id}`, { cookie }), routeProps(c4.id));
      const missingRes = await detailRoute(
        request('/api/assistant/conversations/khong-co', { cookie }),
        routeProps('khong-co'),
      );
      for (const res of [strangerRes, expiredRes, missingRes]) {
        assert.equal(res.status, 404);
        assert.ok((await res.text()).includes('Không tìm thấy cuộc trò chuyện.'));
      }
    });

    it('đổi tên hoặc xóa cuộc quá hạn qua API → 404, cuộc vẫn còn trong CSDL', async () => {
      const cookie = cookieFor(owner);
      const path = `/api/assistant/conversations/${c4.id}`;
      const renamed = await renameRoute(
        request(path, { method: 'PATCH', cookie, body: { title: 'Đổi khi quá hạn' } }),
        routeProps(c4.id),
      );
      assert.equal(renamed.status, 404);
      const removed = await deleteRoute(request(path, { method: 'DELETE', cookie }), routeProps(c4.id));
      assert.equal(removed.status, 404);
      assert.ok(await prisma.assistantConversation.findUnique({ where: { id: c4.id } }));
    });

    it('đổi tên: thiếu Origin → 403; có Origin → 200; tên rỗng → 400; người khác → 404', async () => {
      const conv = await makeConversation(owner.id, 'Đổi qua API', ago(1 * HOUR));
      const cookie = cookieFor(owner);
      const path = `/api/assistant/conversations/${conv.id}`;

      const noOrigin = await renameRoute(
        request(path, { method: 'PATCH', cookie, origin: null, body: { title: 'Không được' } }),
        routeProps(conv.id),
      );
      assert.equal(noOrigin.status, 403);

      const ok = await renameRoute(
        request(path, { method: 'PATCH', cookie, body: { title: '  Tên mới qua API  ' } }),
        routeProps(conv.id),
      );
      assert.equal(ok.status, 200);
      const body = (await ok.json()) as { id: string; title: string; titleEdited: boolean };
      assert.equal(body.title, 'Tên mới qua API');
      assert.equal(body.titleEdited, true);

      const empty = await renameRoute(
        request(path, { method: 'PATCH', cookie, body: { title: '   ' } }),
        routeProps(conv.id),
      );
      assert.equal(empty.status, 400);

      const tooLong = await renameRoute(
        request(path, { method: 'PATCH', cookie, body: { title: 'x'.repeat(121) } }),
        routeProps(conv.id),
      );
      assert.equal(tooLong.status, 400);

      const other = await renameRoute(
        request(path, { method: 'PATCH', cookie: cookieFor(stranger), body: { title: 'Chiếm' } }),
        routeProps(conv.id),
      );
      assert.equal(other.status, 404);
    });

    it('xóa: thiếu Origin → 403; người khác → 404; chủ nhân → 200 {deleted:true}; sau đó chi tiết → 404', async () => {
      const conv = await makeConversation(owner.id, 'Xóa qua API', ago(1 * HOUR));
      await makeMessage(conv.id, 'user', 'tin để xóa', ago(1 * 60_000));
      const cookie = cookieFor(owner);
      const path = `/api/assistant/conversations/${conv.id}`;

      const noOrigin = await deleteRoute(request(path, { method: 'DELETE', cookie, origin: null }), routeProps(conv.id));
      assert.equal(noOrigin.status, 403);
      assert.ok(await getConversation(owner.id, conv.id));

      const other = await deleteRoute(request(path, { method: 'DELETE', cookie: cookieFor(stranger) }), routeProps(conv.id));
      assert.equal(other.status, 404);

      const ok = await deleteRoute(request(path, { method: 'DELETE', cookie }), routeProps(conv.id));
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { deleted: true });

      const after = await detailRoute(request(path, { cookie }), routeProps(conv.id));
      assert.equal(after.status, 404);
    });

    it('cờ tắt → 503 FEATURE_DISABLED cho danh sách, chi tiết và xóa', async () => {
      setFeatureFlagOverride('assistant', false);
      try {
        const cookie = cookieFor(owner);
        const list = await listRoute(request('/api/assistant/conversations', { cookie }));
        assert.equal(list.status, 503);
        assert.ok((await list.text()).includes('FEATURE_DISABLED'));

        const detail = await detailRoute(request(`/api/assistant/conversations/${c1.id}`, { cookie }), routeProps(c1.id));
        assert.equal(detail.status, 503);

        const removed = await deleteRoute(
          request(`/api/assistant/conversations/${c1.id}`, { method: 'DELETE', cookie }),
          routeProps(c1.id),
        );
        assert.equal(removed.status, 503);

        const renamed = await renameRoute(
          request(`/api/assistant/conversations/${c1.id}`, { method: 'PATCH', cookie, body: { title: 'Không được đổi' } }),
          routeProps(c1.id),
        );
        assert.equal(renamed.status, 503);
        assert.equal((await prisma.assistantConversation.findUniqueOrThrow({ where: { id: c1.id } })).title, 'Tuyển sinh tháng này');
      } finally {
        setFeatureFlagOverride('assistant', true);
      }
    });
  });

  describe('cron', () => {
    it('sai secret hoặc thiếu secret → 401', async () => {
      const wrong = await cronRoute(
        request('/api/cron/assistant-retention', { headers: { authorization: 'Bearer sai-secret' } }),
      );
      assert.equal(wrong.status, 401);
      const missing = await cronRoute(request('/api/cron/assistant-retention'));
      assert.equal(missing.status, 401);
    });

    it('đúng secret → xóa cuộc quá hạn, giữ cuộc còn hạn', async () => {
      const expired = await makeConversation(owner.id, 'Cron quá hạn', ago(150 * DAY));
      const fresh = await makeConversation(owner.id, 'Cron còn hạn', ago(1 * HOUR));

      const res = await cronRoute(
        request('/api/cron/assistant-retention', { headers: { 'x-cron-secret': CRON_SECRET } }),
      );
      assert.equal(res.status, 200);
      const body = (await res.json()) as { success: boolean; deleted: number };
      assert.equal(body.success, true);
      assert.ok(body.deleted >= 1);
      assert.equal(await prisma.assistantConversation.findUnique({ where: { id: expired.id } }), null);
      assert.ok(await prisma.assistantConversation.findUnique({ where: { id: fresh.id } }));
    });
  });

  // Đặt cuối file: purge quét toàn bộ CSDL test nên chạy trước sẽ xóa c4 và làm các kiểm ẩn ở trên thành vô nghĩa
  describe('tên do mô hình đặt', () => {
    it('ghi khi người dùng chưa đổi tên; đã đổi tên thì giữ tên người dùng', async () => {
      const conv = await makeConversation(owner.id, 'hôm nay thứ mấy', ago(1 * HOUR));
      const named = await applyGeneratedTitle(conv.id, 'Hỏi thứ của hôm nay');
      assert.equal(named?.title, 'Hỏi thứ của hôm nay');
      assert.equal(named?.titleEdited, false, 'tên mô hình đặt vẫn đổi tay được, không khóa như tên người dùng');
      await renameConversation(owner.id, conv.id, 'Tên tôi đặt');
      assert.equal(await applyGeneratedTitle(conv.id, 'Tên khác của mô hình'), null);
      assert.equal((await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conv.id } })).title, 'Tên tôi đặt');
    });
  });

  describe('thẻ đề xuất lưu cùng tin trả lời', () => {
    const unitId = `unit_${runId}`;
    const taskIds: string[] = [];
    let conv: AssistantConversation;
    let reply: AssistantMessage;
    let question: AssistantMessage;
    let ownTaskId = '';
    let strangerTaskId = '';

    const makeTask = async (createdById: string, code: string) => {
      const task = await prisma.task.create({
        data: {
          code,
          title: `Nhiệm vụ thẻ ${runId}`,
          scope: TaskScope.DEPARTMENT,
          priority: TaskPriority.NORMAL,
          academicMonth: 10,
          academicYear: '2026-2027',
          dueDate: new Date('2026-12-01T00:00:00+07:00'),
          status: TaskStatus.IN_PROGRESS,
          createdById,
          leadUnitId: unitId,
        },
      });
      taskIds.push(task.id);
      return task.id;
    };
    const patch = (messageId: string, body: unknown, user: User = owner, origin?: string | null) =>
      proposalRoute(
        request(`/api/assistant/messages/${messageId}/proposals`, { method: 'PATCH', cookie: cookieFor(user), body, origin }),
        routeProps(messageId),
      );

    before(async () => {
      await prisma.organizationalUnit.create({
        data: { id: unitId, code: unitId, name: `Phòng thẻ ${runId}`, type: 'DEPARTMENT' as never, status: 'ACTIVE' as never },
      });
      ownTaskId = await makeTask(owner.id, `NV-THE-${runId}-1`);
      strangerTaskId = await makeTask(stranger.id, `NV-THE-${runId}-2`);
      conv = await makeConversation(owner.id, 'Tạo nhiệm vụ hội thảo', ago(10 * 60_000));
      question = await appendMessage(conv.id, { role: 'user', content: 'Tạo nhiệm vụ hội thảo' });
      reply = await appendMessage(conv.id, {
        role: 'assistant',
        content: 'Tôi đã soạn hai đề xuất.',
        proposals: [
          { proposal: { title: 'Chuẩn bị hội thảo chuyển đổi số', dueDate: '2026-10-30' }, task: null, dismissed: false },
          { proposal: { title: 'Gửi giấy mời dự hội thảo' }, task: null, dismissed: false },
        ],
      });
    });

    after(async () => {
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    });

    it('chi tiết cuộc trả thẻ kèm trạng thái; tin không có thẻ thì rỗng', async () => {
      const detail = await getConversationDetail(owner.id, conv.id, async () => null);
      assert.deepEqual(detail?.messages.map((m) => m.proposals.length), [0, 2]);
      assert.deepEqual(detail?.messages[1].proposals[0], {
        proposal: { title: 'Chuẩn bị hội thảo chuyển đổi số', dueDate: '2026-10-30' },
        task: null,
        dismissed: false,
      });
    });

    it('bỏ qua rồi hoàn tác qua API, lưu vào CSDL', async () => {
      const dismissed = await patch(reply.id, { index: 0, dismissed: true });
      assert.equal(dismissed.status, 200);
      assert.equal(dismissed.headers.get('cache-control'), 'private, no-store');
      assert.equal(((await dismissed.json()) as { dismissed: boolean }).dismissed, true);
      let detail = await getConversationDetail(owner.id, conv.id, async () => null);
      assert.equal(detail?.messages[1].proposals[0].dismissed, true);
      assert.equal(detail?.messages[1].proposals[1].dismissed, false, 'thẻ khác không đổi');
      assert.equal((await patch(reply.id, { index: 0, dismissed: false })).status, 200);
      detail = await getConversationDetail(owner.id, conv.id, async () => null);
      assert.equal(detail?.messages[1].proposals[0].dismissed, false);
    });

    it('đã tạo: chỉ nhận nhiệm vụ do chính người gọi tạo, mã lấy từ CSDL', async () => {
      const created = await patch(reply.id, { index: 1, taskId: ownTaskId });
      assert.equal(created.status, 200);
      assert.deepEqual(((await created.json()) as { task: unknown }).task, { id: ownTaskId, code: `NV-THE-${runId}-1` });
      const others = await patch(reply.id, { index: 0, taskId: strangerTaskId });
      assert.equal(others.status, 404, 'nhiệm vụ người khác tạo');
      assert.equal((await patch(reply.id, { index: 0, taskId: 'khong-co' })).status, 404);
      // Client không gửi được mã nhiệm vụ hay trường lạ
      assert.equal((await patch(reply.id, { index: 0, taskId: ownTaskId, code: 'NV-GIA' })).status, 400);
      const detail = await getConversationDetail(owner.id, conv.id, async () => null);
      assert.equal(detail?.messages[1].proposals[0].task, null);
      assert.deepEqual(detail?.messages[1].proposals[1].task, { id: ownTaskId, code: `NV-THE-${runId}-1` });
    });

    it('"Tạo tất cả": nhiều thẻ của một tin lưu cùng lúc không ghi đè nhau; vị trí thẻ quá 20 vẫn nhận', async () => {
      const count = 30;
      const plan = await appendMessage(conv.id, {
        role: 'assistant',
        content: 'Tôi đã soạn 30 đề xuất.',
        proposals: Array.from({ length: count }, (_, i) => ({ proposal: { title: `Đầu việc kế hoạch số ${i + 1}` }, task: null, dismissed: false })),
      });
      await Promise.all(Array.from({ length: count - 1 }, (_, i) => updateMessageProposal(owner.id, plan.id, { index: i, dismissed: true })));
      assert.equal((await patch(plan.id, { index: count - 1, dismissed: true })).status, 200);
      const detail = await getConversationDetail(owner.id, conv.id, async () => null);
      const saved = detail?.messages.find((m) => m.id === plan.id);
      assert.deepEqual(saved?.proposals.map((item) => item.dismissed), Array.from({ length: count }, () => true));
    });

    it('bỏ qua/hoàn tác nhiều thẻ trong một request: một lần ghi; vị trí trùng gộp; một vị trí không có thì không đổi thẻ nào', async () => {
      const count = 60;
      const plan = await appendMessage(conv.id, {
        role: 'assistant',
        content: 'Tôi đã soạn 60 đề xuất.',
        proposals: Array.from({ length: count }, (_, i) => ({ proposal: { title: `Việc nhóm số ${i + 1}` }, task: null, dismissed: false })),
      });
      const all = Array.from({ length: count }, (_, i) => i);
      const res = await patch(plan.id, { indexes: all, dismissed: true });
      assert.equal(res.status, 200);
      assert.equal(((await res.json()) as unknown[]).length, count);
      const saved = async () => (await getConversationDetail(owner.id, conv.id, async () => null))?.messages.find((m) => m.id === plan.id);
      assert.deepEqual((await saved())?.proposals.map((item) => item.dismissed), all.map(() => true));

      const restored = await updateMessageProposalsDismissed(owner.id, plan.id, [2, 0, 2], false);
      assert.deepEqual(restored.map((item) => item.proposal.title), ['Việc nhóm số 1', 'Việc nhóm số 3'], 'gộp trùng, theo thứ tự vị trí');
      assert.deepEqual((await saved())?.proposals.slice(0, 4).map((item) => item.dismissed), [false, true, false, true]);

      await assert.rejects(updateMessageProposalsDismissed(owner.id, plan.id, [1, count], false), /Không tìm thấy đề xuất/);
      assert.equal((await saved())?.proposals[1].dismissed, true, 'vị trí không có thì cả nhóm không đổi');
      assert.equal((await patch(plan.id, { indexes: [], dismissed: true })).status, 400);
      assert.equal((await patch(plan.id, { indexes: [0], taskId: ownTaskId })).status, 400, 'tạo nhiệm vụ không đi theo nhóm');
      assert.equal((await patch(plan.id, { indexes: [0], dismissed: true }, stranger)).status, 404);
    });

    it('người khác, tin hỏi, thẻ không có, thiếu Origin đều bị từ chối', async () => {
      assert.equal((await patch(reply.id, { index: 0, dismissed: true }, stranger)).status, 404);
      assert.equal((await patch(question.id, { index: 0, dismissed: true })).status, 404);
      assert.equal((await patch(reply.id, { index: 5, dismissed: true })).status, 404);
      assert.equal((await patch(reply.id, { index: 0, dismissed: true }, owner, null)).status, 403);
      await assert.rejects(updateMessageProposal(stranger.id, reply.id, { index: 0, dismissed: true }), /Không tìm thấy đề xuất/);
      const detail = await getConversationDetail(owner.id, conv.id, async () => null);
      assert.equal(detail?.messages[1].proposals[0].dismissed, false, 'không lời gọi bị từ chối nào ghi được');
    });
  });

  describe('quét quá hạn', () => {
    it('purgeExpiredConversations xóa cuộc quá hạn kèm tin nhắn, giữ cuộc còn hạn', async () => {
      const expired = await makeConversation(owner.id, 'Quá hạn để xóa', ago(120 * DAY));
      await makeMessage(expired.id, 'user', 'tin cũ', ago(120 * DAY));
      const fresh = await makeConversation(owner.id, 'Còn hạn', ago(1 * DAY));

      const deleted = await purgeExpiredConversations();
      assert.ok(deleted >= 1);
      assert.equal(await prisma.assistantConversation.findUnique({ where: { id: expired.id } }), null);
      assert.equal(await prisma.assistantMessage.count({ where: { conversationId: expired.id } }), 0);
      assert.ok(await prisma.assistantConversation.findUnique({ where: { id: fresh.id } }));
    });
  });
});
