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
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import {
  UserRole,
  DocumentType,
  DocumentSecurityLevel,
  DocumentStatus,
  UnitType,
  UnitStatus,
  AssignmentType,
  AssignmentStatus,
  DelegationStatus,
} from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import {
  canAccessClassification,
  resolveDocumentApplicationClassification,
  type DocumentClassificationTarget,
} from '@/server/authorization/document-classification';
import {
  canReadDocument,
  canUpdateDocument,
  canDeleteDocument,
} from '@/server/policies/document-policy';
import {
  AuthorizationContextModel,
  SystemRole,
  type ActivePositionAssignment,
  type ActiveDelegationGrant,
} from '@/server/authorization/authorization-context';
import { GET as getDocumentRoute } from '@/app/api/documents/[id]/route';
import { GET as listDocumentsRoute } from '@/app/api/documents/route';
import { GET as exportExcelRoute } from '@/app/api/documents/export-excel/route';
import { GET as getFileRoute } from '@/app/api/files/[...path]/route';

function createTestContext(overrides: {
  userId?: string;
  isActive?: boolean;
  systemRoles?: SystemRole[];
  positions?: ActivePositionAssignment[];
  delegations?: ActiveDelegationGrant[];
  primaryUnitIds?: string[];
}): AuthorizationContextModel {
  const userId = overrides.userId ?? 'usr_test_doc';
  return new AuthorizationContextModel({
    userId,
    user: {
      id: userId,
      email: `${userId}@cdktcnqn.edu.vn`,
      name: `User ${userId}`,
      isActive: overrides.isActive ?? true,
    },
    systemRoles: overrides.systemRoles ?? [],
    positions: overrides.positions ?? [],
    responsibilityAreas: [],
    portfolios: [],
    delegations: overrides.delegations ?? [],
    bodyMemberships: [],
    primaryUnitIds: overrides.primaryUnitIds ?? [],
    generatedAt: new Date(),
  });
}

function createTestPosition(data: {
  userId: string;
  positionCode: string;
  unitId: string;
  isLeadership?: boolean;
}): ActivePositionAssignment {
  return {
    id: `pos_${data.positionCode}_${data.unitId}`,
    userId: data.userId,
    positionDefinitionId: `def_${data.positionCode}`,
    positionCode: data.positionCode,
    positionTitle: data.positionCode,
    positionLevel: data.isLeadership ? 2 : 4,
    isLeadership: data.isLeadership ?? false,
    unitId: data.unitId,
    unitCode: `U_${data.unitId}`,
    unitName: `Unit ${data.unitId}`,
    unitType: UnitType.DEPARTMENT,
    unitStatus: UnitStatus.ACTIVE,
    type: AssignmentType.PRIMARY,
    isActing: false,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
    status: AssignmentStatus.ACTIVE,
    sourceDecisionNumber: 'QD-TEST',
  };
}

