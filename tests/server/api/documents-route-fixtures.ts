/**
 * Fixture dùng chung cho các test route văn bản `tests/server/api/documents-*.test.ts`.
 *
 * Mỗi lần gọi `createDocumentRouteFixture` có một runId riêng (thời điểm + ngẫu nhiên); đơn vị, người dùng,
 * văn bản, tệp đều do test tạo và `cleanup()` chỉ xóa đúng các id đã ghi nhận (kèm nhật ký, outbox,
 * thông báo phát sinh theo id văn bản/tệp/người dùng của fixture). Không dựa vào dữ liệu seed, ngoài
 * danh mục chức danh (`PositionDefinition`) có sẵn; nếu thiếu thì tạo và chỉ xóa bản do mình tạo.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { NextRequest } from "next/server";
import {
  AssignmentStatus,
  AssignmentType,
  DocumentSecurityLevel,
  DocumentStatus,
  DocumentType,
  DocumentUrgency,
  IncomingDocumentStatus,
  JobCatalogGroup,
  OutgoingDocumentStatus,
  UnitStatus,
  UnitType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { signSessionToken } from "@/lib/jwt-session";
import { resolveSafeFilePath } from "@/server/files/storage";

export const BASE_URL = "http://localhost:3000";
export const DAY_MS = 86_400_000;
export const PROBLEM_JSON = "application/problem+json";

export interface FixtureUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
}

export interface FixtureDocumentOptions {
  registeredById: string;
  type?: DocumentType;
  /** Có giá trị (kể cả `null`) thì tạo workflow văn bản đến với đơn vị chủ trì này. */
  leadUnitId?: string | null;
  incomingStatus?: IncomingDocumentStatus;
  /** Có giá trị thì tạo workflow văn bản đi ở trạng thái này. */
  outgoingStatus?: OutgoingDocumentStatus;
  /** Thời điểm tạo workflow văn bản đi (danh sách văn bản đi sắp theo cột này). */
  outgoingCreatedAt?: Date;
  status?: DocumentStatus;
  securityLevel?: DocumentSecurityLevel;
  notes?: string;
  summary?: string;
}

const POSITION_DEFAULTS: Record<string, { title: string; group: JobCatalogGroup; isLeadership: boolean }> = {
  CHUYEN_VIEN: { title: "Chuyên viên", group: JobCatalogGroup.VCDC, isLeadership: false },
  TRUONG_PHONG: { title: "Trưởng phòng", group: JobCatalogGroup.LDPU, isLeadership: true },
  VAN_THU: { title: "Văn thư", group: JobCatalogGroup.HTPV, isLeadership: false },
};

