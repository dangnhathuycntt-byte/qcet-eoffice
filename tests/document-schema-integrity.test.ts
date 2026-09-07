// tests/document-schema-integrity.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type {
  DocumentItem,
  DocumentType,
  DocumentUrgency,
  DocumentStatus,
  DocumentDirectiveItem
} from "../src/types/document";

describe("Document Registry Schema & Types Integrity", () => {
  test("prisma schema contains document models and enums", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const content = fs.readFileSync(schemaPath, "utf-8");

    assert.ok(content.includes("model Document {"), "Should define Document model");
    assert.ok(content.includes("model DocumentNumberSequence {"), "Should define DocumentNumberSequence model");
    assert.ok(content.includes("model DocumentAttachment {"), "Should define DocumentAttachment model");
    assert.ok(content.includes("model DocumentDirective {"), "Should define DocumentDirective model");
    assert.ok(content.includes("enum DocumentType {"), "Should define DocumentType enum");
    assert.ok(content.includes("VAN_THU"), "Should include VAN_THU in UserRole");
  });

  test("TypeScript document interfaces validate correctly", () => {
    const mockDoc: DocumentItem = {
      id: "doc-1",
      type: "VAN_BAN_DEN",
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: "2026-09-07T08:00:00Z",
      originalNumber: "125/TCGDNN-VP",
      issuedDate: "2026-09-05T00:00:00Z",
      issuingAuthority: "Tổng cục Giáo dục Nghề nghiệp",
      category: "Công văn",
      summary: "V/v tổ chức hội thi thiết bị đào tạo tự làm toàn quốc",
      urgency: "HOA_TOC",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
      registeredById: "user-vt-1"
    };

    assert.equal(mockDoc.type, "VAN_BAN_DEN");
    assert.equal(mockDoc.urgency, "HOA_TOC");
    assert.equal(mockDoc.registrationNumber, 1);
  });
});
