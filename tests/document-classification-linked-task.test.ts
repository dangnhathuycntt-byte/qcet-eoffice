import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DocumentSecurityLevel } from "@prisma/client";
import {
  canAccessClassification,
  type DocumentClassificationTarget,
} from "../src/server/authorization/document-classification";
import { AuthorizationContextModel } from "../src/server/authorization/authorization-context";
import { authorize } from "../src/server/authorization/authorization-engine";
import { buildDocumentResource } from "../src/server/authorization/available-actions";
import { buildDocumentReadWhere } from "../src/server/policies/document-policy";

// Chính sách (D17): Task.scope chỉ là phạm vi hiển thị của nhiệm vụ, người tạo nhiệm vụ không đương nhiên
// đọc được văn bản. Văn bản chỉ mở thêm cho đơn vị chủ trì của nhiệm vụ do chỉ đạo sinh ra (đơn vị xử lý).

function ctx(userId = "usr_staff", unitId = "unit_staff", extra: Record<string, unknown> = {}) {
  return new AuthorizationContextModel({
    userId,
    user: { id: userId, email: `${userId}@cdktcnqn.edu.vn`, name: userId, isActive: true },
    systemRoles: [],
    positions: [],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: [unitId],
    generatedAt: new Date(),
    ...extra,
  } as any);
}

const baseDoc: DocumentClassificationTarget = {
  id: "doc_1",
  type: "VAN_BAN_DEN",
  securityLevel: DocumentSecurityLevel.THUONG,
  registeredById: "usr_clerk",
  leadUserId: "usr_leader",
  incomingWorkflow: { leadUnitId: "unit_other", unitAssignments: [] },
};

const withTask = (task: Record<string, unknown>, doc: Record<string, unknown> = {}) =>
  ({ ...baseDoc, ...doc, linkedTask: task }) as DocumentClassificationTarget;

