/**
 * GET /api/documents/incoming chỉ liệt kê văn bản người xem được đọc (`buildDocumentReadWhere`,
 * ngữ cảnh phân quyền đầy đủ), lọc trước phân trang để `total` không lộ số lượng.
 * Danh sách phải khớp theo id với GET /api/documents cho cùng người dùng (cùng điều kiện đọc).
 * Chạy trên qcet_test, chỉ xóa bản ghi do test tạo.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  AssignmentStatus,
  AssignmentType,
  DocumentSecurityLevel,
  DocumentType,
  IncomingDocumentStatus,
  JobCatalogGroup,
  UnitType,
  UserRole,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { signSessionToken } from "../src/lib/jwt-session";
import { GET as listIncomingRoute } from "../src/app/api/documents/incoming/route";
import { GET as listDocumentsRoute } from "../src/app/api/documents/route";

const runId = `incacl${Date.now()}${Math.floor(Math.random() * 1000)}`;
const unit: Record<"A" | "B", string> = { A: "", B: "" };
const users: Record<string, { id: string; email: string; name: string; role: UserRole }> = {};
const docs: Record<"thuong" | "mat" | "tuyetMat", string> = { thuong: "", mat: "", tuyetMat: "" };
let positionDefinitionId = "";
let regSeq = 900_000_000 + Math.floor(Math.random() * 90_000_000);

const tokenOf = (key: string) => {
  const u = users[key];
  return signSessionToken({ id: u.id, email: u.email, name: u.name, role: u.role });
};

async function listIncoming(key: string | null, params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/documents/incoming");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const req = new NextRequest(url, {
    headers: key ? { Authorization: `Bearer ${tokenOf(key)}` } : {},
  });
  return listIncomingRoute(req);
}

async function visibleIncoming(key: string, params: Record<string, string> = {}) {
  const res = await listIncoming(key, { search: runId, ...params });
  assert.equal(res.status, 200);
  const body = await res.json();
  return { total: body.total as number, ids: (body.items as Array<{ documentId: string }>).map((i) => i.documentId) };
}

async function visibleInDocumentList(key: string) {
  const url = `http://localhost:3000/api/documents?type=VAN_BAN_DEN&search=${runId}`;
  const res = await listDocumentsRoute(new NextRequest(url, { headers: { Authorization: `Bearer ${tokenOf(key)}` } }));
  assert.equal(res.status, 200);
  const body = await res.json();
  return (body.documents as Array<{ id: string }>).map((d) => d.id);
}

async function makeDoc(securityLevel: DocumentSecurityLevel, leadUserId?: string) {
  const seq = regSeq++;
  const doc = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: seq,
      documentYear: new Date().getFullYear(),
      originalNumber: `${runId}/${seq}`,
      issuedDate: new Date(Date.now() - 2 * 86_400_000),
      issuingAuthority: "Sở Giáo dục và Đào tạo",
      category: "Công văn",
      summary: `Công văn kiểm thử phạm vi đọc ${runId} ${securityLevel}`,
      securityLevel,
      // Người vào sổ là BGH (đã đọc được nhờ vai trò): văn thư và thành viên đơn vị chỉ thấy văn bản nhờ nhánh của
      // chính mình (vai trò VAN_THU, đơn vị chủ trì), không nhờ nhánh registeredById.
      registeredById: users.bgh.id,
      leadUserId,
      incomingWorkflow: {
        create: {
          status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
          leadUnitId: unit.A,
          leaderId: users.bgh.id,
        },
      },
    },
  });
  return doc.id;
}

describe("GET /api/documents/incoming: phạm vi đọc văn bản đến", () => {
  before(async () => {
    for (const key of ["A", "B"] as const) {
      const created = await prisma.organizationalUnit.create({
        data: { code: `${runId}_${key}`.slice(0, 50), name: `Đơn vị ${key} ${runId}`, type: UnitType.DEPARTMENT },
      });
      unit[key] = created.id;
    }

    const position = await prisma.positionDefinition.create({
      data: { code: `POS_${runId}`.toUpperCase(), title: `Chuyên viên ${runId}`, group: JobCatalogGroup.VCMN, isLeadership: false },
    });
    positionDefinitionId = position.id;

    const roles: Record<string, UserRole> = {
      clerk: UserRole.VAN_THU,
      bgh: UserRole.BAN_GIAM_HIEU,
      outsider: UserRole.CHUYEN_VIEN,
      memberA: UserRole.CHUYEN_VIEN,
      concA: UserRole.CHUYEN_VIEN,
      leadUser: UserRole.CHUYEN_VIEN,
    };
    for (const [key, role] of Object.entries(roles)) {
      const created = await prisma.user.create({
        data: { email: `${runId}_${key}@qcet.edu.vn`, name: `${runId} ${key}`, role },
      });
      users[key] = { id: created.id, email: created.email, name: created.name, role };
    }

    const assignments: Array<[string, string, AssignmentType]> = [
      ["outsider", unit.B, AssignmentType.PRIMARY],
      ["memberA", unit.A, AssignmentType.PRIMARY],
      ["concA", unit.B, AssignmentType.PRIMARY],
      ["concA", unit.A, AssignmentType.CONCURRENT],
    ];
    for (const [key, unitId, type] of assignments) {
      await prisma.positionAssignment.create({
        data: {
          userId: users[key].id,
          positionDefinitionId,
          unitId,
          type,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date(Date.now() - 86_400_000),
        },
      });
    }

    docs.thuong = await makeDoc(DocumentSecurityLevel.THUONG, users.leadUser.id);
    docs.mat = await makeDoc(DocumentSecurityLevel.MAT);
    docs.tuyetMat = await makeDoc(DocumentSecurityLevel.TUYET_MAT);
  });

  after(async () => {
    const docIds = Object.values(docs).filter(Boolean);
    const userIds = Object.values(users).map((u) => u.id);
    await prisma.document.deleteMany({ where: { id: { in: docIds } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: userIds } } });
    if (positionDefinitionId) await prisma.positionDefinition.deleteMany({ where: { id: positionDefinitionId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: Object.values(unit).filter(Boolean) } } });
  });

  it("chưa đăng nhập: 401 problem+json AUTH_REQUIRED", async () => {
    const res = await listIncoming(null, { search: runId });
    assert.equal(res.status, 401);
    assert.match(res.headers.get("content-type") ?? "", /application\/problem\+json/);
    const body = await res.json();
    assert.equal(body.code, "AUTH_REQUIRED");
    assert.equal(body.instance, "/api/documents/incoming");
  });

  it("người ngoài đơn vị không thấy văn bản nào, kể cả khi lọc theo đơn vị chủ trì hay lãnh đạo; total không lộ", async () => {
    assert.deepEqual(await visibleIncoming("outsider"), { total: 0, ids: [] });
    assert.deepEqual(await visibleIncoming("outsider", { leaderId: users.bgh.id }), { total: 0, ids: [] });

    // Không có `search`: nhánh lọc chỉ gồm ACL và bộ lọc của client.
    const paramSets: Array<Record<string, string>> = [{ leadUnitId: unit.A, limit: "1", offset: "0" }, {}];
    for (const params of paramSets) {
      const res = await listIncoming("outsider", params);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.total, 0);
      assert.deepEqual(body.items, []);
    }
  });

  it("thành viên đơn vị, người kiêm nhiệm, người thụ lý, văn thư và BGH: khớp GET /api/documents, không ai thấy TUYET_MAT", async () => {
    for (const key of ["memberA", "concA", "leadUser", "clerk", "bgh"]) {
      const { total, ids } = await visibleIncoming(key);
      assert.ok(ids.includes(docs.thuong), `${key} phải thấy văn bản THUONG của đơn vị chủ trì`);
      assert.ok(!ids.includes(docs.tuyetMat), `${key} không được thấy văn bản TUYET_MAT`);
      assert.equal(total, ids.length, `${key}: total phải đếm cùng điều kiện với danh sách`);
      assert.deepEqual([...ids].sort(), [...(await visibleInDocumentList(key))].sort(), `${key}: danh sách lệch GET /api/documents`);
    }
    // Người thụ lý chỉ có quan hệ với văn bản được giao.
    assert.deepEqual((await visibleIncoming("leadUser")).ids, [docs.thuong]);
  });

  it("phân trang áp sau ACL: total là số văn bản người xem được đọc", async () => {
    const expected = await visibleInDocumentList("memberA");
    const page = await visibleIncoming("memberA", { limit: "1", offset: "0" });
    assert.equal(page.ids.length, 1);
    assert.equal(page.total, expected.length);
  });
});
