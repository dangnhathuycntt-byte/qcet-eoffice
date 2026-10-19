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
import type { User } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { resetRateLimits } from '@/server/security/rate-limit';
import { setFeatureFlagOverride, resetFeatureFlagOverrides } from '@/features/flags';
import { parseAssistantStreamEvent, type AssistantStreamEvent } from '@qcet/contracts/assistant';
import {
  emitRunEvent,
  findAssistantRun,
  findConversationRun,
  finishAssistantRun,
  hasActiveConversationRun,
  startAssistantRun,
  stopAssistantRun,
  subscribeAssistantRun,
} from '@/server/assistant/assistant-runs';
import { POST as chatRoute } from '@/app/api/assistant/chat/route';
import { GET as streamRoute } from '@/app/api/assistant/conversations/[id]/stream/route';
import { POST as stopRoute } from '@/app/api/assistant/runs/[id]/stop/route';
import { DELETE as deleteRoute } from '@/app/api/assistant/conversations/[id]/route';
import { GET as activityRoute } from '@/app/api/assistant/runs/route';

const runId = crypto.randomBytes(4).toString('hex');
const ORIGIN = 'http://localhost:3000';
const realFetch = globalThis.fetch;
// Giá trị giả, không in ra; khôi phục sau khi chạy xong
const GATEWAY_ENV: Record<string, string | undefined> = {
  TASK_AGENT_BASE_URL: 'http://gateway.test/v1',
  TASK_AGENT_API_KEY: `test-key-${runId}`,
  TASK_AGENT_MODEL: 'test-model',
  TASK_AGENT_THINKING_BUDGET: undefined,
};
const savedEnv = Object.fromEntries(Object.keys(GATEWAY_ENV).map((key) => [key, process.env[key]]));

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
const TITLE_PROMPT_START = 'Đặt tên cho cuộc trò chuyện';

const userIds: string[] = [];
const convIds: string[] = [];

const summary = (id: string) => ({
  id,
  title: 'Cuộc thử',
  titleEdited: false,
  contextType: null,
  contextId: null,
  createdAt: '2026-10-19T00:00:00.000Z',
  lastMessageAt: '2026-10-19T00:00:00.000Z',
});

describe('sổ lượt chạy của Trợ lý', () => {
  it('nghe muộn: phát lại sự kiện đã có rồi nhận tiếp; xong thì đóng; lượt đã xong phát lại rồi đóng ngay', () => {
    const run = startAssistantRun(`u-${runId}`);
    emitRunEvent(run, { type: 'text', delta: 'Một' });
    const seen: string[] = [];
    let ended = 0;
    const listener = {
      onEvent: (event: AssistantStreamEvent) => seen.push(event.type === 'text' ? event.delta : event.type),
      onEnd: () => ended++,
    };
    const unsubscribe = subscribeAssistantRun(run, listener);
    emitRunEvent(run, { type: 'text', delta: 'Hai' });
    assert.deepEqual(seen, ['Một', 'Hai']);
    finishAssistantRun(run);
    assert.equal(ended, 1);
    emitRunEvent(run, { type: 'text', delta: 'Sau khi xong' });
    assert.equal(run.events.length, 2, 'lượt đã xong không nhận thêm sự kiện');
    unsubscribe();

    const late: string[] = [];
    subscribeAssistantRun(run, { onEvent: (event) => late.push(event.type), onEnd: () => late.push('end') });
    assert.deepEqual(late, ['text', 'text', 'end']);
  });

  it('chỉ chủ lượt tìm thấy lượt; cuộc gắn vào lượt khi có sự kiện conversation; dừng một lần', () => {
    const owner = `chu-${runId}`;
    const run = startAssistantRun(owner);
    const conversationId = `c-${runId}`;
    assert.equal(findConversationRun(owner, conversationId), null);
    emitRunEvent(run, { type: 'conversation', conversation: summary(conversationId), userMessageId: 'm1' });
    assert.equal(findConversationRun(owner, conversationId), run);
    assert.equal(findConversationRun('nguoi-khac', conversationId), null);
    assert.equal(findAssistantRun('nguoi-khac', run.id), null);
    assert.equal(hasActiveConversationRun(owner, conversationId), true);

    assert.equal(stopAssistantRun(findAssistantRun('nguoi-khac', run.id)), false);
    assert.equal(run.controller.signal.aborted, false);
    assert.equal(stopAssistantRun(run), true);
    assert.equal(run.controller.signal.aborted, true);
    finishAssistantRun(run);
    assert.equal(stopAssistantRun(run), false, 'lượt đã xong không dừng nữa');
    assert.equal(hasActiveConversationRun(owner, conversationId), false);
    assert.equal(findConversationRun(owner, conversationId), run, 'lượt vừa xong còn giữ để nối lại phát lại đủ');
  });
});

