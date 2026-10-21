/**
 * Thẻ hành động của Trợ lý (ADR-012): công cụ chỉ lưu thẻ, máy chủ chỉ thực hiện khi chính người hỏi duyệt và kiểm quyền
 * lại lúc đó; thiết lập riêng (ghi nhớ, kỹ năng) và bản tin sáng.
 */
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

import { TaskActorRole, TaskStatus } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { ASSISTANT_MAX_ACTIONS_PER_TURN, ASSISTANT_MEMORIES_PER_USER, type AssistantStreamEvent } from '@qcet/contracts/assistant';
import { setFeatureFlagOverride, resetFeatureFlagOverrides } from '@/features/flags';
import type { SessionPayload } from '@/lib/jwt-session';
import { ApiError } from '@/server/api/errors';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { runAssistantTool, type AssistantToolContext } from '@/server/assistant/assistant-tools';
import { decideAssistantAction, listMessageActions } from '@/server/assistant/assistant-actions';
import {
  addAssistantMemory,
  createAssistantSkill,
  deleteAssistantMemory,
  loadAssistantPromptProfile,
  updateAssistantPreferences,
} from '@/server/assistant/assistant-profile';
import { getConversationDetail, loadModelHistoryEntries } from '@/server/assistant/assistant-conversations';
import { runAssistantTurn } from '@/server/assistant/assistant-service';
import { briefingBody, sendAssistantBriefings } from '@/server/assistant/assistant-briefing';
import type { GatewayCompletion, GatewayConfig, callGateway } from '@/server/services/agent-gateway';

const runId = crypto.randomBytes(4).toString('hex');
const TODAY = '2026-10-19';
const CONFIG: GatewayConfig = { baseUrl: 'http://gateway.invalid', apiKey: 'test-key', model: 'test-model', thinkingBudget: null };
const u: Record<string, { id: string; name: string }> = {};
const taskIds: string[] = [];
let taskId = '';
let taskCode = '';
let notStartedId = '';
let unitId = '';
let leaderPositionAssignmentId = '';
const conversations: Record<string, string> = {};

const session = (key: string) => ({ id: u[key].id, email: `${key}@x`, name: u[key].name, role: 'CHUYEN_VIEN' }) as unknown as SessionPayload;

async function contextFor(key: string): Promise<AssistantToolContext> {
  conversations[key] ??= (await prisma.assistantConversation.create({ data: { userId: u[key].id, title: 'Thử thẻ' } })).id;
  return { authz: await loadAuthorizationContext(u[key].id), userId: u[key].id, today: TODAY, conversationId: conversations[key] };
}

