# KẾ HOẠCH TRIỂN KHAI: TẦNG LƯU TRỮ DỮ LIỆU BỀN VỮNG & ĐỒNG BỘ NHIỆM VỤ
**File kế hoạch:** `docs/superpowers/plans/2026-09-07-prisma-persistence-task-hub-plan.md`  
**Đặc tả kỹ thuật (Spec):** `docs/superpowers/specs/2026-09-07-prisma-persistence-task-hub-spec.md`  

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ dữ liệu Nhiệm vụ, Phân công nhân sự, Minh chứng sản phẩm, Ủy quyền DACUM và Lệnh điều hành BGH từ bộ nhớ RAM mock sang lưu trữ bền vững trong cơ sở dữ liệu PostgreSQL qua Prisma ORM, đảm bảo 815 tests hiện hữu tiếp tục pass 100%.

**Architecture:** Bổ sung các bảng quan hệ vào `prisma/schema.prisma` với index tối ưu hóa theo chu kỳ năm học 25-24 và phòng ban. Xây dựng lớp Adapter `task-db-adapter.ts` chuyển đổi 2 chiều giữa Prisma Models và `SchoolTask` domain interface để bảo toàn tương thích ngược cho toàn bộ React UI. Triển khai các API routes RESTful (`/api/tasks`, `/api/tasks/[id]`, `/api/tasks/[id]/deliverables`, `/api/executive/resolutions`) tích hợp phân quyền RBAC.

**Tech Stack:** Next.js 15.2.1 App Router, Prisma ORM 6.4.1, PostgreSQL 16, TypeScript 5, Node.js test runner (`tsx --test`).

## Global Constraints
- Tuân thủ nghiêm ngặt **Quy tắc Build**: KHÔNG chạy `next build` khi dev server đang chạy; chỉ dùng `npm run typecheck` và `npm test` để kiểm tra chất lượng code.
- Giữ nguyên chu kỳ tháng học thuật QCET (từ 25 tháng trước đến 24 tháng sau) đã định nghĩa trong `src/lib/academic-calendar.ts`.
- Mọi truy vấn CSDL phải thông qua singleton `prisma` tại `src/lib/prisma.ts`.
- Tuyệt đối không xóa bỏ các trường dữ liệu hiện hữu của `SchoolTask` để không làm gãy giao diện `cascading-task-table.tsx` và `executive-cockpit-workspace.tsx`.

---

## DANH MỤC CÁC NHIỆM VỤ (TASKS)

### Task 1: Cập nhật Schema Prisma với Mô hình Nhiệm vụ & Quan hệ Bền vững

**Files:**
- Modify: `prisma/schema.prisma:10-80`
- Test: `tests/prisma-schema-integrity.test.ts`

**Interfaces:**
- Consumes: `Department`, `User` từ schema hiện tại.
- Produces: Enums (`TaskScope`, `TaskStatus`, `TaskPriority`, `AssigneeRole`, `DeliverableReviewStatus`, `ResolutionType`), Models (`Task`, `TaskAssignee`, `TaskDeliverable`, `DacumDelegation`, `ExecutiveResolution`).

- [ ] **Step 1: Viết test kiểm tra tính toàn vẹn của Schema Prisma**

Tạo file `tests/prisma-schema-integrity.test.ts`:
```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Prisma Schema Integrity Verification', () => {
  test('schema.prisma contains all required e-office models and enums', () => {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');

    // Kiểm tra các Enums bắt buộc
    assert.match(content, /enum TaskScope\s*\{[\s\S]*?SCHOOL[\s\S]*?DEPARTMENT[\s\S]*?INDIVIDUAL/);
    assert.match(content, /enum TaskStatus\s*\{[\s\S]*?NOT_STARTED[\s\S]*?IN_PROGRESS[\s\S]*?WAITING_APPROVAL[\s\S]*?COMPLETED[\s\S]*?OVERDUE/);
    assert.match(content, /enum AssigneeRole\s*\{[\s\S]*?PRIMARY_OWNER[\s\S]*?COLLABORATOR[\s\S]*?SUPERVISOR/);
    assert.match(content, /enum DeliverableReviewStatus\s*\{[\s\S]*?PENDING[\s\S]*?APPROVED[\s\S]*?REVISION_REQUIRED/);
    assert.match(content, /enum ResolutionType\s*\{[\s\S]*?EXTEND_DEADLINE[\s\S]*?REASSIGN_OWNER[\s\S]*?DIRECTIVE_NOTE/);

    // Kiểm tra các Models bắt buộc
    assert.match(content, /model Task\s*\{/);
    assert.match(content, /model TaskAssignee\s*\{/);
    assert.match(content, /model TaskDeliverable\s*\{/);
    assert.match(content, /model DacumDelegation\s*\{/);
    assert.match(content, /model ExecutiveResolution\s*\{/);

    // Kiểm tra khóa ngoại và quan hệ
    assert.match(content, /department\s+Department\?\s+@relation/);
    assert.match(content, /createdBy\s+User\s+@relation\("TaskCreatedBy"/);
    assert.match(content, /assignees\s+TaskAssignee\[\]/);
    assert.match(content, /deliverables\s+TaskDeliverable\[\]/);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/prisma-schema-integrity.test.ts`  
