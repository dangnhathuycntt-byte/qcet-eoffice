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
import { TaskActorRole, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { resetRateLimits } from '@/server/security/rate-limit';
import { setFeatureFlagOverride, resetFeatureFlagOverrides } from '@/features/flags';
import { ASSISTANT_TOOL_NAMES, parseAssistantStreamEvent, type AssistantStreamEvent } from '@/contracts/assistant';
import { POST as chatRoute } from '@/app/api/assistant/chat/route';
import { GET as detailRoute } from '@/app/api/assistant/conversations/[id]/route';

const runId = crypto.randomBytes(4).toString('hex');
const ORIGIN = 'http://localhost:3000';
const realFetch = globalThis.fetch;
const GATEWAY_ENV = {
  TASK_AGENT_BASE_URL: 'http://gateway.test/v1',
  TASK_AGENT_API_KEY: `test-key-${runId}`,
  TASK_AGENT_MODEL: 'test-model',
  TASK_AGENT_THINKING_BUDGET: undefined,
} as const;

const userIds: string[] = [];
const convIds: string[] = [];

interface SentGatewayRequest {
  body: { tools?: Array<{ function: { name: string } }>; messages: Array<{ role: string; content: unknown }> };
}

/** Đặt biến môi trường trong lúc chạy (`undefined` = bỏ đi), rồi khôi phục. Giá trị giả, không in ra. */
async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const saved = Object.keys(values).map((key) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const TITLE_PROMPT_START = 'Đặt tên cho cuộc trò chuyện';

/**
 * Gateway giả trả SSE: một đoạn chữ rồi kết thúc. Ghi lại yêu cầu của lượt vào `sent`; lời gọi đặt tên cuộc mới
 * (system prompt đặt tên) ghi vào `titles` và trả tên cố định.
 */
function mockGateway(sent: SentGatewayRequest[], chunks: string[], titles: SentGatewayRequest[] = []): void {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as SentGatewayRequest['body'];
    const naming = String(body.messages[0]?.content ?? '').startsWith(TITLE_PROMPT_START);
    (naming ? titles : sent).push({ body });
    const lines = (naming ? ['"Chào hỏi Trợ lý."'] : chunks).map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
    lines.push(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`, 'data: [DONE]\n\n');
    return new Response(lines.join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
}

async function makeUser(label: string): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: `assistant-route-${label}-${runId}@qcet.edu.vn`,
      name: `Trợ lý tuyến ${label} ${runId}`,
      role: 'CHUYEN_VIEN',
      isActive: true,
    },
  });
  userIds.push(user.id);
  return user;
}

function cookieFor(user: User): string {
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function chatRequest(
  options: { cookie?: string; origin?: string | null; body?: unknown; rawBody?: string; signal?: AbortSignal } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin) headers.origin = origin;
  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
    headers['content-type'] = 'application/json';
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['content-type'] = 'application/json';
  }
  return new NextRequest(`${ORIGIN}/api/assistant/chat`, { method: 'POST', headers, body, signal: options.signal });
}

/** Lượt có tệp: multipart, `payload` là JSON của lượt, `files` là tệp (như trình duyệt gửi). */
function chatFormRequest(cookie: string, payload: unknown, files: Array<{ name: string; bytes: Buffer }>): NextRequest {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  for (const file of files) form.append('files', new File([new Uint8Array(file.bytes)], file.name));
  return new NextRequest(`${ORIGIN}/api/assistant/chat`, { method: 'POST', headers: { cookie, origin: ORIGIN }, body: form });
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** Đọc luồng NDJSON thành các sự kiện; dòng hỏng thì báo lỗi để test thấy ngay. */
async function readEvents(res: Response): Promise<AssistantStreamEvent[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const event = parseAssistantStreamEvent(line);
      assert.ok(event, `dòng NDJSON hỏng: ${line.slice(0, 80)}`);
      return event;
    });
}

describe('POST /api/assistant/chat', () => {
  let owner: User;
  let stranger: User;

  before(async () => {
    owner = await makeUser('chu');
    stranger = await makeUser('la');
  });

  after(async () => {
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: convIds } } });
    await prisma.assistantConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    globalThis.fetch = realFetch;
    resetFeatureFlagOverrides();
  });

  beforeEach(() => {
    resetRateLimits();
    setFeatureFlagOverride('assistant', true);
    globalThis.fetch = realFetch;
  });

  it('chưa đăng nhập: 401', async () => {
    const res = await chatRoute(chatRequest({ origin: ORIGIN, body: { message: 'Xin chào' } }));
    assert.equal(res.status, 401);
  });

  it('thiếu Origin khi dùng cookie: 403 CSRF', async () => {
    const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), origin: null, body: { message: 'Xin chào' } }));
    assert.equal(res.status, 403);
  });

  it('cờ Trợ lý tắt: 503 FEATURE_DISABLED', async () => {
    setFeatureFlagOverride('assistant', false);
    const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Xin chào' } }));
    assert.equal(res.status, 503);
    assert.match(await res.text(), /FEATURE_DISABLED/);
  });

  it('thiếu cấu hình gateway: 503 trước khi trừ lượt gọi', async () => {
    await withEnv({ ...GATEWAY_ENV, TASK_AGENT_API_KEY: undefined }, async () => {
      const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Xin chào' } }));
      assert.equal(res.status, 503);
      const text = await res.text();
      assert.match(text, /AGENT_NOT_CONFIGURED/);
      assert.match(text, /Trợ lý chưa được cấu hình/);
    });
  });

  it('nội dung sai (rỗng, thừa trường, JSON hỏng): 400', async () => {
    await withEnv(GATEWAY_ENV, async () => {
      const empty = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: '   ' } }));
      assert.equal(empty.status, 400);
      const extra = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Xin chào', userId: owner.id } }));
      assert.equal(extra.status, 400);
      const broken = await chatRoute(chatRequest({ cookie: cookieFor(owner), rawBody: '{"message":' }));
      assert.equal(broken.status, 400);
    });
  });

  it('vượt 6 lượt mỗi phút: lượt thứ 7 bị 429', async () => {
    await withEnv(GATEWAY_ENV, async () => {
      const cookie = cookieFor(owner);
      for (let i = 0; i < 6; i += 1) {
        const res = await chatRoute(chatRequest({ cookie, body: {} }));
        assert.equal(res.status, 400, `lượt ${i + 1} phải qua giới hạn rồi bị 400 vì nội dung rỗng`);
      }
      const limited = await chatRoute(chatRequest({ cookie, body: {} }));
      assert.equal(limited.status, 429);
    });
  });

  it('lượt hợp lệ: NDJSON gồm conversation, text, title, sources, done; gửi đủ công cụ và tên người hỏi cho gateway', async () => {
    const sent: SentGatewayRequest[] = [];
    const titles: SentGatewayRequest[] = [];
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent, ['Xin ', 'chào Thầy/Cô.'], titles);
      const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Chào Trợ lý' } }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      assert.ok(res.headers.get('x-request-id'));

      const events = await readEvents(res);
      // Tên chạy song song với câu trả lời nên có thể tới trước hay sau chữ, nhưng luôn trước sources và done
      assert.deepEqual(events.map((e) => e.type).filter((type) => type !== 'title'), ['conversation', 'text', 'text', 'sources', 'done']);
      const types = events.map((e) => e.type);
      assert.ok(types.indexOf('title') > 0 && types.indexOf('title') < types.indexOf('sources'), types.join(','));
      const conversation = events[0];
      assert.equal(conversation.type === 'conversation' && conversation.conversation.title, 'Chào Trợ lý');
      if (conversation.type === 'conversation') convIds.push(conversation.conversation.id);
      const titled = events.find((e) => e.type === 'title');
      assert.equal(titled?.type === 'title' && titled.conversation.title, 'Chào hỏi Trợ lý', 'tên đã làm sạch dấu câu và ngoặc kép');
      const done = events[events.length - 1];
      assert.equal(done.type === 'done' && done.status, 'complete');
    });

    // Lời gọi đặt tên: không công cụ, không suy nghĩ, chỉ có câu hỏi
    assert.equal(titles.length, 1);
    const naming = titles[0].body as SentGatewayRequest['body'] & { thinking?: unknown };
    assert.equal(naming.tools, undefined);
    assert.equal(naming.thinking, undefined);
    assert.equal(naming.messages[1].content, 'Câu hỏi: Chào Trợ lý');
    assert.equal(sent.length, 1);
    const names = (sent[0].body.tools ?? []).map((t) => t.function.name).sort();
    assert.deepEqual(names, [...ASSISTANT_TOOL_NAMES].sort());
    const system = sent[0].body.messages[0];
    assert.equal(system.role, 'system');
    assert.match(String(system.content), new RegExp(`Người hỏi: Trợ lý tuyến chu ${runId}`));
  });

  it('model ngoài danh sách TASK_AGENT_MODELS: 400 MODEL_NOT_ALLOWED, không gọi gateway', async () => {
    const sent: SentGatewayRequest[] = [];
    await withEnv({ ...GATEWAY_ENV, TASK_AGENT_MODELS: 'second-model' }, async () => {
      mockGateway(sent, ['Không được gọi']);
      const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Xin chào', model: 'other-model' } }));
      assert.equal(res.status, 400);
      assert.match(await res.text(), /MODEL_NOT_ALLOWED/);
    });
    await withEnv({ ...GATEWAY_ENV, TASK_AGENT_MODELS: undefined }, async () => {
      mockGateway(sent, ['Không được gọi']);
      const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Xin chào', model: 'second-model' } }));
      assert.equal(res.status, 400, 'không đặt TASK_AGENT_MODELS thì chỉ nhận model mặc định');
    });
    assert.equal(sent.length, 0);
  });

  it('model trong danh sách: gateway nhận và audit ghi đúng model đó; không gửi model thì dùng TASK_AGENT_MODEL', async () => {
    const sent: SentGatewayRequest[] = [];
    const turnIds: string[] = [];
    await withEnv({ ...GATEWAY_ENV, TASK_AGENT_MODELS: 'second-model' }, async () => {
      for (const model of ['second-model', undefined]) {
        mockGateway(sent, ['Chào Thầy/Cô.']);
        const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Chào Trợ lý', ...(model ? { model } : {}) } }));
        assert.equal(res.status, 200);
        const events = await readEvents(res);
        const conversation = events[0];
        if (conversation.type === 'conversation') {
          convIds.push(conversation.conversation.id);
          turnIds.push(conversation.conversation.id);
        }
        assert.equal(events[events.length - 1].type, 'done');
      }
    });
    assert.deepEqual(sent.map((request) => (request.body as { model?: string }).model), ['second-model', 'test-model']);
    const audits = await Promise.all(
      turnIds.map((entityId) => prisma.auditEvent.findFirst({ where: { entityId, action: 'ASSISTANT_TURN' }, select: { metadata: true } })),
    );
    assert.deepEqual(audits.map((audit) => (audit?.metadata as { model?: string } | null)?.model), ['second-model', 'test-model']);
  });

  it('lượt có ảnh và tệp chữ: gateway nhận phần ảnh, chữ trích; bước "Xem ảnh/Đọc tệp" lưu cùng tin trả lời; audit chỉ ghi loại và dung lượng', async () => {
    const sent: SentGatewayRequest[] = [];
    const titles: SentGatewayRequest[] = [];
    let conversationId = '';
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent, ['Ảnh là sơ đồ.'], titles);
      const res = await chatRoute(
        chatFormRequest(cookieFor(owner), { message: 'Ảnh này nói gì?' }, [
          { name: 'so-do.png', bytes: PNG },
          { name: 'ghi-chu.txt', bytes: Buffer.from('Họp lúc 9 giờ') },
        ]),
      );
      assert.equal(res.status, 200);
      const events = await readEvents(res);
      const conversation = events[0];
      assert.equal(conversation.type, 'conversation');
      if (conversation.type === 'conversation') {
        conversationId = conversation.conversation.id;
        convIds.push(conversationId);
      }
      const steps = events.flatMap((e) => (e.type === 'step' ? [e.step] : []));
      assert.deepEqual(steps, [
        { tool: 'attachment', label: 'Xem ảnh so-do.png', count: null, ok: true },
        { tool: 'attachment', label: 'Đọc tệp ghi-chu.txt', count: null, ok: true },
      ]);
      assert.equal(events[events.length - 1].type, 'done');
    });

    // Đặt tên chỉ nhận nhãn tệp, không nhận ảnh hay chữ trích của tệp
    assert.equal(titles.length, 1);
    assert.equal(titles[0].body.messages[1].content, 'Câu hỏi: Ảnh này nói gì?\nTệp gửi kèm: Xem ảnh so-do.png; Đọc tệp ghi-chu.txt');
    assert.equal(sent.length, 1);
    const question = sent[0].body.messages[sent[0].body.messages.length - 1];
    assert.equal(question.role, 'user');
    assert.deepEqual(question.content, [
      { type: 'text', text: 'Ảnh này nói gì?' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${PNG.toString('base64')}` } },
      { type: 'text', text: '[Tệp đính kèm: ghi-chu.txt]\nHọp lúc 9 giờ\n[Hết tệp]' },
    ]);

    // Tệp không lưu: tin hỏi chỉ có chữ, tin trả lời giữ tên tệp trong nhật ký bước
    const rows = await prisma.assistantMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(rows.map((row) => row.content), ['Ảnh này nói gì?', 'Ảnh là sơ đồ.']);
    const detail = await detailRoute(new NextRequest(`${ORIGIN}/api/assistant/conversations/${conversationId}`, { headers: { cookie: cookieFor(owner) } }), {
      params: Promise.resolve({ id: conversationId }),
    });
    const body = (await detail.json()) as { messages: Array<{ role: string; steps: Array<{ tool: string; label: string }> }> };
    assert.deepEqual(body.messages[1].steps.map((step) => step.label), ['Xem ảnh so-do.png', 'Đọc tệp ghi-chu.txt']);

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: conversationId, action: 'ASSISTANT_TURN' }, select: { metadata: true } });
    const metadata = audit?.metadata as { attachments?: unknown; tools?: unknown[] } | null;
    assert.deepEqual(metadata?.attachments, [
      { kind: 'image', bytes: PNG.length },
      { kind: 'text', bytes: Buffer.byteLength('Họp lúc 9 giờ') },
    ]);
    assert.deepEqual(metadata?.tools, [], 'bước đọc tệp không tính là công cụ');
    assert.equal(JSON.stringify(metadata).includes('so-do.png'), false, 'audit không ghi tên tệp');
  });

  it('tệp sai nội dung hoặc quá số lượng: 400 trước khi trả luồng, không gọi gateway, không tạo cuộc', async () => {
    const sent: SentGatewayRequest[] = [];
    const before = await prisma.assistantConversation.count({ where: { userId: owner.id } });
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent, ['Không được gọi']);
      const fake = await chatRoute(chatFormRequest(cookieFor(owner), { message: 'Xem ảnh' }, [{ name: 'anh.png', bytes: Buffer.from('%PDF-1.4') }]));
      assert.equal(fake.status, 400);
      assert.match(await fake.text(), /ATTACHMENT_INVALID/);

      const many = await chatRoute(
        chatFormRequest(
          cookieFor(owner),
          { message: 'Xem ảnh' },
          Array.from({ length: 6 }, (_, i) => ({ name: `anh-${i}.png`, bytes: PNG })),
        ),
      );
      assert.equal(many.status, 400);
      assert.match(await many.text(), /Mỗi lượt hỏi đính kèm tối đa 5 tệp/);

      const broken = await chatRoute(chatFormRequest(cookieFor(owner), { message: '   ' }, [{ name: 'anh.png', bytes: PNG }]));
      assert.equal(broken.status, 400, 'payload vẫn qua cùng schema (câu hỏi rỗng bị chặn)');
    });
    assert.equal(sent.length, 0);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: owner.id } }), before);
  });

  it('client ngắt ngay khi gửi (trước khi xác thực xong): không tạo cuộc, không gọi gateway, luồng rỗng', async () => {
    const sent: SentGatewayRequest[] = [];
    const before = await prisma.assistantConversation.count({ where: { userId: owner.id } });
    const controller = new AbortController();
    controller.abort();
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent, ['Không được gọi']);
      const res = await chatRoute(chatRequest({ cookie: cookieFor(owner), body: { message: 'Ngắt sớm' }, signal: controller.signal }));
      assert.equal(res.status, 200);
      assert.equal(await res.text(), '');
    });
    assert.equal(sent.length, 0);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: owner.id } }), before);
  });

  it('cuộc có sẵn của người khác: NDJSON báo NOT_FOUND, không gọi gateway', async () => {
    const sent: SentGatewayRequest[] = [];
    const created = await prisma.assistantConversation.create({
      data: { userId: owner.id, title: 'Của chủ' },
    });
    convIds.push(created.id);
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent, ['Không được gọi']);
      const res = await chatRoute(
        chatRequest({ cookie: cookieFor(stranger), body: { conversationId: created.id, message: 'Thử vào cuộc người khác' } }),
      );
      assert.equal(res.status, 200);
      const events = await readEvents(res);
      assert.deepEqual(events, [{ type: 'error', error: { code: 'NOT_FOUND', message: 'Không tìm thấy cuộc trò chuyện.' } }]);
    });
    assert.equal(sent.length, 0);
  });

  it('ngữ cảnh không đọc được (không tồn tại hoặc không có quyền): NDJSON CONTEXT_FORBIDDEN, không tạo cuộc', async () => {
    const sent: SentGatewayRequest[] = [];
    const before = await prisma.assistantConversation.count({ where: { userId: owner.id } });
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent, ['Không được gọi']);
      const res = await chatRoute(
        chatRequest({
          cookie: cookieFor(owner),
          body: { message: 'Việc này thế nào?', context: { type: 'task', id: `khong-co-${runId}` } },
        }),
      );
      assert.equal(res.status, 200);
      const events = await readEvents(res);
      assert.deepEqual(events, [
        { type: 'error', error: { code: 'CONTEXT_FORBIDDEN', message: 'Không tìm thấy hoặc Thầy/Cô không có quyền xem mục này.' } },
      ]);
    });
    assert.equal(sent.length, 0);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: owner.id } }), before);
  });

  it('GET chi tiết: resolver thật nối đúng ngữ cảnh đọc được; ngữ cảnh không còn đọc được thì context null, không lỗi', async () => {
    const code = `NV-CTX-${runId}`;
    // Owner là người phụ trách: đọc được qua readTaskForUser, nên resolver thật phải trả nguồn
    const task = await prisma.task.create({
      data: {
        code,
        title: `Việc ngữ cảnh ${runId}`,
        academicMonth: 10,
        academicYear: '2026-2027',
        startDate: new Date('2026-09-01T00:00:00+07:00'),
        dueDate: new Date('2026-12-01T00:00:00+07:00'),
        createdById: owner.id,
        actors: { create: [{ userId: owner.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
      },
    });
    try {
      const cases: Array<{ name: string; contextType: 'task' | 'document'; contextId: string }> = [
        { name: 'đọc được', contextType: 'task', contextId: task.id },
        { name: 'nhiệm vụ không tồn tại', contextType: 'task', contextId: `khong-co-${runId}` },
        { name: 'văn bản không tồn tại', contextType: 'document', contextId: `khong-co-${runId}` },
      ];
      for (const item of cases) {
        const conv = await prisma.assistantConversation.create({
          data: { userId: owner.id, title: `Ngữ cảnh ${item.name} ${runId}`, contextType: item.contextType, contextId: item.contextId },
        });
        convIds.push(conv.id);
        const res = await detailRoute(
          new NextRequest(`${ORIGIN}/api/assistant/conversations/${conv.id}`, { headers: { cookie: cookieFor(owner) } }),
          { params: Promise.resolve({ id: conv.id }) },
        );
        assert.equal(res.status, 200, item.name);
        const body = (await res.json()) as {
          id: string;
          contextType: string;
          context: { type: string; id: string; code: string | null; href: string } | null;
          messages: unknown[];
        };
        assert.equal(body.id, conv.id, item.name);
        assert.equal(body.contextType, item.contextType, item.name);
        assert.deepEqual(body.messages, [], item.name);
        if (item.contextId === task.id) {
          assert.deepEqual(
            body.context && { type: body.context.type, id: body.context.id, code: body.context.code, href: body.context.href },
            { type: 'task', id: task.id, code, href: `/tasks/${task.id}` },
            item.name,
          );
        } else {
          assert.equal(body.context, null, item.name);
        }
      }
    } finally {
      await prisma.taskActor.deleteMany({ where: { taskId: task.id } });
      await prisma.task.delete({ where: { id: task.id } });
    }
  });
});
