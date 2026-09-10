import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  logger,
  StructuredLogger,
  StructuredLogEntry,
  redactSensitiveData,
  getRequestId,
  isSensitiveKey,
} from '../src/server/observability/logger';
import { register, onRequestError } from '../src/instrumentation';
import {
  logAuditEvent,
  getTaskAuditTrail,
  getUserAuditTrail,
  AuditAction,
  AuditEntityType,
  TASK_CREATED,
  TASK_ASSIGNED,
  TASK_STATUS_CHANGED,
  DELIVERABLE_SUBMITTED,
  TASK_APPROVED,
  TASK_REJECTED,
  TASK_DEADLINE_CHANGED,
  DOCUMENT_DIRECTIVE_CREATED,
} from '../src/lib/db/audit';
import { prisma } from '../src/lib/prisma';

describe('Phase 10 & 11: Observability, Structured Logging & Business Audit Event Model', () => {
  // ==========================================================================
  // SUITE 1: Structured Logger Format & JSON Integrity
  // ==========================================================================
  describe('1. Structured Logger Format & Contract', () => {
    test('Emits valid single-line JSON with standard attributes', () => {
      const logs: { entry: StructuredLogEntry; raw: string }[] = [];
      const testLogger = new StructuredLogger();
      testLogger.setWriter((entry, raw) => logs.push({ entry, raw }));

      testLogger.info('task.created', {
        requestId: 'req-abc-123',
        durationMs: 45,
        metadata: { taskId: 'task-001', department: 'CNTT' },
      });

      assert.equal(logs.length, 1);
      const { entry, raw } = logs[0];

      // Single line assertion (no internal unescaped newlines)
      assert.equal(raw.includes('\n'), false, 'Log output must be a single line JSON');

      // Parsable as valid JSON
      const parsed = JSON.parse(raw);
      assert.equal(parsed.event, 'task.created');
      assert.equal(parsed.level, 'info');
      assert.equal(parsed.requestId, 'req-abc-123');
      assert.equal(parsed.durationMs, 45);
      assert.equal(parsed.metadata.taskId, 'task-001');
      assert.equal(parsed.metadata.department, 'CNTT');

      // ISO Timestamp validation
      assert.ok(parsed.timestamp);
      assert.ok(!isNaN(Date.parse(parsed.timestamp)), 'Timestamp must be valid ISO 8601');
    });

    test('Supports all log levels: info, warn, error, debug', () => {
      const logs: StructuredLogEntry[] = [];
      const testLogger = new StructuredLogger();
      testLogger.setWriter((entry) => logs.push(entry));

      testLogger.info('event.info');
      testLogger.warn('event.warn');
      testLogger.error('event.error');
      testLogger.debug('event.debug');

      assert.equal(logs.length, 4);
      assert.equal(logs[0].level, 'info');
      assert.equal(logs[1].level, 'warn');
      assert.equal(logs[2].level, 'error');
      assert.equal(logs[3].level, 'debug');
    });

    test('logger.error safely extracts error details and sets errorCode', () => {
      const logs: StructuredLogEntry[] = [];
      const testLogger = new StructuredLogger();
      testLogger.setWriter((entry) => logs.push(entry));

      const err = new Error('Database connection failed');
      (err as any).code = 'ECONNREFUSED';

      testLogger.error('db.connection.failed', { requestId: 'req-db-1' }, err);

      assert.equal(logs.length, 1);
      const entry = logs[0];
      assert.equal(entry.level, 'error');
      assert.equal(entry.event, 'db.connection.failed');
      assert.equal(entry.requestId, 'req-db-1');
      assert.equal(entry.errorCode, 'ECONNREFUSED');
      assert.ok(entry.metadata?.error);
      assert.equal(entry.metadata.error.name, 'Error');
      assert.equal(entry.metadata.error.message, 'Database connection failed');
      assert.ok(entry.metadata.error.stack);
    });

    test('logger.error accepts Error instance directly as second argument', () => {
      const logs: StructuredLogEntry[] = [];
      const testLogger = new StructuredLogger();
      testLogger.setWriter((entry) => logs.push(entry));

      const err = new TypeError('Invalid input');
      testLogger.error('validation.failed', err);

      assert.equal(logs.length, 1);
      const entry = logs[0];
      assert.equal(entry.level, 'error');
      assert.equal(entry.event, 'validation.failed');
      assert.equal(entry.errorCode, 'TypeError');
      assert.equal(entry.metadata?.error?.message, 'Invalid input');
    });

    test('logger.httpRequest formats HTTP requests with status, method, url, and duration', () => {
      const logs: StructuredLogEntry[] = [];
      const testLogger = new StructuredLogger();
      testLogger.setWriter((entry) => logs.push(entry));

      const mockReq = {
        method: 'POST',
        url: 'https://eoffice.qncet.edu.vn/api/tasks?token=secret123',
        headers: {
          get: (name: string) => {
            if (name === 'x-request-id') return 'req-http-999';
            if (name === 'user-agent') return 'Mozilla/5.0 TestAgent';
            if (name === 'x-forwarded-for') return '192.168.1.100, 10.0.0.1';
            return null;
          },
        },
      };

      const mockRes = { status: 201 };

      testLogger.httpRequest(mockReq, mockRes, 120);

      assert.equal(logs.length, 1);
      const entry = logs[0];
      assert.equal(entry.event, 'http.request');
      assert.equal(entry.level, 'info');
      assert.equal(entry.requestId, 'req-http-999');
      assert.equal(entry.durationMs, 120);
      assert.equal(entry.metadata?.status, 201);
      assert.equal(entry.metadata?.method, 'POST');
      assert.equal(entry.metadata?.ip, '192.168.1.100');
      assert.equal(entry.metadata?.userAgent, 'Mozilla/5.0 TestAgent');
      // Notice: token in URL must be redacted
      assert.ok(
        entry.metadata?.url.includes('token=%5BREDACTED%5D') ||
        entry.metadata?.url.includes('token=[REDACTED]'),
        'Sensitive query params in URL must be redacted'
      );
    });

    test('logger.httpRequest maps 4xx to warn and 5xx to error', () => {
      const logs: StructuredLogEntry[] = [];
      const testLogger = new StructuredLogger();
      testLogger.setWriter((entry) => logs.push(entry));

      testLogger.httpRequest({ method: 'GET', url: '/not-found' }, { status: 404 }, 10);
      testLogger.httpRequest({ method: 'GET', url: '/crash' }, { status: 500 }, 30);

      assert.equal(logs[0].level, 'warn');
      assert.equal(logs[0].errorCode, 'HTTP_404');

      assert.equal(logs[1].level, 'error');
      assert.equal(logs[1].errorCode, 'HTTP_500');
    });
  });

  // ==========================================================================
  // SUITE 2: Mandatory Security & Secret Redaction
  // ==========================================================================
  describe('2. Secret Redaction & Sanitization', () => {
    test('Redacts sensitive keys: password, token, secret, jwt, cookie, authorization, session, credential', () => {
      const sensitivePayload = {
        username: 'nguyenvana',
        password: 'SuperSecretPassword123!',
        passwd: 'oldPassword',
        token: 'auth-token-xyz',
        accessToken: 'access-12345',
        refreshToken: 'refresh-67890',
        secret: 'app-secret-val',
        clientSecret: 'oauth-client-secret',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
        cookie: 'session_id=sess_12345; Path=/',
        authorization: 'Bearer secret-bearer-token',
        sessionToken: 'sess-abc-789',
        credential: 'api-credential-key',
        apiKey: 'sk-qcet-123456789',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
      };

      const redacted = redactSensitiveData(sensitivePayload) as Record<string, any>;

      assert.equal(redacted.username, 'nguyenvana', 'Non-sensitive key should remain intact');
      assert.equal(redacted.password, '[REDACTED]');
      assert.equal(redacted.passwd, '[REDACTED]');
      assert.equal(redacted.token, '[REDACTED]');
      assert.equal(redacted.accessToken, '[REDACTED]');
      assert.equal(redacted.refreshToken, '[REDACTED]');
      assert.equal(redacted.secret, '[REDACTED]');
      assert.equal(redacted.clientSecret, '[REDACTED]');
      assert.equal(redacted.jwt, '[REDACTED]');
      assert.equal(redacted.cookie, '[REDACTED]');
      assert.equal(redacted.authorization, '[REDACTED]');
      assert.equal(redacted.sessionToken, '[REDACTED]');
      assert.equal(redacted.credential, '[REDACTED]');
      assert.equal(redacted.apiKey, '[REDACTED]');
      assert.equal(redacted.privateKey, '[REDACTED]');
    });

    test('Redacts raw JWT and Bearer tokens inside string values', () => {
      const rawJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG4B1sWq_example';
      const input = {
        message: `User attempted login with token: ${rawJwt}`,
        headerString: 'Bearer my-bearer-secret-token-123',
      };

      const redacted = redactSensitiveData(input) as Record<string, any>;

      assert.ok(!redacted.message.includes(rawJwt), 'Raw JWT must be redacted from message string');
      assert.ok(redacted.message.includes('[REDACTED_JWT]'));
      assert.equal(redacted.headerString, 'Bearer [REDACTED_TOKEN]');
    });

    test('Handles deeply nested structures and arrays without mutating original object', () => {
      const original = {
        user: {
          profile: {
            name: 'Tran Thi B',
            credentials: {
              pinCode: '1234',
              authTokens: ['tok-1', 'tok-2'],
            },
          },
        },
      };

      const copyBefore = JSON.stringify(original);
      const redacted = redactSensitiveData(original) as any;

      // Original intact
      assert.equal(JSON.stringify(original), copyBefore, 'Input must not be mutated');

      // Nested values redacted
      assert.equal(redacted.user.profile.name, 'Tran Thi B');
      assert.equal(redacted.user.profile.credentials, '[REDACTED]');
    });

    test('Guards against circular references cleanly without crashing', () => {
      const circularObj: any = { name: 'RootNode' };
      circularObj.self = circularObj;

      assert.doesNotThrow(() => {
        const result = redactSensitiveData(circularObj);
        assert.ok(result);
      });
    });

    test('Does not falsely redact safe terms containing "auth" (author, authority)', () => {
      assert.equal(isSensitiveKey('author'), false);
      assert.equal(isSensitiveKey('authorId'), false);
      assert.equal(isSensitiveKey('authority'), false);

      const safePayload = {
        author: 'Nguyen Van A',
        authorId: 'user-001',
        authority: 'SchoolBoard',
      };

      const sanitized = redactSensitiveData(safePayload) as any;
      assert.equal(sanitized.author, 'Nguyen Van A');
      assert.equal(sanitized.authorId, 'user-001');
      assert.equal(sanitized.authority, 'SchoolBoard');
    });
  });

  // ==========================================================================
  // SUITE 3: Request ID Extraction & Propagation
  // ==========================================================================
  describe('3. Request ID Propagation', () => {
    test('Resolves request ID from x-request-id header function', () => {
      const mockReq = {
        headers: {
          get: (headerName: string) => (headerName === 'x-request-id' ? 'req-custom-header-123' : null),
        },
      };
      const reqId = getRequestId(mockReq);
      assert.equal(reqId, 'req-custom-header-123');
    });

    test('Resolves request ID from x-correlation-id when x-request-id is absent', () => {
      const mockReq = {
        headers: {
          get: (headerName: string) => (headerName === 'x-correlation-id' ? 'corr-987' : null),
        },
      };
      const reqId = getRequestId(mockReq);
      assert.equal(reqId, 'corr-987');
    });

    test('Resolves request ID from plain headers record', () => {
      const mockReq = {
        headers: {
          'x-request-id': 'req-record-456',
        },
      };
      const reqId = getRequestId(mockReq);
      assert.equal(reqId, 'req-record-456');
    });

    test('Generates standard RFC4122 v4 UUID when no request ID header is provided', () => {
      const reqId = getRequestId(null);
      assert.ok(reqId);
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(uuidV4Regex.test(reqId), `Generated ID "${reqId}" must be a valid UUID v4`);
    });
  });

  // ==========================================================================
  // SUITE 4: Business Audit Event Model Contracts
  // ==========================================================================
  describe('4. Business Audit Event Model & Audit Trail Contract', () => {
    test('Ensures all required business audit action types are defined and exported', () => {
      const requiredEvents = [
        'TASK_CREATED',
        'TASK_ASSIGNED',
        'TASK_STATUS_CHANGED',
        'DELIVERABLE_SUBMITTED',
        'TASK_APPROVED',
        'TASK_REJECTED',
        'TASK_DEADLINE_CHANGED',
        'DOCUMENT_DIRECTIVE_CREATED',
      ];

      for (const eventName of requiredEvents) {
        assert.ok(
          eventName in AuditAction,
          `AuditAction enum must contain ${eventName}`
        );
      }

      assert.equal(TASK_CREATED, AuditAction.TASK_CREATED);
      assert.equal(TASK_ASSIGNED, AuditAction.TASK_ASSIGNED);
      assert.equal(TASK_STATUS_CHANGED, AuditAction.TASK_STATUS_CHANGED);
      assert.equal(DELIVERABLE_SUBMITTED, AuditAction.DELIVERABLE_SUBMITTED);
      assert.equal(TASK_APPROVED, AuditAction.TASK_APPROVED);
      assert.equal(TASK_REJECTED, AuditAction.TASK_REJECTED);
      assert.equal(TASK_DEADLINE_CHANGED, AuditAction.TASK_DEADLINE_CHANGED);
      assert.equal(DOCUMENT_DIRECTIVE_CREATED, AuditAction.DOCUMENT_DIRECTIVE_CREATED);
    });

    test('logAuditEvent verifies schema contract with mock Prisma client', async () => {
      const createdEvents: any[] = [];
      const mockClient: any = {
        auditEvent: {
          create: async ({ data }: { data: any }) => {
            createdEvents.push(data);
            return { id: 'evt-mock-1', ...data, createdAt: new Date() };
          },
        },
      };

      await logAuditEvent(mockClient, {
        action: AuditAction.TASK_CREATED,
        entityType: AuditEntityType.TASK,
        entityId: 'task-test-mock-01',
        actorId: 'user-actor-001',
        requestId: 'req-track-001',
        beforeData: null,
        afterData: { title: 'Xây dựng kế hoạch đào tạo DACUM', priority: 'HIGH' },
        metadata: { source: 'api' },
      });

      assert.equal(createdEvents.length, 1);
      const event = createdEvents[0];
      assert.equal(event.action, AuditAction.TASK_CREATED);
      assert.equal(event.entityType, 'Task');
      assert.equal(event.entityId, 'task-test-mock-01');
      assert.equal(event.actorId, 'user-actor-001');
      assert.equal(event.requestId, 'req-track-001');
      assert.deepEqual(event.afterData, { title: 'Xây dựng kế hoạch đào tạo DACUM', priority: 'HIGH' });
    });

    test('getTaskAuditTrail queries entityType="Task" with descending order', async () => {
      let queryReceived: any = null;
      const mockClient: any = {
        auditEvent: {
          findMany: async (query: any) => {
            queryReceived = query;
            return [
              {
                id: 'evt-1',
                entityType: 'Task',
                entityId: 'task-123',
                action: 'TASK_APPROVED',
                createdAt: new Date(),
              },
            ];
          },
        },
      };

      const trail = await getTaskAuditTrail(mockClient, 'task-123', 20);

      assert.equal(trail.length, 1);
      assert.equal(queryReceived.where.entityType, 'Task');
      assert.equal(queryReceived.where.entityId, 'task-123');
      assert.equal(queryReceived.take, 20);
      assert.deepEqual(queryReceived.orderBy, { createdAt: 'desc' });
    });

    test('getUserAuditTrail queries actorId with descending order', async () => {
      let queryReceived: any = null;
      const mockClient: any = {
        auditEvent: {
          findMany: async (query: any) => {
            queryReceived = query;
            return [
              {
                id: 'evt-user-1',
                actorId: 'user-789',
                action: 'TASK_CREATED',
                createdAt: new Date(),
              },
            ];
          },
        },
      };

      const userTrail = await getUserAuditTrail(mockClient, 'user-789', 15);

      assert.equal(userTrail.length, 1);
      assert.equal(queryReceived.where.actorId, 'user-789');
      assert.equal(queryReceived.take, 15);
      assert.deepEqual(queryReceived.orderBy, { createdAt: 'desc' });
    });

    test('Integration: writes and queries Task and User audit trails in PostgreSQL', async () => {
      const runId = `trail_${Date.now()}`;
      const taskId = `task_${runId}`;
      const actorId = `actor_${runId}`;
      const reqId = `req_${runId}`;

      try {
        // 1. Log sequential lifecycle events with slight delay to ensure monotonic timestamps
        await logAuditEvent({
          action: AuditAction.TASK_CREATED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          actorId,
          requestId: reqId,
          beforeData: null,
          afterData: { code: 'NV-2026-001', title: 'Task Test Audit' },
        });
        await new Promise((r) => setTimeout(r, 15));

        await logAuditEvent({
          action: AuditAction.TASK_ASSIGNED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          actorId,
          requestId: reqId,
          beforeData: null,
          afterData: { assigneeId: 'assignee-01' },
        });
        await new Promise((r) => setTimeout(r, 15));

        await logAuditEvent({
          action: AuditAction.TASK_STATUS_CHANGED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          actorId,
          requestId: reqId,
          beforeData: { status: 'IN_PROGRESS' },
          afterData: { status: 'WAITING_APPROVAL' },
        });
        await new Promise((r) => setTimeout(r, 15));

        await logAuditEvent({
          action: AuditAction.TASK_APPROVED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          actorId,
          requestId: reqId,
          beforeData: { status: 'WAITING_APPROVAL' },
          afterData: { status: 'COMPLETED' },
        });
        await new Promise((r) => setTimeout(r, 15));

        // 2. Query task audit trail
        const taskHistory = await getTaskAuditTrail(taskId);
        assert.equal(taskHistory.length, 4, 'Should find 4 audit events for this task');

        // Newest first order check
        assert.equal(taskHistory[0].action, AuditAction.TASK_APPROVED);
        assert.equal(taskHistory[1].action, AuditAction.TASK_STATUS_CHANGED);
        assert.equal(taskHistory[2].action, AuditAction.TASK_ASSIGNED);
        assert.equal(taskHistory[3].action, AuditAction.TASK_CREATED);

        // 3. Query user audit trail
        const userHistory = await getUserAuditTrail(actorId);
        assert.equal(userHistory.length, 4, 'Should find 4 audit events performed by this actor');
      } finally {
        // Cleanup test events
        await prisma.auditEvent.deleteMany({
          where: {
            OR: [
              { entityId: taskId },
              { actorId },
              { requestId: reqId },
            ],
          },
        });
      }
    });
  });

  // ==========================================================================
  // SUITE 5: Next.js Instrumentation Lifecycle Hook
  // ==========================================================================
  describe('5. Next.js App Router Instrumentation Hook', () => {
    test('src/instrumentation.ts exports register and runs cleanly without throwing', async () => {
      assert.equal(typeof register, 'function', 'register must be an exported function');

      const loggedBoot: StructuredLogEntry[] = [];
      logger.setWriter((entry) => loggedBoot.push(entry));

      // Run register hook
      await assert.doesNotReject(async () => {
        await register();
      });

      // Verify app.boot event was logged
      const bootEntry = loggedBoot.find((e) => e.event === 'app.boot');
      assert.ok(bootEntry, 'Instrumentation must emit app.boot event');
      assert.equal(bootEntry.level, 'info');
      assert.ok(bootEntry.metadata?.service === 'qcet-eoffice');

      // Reset writer
      logger.setWriter(undefined);
    });

    test('onRequestError listener safely handles error without throwing', async () => {
      assert.equal(typeof onRequestError, 'function');

      const loggedErrors: StructuredLogEntry[] = [];
      logger.setWriter((entry) => loggedErrors.push(entry));

      const mockError = Object.assign(new Error('Rendering failed'), { digest: 'DIGEST_12345' });

      await assert.doesNotReject(async () => {
        await onRequestError(
          mockError,
          {
            path: '/nhiem-vu',
            method: 'GET',
            headers: { 'user-agent': 'Mozilla' },
          },
          {
            routerKind: 'App Router',
            routePath: '/nhiem-vu',
            routeType: 'render',
          }
        );
      });

      const errLog = loggedErrors.find((e) => e.event === 'app.request.error');
      assert.ok(errLog, 'Must emit app.request.error');
      assert.equal(errLog.level, 'error');
      assert.equal(errLog.errorCode, 'DIGEST_12345');
      assert.equal(errLog.metadata?.path, '/nhiem-vu');

      logger.setWriter(undefined);
    });
  });
});
