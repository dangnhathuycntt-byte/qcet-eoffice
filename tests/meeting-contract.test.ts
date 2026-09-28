import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateMeetingSchema,
  UpdateMeetingSchema,
  AddParticipantSchema,
  UpdateAttendanceSchema,
  DraftMinutesSchema,
  ConfirmMinutesSchema,
  CreateOrganizationalBodySchema,
  AddBodyMembershipSchema,
  ListMeetingsQuerySchema,
} from '@/contracts/meeting';

const ISO_NOW = '2025-06-15T09:00:00.000Z';
const ISO_LATER = '2025-06-15T11:00:00.000Z';

// ── CreateMeetingSchema ─────────────────────────────────────────────

describe('CreateMeetingSchema', () => {
  test('accepts valid minimal input (title + startTime)', () => {
    const r = CreateMeetingSchema.safeParse({ title: 'Họp giao ban', startTime: ISO_NOW });
    assert.equal(r.success, true);
  });

  test('accepts full input with participants', () => {
    const r = CreateMeetingSchema.safeParse({
      title: 'Họp hội đồng',
      code: 'HD-001',
      bodyId: 'body-1',
      unitId: 'unit-1',
      startTime: ISO_NOW,
      endTime: ISO_LATER,
      location: 'Phòng A1',
      agenda: 'Xét duyệt kế hoạch',
      materialsUrl: 'https://example.com/docs',
      initialParticipants: [
        { userId: 'u1', role: 'CHAIR' },
        { userId: 'u2', role: 'SECRETARY', notes: 'Thư ký' },
        { userId: 'u3' },
      ],
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.initialParticipants![2].role, 'ATTENDEE');
    }
  });

  test('rejects title shorter than 3 chars', () => {
    const r = CreateMeetingSchema.safeParse({ title: 'AB', startTime: ISO_NOW });
    assert.equal(r.success, false);
  });

  test('rejects missing startTime', () => {
    const r = CreateMeetingSchema.safeParse({ title: 'Họp giao ban' });
    assert.equal(r.success, false);
  });

  test('rejects invalid datetime format', () => {
    const r = CreateMeetingSchema.safeParse({ title: 'Họp giao ban', startTime: '15/06/2025' });
    assert.equal(r.success, false);
  });

  test('accepts participants with all valid roles', () => {
    for (const role of ['CHAIR', 'SECRETARY', 'ATTENDEE', 'INVITED_GUEST']) {
      const r = CreateMeetingSchema.safeParse({
        title: 'Họp test',
        startTime: ISO_NOW,
        initialParticipants: [{ userId: 'u1', role }],
      });
      assert.equal(r.success, true, `role ${role} should be accepted`);
    }
  });
});

// ── UpdateMeetingSchema ─────────────────────────────────────────────

describe('UpdateMeetingSchema', () => {
  test('accepts empty body (all fields optional)', () => {
    const r = UpdateMeetingSchema.safeParse({});
    assert.equal(r.success, true);
  });

  test('accepts title update', () => {
    const r = UpdateMeetingSchema.safeParse({ title: 'Họp bổ sung' });
    assert.equal(r.success, true);
  });

  test('rejects title shorter than 3 chars', () => {
    const r = UpdateMeetingSchema.safeParse({ title: 'AB' });
    assert.equal(r.success, false);
  });
});

// ── AddParticipantSchema ────────────────────────────────────────────

describe('AddParticipantSchema', () => {
  test('accepts valid userId and role', () => {
    const r = AddParticipantSchema.safeParse({ userId: 'u1', role: 'CHAIR' });
    assert.equal(r.success, true);
  });

  test('rejects missing userId', () => {
    const r = AddParticipantSchema.safeParse({ role: 'ATTENDEE' });
    assert.equal(r.success, false);
  });

  test('rejects empty userId', () => {
    const r = AddParticipantSchema.safeParse({ userId: '', role: 'ATTENDEE' });
    assert.equal(r.success, false);
  });

  test('accepts all valid roles', () => {
    for (const role of ['CHAIR', 'SECRETARY', 'ATTENDEE', 'INVITED_GUEST']) {
      const r = AddParticipantSchema.safeParse({ userId: 'u1', role });
      assert.equal(r.success, true, `role ${role} should be accepted`);
    }
  });

  test('rejects invalid role', () => {
    const r = AddParticipantSchema.safeParse({ userId: 'u1', role: 'BOSS' });
    assert.equal(r.success, false);
  });
});

// ── UpdateAttendanceSchema ──────────────────────────────────────────

describe('UpdateAttendanceSchema', () => {
  test('accepts valid attendanceStatus', () => {
    const r = UpdateAttendanceSchema.safeParse({ attendanceStatus: 'ATTENDED' });
    assert.equal(r.success, true);
  });

  test('rejects missing attendanceStatus', () => {
    const r = UpdateAttendanceSchema.safeParse({});
    assert.equal(r.success, false);
  });

  test('accepts all valid values', () => {
    for (const s of ['INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED', 'ABSENT']) {
      const r = UpdateAttendanceSchema.safeParse({ attendanceStatus: s });
      assert.equal(r.success, true, `status ${s} should be accepted`);
    }
  });

  test('rejects invalid value', () => {
    const r = UpdateAttendanceSchema.safeParse({ attendanceStatus: 'MAYBE' });
    assert.equal(r.success, false);
  });
});

// ── DraftMinutesSchema ──────────────────────────────────────────────

