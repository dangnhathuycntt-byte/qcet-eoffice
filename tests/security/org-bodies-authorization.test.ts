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
import { prisma } from '@/lib/prisma';
import {
  UserRole,
  UnitType,
  JobCatalogGroup,
  OrganizationalBodyType,
  BodyMemberRole,
} from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { POST as createBodyRoute } from '@/app/api/organization/bodies/route';
import { POST as addMembershipRoute } from '@/app/api/organization/bodies/[id]/route';

describe('Task 1: Org Bodies BAC Authorization Enforcement', () => {
  const runId = String(Date.now());

  let testUnit: any;
  let regularUser: any;
  let rectorUser: any;
  let adminUser: any;

  let regularToken: string;
  let rectorToken: string;
  let adminToken: string;

  let createdBodyIds: string[] = [];

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    'content-type': 'application/json',
  });

  before(async () => {
    testUnit = await prisma.organizationalUnit.create({
      data: {
        code: `OU_BODY_SEC_${runId}`,
        name: 'Đơn vị kiểm thử Hội đồng',
        type: UnitType.DEPARTMENT,
      },
    });

    let rectorDef = await prisma.positionDefinition.findUnique({
      where: { code: 'HIEU_TRUONG' },
    });
    if (!rectorDef) {
      rectorDef = await prisma.positionDefinition.create({
        data: {
          code: 'HIEU_TRUONG',
          title: 'Hiệu trưởng',
          group: JobCatalogGroup.LDPU,
          isLeadership: true,
        },
      });
    }

    regularUser = await prisma.user.create({
      data: {
        email: `regular_${runId}@qcet.edu.vn`,
        name: 'Chuyên viên thường',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    rectorUser = await prisma.user.create({
      data: {
        email: `rector_${runId}@qcet.edu.vn`,
        name: 'Hiệu trưởng trường',
        role: UserRole.BAN_GIAM_HIEU,
        isActive: true,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        positionDefinitionId: rectorDef.id,
        unitId: testUnit.id,
        status: 'ACTIVE',
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin_${runId}@qcet.edu.vn`,
        name: 'Quản trị viên hệ thống',
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    regularToken = signSessionToken({
      id: regularUser.id,
      email: regularUser.email,
      name: regularUser.name,
      role: regularUser.role,
    });

    rectorToken = signSessionToken({
      id: rectorUser.id,
      email: rectorUser.email,
      name: rectorUser.name,
      role: rectorUser.role,
    });

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    });
  });

  after(async () => {
    if (createdBodyIds.length > 0) {
      await prisma.bodyMembership.deleteMany({
        where: { bodyId: { in: createdBodyIds } },
      });
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdBodyIds } },
      });
      await prisma.organizationalBody.deleteMany({
        where: { id: { in: createdBodyIds } },
      });
    }

    await prisma.positionAssignment.deleteMany({
      where: { userId: { in: [regularUser.id, rectorUser.id, adminUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [regularUser.id, rectorUser.id, adminUser.id] } },
    });
    if (testUnit) {
      await prisma.organizationalUnit.delete({ where: { id: testUnit.id } });
    }
  });

  test('POST /api/organization/bodies by regular user returns 403 Forbidden with structured error', async () => {
    const req = new NextRequest('http://localhost/api/organization/bodies', {
      method: 'POST',
      headers: authHeaders(regularToken),
      body: JSON.stringify({
        code: `HD_${runId}_ROGUE`,
        name: 'Hội đồng tự xưng',
        type: OrganizationalBodyType.COUNCIL,
      }),
    });

    const res = await createBodyRoute(req);
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, 'FORBIDDEN');
    assert.match(json.error, /Hội đồng|Ban chỉ đạo/);
  });

  test('POST /api/organization/bodies by rector succeeds with 201 Created', async () => {
    const req = new NextRequest('http://localhost/api/organization/bodies', {
      method: 'POST',
      headers: authHeaders(rectorToken),
      body: JSON.stringify({
        code: `HD_${runId}_VALID`,
        name: 'Hội đồng Khoa học và Đào tạo',
        type: OrganizationalBodyType.COUNCIL,
      }),
    });

    const res = await createBodyRoute(req);
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const bodyId = json.id || json.data?.id;
    assert.ok(bodyId);
    createdBodyIds.push(bodyId);
  });

  test('POST /api/organization/bodies/:id by regular user returns 403 Forbidden', async () => {
    const bodyId = createdBodyIds[0];
    const req = new NextRequest(`http://localhost/api/organization/bodies/${bodyId}`, {
      method: 'POST',
      headers: authHeaders(regularToken),
      body: JSON.stringify({
        userId: regularUser.id,
        role: BodyMemberRole.CHAIR,
      }),
    });

    const res = await addMembershipRoute(req, { params: Promise.resolve({ id: bodyId }) });
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, 'FORBIDDEN');
  });

  test('POST /api/organization/bodies/:id by rector adds member with 201 Created', async () => {
    const bodyId = createdBodyIds[0];
    const req = new NextRequest(`http://localhost/api/organization/bodies/${bodyId}`, {
      method: 'POST',
      headers: authHeaders(rectorToken),
      body: JSON.stringify({
        userId: regularUser.id,
        role: BodyMemberRole.MEMBER,
      }),
    });

    const res = await addMembershipRoute(req, { params: Promise.resolve({ id: bodyId }) });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.userId ?? json.data?.userId, regularUser.id);
    assert.strictEqual(json.role ?? json.data?.role, BodyMemberRole.MEMBER);
  });

  test('POST /api/organization/bodies/:id with non-existent body returns 404', async () => {
    const req = new NextRequest(`http://localhost/api/organization/bodies/non_existent_id`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        userId: regularUser.id,
        role: BodyMemberRole.MEMBER,
      }),
    });

    const res = await addMembershipRoute(req, { params: Promise.resolve({ id: 'non_existent_id' }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, 'NOT_FOUND');
  });
});
