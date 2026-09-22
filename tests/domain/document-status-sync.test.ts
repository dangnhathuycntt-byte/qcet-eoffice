/**
 * Test Suite: Document Status Two-Tier Synchronization under ADR-004 ACCEPTED (WI-5.1)
 *
 * Verifies compliance with ADR-004:
 * 1. Hard Invariant: Canonical Sync Mapping between Workflow Status (Tier 2) and Persisted Document.status (Tier 1)
 *    - 100% of IncomingDocumentStatus transitions
 *    - 100% of OutgoingDocumentStatus transitions
 * 2. Hard Invariant: Immutability Protection via isDocumentImmutable and assertDocumentNotImmutable
 *    - Must freeze documents when DA_HOAN_THANH / ISSUED / ARCHIVED
 * 3. Transactional Atomic Synchronization helpers
 */

import * as nodeTest from "node:test";
import assert from "node:assert/strict";
import {
  DocumentStatus,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
} from "@prisma/client";
import {
  mapIncomingWorkflowStatusToDocumentStatus,
  mapOutgoingWorkflowStatusToDocumentStatus,
  isDocumentImmutable,
  assertDocumentNotImmutable,
} from "../../src/lib/documents/state-machine";
import {
  syncDocumentStatusFromIncomingWorkflow,
  syncDocumentStatusFromOutgoingWorkflow,
} from "../../src/lib/documents/document-service";
import { InvalidTransitionError, ValidationError } from "../../src/server/api/errors";

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