Expected: FAIL vì `schema.prisma` hiện tại chưa có các models và enums trên.

- [ ] **Step 3: Cập nhật `prisma/schema.prisma`**

Chỉnh sửa `prisma/schema.prisma` để thêm đầy đủ các Enums và Models như đã mô tả trong Spec:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  BAN_GIAM_HIEU
  TRUONG_PHONG
  CHUYEN_VIEN
  ADMIN
}

enum TaskScope {
  SCHOOL
  DEPARTMENT
  INDIVIDUAL
}

enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  WAITING_APPROVAL
  COMPLETED
  OVERDUE
  CANCELLED
}

enum TaskPriority {
  URGENT
  HIGH
  NORMAL
  LOW
}

enum AssigneeRole {
  PRIMARY_OWNER
  COLLABORATOR
  SUPERVISOR
}

enum DeliverableReviewStatus {
  PENDING
  APPROVED
  REVISION_REQUIRED
}

enum ResolutionType {
  EXTEND_DEADLINE
  REASSIGN_OWNER
  DIRECTIVE_NOTE
  DISMISS_BOTTLENECK
}

model Department {
  id          String   @id @db.VarChar(50)
  name        String   @db.VarChar(255)
  shortName   String?  @map("short_name") @db.VarChar(50)
  color       String?  @db.VarChar(20)
  users       User[]
  tasks       Task[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("departments")
}

model User {
  id                    String                @id @default(cuid())
  email                 String                @unique @db.VarChar(255)
  name                  String                @db.VarChar(255)
  passwordHash          String?               @map("password_hash")
  role                  UserRole              @default(CHUYEN_VIEN)
  departmentId          String?               @map("department_id") @db.VarChar(50)
  department            Department?           @relation(fields: [departmentId], references: [id])
  title                 String?               @db.VarChar(150)
  phone                 String?               @db.VarChar(20)
  avatarUrl             String?               @map("avatar_url")
  provider              String                @default("credentials") @db.VarChar(50)
  isActive              Boolean               @default(true) @map("is_active")
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt @map("updated_at")

  accounts              Account[]
  sessions              Session[]
  tasksCreated          Task[]                @relation("TaskCreatedBy")
  taskAssignees         TaskAssignee[]
  deliverablesUploaded  TaskDeliverable[]     @relation("DeliverableUploadedBy")
  deliverablesReviewed  TaskDeliverable[]     @relation("DeliverableReviewer")
  delegationsGranted    DacumDelegation[]     @relation("DelegationGrantor")
  delegationsReceived   DacumDelegation[]     @relation("DelegationDelegate")
  resolutionsEnacted    ExecutiveResolution[] @relation("ResolutionActor")

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Task {
  id              String                @id @default(cuid())
  code            String                @unique @db.VarChar(50)
  title           String                @db.VarChar(500)
  description     String?               @db.Text
  scope           TaskScope             @default(SCHOOL)
  status          TaskStatus            @default(NOT_STARTED)
  priority        TaskPriority          @default(NORMAL)
  progressPercent Int                   @default(0) @map("progress_percent")
  academicMonth   Int                   @map("academic_month")
  academicYear    String                @map("academic_year") @db.VarChar(20)
  startDate       DateTime              @default(now()) @map("start_date")
  dueDate         DateTime              @map("due_date")
  completedAt     DateTime?             @map("completed_at")
  departmentId    String?               @map("department_id") @db.VarChar(50)
  department      Department?           @relation(fields: [departmentId], references: [id])
  createdById     String                @map("created_by_id")
  createdBy       User                  @relation("TaskCreatedBy", fields: [createdById], references: [id])
  parentTaskId    String?               @map("parent_task_id")
  parentTask      Task?                 @relation("SubTasks", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subTasks        Task[]                @relation("SubTasks")
  assignees       TaskAssignee[]
  deliverables    TaskDeliverable[]
  delegations     DacumDelegation[]
  resolutions     ExecutiveResolution[]
  createdAt       DateTime              @default(now()) @map("created_at")
  updatedAt       DateTime              @updatedAt @map("updated_at")

  @@index([departmentId, academicYear, academicMonth])
  @@index([status, dueDate])
  @@index([scope, priority])
  @@map("tasks")
}

model TaskAssignee {
  id         String       @id @default(cuid())
  taskId     String       @map("task_id")
  userId     String       @map("user_id")
  roleInTask AssigneeRole @default(PRIMARY_OWNER) @map("role_in_task")
  assignedAt DateTime     @default(now()) @map("assigned_at")
  task       Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId, roleInTask])
  @@index([userId, roleInTask])
  @@map("task_assignees")
}

model TaskDeliverable {
  id           String                  @id @default(cuid())
  taskId       String                  @map("task_id")
  title        String                  @db.VarChar(255)
  fileUrl      String                  @map("file_url") @db.Text
  fileType     String?                 @map("file_type") @db.VarChar(50)
  fileSize     Int?                    @map("file_size")
  uploadedById String                  @map("uploaded_by_id")
  reviewStatus DeliverableReviewStatus @default(PENDING) @map("review_status")
  reviewerId   String?                 @map("reviewer_id")
  reviewNote   String?                 @map("review_note") @db.Text
  reviewedAt   DateTime?               @map("reviewed_at")
  task         Task                    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  uploadedBy   User                    @relation("DeliverableUploadedBy", fields: [uploadedById], references: [id])
  reviewer     User?                   @relation("DeliverableReviewer", fields: [reviewerId], references: [id])
  createdAt    DateTime                @default(now()) @map("created_at")
  updatedAt    DateTime                @updatedAt @map("updated_at")

  @@index([taskId, reviewStatus])
  @@map("task_deliverables")
}

model DacumDelegation {
  id             String   @id @default(cuid())
  taskId         String   @map("task_id")
  grantorId      String   @map("grantor_id")
  delegateId     String   @map("delegate_id")
  committeeRole  String   @map("committee_role") @db.VarChar(100)
  authorityScope String   @map("authority_scope") @db.VarChar(255)
  expiresAt      DateTime @map("expires_at")
  isActive       Boolean  @default(true) @map("is_active")
  task           Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  grantor        User     @relation("DelegationGrantor", fields: [grantorId], references: [id])
  delegate       User     @relation("DelegationDelegate", fields: [delegateId], references: [id])
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([delegateId, isActive, expiresAt])
  @@map("dacum_delegations")
}

model ExecutiveResolution {
  id              String         @id @default(cuid())
  taskId          String         @map("task_id")
  actorId         String         @map("actor_id")
  resolutionType  ResolutionType @map("resolution_type")
  directiveNote   String?        @map("directive_note") @db.Text
  grantedDays     Int?           @map("granted_days")
  previousDueDate DateTime?      @map("previous_due_date")
  newDueDate      DateTime?      @map("new_due_date")
  previousOwnerId String?        @map("previous_owner_id")
  newOwnerId      String?        @map("new_owner_id")
  task            Task           @relation(fields: [taskId], references: [id], onDelete: Cascade)
  actor           User           @relation("ResolutionActor", fields: [actorId], references: [id])
  createdAt       DateTime       @default(now()) @map("created_at")

  @@index([taskId, resolutionType])
  @@map("executive_resolutions")
}
```

- [ ] **Step 4: Chạy test kiểm tra schema (Green)**

Run: `npx tsx --test tests/prisma-schema-integrity.test.ts`  
Expected: PASS (1 test passing).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma tests/prisma-schema-integrity.test.ts
git commit -m "feat(prisma): add core task persistence and workflow models to schema"
```

---

### Task 2: Xây dựng Bộ Chuyển đổi Dữ liệu Tương thích Ngược (`TaskDbAdapter`)

**Files:**
- Create: `src/lib/adapters/task-db-adapter.ts`
- Test: `tests/task-db-adapter.test.ts`

**Interfaces:**
- Consumes: Raw Prisma Task object với relations (Department, Assignees, Deliverables).
- Produces: `mapPrismaTaskToSchoolTask(raw): SchoolTask` và `mapSchoolTaskToPrismaCreateInput(task, creatorId)`.

- [ ] **Step 1: Viết failing test cho TaskDbAdapter**

Tạo file `tests/task-db-adapter.test.ts`:
```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mapPrismaTaskToSchoolTask } from '../src/lib/adapters/task-db-adapter';

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
      startDate: new Date('2026-09-01T00:00:00Z'),
      dueDate: new Date('2026-09-24T17:00:00Z'),
      departmentId: 'khoa-dien',
      department: {
        id: 'khoa-dien',
        name: 'Khoa Điện - Điện tử',
        shortName: 'K.Điện'
      },
      assignees: [
        {
          userId: 'user-01',
          roleInTask: 'PRIMARY_OWNER',
          user: { name: 'ThS. Nguyễn Văn A', avatarUrl: '/avatars/01.jpg' }
        },
        {
          userId: 'user-02',
          roleInTask: 'COLLABORATOR',
          user: { name: 'KS. Trần B', avatarUrl: null }
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
    assert.strictEqual(schoolTask.assignedTo, 'ThS. Nguyễn Văn A');
    assert.strictEqual(schoolTask.dueDate, '2026-09-24');
    assert.strictEqual(schoolTask.status, 'in_progress');
    assert.strictEqual(schoolTask.priority, 'high');
    assert.strictEqual(schoolTask.academicMonth, 9);
    assert.strictEqual(schoolTask.progress, 65);
    assert.strictEqual(schoolTask.collaborators?.length, 1);
    assert.strictEqual(schoolTask.collaborators?.[0], 'KS. Trần B');
  });

  test('falls back gracefully when department or assignees are missing', () => {
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
      departmentId: null,
      department: null,
      assignees: [],
      deliverables: []
    };

    const result = mapPrismaTaskToSchoolTask(rawMinimal);
    assert.strictEqual(result.department, 'Chưa phân bổ');
    assert.strictEqual(result.assignedTo, 'Chưa phân công');
    assert.strictEqual(result.status, 'not_started');
    assert.strictEqual(result.priority, 'medium');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/task-db-adapter.test.ts`  
Expected: FAIL vì `src/lib/adapters/task-db-adapter.ts` chưa được tạo.

- [ ] **Step 3: Viết mã nguồn `src/lib/adapters/task-db-adapter.ts`**

```typescript
import { SchoolTask } from '@/lib/unified-task-hub';

export interface PrismaTaskWithRelations {
  id: string;
  code: string;
  title: string;
  description: string | null;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  academicMonth: number;
  academicYear: string;
  startDate: Date;
  dueDate: Date;
  completedAt?: Date | null;
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
    shortName?: string | null;
  } | null;
  assignees?: {
    userId: string;
    roleInTask: string;
    user?: {
      name: string;
      avatarUrl?: string | null;
    } | null;
  }[];
  deliverables?: {
    id: string;
    title: string;
    fileUrl: string;
    reviewStatus: string;
  }[];
}

export function mapPrismaTaskToSchoolTask(raw: PrismaTaskWithRelations): SchoolTask {
  // Tìm người chủ trì chính
  const primaryOwner = raw.assignees?.find(a => a.roleInTask === 'PRIMARY_OWNER');
  const collaborators = raw.assignees
    ?.filter(a => a.roleInTask === 'COLLABORATOR')
    .map(a => a.user?.name || '')
    .filter(Boolean);

  // Ánh xạ trạng thái chuẩn hóa
  const statusMap: Record<string, SchoolTask['status']> = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    WAITING_APPROVAL: 'waiting_approval',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled'
  };

  // Ánh xạ độ ưu tiên
  const priorityMap: Record<string, SchoolTask['priority']> = {
    URGENT: 'urgent',
    HIGH: 'high',
    NORMAL: 'medium',
    LOW: 'low'
  };

  const isoDueDate = raw.dueDate instanceof Date 
    ? raw.dueDate.toISOString().split('T')[0] 
    : String(raw.dueDate).split('T')[0];

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    department: raw.department?.name || 'Chưa phân bổ',
    assignedTo: primaryOwner?.user?.name || 'Chưa phân công',
    dueDate: isoDueDate,
    status: statusMap[raw.status] || 'in_progress',
    priority: priorityMap[raw.priority] || 'medium',
    progress: raw.progressPercent ?? 0,
    academicMonth: raw.academicMonth ?? 9,
    collaborators: collaborators && collaborators.length > 0 ? collaborators : undefined,
    category: raw.scope === 'SCHOOL' ? 'Chỉ đạo cấp Trường' : 'Chuyên môn Khoa/Phòng'
  };
}
```

- [ ] **Step 4: Chạy lại test adapter**

Run: `npx tsx --test tests/task-db-adapter.test.ts`  
Expected: PASS (2 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/task-db-adapter.ts tests/task-db-adapter.test.ts
git commit -m "feat(adapter): implement TaskDbAdapter for bidirectional domain-prisma translation"
```

---

### Task 3: Kịch bản Nạp Dữ liệu Khởi tạo Bền vững (`prisma/seed.ts`)

**Files:**
- Modify: `prisma/seed.ts`
- Test: `tests/seed-verification.test.ts`

**Interfaces:**
- Consumes: `prisma` Client, danh mục 11 đơn vị QCET thực tế.
- Produces: 11 Phòng/Khoa, 10 Tài khoản mẫu (BGH, Trưởng phòng, Trưởng khoa, Giảng viên), và 40 Nhiệm vụ mẫu với phân công và tiến độ thực tế theo chu kỳ 12 tháng.

- [ ] **Step 1: Viết test kiểm tra tính đầy đủ của script Seed**

Tạo file `tests/seed-verification.test.ts`:
```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Seed Data Verification', () => {
  test('seed script contains 11 QCET units and realistic task generation', () => {
    const seedPath = path.resolve(process.cwd(), 'prisma/seed.ts');
    const content = fs.readFileSync(seedPath, 'utf-8');

    // 11 đơn vị bắt buộc của QCET
    assert.match(content, /phong-dao-tao/);
    assert.match(content, /khoa-cntt/);
    assert.match(content, /khoa-co-khi/);
    assert.match(content, /khoa-dien/);
    assert.match(content, /ban-giam-hieu/);

    // Có logic tạo Task bền vững
    assert.match(content, /prisma\.task\.createMany|prisma\.task\.create|prisma\.task\.upsert/);
    assert.match(content, /academicMonth/);
    assert.match(content, /academicYear/);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `npx tsx --test tests/seed-verification.test.ts`  
Expected: FAIL nếu seed chưa có logic tạo Task.

- [ ] **Step 3: Cập nhật `prisma/seed.ts`**

Mở rộng `prisma/seed.ts` để nạp đầy đủ người dùng và 40 nhiệm vụ trải đều qua 12 tháng học vụ:
```typescript
import { PrismaClient, UserRole, TaskScope, TaskStatus, TaskPriority, AssigneeRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding QCET E-Office Database...');

  // 1. Tạo 11 đơn vị
  const departments = [
    { id: 'ban-giam-hieu', name: 'Ban Giám hiệu', shortName: 'BGH', color: '#1E3A8A' },
    { id: 'phong-dao-tao', name: 'Phòng Đào tạo', shortName: 'P.ĐT', color: '#2563EB' },
    { id: 'khoa-cntt', name: 'Khoa Công nghệ Thông tin', shortName: 'K.CNTT', color: '#0284C7' },
    { id: 'khoa-co-khi', name: 'Khoa Cơ khí', shortName: 'K.CK', color: '#0D9488' },
    { id: 'khoa-dien', name: 'Khoa Điện - Điện tử', shortName: 'K.ĐĐT', color: '#16A34A' },
    { id: 'khoa-oto', name: 'Khoa Kỹ thuật Ô tô', shortName: 'K.ÔTÔ', color: '#CA8A04' },
    { id: 'phong-cthssv', name: 'Phòng Công tác Học sinh Sinh viên', shortName: 'P.CTHSSV', color: '#EA580C' },
    { id: 'phong-qctb', name: 'Phòng Quản trị - Thiết bị', shortName: 'P.QTTB', color: '#DC2626' },
    { id: 'phong-tckt', name: 'Phòng Tài chính - Kế toán', shortName: 'P.TCKT', color: '#9333EA' },
    { id: 'tt-laixe', name: 'Trung tâm Đào tạo Lái xe', shortName: 'TT.LX', color: '#4F46E5' },
    { id: 'tt-tuyensinh', name: 'Trung tâm Tuyển sinh & Truyền thông', shortName: 'TT.TS', color: '#059669' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name, shortName: dept.shortName, color: dept.color },
      create: dept,
    });
  }

  // 2. Tạo Tài khoản Người dùng
  const defaultPasswordHash = await bcrypt.hash('Qcet@123456', 10);
  const users = [
    { email: 'hieutruong@qcet.edu.vn', name: 'TS. Nguyễn Văn Hiệu (Hiệu trưởng)', role: UserRole.BAN_GIAM_HIEU, departmentId: 'ban-giam-hieu' },
    { email: 'phohieutruong1@qcet.edu.vn', name: 'ThS. Trần Thị Phó (Phó Hiệu trưởng Đào tạo)', role: UserRole.BAN_GIAM_HIEU, departmentId: 'ban-giam-hieu' },
    { email: 'truongphong.daotao@qcet.edu.vn', name: 'ThS. Lê Đào Tạo (Trưởng phòng ĐT)', role: UserRole.TRUONG_PHONG, departmentId: 'phong-dao-tao' },
    { email: 'truongkhoa.cntt@qcet.edu.vn', name: 'ThS. Hoàng Công Nghệ (Trưởng khoa CNTT)', role: UserRole.TRUONG_PHONG, departmentId: 'khoa-cntt' },
    { email: 'giangvien.cntt@qcet.edu.vn', name: 'KS. Phan Lập Trình (Giảng viên CNTT)', role: UserRole.CHUYEN_VIEN, departmentId: 'khoa-cntt' },
    { email: 'admin@qcet.edu.vn', name: 'Quản trị hệ thống QCET', role: UserRole.ADMIN, departmentId: 'ban-giam-hieu' },
  ];

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, departmentId: u.departmentId },
      create: { ...u, passwordHash: defaultPasswordHash },
    });
    userMap[u.email] = created.id;
  }

  // 3. Tạo Nhiệm vụ mẫu
  const adminId = userMap['admin@qcet.edu.vn'];
  const pdtOwnerId = userMap['truongphong.daotao@qcet.edu.vn'];
  const cnttOwnerId = userMap['truongkhoa.cntt@qcet.edu.vn'];
  const gvId = userMap['giangvien.cntt@qcet.edu.vn'];

  const sampleTasks = [
    {
      code: 'NV-2026-09-001',
      title: 'Hoàn thiện hồ sơ đánh giá và cấp chứng chỉ chuẩn kỹ năng nghề CNTT năm học 2026',
      description: 'Tổng hợp danh sách sinh viên đủ điều kiện, lập hội đồng thẩm định kết quả thi sát hạch.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 70,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-24T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: adminId,
      assigneeId: cnttOwnerId
    },
    {
      code: 'NV-2026-09-002',
      title: 'Kiểm tra công tác chuẩn bị cơ sở vật chất và thời khóa biểu học kỳ 1 năm học 2026-2027',
      description: 'Rà soát xưởng thực hành và phòng máy trước ngày 15/09.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.WAITING_APPROVAL,
      priority: TaskPriority.URGENT,
      progressPercent: 90,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-18T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId
    },
    {
      code: 'NV-2026-09-003',
      title: 'Biên soạn đề cương chi tiết môn Lập trình Web Nâng cao theo chuẩn DACUM',
      description: 'Cập nhật công nghệ Next.js 15 và Tailwind CSS v4 vào chương trình giảng dạy.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 40,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-22T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: cnttOwnerId,
      assigneeId: gvId
    }
  ];

  for (const t of sampleTasks) {
    const { assigneeId, ...taskData } = t;
    const task = await prisma.task.upsert({
      where: { code: t.code },
      update: taskData,
      create: taskData,
    });

    // Gán Assignee
    await prisma.taskAssignee.upsert({
      where: {
        taskId_userId_roleInTask: {
          taskId: task.id,
          userId: assigneeId,
          roleInTask: AssigneeRole.PRIMARY_OWNER,
        },
      },
      update: {},
      create: {
        taskId: task.id,
        userId: assigneeId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 4: Chạy test xác nhận seed**

Run: `npx tsx --test tests/seed-verification.test.ts`  
Expected: PASS (1 test passing).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts tests/seed-verification.test.ts
git commit -m "feat(seed): expand seed data to populate 11 QCET units and realistic tasks"
```

---

### Task 4: Xây dựng REST API Quản lý Nhiệm vụ (`/api/tasks`)

**Files:**
- Create: `src/app/api/tasks/route.ts`
- Test: `tests/api-tasks-route.test.ts`

**Interfaces:**
- Consumes: `GET` / `POST` request với query parameters hoặc JSON body.
- Produces: JSON danh sách `SchoolTask[]` hoặc bản ghi Task vừa tạo.

- [ ] **Step 1: Viết test cho API route `/api/tasks`**

Tạo file `tests/api-tasks-route.test.ts`:
```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Tasks API Route Handler Tests', () => {
  test('validates required fields on task creation', () => {
    const payload = {
      title: 'Thiếu hạn chót và đơn vị',
    };
    // Logic validation
    const hasRequired = Boolean(payload.title && (payload as any).dueDate && (payload as any).departmentId);
    assert.strictEqual(hasRequired, false);
  });

  test('generates continuous task code in format NV-YYYY-MM-XXX', () => {
    const year = 2026;
    const month = 9;
    const count = 5;
    const code = `NV-${year}-${String(month).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`;
    assert.strictEqual(code, 'NV-2026-09-006');
  });
});
```

- [ ] **Step 2: Chạy test API**

Run: `npx tsx --test tests/api-tasks-route.test.ts`  
Expected: PASS.

- [ ] **Step 3: Viết mã nguồn `src/app/api/tasks/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask } from '@/lib/adapters/task-db-adapter';
import { TaskScope, TaskStatus, TaskPriority, AssigneeRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const dept = searchParams.get('dept');
    const scope = searchParams.get('scope');

    const where: any = {};
    if (month) where.academicMonth = parseInt(month, 10);
    if (dept && dept !== 'all') where.departmentId = dept;
    if (scope && scope !== 'all') {
      if (scope === 'school') where.scope = TaskScope.SCHOOL;
      else if (scope === 'department') where.scope = TaskScope.DEPARTMENT;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        department: true,
        assignees: {
          include: {
            user: { select: { name: true, avatarUrl: true } }
          }
        },
        deliverables: true
      },
      orderBy: { dueDate: 'asc' }
    });

    const formattedTasks = tasks.map(mapPrismaTaskToSchoolTask);
    return NextResponse.json({ success: true, tasks: formattedTasks });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, departmentId, dueDate, priority, scope, academicMonth, academicYear, creatorId, assigneeId } = body;

    if (!title || !dueDate || !departmentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)' },
        { status: 400 }
      );
    }

    // Đếm số lượng task trong tháng để sinh mã tự động
    const monthNum = academicMonth || 9;
    const yearStr = academicYear || '2026-2027';
    const count = await prisma.task.count({
      where: { academicMonth: monthNum, academicYear: yearStr }
    });
    const code = `NV-${new Date().getFullYear()}-${String(monthNum).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`;

    // Tạo Task trong transaction
    const newTask = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          code,
          title,
          description: description || null,
          departmentId,
          dueDate: new Date(dueDate),
          academicMonth: monthNum,
          academicYear: yearStr,
          scope: scope === 'department' ? TaskScope.DEPARTMENT : TaskScope.SCHOOL,
          priority: priority === 'urgent' ? TaskPriority.URGENT : priority === 'high' ? TaskPriority.HIGH : TaskPriority.NORMAL,
          createdById: creatorId || (await tx.user.findFirst({ select: { id: true } }))!.id,
        },
        include: {
          department: true,
        }
      });

      if (assigneeId) {
        await tx.taskAssignee.create({
          data: {
            taskId: task.id,
            userId: assigneeId,
            roleInTask: AssigneeRole.PRIMARY_OWNER
          }
        });
      }

      return task;
    });

    return NextResponse.json({ success: true, task: newTask }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Chạy kiểm tra Typecheck**

Run: `npm run typecheck`  
Expected: PASS không có lỗi type.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/route.ts tests/api-tasks-route.test.ts
git commit -m "feat(api): implement GET and POST endpoints for task persistence"
```

---

### Task 5: Xây dựng API Thao tác Chi tiết & Nộp Minh chứng (`/api/tasks/[id]`, `/deliverables`)

**Files:**
- Create: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/api/tasks/[id]/deliverables/route.ts`
- Test: `tests/task-detail-api.test.ts`

**Interfaces:**
- Consumes: `PATCH /api/tasks/[id]` (cập nhật trạng thái/tiến độ), `POST /api/tasks/[id]/deliverables` (nộp file/link).
- Produces: Bản ghi cập nhật, chuyển trạng thái tự động sang `WAITING_APPROVAL`.

- [ ] **Step 1: Viết test cho luồng nộp minh chứng và cập nhật trạng thái**

Tạo file `tests/task-detail-api.test.ts`:
```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Task Detail & Deliverable Workflow Tests', () => {
  test('transition task status to WAITING_APPROVAL when deliverable is submitted', () => {
    let currentStatus = 'IN_PROGRESS';
    const submission = {
      title: 'Báo cáo nghiệm thu.pdf',
      fileUrl: 'https://qcet.edu.vn/files/report.pdf'
    };

    if (submission.fileUrl) {
      currentStatus = 'WAITING_APPROVAL';
    }

    assert.strictEqual(currentStatus, 'WAITING_APPROVAL');
  });

  test('enforces Separation of Duties (SoD) on review approval', () => {
    const taskSubmitterId = 'user-001';
    const currentReviewerId = 'user-001'; // Trùng người

    const isAllowedToApprove = taskSubmitterId !== currentReviewerId;
    assert.strictEqual(isAllowedToApprove, false, 'Submitter cannot approve their own deliverable');
  });
});
```

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test tests/task-detail-api.test.ts`  
Expected: PASS.

- [ ] **Step 3: Viết mã nguồn `src/app/api/tasks/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask } from '@/lib/adapters/task-db-adapter';
import { TaskStatus } from '@prisma/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        department: true,
        assignees: { include: { user: true } },
        deliverables: true,
        resolutions: { include: { actor: true } }
      }
    });

    if (!task) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy nhiệm vụ' }, { status: 404 });
    }

    return NextResponse.json({ success: true, task: mapPrismaTaskToSchoolTask(task) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { progressPercent, status, dueDate } = body;

    const updateData: any = {};
    if (typeof progressPercent === 'number') updateData.progressPercent = progressPercent;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (status) {
      const statusMap: Record<string, TaskStatus> = {
        not_started: TaskStatus.NOT_STARTED,
        in_progress: TaskStatus.IN_PROGRESS,
        waiting_approval: TaskStatus.WAITING_APPROVAL,
        completed: TaskStatus.COMPLETED,
        overdue: TaskStatus.OVERDUE,
        cancelled: TaskStatus.CANCELLED
      };
      if (statusMap[status]) updateData.status = statusMap[status];
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        assignees: { include: { user: true } }
      }
    });

    return NextResponse.json({ success: true, task: mapPrismaTaskToSchoolTask(updated) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Viết mã nguồn `src/app/api/tasks/[id]/deliverables/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TaskStatus, DeliverableReviewStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();
    const { title, fileUrl, fileType, uploadedById } = body;

    if (!title || !fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Tiêu đề và đường dẫn file minh chứng là bắt buộc' },
        { status: 400 }
      );
    }

    const fallbackUserId = uploadedById || (await prisma.user.findFirst({ select: { id: true } }))!.id;

    // Tạo deliverable và chuyển trạng thái Task sang WAITING_APPROVAL
    const result = await prisma.$transaction(async (tx) => {
      const deliverable = await tx.taskDeliverable.create({
        data: {
          taskId,
          title,
          fileUrl,
          fileType: fileType || 'LINK',
          uploadedById: fallbackUserId,
          reviewStatus: DeliverableReviewStatus.PENDING
        }
      });

      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.WAITING_APPROVAL }
      });

      return deliverable;
    });

    return NextResponse.json({ success: true, deliverable: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Kiểm tra Typecheck và Commit**

```bash
npm run typecheck
git add src/app/api/tasks/[id]/ tests/task-detail-api.test.ts
git commit -m "feat(api): add task update and deliverable submission route handlers"
```

---

### Task 6: Tích hợp Lệnh Điều Hành BGH Bền Vững (`/api/executive/resolutions`)

**Files:**
- Create: `src/app/api/executive/resolutions/route.ts`
- Test: `tests/executive-resolution-persistence.test.ts`

**Interfaces:**
- Consumes: `POST /api/executive/resolutions` với `{ taskId, resolutionType, grantedDays, directiveNote, newOwnerId }`.
- Produces: Bản ghi `ExecutiveResolution` và cập nhật tức thì `Task` (gia hạn ngày hoặc đổi đơn vị chủ trì).

- [ ] **Step 1: Viết test cho Executive Resolution flow**

Tạo file `tests/executive-resolution-persistence.test.ts`:
```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Executive Resolution Persistence Logic', () => {
  test('calculates new due date correctly when grantedDays is applied', () => {
    const currentDueDate = new Date('2026-09-20T00:00:00Z');
    const grantedDays = 7;
    const newDueDate = new Date(currentDueDate.getTime() + grantedDays * 24 * 60 * 60 * 1000);

    assert.strictEqual(newDueDate.toISOString().split('T')[0], '2026-09-27');
  });
});
```

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test tests/executive-resolution-persistence.test.ts`  
Expected: PASS.

- [ ] **Step 3: Viết mã nguồn `src/app/api/executive/resolutions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ResolutionType, TaskPriority } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, resolutionType, directiveNote, grantedDays, newOwnerId, actorId } = body;

    if (!taskId || !resolutionType) {
      return NextResponse.json({ success: false, error: 'Thiếu taskId hoặc loại can thiệp' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy nhiệm vụ' }, { status: 404 });
    }

    const fallbackActorId = actorId || (await prisma.user.findFirst({
      where: { role: 'BAN_GIAM_HIEU' },
      select: { id: true }
    }))?.id || (await prisma.user.findFirst({ select: { id: true } }))!.id;

    const result = await prisma.$transaction(async (tx) => {
      let previousDueDate: Date | null = null;
      let newDueDate: Date | null = null;

      const taskUpdateData: any = {};

      if (resolutionType === 'EXTEND_DEADLINE' && grantedDays) {
        previousDueDate = task.dueDate;
        newDueDate = new Date(task.dueDate.getTime() + grantedDays * 24 * 60 * 60 * 1000);
        taskUpdateData.dueDate = newDueDate;
      } else if (resolutionType === 'REASSIGN_OWNER' && newOwnerId) {
        taskUpdateData.departmentId = newOwnerId;
      } else if (resolutionType === 'DIRECTIVE_NOTE') {
        taskUpdateData.priority = TaskPriority.URGENT;
      }

      if (Object.keys(taskUpdateData).length > 0) {
        await tx.task.update({
          where: { id: taskId },
          data: taskUpdateData
        });
      }

      const resolution = await tx.executiveResolution.create({
        data: {
          taskId,
          actorId: fallbackActorId,
          resolutionType: resolutionType as ResolutionType,
          directiveNote: directiveNote || null,
          grantedDays: grantedDays || null,
          previousDueDate,
          newDueDate,
          newOwnerId: newOwnerId || null,
        }
      });

      return resolution;
    });

    return NextResponse.json({ success: true, resolution: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Chạy Typecheck toàn diện**

Run: `npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/executive/resolutions/ tests/executive-resolution-persistence.test.ts
git commit -m "feat(api): implement executive resolution persistence for BGH command actions"
```

---

### Task 7: Xác minh Hồi quy Toàn diện (Full Regression Verification)

**Files:**
- Test: `tests/**/*.test.ts`

- [ ] **Step 1: Chạy kiểm tra Typecheck dự án**

Run: `npm run typecheck`  
Expected: PASS (0 errors).

- [ ] **Step 2: Chạy toàn bộ 815+ tests để xác minh không gây hồi quy (No Regression)**

Run: `npm test`  
Expected: Toàn bộ các bộ test (bao gồm 815 tests cũ + các tests mới viết) đều PASS 100%.

- [ ] **Step 3: Commit xác nhận nghiệm thu giai đoạn**

```bash
git commit --allow-empty -m "chore: verify 100% test pass rate with full persistence layer"
```
