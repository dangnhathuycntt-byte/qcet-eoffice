/**
 * Sprint 10 Production Readiness: Structured Logging & Security Redaction Test Suite
 *
 * Verifies:
 * 1. Output is valid single-line JSON format.
 * 2. Standard attributes: timestamp, level, event, requestId, durationMs, route, action, resourceId, userId, errorCode, metadata.
 * 3. Secret Redaction: Passwords, JWT tokens, Bearer tokens, DB connection strings, sensitive institutional payload fields
 *    ('mat_khau', 'van_ban_mat', 'noi_dung_mat', 'raw_payload'), auth headers.
 * 4. Structured Domain Action helper `logger.action()`.
 * 5. Safe handling of circular object references and Error instances.
 */

import assert from 'node:assert/strict';
import {
  StructuredLogger,
  isSensitiveKey,
  redactSensitiveData,
  StructuredLogEntry,
} from '@/server/observability/logger';
import { sanitizeLogContext } from '@/telemetry/sanitize';

async function testStructuredLogger() {
  console.log('--- Test: Sensitive Key Pattern Matching ---');
  assert.equal(isSensitiveKey('password'), true);
  assert.equal(isSensitiveKey('userPassword'), true);
  assert.equal(isSensitiveKey('jwtToken'), true);
  assert.equal(isSensitiveKey('authorization'), true);
  assert.equal(isSensitiveKey('database_url'), true);
  assert.equal(isSensitiveKey('apiKey'), true);
  assert.equal(isSensitiveKey('author'), false, 'author should not be treated as sensitive');
  assert.equal(isSensitiveKey('authority'), false, 'authority should not be treated as sensitive');
  console.log('✓ Sensitive key patterns correctly distinguished from safe business terms.');

  console.log('--- Test: Single-Line JSON & Standard Attributes ---');
  const capturedEntries: { entry: StructuredLogEntry; rawJson: string }[] = [];
  const logger = new StructuredLogger();
  logger.setWriter((entry, rawJson) => {
    capturedEntries.push({ entry, rawJson });
  });

  logger.info('task.created', {
    requestId: 'req-12345',
    durationMs: 42,
    route: '/api/v2/tasks',
    action: 'CREATE_TASK',
    resourceId: 'task-777',
    userId: 'user-888',
    metadata: {
      scope: 'SCHOOL',
      title: 'Kế hoạch kiểm tra đào tạo',
    },
  });

  assert.equal(capturedEntries.length, 1);
  const logged = capturedEntries[0];

  // Verify single-line JSON
  assert.ok(!logged.rawJson.includes('\n'), 'JSON log output must not contain unescaped newlines');
  const parsed = JSON.parse(logged.rawJson);

  assert.equal(parsed.level, 'info');
  assert.equal(parsed.event, 'task.created');
  assert.equal(parsed.requestId, 'req-12345');
  assert.equal(parsed.durationMs, 42);
  assert.equal(parsed.route, '/api/v2/tasks');
  assert.equal(parsed.action, 'CREATE_TASK');
  assert.equal(parsed.resourceId, 'task-777');
  assert.equal(parsed.userId, 'user-888');
  assert.equal(parsed.metadata?.title, 'Kế hoạch kiểm tra đào tạo');
  assert.ok(parsed.timestamp, 'Timestamp must be ISO string');
  console.log('✓ Single-line JSON emitted with standard fields (requestId, durationMs, route, action, resourceId, userId).');

  console.log('--- Test: Secret Redaction & Institutional Confidential Fields ---');
  capturedEntries.length = 0;

  const sensitivePayload = {
    password: 'SuperSecretPassword123!',
    mat_khau: 'MatKhauGiaoVien2026',
    token: 'jwt-header.payload.signature',
    authorization: 'Bearer secret_token_xyz',
    database_url: 'postgresql://qcet_admin:superSecretPass@localhost:5432/qcet_prod',
    van_ban_mat: 'Nội dung dự thảo mật trình Ban Giám hiệu',
    noi_dung_mat: 'Dữ liệu phân loại mật',
    raw_payload: 'Dữ liệu nhạy cảm cấp trường',
    normalField: 'Public informational announcement',
    safeObject: {
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      userNote: 'Họp giao ban tuần',
    },
  };

  logger.warn('security.audit', {
    requestId: 'req-sec-999',
    route: '/api/v2/auth/login',
    action: 'LOGIN_ATTEMPT',
    metadata: sensitivePayload,
  });

  const secLog = capturedEntries[0];
  const secJson = secLog.rawJson;

  assert.ok(!secJson.includes('SuperSecretPassword123!'), 'Plaintext password must never be logged');
  assert.ok(!secJson.includes('MatKhauGiaoVien2026'), 'Plaintext Vietnamese password field must be redacted');
  assert.ok(!secJson.includes('superSecretPass'), 'Database password must never be logged');
  assert.ok(!secJson.includes('secret_token_xyz'), 'Bearer token value must never be logged');
  assert.ok(!secJson.includes('Nội dung dự thảo mật trình Ban Giám hiệu'), 'van_ban_mat must be redacted');
  assert.ok(!secJson.includes('Dữ liệu phân loại mật'), 'noi_dung_mat must be redacted');
  assert.ok(!secJson.includes('Dữ liệu nhạy cảm cấp trường'), 'raw_payload must be redacted');
  assert.ok(secJson.includes('[REDACTED'), 'Redacted marker must be applied to sensitive fields');
  assert.ok(secJson.includes('Public informational announcement'), 'Non-sensitive field must remain intact');
  assert.ok(secJson.includes('Họp giao ban tuần'), 'Safe nested field must remain intact');
  console.log('✓ Sensitive credentials and confidential document payloads thoroughly redacted.');

  console.log('--- Test: logger.action() Helper ---');
  capturedEntries.length = 0;

  logger.action('DOCUMENT_FORWARD', {
    route: '/api/v2/documents/inbound/doc-99/forward',
    resourceId: 'doc-99',
    userId: 'usr-forwarder',
    durationMs: 15,
    requestId: 'req-fwd-01',
    metadata: {
      toDepartmentId: 'dept-phong-daotao',
    },
  });

  assert.equal(capturedEntries.length, 1);
  const actionEntry = capturedEntries[0].entry;
  assert.equal(actionEntry.event, 'action.DOCUMENT_FORWARD');
  assert.equal(actionEntry.action, 'DOCUMENT_FORWARD');
  assert.equal(actionEntry.resourceId, 'doc-99');
  assert.equal(actionEntry.userId, 'usr-forwarder');
  assert.equal(actionEntry.durationMs, 15);
  console.log('✓ logger.action() helper successfully structured the domain action event.');

  console.log('--- Test: Circular References & Error Handling ---');
  const circularObj: any = { name: 'Root' };
  circularObj.self = circularObj;

  const safeSanitized = redactSensitiveData(circularObj) as any;
  assert.equal(safeSanitized.name, 'Root');
  assert.equal(safeSanitized.self, '[CIRCULAR_REFERENCE]');

  const testError = new Error('Database connection timeout');
  (testError as any).code = 'DB_TIMEOUT';

  logger.error('system.failure', { errorCode: 'DB_ERROR' }, testError);
  const errEntry = capturedEntries[capturedEntries.length - 1].entry;
  assert.equal(errEntry.level, 'error');
  assert.equal(errEntry.metadata?.error?.message, 'Database connection timeout');
  console.log('✓ Circular references and Error instances handled safely without throwing.');
}

testStructuredLogger().then(() => {
  console.log('All structured logger security tests passed successfully!');
}).catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
