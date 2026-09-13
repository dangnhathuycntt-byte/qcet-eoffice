import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  MeetingStatus,
  MeetingParticipantRole,
  AttendanceStatus,
  OrganizationalBodyType,
  BodyMemberRole,
  TaskActorRole,
  UserRole,
} from '@prisma/client';
import { MeetingService } from '../src/server/services/meeting-service';

describe('Phase 8: Institutional Meetings, Organizational Bodies & Resolutions Domain', () => {
  const runId = `meet_${Date.now()}`;

  let testUnit: any;
  let organizerUser: any;
  let participantUser1: any;
  let participantUser2: any;
  let testBody: any;

  before(async () => {
    // 1. Create a test organizational unit
    testUnit = await prisma.organizationalUnit.create({
      data: {
        code: `OU_MEET_${runId}`,
        name: `Đơn vị Thử nghiệm Hội đồng ${runId}`,
        type: 'DEPARTMENT',
        effectiveFrom: new Date('2026-01-01'),
        status: 'ACTIVE',
      },
    });

    // 2. Create test users
    organizerUser = await prisma.user.create({
      data: {
        email: `organizer_${runId}@qcet.edu.vn`,
        name: 'Nguyễn Văn Tổ Chức',
        role: UserRole.CHUYEN_VIEN,
      },
    });

    participantUser1 = await prisma.user.create({
      data: {
        email: `participant1_${runId}@qcet.edu.vn`,
        name: 'Trần Thị Thành Viên 1',
        role: UserRole.CHUYEN_VIEN,
      },
    });

    participantUser2 = await prisma.user.create({
      data: {
        email: `participant2_${runId}@qcet.edu.vn`,
        name: 'Lê Văn DRI 2',
        role: UserRole.CHUYEN_VIEN,
      },
    });

    // 3. Create an organizational body (Hội đồng / Ban chỉ đạo)
    testBody = await prisma.organizationalBody.create({
      data: {
        code: `BODY_${runId}`,
        name: `Hội đồng Khoa học & Đào tạo ${runId}`,
        type: OrganizationalBodyType.COUNCIL,
        establishedBy: 'Quyết định 283/QĐ-CĐKTCNQN',
        status: 'ACTIVE',
      },
    });

    // Add memberships
    await prisma.bodyMembership.create({
      data: {
        bodyId: testBody.id,
        userId: organizerUser.id,
        role: BodyMemberRole.SECRETARY,
      },
    });

    await prisma.bodyMembership.create({
      data: {
        bodyId: testBody.id,
        userId: participantUser1.id,
        role: BodyMemberRole.MEMBER,
      },
    });
  });

  after(async () => {
    // Clean up
    await prisma.taskActor.deleteMany({
      where: {
        task: {
          createdById: organizerUser.id,
        },
      },
    });

    await prisma.task.deleteMany({
      where: {
        createdById: organizerUser.id,
      },
    });

    await prisma.meetingResolution.deleteMany({
      where: {
        meeting: {
          code: { contains: runId },
        },
      },
    });

    await prisma.meetingParticipant.deleteMany({
      where: {
        meeting: {
          code: { contains: runId },
        },
      },
    });

    await prisma.meeting.deleteMany({
      where: {
        code: { contains: runId },
      },
    });

    await prisma.bodyMembership.deleteMany({
      where: { bodyId: testBody.id },
    });

    await prisma.organizationalBody.deleteMany({
      where: { id: testBody.id },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [organizerUser.id, participantUser1.id, participantUser2.id] },
      },
    });

    await prisma.organizationalUnit.deleteMany({
      where: { id: testUnit.id },
    });
  });

  it('1. Tạo cuộc họp mới ở trạng thái INVITED khi có danh sách người tham gia ban đầu', async () => {
    const meeting = await MeetingService.createMeeting(
      {
        code: `MT_${runId}_01`,
        title: 'Phiên họp thường kỳ Hội đồng Khoa học',
        bodyId: testBody.id,
        unitId: testUnit.id,
        startTime: '2026-09-15T08:30:00.000Z',
        location: 'Phòng họp A - Nhà hiệu bộ',
        agenda: '1. Đánh giá kế hoạch nghiên cứu khoa học năm học 2026-2027\n2. Phê duyệt đề tài cấp trường',
        initialParticipants: [
          { userId: participantUser1.id, role: MeetingParticipantRole.ATTENDEE },
        ],
      },
      organizerUser.id,
      `req_meet_${runId}_01`
    );

    assert.ok(meeting.id);
    assert.equal(meeting.status, MeetingStatus.INVITED);
    assert.equal(meeting.title, 'Phiên họp thường kỳ Hội đồng Khoa học');

    // Verify participants
    const details = await MeetingService.getMeeting(meeting.id);
    assert.equal(details.participants.length, 2); // organizer (SECRETARY) + participantUser1 (MEMBER)
  });

  it('2. Thêm người tham dự cuộc họp và cập nhật trạng thái tham dự', async () => {
    const meeting = await MeetingService.createMeeting(
      {
        code: `MT_${runId}_02`,
        title: 'Họp đột xuất giải quyết sự cố',
        unitId: testUnit.id,
        startTime: '2026-09-16T14:00:00.000Z',
      },
      organizerUser.id,
      `req_meet_${runId}_02`
    );

    assert.equal(meeting.status, MeetingStatus.DRAFT_AGENDA);

    // Mời participantUser2
    const participant = await MeetingService.addParticipant(
      meeting.id,
      {
        userId: participantUser2.id,
        role: MeetingParticipantRole.ATTENDEE,
        notes: 'Chuyên viên kỹ thuật phụ trách',
      },
      organizerUser.id,
      `req_add_${runId}`
    );

    assert.equal(participant.role, MeetingParticipantRole.ATTENDEE);
    assert.equal(participant.attendanceStatus, AttendanceStatus.INVITED);

    // Verify meeting transitioned to INVITED
    const refreshed = await MeetingService.getMeeting(meeting.id);
    assert.equal(refreshed.status, MeetingStatus.INVITED);

    // Cập nhật tham dự: ATTENDED
    const updatedAttendance = await MeetingService.updateAttendance(
      meeting.id,
      participantUser2.id,
      { attendanceStatus: AttendanceStatus.ATTENDED, notes: 'Có mặt đúng giờ' }
    );
    assert.equal(updatedAttendance.attendanceStatus, AttendanceStatus.ATTENDED);
  });

  it('3. Luân chuyển vòng đời cuộc họp: INVITED -> HELD -> MINUTES_DRAFT -> MINUTES_CONFIRMED', async () => {
    const meeting = await MeetingService.createMeeting(
      {
        code: `MT_${runId}_03`,
        title: 'Họp đánh giá tiến độ chuyển đổi số 2026',
        unitId: testUnit.id,
        startTime: '2026-09-10T09:00:00.000Z',
        initialParticipants: [
          { userId: organizerUser.id, role: MeetingParticipantRole.CHAIR },
          { userId: participantUser1.id, role: MeetingParticipantRole.ATTENDEE },
        ],
      },
      organizerUser.id
    );

    assert.equal(meeting.status, MeetingStatus.INVITED);

    // Diễn ra cuộc họp (INVITED -> HELD)
    const held = await MeetingService.holdMeeting(meeting.id, organizerUser.id);
    assert.equal(held.status, MeetingStatus.HELD);

    // Soạn biên bản (HELD -> MINUTES_DRAFT)
    const minutesDraft = await MeetingService.draftMinutes(
      meeting.id,
      {
        minutes: 'Cuộc họp diễn ra với sự tham gia của 2 đại biểu. Hội đồng thống nhất thông qua đề cương chuyển đổi số.',
      },
      organizerUser.id
    );
    assert.equal(minutesDraft.status, MeetingStatus.MINUTES_DRAFT);
    assert.ok(minutesDraft.minutes?.includes('Hội đồng thống nhất thông qua'));

    // Xác nhận biên bản (MINUTES_DRAFT -> MINUTES_CONFIRMED)
    const confirmed = await MeetingService.confirmMinutes(
      meeting.id,
      { notes: 'Đã thông qua biên bản chính thức' },
      organizerUser.id
    );
    assert.equal(confirmed.status, MeetingStatus.MINUTES_CONFIRMED);
    assert.ok(confirmed.minutesConfirmedAt);
    assert.equal(confirmed.minutesConfirmedById, organizerUser.id);
  });

  it('4. Ban hành Quyết nghị cuộc họp và tự động sinh Task với Lead Unit & DRI', async () => {
    const meeting = await MeetingService.createMeeting(
      {
        code: `MT_${runId}_04`,
        title: 'Họp giao ban Quý III/2026',
        unitId: testUnit.id,
        startTime: '2026-09-12T08:00:00.000Z',
        initialParticipants: [
          { userId: organizerUser.id, role: MeetingParticipantRole.CHAIR },
        ],
      },
      organizerUser.id
    );

    await MeetingService.holdMeeting(meeting.id, organizerUser.id);
    await MeetingService.draftMinutes(meeting.id, { minutes: 'Kết luận giao ban...' }, organizerUser.id);
    await MeetingService.confirmMinutes(meeting.id, {}, organizerUser.id);

    // Ban hành quyết nghị có yêu cầu sinh Task
    const deadline = new Date('2026-09-30T17:00:00Z');
    const resolution = await MeetingService.createResolution(
      meeting.id,
      {
        code: `NQ_${runId}_01`,
        title: 'Triển khai số hóa toàn bộ tài liệu hành chính năm 2026',
        content: 'Yêu cầu phòng chuyên môn số hóa toàn bộ hồ sơ công việc theo Nghị định 30/2020 và Luật Lưu trữ 2024.',
        leadUnitId: testUnit.id,
        leadUserId: participantUser2.id,
        deadline: deadline.toISOString(),
        createTask: true,
        taskTitle: 'Số hóa tài liệu hành chính theo kết luận giao ban',
      },
      organizerUser.id,
      `req_res_${runId}`
    );

    assert.ok(resolution.id);
    assert.equal(resolution.code, `NQ_${runId}_01`);
    assert.ok(resolution.resultingTaskId, 'Phải có resultingTaskId gắn với nhiệm vụ được sinh tự động');

    // Kiểm tra chi tiết Task được sinh tự động
    const derivedTask = await prisma.task.findUnique({
      where: { id: resolution.resultingTaskId! },
      include: {
        actors: true,
      },
    });

    assert.ok(derivedTask);
    assert.equal(derivedTask.title, 'Số hóa tài liệu hành chính theo kết luận giao ban');
    assert.equal(derivedTask.leadUnitId, testUnit.id);

    // Kiểm tra TaskActor DRI
    const driActor = derivedTask.actors.find((a) => a.role === TaskActorRole.DRI);
    assert.ok(driActor, 'Phải có TaskActor với vai trò DRI');
    assert.equal(driActor?.userId, participantUser2.id);
    assert.equal(driActor?.isPrimaryDRI, true);
    assert.equal(driActor?.assignedById, organizerUser.id);

    // Kiểm tra chi tiết cuộc họp trả về danh sách quyết nghị
    const fullMeeting = await MeetingService.getMeeting(meeting.id);
    assert.equal(fullMeeting.resolutions.length, 1);
    assert.equal(fullMeeting.resolutions[0].resultingTask?.id, derivedTask.id);
  });
});
