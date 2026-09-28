/**
 * Test: Document Stats Route — ACL enforcement
 *
 * Verifies that buildDocumentReadWhere produces correct Prisma where filters
 * per role, ensuring /api/documents/stats scopes counts correctly.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentReadWhere,
} from "@/server/policies/document-policy";

describe("Document Stats ACL via buildDocumentReadWhere", () => {
  test("should return deny filter for anonymous/null user", () => {
    const where = buildDocumentReadWhere(null);
    assert.deepStrictEqual(where, { id: "__DENY_ANONYMOUS__" });
  });

  test("should return non-confidential-only filter for ADMIN", () => {
    const admin = {
      id: "admin-1",
      role: "ADMIN",
      departmentId: null,
    };
    const where = buildDocumentReadWhere(admin as any);
    assert.deepStrictEqual(where, { securityLevel: { not: "TUYET_MAT" } });
  });

  test("should return non-confidential-only filter for VAN_THU", () => {
    const clerk = {
      id: "clerk-1",
      role: "VAN_THU",
      departmentId: "dept-1",
    };
    const where = buildDocumentReadWhere(clerk as any);
    assert.deepStrictEqual(where, { securityLevel: { not: "TUYET_MAT" } });
  });

  test("should return non-confidential-only filter for BAN_GIAM_HIEU", () => {
    const bgh = {
      id: "bgh-1",
      role: "BAN_GIAM_HIEU",
      departmentId: null,
    };
    const where = buildDocumentReadWhere(bgh as any);
    assert.deepStrictEqual(where, { securityLevel: { not: "TUYET_MAT" } });
  });

  test("should return scoped filter for CHUYEN_VIEN with department", () => {
    const cv = {
      id: "cv-1",
      role: "CHUYEN_VIEN",
      departmentId: "dept-A",
    };
    const where = buildDocumentReadWhere(cv as any);

    // Must have AND with non-confidential + OR conditions
    assert.ok((where as any).AND, "Expected AND clause for scoped user");
    const andClauses = (where as any).AND;
    assert.strictEqual(andClauses.length, 2);
    // First: non-confidential
    assert.deepStrictEqual(andClauses[0], { securityLevel: { not: "TUYET_MAT" } });
    // Second: OR conditions scoped to user
    assert.ok(andClauses[1].OR, "Expected OR clause for scoped conditions");
    const orConditions = andClauses[1].OR;
    // Must include registeredById, leadUserId, unit conditions
    const hasRegisteredBy = orConditions.some(
      (c: any) => c.registeredById === "cv-1"
    );
    const hasLeadUser = orConditions.some(
      (c: any) => c.leadUserId === "cv-1"
    );
    const hasUnitScope = orConditions.some(
      (c: any) =>
        c.incomingWorkflow?.is?.leadUnitId === "dept-A" ||
        c.linkedTask?.is?.leadUnitId === "dept-A"
    );
    assert.ok(hasRegisteredBy, "Expected registeredById condition");
    assert.ok(hasLeadUser, "Expected leadUserId condition");
    assert.ok(hasUnitScope, "Expected unit-scoped condition for dept-A");
  });

  test("should return scoped filter for TRUONG_PHONG", () => {
    const tp = {
      id: "tp-1",
      role: "TRUONG_PHONG",
      departmentId: "dept-B",
    };
    const where = buildDocumentReadWhere(tp as any);

    // TRUONG_PHONG is not privileged — should get scoped filter
    assert.ok((where as any).AND, "Expected AND clause for TRUONG_PHONG");
    const andClauses = (where as any).AND;
    assert.deepStrictEqual(andClauses[0], { securityLevel: { not: "TUYET_MAT" } });
    assert.ok(andClauses[1].OR, "Expected OR clause for TRUONG_PHONG conditions");
  });

  test("should return scoped filter for CHUYEN_VIEN without department", () => {
    const cv = {
      id: "cv-2",
      role: "CHUYEN_VIEN",
      departmentId: null,
    };
    const where = buildDocumentReadWhere(cv as any);

    assert.ok((where as any).AND, "Expected AND clause");
    const andClauses = (where as any).AND;
    const orConditions = andClauses[1].OR;
    // Without department, no unit-scoped conditions
    const hasUnitScope = orConditions.some(
      (c: any) =>
        c.incomingWorkflow?.is?.leadUnitId != null ||
        c.linkedTask?.is?.leadUnitId != null
    );
    // CHUYEN_VIEN without dept should NOT have department-scoped conditions
    assert.strictEqual(hasUnitScope, false, "Should NOT have unit-scoped conditions without department");
  });
});
