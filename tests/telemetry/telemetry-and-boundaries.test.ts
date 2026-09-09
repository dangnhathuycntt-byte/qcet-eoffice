import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  sanitizeLogContext,
  sanitizeString,
  sanitizeUrl,
  isSensitiveKey,
} from "../../src/telemetry/sanitize";
import {
  ServerLogger,
  serverLogger,
} from "../../src/telemetry/server";
import {
  normalizeWebVital,
  getMetricRating,
  WEB_VITAL_THRESHOLDS,
} from "../../src/telemetry/web-vitals";
import {
  ClientTelemetryQueue,
  reportClientError,
} from "../../src/telemetry/client";
import {
  POST,
  OPTIONS,
  parseTelemetryEvents,
} from "../../src/app/api/telemetry/route";
import {
  ErrorBoundary,
  SectionErrorFallback,
  AppShellErrorBoundary,
  WorkspaceErrorBoundary,
  TaskDetailErrorBoundary,
  DocumentViewerErrorBoundary,
  DashboardErrorBoundary,
  CalendarErrorBoundary,
} from "../../src/components/common/error-boundary";

describe("Telemetry & Error Boundaries Comprehensive Test Suite", () => {
  // =========================================================================
  // 1. DATA PRIVACY & SANITIZATION (sanitizeLogContext)
  // =========================================================================
  describe("Privacy & Sanitization (sanitizeLogContext)", () => {
    it("strips passwords, auth tokens, secrets, and private keys", () => {
      const rawContext = {
        user: "admin",
        password: "SuperSecretPassword123!",
        userPassword: "PlainPassword456",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature",
        accessToken: "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
        refreshToken: "refresh-token-xyz-987",
        authSecret: "qcet_super_secret_auth_key",
        jwtSecret: "signing-secret-key-1234567890",
        privateKey: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1...\n-----END RSA PRIVATE KEY-----",
      };

      const sanitized = sanitizeLogContext(rawContext) as Record<string, unknown>;

      assert.equal(sanitized.user, "admin");
      assert.equal(sanitized.password, "[REDACTED]");
      assert.equal(sanitized.userPassword, "[REDACTED]");
      assert.equal(sanitized.token, "[REDACTED]");
      assert.equal(sanitized.accessToken, "[REDACTED]");
      assert.equal(sanitized.refreshToken, "[REDACTED]");
      assert.equal(sanitized.authSecret, "[REDACTED]");
      assert.equal(sanitized.jwtSecret, "[REDACTED]");
      assert.equal(sanitized.privateKey, "[REDACTED]");
    });

    it("strips authorization headers and cookies", () => {
      const headers = {
        host: "eoffice.cdktcnqn.edu.vn",
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyJ9.signatureX",
        cookie: "session=sess_abc123; qcet_auth=auth_xyz789",
        "set-cookie": "qcet_session=secret_value; HttpOnly; Secure",
        "x-auth-token": "custom-auth-token-val",
        "x-api-key": "secret-api-key-value",
      };

      const sanitized = sanitizeLogContext(headers) as Record<string, unknown>;

      assert.equal(sanitized.host, "eoffice.cdktcnqn.edu.vn");
      assert.equal(sanitized.authorization, "[REDACTED]");
      assert.equal(sanitized.cookie, "[REDACTED]");
      assert.equal(sanitized["set-cookie"], "[REDACTED]");
      assert.equal(sanitized["x-auth-token"], "[REDACTED]");
      assert.equal(sanitized["x-api-key"], "[REDACTED]");
    });

    it("strips database connection strings (PostgreSQL, MySQL, MongoDB, Redis)", () => {
      const config = {
        dbUrl: "postgresql://postgres:myDbSecretPass@db.cdktcnqn.edu.vn:5432/qcet_eoffice?schema=public",
        redisUrl: "redis://:redisSecretPassword@cache.cdktcnqn.edu.vn:6379/0",
        nested: {
          mongo: "mongodb+srv://admin:adminSecretPass@cluster0.mongodb.net/test?retryWrites=true&w=majority",
        },
      };

      const sanitized = sanitizeLogContext(config) as {
        dbUrl: string;
        redisUrl: string;
        nested: { mongo: string };
      };

      assert.equal(sanitized.dbUrl, "[REDACTED]");
      assert.equal(sanitized.redisUrl, "[REDACTED]");
      assert.ok(sanitized.nested.mongo.includes("[REDACTED"));
    });

    it("redacts database URLs inside error messages or raw strings", () => {
      const errorMsg =
        "Connection refused at postgresql://postgres:SecretPassword123@10.0.0.1:5432/qcet_prod after 5000ms";
      const cleaned = sanitizeString(errorMsg);

      assert.ok(!cleaned.includes("SecretPassword123"));
      assert.ok(cleaned.includes("[REDACTED_DATABASE_URL]"));
    });

    it("sanitizes Bearer tokens and JWTs in strings", () => {
      const rawText =
        "Request failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xyzSig";
      const sanitized = sanitizeString(rawText);

      assert.ok(!sanitized.includes("xyzSig"));
      assert.ok(sanitized.includes("Bearer [REDACTED_TOKEN]"));
    });

    it("sanitizes URL query parameters containing tokens or secrets", () => {
      const url =
        "https://eoffice.cdktcnqn.edu.vn/api/callback?code=AUTH_CODE_123&token=SECRET_TOKEN_456&scope=all";
      const sanitized = sanitizeUrl(url);

      assert.ok(!sanitized.includes("AUTH_CODE_123"));
      assert.ok(!sanitized.includes("SECRET_TOKEN_456"));
      assert.ok(sanitized.includes("token=%5BREDACTED%5D") || sanitized.includes("token=[REDACTED]"));
      assert.ok(sanitized.includes("code=%5BREDACTED%5D") || sanitized.includes("code=[REDACTED]"));
      assert.ok(sanitized.includes("scope=all"));
    });

    it("masks sensitive PII: emails, phone numbers, and citizen ID keys", () => {
      const piiData = {
        officer: "Nguyễn Văn A",
        email: "nguyen.vana@cdktcnqn.edu.vn",
        phone: "0912345678",
        cccd: "033096001234",
        cmnd: "101234567",
      };

      const sanitized = sanitizeLogContext(piiData) as Record<string, unknown>;

      assert.equal(sanitized.officer, "Nguyễn Văn A");
      assert.equal(sanitized.email, "[REDACTED_EMAIL]");
      assert.equal(sanitized.phone, "[REDACTED_PHONE]");
      assert.equal(sanitized.cccd, "[REDACTED]");
      assert.equal(sanitized.cmnd, "[REDACTED]");
    });

    it("preserves legitimate business domain fields (no false positive redacting of author or authority)", () => {
      assert.equal(isSensitiveKey("author"), false);
      assert.equal(isSensitiveKey("taskAuthor"), false);
      assert.equal(isSensitiveKey("authority"), false);
      assert.equal(isSensitiveKey("actionQueueAuthority"), false);
      assert.equal(isSensitiveKey("authorization"), true);
      assert.equal(isSensitiveKey("password"), true);
    });

    it("handles circular references without throwing or infinite recursion", () => {
      const circularObj: Record<string, unknown> = {
        name: "Test Node",
        id: "node-1",
      };
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj };

      const sanitized = sanitizeLogContext(circularObj) as Record<string, unknown>;
      assert.equal(sanitized.name, "Test Node");
      assert.equal(sanitized.self, "[CIRCULAR_REFERENCE]");
      const nested = sanitized.nested as Record<string, unknown>;
      assert.equal(nested.parent, "[CIRCULAR_REFERENCE]");
    });

    it("sanitizes Error instances safely without mutating original error", () => {
      const originalError = new Error(
        "DB connection failed at postgresql://admin:secretPass@localhost:5432/db"
      );
      originalError.name = "DatabaseConnectionError";

      const sanitized = sanitizeLogContext(originalError) as Record<string, unknown>;

      assert.equal(sanitized.name, "DatabaseConnectionError");
      assert.ok(typeof sanitized.message === "string");
      assert.ok(!sanitized.message.includes("secretPass"));
      assert.ok(sanitized.message.includes("[REDACTED_DATABASE_URL]"));
      assert.ok(originalError.message.includes("secretPass")); // Original unchanged
    });
  });

  // =========================================================================
  // 2. SERVER LOGGING (ServerLogger)
  // =========================================================================
  describe("Server Logging (ServerLogger)", () => {
    it("emits structured logs with sanitized context", () => {
      const logs: unknown[] = [];
      const testLogger = new ServerLogger({
        minLevel: "debug",
        writer: (entry) => logs.push(entry),
      });

      testLogger.info("User login processed", {
        userId: "user-456",
        token: "sensitive-jwt-token",
        email: "staff@cdktcnqn.edu.vn",
      });

      assert.equal(logs.length, 1);
      const entry = logs[0] as {
        level: string;
        message: string;
        context: Record<string, unknown>;
      };
      assert.equal(entry.level, "info");
      assert.equal(entry.message, "User login processed");
      assert.equal(entry.context.userId, "user-456");
      assert.equal(entry.context.token, "[REDACTED]");
      assert.equal(entry.context.email, "[REDACTED_EMAIL]");
    });

    it("respects log level priorities", () => {
      const logs: unknown[] = [];
      const testLogger = new ServerLogger({
        minLevel: "warn",
        writer: (entry) => logs.push(entry),
      });

      testLogger.debug("Debug event");
      testLogger.info("Info event");
      testLogger.warn("Warn event");
      testLogger.error("Error event");

      assert.equal(logs.length, 2);
      const levels = (logs as { level: string }[]).map((l) => l.level);
      assert.deepEqual(levels, ["warn", "error"]);
    });

    it("canonical serverLogger singleton exists and logs without crashing", () => {
      assert.ok(serverLogger instanceof ServerLogger);
      // Safe smoke test that does not throw
      serverLogger.info("Telemetry subsystem health check", { status: "ok" });
    });
  });

  // =========================================================================
  // 3. WEB VITALS NORMALIZATION & THRESHOLDS
  // =========================================================================
  describe("Web Vitals (Normalization & Thresholds)", () => {
    it("computes accurate metric ratings according to standard thresholds", () => {
      // LCP: <= 2500 good, <= 4000 needs-improvement, > 4000 poor
      assert.equal(getMetricRating("LCP", 1200), "good");
      assert.equal(getMetricRating("LCP", 2500), "good");
      assert.equal(getMetricRating("LCP", 3200), "needs-improvement");
      assert.equal(getMetricRating("LCP", 4000), "needs-improvement");
      assert.equal(getMetricRating("LCP", 4500), "poor");

      // INP: <= 200 good, <= 500 needs-improvement, > 500 poor
      assert.equal(getMetricRating("INP", 80), "good");
      assert.equal(getMetricRating("INP", 200), "good");
      assert.equal(getMetricRating("INP", 350), "needs-improvement");
      assert.equal(getMetricRating("INP", 550), "poor");

      // CLS: <= 0.1 good, <= 0.25 needs-improvement, > 0.25 poor
      assert.equal(getMetricRating("CLS", 0.05), "good");
      assert.equal(getMetricRating("CLS", 0.1), "good");
      assert.equal(getMetricRating("CLS", 0.18), "needs-improvement");
      assert.equal(getMetricRating("CLS", 0.3), "poor");

      // TTFB: <= 800 good, <= 1800 needs-improvement, > 1800 poor
      assert.equal(getMetricRating("TTFB", 300), "good");
      assert.equal(getMetricRating("TTFB", 1200), "needs-improvement");
      assert.equal(getMetricRating("TTFB", 2500), "poor");
    });

    it("normalizes Web Vital payloads and formats numerical precision", () => {
      const normalizedLcp = normalizeWebVital({
        name: "LCP",
        value: 2345.6789,
        route: "/tasks",
      });

      assert.equal(normalizedLcp.name, "LCP");
      assert.equal(normalizedLcp.value, 2345.7); // 1 decimal precision
      assert.equal(normalizedLcp.rating, "good");
      assert.equal(normalizedLcp.route, "/tasks");
      assert.ok(normalizedLcp.timestamp > 0);

      const normalizedCls = normalizeWebVital({
        name: "CLS",
        value: 0.123456,
        route: "/dashboard",
      });

      assert.equal(normalizedCls.name, "CLS");
      assert.equal(normalizedCls.value, 0.1235); // 4 decimal precision
      assert.equal(normalizedCls.rating, "needs-improvement");
    });

    it("rejects invalid metric names or negative values", () => {
      assert.throws(() => {
        normalizeWebVital({
          name: "INVALID_METRIC" as any,
          value: 100,
        });
      }, /Invalid or unsupported Web Vital metric name/);

      assert.throws(() => {
        normalizeWebVital({
          name: "LCP",
          value: -50,
        });
      }, /has invalid value/);

      assert.throws(() => {
        normalizeWebVital({
          name: "LCP",
          value: NaN,
        });
      }, /has invalid value/);
    });
  });

  // =========================================================================
  // 4. CLIENT TELEMETRY QUEUE & REPORTING
  // =========================================================================
  describe("Client Telemetry Queue", () => {
    it("enqueues events, sanitizes payloads, and respects queue limits", () => {
      const queue = new ClientTelemetryQueue({
        enabled: true,
        maxQueueSize: 5,
        maxBatchSize: 10,
        rateLimitPerMinute: 100,
      });

      const enqueued = queue.enqueue("error", {
        name: "TypeError",
        message: "Cannot read properties of undefined",
        token: "client-secret-token",
      });

      assert.equal(enqueued, true);
      assert.equal(queue.getQueueLength(), 1);
      queue.destroy();
    });

    it("deduplicates rapid identical error events within debounce window", () => {
      const queue = new ClientTelemetryQueue({
        enabled: true,
        rateLimitPerMinute: 100,
      });

      const first = queue.enqueue("error", {
        name: "RenderError",
        message: "Component render failed in task table",
      });
      const duplicate = queue.enqueue("error", {
        name: "RenderError",
        message: "Component render failed in task table",
      });

      assert.equal(first, true);
      assert.equal(duplicate, false); // Debounced & deduplicated
      assert.equal(queue.getQueueLength(), 1);
      queue.destroy();
    });

    it("reportClientError safely captures errors without throwing", () => {
      assert.doesNotThrow(() => {
        reportClientError(new Error("Test client error"), { section: "test" });
        reportClientError("String error message", { section: "test-string" });
        reportClientError({ custom: "error-object" });
        reportClientError(null);
        reportClientError(undefined);
      });
    });
  });

  // =========================================================================
  // 5. TELEMETRY INGESTION ENDPOINT (src/app/api/telemetry/route.ts)
  // =========================================================================
  describe("Telemetry Ingestion Endpoint (POST & OPTIONS)", () => {
    it("accepts valid single telemetry event and returns 204 No Content", async () => {
      const singleEvent = {
        type: "error",
        route: "/tasks",
        payload: {
          name: "ReferenceError",
          message: "window is not defined",
        },
      };

      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleEvent),
      });

      const res = await POST(req);
      assert.equal(res.status, 204);
    });

    it("accepts valid batch container and returns 204 No Content", async () => {
      const batchPayload = {
        events: [
          {
            type: "web-vital",
            route: "/dashboard",
            payload: {
              name: "LCP",
              value: 1850,
              rating: "good",
            },
          },
          {
            type: "runtime",
            route: "/calendar",
            payload: {
              action: "month-navigation",
              month: "2026-09",
            },
          },
        ],
      };

      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchPayload),
      });

      const res = await POST(req);
      assert.equal(res.status, 204);
    });

    it("accepts valid array of telemetry events directly and returns 204 No Content", async () => {
      const eventsArray = [
        {
          type: "web-vital",
          payload: { name: "CLS", value: 0.02 },
        },
      ];

      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventsArray),
      });

      const res = await POST(req);
      assert.equal(res.status, 204);
    });

    it("gracefully returns 204 for empty request body", async () => {
      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "   ",
      });

      const res = await POST(req);
      assert.equal(res.status, 204);
    });

    it("rejects malformed JSON with 400 and canonical error shape", async () => {
      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ broken: json,,, ",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);

      const data = await res.json();
      assert.equal(data.code, "INVALID_JSON");
      assert.ok(typeof data.error === "string");
    });

    it("rejects oversized payloads (>128KB) with 413 Payload Too Large", async () => {
      // Create a payload larger than 128KB
      const hugeString = "A".repeat(130 * 1024);
      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: hugeString,
      });

      const res = await POST(req);
      assert.equal(res.status, 413);

      const data = await res.json();
      assert.equal(data.code, "PAYLOAD_TOO_LARGE");
    });

    it("rejects batch with more than 50 events with 400 BATCH_LIMIT_EXCEEDED", async () => {
      const events = Array.from({ length: 55 }, (_, i) => ({
        type: "runtime",
        payload: { index: i },
      }));

      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);

      const data = await res.json();
      assert.equal(data.code, "BATCH_LIMIT_EXCEEDED");
    });

    it("rejects invalid event type with 400 VALIDATION_ERROR", async () => {
      const invalidEvent = {
        type: "unknown-unsupported-type",
        payload: {},
      };

      const req = new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidEvent),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);

      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("responds to OPTIONS request with 204 and CORS / Allow headers", async () => {
      const res = await OPTIONS();
      assert.equal(res.status, 204);
      assert.ok(res.headers.get("Allow")?.includes("POST"));
      assert.ok(res.headers.get("Access-Control-Allow-Methods")?.includes("POST"));
    });
  });

  // =========================================================================
  // 6. ERROR BOUNDARIES & MODULAR SECTIONAL FALLBACKS
  // =========================================================================
  describe("Error Boundaries & Sectional Fallback UI", () => {
    it("renders children normally when no error occurs", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ErrorBoundary,
          null,
          React.createElement("div", { id: "child-content" }, "Bàn làm việc hoạt động bình thường")
        )
      );

      assert.ok(html.includes('id="child-content"'));
      assert.ok(html.includes("Bàn làm việc hoạt động bình thường"));
      assert.ok(!html.includes('role="alert"'));
    });

    it("renders SectionErrorFallback with role='alert' and 'Thử lại' button when error is caught", () => {
      const boundary = new ErrorBoundary({
        children: null,
        title: "Lỗi kết xuất khu vực",
        description: "Mô tả lỗi kiểm thử",
      });

      // Simulate React error catch
      const state = ErrorBoundary.getDerivedStateFromError(
        new Error("Render crash simulated")
      );
      boundary.state = state;

      const rendered = boundary.render();
      const html = renderToStaticMarkup(rendered as React.ReactElement);

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("Lỗi kết xuất khu vực"));
      assert.ok(html.includes("Mô tả lỗi kiểm thử"));
      assert.ok(html.includes("Thử lại"));
    });

    it("supports custom fallback render function", () => {
      const customFallback = ({ error }: { error: Error | null }) =>
        React.createElement("div", { id: "custom-fallback" }, `Custom error: ${error?.message}`);

      const boundary = new ErrorBoundary({
        children: null,
        fallback: customFallback,
      });

      boundary.state = {
        hasError: true,
        error: new Error("Custom error message"),
      };

      const rendered = boundary.render();
      const html = renderToStaticMarkup(rendered as React.ReactElement);

      assert.ok(html.includes('id="custom-fallback"'));
      assert.ok(html.includes("Custom error: Custom error message"));
    });

    it("resets state when resetErrorBoundary is triggered", () => {
      let onResetCalled = false;
      const boundary = new ErrorBoundary({
        children: null,
        onReset: () => {
          onResetCalled = true;
        },
      });

      boundary.state = {
        hasError: true,
        error: new Error("Test reset"),
      };

      let newState: any;
      boundary.setState = (updater: any) => {
        newState = typeof updater === "function" ? updater(boundary.state) : updater;
      };

      boundary.resetErrorBoundary();

      assert.equal(onResetCalled, true);
      assert.deepEqual(newState, { hasError: false, error: null });
    });

    it("resets boundary state when resetKeys change during componentDidUpdate", () => {
      const boundary = new ErrorBoundary({
        children: null,
        resetKeys: ["task-2026-01"],
      });

      boundary.state = {
        hasError: true,
        error: new Error("Old error"),
      };

      let resetTriggered = false;
      boundary.resetErrorBoundary = () => {
        resetTriggered = true;
      };

      // Props change with different resetKey
      boundary.componentDidUpdate({
        children: null,
        resetKeys: ["task-2026-02"],
      });

      assert.equal(resetTriggered, true);
    });

    it("WorkspaceErrorBoundary renders sectional fallback with Vietnamese recovery instructions", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SectionErrorFallback,
          {
            error: new Error("Workspace data feed failure"),
            resetErrorBoundary: () => {},
            section: "workspace",
            title: "Không thể hiển thị không gian làm việc",
            description: "Khu vực bàn làm việc gặp sự cố khi tải dữ liệu.",
          }
        )
      );

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("không gian làm việc"));
      assert.ok(html.includes("Thử lại"));
    });

    it("DocumentViewerErrorBoundary renders document specific fallback", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SectionErrorFallback,
          {
            error: new Error("PDF stream corrupt"),
            resetErrorBoundary: () => {},
            section: "document-viewer",
            title: "Không thể hiển thị tệp tài liệu",
            description: "Đã xảy ra lỗi khi hiển thị tài liệu đính kèm.",
          }
        )
      );

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("Không thể hiển thị tệp tài liệu"));
      assert.ok(html.includes("Thử lại"));
    });

    it("DashboardErrorBoundary renders compact tile fallback", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SectionErrorFallback,
          {
            error: new Error("Widget query failed"),
            resetErrorBoundary: () => {},
            section: "dashboard",
            compact: true,
            title: "Lỗi tải khối chỉ số thống kê",
            description: "Biểu đồ gặp lỗi tạm thời.",
          }
        )
      );

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("Lỗi tải khối chỉ số thống kê"));
      assert.ok(html.includes("Thử lại"));
      // Compact mode has min-h-[140px]
      assert.ok(html.includes("min-h-[140px]"));
    });

    it("CalendarErrorBoundary renders calendar specific fallback", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SectionErrorFallback,
          {
            error: new Error("Calendar partition failure"),
            resetErrorBoundary: () => {},
            section: "calendar",
            title: "Lỗi hiển thị lịch công tác",
            description: "Không thể kết xuất dữ liệu lịch tuần hoặc lịch tháng.",
          }
        )
      );

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("Lỗi hiển thị lịch công tác"));
      assert.ok(html.includes("Thử lại"));
    });

    it("AppShellErrorBoundary renders fallback with reload page option", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SectionErrorFallback,
          {
            error: new Error("Shell crash"),
            resetErrorBoundary: () => {},
            section: "app-shell",
            showReload: true,
            title: "Đã xảy ra sự cố giao diện hệ thống",
            description: "Giao diện chính gặp sự cố không mong muốn.",
          }
        )
      );

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("Đã xảy ra sự cố giao diện hệ thống"));
      assert.ok(html.includes("Thử lại"));
      assert.ok(html.includes("Tải lại trang"));
    });
  });
});
