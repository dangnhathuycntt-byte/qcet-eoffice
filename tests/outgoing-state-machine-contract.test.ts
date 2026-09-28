/**
 * Contract tests cho OutgoingDocumentStateMachine
 * (Nghị định 30/2020/NĐ-CP & Nghị định 68/2024/NĐ-CP)
 *
 * Kiểm tra: chuyển trạng thái hợp lệ/không hợp lệ, trạng thái kết thúc,
 * phân tách nghĩa vụ (SoD), bất biến văn bản, ánh xạ trạng thái.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OUTGOING_DOCUMENT_TRANSITIONS,
  OutgoingDocumentStateMachine,
  isDocumentImmutable,
  assertDocumentNotImmutable,
  mapOutgoingWorkflowStatusToDocumentStatus,
} from "../src/lib/documents/state-machine";
import type { OutgoingDocumentStatus } from "@prisma/client";

// ============================================================================
// 1. Chuyển trạng thái hợp lệ — outgoing workflow
// ============================================================================

describe("Chuyển trạng thái hợp lệ — outgoing workflow", () => {
  const validPairs: [string, string][] = [
    ["DRAFT", "CONTENT_REVIEW"],
    ["DRAFT", "FORMAT_CHECK"],
    ["CONTENT_REVIEW", "DRAFT"],
    ["CONTENT_REVIEW", "FORMAT_CHECK"],
    ["CONTENT_REVIEW", "AUTHORIZED_SIGN"],
    ["FORMAT_CHECK", "CONTENT_REVIEW"],
    ["FORMAT_CHECK", "AUTHORIZED_SIGN"],
    ["AUTHORIZED_SIGN", "DRAFT"],
    ["AUTHORIZED_SIGN", "NUMBERED"],
    ["NUMBERED", "ORGANIZATION_SIGNED"],
    ["ORGANIZATION_SIGNED", "ISSUED"],
    ["ISSUED", "DELIVERED"],
    ["ISSUED", "FILED"],
    ["ISSUED", "ARCHIVED"],
    ["DELIVERED", "FILED"],
    ["DELIVERED", "ARCHIVED"],
    ["FILED", "ARCHIVED"],
  ];

  for (const [from, to] of validPairs) {
    it(`${from} -> ${to} được phép`, () => {
      assert.ok(
        OutgoingDocumentStateMachine.canTransition(from as any, to as any),
        `Transition ${from} -> ${to} phải hợp lệ`
      );
    });
  }

  it("Self-transition luôn hợp lệ cho mọi trạng thái", () => {
    const allStatuses = Object.keys(OUTGOING_DOCUMENT_TRANSITIONS);
    for (const status of allStatuses) {
      assert.ok(
        OutgoingDocumentStateMachine.canTransition(status as any, status as any),
        `Self-transition ${status} -> ${status} phải hợp lệ`
      );
    }
  });
});

// ============================================================================
// 2. Chuyển trạng thái KHÔNG hợp lệ
// ============================================================================

describe("Chuyển trạng thái KHÔNG hợp lệ", () => {
  const invalidPairs: [string, string][] = [
    ["DRAFT", "NUMBERED"],
    ["DRAFT", "ISSUED"],
    ["ARCHIVED", "DRAFT"],
    ["NUMBERED", "DRAFT"],
    ["FILED", "CONTENT_REVIEW"],
    ["DELIVERED", "DRAFT"],
    ["ISSUED", "CONTENT_REVIEW"],
  ];

  for (const [from, to] of invalidPairs) {
    it(`${from} -> ${to} bị từ chối`, () => {
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(from as any, to as any),
        false,
        `Transition ${from} -> ${to} phải không hợp lệ`
      );
    });
  }

  it("assertTransition ném lỗi cho transition không hợp lệ", () => {
    assert.throws(
      () => OutgoingDocumentStateMachine.assertTransition("DRAFT" as any, "NUMBERED" as any),
      (err: any) => err.code === "INVALID_TRANSITION"
    );
  });

  it("assertTransition không ném lỗi cho transition hợp lệ", () => {
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertTransition("DRAFT" as any, "CONTENT_REVIEW" as any)
    );
  });
});

// ============================================================================
// 3. Trạng thái kết thúc (finalized)
// ============================================================================

describe("Trạng thái kết thúc (finalized)", () => {
  it("ARCHIVED không có transition nào tiếp theo (terminal)", () => {
    const archivedTransitions = OUTGOING_DOCUMENT_TRANSITIONS["ARCHIVED" as OutgoingDocumentStatus];
    assert.ok(Array.isArray(archivedTransitions));
    assert.equal(archivedTransitions.length, 0, "ARCHIVED phải là terminal state");
  });

  it("Mọi trạng thái khác ARCHIVED đều có ít nhất một transition", () => {
    for (const [status, targets] of Object.entries(OUTGOING_DOCUMENT_TRANSITIONS)) {
      if (status === "ARCHIVED") continue;
      assert.ok(targets.length > 0, `${status} phải có ít nhất một transition`);
    }
  });
});

// ============================================================================
// 4. Phân tách nghĩa vụ (Separation of Duties)
// ============================================================================

describe("Phân tách nghĩa vụ (Separation of Duties)", () => {
  it("assertDrafterNotContentReviewer cho phép hai người khác nhau", () => {
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertDrafterNotContentReviewer("user-A", "user-B")
    );
  });

  it("assertDrafterNotContentReviewer ném ForbiddenError khi cùng một người", () => {
    assert.throws(
      () => OutgoingDocumentStateMachine.assertDrafterNotContentReviewer("user-A", "user-A"),
      (err: any) => err.code === "FORBIDDEN"
    );
  });

  it("assertSignerNotNumberer cho phép hai người khác nhau", () => {
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertSignerNotNumberer("user-A", "user-B")
    );
  });

  it("assertSignerNotNumberer ném ForbiddenError khi cùng một người", () => {
    assert.throws(
      () => OutgoingDocumentStateMachine.assertSignerNotNumberer("user-A", "user-A"),
      (err: any) => err.code === "FORBIDDEN"
    );
  });

  it("assertSignerNotOrganizationSigner cho phép hai người khác nhau", () => {
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertSignerNotOrganizationSigner("user-A", "user-B")
    );
  });

  it("assertSignerNotOrganizationSigner ném ForbiddenError khi cùng một người", () => {
    assert.throws(
      () => OutgoingDocumentStateMachine.assertSignerNotOrganizationSigner("user-A", "user-A"),
      (err: any) => err.code === "FORBIDDEN"
    );
  });

  it("SoD assertions cho phép null/undefined (optional actors)", () => {
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertDrafterNotContentReviewer(null, "user-B")
    );
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertSignerNotNumberer("user-A", undefined)
    );
    assert.doesNotThrow(() =>
      OutgoingDocumentStateMachine.assertSignerNotOrganizationSigner(null, null)
    );
  });
});

// ============================================================================
// 5. Bất biến văn bản (Document Immutability)
// ============================================================================

describe("Bất biến văn bản (Document Immutability)", () => {
  const immutableOutgoingStatuses = [
    "NUMBERED",
    "ORGANIZATION_SIGNED",
    "ISSUED",
    "DELIVERED",
    "FILED",
    "ARCHIVED",
  ];

  for (const status of immutableOutgoingStatuses) {
    it(`outgoingWorkflow.status = ${status} -> immutable`, () => {
      assert.ok(
        isDocumentImmutable({ outgoingWorkflow: { status } }),
        `Văn bản với outgoing status ${status} phải immutable`
      );
    });
  }

  const mutableOutgoingStatuses = ["DRAFT", "CONTENT_REVIEW", "FORMAT_CHECK"];

  for (const status of mutableOutgoingStatuses) {
    it(`outgoingWorkflow.status = ${status} -> NOT immutable`, () => {
      assert.equal(
        isDocumentImmutable({ outgoingWorkflow: { status } }),
        false,
        `Văn bản với outgoing status ${status} không được immutable`
      );
    });
  }

  it("Văn bản có signatures array không rỗng -> immutable", () => {
    assert.ok(isDocumentImmutable({ signatures: [{ id: "sig-1" }] }));
  });

  it("Văn bản có outgoing authorizedSignedAt -> immutable", () => {
    assert.ok(
      isDocumentImmutable({
        outgoingWorkflow: { status: "AUTHORIZED_SIGN", authorizedSignedAt: new Date() },
      })
    );
  });

  it("assertDocumentNotImmutable ném lỗi với code IMMUTABLE_DOCUMENT", () => {
    assert.throws(
      () => assertDocumentNotImmutable({ outgoingWorkflow: { status: "ISSUED" } }),
      (err: any) => err.code === "IMMUTABLE_DOCUMENT"
    );
  });

  it("assertDocumentNotImmutable không ném lỗi cho văn bản mutable", () => {
    assert.doesNotThrow(() =>
      assertDocumentNotImmutable({ outgoingWorkflow: { status: "DRAFT" } })
    );
  });
});

// ============================================================================
// 6. Ánh xạ trạng thái outgoing -> DocumentStatus
// ============================================================================

describe("Ánh xạ trạng thái outgoing -> DocumentStatus", () => {
  const dangXuLy = ["DRAFT", "CONTENT_REVIEW", "FORMAT_CHECK", "NUMBERED", "ORGANIZATION_SIGNED"];
  for (const status of dangXuLy) {
    it(`${status} -> DANG_XU_LY`, () => {
      assert.equal(
        mapOutgoingWorkflowStatusToDocumentStatus(status as any),
        "DANG_XU_LY"
      );
    });
  }

  it("AUTHORIZED_SIGN -> CHO_PHE_DUYET", () => {
    assert.equal(
      mapOutgoingWorkflowStatusToDocumentStatus("AUTHORIZED_SIGN" as any),
      "CHO_PHE_DUYET"
    );
  });

  const daHoanThanh = ["ISSUED", "DELIVERED"];
  for (const status of daHoanThanh) {
    it(`${status} -> DA_HOAN_THANH`, () => {
      assert.equal(
        mapOutgoingWorkflowStatusToDocumentStatus(status as any),
        "DA_HOAN_THANH"
      );
    });
  }

  const luuTheoDoi = ["FILED", "ARCHIVED"];
  for (const status of luuTheoDoi) {
    it(`${status} -> LUU_THEO_DOI`, () => {
      assert.equal(
        mapOutgoingWorkflowStatusToDocumentStatus(status as any),
        "LUU_THEO_DOI"
      );
    });
  }

  it("Trạng thái không hợp lệ ném InvalidTransitionError", () => {
    assert.throws(
      () => mapOutgoingWorkflowStatusToDocumentStatus("INVALID_STATUS" as any),
      (err: any) => err.code === "INVALID_TRANSITION"
    );
  });
});
