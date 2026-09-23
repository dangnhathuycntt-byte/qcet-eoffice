import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapPrismaTaskToSchoolTask,
  mapPrismaTaskToStaffTask,
  mapSchoolTaskToPrismaCreateInput,
} from '../src/lib/adapters/task-db-adapter';

describe('TaskDbAdapter Unit Tests', () => {
  test('maps full Prisma Task record to SchoolTask without data loss', () => {
    const mockPrismaTask: any = {
      id: 'task-001',
      code: 'NV-2026-09-001',
      title: 'Soạn thảo Đề cương Chương trình đào tạo Nghề Kỹ thuật Máy lạnh',
      description: 'Thẩm định ma trận kỹ năng nghề theo tiêu chuẩn DACUM',
      scope: 'SCHOOL',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progressPercent: 65,
      academicMonth: 9,
      academicYear: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00+07:00'),
      dueDate: new Date('2026-09-24T17:00:00+07:00'),

      leadUnit: {
        id: 'khoa-dien',
        name: 'Khoa Điện - Điện tử',
        code: 'K_DIEN_DTV',
      },
      actors: [
        {
          userId: 'user-01',
          role: 'DRI',
          isPrimaryDRI: true,
          user: { id: 'user-01', name: 'ThS. Nguyễn Văn A', avatarUrl: '/avatars/01.jpg' }
        },
        {
          userId: 'user-02',
          role: 'COLLABORATOR',
          isPrimaryDRI: false,
          user: { id: 'user-02', name: 'KS. Trần B', avatarUrl: null }
        }
      ],
      deliverables: [
        {
          id: 'del-01',
          title: 'Ma trận kỹ năng DACUM.pdf',
          fileUrl: 'https://storage.qcet.edu.vn/dacum.pdf',
          reviewStatus: 'PENDING'
        }
      ]
    };

    const schoolTask = mapPrismaTaskToSchoolTask(mockPrismaTask);

    assert.strictEqual(schoolTask.id, 'task-001');
    assert.strictEqual(schoolTask.title, 'Soạn thảo Đề cương Chương trình đào tạo Nghề Kỹ thuật Máy lạnh');
    assert.strictEqual(schoolTask.department, 'Khoa Điện - Điện tử');
    assert.strictEqual(schoolTask.departmentId, 'khoa-dien');
    assert.strictEqual(schoolTask.departmentCode, 'K_DIEN_DTV');
    assert.strictEqual(schoolTask.assignedTo, 'ThS. Nguyễn Văn A');
    assert.strictEqual(schoolTask.leadAssigneeId, 'user-01');
    assert.strictEqual(schoolTask.dueDate, '2026-09-24');
    assert.strictEqual(schoolTask.status, 'IN_PROGRESS');
    assert.strictEqual(schoolTask.priority, 'HIGH');
    assert.strictEqual(schoolTask.academicMonth, 9);
    assert.strictEqual(schoolTask.progress, 65);
    // Collaborators ('Phối hợp') are derived from active subtasks' Primary DRIs only,
    // so a task without subtasks exposes none (commit 8290ff24).
    assert.strictEqual(schoolTask.collaborators, undefined);
    assert.deepEqual(schoolTask.coAssignees, []);
  });

  test('falls back gracefully when lead unit or actors are missing', () => {
    const rawMinimal: any = {
      id: 'task-002',
      code: 'NV-2026-09-002',
      title: 'Vệ sinh phòng máy tính số 3',
      description: null,
      scope: 'DEPARTMENT',
      status: 'NOT_STARTED',
      priority: 'NORMAL',
      progressPercent: 0,
      academicMonth: 9,
      academicYear: '2026-2027',
      startDate: new Date('2026-09-10T00:00:00Z'),
      dueDate: new Date('2026-09-20T00:00:00Z'),

      leadUnit: null,
      actors: [],
      deliverables: []
    };

    const result = mapPrismaTaskToSchoolTask(rawMinimal);
    assert.strictEqual(result.department, 'Chưa phân bổ');
    assert.strictEqual(result.assignedTo, 'Chưa phân công');
    assert.strictEqual(result.status, 'NOT_STARTED');
    assert.strictEqual(result.priority, 'NORMAL');
  });

  test('maps SchoolTask domain object to Prisma create input structure', () => {
    const domainTask = {
      id: 'task-new',
      title: 'Xây dựng kế hoạch tuyển sinh 2026',
      description: 'Chi tiết kế hoạch tuyển sinh',
      department: 'Trung tâm Tuyển sinh & Truyền thông',
      assignedTo: 'ThS. Nguyễn Văn A',
      dueDate: '2026-10-15',
      status: 'in_progress',
      priority: 'high',
      progress: 20,
      academicMonth: 10,
      category: 'Chỉ đạo cấp Trường'
    };

    const prismaInput = mapSchoolTaskToPrismaCreateInput(domainTask, 'user-creator-123', 'dept-01');

    assert.strictEqual(prismaInput.title, 'Xây dựng kế hoạch tuyển sinh 2026');
    assert.strictEqual(prismaInput.description, 'Chi tiết kế hoạch tuyển sinh');
    assert.strictEqual(prismaInput.createdById, 'user-creator-123');
    assert.strictEqual(prismaInput.leadUnitId, 'dept-01');
    assert.strictEqual(prismaInput.status, 'IN_PROGRESS');
    assert.strictEqual(prismaInput.priority, 'HIGH');
    assert.strictEqual(prismaInput.scope, 'SCHOOL');
    assert.strictEqual(prismaInput.progressPercent, 20);
    assert.strictEqual(prismaInput.academicMonth, 10);
  });

  describe('Subtask Hierarchy & Rollup Mapping', () => {
    test('preserves parentTask metadata and subtasks with accurate rollup metrics', () => {
      const rawParentTask: any = {
        id: 'school-task-100',
        code: 'NV-2026-09-100',
        title: 'Xây dựng khung năng lực chuyển đổi số và DACUM 2026',
        description: 'Chỉ đạo toàn diện kế hoạch chuyển đổi số khối hành chính và đào tạo',
        scope: 'SCHOOL',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progressPercent: 0,
        academicMonth: 9,
        academicYear: '2026-2027',
        startDate: new Date('2026-09-01T08:00:00+07:00'),
        dueDate: new Date('2026-09-30T17:00:00+07:00'),

        leadUnit: {
          id: 'bgh',
          name: 'Ban Giám hiệu',
          code: 'QCET',
        },
        parentTaskId: null,
        parentTask: null,
        actors: [
          {
            userId: 'user-dri-01',
            role: 'DRI',
            isPrimaryDRI: true,
            user: { id: 'user-dri-01', name: 'TS. Lê Hoàng B', avatarUrl: '/avatars/dri.jpg' },
          },
          {
            userId: 'user-collab-01',
            role: 'COLLABORATOR',
            isPrimaryDRI: false,
            user: { id: 'user-collab-01', name: 'ThS. Đỗ C', avatarUrl: null },
          },
          {
            userId: 'user-collab-02',
            role: 'COLLABORATOR',
            isPrimaryDRI: false,
            user: { id: 'user-collab-02', name: 'KS. Phạm D', avatarUrl: null },
          },
        ],
        subTasks: [
          {
            id: 'sub-01',
            code: 'NV-2026-09-101',
            title: 'Khảo sát hạ tầng mạng và an toàn thông tin',
            description: 'Đánh giá hiện trạng hạ tầng mạng máy tính',
            scope: 'DEPARTMENT',
            status: 'COMPLETED',
            priority: 'HIGH',
            progressPercent: 100,
            academicMonth: 9,
            academicYear: '2026-2027',
            startDate: new Date('2026-09-02T08:00:00+07:00'),
            dueDate: new Date('2026-09-15T17:00:00+07:00'),

            leadUnit: { id: 'khoa-cntt', name: 'Khoa CNTT', code: 'K_CNTT' },
            actors: [
              {
                userId: 'user-sub-01',
                role: 'DRI',
                isPrimaryDRI: true,
                user: { id: 'user-sub-01', name: 'ThS. Nguyễn Văn A', avatarUrl: '/avatars/a.jpg' },
              },
            ],
          },
          {
            id: 'sub-02',
            code: 'NV-2026-09-102',
            title: 'Tổ chức hội thảo DACUM với chuyên gia doanh nghiệp',
            description: 'Mời 10 chuyên gia đầu ngành đóng góp ý kiến',
            scope: 'DEPARTMENT',
            status: 'IN_PROGRESS',
            priority: 'URGENT',
            progressPercent: 50,
            academicMonth: 9,
            academicYear: '2026-2027',
            startDate: new Date('2026-09-10T08:00:00+07:00'),
            dueDate: new Date('2026-09-25T17:00:00+07:00'),

            leadUnit: { id: 'phong-daotao', name: 'Phòng Đào tạo', code: 'P_QLDT' },
            actors: [
              {
                userId: 'user-sub-02',
                role: 'DRI',
                isPrimaryDRI: true,
                user: { id: 'user-sub-02', name: 'TS. Trần Thị E', avatarUrl: null },
              },
              {
                userId: 'user-sub-03',
                role: 'COLLABORATOR',
                isPrimaryDRI: false,
                user: { id: 'user-sub-03', name: 'KS. Vũ F', avatarUrl: null },
              },
            ],
          },
          {
            id: 'sub-03',
            code: 'NV-2026-09-103',
            title: 'Hoàn thiện báo cáo phân tích chức danh nghề',
            description: 'Tổng hợp biểu đồ DACUM thành văn bản chính thức',
            scope: 'DEPARTMENT',
            status: 'NOT_STARTED',
            priority: 'NORMAL',
            progressPercent: 0,
            academicMonth: 9,
            academicYear: '2026-2027',
            startDate: new Date('2026-09-15T08:00:00+07:00'),
            dueDate: new Date('2026-09-30T17:00:00+07:00'),

            leadUnit: { id: 'phong-qlcl', name: 'Phòng QLCL', code: 'P_KT_DBCL' },
            actors: [
              {
                userId: 'user-sub-04',
                role: 'DRI',
                isPrimaryDRI: true,
                user: { id: 'user-sub-04', name: 'CN. Hoàng G', avatarUrl: null },
              },
            ],
          },
        ],
      };

      const mapped = mapPrismaTaskToSchoolTask(rawParentTask);

      // Single DRI & Collaborator assertions
      assert.equal(mapped.id, 'school-task-100');
      assert.equal(mapped.code, 'NV-2026-09-100');
      assert.equal(mapped.assignedTo, 'TS. Lê Hoàng B');
      assert.equal(mapped.leadAssigneeName, 'TS. Lê Hoàng B');
      assert.equal(mapped.leadAssigneeId, 'user-dri-01');
      assert.equal(mapped.leadAssigneeAvatar, '/avatars/dri.jpg');
      // 'Phối hợp' = unique Primary DRIs of active subtasks, excluding the parent's own DRI
      assert.deepEqual(mapped.collaborators, [
        'ThS. Nguyễn Văn A',
        'TS. Trần Thị E',
        'CN. Hoàng G',
      ]);
      assert.deepEqual(mapped.coAssignees, [
        'ThS. Nguyễn Văn A',
        'TS. Trần Thị E',
        'CN. Hoàng G',
      ]);

      // Subtask metrics
      assert.equal(mapped.totalSubTasks, 3);
      assert.equal(mapped.completedSubTasks, 1);
      // Rollup calculation: (100 + 50 + 0) / 3 = 50%
      assert.equal(mapped.progress, 50);
      assert.equal(mapped.progressPercent, 50);

      // Nested subtasks mapped properly
      assert.equal(mapped.subTasks?.length, 3);
      assert.equal(mapped.subTasks?.[0].id, 'sub-01');
      assert.equal(mapped.subTasks?.[0].assigneeName, 'ThS. Nguyễn Văn A');
      assert.equal(mapped.subTasks?.[0].status, 'COMPLETED');
      assert.equal(mapped.subTasks?.[1].status, 'IN_PROGRESS');
      assert.equal(mapped.subTasks?.[2].status, 'NEW');
    });

    test('correctly maps subtask into StaffTask with parent breadcrumbs and collaborators', () => {
      const rawPrismaRecord: any = {
        id: 'task-sub-500',
        code: 'NV-2026-09-500',
        title: 'Triển khai cài đặt hệ thống chữ ký số VNPT-CA',
        description: 'Bàn giao USB Token cho các đơn vị phòng khoa',
        scope: 'DEPARTMENT',
        status: 'WAITING_APPROVAL',
        priority: 'URGENT',
        progressPercent: 90,
        academicMonth: 9,
        academicYear: '2026-2027',
        startDate: new Date('2026-09-15T08:00:00+07:00'),
        dueDate: new Date('2026-09-25T17:00:00+07:00'),
        updatedAt: new Date('2026-09-24T10:00:00+07:00'),

        leadUnit: {
          id: 'p-cntt',
          name: 'Phòng Công nghệ Thông tin & Truyền thông',
          code: 'TT_NN_TH',
        },
        parentTaskId: 'parent-root-99',
        parentTask: {
          id: 'parent-root-99',
          code: 'NV-2026-09-099',
          title: 'Hiện đại hóa hạ tầng điều hành điện tử',
          scope: 'SCHOOL',
        },
        actors: [
          {
            userId: 'dri-uid-1',
            role: 'DRI',
            isPrimaryDRI: true,
            user: { id: 'dri-uid-1', name: 'KS. Đặng Minh V', avatarUrl: '/avatars/v.png' },
          },
          {
            userId: 'collab-uid-2',
            role: 'COLLABORATOR',
            isPrimaryDRI: false,
            user: { id: 'collab-uid-2', name: 'CN. Ngô Q', avatarUrl: null },
          },
        ],
        deliverables: [
          {
            id: 'deliv-10',
            title: 'Bien_ban_ban_giao_token.pdf',
            fileUrl: 'https://qcet.edu.vn/docs/bb-token.pdf',
            reviewStatus: 'PENDING',
            createdAt: new Date('2026-09-24T09:00:00+07:00'),
          },
        ],
        dacumTaskDefId: 'dacum-def-88',
      };

      const staffTask = mapPrismaTaskToStaffTask(rawPrismaRecord);

      // DRI assertions
      assert.equal(staffTask.id, 'task-sub-500');
      assert.equal(staffTask.code, 'NV-2026-09-500');
      assert.equal(staffTask.title, 'Triển khai cài đặt hệ thống chữ ký số VNPT-CA');
      assert.equal(staffTask.assigneeName, 'KS. Đặng Minh V');
      assert.equal(staffTask.assigneeId, 'dri-uid-1');
      assert.equal(staffTask.assigneeAvatar, '/avatars/v.png');
      assert.equal(staffTask.assignedTo, 'KS. Đặng Minh V');

      // Leaf tasks carry no 'Phối hợp' entries: collaborators are derived on parent
      // tasks from their subtasks' Primary DRIs (commit 8290ff24), not from actors.
      assert.deepEqual(staffTask.collaborators, []);
      assert.deepEqual(staffTask.coAssignees, []);

      // Parent Task Breadcrumbs
      assert.equal(staffTask.parentSchoolTaskId, 'parent-root-99');
      assert.equal(staffTask.parentSchoolTaskTitle, 'Hiện đại hóa hạ tầng điều hành điện tử');
      assert.equal(staffTask.parentSchoolTaskCode, 'NV-2026-09-099');
      assert.equal(staffTask.parentTaskScope, 'SCHOOL');

      // Status mapping
      assert.equal(staffTask.status, 'NEEDS_REVIEW');

      // Deliverable & Review requirements
      assert.equal(staffTask.requiresReview, true);
      assert.equal(staffTask.deliverables?.length, 1);
      assert.equal(staffTask.deliverables?.[0].name, 'Bien_ban_ban_giao_token.pdf');
      assert.equal(staffTask.deliverables?.[0].url, 'https://qcet.edu.vn/docs/bb-token.pdf');

      // Dates
      assert.equal(staffTask.dueDate, '2026-09-25');
      assert.equal(staffTask.internalDueDate, '2026-09-25');
      assert.equal(staffTask.updatedAt, '2026-09-24');
    });

    test('handles tasks with no collaborators and no parentTask gracefully', () => {
      const minimalRecord: any = {
        id: 'task-solo-1',
        code: 'NV-SOLO-1',
        title: 'Bảo dưỡng máy in văn phòng',
        scope: 'DEPARTMENT',
        status: 'NOT_STARTED',
        priority: 'LOW',
        progressPercent: 0,
        academicMonth: 9,
        academicYear: '2026-2027',
        startDate: new Date('2026-09-01T00:00:00Z'),
        dueDate: new Date('2026-09-10T00:00:00Z'),
        actors: [],
        deliverables: [],
      };

      const staffTask = mapPrismaTaskToStaffTask(minimalRecord);
      assert.equal(staffTask.id, 'task-solo-1');
      assert.equal(staffTask.assigneeName, 'Chưa phân công');
      assert.equal(staffTask.assigneeId, undefined);
      assert.equal(staffTask.status, 'NEW');
      assert.equal(staffTask.parentSchoolTaskId, '');
      assert.equal(staffTask.parentSchoolTaskTitle, undefined);
      assert.equal(staffTask.parentSchoolTaskCode, undefined);
      assert.deepEqual(staffTask.collaborators, []);
      assert.deepEqual(staffTask.coAssignees, []);
    });
  });
});
