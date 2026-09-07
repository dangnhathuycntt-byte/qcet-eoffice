import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { OfficialDocument, DocumentUrgency, DocumentStatus } from "../src/types/document";
import { MOCK_DOCUMENTS, getDocumentStats } from "../src/lib/mock-document-data";
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

  describe("Anti-Slop Audit: Eliminating Roadmap Fillers & Emojis", () => {
    test("src/app/documents/page.tsx contains no coming-soon or roadmap filler slop", () => {
      const pageFile = fs.readFileSync(
        path.join(process.cwd(), "src/app/documents/page.tsx"),
        "utf8"
      );

      assert.ok(
        !pageFile.includes("Tính năng đang trong lộ trình phát triển"),
        "Must not contain 'Tính năng đang trong lộ trình phát triển'"
      );
      assert.ok(!pageFile.includes("Sắp ra mắt"), "Must not contain 'Sắp ra mắt'");
      assert.ok(!pageFile.includes("Giai đoạn 1"), "Must not contain 'Giai đoạn 1'");
      assert.ok(!pageFile.includes("Giai đoạn 2"), "Must not contain 'Giai đoạn 2'");
      assert.ok(
        pageFile.includes("DocumentRegistryView"),
        "Page must mount DocumentRegistryView component"
      );
    });

    test("Documents components and mock data contain 0% decorative emojis", () => {
      const filesToCheck = [
        "src/types/document.ts",
        "src/lib/mock-document-data.ts",
        "src/components/documents/document-registry-view.tsx",
        "src/components/documents/document-detail-dialog.tsx",
        "src/components/documents/create-document-modal.tsx",
      ];

      const emojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

      for (const relPath of filesToCheck) {
        const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
        const match = content.match(emojiRegex);
        assert.strictEqual(
          match,
          null,
          `File ${relPath} contains decorative emoji: ${match?.[0]}`
        );
      }
    });
  });
});
