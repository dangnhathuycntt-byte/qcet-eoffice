import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

describe('Task 11: Composite & Partial Indexes Audit', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  const sqlPath = path.join(process.cwd(), 'prisma/migrations/indexes.sql');
  const sqlContent = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf-8') : '';

  describe('1. Prisma Schema & DMMF Composite Indexes', () => {
    test('DMMF datamodel contains Task, Notification, and Document models with all index field members', () => {
      const models = Prisma.dmmf.datamodel.models;
      const taskModel = models.find((m) => m.name === 'Task');
      const notificationModel = models.find((m) => m.name === 'Notification');
      const documentModel = models.find((m) => m.name === 'Document');

      assert.ok(taskModel, 'Task model must exist in Prisma DMMF datamodel');
      assert.ok(notificationModel, 'Notification model must exist in Prisma DMMF datamodel');
      assert.ok(documentModel, 'Document model must exist in Prisma DMMF datamodel');

      // Task required fields
      const taskFieldNames = taskModel.fields.map((f) => f.name);
      assert.ok(taskFieldNames.includes('scope'), 'Task must include scope');
      assert.ok(taskFieldNames.includes('status'), 'Task must include status');
      assert.ok(taskFieldNames.includes('dueDate'), 'Task must include dueDate');
      assert.ok(taskFieldNames.includes('departmentId'), 'Task must include departmentId');
      assert.ok(taskFieldNames.includes('parentTaskId'), 'Task must include parentTaskId');
      assert.ok(taskFieldNames.includes('updatedAt'), 'Task must include updatedAt');
      assert.ok(taskFieldNames.includes('academicYear'), 'Task must include academicYear');
      assert.ok(taskFieldNames.includes('academicMonth'), 'Task must include academicMonth');
      assert.ok(taskFieldNames.includes('createdById'), 'Task must include createdById');

      // Notification required fields
      const notifFieldNames = notificationModel.fields.map((f) => f.name);
      assert.ok(notifFieldNames.includes('userId'), 'Notification must include userId');
      assert.ok(notifFieldNames.includes('createdAt'), 'Notification must include createdAt');
      assert.ok(notifFieldNames.includes('readAt'), 'Notification must include readAt');
      assert.ok(notifFieldNames.includes('isRead'), 'Notification must include isRead');

      // Document required fields
      const docFieldNames = documentModel.fields.map((f) => f.name);
      assert.ok(docFieldNames.includes('type'), 'Document must include type');
      assert.ok(docFieldNames.includes('status'), 'Document must include status');
      assert.ok(docFieldNames.includes('dueDate'), 'Document must include dueDate');
    });

    test('Task model defines composite index @@index([scope, status, dueDate])', () => {
      assert.ok(
        /@@index\(\[scope,\s*status,\s*dueDate\]\)/.test(schemaContent),
        'Task model must contain @@index([scope, status, dueDate])'
      );
    });

    test('Task model defines composite index @@index([departmentId, status, dueDate])', () => {
      assert.ok(
        /@@index\(\[departmentId,\s*status,\s*dueDate\]\)/.test(schemaContent),
        'Task model must contain @@index([departmentId, status, dueDate])'
      );
    });

    test('Task model defines index @@index([parentTaskId])', () => {
      assert.ok(
        /@@index\(\[parentTaskId\]\)/.test(schemaContent),
        'Task model must contain @@index([parentTaskId])'
      );
    });

    test('Task model defines descending index @@index([updatedAt(sort: Desc)])', () => {
      assert.ok(
        /@@index\(\[updatedAt\(sort:\s*Desc\)\s*\]\)/.test(schemaContent),
        'Task model must contain @@index([updatedAt(sort: Desc)])'
      );
    });

    test('Task model defines @@index([academicYear])', () => {
      assert.ok(
        /@@index\(\[academicYear\]\)/.test(schemaContent),
        'Task model must contain @@index([academicYear])'
      );
    });

    test('Notification model defines @@index([userId, createdAt(sort: Desc)])', () => {
      assert.ok(
        /@@index\(\[userId,\s*createdAt\(sort:\s*Desc\)\s*\]\)/.test(schemaContent),
        'Notification model must contain @@index([userId, createdAt(sort: Desc)])'
      );
    });

    test('Document model defines composite index @@index([type, status, dueDate])', () => {
      assert.ok(
        /@@index\(\[type,\s*status,\s*dueDate\]\)/.test(schemaContent),
        'Document model must contain @@index([type, status, dueDate])'
      );
    });
  });

  describe('2. SQL Migration Script for Partial & High-Performance Indexes', () => {
    test('indexes.sql migration file exists and is populated', () => {
      assert.ok(fs.existsSync(sqlPath), 'prisma/migrations/indexes.sql must exist');
      assert.ok(sqlContent.length > 200, 'indexes.sql must contain substantial SQL definitions');
    });

    test('defines unread notifications partial index with WHERE "read_at" IS NULL', () => {
      assert.ok(
        sqlContent.includes('notification_unread_user_idx'),
        'indexes.sql must define notification_unread_user_idx'
      );
      assert.ok(
        /CREATE INDEX IF NOT EXISTS notification_unread_user_idx\s+ON\s+"notifications"\s*\("user_id",\s*"created_at"\s+DESC\)\s*WHERE\s+"read_at"\s+IS\s+NULL;/i.test(
          sqlContent
        ),
        'indexes.sql must create partial index on notifications(user_id, created_at DESC) WHERE read_at IS NULL'
      );
    });

    test('defines single primary owner partial unique index on TaskAssignee', () => {
      assert.ok(
        sqlContent.includes('task_one_primary_owner_idx'),
        'indexes.sql must define task_one_primary_owner_idx'
      );
      assert.ok(
        /CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner_idx\s+ON\s+"task_assignees"\s*\("task_id"\)\s*WHERE\s+"role"\s*=\s*'PRIMARY_OWNER';/i.test(
          sqlContent
        ),
        'indexes.sql must create partial unique index on task_assignees(task_id) WHERE role = PRIMARY_OWNER'
      );
    });

    test('defines single primary owner partial unique index on physical PostgreSQL column (role_in_task)', () => {
      assert.ok(
        sqlContent.includes('task_assignees_one_primary_owner_idx'),
        'indexes.sql must define task_assignees_one_primary_owner_idx'
      );
      assert.ok(
        /CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_primary_owner_idx\s+ON\s+"task_assignees"\s*\("task_id"\)\s*WHERE\s+"role_in_task"\s*=\s*'PRIMARY_OWNER';/i.test(
          sqlContent
        ),
        'indexes.sql must create partial unique index on task_assignees(task_id) WHERE role_in_task = PRIMARY_OWNER'
      );
    });

    test('defines active tasks and active documents partial indexes', () => {
      assert.ok(
        sqlContent.includes('idx_tasks_active_scope_status_due_date'),
        'indexes.sql must define idx_tasks_active_scope_status_due_date'
      );
      assert.ok(
        /WHERE\s+"archived_at"\s+IS\s+NULL;/i.test(sqlContent),
        'indexes.sql must contain partial index predicates filtering out archived records'
      );
    });
  });

  describe('3. Database Index Verification & Query Behavior', () => {
    test('PostgreSQL catalog contains verified composite and partial indexes', async () => {
      const pgIndexes = await prisma.$queryRaw<Array<{ tablename: string; indexname: string; indexdef: string }>>`
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('tasks', 'notifications', 'documents')
      `;

      const indexNames = pgIndexes.map((i) => i.indexname);

      // Verify tasks composite indexes exist in DB
      assert.ok(
        indexNames.some((n) => n.includes('scope_status_due_date')),
        'tasks must have index on (scope, status, due_date)'
      );
      assert.ok(
        indexNames.some((n) => n.includes('department_id_status_due_date')),
        'tasks must have index on (department_id, status, due_date)'
      );
      assert.ok(
        indexNames.some((n) => n.includes('parent_task_id')),
        'tasks must have index on parent_task_id'
      );
      assert.ok(
        indexNames.some((n) => n.includes('updated_at')),
        'tasks must have index on updated_at'
      );

      // Verify notifications indexes exist in DB
      assert.ok(
        indexNames.some((n) => n.includes('notifications_user_id_created_at_idx')),
        'notifications must have index on (user_id, created_at DESC)'
      );
      assert.ok(
        indexNames.some((n) => n === 'notification_unread_user_idx'),
        'notifications must have partial index notification_unread_user_idx'
      );

      // Verify documents composite index exists in DB
      assert.ok(
        indexNames.some((n) => n.includes('type_status_due_date')),
        'documents must have index on (type, status, due_date)'
      );
    });

    test('Queries using composite index patterns execute reliably with type safety', async () => {
      // 1. Task query matching @@index([scope, status, dueDate])
      const tasks = await prisma.task.findMany({
        where: {
          scope: 'DEPARTMENT',
          status: 'IN_PROGRESS',
        },
        orderBy: {
          dueDate: 'asc',
        },
        take: 5,
      });
      assert.ok(Array.isArray(tasks), 'Task query by scope/status/dueDate must return an array');

      // 2. Notification query matching @@index([userId, createdAt(sort: Desc)])
      const notifs = await prisma.notification.findMany({
        where: {
          userId: 'test-user-id',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });
      assert.ok(Array.isArray(notifs), 'Notification query by userId/createdAt must return an array');

      // 3. Document query matching @@index([type, status, dueDate])
      const docs = await prisma.document.findMany({
        where: {
          type: 'VAN_BAN_DEN',
          status: 'DANG_XU_LY',
        },
        orderBy: {
          dueDate: 'asc',
        },
        take: 5,
      });
      assert.ok(Array.isArray(docs), 'Document query by type/status/dueDate must return an array');
    });

    test('PostgreSQL EXPLAIN plan verifies index usage for user notifications query', async () => {
      await prisma.$executeRawUnsafe('SET enable_seqscan = off;');
      const explainResult = await prisma.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
        EXPLAIN SELECT id, title, created_at
        FROM notifications
        WHERE user_id = 'test-benchmark-user'
        ORDER BY created_at DESC
        LIMIT 10;
      `;

      const planText = explainResult.map((r) => r['QUERY PLAN']).join('\n');
      assert.ok(
        planText.includes('Index Scan') || planText.includes('Bitmap Index Scan'),
        `Notification query execution plan should use an index scan. Plan:\n${planText}`
      );
      assert.ok(
        planText.includes('notifications_user_id_created_at_idx') ||
          planText.includes('idx_notifications_user_created_at_desc') ||
          planText.includes('notifications_user_id_read_at_idx') ||
          planText.includes('notifications_user_id_is_read_idx'),
        `Query plan should specifically leverage notifications composite index. Plan:\n${planText}`
      );
    });
  });
});
