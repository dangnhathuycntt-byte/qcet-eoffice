import { describe, it, before, after } from 'node:test';
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

import type { User } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { AuditAction } from '@qcet/db/audit';
import { ApiError } from '@/server/api/errors';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import type { GatewayCompletion, GatewayConfig, GatewayMessage, GatewayToolDefinition, GatewayCallOptions, callGateway } from '@/server/services/agent-gateway';
import { runAssistantTurn, ASSISTANT_LIMITS, type AssistantTurnDeps, type AssistantTurnInput } from '@/server/assistant/assistant-service';
import { RESTRICTED_MESSAGE, ToolFailure } from '@/server/assistant/assistant-tool-shared';
import type { AssistantSourceRef, AssistantStreamEvent } from '@qcet/contracts/assistant';

const runId = crypto.randomBytes(4).toString('hex');
/** Thời điểm cố định: 10:00 ICT thứ Bảy 17/10/2026. */
const NOW = new Date('2026-10-17T10:00:00+07:00');
const CONFIG: GatewayConfig = { baseUrl: 'http://gateway.invalid', apiKey: 'test-key', model: 'test-model', thinkingBudget: null };
/** Nội dung thay thế khi hết ngân sách ký tự công cụ (khớp TOOL_BUDGET_CONTENT của dịch vụ). */
const BUDGET_NOTE = '{"error":"Đã đọc đủ dữ liệu cho lượt này, hãy trả lời với dữ liệu đã có."}';
const TOOL_DEFS: GatewayToolDefinition[] = [
  { type: 'function', function: { name: 'list_tasks', description: 'Liệt kê nhiệm vụ', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
];
const TASK_SOURCE: AssistantSourceRef = {
  type: 'task',
  id: `task-${runId}`,
  code: 'NV-2026-10-001',
  title: 'Chuẩn bị hội nghị',
  href: `/tasks/task-${runId}`,
};

type GatewayScript = (messages: GatewayMessage[], options: GatewayCallOptions | undefined) => GatewayCompletion | Promise<GatewayCompletion>;

interface GatewayCall {
  messages: GatewayMessage[];
  tools: GatewayToolDefinition[] | undefined;
  subject: string | undefined;
  timeoutMs: number | undefined;
  outputTokens: number | undefined;
}

/**
 * Gateway giả: mỗi lần gọi lấy kịch bản tiếp theo và ghi lại đầu vào để kiểm tra.
 * Như gateway thật, chữ trả lời của kịch bản được phát qua onContent nếu kịch bản không tự phát.
 */
function scriptedGateway(scripts: GatewayScript[]) {
  const calls: GatewayCall[] = [];
  let next = 0;
  const fn = (async (messages: GatewayMessage[], options?: GatewayCallOptions) => {
    calls.push({ messages: [...messages], tools: options?.tools, subject: options?.subject, timeoutMs: options?.timeoutMs, outputTokens: options?.outputTokens });
    const script = scripts[next++];
    if (!script) throw new Error('Gateway được gọi nhiều hơn kịch bản');
    let streamed = false;
    const wrapped: GatewayCallOptions | undefined = options && {
      ...options,
      onContent: (delta: string) => {
        streamed = true;
        options.onContent?.(delta);
      },
    };
    const result = await script(messages, wrapped);
    if (!streamed && result.content) options?.onContent?.(result.content);
    return result;
  }) as typeof callGateway;
  return { fn, calls };
}

const completion = (content: string, toolCalls: GatewayCompletion['toolCalls'] = [], finishReason = 'stop'): GatewayCompletion => ({
  content,
  thinking: '',
  toolCalls,
  finishReason,
});

const toolOk = (content = '{"total":1,"tasks":[]}') => ({
  ok: true,
  content,
  step: { tool: 'list_tasks' as const, label: 'Xem việc của Thầy/Cô', count: 1, ok: true },
  sources: [] as AssistantSourceRef[],
  detailed: false,
});

const userIds: string[] = [];
let user: User;
let otherUser: User;
const convIds: string[] = [];

function authzFor(u: User): AuthorizationContext {
  return {
    userId: u.id,
    user: { id: u.id, email: u.email, name: u.name, isActive: true },
    positions: [{ positionTitle: 'Chuyên viên', unitName: 'Phòng Đào tạo' }],
  } as unknown as AuthorizationContext;
}

function textsOf(events: AssistantStreamEvent[]): string {
  return events.map((e) => (e.type === 'text' ? e.delta : '')).join('');
}

/** Chạy một lượt với deps giả; trả về toàn bộ sự kiện và gateway giả để kiểm tra. */
async function runTurn(
  scripts: GatewayScript[],
  overrides: Partial<AssistantTurnInput> = {},
  extraDeps: Partial<AssistantTurnDeps> = {},
  signal?: AbortSignal,
  timeouts?: { turnTimeoutMs?: number; roundTimeoutMs?: number; titleGraceMs?: number },
) {
  const gateway = scriptedGateway(scripts);
  const events: AssistantStreamEvent[] = [];
  const target = overrides.userId ? (overrides.userId === otherUser.id ? otherUser : user) : user;
  await runAssistantTurn(
    {
      userId: target.id,
      authz: authzFor(target),
      message: 'Hôm nay có việc gì cần làm?',
      requestId: `req-${runId}`,
      now: NOW,
      ...overrides,
    },
    (event) => events.push(event),
    {
      signal,
      timeouts,
      deps: {
        callGateway: gateway.fn,
        readConfig: () => CONFIG,
        runTool: async () => toolOk(),
        toolDefinitions: TOOL_DEFS,
        describeContext: async () => null,
        ...extraDeps,
      },
    },
  );
  const conversationEvent = events.find((e) => e.type === 'conversation');
  if (conversationEvent && conversationEvent.type === 'conversation') convIds.push(conversationEvent.conversation.id);
  return { events, gateway };
}

function assistantRowsOf(conversationId: string) {
  return prisma.assistantMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
}

describe('Trợ lý: vòng hội thoại (service, deps giả)', () => {
  before(async () => {
    user = await prisma.user.create({
      data: { email: `assistant-svc-${runId}@qcet.edu.vn`, name: `Trợ lý dịch vụ ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
    });
    otherUser = await prisma.user.create({
      data: { email: `assistant-svc-other-${runId}@qcet.edu.vn`, name: `Người khác ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
    });
    userIds.push(user.id, otherUser.id);
  });

  after(async () => {
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: convIds } } });
    await prisma.assistantConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('một vòng không công cụ: phát conversation, text, sources, done và lưu hai tin', async () => {
    const { events, gateway } = await runTurn([
      (_messages, options) => {
        options?.onContent?.('Xin ');
        options?.onContent?.('chào');
        return completion('Xin chào');
      },
    ]);

    assert.deepEqual(
      events.map((e) => e.type),
      ['conversation', 'text', 'text', 'sources', 'done'],
    );
    const done = events[events.length - 1];
    assert.equal(done.type, 'done');
    assert.equal(done.type === 'done' && done.status, 'complete');

    const conversationId = convIds[convIds.length - 1];
    const rows = await assistantRowsOf(conversationId);
    assert.deepEqual(rows.map((r) => [r.role, r.status, r.content]), [
      ['user', 'complete', 'Hôm nay có việc gì cần làm?'],
      ['assistant', 'complete', 'Xin chào'],
    ]);
    // Vòng đầu (không phải vòng cuối) có kèm công cụ, và gọi với nhãn Trợ lý, thời gian không vượt giới hạn một vòng
    assert.equal(gateway.calls.length, 1);
    assert.deepEqual(gateway.calls[0].tools, TOOL_DEFS);
    assert.equal(gateway.calls[0].subject, 'Trợ lý');
    assert.ok((gateway.calls[0].timeoutMs ?? 0) <= ASSISTANT_LIMITS.roundTimeoutMs);
  });

  it('prompt gửi cho mô hình có khung ngày theo ICT và người hỏi; tin hỏi chỉ xuất hiện một lần', async () => {
    const { gateway } = await runTurn([() => completion('Đã rõ.')]);
    const [system, ...rest] = gateway.calls[0].messages;
    assert.equal(system.role, 'system');
    assert.match(String(system.content), /Bạn là Trợ lý QCET/);
    assert.match(String(system.content), /Hôm nay: Thứ Bảy, 17\/10\/2026\./);
    assert.match(String(system.content), /Người hỏi: Trợ lý dịch vụ/);
    const userTurns = rest.filter((m) => m.role === 'user' && m.content === 'Hôm nay có việc gì cần làm?');
    assert.equal(userTurns.length, 1);
  });

  it('hai vòng có công cụ: tin tool nhận đúng tool_call_id, extra_content được gửi lại; chữ hai vòng nối bằng đoạn trống', async () => {
    const sig = { google: { thought_signature: `sig-${runId}` } };
    const { events, gateway } = await runTurn(
      [
        (_m, options) => {
          options?.onContent?.('Để tôi tra cứu. ');
          return completion('Để tôi tra cứu. ', [{ id: 'call_a', name: 'list_tasks', arguments: '{}', extraContent: sig }], 'tool_calls');
        },
        (_m, options) => {
          options?.onContent?.('Có NV-2026-10-001 cần xử lý.');
          return completion('Có NV-2026-10-001 cần xử lý.');
        },
      ],
      {},
      {
        runTool: async () => ({
          ...toolOk(),
          sources: [TASK_SOURCE],
          detailed: false,
        }),
      },
    );

    const second = gateway.calls[1].messages;
    const assistantToolMsg = second.find((m) => m.role === 'assistant' && 'tool_calls' in m && m.tool_calls);
    assert.ok(assistantToolMsg && assistantToolMsg.role === 'assistant');
    assert.equal(assistantToolMsg.tool_calls?.[0].id, 'call_a');
    assert.deepEqual(assistantToolMsg.tool_calls?.[0].extra_content, sig);
    const toolMsg = second.find((m) => m.role === 'tool');
    assert.deepEqual(toolMsg, { role: 'tool', tool_call_id: 'call_a', content: '{"total":1,"tasks":[]}' });
    // Vòng hai vẫn còn công cụ (chưa tới vòng cuối)
    assert.deepEqual(gateway.calls[1].tools, TOOL_DEFS);

    // Chữ streamed phải khớp đúng nội dung đã lưu
    const stored = await assistantRowsOf(convIds[convIds.length - 1]);
    const savedAnswer = stored.find((r) => r.role === 'assistant')?.content;
    assert.equal(savedAnswer, 'Để tôi tra cứu. \n\nCó NV-2026-10-001 cần xử lý.');
    assert.equal(textsOf(events), savedAnswer);
    const sourcesEvent = events.find((e) => e.type === 'sources');
    assert.deepEqual(sourcesEvent, { type: 'sources', sources: [TASK_SOURCE] });
  });

  it('tool call không có id: đặt call_<vòng>_<thứ tự> cho cả tin assistant lẫn tin tool', async () => {
    const { gateway } = await runTurn([
      () => completion('', [{ id: '', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
      () => completion('Xong.'),
    ]);
    const second = gateway.calls[1].messages;
    const assistantMsg = second.find((m) => m.role === 'assistant' && 'tool_calls' in m && m.tool_calls);
    assert.ok(assistantMsg && assistantMsg.role === 'assistant');
    assert.equal(assistantMsg.tool_calls?.[0].id, 'call_1_1');
    assert.equal(assistantMsg.content, null);
    assert.equal(second.find((m) => m.role === 'tool')?.tool_call_id, 'call_1_1');
  });

  it('hai tool call trùng id trong một vòng: id thứ hai đặt lại thành <id>_<thứ tự>, tin assistant và tin tool khớp nhau', async () => {
    const { gateway } = await runTurn([
      () =>
        completion(
          '',
          [
            { id: 'call_1', name: 'list_tasks', arguments: '{}' },
            { id: 'call_1', name: 'list_tasks', arguments: '{"view":"unit"}' },
          ],
          'tool_calls',
        ),
      () => completion('Xong.'),
    ]);
    const second = gateway.calls[1].messages;
    const assistantMsg = second.find((m) => m.role === 'assistant' && 'tool_calls' in m && m.tool_calls);
    assert.ok(assistantMsg && assistantMsg.role === 'assistant');
    const assistantIds = (assistantMsg.tool_calls ?? []).map((call) => call.id);
    assert.deepEqual(assistantIds, ['call_1', 'call_1_2']);
    const toolIds = second.flatMap((m) => (m.role === 'tool' ? [m.tool_call_id] : []));
    assert.deepEqual(toolIds, assistantIds);
  });

  it('finish_reason tool_calls nhưng không có tool call thì kết thúc lượt, không lặp', async () => {
    const { events, gateway } = await runTurn([() => completion('Trả lời ngay.', [], 'tool_calls')]);
    assert.equal(gateway.calls.length, 1);
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'complete');
  });

  it('chạm maxRounds: các vòng trước có công cụ, vòng cuối không kèm tools', async () => {
    const rounds = ASSISTANT_LIMITS.maxRounds;
    const scripts: GatewayScript[] = Array.from({ length: rounds - 1 }, (_, i) => () =>
      completion('', [{ id: `c${i}`, name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
    );
    scripts.push(() => completion('Kết luận cuối.'));
    let toolRuns = 0;
    const { gateway, events } = await runTurn(scripts, {}, {
      runTool: async () => {
        toolRuns += 1;
        return toolOk();
      },
    });
    assert.equal(gateway.calls.length, rounds);
    assert.equal(gateway.calls.slice(0, rounds - 1).every((c) => Array.isArray(c.tools) && c.tools.length > 0), true);
    assert.equal(gateway.calls[rounds - 1].tools, undefined);
    // Gateway chặn khi lịch sử còn tool call mà không khai báo tools: vòng cuối chỉ gửi chữ thuần
    const finalMessages = gateway.calls[rounds - 1].messages;
    assert.equal(finalMessages.some((m) => m.role === 'tool'), false);
    assert.equal(finalMessages.some((m) => m.role === 'assistant' && 'tool_calls' in m && m.tool_calls?.length), false);
    assert.ok(finalMessages.some((m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('<ket_qua_cong_cu>')));
    const last = finalMessages[finalMessages.length - 1];
    assert.equal(last.role, 'user');
    assert.ok(typeof last.content === 'string' && last.content.startsWith('Không đọc thêm dữ liệu nữa.'));
    assert.equal(toolRuns, rounds - 1);
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'complete');
  });

  it('mô hình gọi công cụ không khai báo (gateway chặn) ở vòng giữa: chuyển sang vòng chữ thuần và vẫn trả lời', async () => {
    let toolRuns = 0;
    const { gateway, events } = await runTurn(
      [
        () => completion('', [{ id: 'c1', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
        () => {
          throw new ApiError(502, 'AGENT_TOOL_CONTRACT', 'Trợ lý trả lỗi (502). Thầy/Cô thử lại sau.');
        },
        () => completion('Có một việc.'),
      ],
      {},
      {
        runTool: async () => {
          toolRuns += 1;
          return toolOk();
        },
      },
    );
    assert.equal(gateway.calls.length, 3);
    assert.equal(gateway.calls[2].tools, undefined);
    assert.equal(gateway.calls[2].messages.some((m) => m.role === 'tool'), false);
    assert.equal(toolRuns, 1);
    assert.equal(events.some((e) => e.type === 'error'), false);
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'complete');
    const reply = (await assistantRowsOf(convIds[convIds.length - 1])).find((r) => r.role === 'assistant');
    assert.equal(reply?.content, 'Có một việc.');
  });

  it('gateway vẫn chặn ở chính vòng chữ thuần: báo lỗi, không lặp vô hạn', async () => {
    const contract = () => {
      throw new ApiError(502, 'AGENT_TOOL_CONTRACT', 'Trợ lý trả lỗi (502). Thầy/Cô thử lại sau.');
    };
    const { gateway, events } = await runTurn([contract, contract, contract]);
    assert.equal(gateway.calls.length, 2);
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_TOOL_CONTRACT');
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'error');
  });

  it('nhiều hơn 4 tool call trong một vòng: 4 cái chạy, cái thừa nhận thông báo "Quá nhiều công cụ"', async () => {
    const calls = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, name: 'list_tasks', arguments: '{}' }));
    let toolRuns = 0;
    const { gateway, events } = await runTurn(
      [() => completion('', calls, 'tool_calls'), () => completion('Đã đọc.')],
      {},
      {
        runTool: async () => {
          toolRuns += 1;
          return toolOk();
        },
      },
    );
    assert.equal(toolRuns, 4);
    assert.equal(events.filter((e) => e.type === 'step').length, 4);
    const tools = gateway.calls[1].messages.filter((m) => m.role === 'tool');
    assert.equal(tools.length, 5);
    assert.deepEqual(tools[4], {
      role: 'tool',
      tool_call_id: 'x4',
      content: '{"error":"Quá nhiều công cụ trong một lượt, hãy gọi ít hơn."}',
    });
  });

  it('vượt ngân sách ký tự công cụ: vòng sau không chạy công cụ nữa và nhận thông báo đã đủ dữ liệu', async () => {
    const big = toolOk('x'.repeat(13_000));
    let toolRuns = 0;
    const { gateway } = await runTurn(
      [
        () => completion('', [{ id: 'b1', name: 'list_tasks', arguments: '{}' }, { id: 'b2', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
        () => completion('', [{ id: 'b3', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
        () => completion('Tổng hợp.'),
      ],
      {},
      {
        runTool: async () => {
          toolRuns += 1;
          return big;
        },
      },
    );
    assert.equal(toolRuns, 2);
    // Vòng hai chạy công cụ (b1, b2 đã hết ngân sách sau vòng này); tin của b3 nằm ở lượt gọi thứ ba
    const budgetMsg = gateway.calls[2].messages.find((m) => m.role === 'tool' && m.tool_call_id === 'b3');
    assert.deepEqual(budgetMsg, {
      role: 'tool',
      tool_call_id: 'b3',
      content: '{"error":"Đã đọc đủ dữ liệu cho lượt này, hãy trả lời với dữ liệu đã có."}',
    });
  });

  it('ngân sách cả lượt tính trong một vòng: kết quả vượt phần còn lại bị thay, không thêm nguồn của nó, không đếm bước', async () => {
    const OTHER_SOURCE: AssistantSourceRef = { type: 'task', id: `task-khac-${runId}`, code: 'NV-KHAC', title: 'Việc khác', href: `/tasks/khac-${runId}` };
    let toolRuns = 0;
    const { events, gateway } = await runTurn(
      [
        () => completion('', [{ id: 'd1', name: 'list_tasks', arguments: '{}' }, { id: 'd2', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
        () => completion('', [{ id: 'd3', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
        () => completion('Tổng hợp.'),
      ],
      {},
      {
        runTool: async () => {
          toolRuns += 1;
          // Kết quả đầu 13.000 ký tự; kết quả thứ hai vượt trần nên bị loại, nguồn của nó không được ghi nhận
          return toolRuns === 1 ? { ...toolOk('x'.repeat(13_000)), sources: [TASK_SOURCE] } : { ...toolOk('y'.repeat(13_000)), sources: [OTHER_SOURCE] };
        },
      },
    );
    assert.equal(toolRuns, 2);
    assert.equal(events.filter((e) => e.type === 'step').length, 1);
    const round2 = gateway.calls[1].messages.filter((m) => m.role === 'tool');
    assert.equal(round2.find((m) => m.tool_call_id === 'd2')?.content, BUDGET_NOTE);
    assert.equal(gateway.calls[2].messages.find((m) => m.role === 'tool' && m.tool_call_id === 'd3')?.content, BUDGET_NOTE);
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: convIds[convIds.length - 1], action: AuditAction.ASSISTANT_TURN },
    });
    const refs = (audit?.metadata as { refs: Array<{ id: string }> } | null)?.refs ?? [];
    assert.deepEqual(refs.map((r) => r.id), [TASK_SOURCE.id]);
  });

  it('ba công cụ 6.000 ký tự rồi bốn công cụ nữa: kết quả gửi cho mô hình trong cả lượt không vượt 24.000 ký tự', async () => {
    const calls = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: 'list_tasks', arguments: '{}' }));
    const { events, gateway } = await runTurn(
      [
        () => completion('', calls('p', 3), 'tool_calls'),
        () => completion('', calls('q', 4), 'tool_calls'),
        () => completion('Tổng hợp.'),
      ],
      {},
      { runTool: async () => toolOk('x'.repeat(6_000)) },
    );
    // Chỉ tính kết quả thật; thông báo thay thế ngắn và không tính vào trần
    const sent = gateway.calls[2].messages
      .filter((m) => m.role === 'tool' && m.content !== BUDGET_NOTE)
      .reduce((sum, m) => sum + (m.role === 'tool' ? m.content.length : 0), 0);
    assert.ok(sent <= ASSISTANT_LIMITS.maxToolCharsPerTurn, `đã gửi ${sent} ký tự`);
    assert.equal(sent, ASSISTANT_LIMITS.maxToolCharsPerTurn);
    assert.equal(events.filter((e) => e.type === 'step').length, 4);
    assert.equal(gateway.calls[2].messages.filter((m) => m.role === 'tool' && m.content === BUDGET_NOTE).length, 3);
  });

  it('công cụ treo quá thời gian còn lại của lượt: bước thất bại, lượt vẫn kết thúc, lưu tin và ghi audit', { timeout: 5_000 }, async () => {
    // Công cụ không bao giờ trả về; gateway vòng sau báo lỗi khi lượt đã hủy, như gateway thật
    const hangingTool = () => new Promise<never>(() => {});
    const afterAbort: GatewayScript = (_messages, options) => {
      if (options?.signal?.aborted) throw new ApiError(502, 'AGENT_UNAVAILABLE', 'Chưa kết nối được tới Trợ lý. Thầy/Cô thử lại sau.');
      return completion('Không có dữ liệu.');
    };
    const { events } = await runTurn(
      [() => completion('', [{ id: 'h1', name: 'list_tasks', arguments: '{}' }], 'tool_calls'), afterAbort],
      {},
      { runTool: hangingTool },
      undefined,
      { turnTimeoutMs: 50 },
    );
    const step = events.find((e) => e.type === 'step');
    assert.deepEqual(step, { type: 'step', step: { tool: 'list_tasks', label: 'Đọc dữ liệu không thành công', count: null, ok: false } });
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_TIMEOUT');
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'error');
    const conversationId = convIds[convIds.length - 1];
    const reply = (await assistantRowsOf(conversationId)).find((r) => r.role === 'assistant');
    assert.equal(reply?.status, 'error');
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: conversationId, action: AuditAction.ASSISTANT_TURN } });
    assert.ok(audit, 'phải có bản ghi audit');
  });

  it('mô hình dừng vì hết độ dài ở vòng trả lời: giữ phần chữ, status error, báo AGENT_TRUNCATED', async () => {
    const { events } = await runTurn([() => completion('Đoạn trả lời bị', [], 'length')]);
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_TRUNCATED');
    assert.equal(errorEvent.error.message, 'Câu trả lời bị cắt vì quá dài. Thầy/Cô hỏi hẹp hơn để xem đủ.');
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'error');
    const reply = (await assistantRowsOf(convIds[convIds.length - 1])).find((r) => r.role === 'assistant');
    assert.equal(reply?.status, 'error');
    assert.equal(reply?.content, 'Đoạn trả lời bị');
  });

  it('lỗi sau khi có chữ mà chưa lưu được trả lời: ghi tin lỗi thay cho câu hỏi bỏ dở, lượt sau không gửi lại cặp đó', async () => {
    const events: AssistantStreamEvent[] = [];
    await runAssistantTurn(
      { userId: user.id, authz: authzFor(user), message: 'Câu hỏi bị bỏ dở', requestId: `req-${runId}`, now: NOW },
      (event) => {
        // Luồng đứt đúng lúc phát nguồn: chữ đã có, trả lời chưa lưu
        if (event.type === 'sources') throw new Error('luồng đứt');
        events.push(event);
      },
      {
        deps: {
          callGateway: scriptedGateway([() => completion('Trả lời dở')]).fn,
          readConfig: () => CONFIG,
          runTool: async () => toolOk(),
          toolDefinitions: TOOL_DEFS,
          describeContext: async () => null,
        },
      },
    );
    const conversationEvent = events.find((e) => e.type === 'conversation');
    assert.ok(conversationEvent && conversationEvent.type === 'conversation');
    const conversationId = conversationEvent.conversation.id;
    convIds.push(conversationId);
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_UNAVAILABLE');
    const rows = await assistantRowsOf(conversationId);
    assert.deepEqual(rows.map((r) => [r.role, r.status]), [
      ['user', 'complete'],
      ['assistant', 'error'],
    ]);
    assert.equal(errorEvent.messageId, rows[1].id);

    const next = await runTurn([() => completion('Tiếp tục.')], { conversationId, message: 'Câu hỏi tiếp' });
    const sent = next.gateway.calls[0].messages;
    assert.equal(sent.some((m) => m.role === 'user' && m.content === 'Câu hỏi bị bỏ dở'), false);
    assert.equal(sent.filter((m) => m.role === 'user' && m.content === 'Câu hỏi tiếp').length, 1);
  });

  it('client đã ngắt trước khi tạo cuộc: không tạo cuộc, không lưu tin, không gọi mô hình, không phát sự kiện', async () => {
    const before = await prisma.assistantConversation.count({ where: { userId: user.id } });
    const controller = new AbortController();
    controller.abort();
    const { events, gateway } = await runTurn([() => completion('Không được gọi')], { message: 'Ngắt sớm' }, {}, controller.signal);
    assert.deepEqual(events, []);
    assert.equal(gateway.calls.length, 0);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: user.id } }), before);
  });

  it('công cụ ném lỗi bất ngờ: bước thất bại, tin tool báo lỗi chung, lượt vẫn trả lời', async () => {
    const { events, gateway } = await runTurn(
      [() => completion('', [{ id: 'e1', name: 'get_task', arguments: '{}' }], 'tool_calls'), () => completion('Không đọc được dữ liệu.')],
      {},
      {
        runTool: async () => {
          throw new Error('kết nối CSDL bị đứt');
        },
      },
    );
    const step = events.find((e) => e.type === 'step');
    assert.deepEqual(step, {
      type: 'step',
      step: { tool: 'get_task', label: 'Đọc dữ liệu không thành công', count: null, ok: false },
    });
    assert.equal(gateway.calls[1].messages.find((m) => m.role === 'tool')?.content, '{"error":"Lỗi đọc dữ liệu, thử lại sau."}');
  });

  it('lỗi gateway (ApiError): tin lưu status error kèm phần chữ đã có, phát error có messageId rồi done', async () => {
    const { events } = await runTurn([
      (_m, options) => {
        options?.onContent?.('Đang ');
        throw new ApiError(502, 'AGENT_UNAVAILABLE', 'Trợ lý trả lỗi (500). Thầy/Cô thử lại sau.');
      },
    ]);
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_UNAVAILABLE');
    assert.equal(errorEvent.error.message, 'Trợ lý trả lỗi (500). Thầy/Cô thử lại sau.');
    const done = events[events.length - 1];
    assert.equal(done.type, 'done');
    assert.equal(done.type === 'done' && done.status, 'error');
    assert.ok(errorEvent.messageId);
    assert.equal(done.type === 'done' && done.messageId, errorEvent.messageId);

    const rows = await assistantRowsOf(convIds[convIds.length - 1]);
    const reply = rows.find((r) => r.role === 'assistant');
    assert.equal(reply?.status, 'error');
    assert.equal(reply?.content, 'Đang');
  });

  it('lỗi không phải ApiError từ gateway: thông báo chung, không lộ chi tiết lỗi', async () => {
    const { events } = await runTurn([() => {
      throw new TypeError('nội bộ: chi tiết không được lộ');
    }]);
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_UNAVAILABLE');
    assert.doesNotMatch(errorEvent.error.message, /nội bộ/);
  });

  it('hết giờ cả lượt: gateway treo tới khi bị hủy thì phát AGENT_TIMEOUT, lưu status error, vẫn phát done; timeout vòng không vượt phần còn lại', async () => {
    const hanging: GatewayScript = (_messages, options) =>
      new Promise<GatewayCompletion>((_resolve, reject) => {
        // Như gateway thật: khi lượt đã hủy thì báo 502; kiểm trạng thái đã hủy trước để không treo nếu hủy xảy ra sớm
        const fail = () => reject(new ApiError(502, 'AGENT_UNAVAILABLE', 'Chưa kết nối được tới Trợ lý. Thầy/Cô thử lại sau.'));
        if (options?.signal?.aborted) fail();
        else options?.signal?.addEventListener('abort', fail, { once: true });
      });
    const { events, gateway } = await runTurn([hanging], {}, {}, undefined, { turnTimeoutMs: 50 });

    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'AGENT_TIMEOUT');
    assert.equal(errorEvent.error.message, 'Trợ lý phản hồi quá lâu. Thầy/Cô thử lại sau ít phút.');
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'error');
    assert.ok((gateway.calls[0].timeoutMs ?? Infinity) <= 50, 'timeout của vòng không được vượt phần còn lại của lượt');

    const reply = (await assistantRowsOf(convIds[convIds.length - 1])).find((r) => r.role === 'assistant');
    assert.equal(reply?.status, 'error');
  });

  it('câu trả lời rỗng: phát một error có câu hướng dẫn, không chèn chữ, tin lưu status error', async () => {
    const { events } = await runTurn([() => completion('   ')]);
    // Câu hướng dẫn chỉ xuất hiện một lần (khung lỗi), không lặp thêm dưới dạng chữ trả lời
    const shown = events.map((e) => (e.type === 'text' ? e.delta : '')).join('');
    assert.equal(shown.trim(), '');
    const errorEvent = events.find((e) => e.type === 'error');
    assert.ok(errorEvent && errorEvent.type === 'error');
    assert.equal(errorEvent.error.code, 'EMPTY_ANSWER');
    assert.equal(errorEvent.error.message, 'Trợ lý chưa trả lời được câu này. Thầy/Cô thử hỏi lại cụ thể hơn.');
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'error');
    const reply = (await assistantRowsOf(convIds[convIds.length - 1])).find((r) => r.role === 'assistant');
    assert.equal(reply?.status, 'error');
    assert.equal(reply?.content, '');
  });

  it('hủy từ client: lưu status aborted với phần chữ đã có, không báo là lỗi gateway', async () => {
    const controller = new AbortController();
    const { events } = await runTurn(
      [
        (_m, options) => {
          options?.onContent?.('Đang trả');
          controller.abort();
          throw new ApiError(502, 'AGENT_UNAVAILABLE', 'Mất kết nối');
        },
      ],
      {},
      {},
      controller.signal,
    );
    assert.equal(events.some((e) => e.type === 'error'), false);
    const done = events[events.length - 1];
    assert.equal(done.type === 'done' && done.status, 'aborted');
    const rows = await assistantRowsOf(convIds[convIds.length - 1]);
    const reply = rows.find((r) => r.role === 'assistant');
    assert.equal(reply?.status, 'aborted');
    assert.equal(reply?.content, 'Đang trả');
  });

  it('cấu hình gateway thiếu: phát error với mã của cấu hình, không tạo cuộc trò chuyện', async () => {
    const before = await prisma.assistantConversation.count({ where: { userId: user.id } });
    const events: AssistantStreamEvent[] = [];
    await runAssistantTurn(
      { userId: user.id, authz: authzFor(user), message: 'Thử', requestId: `req-${runId}`, now: NOW },
      (event) => events.push(event),
      {
        deps: {
          callGateway: scriptedGateway([]).fn,
          readConfig: () => {
            throw new ApiError(503, 'AGENT_NOT_CONFIGURED', 'Trợ lý chưa được cấu hình trên máy chủ.');
          },
          runTool: async () => toolOk(),
          toolDefinitions: TOOL_DEFS,
          describeContext: async () => null,
        },
      },
    );
    assert.deepEqual(events, [{ type: 'error', error: { code: 'AGENT_NOT_CONFIGURED', message: 'Trợ lý chưa được cấu hình trên máy chủ.' } }]);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: user.id } }), before);
  });

  it('conversationId của người khác: NOT_FOUND, không gọi mô hình', async () => {
    // Người dùng gốc tạo cuộc; người khác thử hỏi tiếp trong cuộc đó
    await runTurn([() => completion('Lượt của chủ cuộc.')]);
    const owned = convIds[convIds.length - 1];
    const attempt = await runTurn([() => completion('Không được gọi')], { userId: otherUser.id, conversationId: owned });
    assert.deepEqual(attempt.events, [{ type: 'error', error: { code: 'NOT_FOUND', message: 'Không tìm thấy cuộc trò chuyện.' } }]);
    assert.equal(attempt.gateway.calls.length, 0);
    const rows = await assistantRowsOf(owned);
    assert.equal(rows.length, 2);
  });

  it('ngữ cảnh không đọc được khi mở cuộc mới: CONTEXT_FORBIDDEN và không tạo hội thoại', async () => {
    const before = await prisma.assistantConversation.count({ where: { userId: user.id } });
    const { events, gateway } = await runTurn([() => completion('Không được gọi')], { context: { type: 'task', id: `khong-co-${runId}` } }, {
      describeContext: async () => null,
    });
    assert.deepEqual(events, [
      { type: 'error', error: { code: 'CONTEXT_FORBIDDEN', message: 'Không tìm thấy hoặc Thầy/Cô không có quyền xem mục này.' } },
    ]);
    assert.equal(gateway.calls.length, 0);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: user.id } }), before);
  });

  it('ngữ cảnh là văn bản hạn chế (người hỏi đọc được): báo câu riêng thay vì "không có quyền", không tạo hội thoại', async () => {
    const before = await prisma.assistantConversation.count({ where: { userId: user.id } });
    const { events, gateway } = await runTurn([() => completion('Không được gọi')], { context: { type: 'document', id: `han-che-${runId}` } }, {
      describeContext: async () => {
        throw new ToolFailure(RESTRICTED_MESSAGE);
      },
    });
    assert.deepEqual(events, [{ type: 'error', error: { code: 'CONTEXT_FORBIDDEN', message: RESTRICTED_MESSAGE } }]);
    assert.notEqual(RESTRICTED_MESSAGE, 'Không tìm thấy hoặc Thầy/Cô không có quyền xem mục này.');
    assert.equal(gateway.calls.length, 0);
    assert.equal(await prisma.assistantConversation.count({ where: { userId: user.id } }), before);
  });

  it('client đã ngắt khi hỏi tiếp trong cuộc có sẵn: không ghi tin, không gọi mô hình', async () => {
    await runTurn([() => completion('Lượt đầu.')]);
    const owned = convIds[convIds.length - 1];
    const controller = new AbortController();
    controller.abort();
    const attempt = await runTurn([() => completion('Không được gọi')], { conversationId: owned }, {}, controller.signal);
    assert.deepEqual(attempt.events, []);
    assert.equal(attempt.gateway.calls.length, 0);
    assert.equal((await assistantRowsOf(owned)).length, 2);
  });

  it('ngữ cảnh đọc được khi mở cuộc mới: gắn vào cuộc, phát context, nêu trong prompt và nguồn lưu kèm', async () => {
    const summary = 'Trạng thái: Đang thực hiện. Hạn: 20/10/2026.';
    const { events, gateway } = await runTurn(
      [() => completion('Nhiệm vụ đang thực hiện.')],
      { context: { type: 'task', id: TASK_SOURCE.id } },
      { describeContext: async () => ({ source: TASK_SOURCE, summary }) },
    );
    assert.ok(events.some((e) => e.type === 'context' && e.source.id === TASK_SOURCE.id));
    const system = String(gateway.calls[0].messages[0].content);
    assert.match(system, /Người hỏi đang mở nhiệm vụ NV-2026-10-001 Chuẩn bị hội nghị\./);
    assert.match(system, /Trạng thái: Đang thực hiện/);
    const sources = events.find((e) => e.type === 'sources');
    assert.deepEqual(sources, { type: 'sources', sources: [TASK_SOURCE] });

    const conv = await prisma.assistantConversation.findUnique({ where: { id: convIds[convIds.length - 1] } });
    assert.equal(conv?.contextType, 'task');
    assert.equal(conv?.contextId, TASK_SOURCE.id);
  });

  it('cuộc có sẵn: ngữ cảnh lấy từ bản ghi, bỏ input.context; lượt sau nạp lịch sử và không lặp câu hỏi hiện tại', async () => {
    const created = await runTurn([() => completion('Lượt một.')], { message: 'Câu hỏi một' });
    const conversationId = convIds[convIds.length - 1];
    assert.ok(created.events.some((e) => e.type === 'done'));

    const second = await runTurn(
      [() => completion('Lượt hai.')],
      { conversationId, message: 'Câu hỏi hai', context: { type: 'document', id: 'bo-qua' } },
    );
    const sentMessages = second.gateway.calls[0].messages;
    const occurrences = sentMessages.filter((m) => m.role === 'user' && m.content === 'Câu hỏi hai');
    assert.equal(occurrences.length, 1);
    assert.ok(sentMessages.some((m) => m.role === 'assistant' && m.content === 'Lượt một.'));
    assert.ok(sentMessages.some((m) => m.role === 'user' && m.content === 'Câu hỏi một'));
    assert.equal(second.events.some((e) => e.type === 'context'), false);
    const conv = await prisma.assistantConversation.findUnique({ where: { id: conversationId } });
    assert.equal(conv?.contextType, null);
  });

  // Giới hạn cũ 3 thẻ mỗi lượt đổi theo yêu cầu 19/10/2026 (kế hoạch năm "vài chục cái nhiệm vụ"): mỗi lượt tối đa
  // ASSISTANT_LIMITS.maxProposalsPerTurn đề xuất, lời gọi đề xuất không tính vào trần công cụ mỗi vòng
  it('propose_task: phát proposal ngay sau bước, tối đa maxProposalsPerTurn thẻ mỗi lượt, thẻ lưu cùng tin trả lời, không vào audit', async () => {
    const { runAssistantTool } = await import('@/server/assistant/assistant-tools');
    const secret = `Chuẩn bị hội thảo ${runId}`;
    const max = ASSISTANT_LIMITS.maxProposalsPerTurn;
    assert.ok(max > ASSISTANT_LIMITS.maxToolCallsPerRound, 'kế hoạch nhiều đầu việc vượt trần công cụ mỗi vòng');
    const call = (n: number) => ({
      id: `p${n}`,
      name: 'propose_task',
      arguments: JSON.stringify({ title: `${secret} đợt ${n}`, dueDate: '2026-10-30', startDate: '2026-11-02', leadAssigneeName: 'chị Lan' }),
    });
    const { events, gateway } = await runTurn(
      [
        () => completion('', Array.from({ length: max + 1 }, (_, i) => call(i + 1)), 'tool_calls'),
        () => completion('Tôi đã soạn các đề xuất, Thầy/Cô bấm "Tạo tất cả" để xem lại và tạo.'),
      ],
      { message: 'Tạo các nhiệm vụ hội thảo theo kế hoạch' },
      { runTool: runAssistantTool },
    );

    // Mỗi vòng gọi gateway với phần trả lời đủ cho nhiều đề xuất
    assert.equal(gateway.calls[0].outputTokens, ASSISTANT_LIMITS.outputTokens);
    const proposals = events.flatMap((e) => (e.type === 'proposal' ? [e.proposal] : []));
    assert.equal(proposals.length, max);
    // Ngày bắt đầu sau hạn bị bỏ; tên người giữ đúng như người hỏi nêu (giao diện khớp với nhân sự)
    assert.deepEqual(proposals[0], { title: `${secret} đợt 1`, dueDate: '2026-10-30', leadAssigneeName: 'chị Lan' });
    // Mỗi thẻ đứng ngay sau bước của nó; lời gọi vượt giới hạn chỉ có bước lỗi
    const types = events.map((e) => e.type).filter((type) => type === 'step' || type === 'proposal');
    assert.deepEqual(types, [...Array.from({ length: max }, () => ['step', 'proposal']).flat(), 'step']);
    const steps = events.flatMap((e) => (e.type === 'step' ? [e.step] : []));
    assert.deepEqual(
      steps.map((step) => [step.tool, step.ok]),
      [...Array.from({ length: max }, () => ['propose_task', true]), ['propose_task', false]],
    );
    // Đề xuất vượt giới hạn: mô hình nhận lỗi giới hạn, không phải "đã soạn"; không lời gọi nào bị báo quá nhiều công cụ
    const toolMessages = gateway.calls[1].messages.filter((m) => m.role === 'tool');
    assert.equal(toolMessages.length, max + 1);
    assert.match(String(toolMessages[max].content), new RegExp(`tối đa ${max} đề xuất`));
    assert.match(String(toolMessages[0].content), /"created":false/);
    assert.equal(toolMessages.some((m) => String(m.content).includes('Quá nhiều công cụ')), false);

    const conversationId = convIds[convIds.length - 1];
    const rows = await assistantRowsOf(conversationId);
    const reply = rows[rows.length - 1];
    assert.equal(reply.content.includes('"proposal"'), false);
    assert.equal(JSON.stringify(reply.sources), '[]');
    // Thẻ lưu cột riêng để mở lại cuộc vẫn còn (như ChatGPT), chưa tạo, chưa bỏ qua; tin hỏi không có thẻ
    assert.deepEqual(reply.proposals, proposals.map((proposal) => ({ proposal, task: null, dismissed: false })));
    assert.equal(rows[0].proposals, null);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: conversationId, action: AuditAction.ASSISTANT_TURN } });
    assert.ok(audit);
    assert.equal(JSON.stringify(audit.metadata).includes(secret), false, 'audit không ghi tiêu đề đề xuất');
  });

  it('vòng có cả đọc dữ liệu lẫn đề xuất: đọc vẫn tối đa maxToolCallsPerRound, đề xuất chạy hết và không ăn ngân sách đọc', async () => {
    const { runAssistantTool } = await import('@/server/assistant/assistant-tools');
    const reads = Array.from({ length: ASSISTANT_LIMITS.maxToolCallsPerRound + 1 }, (_, i) => ({ id: `r${i}`, name: 'list_tasks', arguments: '{}' }));
    const proposalCalls = [1, 2].map((n) => ({ id: `q${n}`, name: 'propose_task', arguments: JSON.stringify({ title: `Rà soát hồ sơ đợt ${n} ${runId}` }) }));
    // Một kết quả đọc dùng hết ngân sách của lượt: đề xuất sau đó vẫn soạn được
    const bigRead = { ...toolOk(`{"total":1,"tasks":[],"pad":"${'x'.repeat(ASSISTANT_LIMITS.maxToolCharsPerTurn)}"}`) };
    let readRuns = 0;
    const runTool = (async (name: string, rawArgs: string, ctx: Parameters<typeof runAssistantTool>[2]) => {
      if (name === 'propose_task') return runAssistantTool(name, rawArgs, ctx);
      readRuns += 1;
      return readRuns === 1 ? bigRead : toolOk();
    }) as typeof runAssistantTool;
    const { events, gateway } = await runTurn(
      [() => completion('', [...reads, ...proposalCalls], 'tool_calls'), () => completion('Đã soạn hai đề xuất.')],
      { message: 'Xem việc rồi soạn hai nhiệm vụ rà soát' },
      { runTool },
    );
    assert.equal(readRuns, ASSISTANT_LIMITS.maxToolCallsPerRound);
    assert.equal(events.filter((e) => e.type === 'proposal').length, 2);
    const toolMessages = gateway.calls[1].messages.filter((m) => m.role === 'tool');
    const byId = new Map(toolMessages.map((m) => [m.tool_call_id, String(m.content)]));
    assert.match(byId.get(`r${ASSISTANT_LIMITS.maxToolCallsPerRound}`) ?? '', /Quá nhiều công cụ/);
    for (const call of proposalCalls) assert.match(byId.get(call.id) ?? '', /"created":false/);
  });

  it('cuộc mới: mô hình đặt tên song song, phát title trước done và ghi vào CSDL; cuộc cũ không đặt lại', async () => {
    const titled: Array<{ message: string; context: string | null; attachments: string[] }> = [];
    const generateTitle: AssistantTurnDeps['generateTitle'] = async (input) => {
      titled.push(input);
      return 'Việc cần làm hôm nay';
    };
    const { events } = await runTurn([() => completion('Hôm nay Thầy/Cô có hai việc.')], {}, { generateTitle });
    const conversationId = convIds[convIds.length - 1];
    assert.deepEqual(titled, [{ message: 'Hôm nay có việc gì cần làm?', context: null, attachments: [] }]);
    const order = events.map((e) => e.type);
    assert.ok(order.indexOf('title') > order.indexOf('conversation') && order.indexOf('title') < order.indexOf('done'), order.join(','));
    const titleEvent = events.find((e) => e.type === 'title');
    assert.ok(titleEvent && titleEvent.type === 'title');
    assert.equal(titleEvent.conversation.id, conversationId);
    assert.equal(titleEvent.conversation.title, 'Việc cần làm hôm nay');
    const row = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conversationId } });
    assert.equal(row.title, 'Việc cần làm hôm nay');
    assert.equal(row.titleEdited, false);

    // Lượt sau của cùng cuộc: không đặt tên lại
    const next = await runTurn([() => completion('Còn một việc nữa.')], { conversationId }, { generateTitle });
    assert.equal(titled.length, 1);
    assert.equal(next.events.some((e) => e.type === 'title'), false);
  });

  it('đặt tên lỗi hay trả rỗng thì giữ tên lấy từ câu hỏi; chậm quá thời gian chờ thì không báo nhưng vẫn ghi', async () => {
    const failed = await runTurn([() => completion('Trả lời.')], { message: 'Văn bản đến tuần này' }, {
      generateTitle: async () => {
        throw new Error('gateway lỗi');
      },
    });
    assert.equal(failed.events.some((e) => e.type === 'title'), false);
    assert.equal(failed.events.at(-1)?.type, 'done');
    const failedId = convIds[convIds.length - 1];
    assert.equal((await prisma.assistantConversation.findUniqueOrThrow({ where: { id: failedId } })).title, 'Văn bản đến tuần này');

    const empty = await runTurn([() => completion('Trả lời.')], { message: 'Lịch họp tuần này' }, { generateTitle: async () => null });
    assert.equal(empty.events.some((e) => e.type === 'title'), false);

    let release: () => void = () => undefined;
    const late = new Promise<void>((resolve) => (release = resolve));
    const slow = await runTurn(
      [() => completion('Trả lời.')],
      { message: 'Nhiệm vụ trễ hạn' },
      {
        generateTitle: async () => {
          await late;
          return 'Nhiệm vụ trễ hạn của đơn vị';
        },
      },
      undefined,
      { titleGraceMs: 20 },
    );
    assert.equal(slow.events.some((e) => e.type === 'title'), false, 'luồng đã đóng ở done');
    const slowId = convIds[convIds.length - 1];
    release();
    // Tên vẫn được ghi khi có: danh sách tải lại sẽ thấy
    for (let i = 0; i < 50; i++) {
      if ((await prisma.assistantConversation.findUniqueOrThrow({ where: { id: slowId } })).title !== 'Nhiệm vụ trễ hạn') break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal((await prisma.assistantConversation.findUniqueOrThrow({ where: { id: slowId } })).title, 'Nhiệm vụ trễ hạn của đơn vị');
  });

  it('ghi audit ASSISTANT_TURN với nguồn đã đọc, không chứa câu hỏi hay câu trả lời', async () => {
    const secret = `bí-mật-${runId}`;
    const { events } = await runTurn(
      [
        () => completion('', [{ id: 'a1', name: 'list_tasks', arguments: '{}' }], 'tool_calls'),
        () => completion(`Trả lời có ${secret}.`),
      ],
      { message: `Hỏi về ${secret}` },
      { runTool: async () => ({ ...toolOk(), sources: [TASK_SOURCE] }) },
    );
    const conversationId = convIds[convIds.length - 1];
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: conversationId, action: AuditAction.ASSISTANT_TURN },
    });
    assert.ok(audit, 'phải có bản ghi audit');
    assert.equal(audit.actorId, user.id);
    assert.equal(audit.requestId, `req-${runId}`);
    const metadata = audit.metadata as { status: string; rounds: number; refs: Array<{ type: string; id: string }>; model: string };
    assert.equal(metadata.status, 'complete');
    assert.equal(metadata.rounds, 2);
    assert.equal(metadata.model, 'test-model');
    assert.deepEqual(metadata.refs, [{ type: 'task', id: TASK_SOURCE.id }]);
    assert.equal(JSON.stringify(audit.metadata).includes(secret), false);
    assert.equal(events.some((e) => e.type === 'done'), true);
  });
});

describe('Trợ lý: thời gian tối đa của route chat', () => {
  it('maxDuration của route lớn hơn thời gian tối đa của một lượt, để còn lưu tin và ghi audit', async () => {
    const route = await import('@/app/api/assistant/chat/route');
    assert.equal(route.maxDuration, 330);
    assert.ok(route.maxDuration * 1000 > ASSISTANT_LIMITS.turnTimeoutMs);
  });
});
