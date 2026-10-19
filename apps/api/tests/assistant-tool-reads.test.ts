/**
 * Công cụ đọc của Trợ lý sau đợt nâng cấp (ADR-012): lọc nhiệm vụ theo tên người và đơn vị (mô hình không có mã người),
 * get_task kèm bình luận gần nhất, minh chứng và yêu cầu gia hạn đang chờ.
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
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { runAssistantTool, type AssistantToolContext } from '@/server/assistant/assistant-tools';

const rand = crypto.randomBytes(4).toString('hex');
const RAND = rand.toUpperCase();
const TODAY = '2026-10-19';
const users: Record<string, { id: string; name: string }> = {};
const taskIds: string[] = [];
let unitId = '';
let unitCode = '';
let ctx: AssistantToolContext;
let taskWithComments = '';

function parsed(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

describe('Trợ lý: công cụ đọc theo tên và chi tiết nhiệm vụ', () => {
  before(async () => {
    const names: Record<string, string> = {
      viewer: `Người hỏi ${RAND}`,
      duc: `Nguyễn Văn Đức ${RAND}`,
      hoaA: `Phạm Thị Hòa ${RAND} A`,
      hoaB: `Phạm Thị Hòa ${RAND} B`,
    };
    for (const [key, name] of Object.entries(names)) {
      users[key] = await prisma.user.create({
        data: { email: `reads_${rand}_${key}@cdktcnqn.edu.vn`, name, role: 'CHUYEN_VIEN', isActive: true },
        select: { id: true, name: true },
      });
    }
    unitCode = `RD_${RAND}`;
    unitId = (await prisma.organizationalUnit.create({ data: { id: unitCode, code: unitCode, name: `Phòng Khảo thí ${RAND}`, type: 'DEPARTMENT' as any, status: 'ACTIVE' as any } })).id;

    const common = {
      academicMonth: 10,
      academicYear: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00+07:00'),
      dueDate: new Date('2026-12-01T00:00:00+07:00'),
      createdById: users.viewer.id,
      status: TaskStatus.IN_PROGRESS,
    };
    // Người hỏi phối hợp cả ba việc (đọc được); Đức chủ trì việc 1, Hòa A chủ trì việc 2; việc 3 thuộc phòng khác
    const specs = [
      { key: 'duc', lead: users.duc.id, unit: unitId },
      { key: 'hoa', lead: users.hoaA.id, unit: unitId },
      { key: 'other', lead: users.hoaB.id, unit: null },
    ];
    for (const spec of specs) {
      const task = await prisma.task.create({
        data: {
          ...common,
          code: `NV-RD-${RAND}-${spec.key}`.toUpperCase(),
          title: `Việc ${spec.key} ${RAND}`,
          leadUnitId: spec.unit,
          actors: {
            create: [
              { userId: spec.lead, role: TaskActorRole.DRI, isPrimaryDRI: true },
              { userId: users.viewer.id, role: TaskActorRole.COLLABORATOR },
            ],
          },
        },
      });
      taskIds.push(task.id);
    }
    taskWithComments = taskIds[0];
    for (let index = 1; index <= 7; index++) {
      await prisma.taskComment.create({
        data: {
          taskId: taskWithComments,
          authorId: users.duc.id,
          body: index === 7 ? 'Liên hệ 0912345678 để lấy số liệu' : `Ý kiến ${index}`,
          createdAt: new Date(Date.UTC(2026, 9, 10, index)),
        },
      });
    }
    await prisma.taskDeliverable.create({
      data: { taskId: taskWithComments, title: 'Báo cáo khảo thí', fileUrl: '/uploads/x.pdf', uploadedById: users.duc.id },
    });
    await prisma.taskExtensionRequest.create({
      data: {
        taskId: taskWithComments,
        requestedById: users.duc.id,
        previousDueDate: common.dueDate,
        requestedDueDate: new Date('2026-12-15T00:00:00+07:00'),
        reason: 'Chờ số liệu từ khoa',
      },
    });
    ctx = { authz: await loadAuthorizationContext(users.viewer.id), userId: users.viewer.id, today: TODAY };
  });

  after(async () => {
    await prisma.taskExtensionRequest.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskDeliverable.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
  });

  it('assignee nhận tên gõ không dấu, trả đúng việc của người đó và tên đã khớp', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ assignee: `van duc ${rand}` }), ctx);
    assert.equal(outcome.ok, true, outcome.content);
    const payload = parsed(outcome.content);
    assert.deepEqual(payload.matched, { assignee: users.duc.name });
    assert.equal(payload.total, 1);
    assert.equal((payload.tasks as Array<{ id: string }>)[0].id, taskIds[0]);
    assert.match(outcome.step.label, /Xem nhiệm vụ của/);
  });

  it('nhiều người khớp thì báo lỗi kèm các tên để hỏi lại, không đoán', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ assignee: `Hòa ${RAND}` }), ctx);
    assert.equal(outcome.ok, false);
    const error = parsed(outcome.content).error as string;
    assert.match(error, /Có 2 người dùng khớp/);
    assert.ok(error.includes(users.hoaA.name) && error.includes(users.hoaB.name));
    assert.ok(!error.includes('@'), 'không lộ email');
  });

  it('không ai khớp thì nói rõ không tìm thấy', async () => {
    const outcome = await runAssistantTool('list_tasks', JSON.stringify({ assignee: `Không ai ${RAND}` }), ctx);
    assert.equal(outcome.ok, false);
    assert.match(parsed(outcome.content).error as string, /Không tìm thấy người nào/);
  });

  it('unit nhận mã hoặc tên đơn vị', async () => {
    for (const unit of [unitCode, `khao thi ${rand}`]) {
      const outcome = await runAssistantTool('list_tasks', JSON.stringify({ unit }), ctx);
      assert.equal(outcome.ok, true, outcome.content);
      const payload = parsed(outcome.content);
      assert.deepEqual(payload.matched, { unit: `Phòng Khảo thí ${RAND}` });
      assert.equal(payload.total, 2);
    }
  });

  it('get_task kèm 5 bình luận mới nhất (đã che số điện thoại), tổng bình luận, minh chứng và gia hạn đang chờ', async () => {
    const outcome = await runAssistantTool('get_task', JSON.stringify({ id: taskWithComments }), ctx);
    assert.equal(outcome.ok, true, outcome.content);
    const payload = parsed(outcome.content);
    assert.equal(payload.commentCount, 7);
    const comments = payload.recentComments as Array<{ author: string; text: string }>;
    assert.equal(comments.length, 5);
    assert.ok(!comments[0].text.includes('0912345678'), 'số điện thoại bị che');
    assert.equal(comments[1].text, 'Ý kiến 6');
    assert.equal(comments[0].author, users.duc.name);
    assert.equal(payload.deliverableCount, 1);
    assert.deepEqual((payload.deliverables as Array<{ title: string; reviewStatus: string }>).map(({ title, reviewStatus }) => ({ title, reviewStatus })), [
      { title: 'Báo cáo khảo thí', reviewStatus: 'Chờ duyệt' },
    ]);
    assert.deepEqual(payload.pendingExtension, { requestedBy: users.duc.name, requestedDueDate: '2026-12-15', reason: 'Chờ số liệu từ khoa' });
    assert.ok(!outcome.content.includes('fileUrl') && !outcome.content.includes('/uploads/'), 'không lộ đường dẫn tệp');
  });
});
