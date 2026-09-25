import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getDashboardOverview } from '../src/app/api/dashboard/overview/route';
import { GET as getDocumentStats } from '../src/app/api/documents/stats/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { prisma } from '../src/lib/prisma';

describe('Dashboard API Routes (Zero Mock Fallback)', () => {
  let token: string;

  before(async () => {
    const user = await prisma.user.findFirst() || await prisma.user.create({
      data: {
        email: `dashboard-test-${Date.now()}@qcet.edu.vn`,
        name: 'Dashboard Test User',
        role: 'ADMIN',
      },
    });

    token = await signSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
  });

  test('GET /api/dashboard/overview phải trả về source=database', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/overview', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const response = await getDashboardOverview(req);
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.strictEqual(json.source, 'database');
    assert.notStrictEqual(json.source, 'mock-fallback');
    assert.ok(Array.isArray(json.tasks));
  });

  test('GET /api/documents/stats phải trả về thống kê sổ văn bản từ cơ sở dữ liệu thực', async () => {
    assert.ok(typeof getDocumentStats === 'function', 'GET route cho documents/stats phải tồn tại');
    const req = new NextRequest('http://localhost:3000/api/documents/stats', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const response = await getDocumentStats(req);
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.ok(json.success);
    assert.ok(typeof json.data.total === 'number');
    assert.ok(json.data.total > 0, 'Tổng số văn bản trong DB phải > 0');
  });
});