/** Gateway giả trả từng đoạn chữ cách nhau `delayMs`, ngắt khi lượt bị hủy; lời gọi đặt tên trả tên ngay. */
function mockSlowGateway(chunks: string[], delayMs: number): void {
  const encoder = new TextEncoder();
  const sse = (content: string) => encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  const finish = encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: unknown }> };
    const naming = String(body.messages[0]?.content ?? '').startsWith(TITLE_PROMPT_START);
    const parts = naming ? ['"Lượt chạy thử."'] : chunks;
    const signal = init?.signal;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const content of parts) {
          if (!naming) await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (signal?.aborted) {
            controller.error(new DOMException('Đã hủy', 'AbortError'));
            return;
          }
          controller.enqueue(sse(content));
        }
        controller.enqueue(finish);
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
}

async function makeUser(label: string): Promise<User> {
  const user = await prisma.user.create({
    data: { email: `assistant-runs-${label}-${runId}@qcet.edu.vn`, name: `Lượt chạy ${label} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
  });
  userIds.push(user.id);
  return user;
}

function cookieFor(user: User): string {
  return `${SESSION_COOKIE_NAME}=${signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role })}`;
}

function post(user: User, body: unknown): Promise<Response> {
  return chatRoute(
    new NextRequest(`${ORIGIN}/api/assistant/chat`, {
      method: 'POST',
      headers: { cookie: cookieFor(user), origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function resume(user: User, conversationId: string): Promise<Response> {
  return streamRoute(
    new NextRequest(`${ORIGIN}/api/assistant/conversations/${conversationId}/stream`, { headers: { cookie: cookieFor(user) } }),
    { params: Promise.resolve({ id: conversationId }) },
  );
}

function stop(user: User, id: string): Promise<Response> {
  return stopRoute(
    new NextRequest(`${ORIGIN}/api/assistant/runs/${id}/stop`, { method: 'POST', headers: { cookie: cookieFor(user), origin: ORIGIN } }),
    { params: Promise.resolve({ id }) },
  );
}

/** Đọc NDJSON tới khi `until` đúng (rồi ngắt như trình duyệt rời trang) hoặc tới hết luồng. */
async function readUntil(res: Response, until?: (event: AssistantStreamEvent) => boolean): Promise<AssistantStreamEvent[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: AssistantStreamEvent[] = [];
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return events;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.filter((l) => l.trim())) {
      const event = parseAssistantStreamEvent(line);
      assert.ok(event, `dòng NDJSON hỏng: ${line.slice(0, 80)}`);
      events.push(event);
      if (until?.(event)) {
        await reader.cancel();
        return events;
      }
    }
  }
}

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Hết giờ chờ');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function conversationOf(events: AssistantStreamEvent[]): string {
  const event = events.find((e) => e.type === 'conversation');
  assert.ok(event && event.type === 'conversation');
  convIds.push(event.conversation.id);
  return event.conversation.id;
}

describe('lượt chạy độc lập với kết nối (POST chat, GET stream, POST stop)', () => {
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
    setEnv(savedEnv);
    resetFeatureFlagOverrides();
  });

  beforeEach(() => {
    resetRateLimits();
    setFeatureFlagOverride('assistant', true);
    setEnv(GATEWAY_ENV);
  });

  it('rời trang giữa chừng: lượt vẫn chạy và lưu đủ; mở lại cuộc thì phát lại từ đầu tới done; người khác không thấy', async () => {
    mockSlowGateway(['Phần một. ', 'Phần hai. ', 'Phần ba.'], 40);
    const res = await post(owner, { message: 'Soạn báo cáo dài' });
    assert.equal(res.status, 200);
    const run = res.headers.get('x-assistant-run-id');
    assert.ok(run && Number(res.headers.get('x-assistant-run-started-at')) > 0);
    const early = await readUntil(res, (event) => event.type === 'text');
    const conversationId = conversationOf(early);
    assert.equal(early.some((e) => e.type === 'done'), false, 'ngắt trước khi xong');

    await waitFor(() => findAssistantRun(owner.id, run)?.finished === true);
    const saved = await prisma.assistantMessage.findFirst({ where: { conversationId, role: 'assistant' } });
    assert.equal(saved?.status, 'complete');
    assert.equal(saved?.content, 'Phần một. Phần hai. Phần ba.');

    const replay = await resume(owner, conversationId);
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get('x-assistant-run-id'), run);
    const events = await readUntil(replay);
    assert.equal(events[0].type, 'conversation');
    assert.equal(events.filter((e) => e.type === 'text').map((e) => (e.type === 'text' ? e.delta : '')).join(''), 'Phần một. Phần hai. Phần ba.');
    assert.equal(events.at(-1)?.type, 'done');

    assert.equal((await resume(stranger, conversationId)).status, 204, 'cuộc của người khác như không có lượt');
    assert.equal((await resume(owner, `khong-co-${runId}`)).status, 204);
  });

  it('nút Dừng: chỉ chủ lượt dừng được; lưu aborted với phần chữ đã có; gọi lại vẫn an toàn', async () => {
    mockSlowGateway(['Đoạn đầu. ', 'Đoạn sau. ', 'Đoạn cuối.'], 60);
    const res = await post(owner, { message: 'Viết dài rồi tôi dừng' });
    const run = res.headers.get('x-assistant-run-id')!;
    const reader = readUntil(res);
    await waitFor(() => (findAssistantRun(owner.id, run)?.events ?? []).some((e) => e.type === 'text'));

    const foreign = await stop(stranger, run);
    assert.equal(foreign.status, 200);
    assert.deepEqual(((await foreign.json()) as { stopped: boolean }).stopped, false);
    const stopped = await stop(owner, run);
    assert.equal(((await stopped.json()) as { stopped: boolean }).stopped, true);

    const events = await reader;
    const done = events.at(-1);
    assert.ok(done?.type === 'done' && done.status === 'aborted');
    const conversationId = conversationOf(events);
    const saved = await prisma.assistantMessage.findFirst({ where: { conversationId, role: 'assistant' } });
    assert.equal(saved?.status, 'aborted');
    assert.ok(saved?.content.startsWith('Đoạn đầu.') && !saved.content.includes('Đoạn cuối.'));
    assert.equal(((await (await stop(owner, run)).json()) as { stopped: boolean }).stopped, false);
  });

  it('cuộc đang có lượt chạy: lượt thứ hai cùng cuộc bị 409, không lưu câu hỏi; xong rồi thì hỏi tiếp được', async () => {
    mockSlowGateway(['Xin chào.'], 10);
    const first = await readUntil(await post(owner, { message: 'Mở cuộc' }));
    const conversationId = conversationOf(first);

    mockSlowGateway(['Chậm một. ', 'Chậm hai.'], 80);
    const running = await post(owner, { conversationId, message: 'Hỏi lâu' });
    const run = running.headers.get('x-assistant-run-id')!;
    const reading = readUntil(running);
    await waitFor(() => findAssistantRun(owner.id, run)?.conversationId === conversationId);

    const before = await prisma.assistantMessage.count({ where: { conversationId } });
    const second = await post(owner, { conversationId, message: 'Hỏi chen' });
    assert.equal(second.status, 409);
    assert.match(await second.text(), /RUN_IN_PROGRESS/);
    assert.equal(await prisma.assistantMessage.count({ where: { conversationId } }), before);

    await reading;
    const after = await post(owner, { conversationId, message: 'Hỏi tiếp' });
    assert.equal(after.status, 200);
    await readUntil(after);
  });

  it('xóa cuộc khi lượt đang chạy: lượt dừng, không ghi trả lời vào cuộc đã xóa', async () => {
    mockSlowGateway(['Mở. '], 10);
    const conversationId = conversationOf(await readUntil(await post(owner, { message: 'Cuộc sẽ xóa' })));
    mockSlowGateway(['Chậm một. ', 'Chậm hai. ', 'Chậm ba.'], 80);
    const res = await post(owner, { conversationId, message: 'Đang chạy thì xóa' });
    const run = res.headers.get('x-assistant-run-id')!;
    const reading = readUntil(res);
    await waitFor(() => findAssistantRun(owner.id, run)?.conversationId === conversationId);
    const deleted = await deleteRoute(
      new NextRequest(`${ORIGIN}/api/assistant/conversations/${conversationId}`, { method: 'DELETE', headers: { cookie: cookieFor(owner), origin: ORIGIN } }),
      { params: Promise.resolve({ id: conversationId }) },
    );
    assert.equal(deleted.status, 200);
    await reading;
    assert.equal(findAssistantRun(owner.id, run)?.controller.signal.aborted, true);
    assert.equal(await prisma.assistantMessage.count({ where: { conversationId } }), 0);
  });

  it('hoạt động của các chip: cuộc đang chạy, mốc tin mới nhất; cuộc người khác bị bỏ; danh sách sai thì 400', async () => {
    const activity = async (user: User, ids: string) => {
      const res = await activityRoute(new NextRequest(`${ORIGIN}/api/assistant/runs?ids=${ids}`, { headers: { cookie: cookieFor(user) } }));
      return { status: res.status, body: res.ok ? ((await res.json()) as { items: Array<{ id: string; running: boolean; lastMessageAt: string }> }) : null };
    };
    mockSlowGateway(['Mở. '], 10);
    const idle = conversationOf(await readUntil(await post(owner, { message: 'Cuộc rảnh' })));
    mockSlowGateway(['Chậm một. ', 'Chậm hai.'], 80);
    const res = await post(owner, { message: 'Cuộc đang chạy' });
    const run = res.headers.get('x-assistant-run-id')!;
    const reading = readUntil(res);
    await waitFor(() => Boolean(findAssistantRun(owner.id, run)?.conversationId));
    const busy = findAssistantRun(owner.id, run)!.conversationId!;
    convIds.push(busy);

    const during = await activity(owner, `${idle},${busy},khong-co-${runId}`);
    assert.equal(during.status, 200);
    const byId = new Map(during.body!.items.map((item) => [item.id, item]));
    assert.deepEqual([...byId.keys()].sort(), [idle, busy].sort(), 'mã không có thì bỏ');
    assert.equal(byId.get(busy)?.running, true);
    assert.equal(byId.get(idle)?.running, false);
    const before = byId.get(busy)!.lastMessageAt;

    await reading;
    const after = (await activity(owner, busy)).body!.items[0];
    assert.equal(after.running, false);
    assert.ok(after.lastMessageAt > before, 'trả lời xong thì mốc tin mới hơn (chip có chấm)');

    assert.deepEqual((await activity(stranger, busy)).body?.items, [], 'cuộc người khác không lộ');
    assert.equal((await activity(owner, '')).status, 400);
    assert.equal((await activity(owner, Array.from({ length: 11 }, (_, i) => `c${i}`).join(','))).status, 400);
  });
});
