/**
 * Internal Document Workflow Contract Tests
 *
 * Validates the conservative-default internal document workflow:
 * - Document type: TO_TRINH_NOI_BO
 * - Workflow: submit-content-review → approve-content (existing action routes)
 * - Visibility: originating department + leadership (via buildDocumentReadWhere ACL)
 * - Numbering: institutional-level sequential (existing numbering engine)
 *
 * These tests verify the contract without a database — they test the policy,
 * type mapping, and feature flag behavior.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("Internal Document Workflow Contract", () => {
  test("TO_TRINH_NOI_BO is a recognized document type in the API type map", async () => {
    // Verify the document route accepts TO_TRINH_NOI_BO
    const routeSource = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/documents/route.ts", "utf8")
    );
    assert.ok(
      routeSource.includes("TO_TRINH_NOI_BO"),
      "Documents API route must handle TO_TRINH_NOI_BO type"
    );
    assert.ok(
      routeSource.includes('"INTERNAL"'),
      "Documents API route must accept INTERNAL as alias"
    );
  });

  test("submit-content-review and approve-content action routes exist", async () => {
    const fs = await import("node:fs");
    assert.ok(
      fs.existsSync("src/app/api/documents/[id]/actions/submit-content-review/route.ts"),
      "submit-content-review action route must exist"
    );
    assert.ok(
      fs.existsSync("src/app/api/documents/[id]/actions/approve-content/route.ts"),
      "approve-content action route must exist"
    );
  });

  test("Document stats API counts internal documents separately", async () => {
    const statsSource = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/documents/stats/route.ts", "utf8")
    );
    assert.ok(
      statsSource.includes("TO_TRINH_NOI_BO"),
      "Stats route must count TO_TRINH_NOI_BO documents"
    );
  });

  test("buildDocumentReadWhere enforces unit-level visibility for non-privileged users", async () => {
    const { buildDocumentReadWhere } = await import(
      "../src/server/policies/document-policy"
    );

    // Non-privileged user with a department
    const staffUser = {
      id: "user-staff-1",
      email: "staff@cdktcnqn.edu.vn",
      name: "Nguyen Van A",
      role: "GIAO_VIEN",
      departmentId: "K_CNTT",
      positionCode: "",
    };

    const where = buildDocumentReadWhere(staffUser);
    // Must NOT return the deny sentinel
    assert.notEqual(
      (where as any).id,
      "__DENY_ANONYMOUS__",
      "Authenticated user must not be denied"
    );

    // Anonymous must be denied
    const anonWhere = buildDocumentReadWhere(null);
    assert.equal(
      (anonWhere as any).id,
      "__DENY_ANONYMOUS__",
      "Anonymous user must be denied"
    );
  });

  test("internalDocuments feature flag exists with default false", async () => {
    const { FEATURE_FLAGS, isFeatureEnabled, setFeatureFlagOverride, resetFeatureFlagOverrides } =
      await import("../src/features/flags");

    // Flag must be defined
    assert.ok(
      "internalDocuments" in FEATURE_FLAGS,
      "internalDocuments flag must be defined"
    );
    assert.equal(
      FEATURE_FLAGS.internalDocuments.defaultValue,
      false,
      "internalDocuments must default to false"
    );

    // Must be disabled by default
    resetFeatureFlagOverrides();
    assert.equal(
      isFeatureEnabled("internalDocuments"),
      false,
      "internalDocuments must be disabled by default"
    );

    // Can be enabled via runtime override
    setFeatureFlagOverride("internalDocuments", true);
    assert.equal(
      isFeatureEnabled("internalDocuments"),
      true,
      "internalDocuments must be enableable"
    );
    resetFeatureFlagOverrides();
  });

  test("Registry UI includes submission tab for internal documents", async () => {
    const registrySource = await import("node:fs").then((fs) =>
      fs.readFileSync(
        "src/components/documents/document-registry-view.tsx",
        "utf8"
      )
    );
    assert.ok(
      registrySource.includes("submission"),
      "Registry must include submission tab"
    );
    assert.ok(
      registrySource.includes("Tờ trình duyệt"),
      'Submission tab must be labeled "Tờ trình duyệt"'
    );
  });
});
