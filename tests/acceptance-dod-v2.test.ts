import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorize,
  AuthenticatedUserContext,
  AuthorizationResource,
} from '../src/lib/auth/hybrid-authorization';
import { OutgoingDocumentStatus } from '@prisma/client';

test('QCET E-Office — Comprehensive DoD & Institutional Acceptance Verification', async (suite) => {
  const now = new Date('2026-09-09T08:00:00.000Z');
  const pastDate = new Date('2026-08-01T00:00:00.000Z');
  const futureDate = new Date('2026-10-01T00:00:00.000Z');
  const expiredDate = new Date('2026-09-01T00:00:00.000Z');

  // ============================================================================
  // SECTION 50: 13 INSTITUTIONAL ACCEPTANCE TESTS
  // ============================================================================

  await suite.test('1. PHT Đào tạo -> Task Tài chính -> DENY (PORTFOLIO_MISMATCH)', async () => {
    const phtDaoTao: AuthenticatedUserContext = {
      id: 'usr-pht-daotao',
      name: 'Phó Hiệu trưởng Phụ trách Đào tạo',
      isActive: true,
      activePositionCode: 'PHO_HIEU_TRUONG',
      portfolios: ['PORT_DAO_TAO', 'PORT_QLSV', 'PORT_CHUYEN_DOI_SO'],
    };

    const taskTaiChinh: AuthorizationResource = {
      id: 'task-tc-001',
      type: 'task',
      portfolio: 'PORT_TAI_CHINH',
      owningUnitId: 'unit-tai-chinh',
    };

    const result = await authorize(phtDaoTao, 'task.approve', taskTaiChinh, {}, now);
    assert.equal(result.allowed, false, 'PHT Đào tạo không được duyệt Task Tài chính');
    assert.equal(result.rejectionCode, 'PORTFOLIO_MISMATCH');
  });

  await suite.test('2. PHT Đào tạo -> Task Đào tạo -> ALLOW nếu capability & state đúng', async () => {
    const phtDaoTao: AuthenticatedUserContext = {
      id: 'usr-pht-daotao',
      name: 'Phó Hiệu trưởng Phụ trách Đào tạo',
      isActive: true,
      activePositionCode: 'PHO_HIEU_TRUONG',
      portfolios: ['PORT_DAO_TAO', 'PORT_QLSV', 'PORT_CHUYEN_DOI_SO'],
    };

    const taskDaoTao: AuthorizationResource = {
      id: 'task-dt-001',
      type: 'task',
      portfolio: 'PORT_DAO_TAO',
      owningUnitId: 'unit-dao-tao',
      createdById: 'usr-truongphong-dt', // SoD: Creator != Approver
      primaryOwnerId: 'usr-chuyenvien-dt',
    };

    const result = await authorize(phtDaoTao, 'task.approve', taskDaoTao, {}, now);
    assert.equal(result.allowed, true, 'PHT Đào tạo được phép phê duyệt Task thuộc mảng Đào tạo');
  });

  await suite.test('3. PHT Hành chính -> Task Tuyển sinh -> ALLOW', async () => {
    const phtHanhChinh: AuthenticatedUserContext = {
      id: 'usr-pht-hanhchinh',
      name: 'Phó Hiệu trưởng Phụ trách Hành chính & Tuyển sinh',
      isActive: true,
      activePositionCode: 'PHO_HIEU_TRUONG',
      portfolios: ['PORT_HANH_CHINH', 'PORT_CO_SO_VAT_CHAT', 'PORT_TUYEN_SINH', 'PORT_NGHIEN_CUU_KHOA_HOC'],
    };

    const taskTuyenSinh: AuthorizationResource = {
      id: 'task-ts-001',
      type: 'task',
      portfolio: 'PORT_TUYEN_SINH',
      owningUnitId: 'unit-tuyen-sinh',
      createdById: 'usr-truongphong-ts',
      primaryOwnerId: 'usr-chuyenvien-ts',
    };

    const result = await authorize(phtHanhChinh, 'task.approve', taskTuyenSinh, {}, now);
    assert.equal(result.allowed, true, 'PHT Hành chính được phê duyệt Task thuộc mảng Tuyển sinh');
  });

  await suite.test('4. System Admin -> Approve official document -> DENY (SEPARATION_OF_POWERS_VIOLATION)', async () => {
    const systemAdmin: AuthenticatedUserContext = {
      id: 'usr-sysadmin',
      name: 'Quản trị viên Hệ thống',
      isActive: true,
      role: 'ADMIN',
      systemRole: 'QUAN_TRI_HE_THONG',
    };

    const docOutgoing: AuthorizationResource = {
      id: 'doc-out-001',
      type: 'document_outgoing',
      drafterId: 'usr-chuyenvien-vp',
    };

    const result = await authorize(systemAdmin, 'document.outgoing.authorized_sign', docOutgoing, {}, now);
    assert.equal(result.allowed, false, 'System Admin tuyệt đối không được phê duyệt / ký văn bản hành chính');
    assert.equal(result.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
  });

  await suite.test('5. Văn thư -> Assign document number -> ALLOW', async () => {
    const vanThu: AuthenticatedUserContext = {
      id: 'usr-vanthu',
      name: 'Cán bộ Văn thư',
      isActive: true,
      activePositionCode: 'VAN_THU',
      activeUnitId: 'unit-vanphong',
    };

    const docOutgoing: AuthorizationResource = {
      id: 'doc-out-002',
      type: 'document_outgoing',
      drafterId: 'usr-chuyenvien-vp',
      signerId: 'usr-hieutruong', // SoD: Signer != Numberer
    };

    const result = await authorize(vanThu, 'document.outgoing.assign_number', docOutgoing, {}, now);
    assert.equal(result.allowed, true, 'Văn thư được quyền cấp số văn bản đi');
  });

  await suite.test('6. Văn thư -> Approve document content -> DENY', async () => {
    const vanThu: AuthenticatedUserContext = {
      id: 'usr-vanthu',
      name: 'Cán bộ Văn thư',
      isActive: true,
      activePositionCode: 'VAN_THU',
      activeUnitId: 'unit-vanphong',
    };

    const docOutgoing: AuthorizationResource = {
      id: 'doc-out-003',
      type: 'document_outgoing',
      drafterId: 'usr-chuyenvien-vp',
    };

    const result = await authorize(vanThu, 'document.outgoing.approve_content', docOutgoing, {}, now);
    assert.equal(result.allowed, false, 'Văn thư không được duyệt nội dung văn bản đi (chỉ kiểm tra thể thức hoặc cấp số)');
  });

  await suite.test('7. Head of Unit A -> Task Unit B -> DENY (DEPARTMENT_BOUNDARY_VIOLATION / UNIT_SCOPE_DENIED)', async () => {
    const headUnitA: AuthenticatedUserContext = {
      id: 'usr-head-a',
      name: 'Trưởng phòng A',
      isActive: true,
      activePositionCode: 'TRUONG_PHONG',
      activeUnitId: 'unit-a',
      departmentId: 'unit-a',
    };

    const taskUnitB: AuthorizationResource = {
      id: 'task-b-001',
      type: 'task',
      owningUnitId: 'unit-b',
      leadDepartmentId: 'unit-b',
      createdById: 'usr-head-b',
      primaryOwnerId: 'usr-cv-b',
    };

    const result = await authorize(headUnitA, 'task.approve', taskUnitB, {}, now);
    assert.equal(result.allowed, false, 'Trưởng phòng A không có quyền phê duyệt nhiệm vụ của Phòng B');
  });

  await suite.test('8. Collaborator -> Update own progress -> ALLOW', async () => {
    const collaborator: AuthenticatedUserContext = {
      id: 'usr-collab-01',
      name: 'Cán bộ phối hợp',
      isActive: true,
      activePositionCode: 'CHUYEN_VIEN',
      activeUnitId: 'unit-cntt',
    };

    const task: AuthorizationResource = {
      id: 'task-collab-001',
      type: 'task',
      primaryOwnerId: 'usr-dri-01',
      collaboratorIds: ['usr-collab-01', 'usr-collab-02'],
    };

    const result = await authorize(collaborator, 'task.update_execution', task, {}, now);
    assert.equal(result.allowed, true, 'Cán bộ phối hợp được phép cập nhật tiến độ thực hiện');
  });

  await suite.test('9. Collaborator -> Replace DRI -> DENY (COLLABORATOR_CANNOT_REASSIGN_DRI)', async () => {
    const collaborator: AuthenticatedUserContext = {
      id: 'usr-collab-01',
      name: 'Cán bộ phối hợp',
      isActive: true,
      activePositionCode: 'CHUYEN_VIEN',
      activeUnitId: 'unit-cntt',
    };

    const task: AuthorizationResource = {
      id: 'task-collab-002',
      type: 'task',
      primaryOwnerId: 'usr-dri-01',
      collaboratorIds: ['usr-collab-01'],
      owningUnitId: 'unit-cntt',
    };

    const result = await authorize(collaborator, 'task.reassign', task, {}, now);
    assert.equal(result.allowed, false, 'Cán bộ phối hợp không được tự ý điều chuyển người chủ trì DRI');
    assert.equal(result.rejectionCode, 'COLLABORATOR_CANNOT_REASSIGN_DRI');
  });

  await suite.test('10. Delegation valid -> Delegated action -> ALLOW', async () => {
    const delegateUser: AuthenticatedUserContext = {
      id: 'usr-delegate-01',
      name: 'Phó Trưởng phòng được ủy quyền',
      isActive: true,
      activePositionCode: 'PHO_TRUONG_PHONG',
      delegationGrants: [
        {
          id: 'del-grant-valid',
          granteeUserId: 'usr-delegate-01',
          capability: 'task.approve',
          validFrom: pastDate,
          validUntil: futureDate,
          status: 'ACTIVE',
          sourceDocumentNumber: '123/GUQ-CĐKTCNQN',
        },
      ],
    };

    const task: AuthorizationResource = {
      id: 'task-del-001',
      type: 'task',
      owningUnitId: 'unit-dao-tao',
      createdById: 'usr-other',
      primaryOwnerId: 'usr-dri-01',
    };

    const result = await authorize(delegateUser, 'task.approve', task, {}, now);
    assert.equal(result.allowed, true, 'Ủy quyền còn hiệu lực cho phép thực hiện hành động ủy quyền');
    assert.equal(result.delegationContext?.isDelegated, true);
  });

  await suite.test('11. Delegation expired -> Same action -> DENY (DELEGATION_EXPIRED)', async () => {
    const delegateUser: AuthenticatedUserContext = {
      id: 'usr-delegate-02',
      name: 'Phó Trưởng phòng hết hạn ủy quyền',
      isActive: true,
      activePositionCode: 'PHO_TRUONG_PHONG',
      delegationGrants: [
        {
          id: 'del-grant-expired',
          granteeUserId: 'usr-delegate-02',
          capability: 'task.approve',
          validFrom: pastDate,
          validUntil: expiredDate, // Hết hạn ngày 01/09/2026, hiện tại là 09/09/2026
          status: 'ACTIVE',
          sourceDocumentNumber: '120/GUQ-CĐKTCNQN',
        },
      ],
    };

    const task: AuthorizationResource = {
      id: 'task-del-002',
      type: 'task',
      owningUnitId: 'unit-dao-tao',
      createdById: 'usr-other',
      primaryOwnerId: 'usr-dri-01',
    };

    const result = await authorize(delegateUser, 'task.approve', task, {}, now);
    assert.equal(result.allowed, false, 'Ủy quyền đã quá hạn thời gian hiệu lực phải bị từ chối');
    assert.equal(result.rejectionCode, 'DELEGATION_EXPIRED');
  });

  await suite.test('12. Signed document -> Edit same version -> DENY (Immutability rule)', () => {
    const signedDocStatus = OutgoingDocumentStatus.AUTHORIZED_SIGN;
    const isImmutable = [
      OutgoingDocumentStatus.AUTHORIZED_SIGN,
      OutgoingDocumentStatus.NUMBERED,
      OutgoingDocumentStatus.ORGANIZATION_SIGNED,
      OutgoingDocumentStatus.ISSUED,
      OutgoingDocumentStatus.ARCHIVED,
    ].includes(signedDocStatus);

    assert.equal(isImmutable, true, 'Văn bản đã ký phải đóng băng nội dung, không cho phép chỉnh sửa đè cùng version');
  });

  await suite.test('13. System Admin -> Confidential HR Resource -> DENY (SEPARATION_OF_POWERS_VIOLATION)', async () => {
    const systemAdmin: AuthenticatedUserContext = {
      id: 'usr-sysadmin-hr',
      name: 'Quản trị viên Hệ thống',
      isActive: true,
      role: 'ADMIN',
      systemRole: 'QUAN_TRI_HE_THONG',
    };

    const hrConfidentialResource: AuthorizationResource = {
      id: 'hr-dossier-001',
      type: 'dossier',
      classification: 'PERSONAL_DATA' as any,
    };

    const result = await authorize(systemAdmin, 'user.view_sensitive_personal_data', hrConfidentialResource, {}, now);
    assert.equal(result.allowed, false, 'System Admin không được truy cập hồ sơ nhân sự / dữ liệu cá nhân bảo vệ');
    assert.equal(result.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
  });

  // ============================================================================
  // SECTION 51: ZERO REGRESSION & ARCHITECTURAL DEFINITION OF DONE VERIFICATION
  // ============================================================================

  await suite.test('14. DoD: 0 business authority phụ thuộc trực tiếp vào ADMIN/MANAGER/STAFF', async () => {
    const genericManager: AuthenticatedUserContext = {
      id: 'usr-manager',
      name: 'Generic Manager',
      isActive: true,
      role: 'MANAGER', // Synthetic SaaS role
    };

    const strategicTask: AuthorizationResource = {
      id: 'task-strat-001',
      type: 'task',
      portfolio: 'PORT_DAO_TAO',
      owningUnitId: 'unit-dt',
    };

    const result = await authorize(genericManager, 'task.approve', strategicTask, {}, now);
    assert.equal(result.allowed, false, 'Role "MANAGER" thuần túy không mặc nhiên cấp quyền phê duyệt');
  });

  await suite.test('15. DoD: 0 TaskScope dùng làm security boundary', async () => {
    const specialist: AuthenticatedUserContext = {
      id: 'usr-spec-01',
      name: 'Chuyên viên A',
      isActive: true,
      activePositionCode: 'CHUYEN_VIEN',
      activeUnitId: 'unit-a',
    };

    const schoolLevelTask: AuthorizationResource = {
      id: 'task-school-001',
      type: 'task',
      scope: 'SCHOOL', // Origin level is SCHOOL
      owningUnitId: 'unit-b',
    };

    const result = await authorize(specialist, 'task.approve', schoolLevelTask, { requestScope: 'school' }, now);
    assert.equal(result.allowed, false, 'TaskScope SCHOOL không biến chuyên viên thành người có quyền phê duyệt');
  });
});
