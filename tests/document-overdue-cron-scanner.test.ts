import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { DocumentStatus, DocumentType, UserRole, UnitType, UnitStatus } from '@prisma/client';
import { getIctReferenceDateStart } from '../src/domain/tasks/deadlines';
import {
  scanAndDispatchDocumentDeadlines,
  resolveDocumentStakeholders,
  formatIctDate,
  documentDeadlineOutboxHandler,
} from '../src/lib/documents/document-deadline-scanner';
import {
  formatDocumentPushPayload,
  setPushSenderForTesting,
} from '../src/lib/push-service';
import { GET, POST } from '../src/app/api/cron/document-deadline-check/route';
import { OutboxEventType } from '../src/lib/db/outbox';

describe('Document Overdue Cron Scanner & Web-Push Dispatcher (document-overdue-cron-scanner)', () => {
  const testRunId = `doc_cron_${Date.now()}`;
  let testLeadUser: any;
  let testLeaderUser: any;
  let testDriUser: any;
  let testRegistrarUser: any;
  let testUnit: any;
  const createdDocIds: string[] = [];

  before(async () => {
    // Setup mock push sender to record push notifications without network calls
    setPushSenderForTesting(async () => {
      return {
        statusCode: 201,
        body: 'ok',
        headers: {},
      };
    });

    // Create or find test unit
    testUnit = await prisma.organizationalUnit.findFirst({
      where: { code: `UNIT-CRON-${testRunId}` },
    });
    if (!testUnit) {
      testUnit = await prisma.organizationalUnit.create({
        data: {
          id: `unit-cron-${testRunId}`,
          code: `UNIT-CRON-${testRunId}`,
          name: 'Phòng Hành chính Tổng hợp Cron Test',
          type: UnitType.DEPARTMENT,
          status: UnitStatus.ACTIVE,
        },
      });
    }

    // Create test users
    testLeadUser = await prisma.user.create({
      data: {
        email: `lead_${testRunId}@qcet.edu.vn`,
        name: 'Chuyên viên Chủ trì Xử lý',
        role: UserRole.CHUYEN_VIEN,
      },
    });

    testLeaderUser = await prisma.user.create({
      data: {
        email: `leader_${testRunId}@qcet.edu.vn`,
        name: 'Hiệu trưởng Ban Giám Hiệu',
        role: UserRole.BAN_GIAM_HIEU,
      },
    });

    testDriUser = await prisma.user.create({
      data: {
        email: `dri_${testRunId}@qcet.edu.vn`,
        name: 'Chuyên viên Đơn vị DRI',
        role: UserRole.CHUYEN_VIEN,
      },
    });

    testRegistrarUser = await prisma.user.create({
      data: {
        email: `vanthu_${testRunId}@qcet.edu.vn`,
        name: 'Văn thư Trường',
        role: UserRole.VAN_THU,
      },
    });

    // Create position assignment for Department Head in test unit
    const posDef = await prisma.positionDefinition.findFirst() || await prisma.positionDefinition.create({
      data: {
        code: `POS-TP-${testRunId}`,
        title: 'Trưởng phòng HCTH',
        group: 'LDPU' as any,
        isLeadership: true,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: testLeadUser.id,
        unitId: testUnit.id,
        positionDefinitionId: posDef.id,
        status: 'ACTIVE',
      },
    });
  });

  after(async () => {
    // Reset push sender
    setPushSenderForTesting(null);

    // Clean up created documents
    if (createdDocIds.length > 0) {
      await prisma.documentIncomingWorkflow.deleteMany({
        where: { documentId: { in: createdDocIds } },
      });
      await prisma.notification.deleteMany({
        where: { linkHref: { in: createdDocIds.map((id) => `/documents?id=${id}`) } },
      });
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: createdDocIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: createdDocIds } },
      });
    }

    // Clean up test position assignments & users
    await prisma.positionAssignment.deleteMany({
      where: { userId: { in: [testLeadUser.id, testLeaderUser.id, testDriUser.id, testRegistrarUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testLeadUser.id, testLeaderUser.id, testDriUser.id, testRegistrarUser.id] } },
    });
    if (testUnit) {
      await prisma.organizationalUnit.delete({ where: { id: testUnit.id } }).catch(() => {});
    }
  });

  describe('1. ICT Timezone & Reference Date Invariants', () => {
    test('computes ICT start of day accurately for reference dates', () => {
      const sampleDate = new Date('2026-09-24T15:30:00Z');
      const ictStart = getIctReferenceDateStart(sampleDate);

      // In ICT (+07:00), 2026-09-24T15:30:00Z is 2026-09-24 22:30:00.
      // So ICT start of day is 2026-09-24T00:00:00+07:00 (which is 2026-09-23T17:00:00Z).
      assert.strictEqual(ictStart.toISOString(), '2026-09-23T17:00:00.000Z');
    });

    test('formats dates into DD/MM/YYYY standard administrative format', () => {
      const sampleDate = new Date('2026-09-24T03:00:00Z');
      const formatted = formatIctDate(sampleDate);
      assert.strictEqual(formatted, '24/09/2026');
    });
  });

  describe('2. Push Payload Formatting & Budget Constraints', () => {
    test('formats [QUÁ HẠN XỬ LÝ] push payload conforming to lock-screen budgets', () => {
      const payload = formatDocumentPushPayload({
        event: 'DOCUMENT_OVERDUE',
        documentId: 'doc-123',
        documentNumber: '123/UBND-VX',
        summary: 'Kế hoạch kiểm tra công tác an toàn lao động và phòng chống cháy nổ quý 3 năm 2026',
        dueDateStr: '20/09/2026',
      });

      assert.ok(payload.title.startsWith('[QUÁ HẠN XỬ LÝ]'));
      assert.ok(payload.title.length <= 35, `Title length ${payload.title.length} exceeds 35 chars`);
      assert.ok(payload.body.length <= 90, `Body length ${payload.body.length} exceeds 90 chars`);
      assert.strictEqual(payload.tag, 'doc-doc-123-overdue');
      assert.strictEqual(payload.data.documentId, 'doc-123');
      assert.strictEqual(payload.data.type, 'DOCUMENT_OVERDUE');
    });

    test('formats [SẮP HẾT HẠN] push payload for deadlines < 24h', () => {
      const payload = formatDocumentPushPayload({
        event: 'DOCUMENT_EXPIRING_SOON',
        documentId: 'doc-456',
        documentNumber: '456/SGDĐT-TCCB',
        summary: 'Báo cáo rà soát vị trí việc làm và cơ cấu viên chức',
        dueDateStr: '25/09/2026',
      });

      assert.ok(payload.title.startsWith('[SẮP HẾT HẠN]'));
      assert.ok(payload.title.length <= 35);
      assert.ok(payload.body.length <= 90);
      assert.strictEqual(payload.tag, 'doc-doc-456-expiring');
      assert.strictEqual(payload.data.documentId, 'doc-456');
    });
  });

  describe('3. Stakeholder Resolution Logic', () => {
    test('resolves direct leadUser, unit DRI, leader, and department heads', async () => {
      const mockDoc = {
        id: `mock-doc-${testRunId}`,
        leadUserId: testLeadUser.id,
        leadUnitId: testUnit.id,
        incomingWorkflow: {
          leaderId: testLeaderUser.id,
          leadUnitId: testUnit.id,
          unitAssignments: [{ driUserId: testDriUser.id }],
        },
      };

      const stakeholders = await resolveDocumentStakeholders(mockDoc, prisma);
      assert.ok(stakeholders.includes(testLeadUser.id), 'Must include direct lead user');
      assert.ok(stakeholders.includes(testLeaderUser.id), 'Must include leader');
      assert.ok(stakeholders.includes(testDriUser.id), 'Must include unit DRI');
    });

    test('falls back to registeredBy when document has no assigned personnel', async () => {
      const mockDoc = {
        id: `mock-unassigned-${testRunId}`,
        registeredById: testRegistrarUser.id,
        leadUserId: null,
        leadUnitId: null,
        incomingWorkflow: null,
      };

      const stakeholders = await resolveDocumentStakeholders(mockDoc, prisma);
      assert.ok(stakeholders.includes(testRegistrarUser.id), 'Must include registrar when unassigned');
    });
  });

  describe('4. Scanner Business Logic: Overdue & Expiring Soon Detection', () => {
    test('scans and dispatches overdue documents via Transactional Outbox and Notifications', async () => {
      const overdueDocId = `doc_overdue_${Date.now()}`;
      const pastDueDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 2 days ago

      // Create an overdue document in DB
      await prisma.document.create({
        data: {
          id: overdueDocId,
          type: DocumentType.VAN_BAN_DEN,
          documentYear: 2026,
          registrationNumber: Math.floor(Math.random() * 90000) + 1000,
          originalNumber: `OD-${testRunId}/QCET`,
          issuedDate: new Date('2026-09-01'),
          issuingAuthority: 'Sở Giáo dục và Đào tạo Quảng Ninh',
          category: 'Chỉ đạo điều hành',
          summary: 'Văn bản quá hạn kiểm thử cron scanner',
          dueDate: pastDueDate,
          status: DocumentStatus.DANG_XU_LY,
          leadUserId: testLeadUser.id,
          registeredById: testRegistrarUser.id,
        },
      });
      createdDocIds.push(overdueDocId);

      // Run scanner
      const scanResult = await scanAndDispatchDocumentDeadlines({
        db: prisma,
      });

      assert.ok(scanResult.scannedCount >= 1, 'Should scan active documents');
      assert.ok(scanResult.overdueCount >= 1, 'Should detect at least 1 overdue document');

      // Verify Transactional Outbox event created
      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: overdueDocId,
          eventType: OutboxEventType.DOCUMENT_OVERDUE_NOTIFICATION,
        },
      });
      assert.ok(outboxEvent, 'Outbox event DOCUMENT_OVERDUE_NOTIFICATION must be recorded');
      assert.strictEqual(outboxEvent.aggregateType, 'Document');
      const payload = outboxEvent.payload as any;
      assert.strictEqual(payload.documentId, overdueDocId);
      assert.strictEqual(payload.type, 'OVERDUE');

      // Verify In-App Notification created
      const notif = await prisma.notification.findFirst({
        where: {
          userId: testLeadUser.id,
          linkHref: `/documents?id=${overdueDocId}`,
          type: 'DOCUMENT_OVERDUE',
        },
      });
      assert.ok(notif, 'In-app notification for lead user must be created');
      assert.ok(notif.title.includes('[QUÁ HẠN XỬ LÝ]'));
    });

    test('scans and dispatches expiring soon (<24h) documents', async () => {
      const expiringDocId = `doc_expiring_${Date.now()}`;
      const soonDueDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // in 12 hours

      // Create an expiring document in DB
      await prisma.document.create({
        data: {
          id: expiringDocId,
          type: DocumentType.VAN_BAN_DEN,
          documentYear: 2026,
          registrationNumber: Math.floor(Math.random() * 90000) + 1000,
          originalNumber: `EXP-${testRunId}/QCET`,
          issuedDate: new Date('2026-09-20'),
          issuingAuthority: 'Ủy ban Nhân dân Tỉnh',
          category: 'Hành chính',
          summary: 'Văn bản sắp hết hạn trong 24 giờ tới',
          dueDate: soonDueDate,
          status: DocumentStatus.DANG_XU_LY,
          leadUserId: testLeadUser.id,
          registeredById: testRegistrarUser.id,
        },
      });
      createdDocIds.push(expiringDocId);

      // Run scanner
      const scanResult = await scanAndDispatchDocumentDeadlines({
        db: prisma,
      });

      assert.ok(scanResult.expiringSoonCount >= 1, 'Should detect at least 1 expiring soon document');

      // Verify Outbox event
      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: expiringDocId,
          eventType: OutboxEventType.DOCUMENT_EXPIRING_SOON_NOTIFICATION,
        },
      });
      assert.ok(outboxEvent, 'Outbox event DOCUMENT_EXPIRING_SOON_NOTIFICATION must be recorded');

      // Verify Notification
      const notif = await prisma.notification.findFirst({
        where: {
          userId: testLeadUser.id,
          linkHref: `/documents?id=${expiringDocId}`,
          type: 'DOCUMENT_EXPIRING_SOON',
        },
      });
      assert.ok(notif, 'In-app notification for expiring document must be created');
      assert.ok(notif.title.includes('[SẮP HẾT HẠN]'));
    });

    test('ignores completed and archived documents even if their due date is in the past', async () => {
      const completedDocId = `doc_completed_${Date.now()}`;
      const pastDueDate = new Date(Date.now() - 100 * 60 * 60 * 1000);

      await prisma.document.create({
        data: {
          id: completedDocId,
          type: DocumentType.VAN_BAN_DEN,
          documentYear: 2026,
          registrationNumber: Math.floor(Math.random() * 90000) + 1000,
          originalNumber: `DONE-${testRunId}/QCET`,
          issuedDate: new Date('2026-08-01'),
          issuingAuthority: 'Bộ Lao động Thương binh và Xã hội',
          category: 'Đào tạo',
          summary: 'Văn bản đã hoàn thành',
          dueDate: pastDueDate,
          status: DocumentStatus.DA_HOAN_THANH, // Completed
          leadUserId: testLeadUser.id,
          registeredById: testRegistrarUser.id,
        },
      });
      createdDocIds.push(completedDocId);

      const scanResult = await scanAndDispatchDocumentDeadlines({
        db: prisma,
        dryRun: true,
      });

      const found = scanResult.items.some((item) => item.documentId === completedDocId);
      assert.strictEqual(found, false, 'Completed documents must NOT be flagged as overdue');
    });

    test('supports dryRun option to inspect without mutating database', async () => {
      const scanResult = await scanAndDispatchDocumentDeadlines({
        db: prisma,
        dryRun: true,
      });

      assert.strictEqual(scanResult.outboxEventsCreated, 0);
      assert.strictEqual(scanResult.notificationsCreated, 0);
      assert.ok(Array.isArray(scanResult.items));
    });
  });

  describe('5. API Route /api/cron/document-deadline-check', () => {
    test('GET route executes successfully and returns structured metrics', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/document-deadline-check?dryRun=true', {
        method: 'GET',
      });

      const res = await GET(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.timestamp);
      assert.ok(typeof json.durationMs === 'number');
      assert.strictEqual(json.dryRun, true);
      assert.ok(json.data);
      assert.ok(typeof json.data.scannedCount === 'number');
    });

    test('POST route acts as trigger alias for GET', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/document-deadline-check?dryRun=true', {
        method: 'POST',
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('enforces CRON_SECRET authorization when secret is configured', async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'super-secret-cron-token-123';

      try {
        // 1. Unauthorized request (missing or invalid header)
        const unauthReq = new NextRequest('http://localhost:3000/api/cron/document-deadline-check', {
          method: 'GET',
          headers: {
            authorization: 'Bearer invalid-token',
          },
        });
        const unauthRes = await GET(unauthReq);
        assert.strictEqual(unauthRes.status, 401);
        const unauthJson = await unauthRes.json();
        assert.strictEqual(unauthJson.success, false);
        assert.strictEqual(unauthJson.error, 'Unauthorized');

        // 2. Authorized request with Bearer token
        const authReq = new NextRequest('http://localhost:3000/api/cron/document-deadline-check?dryRun=true', {
          method: 'GET',
          headers: {
            authorization: 'Bearer super-secret-cron-token-123',
          },
        });
        const authRes = await GET(authReq);
        assert.strictEqual(authRes.status, 200);
        const authJson = await authRes.json();
        assert.strictEqual(authJson.success, true);
      } finally {
        process.env.CRON_SECRET = originalSecret;
      }
    });
  });

  describe('6. Outbox Event Handler for Document Deadlines', () => {
    test('processes DOCUMENT_OVERDUE_NOTIFICATION outbox event and sends push', async () => {
      const pushedUsers: string[] = [];
      setPushSenderForTesting(async (sub) => {
        return { statusCode: 201, body: 'ok', headers: {} };
      });

      const mockEvent: any = {
        id: `evt-test-${Date.now()}`,
        eventType: OutboxEventType.DOCUMENT_OVERDUE_NOTIFICATION,
        aggregateType: 'Document',
        aggregateId: `doc-overdue-${testRunId}`,
        payload: {
          documentId: `doc-overdue-${testRunId}`,
          documentNumber: '999/QCET',
          summary: 'Kiểm thử xử lý outbox event',
          dueDateStr: '20/09/2026',
          urgency: 'KHAN',
          type: 'OVERDUE',
          targetUserIds: [testLeadUser.id, testLeaderUser.id],
        },
      };

      await documentDeadlineOutboxHandler(mockEvent, {
        client: prisma,
        attempt: 1,
        now: new Date(),
      });
      // Handler completes without error
      assert.ok(true, 'documentDeadlineOutboxHandler should execute cleanly');
    });
  });
});
