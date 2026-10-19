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
import { NextRequest } from 'next/server';
import { prisma } from '@qcet/db/prisma';
import { UserRole, UnitType, OrganizationalBodyType, BodyMemberRole } from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { GET as listBodiesRoute, POST as createBodyRoute } from '@/app/api/organization/bodies/route';
import { GET as getBodyRoute, POST as addMembershipRoute } from '@/app/api/organization/bodies/[id]/route';

/**
 * Issue #28 hotspot 2: `GET /api/organization/bodies/[id]` must not disclose
 * recent-meeting contents to unaffiliated authenticated users.
 * Intended visibility: roster = institution-internal directory (any
 * authenticated user); meetings = members + body managers only.
 */
describe('Issue #28: organizational body detail visibility', () => {
  const runId = `orgread-${Date.now()}`;

  let testUnit: any;
  let rectorUser: any;
  let memberUser: any;
  let outsiderUser: any;

  let rectorToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let bodyId: string;
  const meetingTitle = `Hop bi mat ${runId}`;

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    origin: 'http://localhost',
  });

  before(async () => {
    testUnit = await prisma.organizationalUnit.create({
      data: { code: `OU-READ-${runId}`, name: `Don vi doc ${runId}`, type: UnitType.DEPARTMENT },
    });

    rectorUser = await prisma.user.create({
      data: { email: `rector.${runId}@qcet.edu.vn`, name: `Rector ${runId}`, role: UserRole.BAN_GIAM_HIEU, isActive: true },
    });
    memberUser = await prisma.user.create({
      data: { email: `member.${runId}@qcet.edu.vn`, name: `Member ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
    });
    outsiderUser = await prisma.user.create({
      data: { email: `outsider.${runId}@qcet.edu.vn`, name: `Outsider ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
    });

    rectorToken = signSessionToken({ id: rectorUser.id, email: rectorUser.email, name: rectorUser.name, role: rectorUser.role });
    memberToken = signSessionToken({ id: memberUser.id, email: memberUser.email, name: memberUser.name, role: memberUser.role });
    outsiderToken = signSessionToken({ id: outsiderUser.id, email: outsiderUser.email, name: outsiderUser.name, role: outsiderUser.role });

    const createRes = await createBodyRoute(
      new NextRequest('http://localhost/api/organization/bodies', {
        method: 'POST',
        headers: { ...authHeaders(rectorToken), 'content-type': 'application/json' },
        body: JSON.stringify({ code: `HD_${runId}`, name: `Hoi dong ${runId}`, type: OrganizationalBodyType.COUNCIL }),
      })
    );
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    bodyId = created.id || created.data?.id;
    assert.ok(bodyId);

    const addRes = await addMembershipRoute(
      new NextRequest(`http://localhost/api/organization/bodies/${bodyId}`, {
        method: 'POST',
        headers: { ...authHeaders(rectorToken), 'content-type': 'application/json' },
        body: JSON.stringify({ userId: memberUser.id, role: BodyMemberRole.MEMBER }),
      }),
      { params: Promise.resolve({ id: bodyId }) }
    );
    assert.equal(addRes.status, 201);

    await prisma.meeting.create({
      data: {
        title: meetingTitle,
        bodyId,
        organizerId: rectorUser.id,
        startTime: new Date('2026-10-01T08:00:00+07:00'),
      },
    });
  });

  after(async () => {
    await prisma.meeting.deleteMany({ where: { bodyId } }).catch(() => undefined);
    await prisma.bodyMembership.deleteMany({ where: { bodyId } }).catch(() => undefined);
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: [rectorUser?.id, memberUser?.id, outsiderUser?.id].filter(Boolean) } },
    }).catch(() => undefined);
    if (bodyId) await prisma.organizationalBody.deleteMany({ where: { id: bodyId } }).catch(() => undefined);
    await prisma.positionAssignment.deleteMany({
      where: { userId: { in: [rectorUser?.id, memberUser?.id, outsiderUser?.id].filter(Boolean) } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: { in: [rectorUser?.id, memberUser?.id, outsiderUser?.id].filter(Boolean) } },
    }).catch(() => undefined);
    if (testUnit) await prisma.organizationalUnit.delete({ where: { id: testUnit.id } }).catch(() => undefined);
  });

  const getBody = (token?: string) =>
    getBodyRoute(
      new NextRequest(`http://localhost/api/organization/bodies/${bodyId}`, {
        method: 'GET',
        headers: token ? authHeaders(token) : {},
      }),
      { params: Promise.resolve({ id: bodyId }) }
    );

  test('unaffiliated authenticated user gets roster but no meeting contents', async () => {
    const res = await getBody(outsiderToken);
    assert.equal(res.status, 200);
    const body = await res.json();
    const payload = body.data ?? body;
    assert.ok(Array.isArray(payload.memberships), 'roster stays visible as internal directory');
    assert.deepEqual(payload.meetings, []);
    assert.ok(!JSON.stringify(body).includes(meetingTitle), 'must not leak meeting contents');
  });

  test('body member gets full detail including meetings', async () => {
    const res = await getBody(memberToken);
    assert.equal(res.status, 200);
    const body = await res.json();
    const payload = body.data ?? body;
    assert.ok(Array.isArray(payload.meetings));
    assert.equal(payload.meetings.length, 1);
    assert.equal(payload.meetings[0].title, meetingTitle);
  });

  test('body manager gets full detail including meetings', async () => {
    const res = await getBody(rectorToken);
    assert.equal(res.status, 200);
    const body = await res.json();
    const payload = body.data ?? body;
    assert.ok(Array.isArray(payload.meetings));
    assert.equal(payload.meetings.length, 1);
  });

  test('unauthenticated request is rejected with 401', async () => {
    const res = await getBody(undefined);
    assert.equal(res.status, 401);
  });

  test('non-existent body returns 404 without leak', async () => {
    const res = await getBodyRoute(
      new NextRequest('http://localhost/api/organization/bodies/does-not-exist', {
        method: 'GET',
        headers: authHeaders(outsiderToken),
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) }
    );
    assert.equal(res.status, 404);
  });
});

