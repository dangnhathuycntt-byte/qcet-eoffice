/**
 * Ghi âm cuộc họp: quyền (cùng quan hệ với soạn biên bản, người đọc được cuộc họp nhưng không soạn biên bản bị từ chối,
 * người ngoài nhận 404), nhận âm thanh theo phần và ghép, việc chép lời bằng gateway giả (nối tiếp, thử lại, các đường lỗi),
 * xóa bản ghi cùng âm thanh. Không gọi mô hình thật.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
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
import type { AgentJobContext } from '@/server/outbox/agent-jobs';

const runId = crypto.randomBytes(4).toString('hex');
const users: Record<'organizer' | 'participant' | 'stranger', string> = { organizer: '', participant: '', stranger: '' };
let meetingId = '';
let uploadsDir = '';
const realFetch = globalThis.fetch;
const savedEnv = new Map<string, string | undefined>();

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

    it('gateway chưa cấu hình: FAILED ngay, không thử lại', async () => {
      setEnv({ TASK_AGENT_BASE_URL: undefined });
      try {
        const id = await queuedRecording(60);
        await transcribeMeeting(job(id));
        const row = await prisma.meetingRecording.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'FAILED');
        assert.match(row.error ?? '', /chưa được cấu hình/);
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