function payloadOf(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

const apiError = (code: string) => (error: unknown) => error instanceof ApiError && error.code === code;

describe('Trợ lý: thẻ hành động chờ duyệt (ADR-012)', () => {
  before(async () => {
    for (const key of ['dri', 'collab', 'observer', 'stranger', 'leader']) {
      u[key] = await prisma.user.create({
        data: { email: `act_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
        select: { id: true, name: true },
      });
    }
    unitId = (await prisma.organizationalUnit.create({ data: { id: `ACT_${runId}`, code: `ACT_${runId}`, name: `Phòng thử thẻ ${runId}`, type: 'DEPARTMENT' as any, status: 'ACTIVE' as any } })).id;
    const leaderPosition = await prisma.positionDefinition.upsert({
      where: { code: 'TRUONG_PHONG' },
      update: {},
      create: { code: 'TRUONG_PHONG', title: 'Trưởng phòng', group: 'LDPU' as any, isLeadership: true },
    });
    leaderPositionAssignmentId = (
      await prisma.positionAssignment.create({
        data: { userId: u.leader.id, positionDefinitionId: leaderPosition.id, unitId, type: 'PRIMARY' as any, status: 'ACTIVE' as any, effectiveFrom: new Date('2020-01-01') },
      })
    ).id;
    const common = { academicMonth: 10, academicYear: '2026-2027', startDate: new Date('2026-09-01T00:00:00+07:00'), dueDate: new Date('2026-10-30T00:00:00+07:00'), createdById: u.dri.id };
    const task = await prisma.task.create({
      data: {
        ...common,
        code: `NV-ACT-${runId}`.toUpperCase(),
        title: `Việc thử thẻ ${runId}`,
        status: TaskStatus.IN_PROGRESS,
        leadUnitId: unitId,
        actors: {
          create: [
            { userId: u.dri.id, role: TaskActorRole.DRI, isPrimaryDRI: true },
            { userId: u.collab.id, role: TaskActorRole.COLLABORATOR },
            { userId: u.observer.id, role: TaskActorRole.OBSERVER },
          ],
        },
      },
    });
    taskId = task.id;
    taskCode = task.code;
    const fresh = await prisma.task.create({
      data: {
        ...common,
        code: `NV-ACT-${runId}-N`.toUpperCase(),
        title: `Việc chưa bắt đầu ${runId}`,
        status: TaskStatus.NOT_STARTED,
        actors: { create: [{ userId: u.dri.id, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
      },
    });
    notStartedId = fresh.id;
    taskIds.push(taskId, notStartedId);
  });

  after(async () => {
    const ids = Object.values(u).map((user) => user.id);
    await prisma.assistantConversation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: taskIds } } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityId: { in: taskIds } }, { actorId: { in: ids } }] } });
    await prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.positionAssignment.deleteMany({ where: { id: leaderPositionAssignmentId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
  });

  it('propose_comment chỉ lưu thẻ chờ duyệt; duyệt mới đăng bình luận, bấm lần hai không đăng lại, hoàn tác thì xóa', async () => {
    const outcome = await runAssistantTool('propose_comment', JSON.stringify({ code: taskCode, body: 'Nhờ cập nhật tiến độ trước thứ Sáu.' }), await contextFor('dri'));
    assert.equal(outcome.ok, true, outcome.content);
    assert.ok(outcome.action);
    assert.equal(outcome.action.status, 'pending');
    assert.equal(payloadOf(outcome.content).status, 'pending');
    assert.equal(await prisma.taskComment.count({ where: { taskId } }), 0, 'chưa duyệt thì chưa có bình luận');

    const approved = await decideAssistantAction(session('dri'), outcome.action.id, 'approve');
    assert.equal(approved.status, 'done');
    assert.equal(approved.undoable, true);
    const comments = await prisma.taskComment.findMany({ where: { taskId, deletedAt: null } });
    assert.equal(comments.length, 1);
    assert.equal(comments[0].authorId, u.dri.id);
    assert.equal(comments[0].body, 'Nhờ cập nhật tiến độ trước thứ Sáu.');

    await assert.rejects(decideAssistantAction(session('dri'), outcome.action.id, 'approve'), apiError('ACTION_DECIDED'));
    assert.equal(await prisma.taskComment.count({ where: { taskId, deletedAt: null } }), 1);

    const undone = await decideAssistantAction(session('dri'), outcome.action.id, 'undo');
    assert.equal(undone.status, 'undone');
    assert.equal(await prisma.taskComment.count({ where: { taskId, deletedAt: null } }), 0);

    const audit = await prisma.auditEvent.findMany({ where: { actorId: u.dri.id, action: 'ASSISTANT_ACTION_DECIDED' } });
    assert.ok(audit.length >= 2);
    assert.ok(audit.every((row) => !JSON.stringify(row.metadata).includes('tiến độ')), 'audit không chứa nội dung bình luận');
  });

  it('người không có quyền bình luận không soạn được thẻ; người không xem được nhiệm vụ nhận câu "không tìm thấy"', async () => {
    // Đếm theo đúng hai người thử: file test khác chạy song song cũng tạo thẻ
    const mine = { where: { userId: { in: [u.observer.id, u.stranger.id] } } };
    const before = await prisma.assistantAction.count(mine);
    const observer = await runAssistantTool('propose_comment', JSON.stringify({ id: taskId, body: 'Xin chào' }), await contextFor('observer'));
    assert.equal(observer.ok, false);
    assert.match(payloadOf(observer.content).error as string, /không có quyền bình luận/);
    const stranger = await runAssistantTool('propose_comment', JSON.stringify({ id: taskId, body: 'Xin chào' }), await contextFor('stranger'));
    assert.equal(stranger.ok, false);
    assert.match(payloadOf(stranger.content).error as string, /Không tìm thấy hoặc Thầy\/Cô không có quyền xem/);
    assert.equal(await prisma.assistantAction.count(mine), before, 'không lưu thẻ nào');
  });

  it('ngoài lượt hội thoại (chưa có cuộc) thì không soạn được thẻ', async () => {
    const ctx = await contextFor('dri');
    const outcome = await runAssistantTool('remember', JSON.stringify({ content: 'Thích bảng' }), { ...ctx, conversationId: undefined });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.action, undefined);
  });

  it('chỉ chủ thẻ quyết định được; người khác nhận 404 và thẻ vẫn chờ', async () => {
    const outcome = await runAssistantTool('propose_comment', JSON.stringify({ id: taskId, body: 'Thẻ của dri' }), await contextFor('dri'));
    assert.ok(outcome.action);
    await assert.rejects(decideAssistantAction(session('collab'), outcome.action.id, 'approve'), (error: unknown) => error instanceof ApiError && error.statusCode === 404);
    const row = await prisma.assistantAction.findUniqueOrThrow({ where: { id: outcome.action.id } });
    assert.equal(row.status, 'pending');
    const rejected = await decideAssistantAction(session('dri'), outcome.action.id, 'reject');
    assert.equal(rejected.status, 'rejected');
    assert.equal(await prisma.taskComment.count({ where: { taskId, body: 'Thẻ của dri' } }), 0);
  });

  it('thẻ quá 72 giờ thì hết hạn, không thực hiện', async () => {
    const outcome = await runAssistantTool('propose_comment', JSON.stringify({ id: taskId, body: 'Thẻ cũ' }), await contextFor('dri'));
    assert.ok(outcome.action);
    await prisma.assistantAction.update({ where: { id: outcome.action.id }, data: { createdAt: new Date(Date.now() - 73 * 3_600_000) } });
    await assert.rejects(decideAssistantAction(session('dri'), outcome.action.id, 'approve'), apiError('ACTION_EXPIRED'));
    assert.equal((await prisma.assistantAction.findUniqueOrThrow({ where: { id: outcome.action.id } })).status, 'expired');
    assert.equal(await prisma.taskComment.count({ where: { taskId, body: 'Thẻ cũ' } }), 0);
  });

  it('đổi trạng thái: duyệt thì đổi, không hoàn tác được; trạng thái đã đổi từ lúc soạn thì báo lỗi, không chồng lên', async () => {
    const outcome = await runAssistantTool('propose_status_change', JSON.stringify({ id: notStartedId, status: 'IN_PROGRESS' }), await contextFor('dri'));
    assert.equal(outcome.ok, true, outcome.content);
    assert.ok(outcome.action && outcome.action.view.kind === 'task_status');
    assert.equal(outcome.action.view.from, 'NOT_STARTED');
    const done = await decideAssistantAction(session('dri'), outcome.action.id, 'approve');
    assert.equal(done.status, 'done', done.error ?? '');
    assert.equal(done.undoable, false);
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: notStartedId } })).status, TaskStatus.IN_PROGRESS);
    await assert.rejects(decideAssistantAction(session('dri'), outcome.action.id, 'undo'), apiError('ACTION_NOT_UNDOABLE'));

    const stale = await runAssistantTool('propose_status_change', JSON.stringify({ id: taskId, status: 'WAITING_APPROVAL' }), await contextFor('dri'));
    assert.ok(stale.action);
    await prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.WAITING_APPROVAL } });
    const failed = await decideAssistantAction(session('dri'), stale.action.id, 'approve');
    assert.equal(failed.status, 'failed');
    assert.match(failed.error ?? '', /đã thay đổi/);
    await prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.IN_PROGRESS } });
  });

  it('cùng trạng thái hiện tại thì không soạn thẻ', async () => {
    const outcome = await runAssistantTool('propose_status_change', JSON.stringify({ id: taskId, status: 'IN_PROGRESS' }), await contextFor('dri'));
    assert.equal(outcome.ok, false);
    assert.match(payloadOf(outcome.content).error as string, /đã ở trạng thái này/);
  });

  it('nhắc việc là quyền của lãnh đạo đơn vị: chuyên viên không soạn được; trưởng phòng soạn, người nhận là người tham gia, gửi rồi không thu hồi', async () => {
    const staff = await runAssistantTool('propose_reminder', JSON.stringify({ id: taskId, message: 'Nhắc cập nhật minh chứng.' }), await contextFor('dri'));
    assert.equal(staff.ok, false);
    assert.match(payloadOf(staff.content).error as string, /không có quyền nhắc việc/);

    const outcome = await runAssistantTool('propose_reminder', JSON.stringify({ id: taskId, message: 'Nhắc cập nhật minh chứng.' }), await contextFor('leader'));
    assert.equal(outcome.ok, true, outcome.content);
    assert.ok(outcome.action && outcome.action.view.kind === 'task_remind');
    assert.ok(outcome.action.view.recipients.includes(u.dri.name));
    assert.ok(outcome.action.view.recipients.includes(u.collab.name));
    assert.ok(!outcome.action.view.recipients.includes(u.leader.name));
    const done = await decideAssistantAction(session('leader'), outcome.action.id, 'approve');
    assert.equal(done.status, 'done', done.error ?? '');
    assert.equal(done.undoable, false);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_REMINDED', actorId: u.leader.id } }));
  });

  it('ghi nhớ: duyệt thì lưu với nguồn Trợ lý và vào lời nhắc các lượt sau; hoàn tác thì xóa', async () => {
    const outcome = await runAssistantTool('remember', JSON.stringify({ content: `Phụ trách khảo thí ${runId}` }), await contextFor('dri'));
    assert.ok(outcome.action);
    const done = await decideAssistantAction(session('dri'), outcome.action.id, 'approve');
    assert.equal(done.status, 'done');
    const memory = await prisma.assistantMemory.findFirstOrThrow({ where: { userId: u.dri.id, content: `Phụ trách khảo thí ${runId}` } });
    assert.equal(memory.source, 'assistant');
    assert.ok((await loadAssistantPromptProfile(u.dri.id)).memories.includes(`Phụ trách khảo thí ${runId}`));
    await decideAssistantAction(session('dri'), outcome.action.id, 'undo');
    assert.equal(await prisma.assistantMemory.count({ where: { id: memory.id } }), 0);
  });

  it('thẻ gắn vào tin trả lời: mở lại cuộc thấy thẻ, lịch sử mô hình có khối ghi lại trạng thái thẻ', async () => {
    const conversation = await prisma.assistantConversation.create({ data: { userId: u.dri.id, title: 'Thẻ trong lịch sử' } });
    const ctx = { ...(await contextFor('dri')), conversationId: conversation.id };
    const outcome = await runAssistantTool('propose_comment', JSON.stringify({ id: taskId, body: 'Bình luận trong lịch sử' }), ctx);
    assert.ok(outcome.action);
    await prisma.assistantMessage.create({ data: { conversationId: conversation.id, role: 'user', content: 'Viết bình luận giúp tôi' } });
    const reply = await prisma.assistantMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: 'Tôi đã soạn thẻ.' } });
    await prisma.assistantAction.update({ where: { id: outcome.action.id }, data: { messageId: reply.id } });
    await decideAssistantAction(session('dri'), outcome.action.id, 'reject');

    const detail = await getConversationDetail(u.dri.id, conversation.id, async () => null);
    const message = detail?.messages.find((item) => item.id === reply.id);
    assert.equal(message?.actions?.length, 1);
    assert.equal(message?.actions?.[0].status, 'rejected');
    // Người khác không đọc được cuộc nên không thấy thẻ
    assert.equal(await getConversationDetail(u.collab.id, conversation.id, async () => null), null);

    const history = await loadModelHistoryEntries(conversation.id);
    const replyEntry = history.find((item) => item.id === reply.id);
    assert.match(replyEntry?.content ?? '', /\[Hệ thống ghi lại: thẻ hành động đã soạn ở lượt này\]/);
    assert.match(replyEntry?.content ?? '', /đã bỏ qua/);
    const listed = await listMessageActions([reply.id]);
    assert.equal(listed.get(reply.id)?.length, 1);
  });

  it(`một lượt soạn tối đa ${ASSISTANT_MAX_ACTIONS_PER_TURN} thẻ; thẻ thừa không được lưu, mô hình nhận lỗi`, async () => {
    const calls = Array.from({ length: ASSISTANT_MAX_ACTIONS_PER_TURN + 1 }, (_, index) => ({
      id: `call_${index}`,
      name: 'remember',
      arguments: JSON.stringify({ content: `Ghi nhớ ${index} ${runId}` }),
    }));
    const scripts: Array<() => GatewayCompletion> = [
      () => ({ content: '', thinking: '', toolCalls: calls, finishReason: 'tool_calls' }),
      () => ({ content: 'Đã soạn thẻ ghi nhớ, Thầy/Cô bấm Duyệt.', thinking: '', toolCalls: [], finishReason: 'stop' }),
    ];
    let next = 0;
    const seen: string[] = [];
    const gateway = (async (messages, options) => {
      seen.push(JSON.stringify(messages));
      const result = scripts[next++]();
      if (result.content) options?.onContent?.(result.content);
      return result;
    }) as typeof callGateway;
    const events: AssistantStreamEvent[] = [];
    await runAssistantTurn(
      { userId: u.dri.id, authz: await loadAuthorizationContext(u.dri.id), message: 'Nhớ giúp tôi mấy điều', requestId: `req-${runId}`, now: new Date('2026-10-19T10:00:00+07:00') },
      (event) => events.push(event),
      { deps: { callGateway: gateway, readConfig: () => CONFIG } },
    );
    const actionEvents = events.filter((event) => event.type === 'action');
    assert.equal(actionEvents.length, ASSISTANT_MAX_ACTIONS_PER_TURN);
    assert.match(seen[1], /Mỗi lượt chỉ soạn tối đa/);
    const done = events.find((event) => event.type === 'done');
    assert.ok(done && done.type === 'done');
    const linked = await prisma.assistantAction.count({ where: { messageId: done.messageId } });
    assert.equal(linked, ASSISTANT_MAX_ACTIONS_PER_TURN, 'thẻ gắn vào tin trả lời đã lưu');
    assert.equal(await prisma.assistantMemory.count({ where: { userId: u.dri.id, content: { startsWith: 'Ghi nhớ ' } } }), 0, 'chưa duyệt thì chưa ghi nhớ');
  });
});

describe('Trợ lý: thiết lập riêng (ADR-012)', () => {
  const owner = { id: '', name: '' };
  const other = { id: '', name: '' };

  before(async () => {
    Object.assign(owner, await prisma.user.create({ data: { email: `pref_${runId}_a@cdktcnqn.edu.vn`, name: `Chủ ${runId}` }, select: { id: true, name: true } }));
    Object.assign(other, await prisma.user.create({ data: { email: `pref_${runId}_b@cdktcnqn.edu.vn`, name: `Khác ${runId}` }, select: { id: true, name: true } }));
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  });

  it('ghi nhớ trùng nội dung trả mục đã có, đủ trần thì báo 409, người khác không xóa được', async () => {
    const first = await addAssistantMemory(owner.id, 'Thích bảng', 'user');
    const again = await addAssistantMemory(owner.id, '  Thích bảng ', 'user');
    assert.equal(again.id, first.id);
    for (let index = 1; index < ASSISTANT_MEMORIES_PER_USER; index++) await addAssistantMemory(owner.id, `Mục ${index}`, 'user');
    await assert.rejects(addAssistantMemory(owner.id, 'Mục thừa', 'user'), apiError('MEMORY_LIMIT'));
    assert.equal(await deleteAssistantMemory(other.id, first.id), false);
    assert.equal(await prisma.assistantMemory.count({ where: { id: first.id } }), 1);
  });

  it('kỹ năng trùng tên báo 409; hướng dẫn riêng vào lời nhắc của lượt', async () => {
    await createAssistantSkill(owner.id, { name: 'Báo cáo tuần', prompt: 'Tóm tắt việc tuần này' });
    await assert.rejects(createAssistantSkill(owner.id, { name: 'Báo cáo tuần', prompt: 'Khác' }), apiError('SKILL_NAME_TAKEN'));
    await createAssistantSkill(other.id, { name: 'Báo cáo tuần', prompt: 'Của người khác' });
    await updateAssistantPreferences(owner.id, { instructions: '  Trả lời thật ngắn. ' });
    assert.equal((await loadAssistantPromptProfile(owner.id)).instructions, 'Trả lời thật ngắn.');
  });
});

describe('Trợ lý: bản tin sáng (ADR-012)', () => {
  const reader = { id: '' };

  before(async () => {
    setFeatureFlagOverride('assistant', true);
    Object.assign(reader, await prisma.user.create({ data: { email: `brief_${runId}@cdktcnqn.edu.vn`, name: `Bản tin ${runId}`, isActive: true }, select: { id: true } }));
    await updateAssistantPreferences(reader.id, { briefingEnabled: true });
  });

  after(async () => {
    resetFeatureFlagOverrides();
    await prisma.notification.deleteMany({ where: { userId: reader.id } });
    await prisma.user.deleteMany({ where: { id: reader.id } });
  });

  it('nội dung đếm việc, không có gì thì nói rõ', () => {
    assert.equal(briefingBody({ inbox: 3, overdue: 0, meetings: 1 }), '3 việc cần xử lý · 1 cuộc họp hôm nay. Bấm để hỏi Trợ lý chi tiết.');
    assert.match(briefingBody({ inbox: 0, overdue: 0, meetings: 0 }), /chưa có việc cần xử lý/);
  });

  it('trước 07:00 không gửi; sau 07:00 gửi một bản mỗi ngày, quét lại không gửi trùng', async () => {
    const early = await sendAssistantBriefings(new Date('2026-10-19T06:30:00+07:00'));
    assert.equal(early.sent, 0);
    assert.equal(await prisma.notification.count({ where: { userId: reader.id, type: 'assistant_briefing' } }), 0);

    await sendAssistantBriefings(new Date('2026-10-19T07:05:00+07:00'));
    await sendAssistantBriefings(new Date('2026-10-19T09:00:00+07:00'));
    const sent = await prisma.notification.findMany({ where: { userId: reader.id, type: 'assistant_briefing' } });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].title, 'Bản tin sáng');
    assert.match(sent[0].linkHref, /^\/assistant\?prompt=/);
    const claim = await prisma.assistantBriefing.findUniqueOrThrow({ where: { userId_day: { userId: reader.id, day: '2026-10-19' } } });
    assert.equal(claim.notificationId, sent[0].id);
  });

  it('người chưa bật hoặc Trợ lý tắt thì không gửi', async () => {
    await updateAssistantPreferences(reader.id, { briefingEnabled: false });
    await sendAssistantBriefings(new Date('2026-10-20T08:00:00+07:00'));
    await updateAssistantPreferences(reader.id, { briefingEnabled: true });
    setFeatureFlagOverride('assistant', false);
    await sendAssistantBriefings(new Date('2026-10-20T08:00:00+07:00'));
    setFeatureFlagOverride('assistant', true);
    assert.equal(await prisma.notification.count({ where: { userId: reader.id, type: 'assistant_briefing' } }), 1);
  });
});
