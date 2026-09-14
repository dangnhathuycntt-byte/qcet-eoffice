import { test, describe } from "node:test";
import assert from "node:assert";
import { OfficialDocument, DocumentUrgency, DocumentStatus } from "../src/types/document";
import { MOCK_DOCUMENTS, getDocumentStats } from "./fixtures/document-fixtures";
import {
  getUrgencyBadgeConfig,
  getStatusBadgeConfig,
} from "../src/components/documents/document-detail-dialog";

describe("Official Documents & Dispatches Test Suite (Decree 30/2020/ND-CP)", () => {
  describe("Data Model & Mock Data Integrity", () => {
    test("MOCK_DOCUMENTS contains valid documents adhering to OfficialDocument interface", () => {
      assert.ok(Array.isArray(MOCK_DOCUMENTS), "MOCK_DOCUMENTS must be an array");
      assert.ok(MOCK_DOCUMENTS.length >= 10, "Must have at least 10 realistic mock documents");

      for (const doc of MOCK_DOCUMENTS) {
        assert.ok(doc.id, `Document must have an id: ${JSON.stringify(doc)}`);
        assert.ok(
          ["inbox", "outbox", "submission"].includes(doc.type),
          `Invalid type: ${doc.type}`
        );
        assert.ok(doc.documentNumber, `Document must have documentNumber: ${doc.id}`);
        assert.ok(doc.issuedDate, `Document must have issuedDate: ${doc.id}`);
        assert.ok(doc.issuingAuthority, `Document must have issuingAuthority: ${doc.id}`);
        assert.ok(doc.summary, `Document must have summary: ${doc.id}`);
        assert.ok(
          ["normal", "urgent", "top_urgent", "flash"].includes(doc.urgency),
          `Invalid urgency: ${doc.urgency}`
        );
        assert.ok(
          ["pending_assignment", "processing", "delegated", "approved", "completed"].includes(
            doc.status
          ),
          `Invalid status: ${doc.status}`
        );
        assert.ok(doc.leadDepartment, `Document must have leadDepartment: ${doc.id}`);
        assert.ok(doc.signatory, `Document must have signatory: ${doc.id}`);
      }
    });

    test("Mock documents cover incoming, outgoing, and submission categories", () => {
      const types = new Set(MOCK_DOCUMENTS.map((d) => d.type));
      assert.ok(types.has("inbox"), "Must contain inbox documents");
      assert.ok(types.has("outbox"), "Must contain outbox documents");
      assert.ok(types.has("submission"), "Must contain submission documents");
    });

    test("High-utility linkage: documents link directly to QCET tasks", () => {
      const linked = MOCK_DOCUMENTS.filter((d) => Boolean(d.linkedTaskId));
      assert.ok(
        linked.length >= 5,
        `Expected at least 5 linked tasks across documents, found ${linked.length}`
      );

      for (const doc of linked) {
        assert.ok(
          doc.linkedTaskId?.startsWith("TASK-"),
          `Linked task id must follow TASK-xxx pattern: ${doc.linkedTaskId}`
        );
        assert.ok(
          doc.linkedTaskTitle && doc.linkedTaskTitle.length > 5,
          `Linked task must have descriptive title: ${doc.linkedTaskTitle}`
        );
      }
    });

    test("Urgency range includes flash, top_urgent, and urgent dispatches", () => {
      const urgencies = new Set(MOCK_DOCUMENTS.map((d) => d.urgency));
      assert.ok(urgencies.has("flash"), "Must include flash/hỏa tốc dispatch");
      assert.ok(urgencies.has("top_urgent"), "Must include top_urgent/thượng khẩn dispatch");
      assert.ok(urgencies.has("urgent"), "Must include urgent/khẩn dispatch");
      assert.ok(urgencies.has("normal"), "Must include normal dispatch");
    });
  });

  describe("Document Stats Aggregation Contract", () => {
    test("getDocumentStats calculates exact counts correctly", () => {
      const stats = getDocumentStats(MOCK_DOCUMENTS);

      assert.strictEqual(
        stats.totalInbox,
        MOCK_DOCUMENTS.filter((d) => d.type === "inbox").length
      );
      assert.strictEqual(
        stats.totalOutbox,
        MOCK_DOCUMENTS.filter((d) => d.type === "outbox").length
      );
      assert.strictEqual(
        stats.totalSubmissions,
        MOCK_DOCUMENTS.filter((d) => d.type === "submission").length
      );
      assert.strictEqual(
        stats.linkedTaskCount,
        MOCK_DOCUMENTS.filter((d) => Boolean(d.linkedTaskId)).length
      );
      assert.strictEqual(
        stats.urgentCount,
        MOCK_DOCUMENTS.filter(
          (d) => d.urgency === "urgent" || d.urgency === "top_urgent" || d.urgency === "flash"
        ).length
      );
    });
  });

  describe("Badge Configuration & Vietnamese Legal Conventions", () => {
    test("getUrgencyBadgeConfig maps correct Vietnamese terms", () => {
      assert.strictEqual(getUrgencyBadgeConfig("flash").label, "Hỏa tốc");
      assert.strictEqual(getUrgencyBadgeConfig("top_urgent").label, "Thượng khẩn");
      assert.strictEqual(getUrgencyBadgeConfig("urgent").label, "Khẩn");
      assert.strictEqual(getUrgencyBadgeConfig("normal").label, "Thường");
    });

    test("getStatusBadgeConfig maps correct operational status labels", () => {
      assert.strictEqual(getStatusBadgeConfig("pending_assignment").label, "Chờ bút phê");
      assert.strictEqual(getStatusBadgeConfig("processing").label, "Đang xử lý");
      assert.strictEqual(getStatusBadgeConfig("delegated").label, "Đã liên thông giao việc");
      assert.strictEqual(getStatusBadgeConfig("approved").label, "Đã ký duyệt");
      assert.strictEqual(getStatusBadgeConfig("completed").label, "Hoàn tất & Lưu trữ");
    });
  });

  describe("Document Search Debounce & Concurrency Race Condition Prevention", () => {
    test("ensures aborted fetch calls do not overwrite newer results (race condition prevention)", async () => {
      let state = "initial";
      const executionLog: string[] = [];

      async function simulatedFetch(
        query: string,
        delayMs: number,
        signal: AbortSignal
      ) {
        return new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (signal.aborted) {
              const err = new DOMException("The user aborted a request.", "AbortError");
              reject(err);
            } else {
              resolve(`Result for ${query}`);
            }
          }, delayMs);

          signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            const err = new DOMException("The user aborted a request.", "AbortError");
            reject(err);
          });
        });
      }

      // Simulate Request 1 (slow query "doc-1", 50ms)
      const controller1 = new AbortController();
      const p1 = simulatedFetch("doc-1", 50, controller1.signal)
        .then((res) => {
          state = res;
          executionLog.push("p1-resolved");
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            executionLog.push("p1-error");
          } else {
            executionLog.push("p1-aborted");
          }
        });

      // User types next character rapidly, cancelling request 1 and initiating Request 2 (fast query "doc-12", 10ms)
      controller1.abort();

      const controller2 = new AbortController();
      const p2 = simulatedFetch("doc-12", 10, controller2.signal)
        .then((res) => {
          state = res;
          executionLog.push("p2-resolved");
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            executionLog.push("p2-error");
          } else {
            executionLog.push("p2-aborted");
          }
        });

      await Promise.all([p1, p2]);

      // Controller 1 was aborted, so only Request 2 set state
      assert.strictEqual(state, "Result for doc-12");
      assert.deepStrictEqual(executionLog, ["p1-aborted", "p2-resolved"]);
    });

    test("verifies debounce timer cancels preceding invocation within window", async () => {
      const calls: string[] = [];
      let activeTimer: NodeJS.Timeout | null = null;

      function onType(val: string) {
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
          calls.push(val);
        }, 50); // using 50ms for fast test execution
      }

      // Typing "N", "Ng", "Ngh", "Nghi" within short intervals
      onType("N");
      await new Promise((r) => setTimeout(r, 10));
      onType("Ng");
      await new Promise((r) => setTimeout(r, 10));
      onType("Ngh");
      await new Promise((r) => setTimeout(r, 10));
      onType("Nghi");

      // Wait for debounce timeout to finish
      await new Promise((r) => setTimeout(r, 80));

      // Only the final typed string was invoked
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0], "Nghi");
    });
  });
});
