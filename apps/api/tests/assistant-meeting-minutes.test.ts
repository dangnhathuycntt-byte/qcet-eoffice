/**
 * Trợ lý soạn biên bản cuộc họp (người dùng yêu cầu 21/10/2026: bấm "Tạo biên bản" thì mở Trợ lý, Trợ lý xử lý bản ghi rồi
 * đề xuất biên bản): đọc cuộc họp và kết quả bản ghi theo quyền, chờ bản ghi đang soạn có trần, và thẻ lưu dự thảo biên bản
 * chỉ thực hiện khi chính người hỏi duyệt (ADR-012), không lưu chồng khi cuộc họp đã đổi.
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

import { MeetingParticipantRole, MeetingRecordingStatus, MeetingStatus } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import type { SessionPayload } from '@/lib/jwt-session';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { describeAssistantContext, runAssistantTool, type AssistantToolContext } from '@/server/assistant/assistant-tools';
import { waitWhileProcessing } from '@/server/assistant/assistant-tool-meetings';
import { decideAssistantAction } from '@/server/assistant/assistant-actions';
import { MeetingService } from '@/server/services/meeting-service';

const runId = crypto.randomBytes(4).toString('hex');
const TODAY = '2026-10-21';
const u: Record<string, { id: string; name: string }> = {};
const conversations: Record<string, string> = {};
let heldId = '';
let invitedId = '';
let recordingId = '';

const session = (key: string) => ({ id: u[key].id, email: `${key}@x`, name: u[key].name, role: 'CHUYEN_VIEN' }) as unknown as SessionPayload;

async function contextFor(key: string): Promise<AssistantToolContext> {
  conversations[key] ??= (await prisma.assistantConversation.create({ data: { userId: u[key].id, title: 'Thử biên bản' } })).id;
  return { authz: await loadAuthorizationContext(u[key].id), userId: u[key].id, today: TODAY, conversationId: conversations[key] };
}

const payloadOf = (content: string) => JSON.parse(content) as Record<string, unknown>;

describe('Trợ lý: soạn biên bản cuộc họp từ bản ghi âm', () => {
  before(async () => {
    for (const key of ['organizer', 'attendee', 'stranger']) {
      u[key] = await prisma.user.create({
        data: { email: `min_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
        select: { id: true, name: true },
      });
    }
    const meeting = (status: MeetingStatus, title: string) =>
      prisma.meeting.create({
        data: {
          title,
          organizerId: u.organizer.id,
          status,
          startTime: new Date('2026-10-20T01:00:00.000Z'),
          agenda: 'Rà soát nhân sự học kỳ 1',
          participants: {
            create: [
              { userId: u.organizer.id, role: MeetingParticipantRole.SECRETARY },
              { userId: u.attendee.id, role: MeetingParticipantRole.ATTENDEE },
            ],
          },
        },
        select: { id: true },
      });
    heldId = (await meeting(MeetingStatus.HELD, `Họp giao ban ${runId}`)).id;
    invitedId = (await meeting(MeetingStatus.INVITED, `Họp sắp tới ${runId}`)).id;
    recordingId = (
      await prisma.meetingRecording.create({
        data: {
          meetingId: heldId,
          createdById: u.organizer.id,
          source: 'live',
          mimeType: 'audio/webm',
          status: MeetingRecordingStatus.READY,
          durationSec: 600,
          minutesDraft: 'Nội dung thảo luận:\n- Rà soát vị trí việc làm\n\nKết luận:\n- Đơn vị thiếu nhân sự',
          decisions: ['Giữ kiêm nhiệm vị trí dạy học số'],
          actionItems: [{ task: 'Lập danh sách vị trí khuyết', owner: 'Phòng Tổ chức', deadline: null }],
        },
        select: { id: true },
      })
    ).id;
  });

  after(async () => {
    const ids = Object.values(u).map((user) => user.id);
    await prisma.assistantConversation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityId: { in: [heldId, invitedId] } }, { actorId: { in: ids } }] } });
    await prisma.meeting.deleteMany({ where: { id: { in: [heldId, invitedId] } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('get_meeting: người soạn biên bản thấy bản ghi; người dự họp thấy cuộc họp nhưng không thấy bản ghi; người ngoài nhận "không tìm thấy"', async () => {
    const own = await runAssistantTool('get_meeting', JSON.stringify({ id: heldId }), await contextFor('organizer'));
    assert.equal(own.ok, true, own.content);
    const data = payloadOf(own.content);
    assert.equal(data.status, 'Đã họp');
    assert.equal(data.canDraftMinutes, true);
    assert.deepEqual(data.secretary, [u.organizer.name]);
    const recordings = data.recordings as Array<Record<string, unknown>>;
    assert.equal(recordings.length, 1);
    assert.equal(recordings[0].id, recordingId);
    assert.equal(recordings[0].status, 'Đã soạn xong');
    assert.equal(own.detailed, true);
    assert.equal(own.sources[0]?.type, 'meeting');

    const attendee = payloadOf((await runAssistantTool('get_meeting', JSON.stringify({ id: heldId }), await contextFor('attendee'))).content);
    assert.equal(attendee.recordings, null);
    assert.match(String(attendee.recordingsNote), /Chỉ chủ tọa, thư ký hoặc người tổ chức/);
    assert.equal(attendee.canDraftMinutes, false);

    const stranger = await runAssistantTool('get_meeting', JSON.stringify({ id: heldId }), await contextFor('stranger'));
    assert.equal(stranger.ok, false);
    assert.match(String(payloadOf(stranger.content).error), /Không tìm thấy hoặc Thầy\/Cô không có quyền xem/);
  });

  it('get_meeting_recording: trả biên bản đề xuất, quyết định, việc được giao; người dự họp không phải người soạn thì không đọc được', async () => {
    const own = await runAssistantTool('get_meeting_recording', JSON.stringify({ meetingId: heldId, recordingId }), await contextFor('organizer'));
    assert.equal(own.ok, true, own.content);
    const data = payloadOf(own.content);
    assert.match(String(data.minutesDraft), /Rà soát vị trí việc làm/);
    assert.deepEqual(data.decisions, ['Giữ kiêm nhiệm vị trí dạy học số']);
    assert.equal((data.actionItems as Array<Record<string, unknown>>)[0].owner, 'Phòng Tổ chức');
    assert.equal(data.note, undefined);

    const attendee = await runAssistantTool('get_meeting_recording', JSON.stringify({ meetingId: heldId, recordingId }), await contextFor('attendee'));
    assert.equal(attendee.ok, false);
  });

  it('chờ bản ghi đang soạn: xong thì trả trạng thái cuối; quá trần hoặc bị Dừng thì báo hết giờ, không chờ thêm', async () => {
    let clock = 0;
    const fake = { now: () => clock, wait: async (ms: number) => void (clock += ms), pollMs: 3000, maxMs: 9000 };
    const sequence = ['PROCESSING', 'PROCESSING', 'READY'];
    let reads = 0;
    const done = await waitWhileProcessing(async () => sequence[Math.min(reads++, sequence.length - 1)], fake);
    assert.deepEqual(done, { status: 'READY', timedOut: false });
    assert.equal(reads, 3);

    clock = 0;
    const slow = await waitWhileProcessing(async () => 'QUEUED', fake);
    assert.deepEqual(slow, { status: 'QUEUED', timedOut: true });
    assert.ok(clock <= 9000, 'không chờ quá trần');

    const controller = new AbortController();
    controller.abort();
    let polled = 0;
    const stopped = await waitWhileProcessing(async () => (polled++, 'PROCESSING'), { ...fake, signal: controller.signal });
    assert.equal(stopped.timedOut, true);
    assert.equal(polled, 1, 'Dừng thì không hỏi lại');
  });

  it('propose_minutes chỉ lưu thẻ; duyệt mới lưu dự thảo (Đã họp → Dự thảo biên bản), không hoàn tác được; biên bản dài 9.000 ký tự vẫn soạn được', async () => {
    const minutes = `Nội dung thảo luận:\n- ${'Rà soát nhân sự. '.repeat(560)}`.slice(0, 9000);
    const outcome = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId, minutes }), await contextFor('organizer'));
    assert.equal(outcome.ok, true, outcome.content);
    assert.ok(outcome.action);
    assert.equal(outcome.action.status, 'pending');
    const view = outcome.action.view;
    assert.ok(view.kind === 'meeting_minutes');
    assert.equal(view.replaces, false);
    assert.equal(view.from, 'HELD');
    let meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: heldId } });
    assert.equal(meeting.minutes, null, 'chưa duyệt thì chưa có biên bản');

    const approved = await decideAssistantAction(session('organizer'), outcome.action.id, 'approve');
    assert.equal(approved.status, 'done');
    assert.equal(approved.undoable, false);
    meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: heldId } });
    assert.equal(meeting.status, MeetingStatus.MINUTES_DRAFT);
    assert.equal(meeting.minutes, minutes.trim());
  });

  it('đã có dự thảo thì thẻ ghi "thay"; cuộc họp đổi từ lúc soạn (người khác vừa sửa) thì không lưu chồng', async () => {
    const outcome = await runAssistantTool(
      'propose_minutes',
      JSON.stringify({ meetingId: heldId, minutes: 'Kết luận:\n- Bản sửa của Trợ lý' }),
      await contextFor('organizer')
    );
    assert.equal(outcome.ok, true, outcome.content);
    assert.ok(outcome.action?.view.kind === 'meeting_minutes' && outcome.action.view.replaces);

    await MeetingService.draftMinutes(heldId, { minutes: 'Kết luận:\n- Thư ký vừa sửa tay' }, u.organizer.id);
    const failed = await decideAssistantAction(session('organizer'), outcome.action!.id, 'approve');
    assert.equal(failed.status, 'failed');
    assert.match(failed.error ?? '', /đã thay đổi từ lúc soạn/);
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: heldId } });
    assert.equal(meeting.minutes, 'Kết luận:\n- Thư ký vừa sửa tay', 'không ghi đè bản vừa sửa');
  });

  it('người không có quyền soạn biên bản và cuộc họp chưa diễn ra thì không soạn được thẻ', async () => {
    // Đếm theo người của file này: file test khác chạy song song cũng tạo thẻ
    const mine = { where: { userId: { in: [u.attendee.id, u.organizer.id] } } };
    const before = await prisma.assistantAction.count(mine);
    const attendee = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId, minutes: 'Kết luận:\n- Thử' }), await contextFor('attendee'));
    assert.equal(attendee.ok, false);
    assert.match(String(payloadOf(attendee.content).error), /không có quyền soạn biên bản/);
    const invited = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: invitedId, minutes: 'Kết luận:\n- Thử' }), await contextFor('organizer'));
    assert.equal(invited.ok, false);
    assert.match(String(payloadOf(invited.content).error), /Bắt đầu họp/);
    assert.equal(await prisma.assistantAction.count(mine), before, 'không lưu thẻ nào');
  });

  it('ngữ cảnh "meeting": cuộc trò chuyện mở từ trang cuộc họp có tóm tắt cuộc họp; người ngoài không có', async () => {
    const own = await describeAssistantContext(await contextFor('organizer'), { type: 'meeting', id: heldId });
    assert.ok(own);
    assert.equal(own.source.type, 'meeting');
    assert.match(own.summary, new RegExp(`Họp giao ban ${runId}`));
    // Người soạn biên bản thấy id bản ghi ngay trong ngữ cảnh để gọi thẳng get_meeting_recording; người dự họp chỉ thấy số bản
    assert.match(own.summary, /Bản ghi âm: 1/);
    assert.ok(own.summary.includes(`- id ${recordingId}: "Ghi trực tiếp"`), own.summary);
    const attendee = await describeAssistantContext(await contextFor('attendee'), { type: 'meeting', id: heldId });
    assert.ok(attendee);
    assert.match(attendee.summary, /Bản ghi âm: 1 \(chỉ chủ tọa, thư ký, người tổ chức xem được\)/);
    assert.equal(attendee.summary.includes(recordingId), false);
    assert.equal(await describeAssistantContext(await contextFor('stranger'), { type: 'meeting', id: heldId }), null);
  });

  // Người dùng hỏi 21/10/2026 "sao có biên bản rồi mà bên trợ lý chưa xong": mô hình chép lại cả biên bản vào tham số mất
  // hơn một phút. Nay truyền recordingId, máy chủ ghép đúng chữ "Dùng làm biên bản nháp" điền vào ô soạn
  it('propose_minutes với recordingId: thẻ mang biên bản đề xuất + Quyết định + Việc được giao của bản ghi; bản chưa soạn xong hay truyền cả hai thì không soạn thẻ', async () => {
    const checks = ['Tên "anh Vinh" nghe chưa rõ', '  Mã   D1 đến D8  '];
    const outcome = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId, recordingId, checks }), await contextFor('organizer'));
    assert.equal(outcome.ok, true, outcome.content);
    assert.ok(outcome.action && outcome.action.view.kind === 'meeting_minutes');
    // Thẻ ghi nguồn (bản ghi) và các chỗ cần kiểm để hiện sát nút duyệt
    assert.deepEqual(outcome.action.view.recording, { id: recordingId, name: 'Ghi trực tiếp' });
    assert.deepEqual(outcome.action.view.checks, ['Tên "anh Vinh" nghe chưa rõ', 'Mã D1 đến D8']);
    assert.equal(
      outcome.action.view.minutes,
      'Nội dung thảo luận:\n- Rà soát vị trí việc làm\n\nKết luận:\n- Đơn vị thiếu nhân sự\n\nQuyết định:\n- Giữ kiêm nhiệm vị trí dạy học số\n\nViệc được giao:\n- Lập danh sách vị trí khuyết (Phòng Tổ chức)'
    );

    const queued = await prisma.meetingRecording.create({
      data: { meetingId: heldId, createdById: u.organizer.id, source: 'file', fileName: 'chua-xong.m4a', mimeType: 'audio/mp4', status: MeetingRecordingStatus.QUEUED },
      select: { id: true },
    });
    try {
      const pending = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId, recordingId: queued.id }), await contextFor('organizer'));
      assert.equal(pending.ok, false);
      assert.match(String(payloadOf(pending.content).error), /chưa soạn xong \(Đang chờ soạn\)/);
    } finally {
      await prisma.meetingRecording.delete({ where: { id: queued.id } });
    }
    const both = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId, recordingId, minutes: 'Kết luận:\n- Thử' }), await contextFor('organizer'));
    assert.equal(both.ok, false);
    const neither = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId }), await contextFor('organizer'));
    assert.equal(neither.ok, false);
    const tooMany = await runAssistantTool('propose_minutes', JSON.stringify({ meetingId: heldId, recordingId, checks: Array(7).fill('Kiểm tên') }), await contextFor('organizer'));
    assert.equal(tooMany.ok, false, 'tối đa 6 chỗ cần kiểm');
  });
});
