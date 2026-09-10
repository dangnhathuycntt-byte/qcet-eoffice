import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sanitizeLogContext, sanitizeString } from "../../src/telemetry/sanitize";
import { ServerLogger } from "../../src/telemetry/server";
import { normalizeWebVital, getMetricRating } from "../../src/telemetry/web-vitals";
import { reportClientError } from "../../src/telemetry/client";
import {
  ErrorBoundary,
  AppShellErrorBoundary,
  WorkspaceErrorBoundary,
  TaskDetailErrorBoundary,
  DocumentViewerErrorBoundary,
  DashboardErrorBoundary,
  CalendarErrorBoundary,
} from "../../src/components/common/error-boundary";

describe("Error Boundary & Structured Logging Integration", () => {
  it("enforces sanitization of sensitive credentials and headers in log context", () => {
    const raw = {
      user: "officer-1",
      password: "PlainTextPassword123",
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      cookie: "session_id=12345",
      database_url: "postgres://user:pass@localhost:5432/db",
    };

    const sanitized = sanitizeLogContext(raw) as Record<string, unknown>;

    assert.equal(sanitized.user, "officer-1");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.authorization, "[REDACTED]");
    assert.equal(sanitized.cookie, "[REDACTED]");
    assert.equal(sanitized.database_url, "[REDACTED]");
  });

  it("server logger writes sanitized JSON with timestamp and level", () => {
    let captured: any = null;
    const logger = new ServerLogger({
      minLevel: "debug",
      writer: (entry) => {
        captured = entry;
      },
    });

    logger.warn("Database connection retry", {
      dbUrl: "postgresql://user:secret@localhost:5432/qcet",
      attempt: 3,
    });

    assert.ok(captured);
    assert.equal(captured.level, "warn");
    assert.equal(captured.message, "Database connection retry");
    assert.equal(captured.context.dbUrl, "[REDACTED]");
    assert.equal(captured.context.attempt, 3);
  });

  it("ErrorBoundary reports caught error via reportClientError and renders fallback", () => {
    let errorReported = false;
    const originalReport = reportClientError;

    const boundary = new ErrorBoundary({
      children: null,
      section: "workspace",
      onError: () => {
        errorReported = true;
      },
    });

    const error = new Error("Failed to render task row");
    boundary.componentDidCatch(error, { componentStack: "\n    in TaskRow" });

    assert.equal(errorReported, true);

    boundary.state = { hasError: true, error };
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);

    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes("Thử lại"));
  });

  it("all sectional error boundary components render valid React elements", () => {
    const shell = React.createElement(AppShellErrorBoundary, null, React.createElement("div", null, "Shell"));
    const workspace = React.createElement(WorkspaceErrorBoundary, null, React.createElement("div", null, "Workspace"));
    const taskDetail = React.createElement(TaskDetailErrorBoundary, { taskId: "task-1", children: React.createElement("div", null, "Detail") });
    const docViewer = React.createElement(DocumentViewerErrorBoundary, { documentId: "doc-1", children: React.createElement("div", null, "Doc") });
    const dashboard = React.createElement(DashboardErrorBoundary, { widgetName: "KPI", children: React.createElement("div", null, "Dashboard") });
    const calendar = React.createElement(CalendarErrorBoundary, { periodKey: "2026-09", children: React.createElement("div", null, "Calendar") });

    assert.ok(renderToStaticMarkup(shell).includes("Shell"));
    assert.ok(renderToStaticMarkup(workspace).includes("Workspace"));
    assert.ok(renderToStaticMarkup(taskDetail).includes("Detail"));
    assert.ok(renderToStaticMarkup(docViewer).includes("Doc"));
    assert.ok(renderToStaticMarkup(dashboard).includes("Dashboard"));
    assert.ok(renderToStaticMarkup(calendar).includes("Calendar"));
  });

  it("web vitals normalization formats CLS and LCP correctly", () => {
    const lcp = normalizeWebVital({ name: "LCP", value: 2100 });
    assert.equal(lcp.rating, "good");
    assert.equal(lcp.value, 2100);

    const cls = normalizeWebVital({ name: "CLS", value: 0.28 });
    assert.equal(cls.rating, "poor");
    assert.equal(cls.value, 0.28);
  });
});
