/**
 * V-07 (spec task-document-gap-spec.md): xét hủy, gia hạn bảo quản và xóa hẳn hồ sơ; nhắc hồ sơ.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, DossierStatus, JobCatalogGroup, UnitType, UserRole } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { DossierService } from '../src/lib/services/dossier-service';
import {
  decideDisposal,
  getDisposalState,
  proposeDisposal,
  purgeDossier,
} from '../src/server/dossiers/dossier-disposal-service';
import { scanDossierReminders } from '../src/server/dossiers/dossier-reminder-scanner';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { ApiError, ConflictError, ValidationError } from '../src/server/api/errors';

const runId = `v07_${Date.now()}`;
const u: Record<string, string> = {};
let unitId = '';
let ruleId = '';
let permanentRuleId = '';
const dossiers: string[] = [];
const createdPositions: string[] = [];

const NOW = new Date('2026-10-10T08:00:00Z');
const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

async function ensurePosition(code: string, group: JobCatalogGroup) {
  const existing = await prisma.positionDefinition.findUnique({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.positionDefinition.create({ data: { code, title: code, group, isLeadership: group === JobCatalogGroup.LDPU } });
  createdPositions.push(created.id);
  return created.id;
}

async function makeDossier(key: string, data: { status?: DossierStatus; archivedAt?: Date | null; closedAt?: Date | null; rule?: string | null; extra?: number } = {}) {
  const d = await prisma.workDossier.create({
    data: {
      code: `${runId}_${key}`.slice(0, 100),
      title: `Hồ sơ ${key}`,
      owningUnitId: unitId,
      responsiblePersonId: u.owner,
      status: data.status ?? DossierStatus.ARCHIVED,
      archivedAt: data.archivedAt === undefined ? new Date('2020-01-01T00:00:00Z') : data.archivedAt,
      closedAt: data.closedAt ?? null,
      retentionRuleId: data.rule === undefined ? ruleId : data.rule,
      retentionExtraYears: data.extra ?? 0,
    },
  });
  dossiers.push(d.id);
  return d.id;
}

describe('V-07 xét hủy và gia hạn bảo quản hồ sơ', () => {
  before(async () => {
    for (const [key, role] of [['owner', 'CHUYEN_VIEN'], ['clerk', 'VAN_THU'], ['rector', 'BAN_GIAM_HIEU'], ['admin', 'ADMIN'], ['staff', 'CHUYEN_VIEN']] as const) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: role as UserRole } });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị V-07', type: UnitType.DEPARTMENT } })).id;
    const clerkPos = await ensurePosition('VAN_THU', JobCatalogGroup.HTPV);
    const rectorPos = await ensurePosition('HIEU_TRUONG', JobCatalogGroup.LDPU);
    await prisma.positionAssignment.create({ data: { userId: u.clerk, positionDefinitionId: clerkPos, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: new Date('2020-01-01T00:00:00Z') } });
    await prisma.positionAssignment.create({ data: { userId: u.rector, positionDefinitionId: rectorPos, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: new Date('2020-01-01T00:00:00Z') } });
    ruleId = (await prisma.retentionRule.create({ data: { code: `${runId}_5Y`.slice(0, 50), name: 'Bảo quản 5 năm', durationYears: 5 } })).id;
    permanentRuleId = (await prisma.retentionRule.create({ data: { code: `${runId}_VV`.slice(0, 50), name: 'Vĩnh viễn', durationYears: null } })).id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: dossiers } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: dossiers } } });
    await prisma.workDossier.deleteMany({ where: { id: { in: dossiers } } });
    await prisma.retentionRule.deleteMany({ where: { id: { in: [ruleId, permanentRuleId] } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('chỉ Văn thư lập đề nghị; chuyên viên và người phụ trách không được', async () => {
    const id = await makeDossier('perm1');
    for (const key of ['staff', 'owner']) {
      await assert.rejects(proposeDisposal(session(key), id, { minutesReference: 'BB-01', reason: 'Hết hạn' }, NOW), forbidden);
    }
    const res = await proposeDisposal(session('clerk'), id, { minutesReference: 'BB-01/2026', reason: 'Hết hạn bảo quản 5 năm' }, NOW);
    assert.ok(res.proposalId);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'DOSSIER_DISPOSAL_PROPOSED' } }));
  });

  test('cần số biên bản và lý do; không lập hai đề nghị mở cùng lúc', async () => {
    const id = await makeDossier('perm2');
    await assert.rejects(proposeDisposal(session('clerk'), id, { minutesReference: '', reason: 'Hết hạn' }, NOW), ZodError);
    await assert.rejects(proposeDisposal(session('clerk'), id, { minutesReference: 'BB-02', reason: '' }, NOW), ZodError);
    await proposeDisposal(session('clerk'), id, { minutesReference: 'BB-02', reason: 'Hết hạn' }, NOW);
    await assert.rejects(
      proposeDisposal(session('clerk'), id, { minutesReference: 'BB-03', reason: 'Lập lại' }, NOW),
      (err: unknown) => err instanceof ConflictError && err.code === 'DISPOSAL_ALREADY_PROPOSED'
    );
  });

  test('không xét hủy hồ sơ chưa lưu trữ, chưa hết hạn, bảo quản vĩnh viễn hoặc chưa có thời hạn', async () => {
    const notArchived = await makeDossier('draft', { status: DossierStatus.CLOSED, archivedAt: null });
    const fresh = await makeDossier('fresh', { archivedAt: new Date('2024-01-01T00:00:00Z') });
    const forever = await makeDossier('forever', { rule: permanentRuleId });
    const noRule = await makeDossier('norule', { rule: null });
    const code = (id: string) => proposeDisposal(session('clerk'), id, { minutesReference: 'BB-X', reason: 'Thử' }, NOW).catch((e: ConflictError) => e.code);
    assert.equal(await code(notArchived), 'DOSSIER_NOT_ARCHIVED');
    assert.equal(await code(fresh), 'DOSSIER_RETENTION_NOT_EXPIRED');
    assert.equal(await code(forever), 'DOSSIER_RETENTION_PERMANENT');
    assert.equal(await code(noRule), 'DOSSIER_RETENTION_PERMANENT');
  });

  test('Văn thư không tự quyết định; lãnh đạo hủy: hồ sơ biến khỏi tra cứu thường (AC-V07-1, AC-V07-3)', async () => {
    const id = await makeDossier('dispose');
    const { proposalId } = await proposeDisposal(session('clerk'), id, { minutesReference: 'BB-10', reason: 'Hết hạn' }, NOW);
    await assert.rejects(decideDisposal(session('clerk'), id, { proposalId, decision: 'DISPOSE' }, NOW), forbidden);
    await assert.rejects(decideDisposal(session('staff'), id, { proposalId, decision: 'DISPOSE' }, NOW), forbidden);

    const res = await decideDisposal(session('rector'), id, { proposalId, decision: 'DISPOSE', note: 'Theo biên bản' }, NOW);
    assert.equal(res.disposed, true);
    assert.ok((await prisma.workDossier.findUniqueOrThrow({ where: { id } })).disposedAt);

    const list = await DossierService.listDossiers(session('rector'), { limit: 100 });
    assert.ok(!list.items.some((d) => d.id === id), 'không còn trong danh sách');
    await assert.rejects(DossierService.getDossierDetail(session('rector'), id), ApiError);
    await assert.rejects(decideDisposal(session('rector'), id, { proposalId, decision: 'DISPOSE' }, NOW), ApiError, 'hồ sơ đã hủy');
  });

  test('gia hạn bảo quản dời hạn hết hạn; vượt tổng 70 năm bị từ chối', async () => {
    const id = await makeDossier('extend');
    const { proposalId } = await proposeDisposal(session('clerk'), id, { minutesReference: 'BB-11', reason: 'Hết hạn' }, NOW);
    await assert.rejects(decideDisposal(session('rector'), id, { proposalId, decision: 'EXTEND' }, NOW), ValidationError, 'thiếu số năm');
    await assert.rejects(decideDisposal(session('rector'), id, { proposalId, decision: 'EXTEND', extendYears: 66 }, NOW), ValidationError, '5 + 66 > 70');

    const res = await decideDisposal(session('rector'), id, { proposalId, decision: 'EXTEND', extendYears: 3, note: 'Còn giá trị tra cứu' }, NOW);
    assert.equal(res.disposed, false);
    const row = await prisma.workDossier.findUniqueOrThrow({ where: { id } });
    assert.equal(row.retentionExtraYears, 3);
    assert.equal(row.disposedAt, null);

    // Lưu trữ từ 2020-01-01 + 5 + 3 năm = 2028: chưa hết hạn nên không lập đề nghị mới được nữa.
    await assert.rejects(
      proposeDisposal(session('clerk'), id, { minutesReference: 'BB-12', reason: 'Lập lại' }, NOW),
      (err: unknown) => err instanceof ConflictError && err.code === 'DOSSIER_RETENTION_NOT_EXPIRED'
    );
    await assert.rejects(decideDisposal(session('rector'), id, { proposalId, decision: 'DISPOSE' }, NOW), ConflictError, 'đề nghị đã quyết định');
    const state = await getDisposalState(session('clerk'), id, NOW);
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].extendYears, 3);
  });

  test('xóa hẳn: chỉ quản trị hệ thống, chỉ hồ sơ đã hủy có biên bản (AC-V07-2)', async () => {
    const id = await makeDossier('purge');
    for (const key of ['rector', 'clerk', 'staff', 'owner']) {
      await assert.rejects(purgeDossier(session(key), id, NOW), forbidden, key);
    }
    await assert.rejects(
      purgeDossier({ ...session('admin'), role: 'ADMIN' }, id, NOW),
      (err: unknown) => err instanceof ConflictError && err.code === 'DOSSIER_NOT_DISPOSED'
    );

    const { proposalId } = await proposeDisposal(session('clerk'), id, { minutesReference: 'BB-20/2026', reason: 'Hết hạn' }, NOW);
    await assert.rejects(purgeDossier({ ...session('admin'), role: 'ADMIN' }, id, NOW), ConflictError, 'chưa có quyết định hủy');
    await decideDisposal(session('rector'), id, { proposalId, decision: 'DISPOSE' }, NOW);

    const res = await purgeDossier({ ...session('admin'), role: 'ADMIN' }, id, NOW);
    assert.equal(res.purged, true);
    assert.equal(await prisma.workDossier.count({ where: { id } }), 0);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: id, action: 'DOSSIER_PURGED' } });
    assert.equal((audit.beforeData as { minutesReference: string }).minutesReference, 'BB-20/2026', 'nhật ký giữ số biên bản');
  });

  test('thông báo qua outbox: lãnh đạo nhận đề nghị, Văn thư nhận quyết định', async () => {
    const id = await makeDossier('notify');
    const { proposalId } = await proposeDisposal(session('clerk'), id, { minutesReference: 'BB-30', reason: 'Hết hạn' }, NOW);
    const proposed = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: 'DOSSIER_DISPOSAL_PROPOSED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [proposed.id] });
    assert.equal(await prisma.notification.count({ where: { userId: u.rector, type: 'dossier_disposal_proposed' } }), 1);

    await decideDisposal(session('rector'), id, { proposalId, decision: 'EXTEND', extendYears: 2 }, NOW);
    const decided = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: 'DOSSIER_DISPOSAL_DECIDED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [decided.id] });
    const notices = await prisma.notification.findMany({ where: { userId: u.clerk, type: 'dossier_disposal_decided' } });
    assert.equal(notices.length, 1);
    assert.match(notices[0].body, /Gia hạn thêm 2 năm/);
  });

  test('nhắc nộp lưu trước 30 ngày một lần cho người phụ trách (V-07)', async () => {
    const id = await makeDossier('submit', { status: DossierStatus.CLOSED, archivedAt: null, closedAt: new Date('2025-11-15T00:00:00Z') });
    // Hạn nộp 2026-11-15; trước 30 ngày là 2026-10-16.
    const early = await scanDossierReminders({ now: new Date('2026-10-15T08:00:00Z'), dossierIds: [id] });
    assert.equal(early.sent.SUBMIT_DEADLINE_30D ?? 0, 0, 'còn 31 ngày');

    const due = await scanDossierReminders({ now: new Date('2026-10-17T08:00:00Z'), dossierIds: [id] });
    assert.equal(due.sent.SUBMIT_DEADLINE_30D, 1);
    const again = await scanDossierReminders({ now: new Date('2026-10-18T08:00:00Z'), dossierIds: [id] });
    assert.equal(again.sent.SUBMIT_DEADLINE_30D ?? 0, 0, 'không nhắc lại');
    assert.equal(again.skippedDuplicate, 1);
    assert.equal(await prisma.notification.count({ where: { userId: u.owner, type: 'dossier_submit_deadline' } }), 1);
  });

  test('báo Văn thư khi hồ sơ hết hạn bảo quản, không báo khi đã có đề nghị mở hoặc vĩnh viễn', async () => {
    const expired = await makeDossier('exp');
    const proposed = await makeDossier('expProposed');
    const forever = await makeDossier('expForever', { rule: permanentRuleId });
    await proposeDisposal(session('clerk'), proposed, { minutesReference: 'BB-40', reason: 'Hết hạn' }, NOW);

    const res = await scanDossierReminders({ now: NOW, dossierIds: [expired, proposed, forever] });
    assert.equal(res.sent.RETENTION_EXPIRED, 1);
    const notices = await prisma.notification.findMany({ where: { userId: u.clerk, type: 'dossier_retention_expired' } });
    assert.equal(notices.length, 1);
    assert.match(notices[0].body, /Hồ sơ exp/);
    const again = await scanDossierReminders({ now: new Date('2026-10-11T08:00:00Z'), dossierIds: [expired] });
    assert.equal(again.sent.RETENTION_EXPIRED ?? 0, 0);
  });
});
