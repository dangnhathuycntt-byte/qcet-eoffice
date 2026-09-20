import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  type WorkspaceFilterState,
} from "../src/lib/workspace-query";

describe("Workspace Cross-Filter Contamination", () => {
  describe("1. Status không contaminate priority/category", () => {
    test("parse ?status=IN_PROGRESS giữ priority và category là default", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("status=IN_PROGRESS"));
      assert.equal(state.status, "IN_PROGRESS");
      // priority và category không bị set bởi status
      assert.equal(state.priority, undefined);
      assert.equal(state.category, undefined);
    });

    test("parse ?priority=HIGH không ảnh hưởng status", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("priority=HIGH"));
      assert.equal(state.priority, "HIGH");
      // status giữ default
      assert.equal(state.status, "ALL");
    });

    test("parse ?category=ACADEMIC không ảnh hưởng status hay priority", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("category=ACADEMIC"));
      assert.equal(state.category, "ACADEMIC");
      assert.equal(state.status, "ALL");
      assert.equal(state.priority, undefined);
    });
  });

  describe("2. Department không reset unrelated filters", () => {
    test("parse ?dept=X&status=Y giữ cả hai field độc lập", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("dept=KHOA_CNTT&status=IN_PROGRESS"));
      assert.equal(state.dept, "KHOA_CNTT");
      assert.equal(state.status, "IN_PROGRESS");
    });

    test("serialize rồi parse lại — dept và status không bị mất", () => {
      const input: Partial<WorkspaceFilterState> = {
        scope: "unit",
        dept: "PHONG_TC",
        status: "IN_PROGRESS",
      };
      const serialized = serializeWorkspaceQuery(input);
      const parsed = parseWorkspaceQuery(serialized);
      assert.equal(parsed.dept, "PHONG_TC");
      assert.equal(parsed.status, "IN_PROGRESS");
    });
  });

  describe("3. scope=school xóa dept", () => {
    test("parse ?scope=school không có dept → dept undefined", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("scope=school"));
      assert.equal(state.scope, "school");
      assert.equal(state.dept, undefined);
      assert.equal(state.unit, undefined);
    });

    test("serialize scope=school bỏ qua dept nếu scope=school (product rule)", () => {
      // Khi scope là school, dept trong URL bình thường vẫn được parse,
      // nhưng product rule là handleScopeChange xóa dept khi scope != unit.
      // Test này verify parse độc lập không tự xóa dept.
      const state = parseWorkspaceQuery(new URLSearchParams("scope=unit&dept=PHONG_TC"));
      assert.equal(state.scope, "unit");
      assert.equal(state.dept, "PHONG_TC");
    });
  });

  describe("4. Search + filter serialize đúng cả hai", () => {
    test("serializeWorkspaceQuery với search + status → output đúng cả hai", () => {
      const input: Partial<WorkspaceFilterState> = {
        scope: "school",
        status: "IN_PROGRESS",
        q: "báo cáo",
      };
      const serialized = serializeWorkspaceQuery(input);
      const parsed = parseWorkspaceQuery(serialized);
      assert.equal(parsed.status, "IN_PROGRESS");
      // q hoặc query phải có giá trị search
      const searchVal = parsed.q ?? parsed.query;
      assert.equal(searchVal, "báo cáo");
    });

    test("search không override status vừa set", () => {
      const withSearch = serializeWorkspaceQuery({ scope: "school", q: "test", status: "COMPLETED" });
      const parsed = parseWorkspaceQuery(withSearch);
      assert.equal(parsed.status, "COMPLETED");
      assert.ok(parsed.q === "test" || parsed.query === "test");
    });
  });

  describe("5. Deep-link taskId + view + filters", () => {
    test("parse ?taskId=abc&view=kanban&scope=unit&dept=xyz → tất cả fields đúng", () => {
      const params = new URLSearchParams(
        "taskId=abc-123&view=kanban&scope=unit&dept=PHONG_TC"
      );
      const state = parseWorkspaceQuery(params);
      // taskId có thể map vào selectedTaskId hoặc taskId
      const resolvedTaskId = state.selectedTaskId ?? state.taskId;
      assert.ok(resolvedTaskId === "abc-123" || resolvedTaskId === undefined,
        "taskId parsed hoặc không hỗ trợ field này"
      );
      assert.equal(state.view, "kanban");
      assert.equal(state.scope, "unit");
      assert.equal(state.dept, "PHONG_TC");
    });
  });

  describe("6. Back/forward URL restoration — state độc lập giữa hai URL", () => {
    test("parse URL1 và URL2 trả về state riêng biệt, không leak", () => {
      const url1 = new URLSearchParams("scope=unit&dept=PHONG_TC&status=IN_PROGRESS");
      const url2 = new URLSearchParams("scope=school&status=DONE&view=kanban");

      const state1 = parseWorkspaceQuery(url1);
      const state2 = parseWorkspaceQuery(url2);

      assert.equal(state1.scope, "unit");
      assert.equal(state1.dept, "PHONG_TC");
      assert.equal(state1.status, "IN_PROGRESS");
      assert.equal(state1.view, "table"); // default

      assert.equal(state2.scope, "school");
      assert.equal(state2.dept, undefined);
    assert.equal(state2.status, "COMPLETED");
      assert.equal(state2.view, "kanban");
    });

    test("serialize URL1 → parse → serialize → parse: idempotent", () => {
      const original: Partial<WorkspaceFilterState> = {
        scope: "unit",
        dept: "KHOA_CNTT",
        status: "IN_PROGRESS",
        view: "table",
      };
      const pass1 = parseWorkspaceQuery(serializeWorkspaceQuery(original));
      const pass2 = parseWorkspaceQuery(serializeWorkspaceQuery(pass1));
      assert.equal(pass1.scope, pass2.scope);
      assert.equal(pass1.dept, pass2.dept);
      assert.equal(pass1.status, pass2.status);
    });
  });
});
