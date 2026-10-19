import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
import { OutboxEventType } from '@qcet/db/outbox';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import type { GatewayCompletion, GatewayConfig, GatewayMessage, callGateway } from '@/server/services/agent-gateway';
import { runAssistantTurn, type AssistantTurnAttachment } from '@/server/assistant/assistant-service';
import { deleteConversation, getConversationDetail, purgeExpiredConversations } from '@/server/assistant/assistant-conversations';
import { assistantFileLinkOf, findConversationAttachments } from '@/server/assistant/assistant-attachments';
import { authorizeFileObjectDownload } from '@/server/files/file-access-service';
import { countFileObjectReferences } from '@/server/files/file-object-purge';
import { ForbiddenError } from '@/server/api/errors';
import type { AssistantStreamEvent } from '@qcet/contracts/assistant';

/**
 * Tệp gửi kèm câu hỏi của Trợ lý được lưu (người dùng báo 19/10/2026: gửi kế hoạch năm học rồi tải lại trang thì mất tệp).
 * Kiểm: lưu và báo trước `done`, chi tiết cuộc có tệp, lượt sau gửi lại tệp, "Thử lại" gắn tệp cũ, chỉ chủ cuộc tải được,
 * xóa cuộc thì yêu cầu xóa tệp.
 */

const runId = crypto.randomBytes(4).toString('hex');
const NOW = new Date('2026-10-19T10:00:00+07:00');
const CONFIG: GatewayConfig = { baseUrl: 'http://gateway.invalid', apiKey: 'test-key', model: 'test-model', thinkingBudget: null };
const PLAN_TEXT = `Kế hoạch năm học ${runId}: tháng 10 tổ chức hội nghị cán bộ.`;

let uploadsDir: string;
let originalUploadsDir: string | undefined;
let user: User;
let otherUser: User;
const userIds: string[] = [];
const convIds: string[] = [];

function authzFor(u: User): AuthorizationContext {
  return {
    userId: u.id,
    user: { id: u.id, email: u.email, name: u.name, isActive: true },
    positions: [],
  } as unknown as AuthorizationContext;
}

function textAttachment(name: string, text: string): AssistantTurnAttachment {
  const data = Buffer.from(text, 'utf8');
  return {
    kind: 'text',
    bytes: data.length,
    step: `Đọc tệp ${name}`,
    parts: [{ type: 'text', text: `[Tệp đính kèm: ${name}]\n${text}\n[Hết tệp]` }],
    name,
    data,
  };
}

/** Một lượt với gateway giả trả lời "Đã đọc."; trả sự kiện và tin nhắn gửi gateway. */
async function turn(input: { conversationId?: string; message?: string; attachments?: AssistantTurnAttachment[]; as?: User }) {
  const events: AssistantStreamEvent[] = [];
  const sent: GatewayMessage[][] = [];
  const gateway = (async (messages: GatewayMessage[], options?: { onContent?: (delta: string) => void }) => {
    sent.push([...messages]);
    options?.onContent?.('Đã đọc.');
    return { content: 'Đã đọc.', thinking: '', toolCalls: [], finishReason: 'stop' } satisfies GatewayCompletion;
  }) as unknown as typeof callGateway;
  const actor = input.as ?? user;
  await runAssistantTurn(
    {
      userId: actor.id,
      authz: authzFor(actor),
      message: input.message ?? 'Kế hoạch này tạo được bao nhiêu nhiệm vụ?',
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      ...(input.attachments ? { attachments: input.attachments } : {}),
      requestId: `req-${runId}`,
      now: NOW,
    },
    (event) => events.push(event),
    {
      deps: {
        callGateway: gateway,
        readConfig: () => CONFIG,
        runTool: async () => {
          throw new Error('không gọi công cụ');
        },
        toolDefinitions: [],
        describeContext: async () => null,
      },
    },
  );
  const conversation = events.find((e) => e.type === 'conversation');
  assert.ok(conversation && conversation.type === 'conversation', 'có sự kiện conversation');
  if (!convIds.includes(conversation.conversation.id)) convIds.push(conversation.conversation.id);
  return { events, sent, conversationId: conversation.conversation.id, userMessageId: conversation.userMessageId };
}

function userTextsWithFile(messages: GatewayMessage[]): string[] {
  return messages.flatMap((message) =>
    message.role === 'user' && Array.isArray(message.content)
      ? message.content.flatMap((part) => (part.type === 'text' && part.text.includes('[Tệp đính kèm:') ? [part.text] : []))
      : [],
  );
}

