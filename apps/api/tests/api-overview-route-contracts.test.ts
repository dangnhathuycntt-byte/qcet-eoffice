import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getDashboardOverview } from '../src/app/api/dashboard/overview/route';
import { GET as getDocumentStats } from '../src/app/api/documents/stats/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { prisma } from '@qcet/db/prisma';

describe('Dashboard API Routes (Zero Mock Fallback)', () => {
  let token: string;
  let userId = '';
  let documentId = '';

  // Tự tạo người dùng và một văn bản người đó vào sổ (đọc được theo registeredById), không dựa vào dữ liệu có sẵn trong DB.
  before(async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: {
        email: `dashboard-test-${runId}@qcet.edu.vn`,
        name: 'Dashboard Test User',
        role: 'CHUYEN_VIEN',
      },
    });
    userId = user.id;
    const document = await prisma.document.create({
      data: {
        type: 'VAN_BAN_DEN',
        registrationNumber: -(100_000_000 + Math.floor(Math.random() * 800_000_000)),
        documentYear: new Date().getFullYear(),
        originalNumber: `${runId}/DASH`,
        issuedDate: new Date(Date.now() - 2 * 86_400_000),
        issuingAuthority: 'Sở Giáo dục và Đào tạo',
        category: 'Công văn',
        summary: `Văn bản kiểm thử thống kê ${runId}`,
        securityLevel: 'THUONG',
        registeredById: user.id,
      },
    });
    documentId = document.id;

    token = await signSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
  });

  after(async () => {
    if (documentId) await prisma.document.deleteMany({ where: { id: documentId } });
    if (userId) {
      await prisma.auditEvent.deleteMany({ where: { actorId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
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
