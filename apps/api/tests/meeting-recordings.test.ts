/**
 * Ghi âm cuộc họp: quyền (cùng quan hệ với soạn biên bản, người đọc được cuộc họp nhưng không soạn biên bản bị từ chối,
 * người ngoài nhận 404), nhận âm thanh theo phần và ghép, việc chép lời bằng gateway giả (nối tiếp, thử lại, các đường lỗi),
 * xóa bản ghi cùng âm thanh. Không gọi mô hình thật. Mặc định tắt ffmpeg (gửi cả tệp) và tắt đường soạn thẳng từ ghi âm
 * (MEETING_AUDIO_DIRECT=off, để các nhóm trước kiểm đường chép từng đoạn); nhóm "soạn thẳng" bật lại đường nhanh, nhóm "cắt đoạn
 * bằng ffmpeg" bật lại ffmpeg và bị bỏ qua nếu máy chạy test không có ffmpeg kèm libmp3lame.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
import { MeetingParticipantRole, MeetingStatus } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { POST as createRoute, GET as listRoute } from '@/app/api/meetings/[id]/recordings/route';
import { PUT as partRoute } from '@/app/api/meetings/[id]/recordings/[recordingId]/parts/[index]/route';
import { MEETING_RECORDING_PART_MAX_BYTES, CreateMeetingRecordingSchema, CompleteMeetingRecordingSchema } from '@qcet/contracts/meeting-recordings';
import { MeetingRecordingService } from '@/server/meetings/recording-service';
import { transcribeMeeting } from '@/server/meetings/recording-job';
import { recordingAudioPath } from '@/server/meetings/recording-storage';
import { AudioSliceError, EMPTY_SLICE_BYTES, ffmpegAvailable, sliceAudio } from '@/server/meetings/recording-slicer';
import type { AgentJobContext } from '@/server/outbox/agent-jobs';

const runId = crypto.randomBytes(4).toString('hex');
const users: Record<'organizer' | 'participant' | 'stranger', string> = { organizer: '', participant: '', stranger: '' };
let meetingId = '';
let uploadsDir = '';
const realFetch = globalThis.fetch;
const savedEnv = new Map<string, string | undefined>();

const HAS_FFMPEG = (() => {
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-encoders'], { encoding: 'utf8' });
  return probe.status === 0 && probe.stdout.includes('libmp3lame');
})();

const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 7)]);
const create = (userId: string, overrides: Record<string, unknown> = {}, id = meetingId) =>
  MeetingRecordingService.create(id, CreateMeetingRecordingSchema.parse({ source: 'file', mimeType: 'audio/webm', consent: true, ...overrides }), userId);
const complete = (userId: string, recordingId: string, partCount: number, durationSec = 600) =>
  MeetingRecordingService.complete(meetingId, recordingId, CompleteMeetingRecordingSchema.parse({ partCount, durationSec }), userId);

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

interface GatewayCall {
  model: string;
  system: string;
  userText: string;
  filePart: { filename: string; file_data: string } | null;
}

/** Gateway giả: trả `content` theo loại lời nhắc (chép một đoạn hoặc soạn biên bản); ghi lại mọi lần gọi. */
function mockGateway(handler: (call: GatewayCall, index: number) => string | Response | Promise<string | Response>): GatewayCall[] {
  const calls: GatewayCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).includes('gateway.test')) return realFetch(input, init);
    const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ role: string; content: unknown }> };
    const user = body.messages[1].content;
    const parts = Array.isArray(user) ? (user as Array<{ type: string; text?: string; file?: { filename: string; file_data: string } }>) : null;
    const call: GatewayCall = {
      model: body.model,
      system: String(body.messages[0].content),
      userText: parts ? (parts.find((part) => part.type === 'text')?.text ?? '') : String(user),
      filePart: parts?.find((part) => part.type === 'file')?.file ?? null,
    };
    calls.push(call);
    const reply = await handler(call, calls.length - 1);
    if (reply instanceof Response) return reply;
    return new Response(JSON.stringify({ choices: [{ message: { content: reply }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

const MINUTES_JSON = JSON.stringify({
  minutes: 'Nội dung thảo luận\n- Kế hoạch học kỳ 2\nKết luận\n- Giao phòng Đào tạo',
  decisions: ['Giao phòng Đào tạo lập kế hoạch học kỳ 2'],
  actionItems: [{ task: 'Lập kế hoạch học kỳ 2', owner: 'Phòng Đào tạo', deadline: null }],
});

const isWindowCall = (call: GatewayCall) => call.filePart !== null;

function job(recordingId: string, attempt = 1): AgentJobContext {
  return {
    id: `job_${recordingId}`,
    type: 'TRANSCRIBE_MEETING',
    payload: { recordingId },
    actorId: users.organizer,
    idempotencyKey: `${recordingId}:test`,
    attempt,
    signal: new AbortController().signal,
    client: prisma,
  };
}

/** Bản ghi đã ghép sẵn và xếp hàng (QUEUED) với âm thanh thật trên đĩa. */
async function queuedRecording(durationSec: number) {
  const recording = await create(users.organizer);
  await MeetingRecordingService.uploadPart(meetingId, recording.id, 0, WEBM, users.organizer);
  await complete(users.organizer, recording.id, 1, durationSec);
  return recording.id;
}

const bearer = (key: keyof typeof users) => ({
  Authorization: `Bearer ${signSessionToken({ id: users[key], email: `rec_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN' })}`,
});
const meetingCtx = (id = meetingId) => ({ params: Promise.resolve({ id }) });

describe('Ghi âm cuộc họp', () => {
  before(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qcet-rec-'));
    setEnv({
      UPLOADS_DIR: uploadsDir,
      TASK_AGENT_BASE_URL: 'http://gateway.test/v1',
      TASK_AGENT_API_KEY: 'test-key',
      TASK_AGENT_MODEL: 'test-model',
      MEETING_AUDIO_MODEL: undefined,
      MEETING_AUDIO_FFMPEG: 'none',
      MEETING_AUDIO_DIRECT: 'off',
      AGENT_JOB_TIMEOUT_MS: undefined,
    });
    for (const key of Object.keys(users) as Array<keyof typeof users>) {
      users[key] = (
        await prisma.user.create({
          data: { email: `rec_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
          select: { id: true },
        })
      ).id;
    }
    meetingId = (
      await prisma.meeting.create({
        data: {
          title: `Họp ghi âm ${runId}`,
          organizerId: users.organizer,
          status: MeetingStatus.INVITED,
          startTime: new Date('2026-11-01T02:00:00.000Z'),
          participants: { create: [{ userId: users.participant, role: MeetingParticipantRole.ATTENDEE }] },
        },
        select: { id: true },
      })
    ).id;
  });

  beforeEach(async () => {
    globalThis.fetch = realFetch;
    await prisma.meetingRecording.deleteMany({ where: { meetingId } });
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: MeetingStatus.INVITED } });
    await fs.rm(path.join(uploadsDir, 'recordings'), { recursive: true, force: true });
  });

  after(async () => {
    globalThis.fetch = realFetch;
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await prisma.outboxEvent.deleteMany({ where: { eventType: 'AGENT_JOB_TRANSCRIBE_MEETING', payload: { path: ['actorId'], equals: users.organizer } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: Object.values(users).filter(Boolean) } } });
    await prisma.meetingRecording.deleteMany({ where: { meetingId } });
    await prisma.meetingParticipant.deleteMany({ where: { meetingId } });
    await prisma.meeting.deleteMany({ where: { id: meetingId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users).filter(Boolean) } } });
    await fs.rm(uploadsDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  describe('quyền', () => {
    it('người tổ chức mở, xem danh sách và chi tiết được', async () => {
      const recording = await create(users.organizer);
      assert.equal(recording.status, 'UPLOADING');
      assert.equal((await MeetingRecordingService.list(meetingId, users.organizer)).recordings.length, 1);
      assert.equal((await MeetingRecordingService.get(meetingId, recording.id, users.organizer)).id, recording.id);
      const audit = await prisma.auditEvent.findFirst({ where: { entityId: recording.id, action: 'MEETING_RECORDING_CREATED' } });
      assert.deepEqual(audit?.metadata, { meetingId, source: 'file' }, 'audit chỉ ghi mã, không ghi nội dung');
    });

    it('người dự họp thường (đọc được cuộc họp, không soạn biên bản) bị từ chối ở mọi thao tác', async () => {
      const recording = await create(users.organizer);
      await assert.rejects(create(users.participant), (error: { statusCode?: number }) => error.statusCode === 403);
      await assert.rejects(MeetingRecordingService.list(meetingId, users.participant), (error: { statusCode?: number }) => error.statusCode === 403);
      await assert.rejects(MeetingRecordingService.get(meetingId, recording.id, users.participant), (error: { statusCode?: number }) => error.statusCode === 403);
      await assert.rejects(MeetingRecordingService.uploadPart(meetingId, recording.id, 0, WEBM, users.participant), (error: { statusCode?: number }) => error.statusCode === 403);
      await assert.rejects(MeetingRecordingService.remove(meetingId, recording.id, users.participant), (error: { statusCode?: number }) => error.statusCode === 403);
      assert.ok(await prisma.meetingRecording.findUnique({ where: { id: recording.id } }), 'bản ghi còn nguyên');
    });

    it('người không liên quan nhận 404 (không lộ sự tồn tại), cuộc họp không có thì cũng 404', async () => {
      await assert.rejects(create(users.stranger), (error: { statusCode?: number }) => error.statusCode === 404);
      await assert.rejects(MeetingRecordingService.list(meetingId, users.stranger), (error: { statusCode?: number }) => error.statusCode === 404);
      await assert.rejects(MeetingRecordingService.list('khong_co_cuoc_hop', users.organizer), (error: { statusCode?: number }) => error.statusCode === 404);
    });

    it('cuộc họp đã hủy hoặc đã duyệt biên bản không ghi âm thêm được, nhưng vẫn xem và xóa được', async () => {
      const recording = await create(users.organizer);
      for (const status of [MeetingStatus.CANCELLED, MeetingStatus.MINUTES_CONFIRMED, MeetingStatus.DRAFT_AGENDA]) {
        await prisma.meeting.update({ where: { id: meetingId }, data: { status } });
        await assert.rejects(create(users.organizer), /không còn ghi âm được/, status);
        await assert.rejects(MeetingRecordingService.uploadPart(meetingId, recording.id, 0, WEBM, users.organizer), /không còn ghi âm được/, status);
        assert.equal((await MeetingRecordingService.list(meetingId, users.organizer)).recordings.length, 1, status);
      }
      await MeetingRecordingService.remove(meetingId, recording.id, users.organizer);
      assert.equal(await prisma.meetingRecording.count({ where: { meetingId } }), 0);
    });

    it('route: mở bản ghi 201 kèm cờ không lưu đệm, thiếu xác nhận 400, chưa đăng nhập 401', async () => {
      const post = (headers: Record<string, string>, body: unknown) =>
        createRoute(
          new NextRequest(`http://localhost:3000/api/meetings/${meetingId}/recordings`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
          meetingCtx()
        );
      const ok = await post(bearer('organizer'), { source: 'live', mimeType: 'audio/webm;codecs=opus', consent: true });
      assert.equal(ok.status, 201);
      assert.equal(ok.headers.get('cache-control'), 'private, no-store');
      assert.equal((await ok.json()).status, 'UPLOADING');
      assert.equal((await post(bearer('organizer'), { source: 'live', mimeType: 'audio/webm', consent: false })).status, 400);
      assert.equal((await post({}, { source: 'live', mimeType: 'audio/webm', consent: true })).status, 401);
      const forbidden = await listRoute(new NextRequest(`http://localhost:3000/api/meetings/${meetingId}/recordings`, { headers: bearer('participant') }), meetingCtx());
      assert.equal(forbidden.status, 403);
    });
  });

  describe('tải lên và ghép', () => {
    it('thiếu phần thì không hoàn tất và bản ghi vẫn nhận bù; đủ phần thì QUEUED, ghép đúng thứ tự, xếp một việc chép lời', async () => {
      const recording = await create(users.organizer);
      await MeetingRecordingService.uploadPart(meetingId, recording.id, 0, WEBM, users.organizer);
      await MeetingRecordingService.uploadPart(meetingId, recording.id, 2, Buffer.from('cc'), users.organizer);
      await assert.rejects(complete(users.organizer, recording.id, 3), /Chưa nhận đủ/);
      assert.equal((await prisma.meetingRecording.findUniqueOrThrow({ where: { id: recording.id } })).status, 'UPLOADING');

      await MeetingRecordingService.uploadPart(meetingId, recording.id, 1, Buffer.from('bb'), users.organizer);
      // Gửi lại phần 1 (thử lại sau lỗi mạng) ghi đè chứ không nhân đôi
      await MeetingRecordingService.uploadPart(meetingId, recording.id, 1, Buffer.from('bb'), users.organizer);
      const { recording: queued, jobId } = await complete(users.organizer, recording.id, 3, 1500);
      assert.equal(queued.status, 'QUEUED');
      assert.equal(queued.durationSec, 1500);
      assert.deepEqual(queued.progress, { done: 0, total: 3 });

      const audio = await fs.readFile(recordingAudioPath(recording.id));
      assert.equal(audio.length, WEBM.length + 4);
      assert.equal(audio.subarray(WEBM.length).toString(), 'bbcc');
      assert.deepEqual(await fs.readdir(path.join(uploadsDir, 'recordings', recording.id)), ['audio.bin'], 'các phần đã được dọn');

      const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: jobId } });
      assert.equal(event.eventType, 'AGENT_JOB_TRANSCRIBE_MEETING');
      assert.equal(event.aggregateId, `${recording.id}:0`);
      assert.equal(JSON.stringify(event.payload).includes('WEBM'), false);

      await assert.rejects(complete(users.organizer, recording.id, 3), /đã được gửi đi xử lý/, 'không hoàn tất hai lần');
      await assert.rejects(MeetingRecordingService.uploadPart(meetingId, recording.id, 3, Buffer.from('dd'), users.organizer), /không còn nhận thêm/);
    });

    it('tệp không phải âm thanh (byte đầu lạ) bị từ chối và bản ghi bị bỏ', async () => {
      const recording = await create(users.organizer);
      await MeetingRecordingService.uploadPart(meetingId, recording.id, 0, Buffer.from('%PDF-1.7 giả làm âm thanh'), users.organizer);
      await assert.rejects(complete(users.organizer, recording.id, 1), /không phải âm thanh/);
      assert.equal(await prisma.meetingRecording.count({ where: { id: recording.id } }), 0);
      await assert.rejects(fs.stat(path.join(uploadsDir, 'recordings', recording.id)), /ENOENT/);
    });

    it('mime khai báo sai được sửa theo nội dung thật', async () => {
      const recording = await create(users.organizer, { mimeType: 'audio/mpeg' });
      await MeetingRecordingService.uploadPart(meetingId, recording.id, 0, WEBM, users.organizer);
      await complete(users.organizer, recording.id, 1);
      assert.equal((await prisma.meetingRecording.findUniqueOrThrow({ where: { id: recording.id } })).mimeType, 'audio/webm');
    });

    it('phần rỗng, phần quá 8 MB, số thứ tự ngoài khoảng và tổng quá giới hạn đều bị chặn', async () => {
      const recording = await create(users.organizer);
      await assert.rejects(MeetingRecordingService.uploadPart(meetingId, recording.id, 0, Buffer.alloc(0), users.organizer), /rỗng/);
      await assert.rejects(
        MeetingRecordingService.uploadPart(meetingId, recording.id, 0, Buffer.alloc(MEETING_RECORDING_PART_MAX_BYTES + 1), users.organizer),
        (error: { statusCode?: number }) => error.statusCode === 413
      );
      await assert.rejects(MeetingRecordingService.uploadPart(meetingId, recording.id, 400, WEBM, users.organizer), /Số thứ tự/);
      await assert.rejects(MeetingRecordingService.uploadPart(meetingId, recording.id, -1, WEBM, users.organizer), /Số thứ tự/);
      for (let index = 0; index < 6; index += 1) {
        await MeetingRecordingService.uploadPart(meetingId, recording.id, index, Buffer.alloc(MEETING_RECORDING_PART_MAX_BYTES), users.organizer);
      }
      await assert.rejects(
        MeetingRecordingService.uploadPart(meetingId, recording.id, 6, Buffer.alloc(MEETING_RECORDING_PART_MAX_BYTES), users.organizer),
        (error: { statusCode?: number }) => error.statusCode === 413,
        'tổng 7 × 8 MB vượt 48 MB'
      );
    });

    it('không có ffmpeg: tệp báo trước quá 48 MB bị từ chối ngay (413), vừa 48 MB thì mở được; trần của hợp đồng là 128 MB', async () => {
      const MB = 1024 * 1024;
      await assert.rejects(create(users.organizer, { byteSize: 49 * MB }), (error: { statusCode?: number }) => error.statusCode === 413);
      assert.equal((await create(users.organizer, { byteSize: 48 * MB })).status, 'UPLOADING');
      assert.equal(CreateMeetingRecordingSchema.safeParse({ source: 'file', mimeType: 'audio/webm', consent: true, byteSize: 128 * MB }).success, true);
      assert.equal(CreateMeetingRecordingSchema.safeParse({ source: 'file', mimeType: 'audio/webm', consent: true, byteSize: 128 * MB + 1 }).success, false);
    });

    it('route PUT phần: nhận byte thô, từ chối người dự họp thường và chưa đăng nhập', async () => {
      const recording = await create(users.organizer);
      const put = (headers: Record<string, string>, index: string, body: Buffer = WEBM) =>
        partRoute(
          new NextRequest(`http://localhost:3000/api/meetings/${meetingId}/recordings/${recording.id}/parts/${index}`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/octet-stream' },
            body: new Uint8Array(body),
          }),
          { params: Promise.resolve({ id: meetingId, recordingId: recording.id, index }) }
        );
      assert.equal((await put(bearer('organizer'), '0')).status, 200);
      assert.equal((await put(bearer('organizer'), 'abc')).status, 400);
      assert.equal((await put(bearer('participant'), '1')).status, 403);
      assert.equal((await put({}, '1')).status, 401);
      assert.deepEqual(await fs.readdir(path.join(uploadsDir, 'recordings', recording.id)), ['00000.part']);
    });

    it('mỗi cuộc họp tối đa 10 bản ghi, bản tải lên bỏ dở quá 24 giờ được dọn khi mở bản mới', async () => {
      for (let i = 0; i < 10; i += 1) await create(users.organizer);
      await assert.rejects(create(users.organizer), /tối đa 10 bản ghi/);

      const stale = await prisma.meetingRecording.findFirstOrThrow({ where: { meetingId } });
      await MeetingRecordingService.uploadPart(meetingId, stale.id, 0, WEBM, users.organizer);
      await prisma.meetingRecording.update({ where: { id: stale.id }, data: { updatedAt: new Date(Date.now() - 25 * 3600_000) } });
      const fresh = await create(users.organizer);
      assert.ok(fresh.id);
      assert.equal(await prisma.meetingRecording.count({ where: { id: stale.id } }), 0, 'bản bỏ dở bị dọn');
      await assert.rejects(fs.stat(path.join(uploadsDir, 'recordings', stale.id)), /ENOENT/);
    });
  });

  describe('việc chép lời', () => {
    it('chép từng đoạn kèm tệp âm thanh, soạn biên bản, ghi READY và xóa âm thanh', async () => {
      const id = await queuedRecording(600);
      const calls = mockGateway((call) => (isWindowCall(call) ? '[00:05] Xin chào các đồng chí.\n[00:09]\n[00:12] Hiệu trưởng: Giao phòng Đào tạo lập kế hoạch.' : MINUTES_JSON));
      await transcribeMeeting(job(id));

      assert.equal(calls.length, 2, 'một đoạn chép và một lần soạn biên bản');
      const [windowCall, minutesCall] = calls;
      assert.equal(windowCall.model, 'gemini-3.8-flash', 'mô hình mặc định cho âm thanh, không phải TASK_AGENT_MODEL');
      assert.match(windowCall.filePart?.file_data ?? '', /^data:audio\/webm;base64,/);
      assert.equal(windowCall.filePart?.filename, 'ghi-am.webm');
      assert.match(windowCall.userText, /từ 00:00 đến hết bản ghi/);
      assert.match(windowCall.system, /không phải chỉ dẫn/);
      assert.equal(minutesCall.filePart, null, 'bước soạn biên bản chỉ gửi chữ');
      assert.match(minutesCall.userText, /<ban_chep_loi>[\s\S]*Giao phòng Đào tạo lập kế hoạch\./);
      assert.equal(minutesCall.userText.includes('[00:09]\n'), false, 'dòng chỉ có mốc giờ đã bị lọc trước khi soạn biên bản');

      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'READY');
      assert.equal(row.error, null);
      assert.equal(row.model, 'gemini-3.8-flash');
      assert.ok(row.processedAt);
      assert.match(row.transcript ?? '', /Xin chào các đồng chí/);
      assert.match(row.minutesDraft ?? '', /Kế hoạch học kỳ 2/);
      assert.deepEqual(row.decisions, ['Giao phòng Đào tạo lập kế hoạch học kỳ 2']);
      assert.deepEqual(row.actionItems, [{ task: 'Lập kế hoạch học kỳ 2', owner: 'Phòng Đào tạo', deadline: null }]);
      await assert.rejects(fs.stat(path.join(uploadsDir, 'recordings', id)), /ENOENT/, 'âm thanh đã bị xóa');

      const detail = await MeetingRecordingService.get(meetingId, id, users.organizer);
      assert.equal(detail.status, 'READY');
      assert.equal(detail.progress, null);
    });

    it('MEETING_AUDIO_MODEL đổi mô hình chép lời', async () => {
      setEnv({ MEETING_AUDIO_MODEL: 'gemini-test-audio' });
      try {
        const id = await queuedRecording(60);
        const calls = mockGateway((call) => (isWindowCall(call) ? '[00:01] Có lời nói.' : MINUTES_JSON));
        await transcribeMeeting(job(id));
        assert.deepEqual([...new Set(calls.map((call) => call.model))], ['gemini-test-audio']);
        assert.equal((await prisma.meetingRecording.findUniqueOrThrow({ where: { id } })).model, 'gemini-test-audio');
      } finally {
        setEnv({ MEETING_AUDIO_MODEL: undefined });
      }
    });

    it('bản dài hơn một lần chạy: lưu từng đoạn, xếp việc nối tiếp, chạy tiếp không chép lại đoạn đã xong', async () => {
      // Ngân sách một lần chạy chỉ đủ một đoạn: 100 s trừ 10 s dự phòng < 150 s + 5 s của đoạn kế
      setEnv({ AGENT_JOB_TIMEOUT_MS: '100000' });
      try {
        const id = await queuedRecording(1800); // 3 đoạn
        const calls = mockGateway((call, index) => (isWindowCall(call) ? `[00:0${index}] Đoạn số ${index}.` : MINUTES_JSON));

        await transcribeMeeting(job(id));
        let row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'PROCESSING');
        assert.equal((row.windows as unknown[]).length, 1);
        assert.equal(calls.length, 1);
        assert.deepEqual((await MeetingRecordingService.list(meetingId, users.organizer)).recordings[0].progress, { done: 1, total: 3 });
        const next = await prisma.outboxEvent.findFirst({ where: { aggregateId: `${id}:1` } });
        assert.equal(next?.eventType, 'AGENT_JOB_TRANSCRIBE_MEETING', 'việc nối tiếp khóa theo số đoạn đã xong');

        await transcribeMeeting(job(id));
        row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal((row.windows as unknown[]).length, 2);
        assert.ok(await prisma.outboxEvent.findFirst({ where: { aggregateId: `${id}:2` } }));

        await transcribeMeeting(job(id));
        row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'READY');
        const windowCalls = calls.filter(isWindowCall);
        assert.equal(windowCalls.length, 3, 'mỗi đoạn chép đúng một lần');
        assert.match(windowCalls[0].userText, /từ 00:00 đến 12:00/);
        assert.match(windowCalls[1].userText, /từ 12:00 đến 24:00/);
        assert.match(windowCalls[2].userText, /từ 24:00 đến hết bản ghi/);
        assert.deepEqual((row.transcript ?? '').split('\n').map((line) => line.replace(/^\[[^\]]+\] /, '')), ['Đoạn số 0.', 'Đoạn số 1.', 'Đoạn số 2.']);
      } finally {
        setEnv({ AGENT_JOB_TIMEOUT_MS: undefined });
      }
    });

    it('lỗi gateway: lần đầu ném để outbox thử lại và giữ bản ghi; lần thứ ba ghi FAILED rồi Thử lại chỉ chép đoạn còn thiếu', async () => {
      setEnv({ AGENT_JOB_TIMEOUT_MS: '100000' });
      try {
        const id = await queuedRecording(1800);
        // Đoạn 0 xong, rồi hết ngân sách (nối tiếp); đoạn 1 gặp lỗi gateway
        mockGateway(() => '[00:01] Đoạn đầu.');
        await transcribeMeeting(job(id));
        let fail = true;
        const calls = mockGateway((call, index) => {
          if (!isWindowCall(call)) return MINUTES_JSON;
          return fail ? new Response('{"error":"quá tải"}', { status: 500, headers: { 'content-type': 'application/json' } }) : `[00:0${index}] Đoạn bổ sung ${index}.`;
        });

        await assert.rejects(transcribeMeeting(job(id, 1)), /trả lỗi|thử lại/i);
        let row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'PROCESSING', 'lần đầu chưa kết luận lỗi');
        assert.equal((row.windows as unknown[]).length, 1, 'đoạn đã xong được giữ');

        await transcribeMeeting(job(id, 3));
        row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'FAILED');
        assert.ok(row.error && row.error.length <= 500);
        assert.ok(await fs.stat(recordingAudioPath(id)), 'bản lỗi giữ âm thanh để thử lại');

        fail = false;
        setEnv({ AGENT_JOB_TIMEOUT_MS: undefined });
        const { recording, jobId } = await MeetingRecordingService.retry(meetingId, id, users.organizer);
        assert.equal(recording.status, 'QUEUED');
        assert.ok(await prisma.outboxEvent.findUnique({ where: { id: jobId } }));
        const before = calls.length;
        await transcribeMeeting(job(id));
        row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'READY');
        const windowCallsAfterRetry = calls.slice(before).filter(isWindowCall);
        assert.equal(windowCallsAfterRetry.length, 2, 'chỉ chép hai đoạn còn thiếu, không chép lại đoạn 0');
        assert.match(windowCallsAfterRetry[0].userText, /từ 12:00 đến 24:00/);
        await assert.rejects(MeetingRecordingService.retry(meetingId, id, users.organizer), /Chỉ bản ghi bị lỗi/);
      } finally {
        setEnv({ AGENT_JOB_TIMEOUT_MS: undefined });
      }
    });

    it('âm thanh không có lời nói: FAILED với lời nhắn rõ, không gọi bước soạn biên bản', async () => {
      const id = await queuedRecording(60);
      const calls = mockGateway(() => '[00:01]\n[00:02]\n[00:03]');
      await transcribeMeeting(job(id));
      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'FAILED');
      assert.match(row.error ?? '', /Không nghe thấy lời nói/);
      assert.equal(calls.length, 1);
    });

    it('mô hình không trả JSON: giữ nguyên văn làm biên bản nháp; soạn biên bản lỗi tới lần cuối: READY chỉ với bản chép', async () => {
      const idRaw = await queuedRecording(60);
      mockGateway((call) => (isWindowCall(call) ? '[00:01] Có lời nói.' : 'Biên bản: cuộc họp bàn kế hoạch.'));
      await transcribeMeeting(job(idRaw));
      const raw = await prisma.meetingRecording.findUniqueOrThrow({ where: { id: idRaw } });
      assert.equal(raw.status, 'READY');
      assert.equal(raw.minutesDraft, 'Biên bản: cuộc họp bàn kế hoạch.');
      assert.deepEqual(raw.decisions, []);

      const idFail = await queuedRecording(60);
      mockGateway((call) => (isWindowCall(call) ? '[00:01] Có lời nói.' : new Response('{}', { status: 502 })));
      await assert.rejects(transcribeMeeting(job(idFail, 1)));
      assert.equal((await prisma.meetingRecording.findUniqueOrThrow({ where: { id: idFail } })).status, 'PROCESSING');
      await transcribeMeeting(job(idFail, 3));
      const partial = await prisma.meetingRecording.findUniqueOrThrow({ where: { id: idFail } });
      assert.equal(partial.status, 'READY');
      assert.match(partial.transcript ?? '', /Có lời nói/);
      assert.equal(partial.minutesDraft, null);
      assert.match(partial.error ?? '', /Chưa soạn được biên bản/);
    });

    it('gateway chưa cấu hình: không mở được bản ghi mới (503); bản đã xếp hàng thì FAILED ngay, không thử lại', async () => {
      const id = await queuedRecording(60);
      setEnv({ TASK_AGENT_BASE_URL: undefined });
      try {
        await assert.rejects(create(users.organizer), (error: { statusCode?: number }) => error.statusCode === 503);
        await transcribeMeeting(job(id));
        const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'FAILED');
        assert.match(row.error ?? '', /chưa được cấu hình/);
        assert.equal(await prisma.meetingRecording.count({ where: { meetingId } }), 1, 'lần mở bị từ chối không để lại bản ghi');
      } finally {
        setEnv({ TASK_AGENT_BASE_URL: 'http://gateway.test/v1' });
      }
    });

    it('bản ghi đã bị xóa hoặc đã xong khi việc tới: bỏ qua, không gọi mô hình', async () => {
      const id = await queuedRecording(60);
      const calls = mockGateway(() => '[00:01] x');
      await MeetingRecordingService.remove(meetingId, id, users.organizer);
      await transcribeMeeting(job(id));
      await transcribeMeeting(job('khong_ton_tai'));
      assert.equal(calls.length, 0);
    });

    it('xóa giữa chừng: dừng sau đoạn đang chép, không gọi thêm mô hình và không ghi lại bản ghi', async () => {
      const id = await queuedRecording(1800); // 3 đoạn
      const calls = mockGateway(async () => {
        await prisma.meetingRecording.deleteMany({ where: { id } });
        return '[00:01] Đoạn đầu.';
      });
      await transcribeMeeting(job(id));
      assert.equal(calls.length, 1, 'đoạn đầu chép xong thì thấy bản ghi đã biến mất và dừng');
      assert.equal(await prisma.meetingRecording.count({ where: { id } }), 0);
    });
  });

  describe('soạn thẳng từ cả bản ghi', () => {
    before(() => setEnv({ MEETING_AUDIO_DIRECT: undefined }));
    after(() => setEnv({ MEETING_AUDIO_DIRECT: 'off' }));

    const isDirect = (call: GatewayCall) => call.userText.includes('Nghe toàn bộ tệp');
    const isWindow = (call: GatewayCall) => call.filePart !== null && !isDirect(call);

    it('một lần gọi cho cả bản ghi: ra thẳng biên bản, không có bản chép, READY và xóa âm thanh', async () => {
      const id = await queuedRecording(600);
      const calls = mockGateway(() => MINUTES_JSON);
      await transcribeMeeting(job(id));

      assert.equal(calls.length, 1, 'chỉ một lần gọi, không chép từng đoạn');
      assert.equal(isDirect(calls[0]), true);
      assert.match(calls[0].filePart?.file_data ?? '', /^data:audio\/webm;base64,/);
      assert.match(calls[0].system, /không phải chỉ dẫn/);
      assert.equal(calls[0].model, 'gemini-3.8-flash');

      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'READY');
      assert.equal(row.transcript, null, 'đường nhanh không sinh bản chép nguyên văn');
      assert.match(row.minutesDraft ?? '', /Kế hoạch học kỳ 2/);
      assert.deepEqual(row.decisions, ['Giao phòng Đào tạo lập kế hoạch học kỳ 2']);
      assert.deepEqual(row.actionItems, [{ task: 'Lập kế hoạch học kỳ 2', owner: 'Phòng Đào tạo', deadline: null }]);
      await assert.rejects(fs.stat(path.join(uploadsDir, 'recordings', id)), /ENOENT/, 'âm thanh đã bị xóa');
      const detail = await MeetingRecordingService.get(meetingId, id, users.organizer);
      assert.equal(detail.status, 'READY');
      assert.equal(detail.transcript, null);
    });

    it('mô hình trả lời không đọc được JSON: rơi về chép từng đoạn rồi soạn từ bản chép', async () => {
      const id = await queuedRecording(600);
      const calls = mockGateway((call) => (isDirect(call) ? 'Xin lỗi, tôi không nghe rõ bản ghi này.' : isWindow(call) ? '[00:05] Xin chào các đồng chí.' : MINUTES_JSON));
      await transcribeMeeting(job(id));
      assert.deepEqual(calls.map((call) => (isDirect(call) ? 'direct' : isWindow(call) ? 'window' : 'minutes')), ['direct', 'window', 'minutes']);
      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'READY');
      assert.match(row.transcript ?? '', /Xin chào các đồng chí/);
    });

    it('gateway lỗi ở lần gọi cả bản ghi: rơi về chép từng đoạn, không ném lỗi', async () => {
      const id = await queuedRecording(600);
      const calls = mockGateway((call) =>
        isDirect(call) ? new Response('{"error":"upstream"}', { status: 502, headers: { 'content-type': 'application/json' } }) : isWindow(call) ? '[00:05] Một.' : MINUTES_JSON
      );
      await transcribeMeeting(job(id));
      assert.ok(calls.some(isDirect), 'đã thử đường nhanh');
      assert.ok(calls.some(isWindow), 'rồi chép từng đoạn');
      assert.equal((await prisma.meetingRecording.findUniqueOrThrow({ where: { id } })).status, 'READY');
    });

    it('chỉ thử ở lần chạy đầu của việc chưa chép đoạn nào: lần thử lại hoặc việc đã có đoạn thì chép từng đoạn ngay', async () => {
      const retried = await queuedRecording(600);
      const calls = mockGateway((call) => (call.filePart ? '[00:05] Một.' : MINUTES_JSON));
      await transcribeMeeting(job(retried, 2));
      assert.equal(calls.some(isDirect), false, 'lần thử thứ hai bỏ qua đường nhanh');
      assert.equal((await prisma.meetingRecording.findUniqueOrThrow({ where: { id: retried } })).status, 'READY');

      const resumed = await queuedRecording(1500);
      await prisma.meetingRecording.update({ where: { id: resumed }, data: { windows: [{ index: 0, startSec: 0, endSec: 720, text: '[00:01] Đã chép.' }] } });
      const calls2 = mockGateway((call) => (call.filePart ? '[12:05] Tiếp.' : MINUTES_JSON));
      await transcribeMeeting(job(resumed));
      assert.equal(calls2.some(isDirect), false, 'việc đã có đoạn chép thì không đổi đường');
    });

    it('MEETING_AUDIO_DIRECT=off: luôn chép từng đoạn', async () => {
      setEnv({ MEETING_AUDIO_DIRECT: 'off' });
      try {
        const id = await queuedRecording(60);
        const calls = mockGateway((call) => (call.filePart ? '[00:05] Một.' : MINUTES_JSON));
        await transcribeMeeting(job(id));
        assert.equal(calls.some(isDirect), false);
      } finally {
        setEnv({ MEETING_AUDIO_DIRECT: undefined });
      }
    });
  });

  describe('cắt đoạn bằng ffmpeg', { skip: !HAS_FFMPEG && 'máy chạy test không có ffmpeg kèm libmp3lame' }, () => {
    let mp3 = Buffer.alloc(0);
    const SECONDS = 800;

    before(async () => {
      setEnv({ MEETING_AUDIO_FFMPEG: undefined });
      const out = path.join(uploadsDir, 'sine.mp3');
      const made = spawnSync(
        'ffmpeg',
        ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=16000:duration=${SECONDS}`, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k', out],
        { encoding: 'utf8' }
      );
      assert.equal(made.status, 0, made.stderr);
      mp3 = await fs.readFile(out);
      assert.ok(mp3.byteLength < 8 * 1024 * 1024, 'vừa một phần tải lên');
    });

    after(() => setEnv({ MEETING_AUDIO_FFMPEG: 'none' }));

    async function queuedAudio(bytes: Buffer, durationSec: number) {
      const recording = await create(users.organizer, { mimeType: 'audio/mpeg' });
      await MeetingRecordingService.uploadPart(meetingId, recording.id, 0, bytes, users.organizer);
      await complete(users.organizer, recording.id, 1, durationSec);
      return recording.id;
    }

    it('sliceAudio: đoạn giữa tệp ra mp3 mono đúng độ dài, đoạn vượt cuối tệp rỗng, tệp hỏng báo lỗi tiếng Việt không kèm stderr', async () => {
      const id = await queuedAudio(mp3, SECONDS);
      const inputPath = recordingAudioPath(id);
      const slice = await sliceAudio(inputPath, 100, 60);
      assert.ok(slice[0] === 0xff || slice.toString('ascii', 0, 3) === 'ID3', 'mp3 hợp lệ');
      // 60 giây ở 32 kbps ≈ 240 KB
      assert.ok(slice.byteLength > 150_000 && slice.byteLength < 330_000, `kích thước ${slice.byteLength}`);
      const tail = await sliceAudio(inputPath, 700, null);
      assert.ok(tail.byteLength > 300_000 && tail.byteLength < 500_000, 'tới hết tệp (100 giây còn lại)');
      assert.ok((await sliceAudio(inputPath, SECONDS + 600, 60)).byteLength < EMPTY_SLICE_BYTES, 'vượt cuối tệp thì rỗng');

      const broken = path.join(uploadsDir, 'broken.bin');
      await fs.writeFile(broken, WEBM);
      await assert.rejects(sliceAudio(broken, 0, 60), (error: Error) => error instanceof AudioSliceError && /Không đọc được âm thanh/.test(error.message) && !/Invalid|ffmpeg/i.test(error.message));
    });

    it('ffmpegAvailable: tắt bằng none hoặc trỏ tới đường dẫn không có thì false, bật lại thì true', async () => {
      assert.equal(await ffmpegAvailable(), true);
      setEnv({ MEETING_AUDIO_FFMPEG: 'none' });
      assert.equal(await ffmpegAvailable(), false);
      await assert.rejects(sliceAudio('/nonexistent.mp3', 0, 10), AudioSliceError);
      setEnv({ MEETING_AUDIO_FFMPEG: '/nonexistent/ffmpeg' });
      assert.equal(await ffmpegAvailable(), false);
      setEnv({ MEETING_AUDIO_FFMPEG: undefined });
      assert.equal(await ffmpegAvailable(), true);
    });

    it('có ffmpeg: nhận tệp báo trước 100 MB (quá 48 MB nhưng trong trần 128 MB)', async () => {
      assert.equal((await create(users.organizer, { byteSize: 100 * 1024 * 1024 })).status, 'UPLOADING');
    });

    it('job chép từng đoạn 6 phút đã cắt: mỗi lần gửi mp3 riêng, mốc giờ cộng lại giờ bắt đầu đoạn, đoạn vượt cuối tệp không gọi mô hình', async () => {
      // Khai báo 1500 giây trong khi tệp thật 800 giây: 5 đoạn 6 phút, hai đoạn cuối (từ 18:00 và 24:00) rỗng
      const id = await queuedAudio(mp3, 1500);
      assert.equal((await MeetingRecordingService.get(meetingId, id, users.organizer)).progress?.total, 5, 'số đoạn hiển thị khớp cỡ đoạn 6 phút của việc chép lời');
      const calls = mockGateway((call) => (isWindowCall(call) ? '[00:05] Một.\n[00:20] Hai.' : MINUTES_JSON));
      await transcribeMeeting(job(id));

      const windowCalls = calls.filter(isWindowCall);
      assert.equal(windowCalls.length, 3, 'ba đoạn có âm thanh (0–6, 6–12, 12–13:20); hai đoạn sau rỗng nên không gọi');
      assert.equal(calls.length, 4, 'cộng một lần soạn biên bản');
      for (const call of windowCalls) {
        assert.match(call.filePart?.file_data ?? '', /^data:audio\/mpeg;base64,/);
        assert.equal(call.filePart?.filename, 'ghi-am.mp3');
        assert.match(call.userText, /đã được cắt riêng/);
      }
      const size = (index: number) => Buffer.from((windowCalls[index].filePart?.file_data ?? '').split(',')[1] ?? '', 'base64').byteLength;
      assert.ok(size(0) > 1_200_000 && size(0) < 1_700_000, `đoạn 6 phút ≈ 1,44 MB, thực ${size(0)}`);
      assert.ok(size(2) > 250_000 && size(2) < 450_000, `đoạn còn 80 giây ≈ 0,32 MB, thực ${size(2)}`);
      assert.match(windowCalls[1].userText, /từ 06:00 đến 12:00/);

      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'READY');
      assert.match(
        row.transcript ?? '',
        /\[00:05\] Một\.\n\[00:20\] Hai\.\n\[06:05\] Một\.\n\[06:20\] Hai\.\n\[12:05\] Một\.\n\[12:20\] Hai\./,
        'mỗi đoạn được cộng giờ bắt đầu của nó'
      );
      await assert.rejects(fs.stat(path.join(uploadsDir, 'recordings', id)), /ENOENT/);
    });

    it('các đoạn đã chép theo cỡ khác (đổi chế độ cắt giữa chừng) bị bỏ và chép lại từ đầu, không bỏ sót âm thanh', async () => {
      const id = await queuedAudio(mp3, 800);
      // Đoạn đã chép theo cỡ 12 phút của chế độ gửi cả tệp: đoạn 1 bắt đầu ở 12:00, không khớp đoạn 1 của chế độ cắt (06:00)
      await prisma.meetingRecording.update({
        where: { id },
        data: { windows: [{ index: 0, startSec: 0, endSec: 720, text: '[00:01] Bản cũ.' }, { index: 1, startSec: 720, endSec: null, text: '[12:01] Bản cũ.' }] },
      });
      const calls = mockGateway((call) => (isWindowCall(call) ? '[00:05] Mới.' : MINUTES_JSON));
      await transcribeMeeting(job(id));
      assert.equal(calls.filter(isWindowCall).length, 3, 'chép lại cả ba đoạn có âm thanh');
      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'READY');
      assert.equal((row.transcript ?? '').includes('Bản cũ'), false);
    });

    it('có ffmpeg, đường nhanh: nén cả bản ghi thành một mp3 gửi một lần, ra thẳng biên bản', async () => {
      setEnv({ MEETING_AUDIO_DIRECT: undefined });
      try {
        const id = await queuedAudio(mp3, SECONDS);
        const calls = mockGateway(() => MINUTES_JSON);
        await transcribeMeeting(job(id));
        assert.equal(calls.length, 1);
        assert.match(calls[0].filePart?.file_data ?? '', /^data:audio\/mpeg;base64,/);
        assert.match(calls[0].userText, /Nghe toàn bộ tệp/);
        const sent = Buffer.from((calls[0].filePart?.file_data ?? '').split(',')[1] ?? '', 'base64').byteLength;
        assert.ok(sent > 3_000_000 && sent < 3_500_000, `cả 800 giây ở 32 kbps ≈ 3,2 MB, thực ${sent}`);
        const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'READY');
        assert.equal(row.transcript, null);
        assert.match(row.minutesDraft ?? '', /Kế hoạch học kỳ 2/);
      } finally {
        setEnv({ MEETING_AUDIO_DIRECT: 'off' });
      }
    });

    it('tệp không giải mã được: lần đầu ném để thử lại, lần thứ ba FAILED với câu tiếng Việt, không gọi mô hình', async () => {
      const id = await queuedAudio(WEBM, 60);
      const calls = mockGateway(() => MINUTES_JSON);
      await assert.rejects(transcribeMeeting(job(id, 1)), AudioSliceError);
      await transcribeMeeting(job(id, 3));
      const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, 'FAILED');
      assert.match(row.error ?? '', /Không đọc được âm thanh/);
      assert.equal(calls.length, 0);
    });
  });

  describe('xóa', () => {
    it('xóa bản ghi cùng âm thanh còn lại, ghi audit, bản ghi không còn truy cập được', async () => {
      const id = await queuedRecording(60);
      assert.ok(await fs.stat(recordingAudioPath(id)));
      assert.deepEqual(await MeetingRecordingService.remove(meetingId, id, users.organizer, 'req-1'), { id });
      await assert.rejects(fs.stat(path.join(uploadsDir, 'recordings', id)), /ENOENT/);
      await assert.rejects(MeetingRecordingService.get(meetingId, id, users.organizer), /không tồn tại/);
      const audit = await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'MEETING_RECORDING_DELETED' } });
      assert.equal(audit?.requestId, 'req-1');
    });

    it('bản ghi của cuộc họp này không đọc được qua cuộc họp khác', async () => {
      const other = await prisma.meeting.create({
        data: { title: `Họp khác ${runId}`, organizerId: users.organizer, status: MeetingStatus.INVITED, startTime: new Date('2026-11-02T02:00:00.000Z') },
        select: { id: true },
      });
      try {
        const recording = await create(users.organizer);
        await assert.rejects(MeetingRecordingService.get(other.id, recording.id, users.organizer), /không tồn tại/);
        await assert.rejects(MeetingRecordingService.remove(other.id, recording.id, users.organizer), /không tồn tại/);
        assert.ok(await prisma.meetingRecording.findUnique({ where: { id: recording.id } }));
      } finally {
        await prisma.meeting.deleteMany({ where: { id: other.id } });
      }
    });
  });
});