/**
 * `GET /api/organization/bodies`: `type`/`status` sai enum là input sai, phải
 * trả 400 VALIDATION_ERROR thay vì để Prisma ném lỗi thành 500. Xác thực vẫn
 * chạy trước validate.
 */
describe('GET /api/organization/bodies: kiểm tra tham số lọc type/status', () => {
  const runId = `orglist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let rectorUser: any;
  let staffUser: any;
  let rectorToken: string;
  let staffToken: string;
  let bodyId: string;

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    origin: 'http://localhost',
  });

  const listBodies = (query: string, token?: string) =>
    listBodiesRoute(
      new NextRequest(`http://localhost/api/organization/bodies${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: token ? authHeaders(token) : {},
      })
    );

  const containsFixture = async (res: Response) => {
    const body = await res.json();
    assert.ok(Array.isArray(body));
    return body.some((item: { id: string }) => item.id === bodyId);
  };

  before(async () => {
    rectorUser = await prisma.user.create({
      data: { email: `rector.${runId}@qcet.edu.vn`, name: `Rector ${runId}`, role: UserRole.BAN_GIAM_HIEU, isActive: true },
    });
    staffUser = await prisma.user.create({
      data: { email: `staff.${runId}@qcet.edu.vn`, name: `Staff ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
    });
    rectorToken = signSessionToken({ id: rectorUser.id, email: rectorUser.email, name: rectorUser.name, role: rectorUser.role });
    staffToken = signSessionToken({ id: staffUser.id, email: staffUser.email, name: staffUser.name, role: staffUser.role });

    const createRes = await createBodyRoute(
      new NextRequest('http://localhost/api/organization/bodies', {
        method: 'POST',
        headers: { ...authHeaders(rectorToken), 'content-type': 'application/json' },
        body: JSON.stringify({ code: `HD_${runId}`, name: `Hoi dong ${runId}`, type: OrganizationalBodyType.COUNCIL }),
      })
    );
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    bodyId = created.id || created.data?.id;
    assert.ok(bodyId);
  });

  after(async () => {
    const userIds = [rectorUser?.id, staffUser?.id].filter(Boolean);
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } }).catch(() => undefined);
    if (bodyId) await prisma.organizationalBody.deleteMany({ where: { id: bodyId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
  });

  test('không tham số → 200, danh sách có body của fixture', async () => {
    const res = await listBodies('', staffToken);
    assert.equal(res.status, 200);
    assert.equal(await containsFixture(res), true);
  });

  test('type=COUNCIL&status=ACTIVE → 200, có body của fixture', async () => {
    const res = await listBodies('type=COUNCIL&status=ACTIVE', staffToken);
    assert.equal(res.status, 200);
    assert.equal(await containsFixture(res), true);
  });

  test('type=WORKING_GROUP → 200, lọc bỏ body COUNCIL của fixture', async () => {
    const res = await listBodies('type=WORKING_GROUP', staffToken);
    assert.equal(res.status, 200);
    assert.equal(await containsFixture(res), false);
  });

  test('type rỗng và status rỗng → 200, coi như không lọc', async () => {
    const res = await listBodies('type=&status=', staffToken);
    assert.equal(res.status, 200);
    assert.equal(await containsFixture(res), true);
  });

  for (const [query, field] of [
    ['type=XYZ', 'type'],
    ['status=XYZ', 'status'],
    ['type=council', 'type'],
  ] as const) {
    test(`${query} → 400 VALIDATION_ERROR với fieldErrors.${field}`, async () => {
      const res = await listBodies(query, staffToken);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.code, 'VALIDATION_ERROR');
      assert.equal(body.message, 'Validation failed');
      assert.ok(Array.isArray(body.fieldErrors?.[field]) && body.fieldErrors[field].length > 0);
      assert.ok(body.requestId);
    });
  }

  test('chưa đăng nhập + type=XYZ → 401 AUTH_REQUIRED (xác thực trước validate)', async () => {
    const res = await listBodies('type=XYZ');
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'AUTH_REQUIRED');
  });
});
