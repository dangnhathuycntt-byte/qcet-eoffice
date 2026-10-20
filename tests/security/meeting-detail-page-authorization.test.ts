import nextEnvPkg from '@next/env';
const loadEnvConfig = (nextEnvPkg as any)?.loadEnvConfig || (nextEnvPkg as any)?.default?.loadEnvConfig || (nextEnvPkg as any);
if (typeof loadEnvConfig === 'function') {
  loadEnvConfig(process.cwd());
}

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/qcet_eoffice')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@qcet/db/prisma';
import {
  BodyMemberRole,
  JobCatalogGroup,
  MeetingParticipantRole,
  OrganizationalBodyType,
  UnitType,
  UserRole,
} from '@prisma/client';
import { readMeetingDetailPageData } from '../../apps/api/src/server/services/meeting-detail-page-data';

const DAY_MS = 86_400_000;

// Trang /meetings/[id] phải áp cùng quy tắc meeting.read với GET /api/meetings/[id]:
// người không có quan hệ với cuộc họp không đọc được chi tiết (trang trả notFound()).
describe('Trang chi tiết cuộc họp: kiểm quyền đọc theo đối tượng (BOLA)', () => {
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const SECRET_AGENDA = `Nội dung mật ${runId}`;

  let unitA: any;
  let unitB: any;
  let body: any;
  let meeting: any;
  const users: Record<string, any> = {};
  const positionAssignmentIds: string[] = [];

  const makeUser = (key: string) =>
    prisma.user.create({
      data: {
        email: `mdp_${key}_${runId}@qnc.edu.vn`,
        name: `Người dùng ${key} ${runId}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

  before(async () => {
    unitA = await prisma.organizationalUnit.create({
      data: { code: `OU_MDP_A_${runId}`, name: `Đơn vị A ${runId}`, type: UnitType.DEPARTMENT },
    });
    unitB = await prisma.organizationalUnit.create({
      data: { code: `OU_MDP_B_${runId}`, name: `Đơn vị B ${runId}`, type: UnitType.DEPARTMENT },
    });

    for (const key of ['organizer', 'attendee', 'bodyMember', 'unitLeader', 'otherUnitLeader', 'outsider']) {
      users[key] = await makeUser(key);
    }

    // Định nghĩa chức vụ dùng chung giữa các test: chỉ upsert, không xóa.
    const leaderPosition = await prisma.positionDefinition.upsert({
      where: { code: 'TRUONG_DON_VI' },
      update: {},
      create: { code: 'TRUONG_DON_VI', title: 'Trưởng đơn vị', group: JobCatalogGroup.LDPU, isLeadership: true },
    });
    for (const [userKey, unit] of [['unitLeader', unitA], ['otherUnitLeader', unitB]] as const) {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: users[userKey].id,
          positionDefinitionId: leaderPosition.id,
          unitId: unit.id,
          type: 'PRIMARY',
          status: 'ACTIVE',
          effectiveFrom: new Date(Date.now() - DAY_MS),
        },
      });
      positionAssignmentIds.push(assignment.id);
    }

    body = await prisma.organizationalBody.create({
      data: { code: `BODY_MDP_${runId}`, name: `Hội đồng ${runId}`, type: OrganizationalBodyType.COUNCIL },
    });
    await prisma.bodyMembership.create({
      data: { bodyId: body.id, userId: users.bodyMember.id, role: BodyMemberRole.MEMBER },
    });

    meeting = await prisma.meeting.create({
      data: {
        code: `MT_MDP_${runId}`,
        title: `Họp kín ${runId}`,
        unitId: unitA.id,
        bodyId: body.id,
        organizerId: users.organizer.id,
        startTime: new Date(Date.now() + 2 * DAY_MS),
        agenda: SECRET_AGENDA,
        participants: {
          create: [{ userId: users.attendee.id, role: MeetingParticipantRole.ATTENDEE }],
        },
      },
    });
  });

  after(async () => {
    if (meeting) {
      await prisma.meetingParticipant.deleteMany({ where: { meetingId: meeting.id } });
      await prisma.meeting.delete({ where: { id: meeting.id } });
    }
    if (body) {
      await prisma.bodyMembership.deleteMany({ where: { bodyId: body.id } });
      await prisma.organizationalBody.delete({ where: { id: body.id } });
    }
    if (positionAssignmentIds.length > 0) {
      await prisma.positionAssignment.deleteMany({ where: { id: { in: positionAssignmentIds } } });
    }
    const userIds = Object.values(users).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const unitIds = [unitA?.id, unitB?.id].filter(Boolean);
    if (unitIds.length > 0) {
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
    }
  });

  test('người ngoài (không quan hệ, không chức vụ) nhận null, không lộ nội dung', async () => {
    const data = await readMeetingDetailPageData(meeting.id, users.outsider.id);
    assert.equal(data, null);
  });

  test('trưởng đơn vị khác nhận null (ranh giới đơn vị)', async () => {
    const data = await readMeetingDetailPageData(meeting.id, users.otherUnitLeader.id);
    assert.equal(data, null);
  });

  test('id cuộc họp không tồn tại nhận null', async () => {
    const data = await readMeetingDetailPageData(`missing_${runId}`, users.organizer.id);
    assert.equal(data, null);
  });

  test('không có userId nhận null (getMeeting không kiểm quyền khi thiếu người gọi)', async () => {
    const data = await readMeetingDetailPageData(meeting.id, '');
    assert.equal(data, null);
  });

  for (const [label, userKey] of [
    ['người tổ chức', 'organizer'],
    ['người tham dự (ATTENDEE)', 'attendee'],
    ['thành viên hội đồng của cuộc họp', 'bodyMember'],
    ['trưởng đơn vị của cuộc họp', 'unitLeader'],
  ] as const) {
    test(`${label} đọc được chi tiết cuộc họp`, async () => {
      const data = await readMeetingDetailPageData(meeting.id, users[userKey].id);
      assert.ok(data, `${label} phải đọc được cuộc họp`);
      assert.equal(data.id, meeting.id);
      assert.equal(data.agenda, SECRET_AGENDA);
      assert.equal(data.startTime, meeting.startTime.toISOString());
    });
  }

  // 20/10/2026: trang hiện "Dự thảo, chờ duyệt" và nút Duyệt theo vai trò lãnh đạo, trong khi máy chủ chỉ cho chủ tọa duyệt
  test('trả các thao tác máy chủ cho phép: chỉ chủ tọa duyệt biên bản, thư ký soạn biên bản thì không', async () => {
    const draft = await prisma.meeting.create({
      data: {
        code: `MT_MDP_DRAFT_${runId}`,
        title: `Họp đã soạn biên bản ${runId}`,
        unitId: unitA.id,
        organizerId: users.organizer.id,
        startTime: new Date(Date.now() - DAY_MS),
        status: 'MINUTES_DRAFT',
        minutes: 'Biên bản dự thảo',
        participants: {
          create: [
            { userId: users.bodyMember.id, role: MeetingParticipantRole.CHAIR },
            { userId: users.attendee.id, role: MeetingParticipantRole.SECRETARY },
          ],
        },
      },
    });
    try {
      const chair = await readMeetingDetailPageData(draft.id, users.bodyMember.id);
      assert.ok(chair?.availableActions.includes('meeting.confirm_minutes'), 'chủ tọa duyệt được');
      const secretary = await readMeetingDetailPageData(draft.id, users.attendee.id);
      assert.ok(secretary, 'thư ký đọc được cuộc họp');
      assert.equal(secretary.availableActions.includes('meeting.confirm_minutes'), false, 'thư ký không tự duyệt biên bản mình soạn');
      const organizer = await readMeetingDetailPageData(draft.id, users.organizer.id);
      assert.equal(organizer?.availableActions.includes('meeting.confirm_minutes'), false, 'người tổ chức không phải chủ tọa thì không duyệt');
    } finally {
      await prisma.meetingParticipant.deleteMany({ where: { meetingId: draft.id } });
      await prisma.meeting.delete({ where: { id: draft.id } });
    }
  });
});

describe('Trang chi tiết cuộc họp: metadata không đọc dữ liệu được bảo vệ', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/src/app/meetings/[id]/page.tsx'), 'utf8');

  test('generateMetadata trả tiêu đề tĩnh, không gọi service hay prisma', () => {
    const match = source.match(/export async function generateMetadata[\s\S]*?\n\}\n/);
    assert.ok(match, 'page.tsx phải có generateMetadata');
    const metadataSource = match[0];
    assert.doesNotMatch(metadataSource, /await|readMeeting|MeetingService|prisma/);
    assert.match(metadataSource, /title:\s*"Cuộc họp"/);
  });

  test('trang truyền người dùng hiện tại vào bước đọc dữ liệu có kiểm quyền', () => {
    // Bước đọc dữ liệu chuyển sang GET /api/page-data/meetings/[id]; trang gọi API đó
    const route = fs.readFileSync(path.join(process.cwd(), 'apps/api/src/app/api/page-data/meetings/[id]/route.ts'), 'utf8');
    assert.ok(!source.includes('readMeetingTitle'), 'không còn đọc tiêu đề cuộc họp mà không kiểm quyền');
    assert.match(route, /readMeetingDetailPageData\(id, userId\)/);
  });
});
