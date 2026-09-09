import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Contract imports
import {
  PaginationQuerySchema,
  SearchQuerySchema,
  IdSchema,
  IsoDateStringSchema,
} from '@/contracts/common';
import {
  LoginInputSchema,
  RegisterInputSchema,
} from '@/contracts/auth';
import {
  TaskQuerySchema,
  CreateTaskSchema,
  UpdateTaskMetadataSchema,
  ChangeTaskStatusSchema,
  AssignTaskSchema,
  ApproveTaskSchema,
  SubmitDeliverableSchema,
} from '@/contracts/tasks';
import {
  DocumentQuerySchema,
  CreateDocumentSchema,
  UpdateDocumentSchema,
  CreateDirectiveSchema,
} from '@/contracts/documents';
import {
  NotificationQuerySchema,
  SubscribePushSchema,
  TestPushSchema,
} from '@/contracts/notifications';
import {
  UserQuerySchema,
  UpdateUserRoleSchema,
  OnboardingInputSchema,
} from '@/contracts/users';

describe('Shared Input Contracts & Strict Boundary Limits', () => {
  describe('Common Contracts (src/contracts/common.ts)', () => {
    describe('PaginationQuerySchema', () => {
      it('applies standard default values when empty input is provided', () => {
        const parsed = PaginationQuerySchema.parse({});
        assert.strictEqual(parsed.page, 1);
        assert.strictEqual(parsed.pageSize, 20);
        assert.strictEqual(parsed.cursor, undefined);
      });

      it('coerces string values to numbers and accepts valid boundaries', () => {
        const parsed = PaginationQuerySchema.parse({
          page: '5',
          pageSize: '100',
          cursor: 'cur_abc123',
        });
        assert.strictEqual(parsed.page, 5);
        assert.strictEqual(parsed.pageSize, 100);
        assert.strictEqual(parsed.cursor, 'cur_abc123');
      });

      it('rejects page less than 1', () => {
        assert.strictEqual(PaginationQuerySchema.safeParse({ page: 0 }).success, false);
        assert.strictEqual(PaginationQuerySchema.safeParse({ page: -5 }).success, false);
      });

      it('rejects pageSize less than 1 or greater than 100', () => {
        assert.strictEqual(PaginationQuerySchema.safeParse({ pageSize: 0 }).success, false);
        assert.strictEqual(PaginationQuerySchema.safeParse({ pageSize: -1 }).success, false);
        assert.strictEqual(PaginationQuerySchema.safeParse({ pageSize: 101 }).success, false);
        assert.strictEqual(PaginationQuerySchema.safeParse({ pageSize: 100 }).success, true);
      });

      it('rejects cursor exceeding 100 characters', () => {
        const longCursor = 'c'.repeat(101);
        const validCursor = 'c'.repeat(100);
        assert.strictEqual(PaginationQuerySchema.safeParse({ cursor: longCursor }).success, false);
        assert.strictEqual(PaginationQuerySchema.safeParse({ cursor: validCursor }).success, true);
      });
    });

    describe('SearchQuerySchema', () => {
      it('trims whitespace and accepts valid search query and scope', () => {
        const parsed = SearchQuerySchema.parse({
          q: '   Báo cáo đào tạo   ',
          scope: 'school',
        });
        assert.strictEqual(parsed.q, 'Báo cáo đào tạo');
        assert.strictEqual(parsed.scope, 'school');
      });

      it('rejects query exceeding 200 characters', () => {
        const longQuery = 'a'.repeat(201);
        const validQuery = 'a'.repeat(200);
        assert.strictEqual(SearchQuerySchema.safeParse({ q: longQuery }).success, false);
        assert.strictEqual(SearchQuerySchema.safeParse({ q: validQuery }).success, true);
      });

      it('only accepts allowed operational scopes', () => {
        assert.strictEqual(SearchQuerySchema.safeParse({ scope: 'school' }).success, true);
        assert.strictEqual(SearchQuerySchema.safeParse({ scope: 'unit' }).success, true);
        assert.strictEqual(SearchQuerySchema.safeParse({ scope: 'personal' }).success, true);
        assert.strictEqual(SearchQuerySchema.safeParse({ scope: 'invalid_scope' }).success, false);
      });
    });

    describe('IdSchema', () => {
      it('accepts valid identifier strings between 1 and 128 chars', () => {
        assert.strictEqual(IdSchema.safeParse('usr_12345').success, true);
        assert.strictEqual(IdSchema.safeParse('a'.repeat(128)).success, true);
      });

      it('rejects empty strings or strings exceeding 128 characters', () => {
        assert.strictEqual(IdSchema.safeParse('').success, false);
        assert.strictEqual(IdSchema.safeParse('   ').success, false);
        assert.strictEqual(IdSchema.safeParse('a'.repeat(129)).success, false);
      });
    });

    describe('IsoDateStringSchema', () => {
      it('accepts valid ISO date formats', () => {
        assert.strictEqual(IsoDateStringSchema.safeParse('2026-09-09').success, true);
        assert.strictEqual(IsoDateStringSchema.safeParse('2026-09-09T14:30:00Z').success, true);
        assert.strictEqual(IsoDateStringSchema.safeParse('2026-09-09T14:30:00.000Z').success, true);
        assert.strictEqual(IsoDateStringSchema.safeParse('2026-09-09T14:30:00+07:00').success, true);
      });

      it('rejects invalid date strings', () => {
        assert.strictEqual(IsoDateStringSchema.safeParse('not-a-date').success, false);
        assert.strictEqual(IsoDateStringSchema.safeParse('2026/09/09').success, false);
        assert.strictEqual(IsoDateStringSchema.safeParse('2026-13-45').success, false);
      });
    });
  });

  describe('Auth Contracts (src/contracts/auth.ts)', () => {
    describe('LoginInputSchema', () => {
      it('accepts valid login credentials and normalizes email', () => {
        const parsed = LoginInputSchema.parse({
          email: '  GIANGVIEN@CDKTCNQN.EDU.VN  ',
          password: 'securePassword123',
        });
        assert.strictEqual(parsed.email, 'giangvien@cdktcnqn.edu.vn');
        assert.strictEqual(parsed.password, 'securePassword123');
      });

      it('rejects invalid email addresses', () => {
        assert.strictEqual(
          LoginInputSchema.safeParse({ email: 'not-an-email', password: '123' }).success,
          false
        );
      });

      it('rejects passwords exceeding 128 characters or empty passwords', () => {
        assert.strictEqual(
          LoginInputSchema.safeParse({
            email: 'admin@cdktcnqn.edu.vn',
            password: 'p'.repeat(129),
          }).success,
          false
        );
        assert.strictEqual(
          LoginInputSchema.safeParse({
            email: 'admin@cdktcnqn.edu.vn',
            password: '',
          }).success,
          false
        );
      });

      it('enforces strict validation to prevent malicious mass-assignment attempts', () => {
        const result = LoginInputSchema.safeParse({
          email: 'admin@cdktcnqn.edu.vn',
          password: 'securePassword123',
          role: 'ADMIN',
          isAdmin: true,
        });
        assert.strictEqual(result.success, false);
      });
    });

    describe('RegisterInputSchema', () => {
      it('accepts valid registration payload', () => {
        const parsed = RegisterInputSchema.parse({
          email: 'newuser@cdktcnqn.edu.vn',
          password: 'mypassword123',
          name: 'Nguyễn Văn An',
          departmentId: 'dept_cntt',
        });
        assert.strictEqual(parsed.email, 'newuser@cdktcnqn.edu.vn');
        assert.strictEqual(parsed.name, 'Nguyễn Văn An');
        assert.strictEqual(parsed.departmentId, 'dept_cntt');
      });

      it('rejects password shorter than 6 characters or longer than 128 characters', () => {
        assert.strictEqual(
          RegisterInputSchema.safeParse({
            email: 'user@cdktcnqn.edu.vn',
            password: '12345',
            name: 'Nguyễn Văn An',
          }).success,
          false
        );
        assert.strictEqual(
          RegisterInputSchema.safeParse({
            email: 'user@cdktcnqn.edu.vn',
            password: 'p'.repeat(129),
            name: 'Nguyễn Văn An',
          }).success,
          false
        );
      });

      it('rejects name shorter than 2 or longer than 100 characters', () => {
        assert.strictEqual(
          RegisterInputSchema.safeParse({
            email: 'user@cdktcnqn.edu.vn',
            password: 'password123',
            name: 'A',
          }).success,
          false
        );
        assert.strictEqual(
          RegisterInputSchema.safeParse({
            email: 'user@cdktcnqn.edu.vn',
            password: 'password123',
            name: 'N'.repeat(101),
          }).success,
          false
        );
      });

      it('rejects departmentId exceeding 64 characters', () => {
        assert.strictEqual(
          RegisterInputSchema.safeParse({
            email: 'user@cdktcnqn.edu.vn',
            password: 'password123',
            name: 'Nguyễn Văn An',
            departmentId: 'd'.repeat(65),
          }).success,
          false
        );
      });

      it('strictly rejects mass-assignment injections', () => {
        const result = RegisterInputSchema.safeParse({
          email: 'user@cdktcnqn.edu.vn',
          password: 'password123',
          name: 'Nguyễn Văn An',
          role: 'ADMIN',
        });
        assert.strictEqual(result.success, false);
      });
    });
  });

  describe('Tasks Contracts (src/contracts/tasks.ts)', () => {
    describe('TaskQuerySchema', () => {
      it('parses valid query parameters with pagination and filters', () => {
        const parsed = TaskQuerySchema.parse({
          page: '2',
          pageSize: '50',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          departmentId: 'dept_cntt',
          academicMonth: '9',
          academicYear: '2026-2027',
          q: 'Kế hoạch DACUM',
        });
        assert.strictEqual(parsed.page, 2);
        assert.strictEqual(parsed.pageSize, 50);
        assert.strictEqual(parsed.status, 'IN_PROGRESS');
        assert.strictEqual(parsed.priority, 'HIGH');
        assert.strictEqual(parsed.academicMonth, 9);
        assert.strictEqual(parsed.q, 'Kế hoạch DACUM');
      });

      it('rejects academicMonth outside 1-12 range', () => {
        assert.strictEqual(TaskQuerySchema.safeParse({ academicMonth: 0 }).success, false);
        assert.strictEqual(TaskQuerySchema.safeParse({ academicMonth: 13 }).success, false);
        assert.strictEqual(TaskQuerySchema.safeParse({ academicMonth: 12 }).success, true);
      });
    });

    describe('CreateTaskSchema', () => {
      it('accepts valid task creation payload with defaults', () => {
        const parsed = CreateTaskSchema.parse({
          title: 'Hoàn thiện hồ sơ đánh giá chất lượng',
          description: 'Soạn thảo báo cáo tự đánh giá theo chuẩn kiểm định 2026',
          dueDate: '2026-09-30T17:00:00Z',
          departmentId: 'dept_qldt',
          assigneeIds: ['usr_1', 'usr_2'],
        });
        assert.strictEqual(parsed.title, 'Hoàn thiện hồ sơ đánh giá chất lượng');
        assert.strictEqual(parsed.priority, 'MEDIUM');
        assert.deepStrictEqual(parsed.assigneeIds, ['usr_1', 'usr_2']);
      });

      it('rejects title shorter than 3 or longer than 255 characters', () => {
        assert.strictEqual(
          CreateTaskSchema.safeParse({ title: 'AB' }).success,
          false
        );
        assert.strictEqual(
          CreateTaskSchema.safeParse({ title: 'T'.repeat(256) }).success,
          false
        );
      });

      it('rejects description exceeding 5000 characters', () => {
        assert.strictEqual(
          CreateTaskSchema.safeParse({
            title: 'Valid Task Title',
            description: 'x'.repeat(5001),
          }).success,
          false
        );
      });

      it('rejects assignee list exceeding 50 assignees', () => {
        const tooManyAssignees = Array.from({ length: 51 }, (_, i) => `usr_${i}`);
        assert.strictEqual(
          CreateTaskSchema.safeParse({
            title: 'Valid Task Title',
            assigneeIds: tooManyAssignees,
          }).success,
          false
        );
      });

      it('rejects deliverables list exceeding 20 items or oversize files', () => {
        const tooManyDeliverables = Array.from({ length: 21 }, (_, i) => ({
          title: `Deliverable ${i}`,
          fileName: `file_${i}.pdf`,
          fileUrl: `https://storage.cdktcnqn.edu.vn/files/file_${i}.pdf`,
        }));
        assert.strictEqual(
          CreateTaskSchema.safeParse({
            title: 'Valid Task Title',
            deliverables: tooManyDeliverables,
          }).success,
          false
        );

        // Oversized file > 50MB (52,428,800 bytes)
        assert.strictEqual(
          CreateTaskSchema.safeParse({
            title: 'Valid Task Title',
            deliverables: [
              {
                title: 'Oversized Document',
                fileName: 'huge.pdf',
                fileUrl: 'https://storage.cdktcnqn.edu.vn/files/huge.pdf',
                fileSize: 52428801,
              },
            ],
          }).success,
          false
        );
      });

      it('strictly rejects mass-assignment injection of privileged fields', () => {
        const result = CreateTaskSchema.safeParse({
          title: 'Valid Task Title',
          id: 'injected_task_id',
          status: 'COMPLETED',
          progressPercent: 100,
          createdById: 'usr_impersonated',
          approvedAt: '2026-09-09T00:00:00Z',
        });
        assert.strictEqual(result.success, false);
      });
    });

    describe('UpdateTaskMetadataSchema', () => {
      it('allows updating bounded metadata fields', () => {
        const parsed = UpdateTaskMetadataSchema.parse({
          title: 'Cập nhật tiêu đề nhiệm vụ',
          description: 'Cập nhật mô tả mới',
          priority: 'HIGH',
          dueDate: '2026-10-15T17:00:00Z',
        });
        assert.strictEqual(parsed.title, 'Cập nhật tiêu đề nhiệm vụ');
        assert.strictEqual(parsed.priority, 'HIGH');
      });

      it('strictly rejects status, approvals, creator, and role modification', () => {
        assert.strictEqual(
          UpdateTaskMetadataSchema.safeParse({
            title: 'Updated title',
            status: 'COMPLETED',
          }).success,
          false
        );
        assert.strictEqual(
          UpdateTaskMetadataSchema.safeParse({
            title: 'Updated title',
            createdById: 'new_creator',
          }).success,
          false
        );
        assert.strictEqual(
          UpdateTaskMetadataSchema.safeParse({
            title: 'Updated title',
            approved: true,
          }).success,
          false
        );
      });
    });

    describe('ChangeTaskStatusSchema', () => {
      it('accepts valid status and optional comment', () => {
        const parsed = ChangeTaskStatusSchema.parse({
          status: 'IN_PROGRESS',
          comment: 'Bắt đầu triển khai phân hệ mới',
        });
        assert.strictEqual(parsed.status, 'IN_PROGRESS');
        assert.strictEqual(parsed.comment, 'Bắt đầu triển khai phân hệ mới');
      });

      it('rejects invalid status', () => {
        assert.strictEqual(
          ChangeTaskStatusSchema.safeParse({ status: 'INVALID_STATUS' }).success,
          false
        );
      });

      it('rejects comment exceeding 1000 characters', () => {
        assert.strictEqual(
          ChangeTaskStatusSchema.safeParse({
            status: 'COMPLETED',
            comment: 'c'.repeat(1001),
          }).success,
          false
        );
      });

      it('strictly rejects extra keys', () => {
        assert.strictEqual(
          ChangeTaskStatusSchema.safeParse({
            status: 'COMPLETED',
            assigneeId: 'usr_new',
          }).success,
          false
        );
      });
    });

    describe('AssignTaskSchema', () => {
      it('accepts array of assignee ids up to 50', () => {
        const parsed = AssignTaskSchema.parse({
          assigneeIds: ['usr_1', 'usr_2', 'usr_3'],
        });
        assert.deepStrictEqual(parsed.assigneeIds, ['usr_1', 'usr_2', 'usr_3']);
      });

      it('rejects more than 50 assignees', () => {
        const tooMany = Array.from({ length: 51 }, (_, i) => `usr_${i}`);
        assert.strictEqual(AssignTaskSchema.safeParse({ assigneeIds: tooMany }).success, false);
      });

      it('strictly rejects extra unallowed fields', () => {
        assert.strictEqual(
          AssignTaskSchema.safeParse({
            assigneeIds: ['usr_1'],
            role: 'MANAGER',
          }).success,
          false
        );
      });
    });

    describe('ApproveTaskSchema', () => {
      it('accepts valid approval decision and optional versioning', () => {
        const parsed = ApproveTaskSchema.parse({
          approved: true,
          comment: 'Đồng ý nghiệm thu kết quả',
          expectedVersion: 3,
        });
        assert.strictEqual(parsed.approved, true);
        assert.strictEqual(parsed.comment, 'Đồng ý nghiệm thu kết quả');
        assert.strictEqual(parsed.expectedVersion, 3);
      });

      it('rejects comment exceeding 1000 characters', () => {
        assert.strictEqual(
          ApproveTaskSchema.safeParse({
            approved: false,
            comment: 'c'.repeat(1001),
          }).success,
          false
        );
      });

      it('strictly rejects extra fields', () => {
        assert.strictEqual(
          ApproveTaskSchema.safeParse({
            approved: true,
            status: 'COMPLETED',
          }).success,
          false
        );
      });
    });

    describe('SubmitDeliverableSchema', () => {
      it('accepts valid deliverable submission within limits', () => {
        const parsed = SubmitDeliverableSchema.parse({
          title: 'Báo cáo kiểm định chất lượng đợt 1',
          fileUrl: 'https://storage.cdktcnqn.edu.vn/uploads/bao-cao.pdf',
          fileName: 'bao-cao-kiem-dinh.pdf',
          fileSize: 10485760, // 10MB
        });
        assert.strictEqual(parsed.title, 'Báo cáo kiểm định chất lượng đợt 1');
        assert.strictEqual(parsed.fileSize, 10485760);
      });

      it('rejects fileSize exceeding 50MB (52428800 bytes)', () => {
        assert.strictEqual(
          SubmitDeliverableSchema.safeParse({
            title: 'File quá lớn',
            fileUrl: 'https://storage.cdktcnqn.edu.vn/uploads/big.zip',
            fileName: 'big.zip',
            fileSize: 52428801,
          }).success,
          false
        );
      });

      it('rejects empty title or file URL exceeding 1024 characters', () => {
        assert.strictEqual(
          SubmitDeliverableSchema.safeParse({
            title: '',
            fileUrl: 'https://storage.cdktcnqn.edu.vn/uploads/file.pdf',
            fileName: 'file.pdf',
            fileSize: 1024,
          }).success,
          false
        );
        assert.strictEqual(
          SubmitDeliverableSchema.safeParse({
            title: 'Valid Title',
            fileUrl: 'https://storage.cdktcnqn.edu.vn/' + 'u'.repeat(1025),
            fileName: 'file.pdf',
            fileSize: 1024,
          }).success,
          false
        );
      });

      it('strictly rejects extra fields', () => {
        assert.strictEqual(
          SubmitDeliverableSchema.safeParse({
            title: 'Valid Title',
            fileUrl: 'https://storage.cdktcnqn.edu.vn/file.pdf',
            fileName: 'file.pdf',
            fileSize: 1024,
            isApproved: true,
          }).success,
          false
        );
      });
    });
  });

  describe('Documents Contracts (src/contracts/documents.ts)', () => {
    describe('DocumentQuerySchema', () => {
      it('parses valid document query parameters', () => {
        const parsed = DocumentQuerySchema.parse({
          page: '1',
          pageSize: '25',
          type: 'INCOMING',
          status: 'CHO_PHAN_CONG',
          departmentId: 'dept_van_thu',
          search: 'Công văn 123',
        });
        assert.strictEqual(parsed.page, 1);
        assert.strictEqual(parsed.pageSize, 25);
        assert.strictEqual(parsed.type, 'INCOMING');
        assert.strictEqual(parsed.search, 'Công văn 123');
      });

      it('rejects search exceeding 200 characters', () => {
        assert.strictEqual(
          DocumentQuerySchema.safeParse({ search: 's'.repeat(201) }).success,
          false
        );
      });
    });

    describe('CreateDocumentSchema', () => {
      it('accepts valid document creation payload', () => {
        const parsed = CreateDocumentSchema.parse({
          title: 'Công văn chỉ đạo năm học 2026-2027',
          documentNumber: '123/CV-CDKTCNQN',
          type: 'INCOMING',
          departmentId: 'dept_bgh',
          summary: 'Tóm tắt nội dung công văn hướng dẫn',
          fileUrl: 'https://storage.cdktcnqn.edu.vn/docs/cv-123.pdf',
        });
        assert.strictEqual(parsed.title, 'Công văn chỉ đạo năm học 2026-2027');
        assert.strictEqual(parsed.documentNumber, '123/CV-CDKTCNQN');
        assert.strictEqual(parsed.type, 'INCOMING');
      });

      it('rejects title shorter than 3 or longer than 255 characters', () => {
        assert.strictEqual(
          CreateDocumentSchema.safeParse({
            title: 'CV',
            documentNumber: '1/CV',
            type: 'INCOMING',
          }).success,
          false
        );
        assert.strictEqual(
          CreateDocumentSchema.safeParse({
            title: 'C'.repeat(256),
            documentNumber: '1/CV',
            type: 'INCOMING',
          }).success,
          false
        );
      });

      it('rejects documentNumber exceeding 100 characters', () => {
        assert.strictEqual(
          CreateDocumentSchema.safeParse({
            title: 'Valid Document Title',
            documentNumber: 'n'.repeat(101),
            type: 'INCOMING',
          }).success,
          false
        );
      });

      it('rejects summary exceeding 2000 characters', () => {
        assert.strictEqual(
          CreateDocumentSchema.safeParse({
            title: 'Valid Document Title',
            documentNumber: '123/CV',
            type: 'INCOMING',
            summary: 's'.repeat(2001),
          }).success,
          false
        );
      });

      it('strictly rejects mass-assignment injection', () => {
        assert.strictEqual(
          CreateDocumentSchema.safeParse({
            title: 'Valid Document Title',
            documentNumber: '123/CV',
            type: 'INCOMING',
            registeredById: 'usr_hacked',
          }).success,
          false
        );
      });
    });

    describe('UpdateDocumentSchema', () => {
      it('accepts partial bounded document updates', () => {
        const parsed = UpdateDocumentSchema.parse({
          title: 'Cập nhật tiêu đề văn bản',
          summary: 'Cập nhật trích yếu',
        });
        assert.strictEqual(parsed.title, 'Cập nhật tiêu đề văn bản');
      });

      it('strictly rejects extra unallowed fields', () => {
        assert.strictEqual(
          UpdateDocumentSchema.safeParse({
            title: 'Updated title',
            registeredById: 'usr_spoofed',
          }).success,
          false
        );
      });
    });

    describe('CreateDirectiveSchema', () => {
      it('accepts valid executive directive payload', () => {
        const parsed = CreateDirectiveSchema.parse({
          title: 'Chỉ đạo khẩn về công tác tuyển sinh',
          content: 'Yêu cầu phòng Đào tạo phối hợp các khoa hoàn tất kế hoạch trước thứ Sáu.',
          assignedToDepartmentId: 'dept_qldt',
          deadline: '2026-09-18T17:00:00Z',
        });
        assert.strictEqual(parsed.title, 'Chỉ đạo khẩn về công tác tuyển sinh');
        assert.strictEqual(parsed.assignedToDepartmentId, 'dept_qldt');
      });

      it('rejects title shorter than 2 or longer than 255 characters', () => {
        assert.strictEqual(
          CreateDirectiveSchema.safeParse({
            title: 'C',
            content: 'Nội dung hợp lệ',
          }).success,
          false
        );
        assert.strictEqual(
          CreateDirectiveSchema.safeParse({
            title: 'T'.repeat(256),
            content: 'Nội dung hợp lệ',
          }).success,
          false
        );
      });

      it('rejects content shorter than 2 or longer than 5000 characters', () => {
        assert.strictEqual(
          CreateDirectiveSchema.safeParse({
            title: 'Tiêu đề chỉ đạo',
            content: 'N',
          }).success,
          false
        );
        assert.strictEqual(
          CreateDirectiveSchema.safeParse({
            title: 'Tiêu đề chỉ đạo',
            content: 'x'.repeat(5001),
          }).success,
          false
        );
      });

      it('strictly rejects extra unallowed fields', () => {
        assert.strictEqual(
          CreateDirectiveSchema.safeParse({
            title: 'Tiêu đề chỉ đạo',
            content: 'Nội dung hợp lệ',
            leaderId: 'usr_spoofed',
          }).success,
          false
        );
      });
    });
  });

  describe('Notifications Contracts (src/contracts/notifications.ts)', () => {
    describe('NotificationQuerySchema', () => {
      it('parses valid notification query parameters and coerces read boolean', () => {
        const parsed1 = NotificationQuerySchema.parse({ read: 'true', page: '1' });
        assert.strictEqual(parsed1.read, true);
        assert.strictEqual(parsed1.page, 1);

        const parsed2 = NotificationQuerySchema.parse({ read: 'false' });
        assert.strictEqual(parsed2.read, false);

        const parsed3 = NotificationQuerySchema.parse({ read: true });
        assert.strictEqual(parsed3.read, true);
      });
    });

    describe('SubscribePushSchema', () => {
      it('accepts valid Web Push subscription payload', () => {
        const parsed = SubscribePushSchema.parse({
          endpoint: 'https://fcm.googleapis.com/fcm/send/sample-token-12345',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9Q0A4APqOM8pA4P_wnd8',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
          deviceType: 'mobile',
        });
        assert.strictEqual(
          parsed.endpoint,
          'https://fcm.googleapis.com/fcm/send/sample-token-12345'
        );
        assert.strictEqual(parsed.keys.auth, 'tBHItJI5svbpez7KI4CCXg');
      });

      it('rejects non-URL endpoint or endpoint exceeding 1024 characters', () => {
        assert.strictEqual(
          SubscribePushSchema.safeParse({
            endpoint: 'not-a-valid-url',
            keys: { p256dh: 'abc', auth: 'def' },
          }).success,
          false
        );
        assert.strictEqual(
          SubscribePushSchema.safeParse({
            endpoint: 'https://example.com/' + 'x'.repeat(1025),
            keys: { p256dh: 'abc', auth: 'def' },
          }).success,
          false
        );
      });

      it('rejects keys with empty or oversized values (> 255 chars)', () => {
        assert.strictEqual(
          SubscribePushSchema.safeParse({
            endpoint: 'https://example.com/push',
            keys: { p256dh: '', auth: 'valid_auth' },
          }).success,
          false
        );
        assert.strictEqual(
          SubscribePushSchema.safeParse({
            endpoint: 'https://example.com/push',
            keys: { p256dh: 'k'.repeat(256), auth: 'valid_auth' },
          }).success,
          false
        );
      });

      it('strictly rejects mass-assignment injection', () => {
        assert.strictEqual(
          SubscribePushSchema.safeParse({
            endpoint: 'https://example.com/push',
            keys: { p256dh: 'abc', auth: 'def' },
            userId: 'usr_spoofed',
          }).success,
          false
        );
      });
    });

    describe('TestPushSchema', () => {
      it('accepts valid test push payload within limits', () => {
        const parsed = TestPushSchema.parse({
          title: 'Thông báo thử nghiệm',
          body: 'Nội dung kiểm tra tính năng Web Push trên QCET E-Office',
        });
        assert.strictEqual(parsed.title, 'Thông báo thử nghiệm');
      });

      it('rejects title > 100 or body > 255 characters', () => {
        assert.strictEqual(
          TestPushSchema.safeParse({ title: 'T'.repeat(101) }).success,
          false
        );
        assert.strictEqual(
          TestPushSchema.safeParse({ body: 'B'.repeat(256) }).success,
          false
        );
      });

      it('strictly rejects extra unallowed fields', () => {
        assert.strictEqual(
          TestPushSchema.safeParse({
            title: 'Test',
            broadcastToAll: true,
          }).success,
          false
        );
      });
    });
  });

  describe('Users Contracts (src/contracts/users.ts)', () => {
    describe('UserQuerySchema', () => {
      it('parses valid user query parameters', () => {
        const parsed = UserQuerySchema.parse({
          page: '1',
          pageSize: '10',
          departmentId: 'dept_cntt',
          role: 'GIANG_VIEN',
          q: 'Nguyễn',
        });
        assert.strictEqual(parsed.page, 1);
        assert.strictEqual(parsed.pageSize, 10);
        assert.strictEqual(parsed.departmentId, 'dept_cntt');
        assert.strictEqual(parsed.q, 'Nguyễn');
      });
    });

    describe('UpdateUserRoleSchema', () => {
      it('accepts valid institutional user roles', () => {
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'ADMIN' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'MANAGER' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'STAFF' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'BAN_GIAM_HIEU' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'TRUONG_PHONG' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'CHUYEN_VIEN' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'GIANG_VIEN' }).success,
          true
        );
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'VAN_THU' }).success,
          true
        );
      });

      it('rejects invalid or unauthorized roles', () => {
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({ role: 'SUPERUSER_ROOT' }).success,
          false
        );
      });

      it('strictly rejects extra injection fields', () => {
        assert.strictEqual(
          UpdateUserRoleSchema.safeParse({
            role: 'ADMIN',
            passwordHash: 'injected_hash',
          }).success,
          false
        );
      });
    });

    describe('OnboardingInputSchema', () => {
      it('accepts valid onboarding state updates matching onboarding-schema.ts', () => {
        const parsed = OnboardingInputSchema.parse({
          hasSeenWelcome: true,
          hasCompletedTour: true,
          completedSteps: ['step-profile', 'step-push'],
          isDismissed: false,
          snoozedUntil: null,
        });
        assert.strictEqual(parsed.hasSeenWelcome, true);
        assert.deepStrictEqual(parsed.completedSteps, ['step-profile', 'step-push']);
      });

      it('rejects completedSteps list exceeding 50 items or step exceeding 100 characters', () => {
        const tooManySteps = Array.from({ length: 51 }, (_, i) => `step-${i}`);
        assert.strictEqual(
          OnboardingInputSchema.safeParse({ completedSteps: tooManySteps }).success,
          false
        );

        assert.strictEqual(
          OnboardingInputSchema.safeParse({
            completedSteps: ['s'.repeat(101)],
          }).success,
          false
        );
      });

      it('strictly rejects arbitrary mass-assignment injections', () => {
        assert.strictEqual(
          OnboardingInputSchema.safeParse({
            hasSeenWelcome: true,
            isAdmin: true,
            role: 'ADMIN',
          }).success,
          false
        );
      });
    });
  });
});
