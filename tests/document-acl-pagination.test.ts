import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { listDocuments } from '../src/lib/documents/document-service';
import { GET as listDocumentsRoute } from '../src/app/api/documents/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import {
  DocumentType,
  DocumentStatus,
  DocumentUrgency,
  DocumentSecurityLevel,
} from '@prisma/client';

describe('Task 3.17: Document ACL-Before-Pagination (F13)', () => {
  const runId = Math.random().toString(36).substring(2, 9);

  let deptA: any;
  let deptB: any;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // 1. Create departments
    deptA = await prisma.department.create({
      data: {
        id: `DEPT_A_${runId}`,
        name: `Phòng Nghiệp vụ A ${runId}`,
        shortName: `P.NVA_${runId}`,
      },
    });

    deptB = await prisma.department.create({
      data: {
        id: `DEPT_B_${runId}`,
        name: `Phòng Nghiệp vụ B ${runId}`,
        shortName: `P.NVB_${runId}`,
      },
    });

    // 2. Create users
    userA = await prisma.user.create({
      data: {
        email: `user_a_${runId}@qcet.edu.vn`,
        name: `Chuyên viên A ${runId}`,
        passwordHash: 'dummy-password-hash',
        role: 'CHUYEN_VIEN',
        departmentId: deptA.id,
        isActive: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `user_b_${runId}@qcet.edu.vn`,
        name: `Chuyên viên B ${runId}`,
        passwordHash: 'dummy-password-hash',
        role: 'CHUYEN_VIEN',
        departmentId: deptB.id,
        isActive: true,
      },
    });

    tokenA = signSessionToken({
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: userA.role,
      departmentId: userA.departmentId,
    });

    tokenB = signSessionToken({
      id: userB.id,
      email: userB.email,
      name: userB.name,
      role: userB.role,
      departmentId: userB.departmentId,
    });

    // 3. Create 100 unauthorized documents (Department B, registered by User B)
    const unauthorizedBatch = Array.from({ length: 100 }, (_, i) => ({
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 20000 + i + 1,
      documentYear: 2099,
      originalNumber: `UNAUTH_${runId}_${i + 1}`,
      issuedDate: new Date('2099-01-15'),
      issuingAuthority: `Cơ quan ngoài B ${i + 1}`,
      category: 'Công văn',
      summary: `Văn bản phòng B không có quyền ${runId} số ${i + 1}`,
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      leadDepartmentId: deptB.id,
      draftingDeptId: deptB.id,
      registeredById: userB.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    }));

    await prisma.document.createMany({
      data: unauthorizedBatch,
    });

    // 4. Create 5 authorized documents (Department A, registered by User A)
    const authorizedBatch = Array.from({ length: 5 }, (_, j) => ({
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 30000 + j + 1,
      documentYear: 2099,
      originalNumber: `AUTH_${runId}_${j + 1}`,
      issuedDate: new Date('2099-02-10'),
      issuingAuthority: `UBND Tỉnh  ${j + 1}`,
      category: 'Tờ trình',
      summary: `Văn bản phòng A được phép xem ${runId} số ${j + 1}`,
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      leadDepartmentId: deptA.id,
      draftingDeptId: deptA.id,
      registeredById: userA.id,
      status: DocumentStatus.CHO_PHAN_CONG,
    }));

    await prisma.document.createMany({
      data: authorizedBatch,
    });
  });

  after(async () => {
    // Cleanup documents
    await prisma.document.deleteMany({
      where: {
        originalNumber: {
          contains: runId,
        },
      },
    });

    // Cleanup users
    await prisma.user.deleteMany({
      where: {
        id: { in: [userA.id, userB.id] },
      },
    });

    // Cleanup departments
    await prisma.department.deleteMany({
      where: {
        id: { in: [deptA.id, deptB.id] },
      },
    });
  });

  test('listDocuments applies ACL before pagination: page 1 with limit 10 returns exactly 5 authorized docs and total 5 (NOT 0)', async () => {
    // User A queries page 1 (limit 10, offset 0)
    const result = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      limit: 10,
      offset: 0,
      authUser: userA,
    });

    // Total must be exactly 5 from database-level count
    assert.equal(
      result.total,
      5,
      'Total count from database must be exactly 5 authorized documents'
    );

    // Page 1 with limit 10 must return all 5 authorized documents, NOT 0
    assert.equal(
      result.documents.length,
      5,
      'Page 1 must return 5 authorized documents instead of being starved by unauthorized docs'
    );

    // Array interface also returns 5 items
    assert.equal(result.length, 5);

    // All returned documents must belong to Department A / registered by User A
    for (const doc of result.documents) {
      assert.equal(doc.leadDepartmentId, deptA.id);
      assert.equal(doc.registeredById, userA.id);
      assert.ok(doc.originalNumber.startsWith(`AUTH_${runId}`));
    }
  });

  test('GET /api/documents HTTP route applies ACL before pagination and returns true total', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/documents?type=VAN_BAN_DEN&documentYear=2099&limit=10&page=1`,
      {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
        },
      }
    );

    const res = await listDocumentsRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(
      json.total,
      5,
      'API route total must reflect database-level count of authorized documents (5)'
    );
    assert.equal(
      json.data.length,
      5,
      'API route page 1 must contain all 5 authorized documents'
    );
    assert.equal(json.documents.length, 5);
    assert.equal(json.page, 1);
    assert.equal(json.limit, 10);

    for (const doc of json.data) {
      assert.equal(doc.leadDepartmentId, deptA.id);
      assert.ok(doc.originalNumber.startsWith(`AUTH_${runId}`));
    }
  });

  test('Multi-page pagination correctly partitions the authorized dataset', async () => {
    // Page 1: limit 2, offset 0 -> 2 items, total 5
    const page1 = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      limit: 2,
      offset: 0,
      authUser: userA,
    });
    assert.equal(page1.total, 5);
    assert.equal(page1.documents.length, 2);

    // Page 2: limit 2, offset 2 -> 2 items, total 5
    const page2 = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      limit: 2,
      offset: 2,
      authUser: userA,
    });
    assert.equal(page2.total, 5);
    assert.equal(page2.documents.length, 2);

    // Page 3: limit 2, offset 4 -> 1 item, total 5
    const page3 = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      limit: 2,
      offset: 4,
      authUser: userA,
    });
    assert.equal(page3.total, 5);
    assert.equal(page3.documents.length, 1);

    // Page 4: limit 2, offset 6 -> 0 items, total 5
    const page4 = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      limit: 2,
      offset: 6,
      authUser: userA,
    });
    assert.equal(page4.total, 5);
    assert.equal(page4.documents.length, 0);

    // Verify non-overlapping IDs across pages
    const ids = [
      ...page1.documents.map((d) => d.id),
      ...page2.documents.map((d) => d.id),
      ...page3.documents.map((d) => d.id),
    ];
    assert.equal(new Set(ids).size, 5, 'All 5 distinct authorized documents must be paginated across pages 1-3');
  });

  test('User B receives only their 100 documents and never sees User A documents', async () => {
    const resultB = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      limit: 10,
      offset: 0,
      authUser: userB,
    });

    assert.equal(resultB.total, 100);
    assert.equal(resultB.documents.length, 10);

    for (const doc of resultB.documents) {
      assert.equal(doc.leadDepartmentId, deptB.id);
      assert.notEqual(doc.leadDepartmentId, deptA.id);
    }
  });

  test('Query filters combine cleanly with ACL where clause using Prisma AND', async () => {
    // User A filters by originalNumber search keyword
    const searchResult = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      search: `AUTH_${runId}_3`,
      limit: 10,
      offset: 0,
      authUser: userA,
    });

    assert.equal(searchResult.total, 1);
    assert.equal(searchResult.documents.length, 1);
    assert.equal(searchResult.documents[0].originalNumber, `AUTH_${runId}_3`);

    // User A searches for User B's document keyword -> 0 results, total 0
    const unauthorizedSearch = await listDocuments({
      type: DocumentType.VAN_BAN_DEN,
      documentYear: 2099,
      search: `UNAUTH_${runId}_1`,
      limit: 10,
      offset: 0,
      authUser: userA,
    });

    assert.equal(unauthorizedSearch.total, 0);
    assert.equal(unauthorizedSearch.documents.length, 0);
  });
});
