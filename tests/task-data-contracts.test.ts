import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  ApproveTaskInputSchema,
  SubmitDeliverableInputSchema,
  ReviewDeliverableInputSchema,
  TaskQueryParamsSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
} from '@/contracts/tasks';
import {
  toTaskDomainModel,
  toTaskDTO,
  toTaskViewModel,
  toTaskAssigneeDomain,
  toTaskDeliverableDomain,
} from '@/domain/tasks';
import {
  calculateTaskMetrics,
  isTaskOverdue,
  getSystemReferenceDate,
  isTaskPastDue,
  getCurrentAcademicPeriod,
} from '@/lib/task-metrics';

describe('Task Data Contracts, Domain Mappers & Data Correctness (Phase 6 & 7)', () => {
  describe('1. Zod Schemas & Input Contracts (src/contracts/tasks.ts)', () => {
    test('CreateTaskInputSchema: accepts valid input and applies default priority', () => {
      const validPayload = {
        title: 'Triển khai chuẩn kiểm định chất lượng GDNN 2026',
        description: 'Tổ chức rà soát tiêu chí kiểm định theo kế hoạch nhà trường',
        dueDate: '2026-10-15T17:00:00.000Z',
        departmentId: 'dept_qldt',
        scope: 'SCHOOL',
        academicMonth: 10,
        academicYear: '2026-2027',
        assigneeId: 'usr_lead_01',
        collaboratorIds: ['usr_cb_01', 'usr_cb_02'],
      };

      const parsed = CreateTaskInputSchema.parse(validPayload);
      assert.strictEqual(parsed.title, validPayload.title);
      assert.strictEqual(parsed.priority, 'MEDIUM');
      assert.strictEqual(parsed.academicMonth, 10);
      assert.strictEqual(parsed.scope, 'SCHOOL');
      assert.strictEqual(parsed.collaboratorIds?.length, 2);
    });

    test('CreateTaskInputSchema: rejects short title (< 3 chars) and invalid academic month', () => {
      assert.throws(
        () => {
          CreateTaskInputSchema.parse({
            title: 'No',
            departmentId: 'dept_01',
            dueDate: '2026-10-15',
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          assert.match(err.issues[0].message, /at least 3 characters/i);
          return true;
        }
      );

      assert.throws(
        () => {
          CreateTaskInputSchema.parse({
            title: 'Valid Title Here',
            departmentId: 'dept_01',
            dueDate: '2026-10-15',
            academicMonth: 13,
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          return true;
        }
      );
    });

    test('CreateTaskInputSchema: strictly prevents mass-assignment injection of privileged fields', () => {
      assert.throws(
        () => {
          CreateTaskInputSchema.parse({
            title: 'Nhiệm vụ hợp lệ',
            dueDate: '2026-10-15',
            departmentId: 'dept_01',
            id: 'injected_custom_id',
            status: 'COMPLETED',
            isApproved: true,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          const hasUnrecognizedKey = err.issues.some(
            (i: any) =>
              i.code === 'unrecognized_keys' &&
              (i.keys.includes('id') || i.keys.includes('status') || i.keys.includes('isApproved'))
          );
          assert.ok(hasUnrecognizedKey, 'Must reject unrecognized/privileged keys');
          return true;
        }
      );
    });

    test('UpdateTaskInputSchema: permits valid partial updates and status transitions', () => {
      const parsed = UpdateTaskInputSchema.parse({
        progressPercent: 85,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      });

      assert.strictEqual(parsed.progressPercent, 85);
      assert.strictEqual(parsed.status, 'IN_PROGRESS');
      assert.strictEqual(parsed.priority, 'HIGH');
    });

    test('UpdateTaskInputSchema: enforces progress percent boundaries (0 to 100)', () => {
      assert.throws(() => {
        UpdateTaskInputSchema.parse({ progressPercent: 120 });
      });

      assert.throws(() => {
        UpdateTaskInputSchema.parse({ progressPercent: -5 });
      });
    });

    test('ApproveTaskInputSchema: accepts canonical resolution and note within limits', () => {
      const parsed = ApproveTaskInputSchema.parse({
        resolution: 'APPROVED',
        note: 'Đã nghiệm thu đầy đủ minh chứng minh bạch',
      });

      assert.strictEqual(parsed.resolution, 'APPROVED');
      assert.strictEqual(parsed.note, 'Đã nghiệm thu đầy đủ minh chứng minh bạch');
    });

    test('SubmitDeliverableInputSchema: enforces required title, fileUrl and 50MB file size limit', () => {
      const parsed = SubmitDeliverableInputSchema.parse({
        title: 'Báo cáo kiểm định chất lượng',
        fileUrl: 'https://storage.qcet.edu.vn/files/report.pdf',
        fileSize: 10485760, // 10MB
        fileType: 'application/pdf',
      });

      assert.strictEqual(parsed.title, 'Báo cáo kiểm định chất lượng');
      assert.strictEqual(parsed.fileSize, 10485760);

      // Rejects missing title
      assert.throws(() => {
        SubmitDeliverableInputSchema.parse({
          fileUrl: 'https://storage.qcet.edu.vn/file.pdf',
        });
      });

      // Rejects file size > 50MB (52,428,800 bytes)
      assert.throws(() => {
        SubmitDeliverableInputSchema.parse({
          title: 'Large Video',
          fileUrl: 'https://storage.qcet.edu.vn/video.mp4',
          fileSize: 60 * 1024 * 1024,
        });
      });
    });

    test('ReviewDeliverableInputSchema: validates reviewStatus and reviewNote', () => {
      const parsed = ReviewDeliverableInputSchema.parse({
        deliverableId: 'deliv_123',
        reviewStatus: 'APPROVED',
        reviewNote: 'Minh chứng hợp lệ',
      });

      assert.strictEqual(parsed.reviewStatus, 'APPROVED');
      assert.strictEqual(parsed.deliverableId, 'deliv_123');
    });

    test('TaskQueryParamsSchema: coerces types and provides default pagination', () => {
      const parsed = TaskQueryParamsSchema.parse({
        page: '2',
        pageSize: '30',
        academicMonth: '11',
        scope: 'school',
      });

      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.pageSize, 30);
      assert.strictEqual(parsed.academicMonth, 11);
      assert.strictEqual(parsed.scope, 'school');
    });
  });

  describe('2. Domain Models & Mappers (src/domain/tasks/mappers.ts)', () => {
    const samplePrismaTask = {
      id: 'task_root_001',
      code: 'NV-2026-10-001',
      title: 'Xây dựng chương trình đào tạo nghề Logistics',
      description: 'Ban hành khung chương trình đào tạo trình độ cao đẳng',
      scope: 'SCHOOL',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progressPercent: 45,
      dueDate: new Date('2026-10-25T17:00:00Z'),
      startDate: new Date('2026-10-01T08:00:00Z'),
      academicMonth: 10,
      academicYear: '2026-2027',
      departmentId: 'dept_cntt',
      department: {
        id: 'dept_cntt',
        name: 'Khoa Công nghệ Thông tin',
        shortName: 'CNTT',
      },
      createdById: 'usr_admin',
      parentTaskId: null,
      assignees: [
        {
          userId: 'usr_dri_01',
          roleInTask: 'PRIMARY_OWNER',
          user: { id: 'usr_dri_01', name: 'Nguyễn Văn A', avatarUrl: '/avatars/a.png' },
        },
        {
          userId: 'usr_collab_01',
          roleInTask: 'COLLABORATOR',
          user: { id: 'usr_collab_01', name: 'Trần Thị B', avatarUrl: null },
        },
      ],
      deliverables: [
        {
          id: 'deliv_001',
          taskId: 'task_root_001',
          title: 'Dự thảo khung chương trình',
          fileUrl: 'https://qcet.edu.vn/files/du-thao.docx',
          reviewStatus: 'APPROVED',
          uploadedById: 'usr_dri_01',
          uploadedBy: { id: 'usr_dri_01', name: 'Nguyễn Văn A' },
          createdAt: new Date('2026-10-10T10:00:00Z'),
        },
      ],
      subTasks: [
        {
          id: 'sub_001',
          code: 'NV-2026-10-002',
          title: 'Khảo sát nhu cầu doanh nghiệp Logistics',
          status: 'COMPLETED',
          progressPercent: 100,
          dueDate: new Date('2026-10-15T17:00:00Z'),
          parentTaskId: 'task_root_001',
          assignees: [],
          deliverables: [],
        },
        {
          id: 'sub_002',
          code: 'NV-2026-10-003',
          title: 'Họp hội đồng chuyên gia thẩm định',
          status: 'IN_PROGRESS',
          progressPercent: 30,
          dueDate: new Date('2026-10-22T17:00:00Z'),
          parentTaskId: 'task_root_001',
          assignees: [],
          deliverables: [],
        },
      ],
    };

    test('toTaskDomainModel: transforms raw DB task into rich TaskDomainModel', () => {
      const domain = toTaskDomainModel(samplePrismaTask);

      assert.strictEqual(domain.id, 'task_root_001');
      assert.strictEqual(domain.code, 'NV-2026-10-001');
      assert.strictEqual(domain.scope, 'SCHOOL');
      assert.strictEqual(domain.status, 'IN_PROGRESS');
      assert.strictEqual(domain.priority, 'HIGH');
      assert.strictEqual(domain.departmentName, 'Khoa Công nghệ Thông tin');
      assert.strictEqual(domain.departmentCode, 'CNTT');

      // Single DRI & Collaborator separation
      assert.ok(domain.primaryOwner);
      assert.strictEqual(domain.primaryOwner?.userId, 'usr_dri_01');
      assert.strictEqual(domain.primaryOwner?.userName, 'Nguyễn Văn A');
      assert.strictEqual(domain.collaborators.length, 1);
      assert.strictEqual(domain.collaborators[0].userName, 'Trần Thị B');

      // Subtasks rollup
      assert.strictEqual(domain.totalSubTasks, 2);
      assert.strictEqual(domain.completedSubTasks, 1);

      // Deliverables
      assert.strictEqual(domain.deliverables.length, 1);
      assert.strictEqual(domain.deliverables[0].reviewStatus, 'APPROVED');
      assert.strictEqual(domain.deliverables[0].uploadedByName, 'Nguyễn Văn A');

      // Governance flag
      assert.strictEqual(domain.requiresReview, true);
    });

    test('toTaskDTO: formats domain model into API Data Transfer Object', () => {
      const domain = toTaskDomainModel(samplePrismaTask);
      const dto = toTaskDTO(domain);

      assert.strictEqual(dto.id, domain.id);
      assert.strictEqual(dto.code, domain.code);
      assert.strictEqual(dto.primaryOwner?.name, 'Nguyễn Văn A');
      assert.strictEqual(dto.collaborators[0].name, 'Trần Thị B');
      assert.strictEqual(dto.deliverables[0].title, 'Dự thảo khung chương trình');
      assert.strictEqual(dto.totalSubTasks, 2);
      assert.strictEqual(dto.completedSubTasks, 1);
    });

    test('toTaskViewModel: translates domain model into UI ViewModel with progress rollup', () => {
      // Test with raw progress 0 but subtasks present (should rollup subtasks average: (100 + 30) / 2 = 65)
      const taskWithZeroProgress = {
        ...samplePrismaTask,
        progressPercent: 0,
      };

      const viewModel = toTaskViewModel(taskWithZeroProgress);

      assert.strictEqual(viewModel.id, 'task_root_001');
      assert.strictEqual(viewModel.title, samplePrismaTask.title);
      assert.strictEqual(viewModel.leadAssigneeName, 'Nguyễn Văn A');
      assert.strictEqual(viewModel.assignedTo, 'Nguyễn Văn A');
      assert.strictEqual(viewModel.progress, 65); // Subtask rollup: (100 + 30) / 2 = 65
      assert.strictEqual(viewModel.status, 'in_progress');
      assert.strictEqual(viewModel.priority, 'high');
      assert.strictEqual(viewModel.category, 'Chỉ đạo cấp Trường');
      assert.strictEqual(viewModel.totalSubTasks, 2);
      assert.strictEqual(viewModel.completedSubTasks, 1);
    });
  });

  describe('3. Data Correctness & Task Metrics (src/lib/task-metrics.ts)', () => {
    test('calculateTaskMetrics: enforces strict denominator separation (onlyParentTasks: true)', () => {
      const testTasks = [
        // 3 Parent tasks
        { id: 'p1', status: 'COMPLETED', parentTaskId: null, dueDate: '2026-10-10' },
        { id: 'p2', status: 'IN_PROGRESS', parentTaskId: null, dueDate: '2026-10-20' },
        { id: 'p3', status: 'WAITING_APPROVAL', parentTaskId: null, dueDate: '2026-10-15' },
        // 5 Subtasks (must not dilute or inflate parent metrics denominator)
        { id: 's1', status: 'COMPLETED', parentTaskId: 'p2', dueDate: '2026-10-12' },
        { id: 's2', status: 'COMPLETED', parentTaskId: 'p2', dueDate: '2026-10-14' },
        { id: 's3', status: 'IN_PROGRESS', parentTaskId: 'p2', dueDate: '2026-10-18' },
        { id: 's4', status: 'COMPLETED', parentTaskId: 'p3', dueDate: '2026-10-12' },
        { id: 's5', status: 'IN_PROGRESS', parentTaskId: 'p3', dueDate: '2026-10-15' },
      ];

      // With denominator separation (default: true)
      const parentMetrics = calculateTaskMetrics(testTasks, { onlyParentTasks: true });

      assert.strictEqual(parentMetrics.total, 3, 'Parent metrics total must be exactly 3 parent tasks');
      assert.strictEqual(parentMetrics.completed, 1);
      assert.strictEqual(parentMetrics.inProgress, 1);
      assert.strictEqual(parentMetrics.waitingApproval, 1);
      // Completion rate: 1/3 = 33%
      assert.strictEqual(parentMetrics.completionRate, 33);
      assert.strictEqual(parentMetrics.isDenominatorSeparated, true);

      // Without denominator separation: total = 8
      const allMetrics = calculateTaskMetrics(testTasks, { onlyParentTasks: false });
      assert.strictEqual(allMetrics.total, 8);
      assert.strictEqual(allMetrics.completed, 4);
      assert.strictEqual(allMetrics.completionRate, 50);
      assert.strictEqual(allMetrics.isDenominatorSeparated, false);
    });

    test('isTaskOverdue & isTaskPastDue: accurately evaluates overdue tasks against system reference date', () => {
      const refDate = getSystemReferenceDate();
      assert.match(refDate, /^\d{4}-\d{2}-\d{2}$/, 'Reference date must be formatted YYYY-MM-DD');

      // Past due date
      const pastTask = {
        status: 'IN_PROGRESS',
        dueDate: '2020-01-01',
      };
      assert.strictEqual(isTaskOverdue(pastTask, refDate), true);

      // Future due date
      const futureTask = {
        status: 'IN_PROGRESS',
        dueDate: '2099-12-31',
      };
      assert.strictEqual(isTaskOverdue(futureTask, refDate), false);

      // Completed task past due is NOT counted as overdue
      const completedTask = {
        status: 'COMPLETED',
        dueDate: '2020-01-01',
      };
      assert.strictEqual(isTaskOverdue(completedTask, refDate), false);

      // Cancelled task past due is NOT counted as overdue
      const cancelledTask = {
        status: 'CANCELLED',
        dueDate: '2020-01-01',
      };
      assert.strictEqual(isTaskOverdue(cancelledTask, refDate), false);
    });

    test('Academic Calendar: returns canonical academic period info', () => {
      const period = getCurrentAcademicPeriod();

      assert.ok(period.academicYear);
      assert.match(period.academicYear, /^\d{4}-\d{4}$/);
      assert.ok(period.month >= 1 && period.month <= 12);
      assert.ok(period.semester === 1 || period.semester === 2);
      assert.ok(period.label);
    });
  });
});
