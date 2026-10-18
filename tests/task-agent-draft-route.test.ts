/**
 * POST /api/tasks/agent-draft: model chọn ở ô soạn (danh sách chung với Trợ lý) và tệp đính kèm qua multipart.
 * Gateway giả, không ghi gì ngoài người dùng thử trong qcet_test.
 */
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
import { parseTaskAgentStreamEvent, type TaskAgentStreamEvent } from '@qcet/shared/domain/tasks/task-agent-stream';
import { POST as draftRoute } from '@/app/api/tasks/agent-draft/route';

const runId = crypto.randomBytes(4).toString('hex');
const ORIGIN = 'http://localhost:3000';
const realFetch = globalThis.fetch;
const GATEWAY_ENV = {
  TASK_AGENT_BASE_URL: 'http://gateway.test/v1',
  TASK_AGENT_API_KEY: `test-key-${runId}`,
  TASK_AGENT_MODEL: 'test-model',
  TASK_AGENT_MODELS: 'second-model',
  TASK_AGENT_THINKING_BUDGET: undefined,
} as const;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const BASE_BODY = { messages: [{ role: 'user', content: 'Soạn nhiệm vụ họp giao ban' }], departmentName: 'Phòng Đào tạo', personnel: [], draft: {} };

interface SentBody {
  model?: string;
  messages: Array<{ role: string; content: unknown }>;
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

/** Gateway giả trả SSE một khối JSON nháp. Ghi lại body đã gửi. */
function mockGateway(sent: SentBody[]): void {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)) as SentBody);
    const content = JSON.stringify({ reply: 'Đã soạn.', draft: { title: 'Họp giao ban' } });
    const lines = [
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`,
      'data: [DONE]\n\n',
    ];
    return new Response(lines.join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
}

function jsonRequest(cookie: string, body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}/api/tasks/agent-draft`, {
    method: 'POST',
    headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(cookie: string, payload: unknown, files: Array<{ name: string; bytes: Buffer }>): NextRequest {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  for (const file of files) form.append('files', new File([new Uint8Array(file.bytes)], file.name));
  return new NextRequest(`${ORIGIN}/api/tasks/agent-draft`, { method: 'POST', headers: { cookie, origin: ORIGIN }, body: form });
}

async function readEvents(res: Response): Promise<TaskAgentStreamEvent[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const event = parseTaskAgentStreamEvent(line);
      assert.ok(event, `dòng NDJSON hỏng: ${line.slice(0, 80)}`);
      return event;
    });
}

describe('POST /api/tasks/agent-draft', () => {
  let user: User;
  let cookie: string;

  before(async () => {
    user = await prisma.user.create({
      data: { email: `agent-draft-route-${runId}@qcet.edu.vn`, name: `Agent tuyến ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
    });
    const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    cookie = `${SESSION_COOKIE_NAME}=${token}`;
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    globalThis.fetch = realFetch;
    resetFeatureFlagOverrides();
  });

  beforeEach(() => {
    resetRateLimits();
    setFeatureFlagOverride('taskAgent', true);
    globalThis.fetch = realFetch;
  });

  it('thiếu cấu hình gateway: 503 trước khi trừ lượt gọi và trước khi đọc tệp, như Trợ lý', async () => {
    await withEnv({ ...GATEWAY_ENV, TASK_AGENT_MODEL: undefined }, async () => {
      // AI_DRAFT cho 10 lượt mỗi phút: lượt 11 vẫn 503 (không phải 429) nghĩa là chưa trừ lượt
      for (let i = 0; i < 11; i += 1) {
        const res = await draftRoute(jsonRequest(cookie, BASE_BODY));
        assert.equal(res.status, 503, `lượt ${i + 1}`);
        assert.match(await res.text(), /AGENT_NOT_CONFIGURED/);
      }
    });
  });

  it('model ngoài danh sách: 400 MODEL_NOT_ALLOWED, không gọi gateway', async () => {
    const sent: SentBody[] = [];
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent);
      const res = await draftRoute(jsonRequest(cookie, { ...BASE_BODY, model: 'other-model' }));
      assert.equal(res.status, 400);
      assert.match(await res.text(), /MODEL_NOT_ALLOWED/);
    });
    assert.equal(sent.length, 0);
  });

  it('model trong danh sách: gateway nhận đúng model; không gửi model thì dùng TASK_AGENT_MODEL', async () => {
    const sent: SentBody[] = [];
    await withEnv(GATEWAY_ENV, async () => {
      for (const model of ['second-model', undefined]) {
        mockGateway(sent);
        const res = await draftRoute(jsonRequest(cookie, { ...BASE_BODY, ...(model ? { model } : {}) }));
        assert.equal(res.status, 200);
        const events = await readEvents(res);
        const result = events.find((e) => e.type === 'result');
        assert.equal(result?.type === 'result' && result.data.draft?.title, 'Họp giao ban');
      }
    });
    assert.deepEqual(sent.map((body) => body.model), ['second-model', 'test-model']);
  });

  it('multipart qua helper chung: ảnh gắn vào đúng tin, kèm model; số tệp không khớp danh sách thì 400', async () => {
    const sent: SentBody[] = [];
    await withEnv(GATEWAY_ENV, async () => {
      mockGateway(sent);
      const res = await draftRoute(
        formRequest(cookie, { ...BASE_BODY, attachments: [{ messageIndex: 0 }], model: 'second-model' }, [{ name: 'so-do.png', bytes: PNG }]),
      );
      assert.equal(res.status, 200);
      const events = await readEvents(res);
      assert.deepEqual(events.filter((e) => e.type === 'step'), [{ type: 'step', label: 'Xem ảnh so-do.png' }]);

      const mismatch = await draftRoute(formRequest(cookie, { ...BASE_BODY, attachments: [] }, [{ name: 'so-do.png', bytes: PNG }]));
      assert.equal(mismatch.status, 400);
      assert.match(await mismatch.text(), /Số tệp không khớp/);
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].model, 'second-model');
    const question = sent[0].messages.find((m) => m.role === 'user' && Array.isArray(m.content));
    assert.ok(
      Array.isArray(question?.content) && question.content.some((part: { type?: string }) => part.type === 'image_url'),
      'ảnh gửi gateway dạng image_url',
    );
  });
});
