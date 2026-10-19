/**
 * Việc con của việc cha đã lưu trữ ẩn theo cha ở mọi nơi đọc nhiệm vụ. Trước đây danh sách đã ẩn nhưng hộp việc
 * (`/api/me/inbox`, công cụ `my_inbox` của Trợ lý) và chi tiết (`GET /api/tasks/[id]`, công cụ `get_task`) vẫn trả về,
 * nên Trợ lý liệt kê nhiệm vụ trong khi trang Nhiệm vụ trống.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { NotFoundError } from '../src/server/api/errors';
import { readInbox } from '../src/server/assistant/assistant-tool-agenda';
import { loadAuthorizationContext } from '../src/server/authorization/authorization-context-service';
import { ActionInboxService } from '../src/server/services/action-inbox-service';
import { readTaskForUser } from '../src/server/tasks/read-task-for-user';
import { createDocumentRouteFixture, DAY_MS, type FixtureUser } from './server/api/documents-route-fixtures';

const fixture = createDocumentRouteFixture('archpar');
let staff: FixtureUser;
let head: FixtureUser;
const ids = { orphanDri: '', liveDri: '', orphanReview: '', liveReview: '' };

async function createTask(
  key: string,
  data: { unitId: string; parentTaskId?: string; archived?: boolean; status?: TaskStatus; actors?: Array<{ userId: string; role: TaskActorRole }> }
): Promise<string> {
  const row = await prisma.task.create({
    data: {
      code: `${fixture.runId}_${key}`,
      title: `Nhiệm vụ kiểm thử ${key} ${fixture.runId}`,
      status: data.status ?? TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      leadUnitId: data.unitId,
      createdById: head.id,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date(Date.now() + 5 * DAY_MS),
      parentTaskId: data.parentTaskId,
      archivedAt: data.archived ? new Date() : null,
      actors: data.actors ? { create: data.actors } : undefined,
    },
  });
  fixture.trackTask(row.id);
  return row.id;
}

describe('Việc con của việc cha đã lưu trữ', () => {
  before(async () => {
    const unitId = await fixture.unit('unit');
    staff = await fixture.user('staff', { role: UserRole.CHUYEN_VIEN, unitId });
    head = await fixture.user('head', { role: UserRole.TRUONG_PHONG, unitId });

    const archivedParent = await createTask('parent_archived', { unitId, archived: true });
    const liveParent = await createTask('parent_live', { unitId });
    const dri = [{ userId: staff.id, role: TaskActorRole.DRI }];
    const review = [
      { userId: staff.id, role: TaskActorRole.DRI },
      { userId: head.id, role: TaskActorRole.REVIEWER },
    ];
    ids.orphanDri = await createTask('orphan_dri', { unitId, parentTaskId: archivedParent, actors: dri });
    ids.liveDri = await createTask('live_dri', { unitId, parentTaskId: liveParent, actors: dri });
    ids.orphanReview = await createTask('orphan_review', {
      unitId,
      parentTaskId: archivedParent,
      status: TaskStatus.WAITING_APPROVAL,
      actors: review,
    });
    ids.liveReview = await createTask('live_review', {
      unitId,
      parentTaskId: liveParent,
      status: TaskStatus.WAITING_APPROVAL,
      actors: review,
    });
  });

  after(async () => {
    await fixture.cleanup();
  });

  test('hộp việc của người chủ trì bỏ việc con của việc cha đã lưu trữ', async () => {
    const inbox = await ActionInboxService.getActionInbox(staff.id);
    const taskIds = inbox.items.filter((item) => item.resourceType === 'TASK').map((item) => item.resourceId);
    assert.ok(taskIds.includes(ids.liveDri));
    assert.ok(!taskIds.includes(ids.orphanDri));
  });

  test('hộp việc chờ duyệt bỏ việc con của việc cha đã lưu trữ', async () => {
    const inbox = await ActionInboxService.getActionInbox(head.id);
    const taskIds = inbox.items.filter((item) => item.resourceType === 'TASK').map((item) => item.resourceId);
    assert.ok(taskIds.includes(ids.liveReview));
    assert.ok(!taskIds.includes(ids.orphanReview));
  });

  test('công cụ hộp việc của Trợ lý không trả việc con của việc cha đã lưu trữ', async () => {
    const inbox = await readInbox(staff.id);
    const sourceIds = inbox.sources.filter((source) => source.type === 'task').map((source) => source.id);
    assert.ok(sourceIds.includes(ids.liveDri));
    assert.ok(!sourceIds.includes(ids.orphanDri));
  });

  test('chi tiết nhiệm vụ trả 404 cho việc con của việc cha đã lưu trữ', async () => {
    const ctx = await loadAuthorizationContext(staff.id);
    const live = await readTaskForUser(ctx, ids.liveDri);
    assert.equal(live.task.id, ids.liveDri);
    await assert.rejects(readTaskForUser(ctx, ids.orphanDri), NotFoundError);
  });
});
