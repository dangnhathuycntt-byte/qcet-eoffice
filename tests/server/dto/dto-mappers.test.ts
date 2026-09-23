import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toUserSummaryDTO,
  toUserPublicDTO,
  toUserSessionDTO,
  toUserSummaryDTOArray,
  toUserPublicDTOArray,
  toTaskSummaryDTO,
  toTaskListDTO,
  toTaskDetailDTO,
  toTaskSummaryDTOArray,
  toTaskListDTOArray,
  toDocumentListDTO,
  toDocumentDetailDTO,
  toDocumentListDTOArray,
  toNotificationDTO,
  toNotificationDTOArray,
  toNotificationListResponseDTO,
} from '@/server/dto';
import {
  toExecutiveResolutionDTO,
  toExecutiveResolutionDTOArray,
  type ExecutiveResolutionDTO,
} from '@/server/dto/executive-dto';

describe('OWASP API3 Data Sanitization & Response DTO Mappers', () => {
  // ==========================================================================
  // 1. USER DTO SUITE
  // ==========================================================================
  describe('User DTO Mappings', () => {
    const rawUserWithSecrets = {
      id: 'usr-101',
      name: 'Nguyễn Văn An',
      email: 'an.nv@qcet.edu.vn',
      role: 'MANAGER',
      password: 'PlaintextPassword123!',
      passwordHash: '$2b$12$e8xYz9vK8hQwP4Lk8...secret',
      salt: 'c29tZXNhbHQ=',
      token: 'jwt-internal-access-token',
      refreshToken: 'refresh-token-xyz',
      resetToken: 'pw-reset-uuid-token',
      secret: 'super-sensitive-signing-key',
      twoFactorSecret: 'TOTPSECRET123',
      sessionToken: 'sess-abc-456',
      title: 'Trưởng phòng Đào tạo',
      phone: '0912345678',
      avatarUrl: 'https://cdn.qcet.edu.vn/avatars/an.jpg',
      departmentId: 'dept-01',
      department: {
        id: 'dept-01',
        name: 'Phòng Đào tạo & Quản lý Khoa học',
        shortName: 'DTQLKH',
      },
      createdAt: new Date('2025-01-10T08:00:00.000Z'),
      updatedAt: new Date('2025-06-01T12:00:00.000Z'),
      onboardingData: { hasSeenWelcome: true },
    };

    it('toUserSummaryDTO strips sensitive credentials and internal fields', () => {
      const dto = toUserSummaryDTO(rawUserWithSecrets);

      assert.ok(dto);
      assert.strictEqual(dto.id, 'usr-101');
      assert.strictEqual(dto.name, 'Nguyễn Văn An');
      assert.strictEqual(dto.email, 'an.nv@qcet.edu.vn');
      assert.strictEqual(dto.role, 'MANAGER');
      assert.strictEqual(dto.avatarUrl, 'https://cdn.qcet.edu.vn/avatars/an.jpg');

      // Security invariants: Secrets must never exist on DTO
      assert.strictEqual((dto as any).password, undefined);
      assert.strictEqual((dto as any).passwordHash, undefined);
      assert.strictEqual((dto as any).salt, undefined);
      assert.strictEqual((dto as any).token, undefined);
      assert.strictEqual((dto as any).refreshToken, undefined);
      assert.strictEqual((dto as any).resetToken, undefined);
      assert.strictEqual((dto as any).secret, undefined);
      assert.strictEqual((dto as any).twoFactorSecret, undefined);
      assert.strictEqual((dto as any).sessionToken, undefined);
      assert.strictEqual((dto as any).onboardingData, undefined);

      // Verify exact keys returned
      const keys = Object.keys(dto);
      assert.deepStrictEqual(keys.sort(), ['avatarUrl', 'email', 'id', 'name', 'role'].sort());
    });

    it('toUserPublicDTO maps public fields and department without leaking secrets', () => {
      const dto = toUserPublicDTO(rawUserWithSecrets);

      assert.ok(dto);
      assert.strictEqual(dto.id, 'usr-101');
      assert.strictEqual(dto.name, 'Nguyễn Văn An');
      assert.strictEqual(dto.email, 'an.nv@qcet.edu.vn');
      assert.strictEqual(dto.role, 'MANAGER');
      assert.strictEqual(dto.position, 'Trưởng phòng Đào tạo');
      assert.strictEqual(dto.phone, '0912345678');
      assert.strictEqual(dto.departmentId, 'dept-01');
      assert.deepStrictEqual(dto.department, {
        id: 'dept-01',
        code: 'DTQLKH',
        name: 'Phòng Đào tạo & Quản lý Khoa học',
      });
      assert.strictEqual(dto.createdAt, '2025-01-10T08:00:00.000Z');
      assert.strictEqual(dto.updatedAt, '2025-06-01T12:00:00.000Z');

      // No credentials
      assert.strictEqual((dto as any).password, undefined);
      assert.strictEqual((dto as any).passwordHash, undefined);
      assert.strictEqual((dto as any).refreshToken, undefined);
    });

    it('toUserSessionDTO constructs minimal authenticated session contract', () => {
      const dto = toUserSessionDTO(rawUserWithSecrets);

      assert.ok(dto);
      assert.strictEqual(dto.id, 'usr-101');
      assert.strictEqual(dto.name, 'Nguyễn Văn An');
      assert.strictEqual(dto.email, 'an.nv@qcet.edu.vn');
      assert.strictEqual(dto.role, 'MANAGER');
      assert.strictEqual(dto.departmentId, 'dept-01');
      assert.strictEqual(dto.departmentCode, 'DTQLKH');
      assert.strictEqual(dto.departmentName, 'Phòng Đào tạo & Quản lý Khoa học');
      assert.strictEqual(dto.avatarUrl, 'https://cdn.qcet.edu.vn/avatars/an.jpg');

      assert.strictEqual((dto as any).passwordHash, undefined);
      assert.strictEqual((dto as any).token, undefined);
    });

    it('gracefully handles users with missing optional relations / fields', () => {
      const minimalRaw = {
        id: 'usr-999',
        name: 'Khách vãng lai',
        email: 'guest@qcet.edu.vn',
        role: 'STAFF',
      };

      const summary = toUserSummaryDTO(minimalRaw);
      assert.ok(summary);
      assert.strictEqual(summary.avatarUrl, null);

      const pub = toUserPublicDTO(minimalRaw);
      assert.ok(pub);
      assert.strictEqual(pub.department, null);
      assert.strictEqual(pub.departmentId, null);
      assert.strictEqual(pub.phone, null);
      assert.strictEqual(pub.position, null);

      const session = toUserSessionDTO(minimalRaw);
      assert.ok(session);
      assert.strictEqual(session.departmentId, null);
      assert.strictEqual(session.departmentCode, null);
      assert.strictEqual(session.departmentName, null);
    });

    it('handles null and undefined safely without throwing', () => {
      assert.strictEqual(toUserSummaryDTO(null), null);
      assert.strictEqual(toUserSummaryDTO(undefined), null);
      assert.strictEqual(toUserSummaryDTO('not-an-object'), null);
      assert.strictEqual(toUserSummaryDTO(123), null);

      assert.strictEqual(toUserPublicDTO(null), null);
      assert.strictEqual(toUserPublicDTO(undefined), null);

      assert.strictEqual(toUserSessionDTO(null), null);
      assert.strictEqual(toUserSessionDTO(undefined), null);
    });

    it('array mapping functions map lists and filter invalid records', () => {
      const list = [rawUserWithSecrets, null, { id: 'usr-2', name: 'User 2', email: 'u2@qcet.edu.vn', role: 'STAFF' }, undefined];
      const summaries = toUserSummaryDTOArray(list);
      assert.strictEqual(summaries.length, 2);
      assert.strictEqual(summaries[0].id, 'usr-101');
      assert.strictEqual(summaries[1].id, 'usr-2');

      const publics = toUserPublicDTOArray(list);
      assert.strictEqual(publics.length, 2);

      // Non-array input
      assert.deepStrictEqual(toUserSummaryDTOArray(null as any), []);
      assert.deepStrictEqual(toUserPublicDTOArray(undefined as any), []);
    });
  });

  // ==========================================================================
  // 2. TASK DTO SUITE
  // ==========================================================================
  describe('Task DTO Mappings', () => {
    const rawTaskWithDetails = {
      id: 'tsk-001',
      code: 'NV-2026-09-001',
      title: 'Xây dựng chương trình DACUM ngành Công nghệ thông tin',
      description: 'Soạn thảo chuẩn đầu ra và ma trận nhiệm vụ theo phương pháp DACUM.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progressPercent: 65,
      dueDate: new Date('2026-09-24T17:00:00.000Z'),
      startDate: new Date('2026-08-25T08:00:00.000Z'),
      version: 3,
      departmentId: 'dept-cntt',
      department: {
        id: 'dept-cntt',
        name: 'Khoa Công nghệ thông tin',
        shortName: 'CNTT',
      },
      leadAssignee: {
        id: 'usr-lead',
        name: 'Trần Thị B',
        email: 'b.tt@qcet.edu.vn',
        role: 'STAFF',
        passwordHash: 'secret-hash-lead',
      },
      assignees: [
        {
          userId: 'usr-lead',
          roleInTask: 'PRIMARY_OWNER',
          user: {
            id: 'usr-lead',
            name: 'Trần Thị B',
            email: 'b.tt@qcet.edu.vn',
            role: 'STAFF',
            passwordHash: 'secret-hash-lead',
          },
        },
        {
          userId: 'usr-collab',
          roleInTask: 'COLLABORATOR',
          user: {
            id: 'usr-collab',
            name: 'Lê Văn C',
            email: 'c.lv@qcet.edu.vn',
            role: 'STAFF',
            passwordHash: 'secret-hash-collab',
          },
        },
      ],
      createdBy: {
        id: 'usr-admin',
        name: 'BGH Admin',
        email: 'admin@qcet.edu.vn',
        role: 'ADMIN',
        passwordHash: 'secret-hash-admin',
      },
      parentTaskId: 'tsk-parent',
      parentTask: {
        id: 'tsk-parent',
        code: 'NV-PARENT-01',
        title: 'Kế hoạch nâng cao chất lượng đào tạo 2026-2027',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        dueDate: '2026-12-31T00:00:00.000Z',
        progress: 40,
        version: 1,
      },
      subTasks: [
        {
          id: 'tsk-sub-1',
          code: 'NV-SUB-01',
          title: 'Khảo sát nhu cầu doanh nghiệp CNTT',
          status: 'COMPLETED',
          priority: 'NORMAL',
          dueDate: '2026-09-10T00:00:00.000Z',
          progressPercent: 100,
          version: 2,
        },
      ],
      deliverables: [
        {
          id: 'deliv-01',
          taskId: 'tsk-001',
          title: 'Bản thảo ma trận DACUM CNTT v1.0',
          fileUrl: 'https://cdn.qcet.edu.vn/files/dacum-cntt.pdf',
          fileType: 'application/pdf',
          fileSize: 2048576,
          reviewStatus: 'PENDING',
          uploadedBy: {
            id: 'usr-lead',
            name: 'Trần Thị B',
            email: 'b.tt@qcet.edu.vn',
            role: 'STAFF',
            passwordHash: 'secret-deliv-hash',
          },
        },
      ],
      resolutions: [
        {
          id: 'res-01',
          taskId: 'tsk-001',
          resolutionType: 'EXTEND_DEADLINE',
          directiveNote: 'Gia hạn thêm 5 ngày để đối chiếu tiêu chuẩn Bộ',
          grantedDays: 5,
          previousDueDate: '2026-09-19T17:00:00.000Z',
          newDueDate: '2026-09-24T17:00:00.000Z',
          actor: {
            id: 'usr-admin',
            name: 'Hiệu trưởng',
            email: 'hieutruong@qcet.edu.vn',
            role: 'ADMIN',
            passwordHash: 'secret-actor-hash',
          },
        },
      ],
      createdAt: new Date('2026-08-25T08:00:00.000Z'),
      updatedAt: new Date('2026-09-08T10:00:00.000Z'),
      internalAuditToken: 'internal-secret-token',
    };

    it('toTaskSummaryDTO returns clean essential task summary', () => {
      const summary = toTaskSummaryDTO(rawTaskWithDetails);

      assert.ok(summary);
      assert.strictEqual(summary.id, 'tsk-001');
      assert.strictEqual(summary.code, 'NV-2026-09-001');
      assert.strictEqual(summary.title, 'Xây dựng chương trình DACUM ngành Công nghệ thông tin');
      assert.strictEqual(summary.status, 'IN_PROGRESS');
      assert.strictEqual(summary.priority, 'HIGH');
      assert.strictEqual(summary.progress, 65);
      assert.strictEqual(summary.dueDate, '2026-09-24T17:00:00.000Z');
      assert.strictEqual(summary.version, 3);

      assert.strictEqual((summary as any).internalAuditToken, undefined);
      assert.strictEqual((summary as any).description, undefined);
    });

    it('toTaskListDTO includes assignees, leadAssignee, and department while stripping secrets', () => {
      const listDto = toTaskListDTO(rawTaskWithDetails);

      assert.ok(listDto);
      assert.strictEqual(listDto.id, 'tsk-001');
      assert.strictEqual(listDto.progress, 65);
      assert.strictEqual(listDto.version, 3);

      // Department check
      assert.deepStrictEqual(listDto.department, {
        id: 'dept-cntt',
        code: 'CNTT',
        name: 'Khoa Công nghệ thông tin',
      });

      // Lead assignee check (secrets stripped)
      assert.ok(listDto.leadAssignee);
      assert.strictEqual(listDto.leadAssignee.id, 'usr-lead');
      assert.strictEqual(listDto.leadAssignee.name, 'Trần Thị B');
      assert.strictEqual((listDto.leadAssignee as any).passwordHash, undefined);

      // Assignees array check (all user secrets stripped)
      assert.ok(listDto.assignees);
      assert.strictEqual(listDto.assignees.length, 2);
      assert.strictEqual(listDto.assignees[0].id, 'usr-lead');
      assert.strictEqual((listDto.assignees[0] as any).passwordHash, undefined);
      assert.strictEqual(listDto.assignees[1].id, 'usr-collab');
      assert.strictEqual((listDto.assignees[1] as any).passwordHash, undefined);

      // Internal token stripped
      assert.strictEqual((listDto as any).internalAuditToken, undefined);
    });

    it('toTaskDetailDTO maps full sub-entities and sanitizes nested models', () => {
      const detailDto = toTaskDetailDTO(rawTaskWithDetails);

      assert.ok(detailDto);
      assert.strictEqual(detailDto.id, 'tsk-001');
      assert.strictEqual(detailDto.description, 'Soạn thảo chuẩn đầu ra và ma trận nhiệm vụ theo phương pháp DACUM.');

      // Created by sanitized
      assert.ok(detailDto.createdBy);
      assert.strictEqual(detailDto.createdBy.id, 'usr-admin');
      assert.strictEqual((detailDto.createdBy as any).passwordHash, undefined);

      // Parent task sanitized
      assert.ok(detailDto.parentTask);
      assert.strictEqual(detailDto.parentTask.code, 'NV-PARENT-01');

      // Sub-tasks sanitized
      assert.ok(detailDto.subTasks);
      assert.strictEqual(detailDto.subTasks.length, 1);
      assert.strictEqual(detailDto.subTasks[0].code, 'NV-SUB-01');
      assert.strictEqual(detailDto.subTasks[0].progress, 100);

      // Deliverables mapped with uploader sanitized
      assert.ok(detailDto.deliverables);
      assert.strictEqual(detailDto.deliverables.length, 1);
      assert.strictEqual(detailDto.deliverables[0].title, 'Bản thảo ma trận DACUM CNTT v1.0');
      assert.ok(detailDto.deliverables[0].uploadedBy);
      assert.strictEqual(detailDto.deliverables[0].uploadedBy.id, 'usr-lead');
      assert.strictEqual((detailDto.deliverables[0].uploadedBy as any).passwordHash, undefined);

      // Resolutions mapped with actor sanitized
      assert.ok(detailDto.resolutions);
      assert.strictEqual(detailDto.resolutions.length, 1);
      assert.strictEqual(detailDto.resolutions[0].resolutionType, 'EXTEND_DEADLINE');
      assert.ok(detailDto.resolutions[0].actor);
      assert.strictEqual(detailDto.resolutions[0].actor.id, 'usr-admin');
      assert.strictEqual((detailDto.resolutions[0].actor as any).passwordHash, undefined);
    });

    it('handles tasks with missing optional fields without throwing', () => {
      const minimalTask = {
        id: 'tsk-minimal',
        code: 'NV-MIN',
        title: 'Nhiệm vụ tối giản',
        status: 'NOT_STARTED',
        priority: 'NORMAL',
        dueDate: '2026-10-01',
      };

      const summary = toTaskSummaryDTO(minimalTask);
      assert.ok(summary);
      assert.strictEqual(summary.progress, 0);
      assert.strictEqual(summary.version, 1);

      const listDto = toTaskListDTO(minimalTask);
      assert.ok(listDto);
      assert.strictEqual(listDto.department, null);
      assert.strictEqual(listDto.leadAssignee, null);
      assert.deepStrictEqual(listDto.assignees, []);

      const detailDto = toTaskDetailDTO(minimalTask);
      assert.ok(detailDto);
      assert.strictEqual(detailDto.description, null);
      assert.strictEqual(detailDto.parentTask, null);
      assert.deepStrictEqual(detailDto.subTasks, []);
      assert.deepStrictEqual(detailDto.deliverables, []);
      assert.deepStrictEqual(detailDto.resolutions, []);
    });

    it('safely handles null / undefined / empty arrays for tasks', () => {
      assert.strictEqual(toTaskSummaryDTO(null), null);
      assert.strictEqual(toTaskSummaryDTO(undefined), null);
      assert.strictEqual(toTaskListDTO(null), null);
      assert.strictEqual(toTaskDetailDTO(null), null);

      assert.deepStrictEqual(toTaskSummaryDTOArray(null as any), []);
      assert.deepStrictEqual(toTaskListDTOArray(undefined as any), []);

      const arr = toTaskListDTOArray([rawTaskWithDetails, null]);
      assert.strictEqual(arr.length, 1);
      assert.strictEqual(arr[0].id, 'tsk-001');
    });
  });

  // ==========================================================================
  // 3. DOCUMENT DTO SUITE
  // ==========================================================================
  describe('Document DTO Mappings', () => {
    const rawIncomingDoc = {
      id: 'doc-001',
      originalNumber: '128/SGDĐT-GDCN',
      summary: 'V/v Hướng dẫn triển khai kế hoạch năm học 2026 - 2027',
      type: 'VAN_BAN_DEN',
      issuedDate: new Date('2026-08-20T00:00:00.000Z'),
      status: 'DANG_XU_LY',
      leadUnitId: 'unit-01',
      incomingWorkflow: {
        leadUnitId: 'unit-01',
        leadUnit: {
          id: 'unit-01',
          name: 'Phòng Đào tạo',
          code: 'PDT',
        },
      },
      signerName: 'Vũ Thị Hạnh',
      signerTitle: 'Phó Giám đốc Sở',
      content: 'Chi tiết hướng dẫn các trường cao đẳng trên địa bàn tỉnh.',
      version: 2,
      createdAt: new Date('2026-08-21T08:00:00.000Z'),
      updatedAt: new Date('2026-08-22T09:00:00.000Z'),
      secretStorageDiskPath: '/var/secret/storage/docs/doc-001.raw',
      internalSignerCertHash: 'SHA256:abcd1234efgh5678',
      attachments: [
        {
          id: 'att-1',
          documentId: 'doc-001',
          fileName: 'ke-hoach-nam-hoc.pdf',
          fileUrl: 'https://cdn.qcet.edu.vn/docs/ke-hoach-nam-hoc.pdf',
          fileSize: 1048576,
          mimeType: 'application/pdf',
          isOriginal: true,
          serverInternalPath: '/storage/internal/att-1',
        },
      ],
      directives: [
        {
          id: 'dir-1',
          documentId: 'doc-001',
          leaderId: 'usr-hieutruong',
          leaderName: 'Nguyễn Văn Hiệu Trưởng',
          leader: {
            id: 'usr-hieutruong',
            name: 'Nguyễn Văn Hiệu Trưởng',
            email: 'ht@qcet.edu.vn',
            role: 'ADMIN',
            passwordHash: 'secret-ht-hash',
          },
          instruction: 'Phòng Đào tạo chủ trì, phối hợp các Khoa xây dựng khung trước ngày 15/09.',
          deadline: '2026-09-15T17:00:00.000Z',
          assignedDeptId: 'dept-01',
          assignedDeptName: 'Phòng Đào tạo',
          isTaskGenerated: true,
        },
      ],
    };

    const rawOutgoingDoc = {
      id: 'doc-002',
      originalNumber: '56/CĐKTCN-ĐT',
      title: 'Tờ trình về việc phê duyệt định mức giờ chuẩn giảng dạy',
      type: 'VAN_BAN_DI',
      releaseDate: '2026-09-01T08:00:00.000Z',
      status: 'CHO_PHE_DUYET',
      leadUnitId: 'unit-dt',
      leadUnit: {
        id: 'unit-dt',
        name: 'Phòng Đào tạo',
        code: 'DT',
      },
      signer: {
        name: 'Trần Văn Trưởng Phòng',
        title: 'Trưởng phòng Đào tạo',
      },
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:30:00.000Z',
    };

    it('toDocumentListDTO maps incoming documents correctly and strips storage secrets', () => {
      const dto = toDocumentListDTO(rawIncomingDoc);

      assert.ok(dto);
      assert.strictEqual(dto.id, 'doc-001');
      assert.strictEqual(dto.documentCode, '128/SGDĐT-GDCN');
      assert.strictEqual(dto.title, 'V/v Hướng dẫn triển khai kế hoạch năm học 2026 - 2027');
      assert.strictEqual(dto.type, 'VAN_BAN_DEN');
      assert.strictEqual(dto.status, 'DANG_XU_LY');
      assert.strictEqual(dto.version, 2);

      // Department extracted from leadDepartment
      assert.deepStrictEqual(dto.department, {
        id: 'unit-01',
        code: 'PDT',
        name: 'Phòng Đào tạo',
      });

      // Signer mapped
      assert.deepStrictEqual(dto.signer, {
        name: 'Vũ Thị Hạnh',
        title: 'Phó Giám đốc Sở',
      });

      // Secrets stripped
      assert.strictEqual((dto as any).secretStorageDiskPath, undefined);
      assert.strictEqual((dto as any).internalSignerCertHash, undefined);
    });

    it('toDocumentListDTO maps outgoing documents with canonical leadUnit and structured signer', () => {
      const dto = toDocumentListDTO(rawOutgoingDoc);

      assert.ok(dto);
      assert.strictEqual(dto.id, 'doc-002');
      assert.strictEqual(dto.documentCode, '56/CĐKTCN-ĐT');
      assert.strictEqual(dto.type, 'VAN_BAN_DI');
      assert.deepStrictEqual(dto.department, {
        id: 'unit-dt',
        code: 'DT',
        name: 'Phòng Đào tạo',
      });
      assert.deepStrictEqual(dto.signer, {
        name: 'Trần Văn Trưởng Phòng',
        title: 'Trưởng phòng Đào tạo',
      });
    });

    it('toDocumentDetailDTO maps attachments and directives while sanitizing nested users', () => {
      const detail = toDocumentDetailDTO(rawIncomingDoc);

      assert.ok(detail);
      assert.strictEqual(detail.content, 'Chi tiết hướng dẫn các trường cao đẳng trên địa bàn tỉnh.');

      // Attachments checked
      assert.ok(detail.attachments);
      assert.strictEqual(detail.attachments.length, 1);
      assert.strictEqual(detail.attachments[0].fileName, 'ke-hoach-nam-hoc.pdf');
      assert.strictEqual((detail.attachments[0] as any).serverInternalPath, undefined);

      // Directives checked and leader sanitized
      assert.ok(detail.directives);
      assert.strictEqual(detail.directives.length, 1);
      assert.strictEqual(detail.directives[0].leaderName, 'Nguyễn Văn Hiệu Trưởng');
      assert.ok(detail.directives[0].leader);
      assert.strictEqual(detail.directives[0].leader.id, 'usr-hieutruong');
      assert.strictEqual((detail.directives[0].leader as any).passwordHash, undefined);
    });

    it('handles document with missing optional fields without throwing', () => {
      const minimalDoc = {
        id: 'doc-min',
        originalNumber: '01/MIN',
        summary: 'Văn bản tối giản',
        type: 'TO_TRINH_NOI_BO',
        issuedDate: '2026-09-05',
      };

      const listDto = toDocumentListDTO(minimalDoc);
      assert.ok(listDto);
      assert.strictEqual(listDto.department, null);
      assert.strictEqual(listDto.signer, null);
      assert.strictEqual(listDto.status, null);

      const detailDto = toDocumentDetailDTO(minimalDoc);
      assert.ok(detailDto);
      assert.deepStrictEqual(detailDto.attachments, []);
      assert.deepStrictEqual(detailDto.directives, []);
    });

    it('safely handles null / undefined / empty arrays for documents', () => {
      assert.strictEqual(toDocumentListDTO(null), null);
      assert.strictEqual(toDocumentListDTO(undefined), null);
      assert.strictEqual(toDocumentDetailDTO(null), null);

      assert.deepStrictEqual(toDocumentListDTOArray(null as any), []);
      assert.deepStrictEqual(toDocumentListDTOArray(undefined as any), []);

      const list = toDocumentListDTOArray([rawIncomingDoc, null, rawOutgoingDoc]);
      assert.strictEqual(list.length, 2);
      assert.strictEqual(list[0].id, 'doc-001');
      assert.strictEqual(list[1].id, 'doc-002');
    });
  });

  // ==========================================================================
  // 4. NOTIFICATION DTO SUITE
  // ==========================================================================
  describe('Executive Resolution DTO Mappings', () => {
    const baseResolution = {
      id: 'resolution-001',
      taskId: 'task-001',
      actorId: 'actor-001',
      resolutionType: 'EXTEND_DEADLINE',
      directiveNote: null,
      grantedDays: 5,
      previousDueDate: null,
      newDueDate: new Date('2026-10-10T00:00:00.000Z'),
      previousOwnerId: null,
      newOwnerId: null,
      createdAt: new Date('2026-09-20T08:00:00.000Z'),
      actor: null,
    };

    it('maps canonical leadUnitId to nullable departmentId', () => {
      const dto = toExecutiveResolutionDTO({
        ...baseResolution,
        task: {
          id: 'task-001',
          code: 'NV-001',
          title: 'Nhiệm vụ có đơn vị chủ trì',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueDate: new Date('2026-10-15T00:00:00.000Z'),
          leadUnitId: 'unit-001',
        },
      });

      assert.strictEqual(dto.task?.departmentId, 'unit-001');

      const withoutUnit = toExecutiveResolutionDTO({
        ...baseResolution,
        task: {
          id: 'task-002',
          code: 'NV-002',
          title: 'Nhiệm vụ chưa gán đơn vị',
          status: 'IN_PROGRESS',
          priority: 'NORMAL',
          dueDate: new Date('2026-10-15T00:00:00.000Z'),
          leadUnitId: null,
        },
      });
      assert.strictEqual(withoutUnit.task?.departmentId, null);
    });

    it('maps missing task as null and maps arrays', () => {
      assert.strictEqual(toExecutiveResolutionDTO({ ...baseResolution, task: null }).task, null);

      const dtos = toExecutiveResolutionDTOArray([
        {
          ...baseResolution,
          task: {
            id: 'task-001',
            code: 'NV-001',
            title: 'Nhiệm vụ',
            status: 'IN_PROGRESS',
            priority: 'NORMAL',
            dueDate: new Date('2026-10-15T00:00:00.000Z'),
            leadUnitId: null,
          },
        },
      ]);
      assert.strictEqual(dtos.length, 1);
      assert.strictEqual(dtos[0].task?.departmentId, null);
    });

    it('allows a null departmentId in the DTO type', () => {
      const task: ExecutiveResolutionDTO['task'] = {
        id: 'task-001',
        code: 'NV-001',
        title: 'Nhiệm vụ',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        dueDate: '2026-10-15T00:00:00.000Z',
        departmentId: null,
      };
      assert.strictEqual(task?.departmentId, null);
    });
  });

  describe('Notification DTO Mappings', () => {
    const rawNotification = {
      id: 'notif-001',
      userId: 'usr-101',
      title: 'Nhiệm vụ mới được giao',
      body: 'Bạn được phân công làm chủ trì nhiệm vụ DACUM CNTT.',
      type: 'TASK_ASSIGNED',
      linkHref: '/tasks/tsk-001',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-09-08T08:00:00.000Z'),
      user: {
        id: 'usr-101',
        passwordHash: 'secret-user-hash',
      },
      pushSubscriptionKey: 'secret-push-key-abc',
      internalDeliveryJobId: 'job-9999',
    };

    it('toNotificationDTO maps fields and strips internal relations & push keys', () => {
      const dto = toNotificationDTO(rawNotification);

      assert.ok(dto);
      assert.strictEqual(dto.id, 'notif-001');
      assert.strictEqual(dto.userId, 'usr-101');
      assert.strictEqual(dto.title, 'Nhiệm vụ mới được giao');
      assert.strictEqual(dto.message, 'Bạn được phân công làm chủ trì nhiệm vụ DACUM CNTT.');
      assert.strictEqual(dto.type, 'TASK_ASSIGNED');
      assert.strictEqual(dto.link, '/tasks/tsk-001');
      assert.strictEqual(dto.isRead, false);
      assert.strictEqual(dto.readAt, null);
      assert.strictEqual(dto.createdAt, '2026-09-08T08:00:00.000Z');

      // Security invariants: Secrets must never exist on DTO
      assert.strictEqual((dto as any).user, undefined);
      assert.strictEqual((dto as any).pushSubscriptionKey, undefined);
      assert.strictEqual((dto as any).internalDeliveryJobId, undefined);

      const keys = Object.keys(dto);
      assert.deepStrictEqual(
        keys.sort(),
        ['createdAt', 'id', 'isRead', 'link', 'message', 'readAt', 'title', 'type', 'userId'].sort()
      );
    });

    it('toNotificationDTO handles alternate property names (message, link)', () => {
      const altNotif = {
        id: 'notif-002',
        userId: 'usr-102',
        title: 'Thông báo chung',
        message: 'Nội dung thông báo',
        type: 'SYSTEM',
        link: '/announcements/1',
        isRead: true,
        readAt: new Date('2026-09-08T09:00:00.000Z'),
        createdAt: new Date('2026-09-08T08:30:00.000Z'),
      };

      const dto = toNotificationDTO(altNotif);
      assert.ok(dto);
      assert.strictEqual(dto.message, 'Nội dung thông báo');
      assert.strictEqual(dto.link, '/announcements/1');
      assert.strictEqual(dto.isRead, true);
      assert.strictEqual(dto.readAt, '2026-09-08T09:00:00.000Z');
    });

    it('toNotificationDTO handles null, undefined, and malformed inputs', () => {
      assert.strictEqual(toNotificationDTO(null), null);
      assert.strictEqual(toNotificationDTO(undefined), null);
      assert.strictEqual(toNotificationDTO('invalid'), null);
      assert.strictEqual(toNotificationDTO(42), null);
    });

    it('toNotificationDTOArray maps array and ignores null entries', () => {
      const arr = toNotificationDTOArray([rawNotification, null, undefined, { id: 'notif-2', title: 'T2', body: 'B2', userId: 'u2' }]);
      assert.strictEqual(arr.length, 2);
      assert.strictEqual(arr[0].id, 'notif-001');
      assert.strictEqual(arr[1].id, 'notif-2');

      assert.deepStrictEqual(toNotificationDTOArray(null as any), []);
    });

    it('toNotificationListResponseDTO creates canonical response with unread count', () => {
      const readNotif = { ...rawNotification, id: 'notif-read', isRead: true, readAt: new Date() };
      const unreadNotif = { ...rawNotification, id: 'notif-unread', isRead: false, readAt: null };

      const response = toNotificationListResponseDTO([readNotif, unreadNotif]);

      assert.strictEqual(response.items.length, 2);
      assert.strictEqual(response.total, 2);
      assert.strictEqual(response.unreadCount, 1);
    });

    it('toNotificationListResponseDTO respects explicit unreadCount and total overrides', () => {
      const response = toNotificationListResponseDTO([rawNotification], 15, 100);

      assert.strictEqual(response.items.length, 1);
      assert.strictEqual(response.unreadCount, 15);
      assert.strictEqual(response.total, 100);
    });
  });

  // ==========================================================================
  // 5. OWASP API3 EXHAUSTIVE LEAKAGE SCANNER
  // ==========================================================================
  describe('OWASP API3 Universal Secret Redaction Assertion', () => {
    const sensitiveKeySubstrings = [
      'password',
      'passwordhash',
      'token',
      'secret',
      'refreshtoken',
      'resettoken',
      'sessiontoken',
      'salt',
      'totp',
      'hash',
    ];

    function assertNoSensitiveKeys(obj: any, path = ''): void {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => assertNoSensitiveKeys(item, `${path}[${idx}]`));
        return;
      }

      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        for (const sensitive of sensitiveKeySubstrings) {
          // Allow harmless keys that contain 'token' or 'hash' if they are strictly safe (none in our DTOs, but let's be strict)
          assert.ok(
            !lowerKey.includes(sensitive),
            `OWASP API3 Violation: Found sensitive substring '${sensitive}' in key '${path ? `${path}.${key}` : key}'`
          );
        }
        assertNoSensitiveKeys(obj[key], path ? `${path}.${key}` : key);
      }
    }

    it('verifies mapped User DTOs have no sensitive keys', () => {
      const rawUser = {
        id: 'u-1',
        name: 'User',
        email: 'u@qcet.edu.vn',
        role: 'STAFF',
        password: '123',
        passwordHash: 'hash',
        token: 'tok',
        refreshToken: 'rt',
        secret: 'sec',
        salt: 'slt',
        department: { id: 'd1', name: 'Dept' },
      };

      assertNoSensitiveKeys(toUserSummaryDTO(rawUser));
      assertNoSensitiveKeys(toUserPublicDTO(rawUser));
      assertNoSensitiveKeys(toUserSessionDTO(rawUser));
    });

    it('verifies mapped Task DTOs have no sensitive keys in any nested level', () => {
      const rawTask = {
        id: 't-1',
        code: 'CODE-1',
        title: 'Task 1',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        dueDate: '2026-09-30',
        progress: 50,
        version: 1,
        passwordHash: 'task-leak-pwd',
        token: 'task-leak-token',
        leadAssignee: {
          id: 'u-lead',
          name: 'Lead',
          email: 'lead@qcet.edu.vn',
          role: 'STAFF',
          passwordHash: 'lead-pwd-hash',
        },
        assignees: [
          {
            user: {
              id: 'u-collab',
              name: 'Collab',
              email: 'collab@qcet.edu.vn',
              role: 'STAFF',
              passwordHash: 'collab-pwd-hash',
            },
          },
        ],
        deliverables: [
          {
            id: 'del-1',
            title: 'File',
            fileUrl: 'https://cdn.qcet.edu.vn/f.pdf',
            reviewStatus: 'PENDING',
            uploadedBy: {
              id: 'u-up',
              name: 'Uploader',
              email: 'up@qcet.edu.vn',
              role: 'STAFF',
              passwordHash: 'up-pwd-hash',
            },
          },
        ],
        resolutions: [
          {
            id: 'res-1',
            taskId: 't-1',
            resolutionType: 'EXTEND',
            actor: {
              id: 'u-act',
              name: 'Actor',
              email: 'act@qcet.edu.vn',
              role: 'ADMIN',
              passwordHash: 'act-pwd-hash',
            },
          },
        ],
      };

      assertNoSensitiveKeys(toTaskSummaryDTO(rawTask));
      assertNoSensitiveKeys(toTaskListDTO(rawTask));
      assertNoSensitiveKeys(toTaskDetailDTO(rawTask));
    });

    it('verifies mapped Document DTOs have no sensitive keys in any nested level', () => {
      const rawDoc = {
        id: 'd-1',
        documentCode: 'DOC-1',
        title: 'Doc 1',
        type: 'VAN_BAN_DEN',
        releaseDate: '2026-09-01',
        secretKey: 'raw-secret',
        internalToken: 'internal-tok',
        directives: [
          {
            id: 'dir-1',
            instruction: 'Execute',
            leaderId: 'usr-lead',
            leader: {
              id: 'usr-lead',
              name: 'Leader',
              email: 'lead@qcet.edu.vn',
              role: 'ADMIN',
              passwordHash: 'secret-hash',
            },
          },
        ],
      };

      assertNoSensitiveKeys(toDocumentListDTO(rawDoc));
      assertNoSensitiveKeys(toDocumentDetailDTO(rawDoc));
    });

    it('verifies mapped Notification DTOs have no sensitive keys', () => {
      const rawNotif = {
        id: 'n-1',
        userId: 'u-1',
        title: 'Notif',
        message: 'Msg',
        type: 'ALERT',
        token: 'leak-tok',
        password: 'leak-pwd',
        user: { passwordHash: 'leak-hash' },
      };

      assertNoSensitiveKeys(toNotificationDTO(rawNotif));
      assertNoSensitiveKeys(toNotificationListResponseDTO([rawNotif]));
    });
  });
});
