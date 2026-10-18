/**
 * Test đặc tả (characterization) mức route cho /api/dossiers/[id]/items (GET/POST/DELETE):
 * ranh giới xác thực, quyền theo vai trò người phụ trách / người đóng góp / thành viên đơn vị / người ngoài,
 * hồ sơ hoặc mục không tồn tại, hồ sơ đã đóng và validate đầu vào.
 * Không trùng tests/work-dossier-archive.test.ts (luồng chính), tests/dossier-disposal.test.ts (hồ sơ đã hủy),
 * tests/security/nested-resource-mismatch.test.ts (mục thuộc hồ sơ khác, assert 403|404 lỏng).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { DossierStatus, JobCatalogGroup, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { GET as listItems, POST as addItem, DELETE as removeItem } from "@/app/api/dossiers/[id]/items/route";

type Role = "owner" | "contributor" | "member" | "outsider";

const BASE = "http://localhost:3000";
const PROBLEM_JSON = /application\/problem\+json/;

describe("Route /api/dossiers/[id]/items: các nhánh quyền và lỗi", () => {
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const tag = runId.replace(/[^0-9a-z]/gi, "").slice(-12);

  const users = {} as Record<Role, { id: string; name: string; token: string }>;
  let unitId = "";
  let otherUnitId = "";
  let positionDefinitionId = "";
  let dossierId = "";
  let otherDossierId = "";
  let closedDossierId = "";
  let ownerItemId = "";
  let contributorItemId = "";
  let contributorRemovableItemId = "";
  let otherDossierItemId = "";
  let closedItemId = "";
  const createdItemIds: string[] = [];

  const titles = {
    owner: `Muc cua nguoi phu trach ${runId}`,
    contributor: `Muc cua nguoi dong gop ${runId}`,
    removable: `Muc dong gop se bi go ${runId}`,
    other: `Muc cua ho so khac ${runId}`,
  };

  const itemsUrl = (id: string, query = "") => `${BASE}/api/dossiers/${id}/items${query}`;
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const auth = (role: Role) => ({ Authorization: `Bearer ${users[role].token}` });

  function getReq(id: string, role?: Role) {
    return new NextRequest(itemsUrl(id), { headers: role ? auth(role) : {} });
  }

  function postReq(id: string, body: unknown, role?: Role, extraHeaders: Record<string, string> = {}) {
    return new NextRequest(itemsUrl(id), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(role ? auth(role) : {}), ...extraHeaders },
      body: JSON.stringify(body),
    });
  }

  function deleteReq(id: string, query: string, role?: Role, body?: unknown) {
    return new NextRequest(itemsUrl(id, query), {
      method: "DELETE",
      headers: {
        ...(role ? auth(role) : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  async function itemCount(id: string) {
    return prisma.dossierItem.count({ where: { dossierId: id } });
  }

  before(async () => {
    const unit = await prisma.organizationalUnit.create({
      data: { code: `DIR_${tag}`, name: `Don vi ho so ${runId}`, type: UnitType.DEPARTMENT },
    });
    unitId = unit.id;
    const otherUnit = await prisma.organizationalUnit.create({
      data: { code: `DIRX_${tag}`, name: `Don vi khac ${runId}`, type: UnitType.DEPARTMENT },
    });
    otherUnitId = otherUnit.id;

    for (const role of ["owner", "contributor", "member", "outsider"] as const) {
      const user = await prisma.user.create({
        data: {
          email: `dir-${role}-${runId}@qcet.edu.vn`,
          name: `DIR ${role} ${runId}`,
          role: UserRole.CHUYEN_VIEN,
        },
      });
      users[role] = {
        id: user.id,
        name: user.name,
        token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }),
      };
    }

    // Thành viên đơn vị sở hữu: phân công chính đang hiệu lực, chức danh không lãnh đạo.
    const positionDefinition = await prisma.positionDefinition.create({
      data: { code: `PD_DIR_${tag}`, title: `Chuyen vien ${runId}`, group: JobCatalogGroup.VCDC, isLeadership: false },
    });
    positionDefinitionId = positionDefinition.id;
    await prisma.positionAssignment.create({
      data: {
        userId: users.member.id,
        unitId,
        positionDefinitionId,
        type: "PRIMARY",
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      },
    });

    const dossier = await prisma.workDossier.create({
      data: {
        code: `HS-DIR-${runId}`,
        title: `Ho so kiem thu muc ${runId}`,
        owningUnitId: unitId,
        responsiblePersonId: users.owner.id,
      },
    });
    dossierId = dossier.id;

    const otherDossier = await prisma.workDossier.create({
      data: {
        code: `HS-DIR-OTHER-${runId}`,
        title: `Ho so khac ${runId}`,
        owningUnitId: otherUnitId,
        responsiblePersonId: users.outsider.id,
      },
    });
    otherDossierId = otherDossier.id;

    const closedDossier = await prisma.workDossier.create({
      data: {
        code: `HS-DIR-CLOSED-${runId}`,
        title: `Ho so da dong ${runId}`,
        owningUnitId: unitId,
        responsiblePersonId: users.owner.id,
        status: DossierStatus.CLOSED,
        closedAt: new Date(Date.now() - 24 * 3600 * 1000),
      },
    });
    closedDossierId = closedDossier.id;

    ownerItemId = (await prisma.dossierItem.create({
      data: { dossierId, itemType: "RESULT", title: titles.owner, addedById: users.owner.id, sequence: 1 },
    })).id;
    contributorItemId = (await prisma.dossierItem.create({
      data: { dossierId, itemType: "ATTACHMENT", title: titles.contributor, addedById: users.contributor.id, sequence: 2 },
    })).id;
    contributorRemovableItemId = (await prisma.dossierItem.create({
      data: { dossierId, itemType: "ATTACHMENT", title: titles.removable, addedById: users.contributor.id, sequence: 3 },
    })).id;
    otherDossierItemId = (await prisma.dossierItem.create({
      data: { dossierId: otherDossierId, itemType: "RESULT", title: titles.other, addedById: users.outsider.id, sequence: 1 },
    })).id;
    closedItemId = (await prisma.dossierItem.create({
      data: { dossierId: closedDossierId, itemType: "RESULT", title: `Muc ho so da dong ${runId}`, addedById: users.owner.id, sequence: 1 },
    })).id;
  });

  after(async () => {
    const dossierIds = [dossierId, otherDossierId, closedDossierId].filter(Boolean);
    const userIds = Object.values(users).map((u) => u.id).filter(Boolean);
    const itemIds = [
      ownerItemId,
      contributorItemId,
      contributorRemovableItemId,
      otherDossierItemId,
      closedItemId,
      ...createdItemIds,
    ].filter(Boolean);
    try {
      if (itemIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { entityId: { in: itemIds } } });
      }
      if (dossierIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { entityId: { in: dossierIds } } });
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: dossierIds } } });
        await prisma.dossierItem.deleteMany({ where: { dossierId: { in: dossierIds } } });
        await prisma.workDossier.deleteMany({ where: { id: { in: dossierIds } } });
      }
      if (userIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.positionAssignment.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (positionDefinitionId) {
        await prisma.positionDefinition.deleteMany({ where: { id: positionDefinitionId } });
      }
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: [unitId, otherUnitId].filter(Boolean) } } });
    } catch (error) {
      console.error("Dọn fixture dossier-items-route-branches lỗi:", error);
    }
  });

  describe("GET", () => {
    test("chưa đăng nhập: 401 AUTH_REQUIRED dạng problem+json, không có danh sách mục", async () => {
      const res = await listItems(getReq(dossierId), ctx(dossierId));
      assert.equal(res.status, 401);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      const body = await res.json();
      assert.equal(body.code, "AUTH_REQUIRED");
      assert.equal(body.items, undefined);
      assert.ok(!JSON.stringify(body).includes(runId), "không lộ dữ liệu fixture");
    });

    test("người phụ trách: 200, thấy mọi mục theo thứ tự sequence kèm người thêm", async () => {
      const res = await listItems(getReq(dossierId, "owner"), ctx(dossierId));
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      const body = await res.json();
      assert.deepEqual(
        body.items.map((item: { id: string }) => item.id),
        [ownerItemId, contributorItemId, contributorRemovableItemId]
      );
      const contributorItem = body.items[1];
      assert.equal(contributorItem.title, titles.contributor);
      assert.equal(contributorItem.dossierId, dossierId);
      assert.equal(contributorItem.addedById, users.contributor.id);
      assert.deepEqual(contributorItem.addedBy, { id: users.contributor.id, name: users.contributor.name });
    });

    test("thành viên đơn vị sở hữu (hồ sơ INTERNAL): 200, thấy mọi mục", async () => {
      const res = await listItems(getReq(dossierId, "member"), ctx(dossierId));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(
        body.items.map((item: { id: string }) => item.id),
        [ownerItemId, contributorItemId, contributorRemovableItemId]
      );
    });

    test("người đóng góp ngoài đơn vị: 200 nhưng chỉ thấy mục do mình thêm (RFC-09 phương án B)", async () => {
      const res = await listItems(getReq(dossierId, "contributor"), ctx(dossierId));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(
        body.items.map((item: { id: string }) => item.id),
        [contributorItemId, contributorRemovableItemId]
      );
      assert.ok(body.items.every((item: { addedById: string }) => item.addedById === users.contributor.id));
      assert.ok(!JSON.stringify(body).includes(titles.owner), "không lộ mục của người khác");
    });

    test("người ngoài: 403 FORBIDDEN dạng problem+json, không lộ mục nào", async () => {
      const res = await listItems(getReq(dossierId, "outsider"), ctx(dossierId));
      assert.equal(res.status, 403);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      const body = await res.json();
      assert.equal(body.code, "FORBIDDEN");
      assert.equal(body.status, 403);
      assert.equal(body.instance, `/api/dossiers/${dossierId}/items`);
      assert.equal(body.items, undefined);
      for (const title of [titles.owner, titles.contributor, titles.removable]) {
        assert.ok(!JSON.stringify(body).includes(title), "không lộ tiêu đề mục");
      }
    });

    test("hồ sơ không tồn tại: 404 NOT_FOUND dạng problem+json", async () => {
      const missingId = `missing-${runId}`;
      const res = await listItems(getReq(missingId, "owner"), ctx(missingId));
      assert.equal(res.status, 404);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      const body = await res.json();
      assert.equal(body.code, "NOT_FOUND");
      assert.equal(body.instance, `/api/dossiers/${missingId}/items`);
      assert.equal(body.items, undefined);
    });
  });

  describe("POST", () => {
    const newItem = (title: string) => ({ itemType: "RESULT", title: `  ${title}  `, pageCount: 3, notes: "ghi chu" });

    test("chưa đăng nhập: 401 AUTH_REQUIRED, không tạo mục", async () => {
      const before = await itemCount(dossierId);
      const res = await addItem(postReq(dossierId, newItem(`Khong dang nhap ${runId}`)), ctx(dossierId));
      assert.equal(res.status, 401);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      assert.equal((await res.json()).code, "AUTH_REQUIRED");
      assert.equal(await itemCount(dossierId), before);
    });

    test("phiên cookie từ origin lạ: 403 CSRF_VALIDATION_FAILED, không tạo mục", async () => {
      const before = await itemCount(dossierId);
      const req = new NextRequest(itemsUrl(dossierId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${users.owner.token}`,
          Origin: "https://evil.example.com",
        },
        body: JSON.stringify(newItem(`CSRF ${runId}`)),
      });
      const res = await addItem(req, ctx(dossierId));
      assert.equal(res.status, 403);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      assert.equal((await res.json()).code, "CSRF_VALIDATION_FAILED");
      assert.equal(await itemCount(dossierId), before);
    });

    for (const role of ["contributor", "member", "outsider"] as const) {
      test(`${role} không phải người phụ trách: 403 INSUFFICIENT_CAPABILITY, không tạo mục`, async () => {
        const before = await itemCount(dossierId);
        const res = await addItem(postReq(dossierId, newItem(`Them boi ${role} ${runId}`), role), ctx(dossierId));
        assert.equal(res.status, 403);
        assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
        const body = await res.json();
        assert.equal(body.code, "INSUFFICIENT_CAPABILITY");
        assert.equal(body.id, undefined);
        assert.equal(await itemCount(dossierId), before);
      });
    }

    test("body có trường lạ (schema strict): 400 VALIDATION_ERROR kèm invalidParams, không tạo mục", async () => {
      const before = await itemCount(dossierId);
      const res = await addItem(
        postReq(dossierId, { ...newItem(`Truong la ${runId}`), addedById: users.outsider.id }, "owner"),
        ctx(dossierId)
      );
      assert.equal(res.status, 400);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      const body = await res.json();
      assert.equal(body.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(body.invalidParams) && body.invalidParams.length > 0);
      assert.equal(await itemCount(dossierId), before);
    });

    test("thiếu tiêu đề và itemType sai: 400 VALIDATION_ERROR nêu đúng trường", async () => {
      const res = await addItem(postReq(dossierId, { itemType: "KHONG_HOP_LE" }, "owner"), ctx(dossierId));
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.code, "VALIDATION_ERROR");
      const names = body.invalidParams.map((p: { name: string }) => p.name);
      assert.ok(names.includes("itemType"), `invalidParams: ${names.join(",")}`);
      assert.ok(names.includes("title"), `invalidParams: ${names.join(",")}`);
    });

    test("hồ sơ không tồn tại: 404 NOT_FOUND", async () => {
      const missingId = `missing-${runId}`;
      const res = await addItem(postReq(missingId, newItem(`Ho so thieu ${runId}`), "owner"), ctx(missingId));
      assert.equal(res.status, 404);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      const body = await res.json();
      assert.equal(body.code, "NOT_FOUND");
      assert.equal(body.id, undefined);
    });

    test("hồ sơ đã đóng: 409 INVALID_TRANSITION, không tạo mục", async () => {
      const before = await itemCount(closedDossierId);
      const res = await addItem(postReq(closedDossierId, newItem(`Ho so dong ${runId}`), "owner"), ctx(closedDossierId));
      assert.equal(res.status, 409);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      assert.equal((await res.json()).code, "INVALID_TRANSITION");
      assert.equal(await itemCount(closedDossierId), before);
    });

    test("người phụ trách: 201, mục mới nối tiếp sequence, hồ sơ OPEN chuyển ACTIVE, ghi audit", async () => {
      const title = `Muc moi cua nguoi phu trach ${runId}`;
      const res = await addItem(postReq(dossierId, newItem(title), "owner"), ctx(dossierId));
      assert.equal(res.status, 201);
      const body = await res.json();
      createdItemIds.push(body.id);
      assert.equal(body.dossierId, dossierId);
      assert.equal(body.title, title, "tiêu đề được trim");
      assert.equal(body.itemType, "RESULT");
      assert.equal(body.addedById, users.owner.id);
      assert.equal(body.sequence, 4);
      assert.equal(body.pageCount, 3);
      assert.equal(body.notes, "ghi chu");
      assert.equal(body.fileObjectId, null);

      const stored = await prisma.dossierItem.findUnique({ where: { id: body.id } });
      assert.ok(stored);
      assert.equal(stored.dossierId, dossierId);
      const dossier = await prisma.workDossier.findUniqueOrThrow({ where: { id: dossierId } });
      assert.equal(dossier.status, DossierStatus.ACTIVE);
      const audit = await prisma.auditEvent.findFirst({ where: { entityId: body.id, action: "DOSSIER_ITEM_ADDED" } });
      assert.ok(audit, "có audit DOSSIER_ITEM_ADDED");
      assert.equal(audit.actorId, users.owner.id);
    });
  });

  describe("DELETE", () => {
    test("chưa đăng nhập: 401 AUTH_REQUIRED, mục còn nguyên", async () => {
      const res = await removeItem(deleteReq(dossierId, `?itemId=${contributorItemId}`), ctx(dossierId));
      assert.equal(res.status, 401);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      assert.equal((await res.json()).code, "AUTH_REQUIRED");
      assert.ok(await prisma.dossierItem.findUnique({ where: { id: contributorItemId } }));
    });

    test("thiếu itemId (không query, không body): 400 VALIDATION_ERROR", async () => {
      const res = await removeItem(deleteReq(dossierId, "", "owner"), ctx(dossierId));
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.code, "VALIDATION_ERROR");
      assert.equal(body.success, false);
      // Nhánh kiểm thiếu itemId riêng của route (không phải lỗi Zod "Validation failed" khi parse null).
      assert.equal(body.message, "itemId parameter is required");
    });

    test("itemId dài quá 128 ký tự: 400 VALIDATION_ERROR dạng problem+json", async () => {
      const res = await removeItem(deleteReq(dossierId, `?itemId=${"x".repeat(129)}`, "owner"), ctx(dossierId));
      assert.equal(res.status, 400);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      assert.equal((await res.json()).code, "VALIDATION_ERROR");
    });

    test("người đóng góp gỡ chính mục của mình: 403 INSUFFICIENT_CAPABILITY, mục còn nguyên", async () => {
      const res = await removeItem(deleteReq(dossierId, `?itemId=${contributorItemId}`, "contributor"), ctx(dossierId));
      assert.equal(res.status, 403);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      const body = await res.json();
      assert.equal(body.code, "INSUFFICIENT_CAPABILITY");
      assert.equal(body.success, false);
      assert.ok(await prisma.dossierItem.findUnique({ where: { id: contributorItemId } }));
    });

    for (const role of ["member", "outsider"] as const) {
      test(`${role} gỡ mục của hồ sơ: 403 INSUFFICIENT_CAPABILITY, mục còn nguyên`, async () => {
        const res = await removeItem(deleteReq(dossierId, `?itemId=${ownerItemId}`, role), ctx(dossierId));
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, "INSUFFICIENT_CAPABILITY");
        assert.ok(!JSON.stringify(body).includes(titles.owner));
        assert.ok(await prisma.dossierItem.findUnique({ where: { id: ownerItemId } }));
      });
    }

    test("mục không tồn tại: 404 NOT_FOUND", async () => {
      const res = await removeItem(deleteReq(dossierId, `?itemId=missing-${runId}`, "owner"), ctx(dossierId));
      assert.equal(res.status, 404);
      assert.match(res.headers.get("content-type") ?? "", PROBLEM_JSON);
      assert.equal((await res.json()).code, "NOT_FOUND");
    });

    test("mục thuộc hồ sơ khác: 404 NOT_FOUND, không lộ và không xóa mục kia", async () => {
      const res = await removeItem(deleteReq(dossierId, `?itemId=${otherDossierItemId}`, "owner"), ctx(dossierId));
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.code, "NOT_FOUND");
      assert.ok(!JSON.stringify(body).includes(titles.other));
      assert.ok(await prisma.dossierItem.findUnique({ where: { id: otherDossierItemId } }));
    });

    test("hồ sơ trên URL không tồn tại dù mục có thật: 404 NOT_FOUND, mục còn nguyên", async () => {
      const missingId = `missing-${runId}`;
      const res = await removeItem(deleteReq(missingId, `?itemId=${ownerItemId}`, "owner"), ctx(missingId));
      assert.equal(res.status, 404);
      assert.equal((await res.json()).code, "NOT_FOUND");
      assert.ok(await prisma.dossierItem.findUnique({ where: { id: ownerItemId } }));
    });

    test("hồ sơ đã đóng: 409 INVALID_TRANSITION, mục còn nguyên", async () => {
      const res = await removeItem(deleteReq(closedDossierId, `?itemId=${closedItemId}`, "owner"), ctx(closedDossierId));
      assert.equal(res.status, 409);
      assert.equal((await res.json()).code, "INVALID_TRANSITION");
      assert.ok(await prisma.dossierItem.findUnique({ where: { id: closedItemId } }));
    });

    test("người phụ trách gỡ mục của người đóng góp qua itemId trong body JSON: 200, mục bị xóa, ghi audit", async () => {
      const res = await removeItem(
        deleteReq(dossierId, "", "owner", { itemId: contributorRemovableItemId }),
        ctx(dossierId)
      );
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { success: true });
      assert.equal(await prisma.dossierItem.findUnique({ where: { id: contributorRemovableItemId } }), null);
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: contributorRemovableItemId, action: "DOSSIER_ITEM_REMOVED" },
      });
      assert.ok(audit, "có audit DOSSIER_ITEM_REMOVED");
      assert.equal(audit.actorId, users.owner.id);
    });
  });
});