function defaultPositionCode(role: UserRole): string {
  if (role === UserRole.TRUONG_PHONG) return "TRUONG_PHONG";
  if (role === UserRole.VAN_THU) return "VAN_THU";
  return "CHUYEN_VIEN";
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

export function getRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${BASE_URL}${path}`, { headers });
}

/** Request có body JSON; `rawBody` gửi nguyên văn (để thử body rỗng/sai định dạng). */
export function jsonRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: string;
    contentType?: string | null;
  } = {}
): NextRequest {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  const contentType = options.contentType === undefined ? "application/json" : options.contentType;
  if (contentType) headers["Content-Type"] = contentType;
  const body = options.rawBody !== undefined ? options.rawBody : JSON.stringify(options.body ?? {});
  return new NextRequest(`${BASE_URL}${path}`, { method: options.method ?? "POST", headers, body });
}

export function createDocumentRouteFixture(label: string) {
  const runId = `${label}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const created = {
    users: [] as string[],
    units: [] as string[],
    assignments: [] as string[],
    documents: [] as string[],
    tasks: [] as string[],
    fileObjects: [] as string[],
    positionDefinitions: [] as string[],
  };
  let seq = 0;

  async function positionDefinitionId(code: string): Promise<string> {
    const existing = await prisma.positionDefinition.findUnique({ where: { code }, select: { id: true } });
    if (existing) return existing.id;
    const defaults = POSITION_DEFAULTS[code];
    const def = await prisma.positionDefinition.create({
      data: { code, title: defaults.title, group: defaults.group, isLeadership: defaults.isLeadership },
    });
    created.positionDefinitions.push(def.id);
    return def.id;
  }

  async function unit(key: string): Promise<string> {
    const code = `${runId}_${key}`;
    if (code.length > 50) throw new Error(`Mã đơn vị fixture quá dài: ${code}`);
    const row = await prisma.organizationalUnit.create({
      data: { code, name: `Đơn vị kiểm thử ${key} ${runId}`, type: UnitType.DEPARTMENT, status: UnitStatus.ACTIVE },
    });
    created.units.push(row.id);
    return row.id;
  }

  /** Người dùng có vai trò trong DB; có `unitId` thì kèm phân công chính đang hiệu lực (bắt đầu từ 30 ngày trước). */
  async function user(
    key: string,
    options: { role?: UserRole; unitId?: string; positionCode?: string } = {}
  ): Promise<FixtureUser> {
    const role = options.role ?? UserRole.CHUYEN_VIEN;
    const row = await prisma.user.create({
      data: { email: `${runId}_${key}@qcet-test.edu.vn`.toLowerCase(), name: `Kiểm thử ${key} ${runId}`, role },
    });
    created.users.push(row.id);
    if (options.unitId) {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: row.id,
          unitId: options.unitId,
          positionDefinitionId: await positionDefinitionId(options.positionCode ?? defaultPositionCode(role)),
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date(Date.now() - 30 * DAY_MS),
        },
      });
      created.assignments.push(assignment.id);
    }
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role,
      token: signSessionToken({ id: row.id, email: row.email, name: row.name, role }),
    };
  }

  async function document(options: FixtureDocumentOptions) {
    seq += 1;
    const row = await prisma.document.create({
      data: {
        type: options.type ?? DocumentType.VAN_BAN_DEN,
        documentYear: new Date().getFullYear(),
        // Số âm ngẫu nhiên: không đụng dãy số thật do test khác cấp song song (unique theo loại/năm/số).
        registrationNumber: -crypto.randomInt(1, 2_000_000_000),
        originalNumber: `${runId}/${seq}`,
        issuedDate: new Date(Date.now() - 2 * DAY_MS),
        issuingAuthority: "Sở Giáo dục và Đào tạo",
        category: "Công văn",
        summary: options.summary ?? `Văn bản kiểm thử ${runId} số ${seq}`,
        urgency: DocumentUrgency.THUONG,
        status: options.status ?? DocumentStatus.CHO_PHAN_CONG,
        securityLevel: options.securityLevel ?? DocumentSecurityLevel.THUONG,
        notes: options.notes,
        registeredById: options.registeredById,
        ...(options.leadUnitId !== undefined
          ? {
              incomingWorkflow: {
                create: {
                  leadUnitId: options.leadUnitId,
                  status: options.incomingStatus ?? IncomingDocumentStatus.REGISTERED,
                },
              },
            }
          : {}),
        ...(options.outgoingStatus
          ? {
              outgoingWorkflow: {
                create: {
                  status: options.outgoingStatus,
                  ...(options.outgoingCreatedAt ? { createdAt: options.outgoingCreatedAt } : {}),
                },
              },
            }
          : {}),
      },
    });
    created.documents.push(row.id);
    return row;
  }

  function trackFileObject(id: string) {
    if (!created.fileObjects.includes(id)) created.fileObjects.push(id);
  }

  function trackTask(id: string) {
    created.tasks.push(id);
  }

  /** Xóa đúng các bản ghi fixture; gọi trước khi khôi phục `UPLOADS_DIR` để xóa được tệp trên đĩa. */
  async function cleanup() {
    const docIds = created.documents;
    const userIds = created.users;
    const fileIds = created.fileObjects;
    const entityIds = [...docIds, ...fileIds];

    if (userIds.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    }
    if (docIds.length > 0) {
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: docIds } } });
      // Sự kiện văn bản của fixture có thể đã được worker của test khác xử lý: thông báo gửi người ngoài
      // fixture mang liên kết `/documents?id=<id văn bản>`, xóa theo đúng id văn bản đã tạo.
      await prisma.notification.deleteMany({ where: { OR: docIds.map((id) => ({ linkHref: { contains: id } })) } });
    }
    if (entityIds.length > 0 || userIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { OR: [{ entityId: { in: entityIds } }, { actorId: { in: userIds } }] },
      });
    }
    if (docIds.length > 0) {
      await prisma.document.updateMany({ where: { id: { in: docIds } }, data: { linkedTaskId: null } });
      await prisma.documentUnitReturn.deleteMany({ where: { documentId: { in: docIds } } });
      await prisma.documentAttachment.deleteMany({ where: { documentId: { in: docIds } } });
      await prisma.document.deleteMany({ where: { id: { in: docIds } } });
    }
    if (created.tasks.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: created.tasks } } });
    }
    if (fileIds.length > 0) {
      const files = await prisma.fileObject.findMany({ where: { id: { in: fileIds } }, select: { storageKey: true } });
      await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } });
      for (const file of files) {
        try {
          fs.rmSync(resolveSafeFilePath(file.storageKey), { force: true });
        } catch {
          // Khóa lưu trữ do test tự đặt có thể không nằm trong thư mục tải lên; bản ghi đã được xóa.
        }
      }
    }
    if (created.assignments.length > 0) {
      await prisma.positionAssignment.deleteMany({ where: { id: { in: created.assignments } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (created.units.length > 0) {
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: created.units } } });
    }
    if (created.positionDefinitions.length > 0) {
      await prisma.positionDefinition.deleteMany({
        where: { id: { in: created.positionDefinitions }, assignments: { none: {} } },
      });
    }
  }

  return { runId, created, unit, user, document, trackFileObject, trackTask, cleanup };
}
