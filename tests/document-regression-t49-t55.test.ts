import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatIsoDate, formatDisplayDate } from "@/lib/format";
import { getRegistryStateKind } from "@/lib/documents/registry-state";
import { mapDirectiveToSchoolTask } from "@/lib/documents/directive-pipeline";
import { applyPresetToDirective } from "@/components/documents/directive-action-panel";
import type { DocumentItem, DocumentDirectiveItem } from "@/types/document";

describe("Document Regression & Invariant Tests (T49-T55)", () => {
  describe("T49: ICT (UTC+7) Date Formatting & No Slicing", () => {
    test("Date object near UTC midnight formats to ICT day accurately", () => {
      // 2026-09-09T23:00:00.000Z in UTC is 2026-09-10 06:00:00 in ICT (UTC+7)
      const lateNightUtc = new Date("2026-09-09T23:00:00.000Z");

      // naive .slice(0, 10) on ISO string would give "2026-09-09" (WRONG UTC day)
      assert.strictEqual(lateNightUtc.toISOString().slice(0, 10), "2026-09-09");

      // formatIsoDate gives ICT date "2026-09-10"
      assert.strictEqual(formatIsoDate(lateNightUtc), "2026-09-10");

      // formatDisplayDate gives ICT display format "10/09/2026"
      assert.strictEqual(formatDisplayDate(lateNightUtc), "10/09/2026");
    });

    test("ISO string with +07:00 offset preserves local calendar day", () => {
      const ictIso = "2026-09-10T08:30:00+07:00";
      assert.strictEqual(formatIsoDate(ictIso), "2026-09-10");
      assert.strictEqual(formatDisplayDate(ictIso), "10/09/2026");
    });
  });

  describe("T50 & T51: Failed Fetch Never Renders 'No Documents' Empty State", () => {
    test("Failed fetch sets state to 'error', not 'empty'", () => {
      const stateOnFailure = getRegistryStateKind({
        isLoading: false,
        hasError: true,
        itemCount: 0,
      });
      assert.strictEqual(
        stateOnFailure,
        "error",
        "When fetch fails, state must be 'error', never 'empty'"
      );
    });

    test("Successful empty response sets state to 'empty'", () => {
      const stateOnEmpty = getRegistryStateKind({
        isLoading: false,
        hasError: false,
        itemCount: 0,
      });
      assert.strictEqual(stateOnEmpty, "empty");
    });

    test("Loading state takes precedence", () => {
      const stateOnLoading = getRegistryStateKind({
        isLoading: true,
        hasError: false,
        itemCount: 0,
      });
      assert.strictEqual(stateOnLoading, "loading");
    });

    test("Populated documents set state to 'data'", () => {
      const stateOnData = getRegistryStateKind({
        isLoading: false,
        hasError: false,
        itemCount: 5,
      });
      assert.strictEqual(stateOnData, "data");
    });
  });

  describe("T52 & T53: Directive-to-Task Pipeline & Statutory Presets", () => {
    const dummyDoc: DocumentItem = {
      id: "doc-test-1",
      type: "VAN_BAN_DEN",
      documentYear: 2026,
      originalNumber: "123/UBND",
      registrationNumber: 42,
      registeredDate: "2026-09-02T08:00:00.000Z",
      registeredById: "user-1",
      issuedDate: "2026-09-01T00:00:00.000Z",
      issuingAuthority: "UBND Tỉnh Bình Định",
      category: "Công văn",
      summary: "Triển khai đào tạo nghề chất lượng cao",
      urgency: "HOA_TOC",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
    };

    const dummyDirective: DocumentDirectiveItem = {
      id: "dir-test-1",
      documentId: "doc-test-1",
      leaderId: "leader-1",
      leaderName: "TS. Nguyễn Văn Hiệu",
      instruction: "Giao P. Đào tạo chủ trì",
      assignedDeptId: "DT",
      deadline: "2026-09-15T00:00:00.000Z",
      isTaskGenerated: false,
    };

    test("mapDirectiveToSchoolTask produces valid SchoolTask payload with accurate metadata", () => {
      const payload = mapDirectiveToSchoolTask(dummyDoc, dummyDirective);

      assert.strictEqual(payload.scope, "SCHOOL");
      assert.strictEqual(payload.departmentId, "DT");
      assert.strictEqual(payload.priority, "URGENT"); // HOA_TOC -> URGENT
      assert.strictEqual(payload.sourceDocumentId, "doc-test-1");
      assert.strictEqual(payload.metadata.originalNumber, "123/UBND");
      assert.strictEqual(payload.metadata.directiveInstruction, "Giao P. Đào tạo chủ trì");
      assert.ok(payload.title.includes("VB Đến #42"));
      assert.ok(payload.description.includes("UBND Tỉnh Bình Định"));
    });

    test("applyPresetToDirective sets statutory deadline offset correctly", () => {
      const baseDate = "2026-09-10T00:00:00.000Z";
      const preset = applyPresetToDirective("giao-dao-tao", baseDate);

      assert.strictEqual(preset.assignedDeptId, "DT");
      assert.strictEqual(preset.priority, "HIGH");
      assert.ok(preset.instruction.includes("Phòng Đào tạo"));
      // 5 days offset from 2026-09-10 -> 2026-09-15
      assert.ok(preset.deadline);
      assert.strictEqual(formatIsoDate(preset.deadline), "2026-09-15");
    });
  });
});