describe('DraftMinutesSchema', () => {
  test('accepts valid minutes', () => {
    const r = DraftMinutesSchema.safeParse({ minutes: 'Nội dung biên bản cuộc họp đầy đủ.' });
    assert.equal(r.success, true);
  });

  test('rejects minutes shorter than 10 chars', () => {
    const r = DraftMinutesSchema.safeParse({ minutes: 'Ngắn' });
    assert.equal(r.success, false);
  });

  test('rejects missing minutes', () => {
    const r = DraftMinutesSchema.safeParse({});
    assert.equal(r.success, false);
  });
});

// ── ConfirmMinutesSchema ────────────────────────────────────────────

describe('ConfirmMinutesSchema', () => {
  test('accepts empty body', () => {
    const r = ConfirmMinutesSchema.safeParse({});
    assert.equal(r.success, true);
  });

  test('accepts with notes', () => {
    const r = ConfirmMinutesSchema.safeParse({ notes: 'Đã xác nhận' });
    assert.equal(r.success, true);
  });
});

// ── CreateOrganizationalBodySchema ──────────────────────────────────

describe('CreateOrganizationalBodySchema', () => {
  test('accepts valid minimal input (code + name + type)', () => {
    const r = CreateOrganizationalBodySchema.safeParse({
      code: 'HD',
      name: 'Hội đồng khoa học',
      type: 'COUNCIL',
    });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.status, 'ACTIVE');
  });

  test('accepts full input', () => {
    const r = CreateOrganizationalBodySchema.safeParse({
      code: 'BCD',
      name: 'Ban chỉ đạo CNTT',
      type: 'STEERING_COMMITTEE',
      establishedBy: 'QĐ 123/QCET',
      effectiveFrom: ISO_NOW,
      effectiveTo: ISO_LATER,
      status: 'SUSPENDED',
    });
    assert.equal(r.success, true);
  });

  test('rejects code shorter than 2 chars', () => {
    const r = CreateOrganizationalBodySchema.safeParse({ code: 'X', name: 'Tên hợp lệ', type: 'COUNCIL' });
    assert.equal(r.success, false);
  });

  test('rejects name shorter than 3 chars', () => {
    const r = CreateOrganizationalBodySchema.safeParse({ code: 'HD', name: 'AB', type: 'COUNCIL' });
    assert.equal(r.success, false);
  });

  test('rejects invalid type', () => {
    const r = CreateOrganizationalBodySchema.safeParse({ code: 'HD', name: 'Tên hợp lệ', type: 'DEPARTMENT' });
    assert.equal(r.success, false);
  });

  test('accepts all valid types', () => {
    for (const t of ['COUNCIL', 'COMMITTEE', 'STEERING_COMMITTEE', 'WORKING_GROUP']) {
      const r = CreateOrganizationalBodySchema.safeParse({ code: 'HD', name: 'Tên hợp lệ', type: t });
      assert.equal(r.success, true, `type ${t} should be accepted`);
    }
  });
});

// ── AddBodyMembershipSchema ─────────────────────────────────────────

describe('AddBodyMembershipSchema', () => {
  test('accepts empty body (all fields optional)', () => {
    const r = AddBodyMembershipSchema.safeParse({});
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.role, 'MEMBER');
  });

  test('accepts full input', () => {
    const r = AddBodyMembershipSchema.safeParse({
      userId: 'u1',
      positionAssignmentId: 'pa1',
      role: 'CHAIR',
      appointedAt: ISO_NOW,
      expiresAt: ISO_LATER,
    });
    assert.equal(r.success, true);
  });

  test('accepts all valid roles', () => {
    for (const role of ['CHAIR', 'VICE_CHAIR', 'SECRETARY', 'MEMBER']) {
      const r = AddBodyMembershipSchema.safeParse({ role });
      assert.equal(r.success, true, `role ${role} should be accepted`);
    }
  });
});

// ── ListMeetingsQuerySchema ─────────────────────────────────────────

describe('ListMeetingsQuerySchema', () => {
  test('accepts empty query with defaults applied', () => {
    const r = ListMeetingsQuerySchema.safeParse({});
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.limit, 20);
      assert.equal(r.data.page, 1);
    }
  });

  test('accepts full query', () => {
    const r = ListMeetingsQuerySchema.safeParse({
      bodyId: 'b1',
      unitId: 'u1',
      status: 'HELD',
      search: 'giao ban',
      from: ISO_NOW,
      to: ISO_LATER,
      limit: 50,
      page: 3,
    });
    assert.equal(r.success, true);
  });

  test('rejects limit less than 1', () => {
    const r = ListMeetingsQuerySchema.safeParse({ limit: 0 });
    assert.equal(r.success, false);
  });

  test('rejects limit greater than 100', () => {
    const r = ListMeetingsQuerySchema.safeParse({ limit: 101 });
    assert.equal(r.success, false);
  });

  test('default limit is 20 and default page is 1', () => {
    const r = ListMeetingsQuerySchema.safeParse({});
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.limit, 20);
      assert.equal(r.data.page, 1);
    }
  });

  test('accepts all valid MeetingStatus values', () => {
    for (const s of ['DRAFT_AGENDA', 'INVITED', 'HELD', 'MINUTES_DRAFT', 'MINUTES_CONFIRMED', 'CANCELLED']) {
      const r = ListMeetingsQuerySchema.safeParse({ status: s });
      assert.equal(r.success, true, `status ${s} should be accepted`);
    }
  });
});