describe("Quyền đọc văn bản gắn nhiệm vụ liên kết (D17)", () => {
  test("không có nhiệm vụ liên kết, khác đơn vị -> từ chối", () => {
    assert.equal(canAccessClassification(ctx(), baseDoc).allowed, false);
  });

  test("1. nhiệm vụ phạm vi SCHOOL không cấp quyền đọc cho người không liên quan", () => {
    const doc = withTask({ scope: "SCHOOL", createdById: "usr_other", leadUnitId: "unit_task" });
    assert.equal(canAccessClassification(ctx(), doc).allowed, false);
  });

  test("1. người tạo nhiệm vụ liên kết (khác đơn vị) không đương nhiên đọc được", () => {
    const doc = withTask({ scope: "DEPARTMENT", createdById: "usr_staff", leadUnitId: "unit_task" });
    assert.equal(canAccessClassification(ctx(), doc).allowed, false);
  });

  test("1. người chỉ được giao/tham gia nhiệm vụ (khác đơn vị) không đọc được", () => {
    const doc = withTask({ scope: "INDIVIDUAL", createdById: "usr_other", leadUnitId: "unit_task", assigneeId: "usr_staff" });
    assert.equal(canAccessClassification(ctx(), doc).allowed, false);
  });

  test("thành viên đơn vị chủ trì nhiệm vụ liên kết (đơn vị xử lý) đọc được", () => {
    const doc = withTask({ scope: "DEPARTMENT", createdById: "usr_other", leadUnitId: "unit_staff" });
    assert.equal(canAccessClassification(ctx(), doc).allowed, true);
  });

  test("4. đơn vị chủ trì nhiệm vụ nằm trong đơn vị phụ của người dùng vẫn được tính", () => {
    const doc = withTask({ scope: "DEPARTMENT", createdById: "usr_other", leadUnit: { id: "unit_second" } });
    const context = ctx("usr_multi", "unit_main", { positions: [{ unitId: "unit_second", positionCode: "CHUYEN_VIEN" }] });
    assert.equal(canAccessClassification(context, doc).allowed, true);
  });

  for (const level of [DocumentSecurityLevel.MAT, DocumentSecurityLevel.TOI_MAT, DocumentSecurityLevel.TUYET_MAT]) {
    test(`2. văn bản ${level} gắn nhiệm vụ vẫn bị từ chối dù thuộc đơn vị chủ trì`, () => {
      const doc = withTask({ scope: "SCHOOL", createdById: "usr_staff", leadUnitId: "unit_staff" }, { securityLevel: level });
      assert.equal(canAccessClassification(ctx(), doc).allowed, false);
    });
  }

  test("2. văn bản giới hạn/dữ liệu cá nhân không mở cho đơn vị chủ trì nhiệm vụ", () => {
    const task = { scope: "SCHOOL", createdById: "usr_staff", leadUnitId: "unit_staff" };
    assert.equal(canAccessClassification(ctx(), withTask(task, { notes: "RESTRICTED" })).allowed, false);
    assert.equal(canAccessClassification(ctx(), withTask(task, { classification: "PERSONAL_DATA" })).allowed, false);
  });

  test("3. SYSTEM_ADMIN không chức danh bị từ chối dù thuộc đơn vị chủ trì", () => {
    const doc = withTask({ scope: "SCHOOL", createdById: "usr_adm", leadUnitId: "unit_staff" });
    const admin = ctx("usr_adm", "unit_staff", { systemRoles: ["SYSTEM_ADMIN"] });
    assert.equal(canAccessClassification(admin, doc).allowed, false);
  });

  test("3. tài khoản bị vô hiệu hóa bị từ chối", () => {
    const doc = withTask({ scope: "DEPARTMENT", createdById: "usr_staff", leadUnitId: "unit_staff" });
    const inactive = ctx("usr_staff", "unit_staff", {
      user: { id: "usr_staff", email: "s@x", name: "s", isActive: false },
    });
    assert.equal(canAccessClassification(inactive, doc).allowed, false);
  });

  test("5. đọc qua đơn vị chủ trì nhiệm vụ không cấp thêm quyền xử lý văn bản", () => {
    const doc = withTask({ scope: "DEPARTMENT", createdById: "usr_other", leadUnitId: "unit_staff" });
    const resource = buildDocumentResource(doc);
    assert.equal(authorize(ctx(), "document.read" as any, resource).allowed, true);
    for (const action of ["document.review_content", "document.sign", "document.issue", "document.archive"]) {
      assert.equal(authorize(ctx(), action as any, resource).allowed, false, action);
    }
  });
});

describe("Danh sách văn bản không rộng hơn chi tiết (D17)", () => {
  const staff = {
    id: "usr_staff",
    email: "s@x",
    name: "s",
    role: "CHUYEN_VIEN",
    departmentId: "unit_staff",
  } as any;

  test("bộ lọc danh sách không còn điều kiện theo scope SCHOOL hay người tạo nhiệm vụ", () => {
    const where = JSON.stringify(buildDocumentReadWhere(staff));
    assert.equal(where.includes("SCHOOL"), false);
    assert.equal(where.includes("createdById"), false);
  });

  test("mỗi điều kiện của bộ lọc danh sách đều được chi tiết cho phép", () => {
    const context = ctx("usr_staff", "unit_staff");
    const shapes: Array<[string, DocumentClassificationTarget]> = [
      ["người vào sổ", { ...baseDoc, registeredById: "usr_staff" }],
      ["chuyên viên chủ trì", { ...baseDoc, leadUserId: "usr_staff" }],
      ["lãnh đạo bút phê", { ...baseDoc, directives: [{ leaderId: "usr_staff" }] }],
      ["đơn vị chủ trì văn bản", { ...baseDoc, incomingWorkflow: { leadUnitId: "unit_staff", unitAssignments: [] } }],
      ["đơn vị chủ trì nhiệm vụ", withTask({ leadUnitId: "unit_staff" })],
    ];
    const serialized = JSON.stringify(buildDocumentReadWhere(staff));
    for (const [name, doc] of shapes) {
      assert.equal(canAccessClassification(context, doc).allowed, true, name);
    }
    for (const field of ["registeredById", "leadUserId", "leaderId", "leadUnitId"]) {
      assert.ok(serialized.includes(field), `bộ lọc phải còn điều kiện ${field}`);
    }
  });
});