describe("WI-5.1 / ADR-004: Document Status Two-Tier Synchronization", () => {
  // ==========================================================================
  // 1. INCOMING WORKFLOW MAPPING (Tier 2a -> Tier 1)
  // ==========================================================================
  describe("1. Incoming Workflow Canonical Sync Mapping (100% Transitions)", () => {
    describe("Incoming: CHO_PHAN_CONG group (Reception, Presentation, Directive, Unit Assignment)", () => {
      it("maps RECEIVED to CHO_PHAN_CONG", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.RECEIVED),
          DocumentStatus.CHO_PHAN_CONG
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("RECEIVED"),
          DocumentStatus.CHO_PHAN_CONG
        );
      });

      it("maps REGISTERED to CHO_PHAN_CONG", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.REGISTERED),
          DocumentStatus.CHO_PHAN_CONG
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("REGISTERED"),
          DocumentStatus.CHO_PHAN_CONG
        );
      });

      it("maps PRESENTED to CHO_PHAN_CONG", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.PRESENTED),
          DocumentStatus.CHO_PHAN_CONG
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("PRESENTED"),
          DocumentStatus.CHO_PHAN_CONG
        );
      });

      it("maps DIRECTED to CHO_PHAN_CONG", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.DIRECTED),
          DocumentStatus.CHO_PHAN_CONG
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("DIRECTED"),
          DocumentStatus.CHO_PHAN_CONG
        );
      });

      it("maps ASSIGNED_TO_LEAD_UNIT to CHO_PHAN_CONG", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT),
          DocumentStatus.CHO_PHAN_CONG
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("ASSIGNED_TO_LEAD_UNIT"),
          DocumentStatus.CHO_PHAN_CONG
        );
      });

      it("maps UNIT_ASSIGNED_PERSON to CHO_PHAN_CONG", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.UNIT_ASSIGNED_PERSON),
          DocumentStatus.CHO_PHAN_CONG
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("UNIT_ASSIGNED_PERSON"),
          DocumentStatus.CHO_PHAN_CONG
        );
      });
    });

    describe("Incoming: DANG_XU_LY group (Execution in progress)", () => {
      it("maps IN_PROGRESS to DANG_XU_LY", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.IN_PROGRESS),
          DocumentStatus.DANG_XU_LY
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("IN_PROGRESS"),
          DocumentStatus.DANG_XU_LY
        );
      });
    });

    describe("Incoming: DA_HOAN_THANH group (Resolution completed)", () => {
      it("maps RESOLVED to DA_HOAN_THANH", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.RESOLVED),
          DocumentStatus.DA_HOAN_THANH
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("RESOLVED"),
          DocumentStatus.DA_HOAN_THANH
        );
      });
    });

    describe("Incoming: LUU_THEO_DOI group (Filing & Archival)", () => {
      it("maps FILED to LUU_THEO_DOI", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.FILED),
          DocumentStatus.LUU_THEO_DOI
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("FILED"),
          DocumentStatus.LUU_THEO_DOI
        );
      });

      it("maps ARCHIVED to LUU_THEO_DOI", () => {
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.ARCHIVED),
          DocumentStatus.LUU_THEO_DOI
        );
        assert.equal(
          mapIncomingWorkflowStatusToDocumentStatus("ARCHIVED"),
          DocumentStatus.LUU_THEO_DOI
        );
      });
    });

    describe("Incoming: Error handling for unknown status", () => {
      it("throws InvalidTransitionError on unknown incoming status", () => {
        assert.throws(
          () => mapIncomingWorkflowStatusToDocumentStatus("UNKNOWN_STATUS" as any),
          InvalidTransitionError
        );
      });
    });
  });

  // ==========================================================================
  // 2. OUTGOING WORKFLOW MAPPING (Tier 2b -> Tier 1)
  // ==========================================================================
  describe("2. Outgoing Workflow Canonical Sync Mapping (100% Transitions)", () => {
    describe("Outgoing: DANG_XU_LY group (Drafting, Content Review, Format Check)", () => {
      it("maps DRAFT to DANG_XU_LY", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.DRAFT),
          DocumentStatus.DANG_XU_LY
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("DRAFT"),
          DocumentStatus.DANG_XU_LY
        );
      });

      it("maps CONTENT_REVIEW to DANG_XU_LY", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.CONTENT_REVIEW),
          DocumentStatus.DANG_XU_LY
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("CONTENT_REVIEW"),
          DocumentStatus.DANG_XU_LY
        );
      });

      it("maps FORMAT_CHECK to DANG_XU_LY", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.FORMAT_CHECK),
          DocumentStatus.DANG_XU_LY
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("FORMAT_CHECK"),
          DocumentStatus.DANG_XU_LY
        );
      });
    });

    describe("Outgoing: CHO_PHE_DUYET group (Authorized Sign)", () => {
      it("maps AUTHORIZED_SIGN to CHO_PHE_DUYET", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.AUTHORIZED_SIGN),
          DocumentStatus.CHO_PHE_DUYET
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("AUTHORIZED_SIGN"),
          DocumentStatus.CHO_PHE_DUYET
        );
      });
    });

    describe("Outgoing: DANG_XU_LY group (Post-sign clerical numbering and org sealing)", () => {
      it("maps NUMBERED to DANG_XU_LY", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.NUMBERED),
          DocumentStatus.DANG_XU_LY
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("NUMBERED"),
          DocumentStatus.DANG_XU_LY
        );
      });

      it("maps ORGANIZATION_SIGNED to DANG_XU_LY", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.ORGANIZATION_SIGNED),
          DocumentStatus.DANG_XU_LY
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("ORGANIZATION_SIGNED"),
          DocumentStatus.DANG_XU_LY
        );
      });
    });

    describe("Outgoing: DA_HOAN_THANH group (Issuance & Delivery)", () => {
      it("maps ISSUED to DA_HOAN_THANH", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.ISSUED),
          DocumentStatus.DA_HOAN_THANH
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("ISSUED"),
          DocumentStatus.DA_HOAN_THANH
        );
      });

      it("maps DELIVERED to DA_HOAN_THANH", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.DELIVERED),
          DocumentStatus.DA_HOAN_THANH
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("DELIVERED"),
          DocumentStatus.DA_HOAN_THANH
        );
      });
    });

    describe("Outgoing: LUU_THEO_DOI group (Filing & Archival)", () => {
      it("maps FILED to LUU_THEO_DOI", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.FILED),
          DocumentStatus.LUU_THEO_DOI
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("FILED"),
          DocumentStatus.LUU_THEO_DOI
        );
      });

      it("maps ARCHIVED to LUU_THEO_DOI", () => {
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.ARCHIVED),
          DocumentStatus.LUU_THEO_DOI
        );
        assert.equal(
          mapOutgoingWorkflowStatusToDocumentStatus("ARCHIVED"),
          DocumentStatus.LUU_THEO_DOI
        );
      });
    });

    describe("Outgoing: Error handling for unknown status", () => {
      it("throws InvalidTransitionError on unknown outgoing status", () => {
        assert.throws(
          () => mapOutgoingWorkflowStatusToDocumentStatus("UNKNOWN_STATUS" as any),
          InvalidTransitionError
        );
      });
    });
  });

  // ==========================================================================
  // 3. IMMUTABILITY ENFORCEMENT
  // ==========================================================================
  describe("3. Immutability Enforcement when Document reaches Final States", () => {
    describe("isDocumentImmutable: returns true for finalized states", () => {
      it("freezes when status is DA_HOAN_THANH", () => {
        assert.equal(isDocumentImmutable({ status: DocumentStatus.DA_HOAN_THANH }), true);
        assert.equal(isDocumentImmutable({ status: "DA_HOAN_THANH" }), true);
      });

      it("freezes when status is ISSUED", () => {
        assert.equal(isDocumentImmutable({ status: "ISSUED" }), true);
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: OutgoingDocumentStatus.ISSUED } }),
          true
        );
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: "ISSUED" } }),
          true
        );
      });

      it("freezes when status is ARCHIVED", () => {
        assert.equal(isDocumentImmutable({ status: "ARCHIVED" }), true);
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: OutgoingDocumentStatus.ARCHIVED } }),
          true
        );
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.ARCHIVED } }),
          true
        );
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: "ARCHIVED" } }),
          true
        );
      });

      it("freezes when status is LUU_THEO_DOI", () => {
        assert.equal(isDocumentImmutable({ status: DocumentStatus.LUU_THEO_DOI }), true);
        assert.equal(isDocumentImmutable({ status: "LUU_THEO_DOI" }), true);
      });

      it("freezes when outgoing workflow is numbered, org-signed, delivered, or filed", () => {
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: OutgoingDocumentStatus.NUMBERED } }),
          true
        );
        assert.equal(
          isDocumentImmutable({
            outgoingWorkflow: { status: OutgoingDocumentStatus.ORGANIZATION_SIGNED },
          }),
          true
        );
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: OutgoingDocumentStatus.DELIVERED } }),
          true
        );
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: OutgoingDocumentStatus.FILED } }),
          true
        );
      });

      it("freezes when incoming workflow is resolved or filed", () => {
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.RESOLVED } }),
          true
        );
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.FILED } }),
          true
        );
      });

      it("freezes when document has digital signatures", () => {
        assert.equal(isDocumentImmutable({ signatures: [{ id: "sig-1" }] }), true);
      });

      it("freezes when outgoingWorkflow.authorizedSignedAt is present", () => {
        assert.equal(
          isDocumentImmutable({
            outgoingWorkflow: { authorizedSignedAt: new Date() },
          }),
          true
        );
      });
    });

    describe("isDocumentImmutable: returns false for active/in-progress states", () => {
      it("returns false for CHO_PHAN_CONG without final workflow", () => {
        assert.equal(
          isDocumentImmutable({ status: DocumentStatus.CHO_PHAN_CONG }),
          false
        );
      });

      it("returns false for DANG_XU_LY without final workflow", () => {
        assert.equal(
          isDocumentImmutable({ status: DocumentStatus.DANG_XU_LY }),
          false
        );
      });

      it("returns false for CHO_PHE_DUYET without signatures", () => {
        assert.equal(
          isDocumentImmutable({ status: DocumentStatus.CHO_PHE_DUYET }),
          false
        );
      });

      it("returns false for early outgoing workflow states (DRAFT, CONTENT_REVIEW, FORMAT_CHECK)", () => {
        assert.equal(
          isDocumentImmutable({ outgoingWorkflow: { status: OutgoingDocumentStatus.DRAFT } }),
          false
        );
        assert.equal(
          isDocumentImmutable({
            outgoingWorkflow: { status: OutgoingDocumentStatus.CONTENT_REVIEW },
          }),
          false
        );
        assert.equal(
          isDocumentImmutable({
            outgoingWorkflow: { status: OutgoingDocumentStatus.FORMAT_CHECK },
          }),
          false
        );
      });

      it("returns false for early incoming workflow states (RECEIVED, REGISTERED, PRESENTED, DIRECTED, IN_PROGRESS)", () => {
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.RECEIVED } }),
          false
        );
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.REGISTERED } }),
          false
        );
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.PRESENTED } }),
          false
        );
        assert.equal(
          isDocumentImmutable({ incomingWorkflow: { status: IncomingDocumentStatus.DIRECTED } }),
          false
        );
        assert.equal(
          isDocumentImmutable({
            incomingWorkflow: { status: IncomingDocumentStatus.IN_PROGRESS },
          }),
          false
        );
      });
    });

    describe("assertDocumentNotImmutable: throws ValidationError with IMMUTABLE_DOCUMENT", () => {
      it("throws when document status is DA_HOAN_THANH", () => {
        assert.throws(
          () => assertDocumentNotImmutable({ status: DocumentStatus.DA_HOAN_THANH }),
          (err: any) => {
            assert.ok(err instanceof ValidationError);
            assert.equal(err.code, "IMMUTABLE_DOCUMENT");
            return true;
          }
        );
      });

      it("throws when document status is ISSUED", () => {
        assert.throws(
          () => assertDocumentNotImmutable({ status: "ISSUED" }),
          (err: any) => {
            assert.ok(err instanceof ValidationError);
            assert.equal(err.code, "IMMUTABLE_DOCUMENT");
            return true;
          }
        );
      });

      it("throws when document status is ARCHIVED", () => {
        assert.throws(
          () => assertDocumentNotImmutable({ status: "ARCHIVED" }),
          (err: any) => {
            assert.ok(err instanceof ValidationError);
            assert.equal(err.code, "IMMUTABLE_DOCUMENT");
            return true;
          }
        );
      });

      it("does not throw when document is mutable", () => {
        assert.doesNotThrow(() => {
          assertDocumentNotImmutable({ status: DocumentStatus.DANG_XU_LY });
        });
      });
    });
  });

  // ==========================================================================
  // 4. TRANSACTIONAL ATOMIC SYNCHRONIZATION HELPERS
  // ==========================================================================
  describe("4. Transactional Atomic Synchronization Service Helpers", () => {
    it("syncDocumentStatusFromIncomingWorkflow updates document status in transaction", async () => {
      let updatedPayload: any = null;
      const mockTx: any = {
        document: {
          update: async (args: any) => {
            updatedPayload = args;
            return { id: args.where.id, status: args.data.status };
          },
        },
      };

      const result = await syncDocumentStatusFromIncomingWorkflow(
        mockTx,
        "doc-incoming-123",
        IncomingDocumentStatus.RESOLVED
      );

      assert.equal(result, DocumentStatus.DA_HOAN_THANH);
      assert.deepEqual(updatedPayload, {
        where: { id: "doc-incoming-123" },
        data: { status: DocumentStatus.DA_HOAN_THANH },
      });
    });

    it("syncDocumentStatusFromOutgoingWorkflow updates document status in transaction", async () => {
      let updatedPayload: any = null;
      const mockTx: any = {
        document: {
          update: async (args: any) => {
            updatedPayload = args;
            return { id: args.where.id, status: args.data.status };
          },
        },
      };

      const result = await syncDocumentStatusFromOutgoingWorkflow(
        mockTx,
        "doc-outgoing-456",
        OutgoingDocumentStatus.ISSUED
      );

      assert.equal(result, DocumentStatus.DA_HOAN_THANH);
      assert.deepEqual(updatedPayload, {
        where: { id: "doc-outgoing-456" },
        data: { status: DocumentStatus.DA_HOAN_THANH },
      });
    });

    it("syncDocumentStatusFromOutgoingWorkflow correctly maps NUMBERED to DANG_XU_LY", async () => {
      let updatedPayload: any = null;
      const mockTx: any = {
        document: {
          update: async (args: any) => {
            updatedPayload = args;
            return { id: args.where.id, status: args.data.status };
          },
        },
      };

      const result = await syncDocumentStatusFromOutgoingWorkflow(
        mockTx,
        "doc-outgoing-789",
        OutgoingDocumentStatus.NUMBERED
      );

      assert.equal(result, DocumentStatus.DANG_XU_LY);
      assert.deepEqual(updatedPayload, {
        where: { id: "doc-outgoing-789" },
        data: { status: DocumentStatus.DANG_XU_LY },
      });
    });
  });
});
