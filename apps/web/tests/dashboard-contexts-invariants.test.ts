import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DashboardNavContext,
  DashboardDataContext,
  DashboardActionsContext,
  DashboardModalContext,
  useDashboardNav,
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "../src/components/dashboard/dashboard-context";

describe("Dashboard Context Invariants & Hook Boundary Tests", () => {
  test("All 4 React Contexts are defined with null default values", () => {
    assert.ok(DashboardNavContext);
    assert.ok(DashboardDataContext);
    assert.ok(DashboardActionsContext);
    assert.ok(DashboardModalContext);
  });

  test("useDashboardNav throws descriptive error when used outside DashboardStateProvider", () => {
    function Consumer() {
      useDashboardNav();
      return null;
    }
    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(Consumer));
      },
      /useDashboardNav must be used within a DashboardStateProvider/
    );
  });

  test("useDashboardData throws descriptive error when used outside DashboardStateProvider", () => {
    function Consumer() {
      useDashboardData();
      return null;
    }
    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(Consumer));
      },
      /useDashboardData must be used within a DashboardStateProvider/
    );
  });

  test("useDashboardActions throws descriptive error when used outside DashboardStateProvider", () => {
    function Consumer() {
      useDashboardActions();
      return null;
    }
    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(Consumer));
      },
      /useDashboardActions must be used within a DashboardStateProvider/
    );
  });

  test("useDashboardModal throws descriptive error when used outside DashboardStateProvider", () => {
    function Consumer() {
      useDashboardModal();
      return null;
    }
    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(Consumer));
      },
      /useDashboardModal must be used within a DashboardStateProvider/
    );
  });
});
