import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { resetRateLimits } from '@/server/security/rate-limit';
import { JobCatalogGroup } from '@prisma/client';

import { GET as listDocumentsRoute, POST as createDocumentRoute } from '@/app/api/documents/route';
import {
  GET as getDocumentRoute,
  PATCH as patchDocumentRoute,
  DELETE as deleteDocumentRoute,
} from '@/app/api/documents/[id]/route';
import {
  GET as getDirectivesRoute,
  POST as postDirectiveRoute,
} from '@/app/api/documents/[id]/directives/route';
import { GET as getStatsRoute } from '@/app/api/documents/stats/route';
import {
  GET as getExportRoute,
  POST as postExportRoute,
} from '@/app/api/documents/export-excel/route';

describe('Document Routes API & Security Hardening (Task 11)', () => {
  let adminUser: any;
  let managerUser: any;
  let managerPositionAssignmentId: string;
  let managerUnitId: string;
  let staffUser: any;
  let foreignStaffUser: any;
  let testDept1: any;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;
  let foreignStaffToken: string;

  const createdDocIds: string[] = [];
  const createdTaskIds: string[] = [];
  let testDatabaseHasLegacyDirectiveColumn = false;

  before(async () => {
    // 1. Ensure departments
    testDept1 = await prisma.organizationalUnit.findFirst({
      where: { code: 'dept-test-doc-1' },
    });
    if (!testDept1) {
      testDept1 = await prisma.organizationalUnit.create({
        data: {
          id: 'dept-test-doc-1',
          code: 'dept-test-doc-1',
          name: 'Phòng Thử Nghiệm 1',
          type: 'DEPARTMENT',
          status: 'ACTIVE' as any,
        },
      });
    }

    // 2. Setup users
    adminUser = await prisma.user.findFirst({
      where: { email: 'admin-doc-test@qncet.edu.vn' },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin-doc-test@qncet.edu.vn',
          name: 'Admin Document Tester',
          role: 'ADMIN',

        },
      });
    }

    managerUser = await prisma.user.findFirst({
      where: { email: 'manager-doc-test@qncet.edu.vn' },
    });
    if (!managerUser) {
      managerUser = await prisma.user.create({
        data: {
          email: 'manager-doc-test@qncet.edu.vn',
          name: 'Manager Document Tester',
          role: 'TRUONG_PHONG',

        },
      });
    }

    managerUnitId = testDept1.id;

    const managerPosition = await prisma.positionDefinition.upsert({
      where: { code: 'TRUONG_PHONG' },
      update: {},
      create: {
        code: 'TRUONG_PHONG',
        title: 'Trưởng phòng',
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
      },
    });
    const existingManagerAssignment = await prisma.positionAssignment.findFirst({
      where: {
        userId: managerUser.id,
        positionDefinitionId: managerPosition.id,
        unitId: managerUnitId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!existingManagerAssignment) {
      const managerAssignment = await prisma.positionAssignment.create({
        data: {
          userId: managerUser.id,
          positionDefinitionId: managerPosition.id,
          unitId: managerUnitId,
          type: 'PRIMARY',
          status: 'ACTIVE',
        },
      });
      managerPositionAssignmentId = managerAssignment.id;
    }

    const legacyDirectiveColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'document_directives'
          AND column_name = 'assigned_dept_id'
      ) AS exists
    `;
    testDatabaseHasLegacyDirectiveColumn = Boolean(legacyDirectiveColumn[0]?.exists);

    staffUser = await prisma.user.findFirst({
      where: { email: 'staff-doc-test@qncet.edu.vn' },
    });
    if (!staffUser) {
      staffUser = await prisma.user.create({
        data: {
          email: 'staff-doc-test@qncet.edu.vn',
          name: 'Staff Document Tester',
          role: 'CHUYEN_VIEN',

        },
      });
    }

    foreignStaffUser = await prisma.user.findFirst({
      where: { email: 'foreign-staff-doc-test@qncet.edu.vn' },
    });
    if (!foreignStaffUser) {
      foreignStaffUser = await prisma.user.create({
        data: {
          email: 'foreign-staff-doc-test@qncet.edu.vn',
          name: 'Foreign Staff Document Tester',
          role: 'CHUYEN_VIEN',

        },
      });
    }

    // Tokens
    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    });
    managerToken = signSessionToken({
      id: managerUser.id,
      email: managerUser.email,
      name: managerUser.name,
      role: managerUser.role,
    });
    staffToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
    });
    foreignStaffToken = signSessionToken({
      id: foreignStaffUser.id,
      email: foreignStaffUser.email,
      name: foreignStaffUser.name,
      role: foreignStaffUser.role,
    });
  });

  after(async () => {
    // Cleanup in reverse dependency order
    if (managerPositionAssignmentId) {
      await prisma.positionAssignment.delete({ where: { id: managerPositionAssignmentId } });
    }
    if (createdDocIds.length > 0) {
      await prisma.documentDirective.deleteMany({
        where: { documentId: { in: createdDocIds } },
      });
      await prisma.documentAttachment.deleteMany({
        where: { documentId: { in: createdDocIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: createdDocIds } },
      });
    }
    if (createdTaskIds.length > 0) {
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }
    const testUserIds = [adminUser?.id, managerUser?.id, staffUser?.id, foreignStaffUser?.id].filter(Boolean);
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
    const testUnitCodes = ['dept-test-doc-1', 'dept-test-doc-2'];
    await prisma.organizationalUnit.deleteMany({ where: { code: { in: testUnitCodes } } });
  });

  beforeEach(() => {
    resetRateLimits();
  });

  describe('1. Unauthenticated Access Rejection (401)', () => {
    it('GET /api/documents returns 401 when no session is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents');
      const res = await listDocumentsRoute(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    });

    it('POST /api/documents returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary: 'Unauth' }),
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/documents/[id] returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/any-id');
      const res = await getDocumentRoute(req, { params: Promise.resolve({ id: 'any-id' }) });
      assert.strictEqual(res.status, 401);
    });

    it('PATCH /api/documents/[id] returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/any-id', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary: 'Update' }),
      });
      const res = await patchDocumentRoute(req, { params: Promise.resolve({ id: 'any-id' }) });
      assert.strictEqual(res.status, 401);
    });

    it('DELETE /api/documents/[id] returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/any-id', {
        method: 'DELETE',
      });
      const res = await deleteDocumentRoute(req, { params: Promise.resolve({ id: 'any-id' }) });
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/documents/[id]/directives returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/any-id/directives');
      const res = await getDirectivesRoute(req, { params: Promise.resolve({ id: 'any-id' }) });
      assert.strictEqual(res.status, 401);
    });

    it('POST /api/documents/[id]/directives returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/any-id/directives', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instruction: 'Direct' }),
      });
      const res = await postDirectiveRoute(req, { params: Promise.resolve({ id: 'any-id' }) });
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/documents/stats returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/stats');
      const res = await getStatsRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/documents/export-excel returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/export-excel');
      const res = await getExportRoute(req);
      assert.strictEqual(res.status, 401);
    });
  });

  describe('2. CSRF Protection on Mutations', () => {
    it('POST /api/documents rejects ambient cookie requests without Origin/Referer (403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qcet_session=${adminToken}`,
        },
        body: JSON.stringify({
          type: 'VAN_BAN_DEN',
          originalNumber: 'CSRF-01',
          summary: 'CSRF attempt',
        }),
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 403);
    });

    it('POST /api/documents succeeds when using Bearer authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          type: 'VAN_BAN_DEN',
          originalNumber: 'BEARER-AUTH-01',
          issuedDate: new Date().toISOString(),
          summary: 'Bearer authentication valid create',
          issuingAuthority: 'Sở GD&ĐT',
          category: 'Công văn',
        }),
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.id);
      createdDocIds.push(json.data.id);
    });

    it('POST /api/documents succeeds when Cookie is paired with matching Origin header', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `qcet_session=${adminToken}`,
        },
        body: JSON.stringify({
          type: 'VAN_BAN_DEN',
          originalNumber: 'ORIGIN-VALID-01',
          issuedDate: new Date().toISOString(),
          summary: 'Origin header valid create',
          issuingAuthority: 'Sở GD&ĐT',
          category: 'Công văn',
        }),
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      createdDocIds.push(json.data.id);
    });
  });

  describe('3. Validation Errors & Body Size Limits (400)', () => {
    it('rejects payload missing summary or originalNumber (400)', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          type: 'VAN_BAN_DEN',
          // missing summary and originalNumber
        }),
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.ok(json.code === 'VALIDATION_ERROR');
    });

    it('rejects non-JSON content-type on mutation (415)', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          authorization: `Bearer ${adminToken}`,
        },
        body: 'invalid-plain-text',
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 415);
    });
  });

  describe('4. Object-level Authorization (BOLA Prevention) & Role Boundaries (403)', () => {
    let departmentDocumentId: string;

    before(async () => {
      // Create a document assigned specifically to testDept1
      const doc = await prisma.document.create({
        data: {
          registrationNumber: 77771,
          documentYear: new Date().getFullYear(),
          type: 'VAN_BAN_DEN',
          originalNumber: 'INTERNAL-DEPT-771',
          issuedDate: new Date(),
          issuingAuthority: 'UBND Tỉnh ',
          category: 'Công văn',
          summary: 'Văn bản nội bộ Phòng 1',
          status: 'CHO_PHAN_CONG',
          urgency: 'THUONG',
          securityLevel: 'THUONG',
          incomingWorkflow: { create: { leadUnitId: managerUnitId } },
          registeredById: managerUser.id,
        },
      });
      departmentDocumentId = doc.id;
      createdDocIds.push(doc.id);
    });

    it('foreign staff user cannot read private document belonging to another department (403)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${departmentDocumentId}`,
        {
          headers: { authorization: `Bearer ${foreignStaffToken}` },
        }
      );
      const res = await getDocumentRoute(req, {
        params: Promise.resolve({ id: departmentDocumentId }),
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    it('staff user cannot update document when not creator or manager (403)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${departmentDocumentId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${staffToken}`,
          },
          body: JSON.stringify({ summary: 'Attempted staff edit' }),
        }
      );
      const res = await patchDocumentRoute(req, {
        params: Promise.resolve({ id: departmentDocumentId }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('foreign staff cannot delete document (403)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${departmentDocumentId}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${foreignStaffToken}` },
        }
      );
      const res = await deleteDocumentRoute(req, {
        params: Promise.resolve({ id: departmentDocumentId }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('regular staff cannot issue directive bút phê (403)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${departmentDocumentId}/directives`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${staffToken}`,
          },
          body: JSON.stringify({
            instruction: 'Chỉ đạo bởi chuyên viên',
            leadUnitId: testDept1.id,
          }),
        }
      );
      const res = await postDirectiveRoute(req, {
        params: Promise.resolve({ id: departmentDocumentId }),
      });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('5. Successful Queries, Operations & DTO Sanitization', () => {
    let testDocId: string;

    it('POST /api/documents creates document with automatic registration number and returns DTO', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          type: 'VAN_BAN_DEN',
          originalNumber: 'VB-SUCCESS-001',
          issuedDate: new Date().toISOString(),
          summary: 'Văn bản kiểm thử thành công',
          issuingAuthority: 'UBND Tỉnh',
          category: 'Chỉ thị',
          urgency: 'KHAN',
          securityLevel: 'THUONG',
          leadUnitId: managerUnitId,
        }),
      });
      const res = await createDocumentRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.id);
      assert.ok(json.data.registrationNumber);
      testDocId = json.data.id;
      createdDocIds.push(testDocId);
    });

    it('GET /api/documents returns list of documents with DTO and cache-control', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents?type=VAN_BAN_DEN', {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const res = await listDocumentsRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const items = json.documents || json.data;
      assert.ok(Array.isArray(items));
      assert.ok(items.length > 0);
    });

    it('GET /api/documents/[id] returns detail DTO', async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        headers: { authorization: `Bearer ${managerToken}` },
      });
      const res = await getDocumentRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, testDocId);
      assert.strictEqual(json.data.summary, 'Văn bản kiểm thử thành công');
    });

    it('PATCH /api/documents/[id] updates document fields', async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          summary: 'Văn bản đã được cập nhật tóm tắt',
        }),
      });
      const res = await patchDocumentRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.summary, 'Văn bản đã được cập nhật tóm tắt');
    });

    it('POST /api/documents/[id]/directives creates directive and school task atomically in $transaction', async (t) => {
      if (testDatabaseHasLegacyDirectiveColumn) {
        t.skip('The active test database retains the legacy NOT NULL assigned_dept_id column; canonical writes require the approved schema migration.');
        return;
      }

      const req = new NextRequest(
        `http://localhost:3000/api/documents/${testDocId}/directives`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${managerToken}`,
          },
          body: JSON.stringify({
            instruction: 'Giao phòng thử nghiệm 1 chủ trì thực hiện',
            leadUnitId: testDept1.id,
            deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
          }),
        }
      );
      const res = await postDirectiveRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.task);
      assert.ok(json.data.directive);
      assert.strictEqual(json.data.task.leadUnitId, testDept1.id);
      assert.strictEqual(json.data.document.status, 'DANG_XU_LY');
      createdTaskIds.push(json.data.task.id);
    });

    it('GET /api/documents/[id]/directives returns list of directives', async (t) => {
      if (testDatabaseHasLegacyDirectiveColumn) {
        t.skip('The active test database retains the legacy NOT NULL assigned_dept_id column; canonical writes require the approved schema migration.');
        return;
      }

      const req = new NextRequest(
        `http://localhost:3000/api/documents/${testDocId}/directives`,
        {
          headers: { authorization: `Bearer ${managerToken}` },
        }
      );
      const res = await getDirectivesRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].instruction, 'Giao phòng thử nghiệm 1 chủ trì thực hiện');
    });

    it('GET /api/documents/stats returns aggregated metrics', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/stats', {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const res = await getStatsRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(typeof json.data.total === 'number');
      assert.ok(typeof json.data.incoming === 'number');
      assert.ok(typeof json.data.outgoing === 'number');
    });

    it('GET & POST /api/documents/export-excel outputs spreadsheet buffer with correct headers', async () => {
      const reqGet = new NextRequest(
        'http://localhost:3000/api/documents/export-excel?type=VAN_BAN_DEN',
        {
          headers: { authorization: `Bearer ${adminToken}` },
        }
      );
      const resGet = await getExportRoute(reqGet);
      assert.strictEqual(resGet.status, 200);
      const contentType = resGet.headers.get('content-type') || '';
      assert.ok(
        contentType.includes('text/csv') ||
          contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      );

      const reqPost = new NextRequest(
        'http://localhost:3000/api/documents/export-excel',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ type: 'VAN_BAN_DEN', documentYear: 2026 }),
        }
      );
      const resPost = await postExportRoute(reqPost);
      assert.strictEqual(resPost.status, 200);
    });

    it('DELETE /api/documents/[id] soft/hard removes document', async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const res = await deleteDocumentRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      // Verify not found after delete
      const verifyReq = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const verifyRes = await getDocumentRoute(verifyReq, { params: Promise.resolve({ id: testDocId }) });
      assert.strictEqual(verifyRes.status, 404);
    });
  });

  describe('6. Rate Limiting Enforcement (429)', () => {
    it('triggers rate limit when requests exceed tier quota', async () => {
      resetRateLimits();
      const clientIp = '198.51.100.42';

      // Export tier has maxRequests = 20
      let lastRes: any;
      for (let i = 0; i < 22; i++) {
        const req = new NextRequest('http://localhost:3000/api/documents/export-excel', {
          headers: {
            authorization: `Bearer ${adminToken}`,
            'x-forwarded-for': clientIp,
          },
        });
        lastRes = await getExportRoute(req);
      }

      assert.strictEqual(lastRes.status, 429);
      const json = await lastRes.json();
      assert.strictEqual(json.code, 'RATE_LIMITED');
    });
  });
});
