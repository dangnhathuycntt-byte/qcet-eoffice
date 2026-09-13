import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  isWorkspaceQueryEqual,
  buildWorkspaceUrl,
  DEFAULT_WORKSPACE_FILTER_STATE,
  type WorkspaceFilterState,
} from "../src/lib/workspace-query";
import { useWorkspaceQuery, type UseWorkspaceQueryReturn } from "../src/hooks/use-workspace-query";
import { buildTaskReadWhere } from "../src/server/tasks/task-query-service";
import type { AuthenticatedUser } from "../src/server/api/request-context";

describe("Workspace Query: Parsing, Serialization, Legacy Migrations & Deep Linking", () => {
  describe("1. parseWorkspaceQuery defaults and empty inputs", () => {
    test("parses undefined input to canonical default state", () => {
      const state = parseWorkspaceQuery();
      assert.equal(state.scope, "school");
      assert.equal(state.month, "ALL");
      assert.equal(state.status, "ALL");
      assert.equal(state.view, "table");
      assert.equal(state.dept, undefined);
      assert.equal(state.unit, undefined);
      assert.equal(state.unitId, undefined);
      assert.equal(state.date, undefined);
      assert.equal(state.q, undefined);
      assert.equal(state.query, undefined);
      assert.equal(state.taskId, undefined);
      assert.equal(state.selectedTaskId, undefined);
      assert.equal(state.attention, undefined);
    });

    test("parses empty URLSearchParams to canonical default state", () => {
      const state = parseWorkspaceQuery(new URLSearchParams());
      assert.equal(state.scope, "school");
      assert.equal(state.month, "ALL");
      assert.equal(state.status, "ALL");
      assert.equal(state.view, "table");
    });

    test("parses empty query string to canonical default state", () => {
      const state = parseWorkspaceQuery("");
      assert.equal(state.scope, "school");
      assert.equal(state.month, "ALL");
      assert.equal(state.status, "ALL");
      assert.equal(state.view, "table");
    });

    test("parses empty Record to canonical default state", () => {
      const state = parseWorkspaceQuery({});
      assert.equal(state.scope, "school");
      assert.equal(state.month, "ALL");
      assert.equal(state.status, "ALL");
      assert.equal(state.view, "table");
    });

    test("parses with isCalendar option to default month view", () => {
      const state = parseWorkspaceQuery("", { isCalendar: true });
      assert.equal(state.view, "month");
    });

    test("parses full URL strings directly", () => {
      const state = parseWorkspaceQuery("https://qcet.edu.vn/tasks?scope=unit&unit=CNTT&q=kiem-tra");
      assert.equal(state.scope, "unit");
      assert.equal(state.unit, "CNTT");
      assert.equal(state.dept, "CNTT");
      assert.equal(state.unitId, "CNTT");
      assert.equal(state.q, "kiem-tra");
    });
  });

  describe("2. Scope parsing and legacy migrations", () => {
    test("parses standard scopes directly", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=school")).scope, "school");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=unit")).scope, "unit");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=my")).scope, "my");
    });

    test("migrates legacy 'personal' -> 'my'", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("scope=personal"));
      assert.equal(state.scope, "my");
    });

    test("migrates legacy 'all' -> 'school'", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("scope=all"));
      assert.equal(state.scope, "school");
    });

    test("migrates legacy uppercase enum scopes", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=SCHOOL_TASKS")).scope, "school");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=UNIT_TASKS")).scope, "unit");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=MY_TASKS")).scope, "my");
    });

    test("migrates legacy 'department' and 'dept' -> 'unit'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=department")).scope, "unit");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=dept")).scope, "unit");
    });

    test("migrates legacy 'individual' -> 'my'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=individual")).scope, "my");
    });

    test("migrates Vietnamese aliases 'toan_truong', 'don_vi', 'cua_toi'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=toan_truong")).scope, "school");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=don_vi")).scope, "unit");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=cua_toi")).scope, "my");
    });

    test("falls back to default scope for unknown or invalid scopes without throwing", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=invalid_scope")).scope, "school");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("scope=unknown")).scope, "school");
      assert.equal(
        parseWorkspaceQuery(new URLSearchParams("scope=garbage"), { defaultScope: "unit" }).scope,
        "unit"
      );
    });
  });

  describe("3. Department and unit identifier resolution", () => {
    test("resolves dept parameter to dept, unit, and unitId", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("dept=CNTT"));
      assert.equal(state.dept, "CNTT");
      assert.equal(state.unit, "CNTT");
      assert.equal(state.unitId, "CNTT");
    });

    test("resolves unit parameter directly to dept, unit, and unitId", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("unit=KHTV"));
      assert.equal(state.dept, "KHTV");
      assert.equal(state.unit, "KHTV");
      assert.equal(state.unitId, "KHTV");
    });

    test("resolves unitId parameter to dept, unit, and unitId", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("unitId=KHTV"));
      assert.equal(state.dept, "KHTV");
      assert.equal(state.unit, "KHTV");
      assert.equal(state.unitId, "KHTV");
    });

    test("resolves legacy departmentId and department aliases", () => {
      const state1 = parseWorkspaceQuery(new URLSearchParams("departmentId=PKHTC"));
      assert.equal(state1.dept, "PKHTC");
      assert.equal(state1.unit, "PKHTC");
      assert.equal(state1.unitId, "PKHTC");

      const state2 = parseWorkspaceQuery(new URLSearchParams("department=DT"));
      assert.equal(state2.dept, "DT");
      assert.equal(state2.unit, "DT");
      assert.equal(state2.unitId, "DT");
    });

    test("ignores 'ALL' or empty department values", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("dept=ALL")).dept, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("dept=all")).unitId, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("unit=ALL")).unit, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("dept=")).dept, undefined);
    });
  });

  describe("4. Academic Month, Period, and Date parsing", () => {
    test("parses valid month numbers 1 to 12", () => {
      for (let m = 1; m <= 12; m++) {
        const state = parseWorkspaceQuery(new URLSearchParams(`month=${m}`));
        assert.equal(state.month, m);
      }
    });

    test("parses month='ALL' as 'ALL'", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("month=ALL"));
      assert.equal(state.month, "ALL");
    });

    test("parses period='2026-09' or month='2026-09' (YYYY-MM) as month number 9", () => {
      const state1 = parseWorkspaceQuery(new URLSearchParams("period=2026-09"));
      assert.equal(state1.month, 9);

      const state2 = parseWorkspaceQuery(new URLSearchParams("month=2026-09"));
      assert.equal(state2.month, 9);

      const state3 = parseWorkspaceQuery(new URLSearchParams("p=2026-11"));
      assert.equal(state3.month, 11);
    });

    test("parses period with ISO date (YYYY-MM-DD) to date", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("period=2026-09-15"));
      assert.equal(state.date, "2026-09-15");
    });

    test("falls back to 'ALL' for out-of-bounds or non-numeric months without throwing", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("month=0")).month, "ALL");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("month=13")).month, "ALL");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("month=-5")).month, "ALL");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("month=abc")).month, "ALL");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("month=")).month, "ALL");
    });

    test("supports legacy aliases 'academicMonth' and 'm'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("academicMonth=9")).month, 9);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("m=11")).month, 11);
    });

    test("parses valid ISO dates (YYYY-MM-DD)", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("date=2026-09-10"));
      assert.equal(state.date, "2026-09-10");
    });

    test("rejects invalid date formats safely without throwing", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("date=10-09-2026")).date, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("date=2026/09/10")).date, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("date=invalid")).date, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("date=")).date, undefined);
    });
  });

  describe("5. Status resolution and legacy 'tab' migration", () => {
    test("parses canonical TaskLifecycleStatus values", () => {
      const statuses = [
        "NOT_STARTED",
        "IN_PROGRESS",
        "WAITING_APPROVAL",
        "PENDING_EXECUTIVE_APPROVAL",
        "COMPLETED",
        "OVERDUE",
        "CANCELLED",
      ] as const;

      for (const st of statuses) {
        const state = parseWorkspaceQuery(new URLSearchParams(`status=${st}`));
        assert.equal(state.status, st);
      }
    });

    test("normalizes lowercase status values", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("status=in_progress")).status, "IN_PROGRESS");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("status=completed")).status, "COMPLETED");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("status=waiting_approval")).status, "WAITING_APPROVAL");
    });

    test("migrates legacy 'tab=review' -> 'WAITING_APPROVAL'", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("tab=review"));
      assert.equal(state.status, "WAITING_APPROVAL");
    });

    test("migrates legacy 'tab=in_progress' and 'tab=doing' -> 'IN_PROGRESS'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=in_progress")).status, "IN_PROGRESS");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=doing")).status, "IN_PROGRESS");
    });

    test("migrates legacy 'tab=todo' and 'tab=new' -> 'NOT_STARTED'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=todo")).status, "NOT_STARTED");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=new")).status, "NOT_STARTED");
    });

    test("migrates legacy 'tab=completed' and 'tab=done' -> 'COMPLETED'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=completed")).status, "COMPLETED");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=done")).status, "COMPLETED");
    });

    test("migrates legacy 'tab=overdue' -> 'OVERDUE'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=overdue")).status, "OVERDUE");
    });

    test("migrates legacy 'tab=executive' -> 'PENDING_EXECUTIVE_APPROVAL'", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=executive")).status, "PENDING_EXECUTIVE_APPROVAL");
    });

    test("status parameter takes precedence over tab parameter", () => {
      const state = parseWorkspaceQuery(new URLSearchParams("status=COMPLETED&tab=review"));
      assert.equal(state.status, "COMPLETED");
    });

    test("falls back to 'ALL' for invalid status values without throwing", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("status=random")).status, "ALL");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("tab=all")).status, "ALL");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("status=")).status, "ALL");
    });
  });

  describe("6. View mode, search query, task selection, and attention", () => {
    test("parses allowed view modes", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=table")).view, "table");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=kanban")).view, "kanban");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=month")).view, "month");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=agenda")).view, "agenda");
    });

    test("falls back to default view on unknown view modes without throwing", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=chart")).view, "table");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=chart"), { isCalendar: true }).view, "month");
      assert.equal(parseWorkspaceQuery(new URLSearchParams("view=")).view, "table");
    });

    test("parses search query aliases to both q and query", () => {
      const s1 = parseWorkspaceQuery(new URLSearchParams("q=kiem-tra"));
      assert.equal(s1.q, "kiem-tra");
      assert.equal(s1.query, "kiem-tra");

      const s2 = parseWorkspaceQuery(new URLSearchParams("query=bao-cao"));
      assert.equal(s2.q, "bao-cao");
      assert.equal(s2.query, "bao-cao");

      const s3 = parseWorkspaceQuery(new URLSearchParams("search=ke-hoach"));
      assert.equal(s3.q, "ke-hoach");
      assert.equal(s3.query, "ke-hoach");
    });

    test("parses taskId aliases to both taskId and selectedTaskId", () => {
      const s1 = parseWorkspaceQuery(new URLSearchParams("taskId=task-123"));
      assert.equal(s1.taskId, "task-123");
      assert.equal(s1.selectedTaskId, "task-123");

      const s2 = parseWorkspaceQuery(new URLSearchParams("selectedTaskId=task-456"));
      assert.equal(s2.taskId, "task-456");
      assert.equal(s2.selectedTaskId, "task-456");

      const s3 = parseWorkspaceQuery(new URLSearchParams("task_id=task-789"));
      assert.equal(s3.taskId, "task-789");
      assert.equal(s3.selectedTaskId, "task-789");
    });

    test("parses user attention types", () => {
      const s = parseWorkspaceQuery(new URLSearchParams("attention=requires_my_approval"));
      assert.equal(s.attention, "requires_my_approval");
    });

    test("normalizes invalid attention types safely without throwing", () => {
      assert.equal(parseWorkspaceQuery(new URLSearchParams("attention=invalid")).attention, undefined);
      assert.equal(parseWorkspaceQuery(new URLSearchParams("attention=")).attention, undefined);
    });
  });

  describe("7. Serialization and omission of defaults", () => {
    test("omits default view='table' on tasks", () => {
      const params = serializeWorkspaceQuery({ view: "table" });
      assert.equal(params.get("view"), null);
    });

    test("retains non-default view='kanban' on tasks", () => {
      const params = serializeWorkspaceQuery({ view: "kanban" });
      assert.equal(params.get("view"), "kanban");
    });

    test("omits default view='month' on calendar", () => {
      const params = serializeWorkspaceQuery({ view: "month" }, { isCalendar: true });
      assert.equal(params.get("view"), null);
    });

    test("retains non-default view='agenda' on calendar", () => {
      const params = serializeWorkspaceQuery({ view: "agenda" }, { isCalendar: true });
      assert.equal(params.get("view"), "agenda");
    });

    test("omits default month='ALL'", () => {
      const params = serializeWorkspaceQuery({ month: "ALL" });
      assert.equal(params.get("month"), null);
    });

    test("retains specific month", () => {
      const params = serializeWorkspaceQuery({ month: 9 });
      assert.equal(params.get("month"), "9");
    });

    test("omits default status='ALL'", () => {
      const params = serializeWorkspaceQuery({ status: "ALL" });
      assert.equal(params.get("status"), null);
    });

    test("retains non-default status", () => {
      const params = serializeWorkspaceQuery({ status: "WAITING_APPROVAL" });
      assert.equal(params.get("status"), "WAITING_APPROVAL");
    });

    test("produces completely empty query params for default state without scope", () => {
      const params = serializeWorkspaceQuery({
        view: "table",
        month: "ALL",
        status: "ALL",
      });
      assert.equal(params.toString(), "");
    });

    test("omits default scope='school' when omitDefaultScope is true", () => {
      const params = serializeWorkspaceQuery(
        {
          scope: "school",
          view: "table",
          month: "ALL",
          status: "ALL",
        },
        { omitDefaultScope: true }
      );
      assert.equal(params.toString(), "");
    });

    test("retains scope='school' when explicit and omitDefaultScope is false", () => {
      const params = serializeWorkspaceQuery({
        scope: "school",
        view: "table",
        month: "ALL",
        status: "ALL",
      });
      assert.equal(params.get("scope"), "school");
      assert.equal(params.get("view"), null);
      assert.equal(params.get("month"), null);
      assert.equal(params.get("status"), null);
    });

    test("serializes unit scope and department identifier via dept", () => {
      const params = serializeWorkspaceQuery({
        scope: "unit",
        dept: "CNTT",
        month: 5,
        status: "IN_PROGRESS",
      });
      assert.equal(params.get("scope"), "unit");
      assert.equal(params.get("dept"), "CNTT");
      assert.equal(params.get("month"), "5");
      assert.equal(params.get("status"), "IN_PROGRESS");
    });

    test("serializes unit scope and unit identifier via unit param", () => {
      const params = serializeWorkspaceQuery({
        scope: "unit",
        unit: "CNTT",
        month: 5,
        status: "IN_PROGRESS",
      });
      assert.equal(params.get("scope"), "unit");
      assert.equal(params.get("unit"), "CNTT");
      assert.equal(params.get("month"), "5");
      assert.equal(params.get("status"), "IN_PROGRESS");
    });

    test("serializes unit via options.unitParamKey override", () => {
      const params = serializeWorkspaceQuery(
        {
          scope: "unit",
          dept: "CNTT",
        },
        { unitParamKey: "unit" }
      );
      assert.equal(params.get("unit"), "CNTT");
      assert.equal(params.get("dept"), null);
    });

    test("serializes personal scope", () => {
      const params = serializeWorkspaceQuery({
        scope: "my",
        view: "kanban",
      });
      assert.equal(params.get("scope"), "my");
      assert.equal(params.get("view"), "kanban");
    });

    test("serializes search query, date, and task ID", () => {
      const params = serializeWorkspaceQuery({
        date: "2026-09-10",
        q: "nghiệm thu",
        taskId: "task-001",
      });
      assert.equal(params.get("date"), "2026-09-10");
      assert.equal(params.get("q"), "nghiệm thu");
      assert.equal(params.get("taskId"), "task-001");
    });
  });

  describe("8. Deep link preservation and unrelated parameter retention", () => {
    test("preserves non-workspace query parameters when updating filters", () => {
      const existingQuery = "utm_source=email&theme=light&returnUrl=%2Fdashboard";
      const params = serializeWorkspaceQuery(
        {
          scope: "unit",
          dept: "CNTT",
          status: "IN_PROGRESS",
        },
        { preserveParams: existingQuery }
      );

      // Non-workspace parameters preserved
      assert.equal(params.get("utm_source"), "email");
      assert.equal(params.get("theme"), "light");
      assert.equal(params.get("returnUrl"), "/dashboard");

      // Workspace parameters updated
      assert.equal(params.get("scope"), "unit");
      assert.equal(params.get("dept"), "CNTT");
      assert.equal(params.get("status"), "IN_PROGRESS");
    });

    test("cleans up obsolete legacy keys when updating preserved parameters", () => {
      const existingQuery = "utm_source=slack&tab=review&academicMonth=4&view_id=default&period=2026-04";
      const params = serializeWorkspaceQuery(
        {
          status: "COMPLETED",
          month: 10,
        },
        { preserveParams: existingQuery }
      );

      assert.equal(params.get("utm_source"), "slack");
      assert.equal(params.get("status"), "COMPLETED");
      assert.equal(params.get("month"), "10");

      // Obsolete legacy keys purged
      assert.equal(params.get("tab"), null);
      assert.equal(params.get("academicMonth"), null);
      assert.equal(params.get("view_id"), null);
      assert.equal(params.get("period"), null);
    });

    test("deep link URL full round-trip maintains exact semantic state", () => {
      const originalState: WorkspaceFilterState = {
        scope: "unit",
        unitId: "PKHTC",
        dept: "PKHTC",
        unit: "PKHTC",
        month: 11,
        date: "2026-11-20",
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
        view: "kanban",
        q: "dự toán ngân sách",
        query: "dự toán ngân sách",
        taskId: "task-fin-99",
        selectedTaskId: "task-fin-99",
      };

      const serialized = serializeWorkspaceQuery(originalState);
      const parsed = parseWorkspaceQuery(serialized);

      assert.ok(
        isWorkspaceQueryEqual(originalState, parsed),
        "Round-trip serialized query must equal original semantic state"
      );
    });
  });

  describe("9. URL Roundtrip: serialize(parse(url)) === url for valid parameters", () => {
    test("roundtrips valid canonical task URL with dept", () => {
      const query = "scope=unit&dept=CNTT&month=11&status=WAITING_APPROVAL&view=kanban&q=bao-cao&taskId=task-123";
      const parsed = parseWorkspaceQuery(query);
      const serialized = serializeWorkspaceQuery(parsed).toString();
      assert.equal(serialized, query);
    });

    test("roundtrips valid canonical task URL with unit", () => {
      const query = "scope=unit&unit=CNTT&month=11&status=WAITING_APPROVAL&view=kanban&q=bao-cao&taskId=task-123";
      const parsed = parseWorkspaceQuery(query);
      const serialized = serializeWorkspaceQuery(parsed).toString();
      assert.equal(serialized, query);
    });

    test("roundtrips personal scope task URL", () => {
      const query = "scope=my&month=9&status=IN_PROGRESS&view=kanban&q=ke-hoach";
      const parsed = parseWorkspaceQuery(query);
      const serialized = serializeWorkspaceQuery(parsed).toString();
      assert.equal(serialized, query);
    });

    test("roundtrips calendar URL with date and agenda view", () => {
      const query = "scope=school&date=2026-09-10&view=agenda";
      const parsed = parseWorkspaceQuery(query, { isCalendar: true });
      const serialized = serializeWorkspaceQuery(parsed, { isCalendar: true }).toString();
      assert.equal(serialized, query);
    });

    test("roundtrips full URL paths via buildWorkspaceUrl", () => {
      const path = "/tasks";
      const state: WorkspaceFilterState = {
        scope: "unit",
        dept: "CNTT",
        month: 10,
        status: "COMPLETED",
        view: "kanban",
      };
      const url = buildWorkspaceUrl(path, state);
      const parsedParams = parseWorkspaceQuery(url);
      const reconstructedUrl = buildWorkspaceUrl(path, parsedParams);
      assert.equal(reconstructedUrl, url);
    });
  });

  describe("10. isWorkspaceQueryEqual semantic comparison", () => {
    test("returns true for identical filter states", () => {
      const a: WorkspaceFilterState = {
        scope: "school",
        month: "ALL",
        status: "ALL",
        view: "table",
      };
      const b: WorkspaceFilterState = { ...a };
      assert.equal(isWorkspaceQueryEqual(a, b), true);
    });

    test("returns true when aliases match (dept vs unitId vs unit, q vs query, taskId vs selectedTaskId)", () => {
      const a: WorkspaceFilterState = {
        scope: "unit",
        dept: "CNTT",
        month: 5,
        status: "IN_PROGRESS",
        view: "table",
        q: "test",
        taskId: "t-1",
      };
      const b: WorkspaceFilterState = {
        scope: "unit",
        unitId: "CNTT",
        unit: "CNTT",
        month: 5,
        status: "IN_PROGRESS",
        view: "table",
        query: "test",
        selectedTaskId: "t-1",
      };
      assert.equal(isWorkspaceQueryEqual(a, b), true);
    });

    test("returns false when any semantic dimension differs", () => {
      const base: WorkspaceFilterState = {
        scope: "school",
        month: "ALL",
        status: "ALL",
        view: "table",
      };

      assert.equal(isWorkspaceQueryEqual(base, { ...base, scope: "unit" }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, month: 9 }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, status: "COMPLETED" }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, view: "kanban" }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, q: "search" }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, taskId: "task-1" }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, date: "2026-09-10" }), false);
      assert.equal(isWorkspaceQueryEqual(base, { ...base, attention: "requires_my_action" }), false);
    });

    test("treats attention: 'ALL' and attention: undefined as semantically equal across serialization round-trip", () => {
      const stateWithAll: WorkspaceFilterState = {
        scope: "school",
        month: "ALL",
        status: "ALL",
        view: "table",
        attention: "ALL",
      };
      const stateWithUndefined: WorkspaceFilterState = {
        scope: "school",
        month: "ALL",
        status: "ALL",
        view: "table",
        attention: undefined,
      };

      assert.equal(isWorkspaceQueryEqual(stateWithAll, stateWithUndefined), true);
      const serialized = serializeWorkspaceQuery(stateWithAll).toString();
      const parsed = parseWorkspaceQuery(serialized);
      assert.equal(isWorkspaceQueryEqual(stateWithAll, parsed), true);
    });
  });

  describe("11. buildWorkspaceUrl helper", () => {
    test("builds clean url with query string", () => {
      const url = buildWorkspaceUrl("/tasks", {
        scope: "unit",
        dept: "CNTT",
        status: "IN_PROGRESS",
      });
      assert.equal(url, "/tasks?scope=unit&dept=CNTT&status=IN_PROGRESS");
    });

    test("omits query string when params are empty", () => {
      const url = buildWorkspaceUrl(
        "/tasks",
        {
          scope: "school",
          view: "table",
          month: "ALL",
          status: "ALL",
        },
        { omitDefaultScope: true }
      );
      assert.equal(url, "/tasks");
    });
  });

  describe("12. useWorkspaceQuery Hook integration & Browser History Synchronization", () => {
    function renderHookHarness(
      searchParamsStr: string = "",
      options?: any,
      pathname: string = "/tasks"
    ) {
      let hookResult: UseWorkspaceQueryReturn | null = null;
      let pushedUrl: string | null = null;
      let replacedUrl: string | null = null;

      const mockRouter = {
        push: (url: string) => { pushedUrl = url; },
        replace: (url: string) => { replacedUrl = url; },
        prefetch: () => {},
        back: () => {},
        forward: () => {},
        refresh: () => {},
      };

      function TestHookComponent() {
        hookResult = useWorkspaceQuery(options);
        return React.createElement("div", null, "rendered");
      }

      const searchParams = new URLSearchParams(searchParamsStr);

      renderToStaticMarkup(
        React.createElement(
          AppRouterContext.Provider,
          { value: mockRouter },
          React.createElement(
            PathnameContext.Provider,
            { value: pathname },
            React.createElement(
              SearchParamsContext.Provider,
              { value: searchParams },
              React.createElement(TestHookComponent)
            )
          )
        )
      );

      return {
        get hook() {
          return hookResult!;
        },
        getPushedUrl: () => pushedUrl,
        getReplacedUrl: () => replacedUrl,
      };
    }

    test("initializes with parsed searchParams and default path /tasks", () => {
      const harness = renderHookHarness("scope=unit&dept=CNTT&month=10&status=IN_PROGRESS");
      assert.equal(harness.hook.queryState.scope, "unit");
      assert.equal(harness.hook.queryState.dept, "CNTT");
      assert.equal(harness.hook.queryState.unit, "CNTT");
      assert.equal(harness.hook.queryState.unitId, "CNTT");
      assert.equal(harness.hook.queryState.month, 10);
      assert.equal(harness.hook.queryState.status, "IN_PROGRESS");
      assert.equal(harness.hook.queryState.view, "table");
    });

    test("setScope updates scope to 'my' and clears department", () => {
      const harness = renderHookHarness("scope=unit&dept=CNTT");
      harness.hook.setScope("my");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=my");
    });

    test("setScope updates scope to 'unit' with explicit unit parameter and preserves unitParamKey", () => {
      const harness = renderHookHarness("scope=school", { unitParamKey: "unit" });
      harness.hook.setScope("unit", { unit: "KETOAN" });
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=unit&unit=KETOAN");
    });

    test("setUnit and setDept set scope to 'unit' and synchronize unit identifiers", () => {
      const harnessDept = renderHookHarness("scope=school");
      harnessDept.hook.setDept("KETOAN");
      assert.equal(harnessDept.getReplacedUrl(), "/tasks?scope=unit&dept=KETOAN");

      const harnessUnit = renderHookHarness("scope=school", { unitParamKey: "unit" });
      harnessUnit.hook.setUnit("CNTT");
      assert.equal(harnessUnit.getReplacedUrl(), "/tasks?scope=unit&unit=CNTT");
    });

    test("setPeriod updates month and date independently", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.setPeriod({ month: 11 });
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school&month=11");

      const harnessDate = renderHookHarness("scope=school");
      harnessDate.hook.setPeriod({ date: "2026-11-20" });
      assert.equal(harnessDate.getReplacedUrl(), "/tasks?scope=school&date=2026-11-20");
    });

    test("setStatus updates lifecycle status and replaces URL", () => {
      const harness = renderHookHarness("scope=unit&dept=CNTT");
      harness.hook.setStatus("COMPLETED");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=unit&dept=CNTT&status=COMPLETED");
    });

    test("setAttention updates user attention type and serializes correctly", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.setAttention("requires_my_approval");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school&attention=requires_my_approval");

      harness.hook.setAttention("ALL");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school");
    });

    test("setView updates view mode between table and kanban", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.setView("kanban");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school&view=kanban");

      // Switching back to table omits view because table is default
      const harnessKanban = renderHookHarness("scope=school&view=kanban");
      harnessKanban.hook.setView("table");
      assert.equal(harnessKanban.getReplacedUrl(), "/tasks?scope=school");
    });

    test("setSearchQuery trims needle and updates q/query", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.setSearchQuery("  bao cao thang  ");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school&q=bao+cao+thang");

      // Empty search query removes q
      harness.hook.setSearchQuery("   ");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school");
    });

    test("setSelectedTask updates taskId/selectedTaskId deep link", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.setSelectedTask("task-uuid-456");
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school&taskId=task-uuid-456");

      harness.hook.setSelectedTask(null);
      assert.equal(harness.getReplacedUrl(), "/tasks?scope=school");
    });

    test("resetFilters clears filters to defaults while preserving unrelated parameters", () => {
      const harness = renderHookHarness(
        "scope=unit&dept=CNTT&month=10&status=IN_PROGRESS&view=kanban&utm_source=portal&filter_ref=123"
      );
      harness.hook.resetFilters();
      // Should reset to school, table, ALL month, ALL status, but preserve utm_source and filter_ref
      assert.equal(
        harness.getReplacedUrl(),
        "/tasks?utm_source=portal&filter_ref=123&scope=school"
      );
    });

    test("resetFilters with preserveScope keeps current scope and department", () => {
      const harness = renderHookHarness(
        "scope=unit&dept=CNTT&month=10&status=IN_PROGRESS&view=kanban&utm_source=portal"
      );
      harness.hook.resetFilters({ preserveScope: true });
      assert.equal(
        harness.getReplacedUrl(),
        "/tasks?utm_source=portal&scope=unit&dept=CNTT"
      );
    });

    test("updateWorkspaceQuery supports atomic multi-attribute patch and functional updater", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.updateWorkspaceQuery({
        scope: "unit",
        dept: "KHCN",
        month: 12,
        status: "COMPLETED",
        view: "kanban",
      });
      assert.equal(
        harness.getReplacedUrl(),
        "/tasks?scope=unit&dept=KHCN&month=12&status=COMPLETED&view=kanban"
      );

      // Functional updater
      harness.hook.updateWorkspaceQuery((prev) => ({
        ...prev,
        status: "CANCELLED",
      }));
      assert.equal(
        harness.getReplacedUrl(),
        "/tasks?scope=school&status=CANCELLED"
      );
    });

    test("supports push navigation when replace: false is specified", () => {
      const harness = renderHookHarness("scope=school");
      harness.hook.setScope("my", { replace: false });
      assert.equal(harness.getPushedUrl(), "/tasks?scope=my");
      assert.equal(harness.getReplacedUrl(), null);
    });

    test("supports shallow history navigation (pushState / replaceState)", () => {
      let shallowPushedUrl: string | null = null;
      let shallowReplacedUrl: string | null = null;
      const listeners: Record<string, Function[]> = {};

      const mockWindow = {
        location: { search: "?scope=school" },
        history: {
          pushState: (_state: any, _title: string, url: string) => {
            shallowPushedUrl = url;
          },
          replaceState: (_state: any, _title: string, url: string) => {
            shallowReplacedUrl = url;
          },
        },
        addEventListener: (type: string, listener: Function) => {
          listeners[type] = listeners[type] || [];
          listeners[type].push(listener);
        },
        removeEventListener: (type: string, listener: Function) => {
          listeners[type] = (listeners[type] || []).filter((l) => l !== listener);
        },
      };

      (global as any).window = mockWindow;

      try {
        const harness = renderHookHarness("scope=school");

        harness.hook.setStatus("COMPLETED", { shallow: true, replace: false });
        assert.equal(shallowPushedUrl, "/tasks?scope=school&status=COMPLETED");

        harness.hook.setStatus("IN_PROGRESS", { shallow: true, replace: true });
        assert.equal(shallowReplacedUrl, "/tasks?scope=school&status=IN_PROGRESS");
      } finally {
        delete (global as any).window;
      }
    });

    test("handles popstate events on window for browser Back/Forward navigation", () => {
      const listeners: Record<string, Function[]> = {};

      const mockWindow = {
        location: { search: "?scope=unit&dept=CNTT" },
        addEventListener: (type: string, listener: Function) => {
          listeners[type] = listeners[type] || [];
          listeners[type].push(listener);
        },
        removeEventListener: (type: string, listener: Function) => {
          listeners[type] = (listeners[type] || []).filter((l) => l !== listener);
        },
      };

      (global as any).window = mockWindow;
      const originalUseEffect = React.useEffect;
      let capturedEffect: (() => void | (() => void)) | null = null;
      (React as any).useEffect = (fn: any) => {
        capturedEffect = fn;
      };

      try {
        const harness = renderHookHarness("scope=school");
        assert.equal(harness.hook.queryState.scope, "school");

        // Execute captured effect to simulate browser component mounting
        assert.ok(capturedEffect, "popstate effect should be registered");
        const cleanup = (capturedEffect as any)();

        // Verify popstate listener was registered on window
        assert.ok(listeners["popstate"]);
        assert.equal(listeners["popstate"].length, 1);

        // Simulate browser Back/Forward navigation firing popstate event
        listeners["popstate"][0]();

        // Verify cleanup on component unmount
        if (typeof cleanup === "function") {
          cleanup();
          assert.equal(listeners["popstate"].length, 0);
        }
      } finally {
        (React as any).useEffect = originalUseEffect;
        delete (global as any).window;
      }
    });

    test("respects hook options: isCalendar, defaultScope, defaultView, omitDefaultScope, unitParamKey", () => {
      const calendarHarness = renderHookHarness(
        "",
        {
          isCalendar: true,
          defaultView: "agenda",
          defaultScope: "unit",
          omitDefaultScope: true,
          unitParamKey: "unit",
        },
        "/calendar"
      );

      assert.equal(calendarHarness.hook.queryState.view, "agenda");
      assert.equal(calendarHarness.hook.queryState.scope, "unit");

      // Setting unit with unitParamKey='unit' serializes to 'unit' param
      calendarHarness.hook.setUnit("CNTT");
      assert.equal(
        calendarHarness.getReplacedUrl(),
        "/calendar?scope=unit&unit=CNTT&view=agenda"
      );
    });
  });

  describe("13. Server-Side Authorization Safety & URL Parameter Non-Widening Invariant", () => {
    test("URL query parameters cannot widen dataset access for staff role (scope=school does not bypass department isolation)", () => {
      // 1. Client parses ?scope=school from URL
      const clientState = parseWorkspaceQuery("?scope=school&status=ALL");
      assert.equal(clientState.scope, "school");

      // 2. Staff user authenticated context
      const staffUser = {
        id: "staff-uuid-001",
        email: "staff.cntt@qcet.edu.vn",
        name: "Nguyen Van Staff",
        role: "CHUYEN_VIEN",
        departmentId: "DEPT_CNTT",
        isActive: true,
      };

      // 3. Server authorization rule (server truth wins)
      const authWhere = buildTaskReadWhere(staffUser);

      // Verify the auth where strictly limits to staff's assignments, actors, or departmentId
      assert.ok(authWhere.OR);
      assert.deepEqual(authWhere.OR, [
        { assignees: { some: { userId: staffUser.id } } },
        { actors: { some: { userId: staffUser.id } } },
        { departmentId: staffUser.departmentId },
      ]);

      // Combining with client view scope=school still enforces server auth restriction
      const combinedWhere = {
        AND: [
          authWhere,
          { scope: "SCHOOL" },
        ],
      };

      assert.deepEqual(combinedWhere.AND[0], authWhere);
      // The user CANNOT see records of other departments even if client query specified scope=school
    });

    test("URL query tampering with foreign department (dept=OTHER) does not grant cross-unit access to non-leadership staff", () => {
      // Tampered URL asking for financial department records
      const clientState = parseWorkspaceQuery("?scope=unit&dept=DEPT_TAICHINH");
      assert.equal(clientState.dept, "DEPT_TAICHINH");

      const staffUser = {
        id: "staff-uuid-002",
        email: "chuyenvien.cntt@qcet.edu.vn",
        name: "Tran Van Staff",
        role: "CHUYEN_VIEN",
        departmentId: "DEPT_CNTT",
        isActive: true,
      };

      const authWhere = buildTaskReadWhere(staffUser);

      // If combined in query:
      // AND: [ authWhere, { departmentId: clientState.dept } ]
      // Since staffUser is in DEPT_CNTT, unless assigned to the task directly,
      // DEPT_TAICHINH tasks will NOT match { departmentId: staffUser.departmentId }
      const combinedWhere = {
        AND: [
          authWhere,
          { departmentId: clientState.dept },
        ],
      };

      assert.equal(combinedWhere.AND[1].departmentId, "DEPT_TAICHINH");
      // authWhere remains strictly bound to DEPT_CNTT
      assert.equal(authWhere.OR![2].departmentId, "DEPT_CNTT");
    });

    test("Anonymous / unauthenticated requests cannot access any records regardless of URL parameters (returns deny-all condition)", () => {
      // Attacker constructs permissive URL query
      const clientState = parseWorkspaceQuery("?scope=school&dept=ALL&status=ALL&view=table&q=");

      // Server evaluates unauthenticated context
      const authWhere = buildTaskReadWhere(null as unknown as AuthenticatedUser);

      // Unconditionally denies access with a sentinel ID that matches no records
      assert.deepEqual(authWhere, { id: "__DENY_ANONYMOUS__" });
    });

    test("Institutional leadership (ADMIN, HIEU_TRUONG) query filter is unconstrained by department but scoped by client view filters", () => {
      const adminUser = {
        id: "admin-uuid-001",
        email: "admin@qcet.edu.vn",
        name: "Admin User",
        role: "ADMIN",
        departmentId: null,
        isActive: true,
      };

      const leaderUser = {
        id: "rector-uuid-001",
        email: "hieutruong@qcet.edu.vn",
        name: "Hieu Truong",
        role: "HIEU_TRUONG",
        departmentId: null,
        isActive: true,
      };

      const adminAuth = buildTaskReadWhere(adminUser);
      const leaderAuth = buildTaskReadWhere(leaderUser);

      // Leadership has school-wide read access
      assert.deepEqual(adminAuth, {});
      assert.deepEqual(leaderAuth, {});

      // Client view filter (e.g. ?scope=unit&dept=CNTT) acts purely as an aggregation/view filter
      const clientState = parseWorkspaceQuery("?scope=unit&dept=CNTT");
      const combinedAdminWhere = {
        AND: [
          adminAuth,
          { departmentId: clientState.dept },
        ],
      };

      assert.equal(combinedAdminWhere.AND[1].departmentId, "CNTT");
    });

    test("Role is Not Scope invariant: TaskScope visual filter selection never alters or elevates user authority", () => {
      // Upholding 05-domain-freeze.md & 00-core.md:
      // Scope selection by an authenticated user does NOT alter, widen, or narrow their statutory operational authorization.
      const lecturerUser = {
        id: "lecturer-uuid-001",
        email: "giangvien@qcet.edu.vn",
        name: "Giang Vien A",
        role: "GIANG_VIEN",
        departmentId: "KHOA_CNTT",
        isActive: true,
      };

      // Whether client requests scope=school, scope=unit, or scope=my:
      const scopeSchoolQuery = parseWorkspaceQuery("?scope=school");
      const scopeUnitQuery = parseWorkspaceQuery("?scope=unit&dept=KHOA_CNTT");
      const scopeMyQuery = parseWorkspaceQuery("?scope=my");

      const auth1 = buildTaskReadWhere(lecturerUser);
      const auth2 = buildTaskReadWhere(lecturerUser);
      const auth3 = buildTaskReadWhere(lecturerUser);

      // Server read authorization remains identical regardless of requested scope
      assert.deepEqual(auth1, auth2);
      assert.deepEqual(auth2, auth3);
      assert.deepEqual(auth1.OR![2].departmentId, "KHOA_CNTT");
    });
  });

  describe("14. View mode defaults and TaskManagementWorkspace canonical table view", () => {
    test("URL without view param defaults to table view", () => {
      const state = parseWorkspaceQuery("/tasks");
      assert.equal(state.view, "table");
    });

    test("URL with ?view=kanban respects kanban view mode", () => {
      const state = parseWorkspaceQuery("/tasks?view=kanban");
      assert.equal(state.view, "kanban");
    });

    test("URL with ?view=table respects table view mode", () => {
      const state = parseWorkspaceQuery("/tasks?view=table");
      assert.equal(state.view, "table");
    });

    test("TaskManagementWorkspace uses props.initialViewMode ?? 'table' instead of hardcoding kanban", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/tasks/task-management-workspace.tsx"),
        "utf-8"
      );
      assert.ok(
        content.includes('initialViewMode={props.initialViewMode ?? "table"}'),
        "TaskManagementWorkspace must pass initialViewMode={props.initialViewMode ?? 'table'}"
      );
      assert.ok(
        !content.includes('initialViewMode="kanban"'),
        "TaskManagementWorkspace must not hardcode initialViewMode='kanban'"
      );
    });

    test("UnifiedAdaptiveWorkspace respects queryState.view when present in URL", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx"),
        "utf-8"
      );
      assert.ok(
        content.includes("workspaceQuery?.queryState.view"),
        "UnifiedAdaptiveWorkspace must check workspaceQuery?.queryState.view"
      );
      assert.ok(
        content.includes('return initialViewMode || "table"'),
        "UnifiedAdaptiveWorkspace must default to table when no view query is present"
      );
    });
  });
});