describe('Sprint 2: Task 6 (F15: Document Classification Authorization)', () => {
  // --------------------------------------------------------------------------
  // 1. Classification & Legal Marking Resolution
  // --------------------------------------------------------------------------
  describe('1. Classification & Legal Marking Resolution', () => {
    test('Maps THUONG to INTERNAL by default', () => {
      const res = resolveDocumentApplicationClassification({
        securityLevel: DocumentSecurityLevel.THUONG,
      });
      assert.equal(res.applicationClassification, 'INTERNAL');
      assert.equal(res.legalMarking, 'THUONG');
      assert.equal(res.isStateSecret, false);
    });

    test('Maps THUONG with isPublic=true or scope=SCHOOL/PUBLIC to PUBLIC', () => {
      const publicDoc = resolveDocumentApplicationClassification({
        securityLevel: DocumentSecurityLevel.THUONG,
        isPublic: true,
      });
      assert.equal(publicDoc.applicationClassification, 'PUBLIC');

      const schoolScopeDoc = resolveDocumentApplicationClassification({
        securityLevel: DocumentSecurityLevel.THUONG,
        scope: 'SCHOOL',
      });
      assert.equal(schoolScopeDoc.applicationClassification, 'PUBLIC');
    });

    test('Identifies MAT, TOI_MAT, TUYET_MAT as state secret legal markings', () => {
      for (const level of [DocumentSecurityLevel.MAT, DocumentSecurityLevel.TOI_MAT, DocumentSecurityLevel.TUYET_MAT]) {
        const res = resolveDocumentApplicationClassification({ securityLevel: level });
        assert.equal(res.isStateSecret, true);
        assert.equal(res.legalMarking, level);
      }
    });

    test('Honors explicit application classification RESTRICTED and PERSONAL_DATA', () => {
      const restricted = resolveDocumentApplicationClassification({
        classification: 'RESTRICTED',
      });
      assert.equal(restricted.applicationClassification, 'RESTRICTED');

      const personal = resolveDocumentApplicationClassification({
        classification: 'PERSONAL_DATA',
      });
      assert.equal(personal.applicationClassification, 'PERSONAL_DATA');
    });
  });

  // --------------------------------------------------------------------------
  // 2. canAccessClassification Canonical Engine Evaluation
  // --------------------------------------------------------------------------
  describe('2. canAccessClassification Canonical Engine Evaluation', () => {
    test('same unit + INTERNAL -> ALLOW if in unit scope', () => {
      const ctx = createTestContext({
        userId: 'usr_staff_unit1',
        primaryUnitIds: ['unit_1'],
        positions: [createTestPosition({ userId: 'usr_staff_unit1', positionCode: 'CHUYEN_VIEN', unitId: 'unit_1' })],
      });

      const doc: DocumentClassificationTarget = {
        id: 'doc_internal_unit1',
        securityLevel: DocumentSecurityLevel.THUONG,
        leadUnitId: 'unit_1',
      };

      const result = canAccessClassification(ctx, doc);
      assert.equal(result.allowed, true);
    });

    test('different unit + INTERNAL without relationship or leadership -> DENY', () => {
      const ctx = createTestContext({
        userId: 'usr_staff_unit2',
        primaryUnitIds: ['unit_2'],
        positions: [createTestPosition({ userId: 'usr_staff_unit2', positionCode: 'CHUYEN_VIEN', unitId: 'unit_2' })],
      });

      const doc: DocumentClassificationTarget = {
        id: 'doc_internal_unit1',
        securityLevel: DocumentSecurityLevel.THUONG,
        leadUnitId: 'unit_1',
      };

      const result = canAccessClassification(ctx, doc);
      assert.equal(result.allowed, false);
    });

    test('same unit + RESTRICTED without explicit relationship -> DENY', () => {
      const ctx = createTestContext({
        userId: 'usr_staff_unit1',
        primaryUnitIds: ['unit_1'],
        positions: [createTestPosition({ userId: 'usr_staff_unit1', positionCode: 'CHUYEN_VIEN', unitId: 'unit_1' })],
      });

      const doc: DocumentClassificationTarget = {
        id: 'doc_restricted_unit1',
        classification: 'RESTRICTED',
        leadUnitId: 'unit_1',
        creatorId: 'usr_other',
      };

      const result = canAccessClassification(ctx, doc);
      assert.equal(result.allowed, false);
      assert.match(result.reason, /thành viên đơn vị không đương nhiên được truy cập/i);
    });

    test('SYSTEM_ADMIN + RESTRICTED without business authority -> DENY', () => {
      const ctx = createTestContext({
        userId: 'usr_sys_admin',
        systemRoles: [SystemRole.SYSTEM_ADMIN],
        positions: [], // Technical admin has no business positions
      });

      const doc: DocumentClassificationTarget = {
        id: 'doc_restricted_any',
        classification: 'RESTRICTED',
        creatorId: 'usr_leader',
      };

      const result = canAccessClassification(ctx, doc);
      assert.equal(result.allowed, false);
    });

    test('authorized document actor (creator, signer, leadUser) -> ALLOW for RESTRICTED', () => {
      // 1. Creator
      const creatorCtx = createTestContext({ userId: 'usr_creator' });
      const docCreator: DocumentClassificationTarget = {
        id: 'doc_1',
        classification: 'RESTRICTED',
        creatorId: 'usr_creator',
      };
      assert.equal(canAccessClassification(creatorCtx, docCreator).allowed, true);

      // 2. Signer
      const signerCtx = createTestContext({ userId: 'usr_signer' });
      const docSigner: DocumentClassificationTarget = {
        id: 'doc_2',
        classification: 'RESTRICTED',
        signerId: 'usr_signer',
      };
      assert.equal(canAccessClassification(signerCtx, docSigner).allowed, true);

      // 3. Lead User
      const leadCtx = createTestContext({ userId: 'usr_lead' });
      const docLead: DocumentClassificationTarget = {
        id: 'doc_3',
        classification: 'RESTRICTED',
        leadUserId: 'usr_lead',
      };
      assert.equal(canAccessClassification(leadCtx, docLead).allowed, true);

      // 4. Directive target
      const dirCtx = createTestContext({ userId: 'usr_directive_target' });
      const docDirective: DocumentClassificationTarget = {
        id: 'doc_4',
        classification: 'RESTRICTED',
        directives: [
          { leaderId: 'usr_leader', assignedDeptId: 'unit_other', collaboratorIds: 'usr_a, usr_directive_target, usr_b' },
        ],
      };
      assert.equal(canAccessClassification(dirCtx, docDirective).allowed, true);
    });

    test('active valid delegation -> ALLOW for RESTRICTED', () => {
      const now = new Date('2026-09-10T12:00:00.000Z');
      const ctx = createTestContext({
        userId: 'usr_delegate',
        delegations: [
          {
            id: 'del_1',
            grantorAssignmentId: 'pos_grantor',
            grantorUserId: 'usr_grantor',
            granteeAssignmentId: 'pos_grantee',
            granteeUserId: 'usr_delegate',
            responsibilityAreaId: null,
            action: 'document.read_restricted',
            resourceScope: 'document:doc_restricted_1',
            validFrom: new Date('2026-09-01T00:00:00.000Z'),
            validUntil: new Date('2026-09-30T23:59:59.000Z'),
            sourceDocumentNumber: 'QD-UQ-01',
            reason: 'Ủy quyền tiếp cận văn bản nhạy cảm',
            status: DelegationStatus.ACTIVE,
            revokedAt: null,
            revokedReason: null,
            scopeRules: [],
          },
        ],
      });

      const doc: DocumentClassificationTarget = {
        id: 'doc_restricted_1',
        classification: 'RESTRICTED',
      };

      const result = canAccessClassification(ctx, doc, now);
      assert.equal(result.allowed, true);
    });

    test('expired delegation -> DENY', () => {
      const now = new Date('2026-09-10T12:00:00.000Z');
      const ctx = createTestContext({
        userId: 'usr_delegate',
        delegations: [
          {
            id: 'del_expired',
            grantorAssignmentId: 'pos_grantor',
            grantorUserId: 'usr_grantor',
            granteeAssignmentId: 'pos_grantee',
            granteeUserId: 'usr_delegate',
            responsibilityAreaId: null,
            action: 'document.read_restricted',
            resourceScope: 'document:doc_restricted_1',
            validFrom: new Date('2026-08-01T00:00:00.000Z'),
            validUntil: new Date('2026-08-31T23:59:59.000Z'), // Expired!
            sourceDocumentNumber: 'QD-UQ-OLD',
            reason: 'Ủy quyền đã hết hạn',
            status: DelegationStatus.ACTIVE,
            revokedAt: null,
            revokedReason: null,
            scopeRules: [],
          },
        ],
      });

      const doc: DocumentClassificationTarget = {
        id: 'doc_restricted_1',
        classification: 'RESTRICTED',
      };

      const result = canAccessClassification(ctx, doc, now);
      assert.equal(result.allowed, false);
    });

    test('default DENY for MAT / TOI_MAT / TUYET_MAT under Luật 117/2025/QH15', () => {
      // Even VAN_THU or SYSTEM_ADMIN is denied
      const clerkCtx = createTestContext({
        userId: 'usr_clerk',
        positions: [createTestPosition({ userId: 'usr_clerk', positionCode: 'VAN_THU', unitId: 'unit_vt' })],
      });

      const adminCtx = createTestContext({
        userId: 'usr_admin',
        systemRoles: [SystemRole.SYSTEM_ADMIN],
      });

      for (const level of [DocumentSecurityLevel.MAT, DocumentSecurityLevel.TOI_MAT, DocumentSecurityLevel.TUYET_MAT]) {
        const secretDoc: DocumentClassificationTarget = {
          id: `doc_secret_${level}`,
          securityLevel: level,
          leadDepartmentId: 'unit_vt',
        };

        const clerkResult = canAccessClassification(clerkCtx, secretDoc);
        assert.equal(clerkResult.allowed, false);
        assert.match(clerkResult.reason, /Luật 117\/2025\/QH15/);

        const adminResult = canAccessClassification(adminCtx, secretDoc);
        assert.equal(adminResult.allowed, false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Document Policy Integration & Removal of Bypasses
  // --------------------------------------------------------------------------
  describe('3. Document Policy Integration', () => {
    test('canReadDocument removes admin and clerk automatic bypasses for RESTRICTED and MAT', () => {
      const adminUser = {
        id: 'usr_admin',
        email: 'admin@qnc.edu.vn',
        name: 'Admin',
        role: 'ADMIN',
      };

      const clerkUser = {
        id: 'usr_clerk',
        email: 'clerk@qnc.edu.vn',
        name: 'Văn thư',
        role: 'VAN_THU',

      };

      const restrictedDoc = {
        id: 'doc_res',
        classification: 'RESTRICTED',

        creatorId: 'usr_other',
      };

      const secretDoc = {
        id: 'doc_sec',
        securityLevel: DocumentSecurityLevel.MAT,

      };

      // Admin cannot bypass
      assert.equal(canReadDocument(adminUser, restrictedDoc), false);
      assert.equal(canReadDocument(adminUser, secretDoc), false);

      // Clerk cannot bypass
      assert.equal(canReadDocument(clerkUser, restrictedDoc), false);
      assert.equal(canReadDocument(clerkUser, secretDoc), false);
    });

    test('canReadDocument supports AuthorizationContext as well as AuthenticatedUser', () => {
      const ctx = createTestContext({
        userId: 'usr_creator',
      });
      const doc = {
        id: 'doc_ctx_test',
        classification: 'RESTRICTED',
        creatorId: 'usr_creator',
      };
      assert.equal(canReadDocument(ctx as any, doc), true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. API Route Consistency, List/Export Filtering & File Access
  // --------------------------------------------------------------------------
  describe('4. API Route Consistency & File Download Security', () => {
    const runId = String(Date.now());
    let unitA: any;
    let unitB: any;
    let userA: any;
    let userB: any;
    let adminUser: any;
    let tokenUserA: string;
    let tokenUserB: string;
    let tokenAdmin: string;

    let docInternalA: any;
    let docRestrictedA: any;
    let docSecretA: any;

    let attachmentInternal: any;
    let attachmentRestricted: any;
    let tempFilePath: string;

    const authHeaders = (token: string) => ({
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      'content-type': 'application/json',
    });

    before(async () => {
      unitA = await prisma.organizationalUnit.create({
        data: {
          id: `dept_a_${runId}`,
          code: `dept_a_${runId}`,
          name: 'Phòng Đào tạo A',
          type: "DEPARTMENT",
          status: "ACTIVE" as any,
        },
      });

      unitB = await prisma.organizationalUnit.create({
        data: {
          id: `dept_b_${runId}`,
          code: `dept_b_${runId}`,
          name: 'Phòng Kế hoạch B',
          type: "DEPARTMENT",
          status: "ACTIVE" as any,
        },
      });

      userA = await prisma.user.create({
        data: {
          email: `usera_${runId}@qnc.edu.vn`,
          name: 'Chuyên viên Đào tạo A',
          role: UserRole.CHUYEN_VIEN,

          isActive: true,
        },
      });

      userB = await prisma.user.create({
        data: {
          email: `userb_${runId}@qnc.edu.vn`,
          name: 'Chuyên viên Kế hoạch B',
          role: UserRole.CHUYEN_VIEN,

          isActive: true,
        },
      });

      adminUser = await prisma.user.create({
        data: {
          email: `admin_${runId}@qnc.edu.vn`,
          name: 'Quản trị kỹ thuật',
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      tokenUserA = signSessionToken({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,

      });

      tokenUserB = signSessionToken({
        id: userB.id,
        email: userB.email,
        name: userB.name,
        role: userB.role,

      });

      tokenAdmin = signSessionToken({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      });

      // Create test files in uploads
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      tempFilePath = path.join(uploadsDir, `test-doc-${runId}.pdf`);
      fs.writeFileSync(tempFilePath, Buffer.from('%PDF-1.4 test document content'));

      // Create test documents in DB
      docInternalA = await prisma.document.create({
        data: {
          type: DocumentType.VAN_BAN_DEN,
          registrationNumber: 1001,
          documentYear: 2026,
          originalNumber: `ORIG_INT_${runId}`,
          issuedDate: new Date(),
          issuingAuthority: 'Sở GDĐT',
          category: 'Công văn',
          summary: `Văn bản nội bộ phòng A ${runId}`,
          securityLevel: DocumentSecurityLevel.THUONG,
          registeredById: userA.id,
          status: DocumentStatus.CHO_PHAN_CONG,
        },
      });

      docRestrictedA = await prisma.document.create({
        data: {
          type: DocumentType.VAN_BAN_DEN,
          registrationNumber: 1002,
          documentYear: 2026,
          originalNumber: `ORIG_RES_${runId}`,
          issuedDate: new Date(),
          issuingAuthority: 'UBND Tỉnh',
          category: 'Tờ trình',
          summary: `Văn bản giới hạn đặc thù ${runId}`,
          securityLevel: DocumentSecurityLevel.THUONG,
          notes: 'RESTRICTED',
          registeredById: userA.id,
          leadUserId: userA.id, // userA is leadUser!
          status: DocumentStatus.CHO_PHAN_CONG,
        },
      });

      docSecretA = await prisma.document.create({
        data: {
          type: DocumentType.VAN_BAN_DEN,
          registrationNumber: 1003,
          documentYear: 2026,
          originalNumber: `ORIG_MAT_${runId}`,
          issuedDate: new Date(),
          issuingAuthority: 'Bộ Công an',
          category: 'Công văn',
          summary: `Văn bản tài liệu mật tuyệt đối không rò rỉ ${runId}`,
          securityLevel: DocumentSecurityLevel.MAT,
          registeredById: userA.id,
          status: DocumentStatus.CHO_PHAN_CONG,
        },
      });

      attachmentInternal = await prisma.documentAttachment.create({
        data: {
          documentId: docInternalA.id,
          fileName: `test-internal-${runId}.pdf`,
          fileUrl: `/uploads/test-doc-${runId}.pdf`,
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });

      attachmentRestricted = await prisma.documentAttachment.create({
        data: {
          documentId: docRestrictedA.id,
          fileName: `test-restricted-${runId}.pdf`,
          fileUrl: `/uploads/test-doc-${runId}.pdf`,
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    after(async () => {
      // Clean up attachments
      await prisma.documentAttachment.deleteMany({
        where: {
          documentId: { in: [docInternalA?.id, docRestrictedA?.id, docSecretA?.id].filter(Boolean) },
        },
      });

      // Clean up documents
      await prisma.document.deleteMany({
        where: {
          id: { in: [docInternalA?.id, docRestrictedA?.id, docSecretA?.id].filter(Boolean) },
        },
      });

      // Clean up users
      await prisma.user.deleteMany({
        where: {
          id: { in: [userA?.id, userB?.id, adminUser?.id].filter(Boolean) },
        },
      });

      // Clean up units
      await prisma.organizationalUnit.deleteMany({
        where: {
          id: { in: [unitA?.id, unitB?.id].filter(Boolean) },
        },
      });

      // Clean up file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    test('GET /api/documents/[id] rejects inaccessible document with 403 Forbidden', async () => {
      // User B tries to read docInternalA (Unit A) -> 403 Forbidden
      const req = new NextRequest(`http://localhost:3000/api/documents/${docInternalA.id}`, {
        method: 'GET',
        headers: authHeaders(tokenUserB),
      });

      const res = await getDocumentRoute(req, { params: Promise.resolve({ id: docInternalA.id }) });
      assert.equal(res.status, 403);
    });

    test('GET /api/documents/[id] allows authorized lead actor to access RESTRICTED document', async () => {
      // User A is leadUser on docRestrictedA -> 200 OK
      const req = new NextRequest(`http://localhost:3000/api/documents/${docRestrictedA.id}`, {
        method: 'GET',
        headers: authHeaders(tokenUserA),
      });

      const res = await getDocumentRoute(req, { params: Promise.resolve({ id: docRestrictedA.id }) });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    test('GET /api/documents filters out inaccessible documents and prevents metadata leak', async () => {
      // User B lists documents -> docInternalA, docRestrictedA, docSecretA must NOT appear
      const req = new NextRequest(`http://localhost:3000/api/documents?documentYear=2026`, {
        method: 'GET',
        headers: authHeaders(tokenUserB),
      });

      const res = await listDocumentsRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      const ids = (json.data || []).map((d: any) => d.id);

      assert.equal(ids.includes(docInternalA.id), false, 'User B must not see docInternalA');
      assert.equal(ids.includes(docRestrictedA.id), false, 'User B must not see docRestrictedA');
      assert.equal(ids.includes(docSecretA.id), false, 'User B must not see docSecretA');
    });

    test('GET /api/documents/export-excel filters out inaccessible documents from export', async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/export-excel?type=VAN_BAN_DEN&year=2026`, {
        method: 'GET',
        headers: authHeaders(tokenUserB),
      });

      const res = await exportExcelRoute(req);
      assert.equal(res.status, 200);
      const csvText = await res.text();

      // Ensure secret or unit A summaries are not present in User B export
      assert.equal(csvText.includes(docSecretA.summary), false, 'Secret doc summary must not leak in export');
      assert.equal(csvText.includes(docInternalA.summary), false, 'Unit A doc summary must not leak in export');
    });

    test('GET /api/files/[...path] enforces parent document classification (403 on inaccessible parent)', async () => {
      // User B attempts to download attachment of docInternalA -> 403 Forbidden
      const req = new NextRequest(`http://localhost:3000/api/files/test-doc-${runId}.pdf`, {
        method: 'GET',
        headers: authHeaders(tokenUserB),
      });

      const res = await getFileRoute(req, {
        params: Promise.resolve({ path: [`test-doc-${runId}.pdf`] }),
      });
      assert.equal(res.status, 403);
    });
  });
});
