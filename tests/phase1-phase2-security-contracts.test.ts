import { test, describe, before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { UserRole, UnitType, JobCatalogGroup, OrganizationalBodyType, BodyMemberRole } from '@prisma/client';

// Route Handlers
import { POST as createBodyRoute, GET as getBodiesRoute } from '../src/app/api/organization/bodies/route';
import { POST as addBodyMemberRoute } from '../src/app/api/organization/bodies/[id]/route';
import { POST as createDelegationRoute, GET as getDelegationsRoute } from '../src/app/api/delegations/route';
import { POST as revokeDelegationRoute } from '../src/app/api/delegations/[id]/revoke/route';

// Domain Contracts
import {
  TaskCapability,
  checkAntiSelfApproval,
  evaluateTaskCapabilityMatrix,
  CAN_VIEW,
  CAN_EDIT,
  CAN_SUBMIT,
  CAN_APPROVE,
  CAN_REJECT,
  CAN_DELEGATE,
  CAN_DELETE,
  CAN_DOWNLOAD,
} from '../src/domain/tasks/contract';

describe('Phase 1 & Phase 2 Security, Delegation API & Canonical Contract Verification', () => {
  let dept: any;
  let orgUnit: any;
  let adminUser: any;
  let rectorUser: any;
  let staffUser: any;
  let secondStaffUser: any;

  let adminToken: string;
  let rectorToken: string;
  let staffToken: string;
  let secondStaffToken: string;

  let rectorAssignment: any;
  let staffAssignment: any;
  let secondStaffAssignment: any;

  const createdBodyIds: string[] = [];
  const createdDelegationIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  function makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: Record<string, any>,
    token?: string
  ): NextRequest {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      origin: 'http://localhost',
      host: 'localhost',
    };
    if (token) {
      headers['cookie'] = `${SESSION_COOKIE_NAME}=${token}`;
    }
    return new NextRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  before(async () => {
    const timestamp = Date.now();

    dept = await prisma.organizationalUnit.findFirst();
    if (!dept) {
      dept = await prisma.organizationalUnit.create({
        data: {
          id: `dept_p1p2_${timestamp}`,
          name: 'Phòng Tổ chức Cán bộ P1P2',
,
        },
      });
    }

    orgUnit = await prisma.organizationalUnit.findFirst();
    if (!orgUnit) {
      orgUnit = await prisma.organizationalUnit.create({
        data: {
          id: `ou_p1p2_${timestamp}`,
          name: 'Phòng Tổ chức Cán bộ P1P2',
          code: `OU_P1P2_${timestamp}`,
          type: UnitType.DEPARTMENT,
        },
      });
    }

    // 1. Admin
    adminUser = await prisma.user.create({
      data: {
        name: 'Quản trị viên Hệ thống',
        email: `admin_${timestamp}@qcet.edu.vn`,
        role: UserRole.ADMIN,

      },
    });
    createdUserIds.push(adminUser.id);

    // 2. Rector
    let posRectorDef = await prisma.positionDefinition.findUnique({
      where: { code: 'HIEU_TRUONG' },
    });
    if (!posRectorDef) {
      posRectorDef = await prisma.positionDefinition.create({
        data: {
          code: 'HIEU_TRUONG',
          title: 'Hiệu trưởng',
          group: JobCatalogGroup.LDPU,
          isLeadership: true,
        },
      });
    }

    rectorUser = await prisma.user.create({
      data: {
        name: 'Hiệu Trưởng Test',
        email: `rector_${timestamp}@qcet.edu.vn`,
        role: UserRole.BAN_GIAM_HIEU,

      },
    });
    createdUserIds.push(rectorUser.id);

    rectorAssignment = await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        positionDefinitionId: posRectorDef.id,
        unitId: orgUnit.id,
        status: 'ACTIVE',
      },
    });
    createdAssignmentIds.push(rectorAssignment.id);

    // 3. Staff User
    let posStaffDef = await prisma.positionDefinition.findUnique({
      where: { code: 'CHUYEN_VIEN' },
    });
    if (!posStaffDef) {
      posStaffDef = await prisma.positionDefinition.create({
        data: {
          code: 'CHUYEN_VIEN',
          title: 'Chuyên viên',
          group: JobCatalogGroup.VCDC,
          isLeadership: false,
        },
      });
    }

    staffUser = await prisma.user.create({
      data: {
        name: 'Chuyên viên A',
        email: `staff_a_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });
    createdUserIds.push(staffUser.id);

    staffAssignment = await prisma.positionAssignment.create({
      data: {
        userId: staffUser.id,
        positionDefinitionId: posStaffDef.id,
        unitId: orgUnit.id,
        status: 'ACTIVE',
      },
    });
    createdAssignmentIds.push(staffAssignment.id);

    // 4. Second Staff User
    secondStaffUser = await prisma.user.create({
      data: {
        name: 'Chuyên viên B',
        email: `staff_b_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });
    createdUserIds.push(secondStaffUser.id);

    secondStaffAssignment = await prisma.positionAssignment.create({
      data: {
        userId: secondStaffUser.id,
        positionDefinitionId: posStaffDef.id,
        unitId: orgUnit.id,
        status: 'ACTIVE',
      },
    });
    createdAssignmentIds.push(secondStaffAssignment.id);

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,

    });

    rectorToken = signSessionToken({
      id: rectorUser.id,
      email: rectorUser.email,
      name: rectorUser.name,
      role: rectorUser.role,

    });

    staffToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,

    });

    secondStaffToken = signSessionToken({
      id: secondStaffUser.id,
      email: secondStaffUser.email,
      name: secondStaffUser.name,
      role: secondStaffUser.role,

    });
  });

  after(async () => {
    // Cleanup delegations
    await prisma.delegationGrant.deleteMany({
      where: {
        OR: [
          { id: { in: createdDelegationIds } },
          { grantorAssignmentId: { in: createdAssignmentIds } },
          { granteeAssignmentId: { in: createdAssignmentIds } },
        ],
      },
    });

    // Cleanup bodies
    if (createdBodyIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdBodyIds } },
      });
      await prisma.bodyMembership.deleteMany({
        where: { bodyId: { in: createdBodyIds } },
      });
      await prisma.organizationalBody.deleteMany({
        where: { id: { in: createdBodyIds } },
      });
    }

    // Cleanup assignments and users
    if (createdAssignmentIds.length > 0) {
      await prisma.positionAssignment.deleteMany({
        where: { id: { in: createdAssignmentIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  // ==========================================================================
  // TASK 1: FIX CRITICAL PRIVILEGE ESCALATION (Org Bodies BAC CVE)
  // ==========================================================================
  describe('Task 1: Org Bodies Broken Access Control (BAC) Mitigation', () => {
    it('blocks unauthenticated callers from creating an institutional body (401 Unauthorized)', async () => {
      const req = makeRequest(
        'POST',
        'http://localhost/api/organization/bodies',
        {
          name: 'Hội đồng Không danh tính',
          code: `HD_ANON_${Date.now()}`,
          type: OrganizationalBodyType.COUNCIL,
        }
      );

      const res = await createBodyRoute(req);
      assert.equal(res.status, 401, 'Unauthenticated call must return 401');
      const body = await res.json();
      assert.equal(body.code, 'AUTH_REQUIRED');
    });

    it('blocks regular staff from creating an institutional body (403 Forbidden)', async () => {
      const req = makeRequest(
        'POST',
        'http://localhost/api/organization/bodies',
        {
          name: 'Hội đồng Tự phong',
          code: `HD_HACK_${Date.now()}`,
          type: OrganizationalBodyType.COUNCIL,
          establishedBy: 'Chuyên viên tự lập',
        },
        staffToken
      );

      const res = await createBodyRoute(req);
      assert.equal(res.status, 403, 'Should reject non-executive callers with 403');
      const body = await res.json();
      assert.equal(body.code, 'FORBIDDEN');
    });

    it('allows Rector or Admin to create an institutional body', async () => {
      const code = `HD_KH_${Date.now()}`;
      const req = makeRequest(
        'POST',
        'http://localhost/api/organization/bodies',
        {
          name: 'Hội đồng Khoa học và Đào tạo',
          code,
          type: OrganizationalBodyType.COUNCIL,
          establishedBy: 'Quyết định 100/QĐ-CĐKTCN',
        },
        rectorToken
      );

      const res = await createBodyRoute(req);
      assert.equal(res.status, 201, 'Rector should be allowed to create body');
      const body = await res.json();
      const bodyData = body.data || body;
      assert.ok(bodyData.id);
      createdBodyIds.push(bodyData.id);
    });

    it('blocks unauthenticated callers from modifying body members (401 Unauthorized)', async () => {
      const targetBodyId = createdBodyIds[0];
      assert.ok(targetBodyId, 'Target body must exist');

      const req = makeRequest(
        'POST',
        `http://localhost/api/organization/bodies/${targetBodyId}`,
        {
          userId: staffUser.id,
          role: BodyMemberRole.MEMBER,
        }
      );

      const res = await addBodyMemberRoute(req, { params: Promise.resolve({ id: targetBodyId }) });
      assert.equal(res.status, 401, 'Unauthenticated call must return 401');
    });

    it('blocks regular staff from appointing members or themselves as CHAIR (403 Forbidden)', async () => {
      const targetBodyId = createdBodyIds[0];
      assert.ok(targetBodyId, 'Target body must exist');

      const req = makeRequest(
        'POST',
        `http://localhost/api/organization/bodies/${targetBodyId}`,
        {
          userId: staffUser.id,
          role: BodyMemberRole.CHAIR,
        },
        staffToken
      );

      const res = await addBodyMemberRoute(req, { params: Promise.resolve({ id: targetBodyId }) });
      assert.equal(res.status, 403, 'Should reject non-executive callers with 403 when appointing members');
      const body = await res.json();
      assert.equal(body.code, 'FORBIDDEN');
    });

    it('allows Rector to appoint members to an institutional body', async () => {
      const targetBodyId = createdBodyIds[0];
      assert.ok(targetBodyId, 'Target body must exist');

      const req = makeRequest(
        'POST',
        `http://localhost/api/organization/bodies/${targetBodyId}`,
        {
          userId: staffUser.id,
          role: BodyMemberRole.MEMBER,
        },
        rectorToken
      );

      const res = await addBodyMemberRoute(req, { params: Promise.resolve({ id: targetBodyId }) });
      assert.equal(res.status, 201, 'Rector should be allowed to appoint members');
      const body = await res.json();
      const memberData = body.data || body;
      assert.equal(memberData.role, BodyMemberRole.MEMBER);
    });
  });

  // ==========================================================================
  // TASK 2: CANONICAL DELEGATION API
  // ==========================================================================
  describe('Task 2: Canonical Delegation API & Validation Invariants', () => {
    it('blocks delegation of statutory non-delegable powers (budget sign-off & disciplinary)', async () => {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 86400000 * 30);

      // 1. Budget sign-off
      const reqBudget = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          grantorAssignmentId: rectorAssignment.id,
          granteeAssignmentId: staffAssignment.id,
          action: 'finance.treasury_disbursement',
          resourceScope: 'SCHOOL',
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '123/GUQ-CĐKTCN',
        },
        rectorToken
      );

      const resBudget = await createDelegationRoute(reqBudget);
      assert.equal(resBudget.status, 403, 'Treasury disbursement / budget sign-off must be rejected with 403');
      const bodyBudget = await resBudget.json();
      assert.equal(bodyBudget.code, 'NON_DELEGABLE_POWER');

      // 2. Disciplinary actions
      const reqDisciplinary = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          grantorAssignmentId: rectorAssignment.id,
          granteeAssignmentId: staffAssignment.id,
          action: 'hr.disciplinary_action',
          resourceScope: 'SCHOOL',
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '124/GUQ-CĐKTCN',
        },
        rectorToken
      );

      const resDisciplinary = await createDelegationRoute(reqDisciplinary);
      assert.equal(resDisciplinary.status, 403, 'Disciplinary actions must be rejected with 403');
    });

    it('blocks caller who is neither the delegator nor executive administrator', async () => {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 86400000 * 30);

      const req = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          grantorAssignmentId: rectorAssignment.id,
          granteeAssignmentId: secondStaffAssignment.id,
          action: 'task.approve',
          resourceScope: 'UNIT',
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '125/GUQ-CĐKTCN',
        },
        staffToken // staff user trying to delegate rector's assignment!
      );

      const res = await createDelegationRoute(req);
      assert.equal(res.status, 403, 'Non-delegator non-executive caller must be rejected with 403');
    });

    it('blocks self-delegation (violating separation of powers)', async () => {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 86400000 * 30);

      const req = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          grantorAssignmentId: rectorAssignment.id,
          granteeAssignmentId: rectorAssignment.id,
          action: 'task.approve',
          resourceScope: 'UNIT',
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '126/GUQ-CĐKTCN',
        },
        rectorToken
      );

      const res = await createDelegationRoute(req);
      assert.equal(res.status, 400, 'Self-delegation must be rejected with 400');
    });

    let createdDelegationId: string;

    it('allows delegator to create a valid statutory delegation grant', async () => {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 86400000 * 30);

      const req = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          grantorAssignmentId: rectorAssignment.id,
          granteeAssignmentId: staffAssignment.id,
          action: 'task.approve',
          resourceScope: 'DEPARTMENT',
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '127/GUQ-CĐKTCN',
          reason: 'Ủy quyền phê duyệt nhiệm vụ nội bộ trong thời gian đi công tác',
        },
        rectorToken
      );

      const res = await createDelegationRoute(req);
      assert.equal(res.status, 201, 'Should create delegation successfully');
      const body = await res.json();
      const delegationData = body.data || body;
      assert.ok(delegationData.id);
      createdDelegationId = delegationData.id;
      createdDelegationIds.push(createdDelegationId);
    });

    it('lists delegations with GET /api/delegations', async () => {
      const req = makeRequest('GET', 'http://localhost/api/delegations?status=ACTIVE', undefined, rectorToken);
      const res = await getDelegationsRoute(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const list = Array.isArray(body) ? body : body.data || [];
      assert.ok(Array.isArray(list));
      const found = list.some((d: any) => d.id === createdDelegationId);
      assert.ok(found, 'Created delegation should be listed');
    });

    it('revokes delegation with POST /api/delegations/[id]/revoke and logs audit event', async () => {
      assert.ok(createdDelegationId, 'Delegation must exist');
      const req = makeRequest(
        'POST',
        `http://localhost/api/delegations/${createdDelegationId}/revoke`,
        { reason: 'Hoàn thành chuyến công tác, thu hồi ủy quyền' },
        rectorToken
      );

      const res = await revokeDelegationRoute(req, {
        params: Promise.resolve({ id: createdDelegationId }),
      });
      assert.equal(res.status, 200, 'Should revoke delegation successfully');
      const body = await res.json();
      const revokedData = body.data || body;
      assert.equal(revokedData.status, 'REVOKED');
      assert.ok(revokedData.revokedAt, 'revokedAt must be set');

      // Verify DB state
      const dbRecord = await prisma.delegationGrant.findUnique({
        where: { id: createdDelegationId },
      });
      assert.equal(dbRecord?.status, 'REVOKED');
      assert.ok(dbRecord?.revokedAt);
    });

    it('validates delegatorPositionId, delegateeUserId, and capabilities array correctly', async () => {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 86400000 * 14);

      // 1. Successful delegation using delegatorPositionId, delegateeUserId, and capabilities array
      const req = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          delegatorPositionId: rectorAssignment.id,
          delegateeUserId: staffUser.id,
          capabilities: ['task.approve'],
          resourceScope: 'UNIT',
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '128/GUQ-CĐKTCN',
          reason: 'Ủy quyền theo danh sách capabilities và ID vị trí/người dùng',
        },
        rectorToken
      );

      const res = await createDelegationRoute(req);
      assert.equal(res.status, 201, 'Should create delegation using alias fields');
      const body = await res.json();
      assert.equal(body.action, 'task.approve');
      createdDelegationIds.push(body.id);

      // 2. Reject if capabilities contains a non-delegable action
      const reqNonDelegable = makeRequest(
        'POST',
        'http://localhost/api/delegations',
        {
          delegatorPositionId: rectorAssignment.id,
          delegateeUserId: staffUser.id,
          capabilities: ['finance.treasury_disbursement'],
          validFrom: now.toISOString(),
          validUntil: validUntil.toISOString(),
          sourceDocumentNumber: '129/GUQ-CĐKTCN',
        },
        rectorToken
      );

      const resNonDelegable = await createDelegationRoute(reqNonDelegable);
      assert.equal(resNonDelegable.status, 403);
      const errJson = await resNonDelegable.json();
      assert.equal(errJson.code, 'NON_DELEGABLE_POWER');
    });
  });

  // ==========================================================================
  // TASK 3: CANONICAL BUSINESS CONTRACT & SOD ANTI-SELF-APPROVAL
  // ==========================================================================
  describe('Task 3: Canonical Business Contract & SoD Matrix', () => {
    it('exports all 8 canonical capabilities', () => {
      assert.equal(CAN_VIEW, 'CAN_VIEW');
      assert.equal(CAN_EDIT, 'CAN_EDIT');
      assert.equal(CAN_SUBMIT, 'CAN_SUBMIT');
      assert.equal(CAN_APPROVE, 'CAN_APPROVE');
      assert.equal(CAN_REJECT, 'CAN_REJECT');
      assert.equal(CAN_DELEGATE, 'CAN_DELEGATE');
      assert.equal(CAN_DELETE, 'CAN_DELETE');
      assert.equal(CAN_DOWNLOAD, 'CAN_DOWNLOAD');

      assert.equal(TaskCapability.CAN_VIEW, 'CAN_VIEW');
      assert.equal(TaskCapability.CAN_APPROVE, 'CAN_APPROVE');
    });

    it('enforces SoD: Creator cannot approve or reject their own task', () => {
      const sod = checkAntiSelfApproval({
        userId: 'user_1',
        creatorId: 'user_1',
        primaryOwnerId: 'user_2',
      });
      assert.equal(sod.allowed, false);
      assert.equal(sod.violationCode, 'SOD_CREATOR_CANNOT_APPROVE');
    });

    it('enforces SoD: Primary Owner (DRI) cannot approve or reject their own task', () => {
      const sod = checkAntiSelfApproval({
        userId: 'user_2',
        creatorId: 'user_1',
        primaryOwnerId: 'user_2',
      });
      assert.equal(sod.allowed, false);
      assert.equal(sod.violationCode, 'SOD_DRI_CANNOT_APPROVE');
    });

    it('enforces SoD: Submitter / deliverable uploader cannot approve their own task', () => {
      const sod = checkAntiSelfApproval({
        userId: 'user_3',
        creatorId: 'user_1',
        primaryOwnerId: 'user_2',
        submittedByUserId: 'user_3',
      });
      assert.equal(sod.allowed, false);
      assert.equal(sod.violationCode, 'SOD_SUBMITTER_CANNOT_APPROVE');
    });

    it('allows an independent authorized approver who passed SoD checks', () => {
      const sod = checkAntiSelfApproval({
        userId: 'independent_rector',
        creatorId: 'dept_head_1',
        primaryOwnerId: 'staff_1',
        submittedByUserId: 'staff_1',
      });
      assert.equal(sod.allowed, true);
    });

    it('evaluates full 8-point matrix correctly: DRI has CAN_SUBMIT but CANNOT CAN_APPROVE', () => {
      const actor = {
        id: 'dri_user',
        role: 'CHUYEN_VIEN',

      };

      const task = {
        id: 'task_1',
        status: 'WAITING_APPROVAL',
        creatorId: 'manager_user',
        primaryOwnerId: 'dri_user',

        deliverables: [{ id: 'del_1', uploadedById: 'dri_user' }],
      };

      const result = evaluateTaskCapabilityMatrix(actor, task);
      assert.equal(result.matrix.CAN_VIEW, true, 'DRI can view');
      assert.equal(result.matrix.CAN_DOWNLOAD, true, 'DRI can download deliverables');
      assert.equal(result.matrix.CAN_APPROVE, false, 'DRI CANNOT approve (SoD violation)');
      assert.equal(result.matrix.CAN_REJECT, false, 'DRI CANNOT reject (SoD violation)');
    });
  });
});
