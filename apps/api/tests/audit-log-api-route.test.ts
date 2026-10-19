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

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { GET as listAuditLogs } from '@/app/api/audit-logs/route';

/**
 * GET /api/audit-logs: khoảng ngày ngược (from sau to) là input sai, phải trả
 * 400 VALIDATION_ERROR (FE hiện "Điều kiện lọc chưa hợp lệ"), không phải 500.
 * Phân quyền chạy trước kiểm tra khoảng ngày.
 */
describe('GET /api/audit-logs: kiểm tra khoảng ngày và phân quyền', () => {
  const runId = `auditroute-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const createdUserIds: string[] = [];
  let adminToken = '';
  let staffToken = '';

  const dayOffset = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const later = dayOffset(0);
  const earlier = dayOffset(-150);

  const request = (query: string, token?: string) =>
    new NextRequest(`http://localhost:3000/api/audit-logs?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  before(async () => {
    const admin = await prisma.user.create({
      data: { email: `admin.${runId}@qcet.edu.vn`, name: `Quản trị ${runId}`, role: UserRole.ADMIN, isActive: true },
    });
    const staff = await prisma.user.create({
      data: { email: `staff.${runId}@qcet.edu.vn`, name: `Chuyên viên ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
    });
    createdUserIds.push(admin.id, staff.id);
    adminToken = signSessionToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
    staffToken = signSessionToken({ id: staff.id, email: staff.email, name: staff.name, role: staff.role });
  });

  after(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: createdUserIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => undefined);
  });

  async function assertReversedRangeRejected(res: Response) {
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.ok(res.headers.get('x-request-id'));
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.equal(body.message, 'Ngày bắt đầu không được sau ngày kết thúc');
    assert.deepEqual(body.fieldErrors, { from: ['Ngày bắt đầu không được sau ngày kết thúc'] });
    assert.equal(body.requestId, res.headers.get('x-request-id'));
  }

  test('ADMIN gửi khoảng ngày ngược (YYYY-MM-DD) → 400 VALIDATION_ERROR', async () => {
    await assertReversedRangeRejected(await listAuditLogs(request(`from=${later}&to=${earlier}`, adminToken)));
  });

  test('ADMIN gửi khoảng ngược dạng ISO đầy đủ → 400 VALIDATION_ERROR', async () => {
    await assertReversedRangeRejected(
      await listAuditLogs(request(`from=${later}T00:00:00Z&to=${earlier}T00:00:00Z`, adminToken))
    );
  });

  test('ADMIN gửi khoảng ngược trộn ISO và ngày → 400 VALIDATION_ERROR', async () => {
    await assertReversedRangeRejected(
      await listAuditLogs(request(`from=${later}T20:00:00Z&to=${later}`, adminToken))
    );
  });

  test('CHUYEN_VIEN gửi khoảng ngược → 403, không lộ lỗi validate', async () => {
    const res = await listAuditLogs(request(`from=${later}&to=${earlier}`, staffToken));
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    const body = await res.json();
    assert.equal(body.code, 'FORBIDDEN');
  });

  test('không có token → 401 AUTH_REQUIRED', async () => {
    const res = await listAuditLogs(request(`from=${later}&to=${earlier}`));
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'AUTH_REQUIRED');
  });

  test('ADMIN gửi khoảng hợp lệ (cùng một ngày và from trước to) → 200', async () => {
    for (const query of [`from=${later}&to=${later}`, `from=${earlier}&to=${later}`]) {
      const res = await listAuditLogs(request(query, adminToken));
      assert.equal(res.status, 200, query);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      const body = await res.json();
      assert.ok(Array.isArray(body.data), query);
      assert.ok(body.pagination, query);
    }
  });

  test('ADMIN gửi ngày sai định dạng → 400 VALIDATION_ERROR có fieldErrors.from', async () => {
    const res = await listAuditLogs(request('from=2026-13-01', adminToken));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.fieldErrors?.from) && body.fieldErrors.from.length > 0);
  });
});