describe('Trợ lý: lưu tệp gửi kèm câu hỏi', () => {
  before(async () => {
    originalUploadsDir = process.env.UPLOADS_DIR;
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcet-assistant-files-'));
    process.env.UPLOADS_DIR = uploadsDir;
    user = await prisma.user.create({
      data: { email: `assistant-files-${runId}@qcet.edu.vn`, name: `Trợ lý tệp ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
    });
    otherUser = await prisma.user.create({
      data: { email: `assistant-files-other-${runId}@qcet.edu.vn`, name: `Người khác ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
    });
    userIds.push(user.id, otherUser.id);
  });

  after(async () => {
    const files = await prisma.fileObject.findMany({ where: { uploadedById: { in: userIds } }, select: { id: true } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: files.map((file) => file.id) } } });
    await prisma.fileObject.deleteMany({ where: { uploadedById: { in: userIds } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: convIds } } });
    await prisma.assistantConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
  });

  it('lưu tệp, báo sự kiện attachments trước done; mở lại cuộc thấy tệp trên câu hỏi', async () => {
    const { events, conversationId, userMessageId } = await turn({ attachments: [textAttachment('ke-hoach.txt', PLAN_TEXT)] });
    const types = events.map((e) => e.type);
    assert.ok(types.indexOf('attachments') >= 0 && types.indexOf('attachments') < types.indexOf('done'), types.join(','));
    const saved = events.find((e) => e.type === 'attachments');
    assert.ok(saved && saved.type === 'attachments');
    assert.equal(saved.messageId, userMessageId);
    assert.deepEqual(
      saved.attachments.map(({ name, size, kind }) => ({ name, size, kind })),
      [{ name: 'ke-hoach.txt', size: Buffer.byteLength(PLAN_TEXT), kind: 'text' }],
    );
    assert.equal(saved.attachments[0].url, `/api/file-objects/${saved.attachments[0].id}`);

    const row = await prisma.fileObject.findUniqueOrThrow({ where: { id: saved.attachments[0].id } });
    assert.deepEqual(assistantFileLinkOf(row.metadata), { assistantConversationId: conversationId, assistantMessageIds: [userMessageId] });
    assert.equal(fs.readFileSync(path.join(uploadsDir, row.storageKey), 'utf8'), PLAN_TEXT);

    const detail = await getConversationDetail(user.id, conversationId, async () => null, NOW);
    assert.ok(detail);
    const [question, reply] = detail.messages;
    assert.deepEqual(question.attachments?.map((a) => a.id), [row.id]);
    assert.equal(reply.attachments, undefined, 'tin trả lời không có tệp');
  });

  it('lượt sau gửi lại tệp cùng câu hỏi cũ trong lịch sử', async () => {
    const first = await turn({ attachments: [textAttachment('ke-hoach-2.txt', PLAN_TEXT)] });
    const second = await turn({ conversationId: first.conversationId, message: 'Tạo cả 12 nhiệm vụ' });
    const messages = second.sent[0];
    const history = messages.filter((m) => m.role === 'user');
    assert.equal(history.length, 2, 'câu hỏi cũ và câu hỏi mới');
    assert.deepEqual(userTextsWithFile([history[0]]).length, 1, 'câu hỏi cũ kèm tệp');
    assert.equal(history[1].content, 'Tạo cả 12 nhiệm vụ', 'câu hỏi mới không có tệp');
    assert.ok(userTextsWithFile(messages)[0].includes(PLAN_TEXT));
  });

  it('cùng nội dung ở hai cuộc là hai tệp riêng (không dùng chung khi chống trùng)', async () => {
    const a = await turn({ attachments: [textAttachment('trung.txt', `Trùng ${runId}`)] });
    const b = await turn({ attachments: [textAttachment('trung.txt', `Trùng ${runId}`)] });
    const idOf = (events: AssistantStreamEvent[]) => {
      const saved = events.find((e) => e.type === 'attachments');
      return saved && saved.type === 'attachments' ? saved.attachments[0].id : null;
    };
    // Bản thứ hai không được trả id của bản thứ nhất (đang chờ quét nên vốn không dedup; đánh dấu sạch rồi gửi lại cho chắc)
    await prisma.fileObject.update({ where: { id: idOf(a.events)! }, data: { scanStatus: 'CLEAN' } });
    const c = await turn({ attachments: [textAttachment('trung.txt', `Trùng ${runId}`)] });
    assert.notEqual(idOf(b.events), idOf(a.events));
    assert.notEqual(idOf(c.events), idOf(a.events));
  });

  it('"Thử lại" bằng mã tệp: gắn câu hỏi mới vào tệp cũ, không lưu bản mới; mã của cuộc khác bị bỏ', async () => {
    const first = await turn({ attachments: [textAttachment('thu-lai.txt', PLAN_TEXT)] });
    const saved = first.events.find((e) => e.type === 'attachments');
    assert.ok(saved && saved.type === 'attachments');
    const fileId = saved.attachments[0].id;
    const [row] = await findConversationAttachments(user.id, first.conversationId, [fileId]);
    assert.equal(row?.id, fileId);
    assert.deepEqual(await findConversationAttachments(otherUser.id, first.conversationId, [fileId]), [], 'người khác không lấy được');
    const other = await turn({ message: 'Cuộc khác' });
    assert.deepEqual(await findConversationAttachments(user.id, other.conversationId, [fileId]), [], 'tệp của cuộc khác không dùng được');

    const before = await prisma.fileObject.count({ where: { uploadedById: user.id } });
    const retry = await turn({
      conversationId: first.conversationId,
      attachments: [{ ...textAttachment('thu-lai.txt', PLAN_TEXT), data: undefined, storedId: fileId }],
    });
    assert.equal(await prisma.fileObject.count({ where: { uploadedById: user.id } }), before, 'không lưu bản mới');
    const link = assistantFileLinkOf((await prisma.fileObject.findUniqueOrThrow({ where: { id: fileId } })).metadata);
    assert.deepEqual(link?.assistantMessageIds, [first.userMessageId, retry.userMessageId]);
    const resent = retry.events.find((e) => e.type === 'attachments');
    assert.ok(resent && resent.type === 'attachments');
    assert.deepEqual(resent.attachments.map((a) => a.id), [fileId]);
  });

  it('chỉ chủ cuộc tải được tệp; xóa cuộc thì hết tham chiếu và có yêu cầu xóa tệp qua outbox', async () => {
    const first = await turn({ attachments: [textAttachment('rieng.txt', PLAN_TEXT)] });
    const saved = first.events.find((e) => e.type === 'attachments');
    assert.ok(saved && saved.type === 'attachments');
    const fileId = saved.attachments[0].id;
    // Môi trường test không quét tệp: đánh dấu sạch để chỉ còn kiểm quyền
    await prisma.fileObject.update({ where: { id: fileId }, data: { scanStatus: 'CLEAN' } });
    const owner = { id: user.id, email: user.email, name: user.name, role: user.role };
    const stranger = { id: otherUser.id, email: otherUser.email, name: otherUser.name, role: otherUser.role };
    assert.equal((await authorizeFileObjectDownload({ authUser: owner, fileObjectId: fileId, requestId: 'r1' })).id, fileId);
    await assert.rejects(authorizeFileObjectDownload({ authUser: stranger, fileObjectId: fileId, requestId: 'r2' }), ForbiddenError);

    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: fileId } });
    assert.equal(await countFileObjectReferences(prisma, file), 1, 'cuộc còn thì còn tham chiếu');
    assert.equal(await deleteConversation(user.id, first.conversationId, 'req-delete'), true);
    assert.equal(await countFileObjectReferences(prisma, file), 0);
    const purge = await prisma.outboxEvent.findMany({ where: { aggregateId: fileId, eventType: OutboxEventType.FILE_OBJECT_PURGE_REQUESTED } });
    assert.equal(purge.length, 1);
    await assert.rejects(authorizeFileObjectDownload({ authUser: owner, fileObjectId: fileId, requestId: 'r3' }), ForbiddenError, 'xóa cuộc rồi thì không tải được');
  });

  it('cuộc quá hạn lưu giữ bị xóa kèm yêu cầu xóa tệp', async () => {
    const first = await turn({ attachments: [textAttachment('qua-han.txt', PLAN_TEXT)] });
    const saved = first.events.find((e) => e.type === 'attachments');
    assert.ok(saved && saved.type === 'attachments');
    // Chỉ cuộc này quá hạn ở mốc rất cũ: các file test khác chạy song song có cuộc quá hạn của riêng chúng, không được xóa
    await prisma.assistantConversation.update({ where: { id: first.conversationId }, data: { lastMessageAt: new Date('1999-12-31T00:00:00Z') } });
    assert.equal(await purgeExpiredConversations(new Date('2000-01-01T00:00:00Z'), 0), 1);
    assert.equal(await prisma.assistantConversation.count({ where: { id: first.conversationId } }), 0);
    assert.equal(
      await prisma.outboxEvent.count({ where: { aggregateId: saved.attachments[0].id, eventType: OutboxEventType.FILE_OBJECT_PURGE_REQUESTED } }),
      1,
    );
  });
});
