import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";

import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InvalidTransitionError,
  RateLimitError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  toApiErrorResponse,
  parseApiError,
  type ApiErrorResponse,
} from "../src/server/api/errors";
// api-client shim removed; parseApiError is imported directly from src/server/api/errors above
import { apiError } from "../src/server/api/response";

// Import all route loading and error components
import TasksLoading from "../src/app/tasks/loading";
import TasksError from "../src/app/tasks/error";
import DashboardLoading from "../src/app/dashboard/loading";
import DashboardError from "../src/app/dashboard/error";
import DocumentsLoading from "../src/app/documents/loading";
import DocumentsError from "../src/app/documents/error";
import CalendarLoading from "../src/app/calendar/loading";
import CalendarError from "../src/app/calendar/error";
import OrgLoading from "../src/app/org/loading";
import OrgError from "../src/app/org/error";
import NotificationsLoading from "../src/app/notifications/loading";
import NotificationsError from "../src/app/notifications/error";

describe("Phase 20: Canonical Error Contract", () => {
  const testRequestId = "req-audit-7788";

  describe("Typed Error Classes & Status Codes", () => {
    it("produces correct status codes and default codes across all error classes", () => {
      const cases: Array<{
        err: ApiError;
        expectedStatus: number;
        expectedCode: string;
      }> = [
        {
          err: new AuthenticationError(),
          expectedStatus: 401,
          expectedCode: "AUTH_REQUIRED",
        },
        {
          err: new AuthorizationError(),
          expectedStatus: 403,
          expectedCode: "FORBIDDEN",
        },
        {
          err: new ForbiddenError(),
          expectedStatus: 403,
          expectedCode: "FORBIDDEN",
        },
        {
          err: new ValidationError(),
          expectedStatus: 400,
          expectedCode: "VALIDATION_ERROR",
        },
        {
          err: new NotFoundError(),
          expectedStatus: 404,
          expectedCode: "NOT_FOUND",
        },
        {
          err: new ConflictError(),
          expectedStatus: 409,
          expectedCode: "CONFLICT",
        },
        {
          err: new InvalidTransitionError(),
          expectedStatus: 409,
          expectedCode: "INVALID_TRANSITION",
        },
        {
          err: new RateLimitError(),
          expectedStatus: 429,
          expectedCode: "RATE_LIMITED",
        },
        {
          err: new PayloadTooLargeError(),
          expectedStatus: 413,
          expectedCode: "PAYLOAD_TOO_LARGE",
        },
        {
          err: new UnsupportedMediaTypeError(),
          expectedStatus: 415,
          expectedCode: "UNSUPPORTED_MEDIA_TYPE",
        },
      ];

      for (const { err, expectedStatus, expectedCode } of cases) {
        assert.strictEqual(
          err.statusCode,
          expectedStatus,
          `${err.constructor.name} status should be ${expectedStatus}`
        );
        assert.strictEqual(
          err.code,
          expectedCode,
          `${err.constructor.name} code should be ${expectedCode}`
        );
      }
    });

    it("RateLimitError properly retains retryAfter", () => {
      const err = new RateLimitError("Hạ nhiệt truy cập", 60);
      assert.strictEqual(err.statusCode, 429);
      assert.strictEqual(err.code, "RATE_LIMITED");
      assert.strictEqual(err.retryAfter, 60);
    });
  });

  describe("API Error Serialization & Exact JSON Contract", () => {
    it("conforms to { error, code, message, fieldErrors?, requestId } contract", () => {
      const fieldErrors = { title: ["Tiêu đề là bắt buộc"] };
      const err = new ValidationError("Dữ liệu không hợp lệ", fieldErrors);
      const res = toApiErrorResponse(err, testRequestId);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, "Dữ liệu không hợp lệ");
      assert.strictEqual(res.body.code, "VALIDATION_ERROR");
      assert.strictEqual(res.body.message, "Dữ liệu không hợp lệ");
      assert.deepStrictEqual(res.body.fieldErrors, fieldErrors);
      assert.strictEqual(res.body.requestId, testRequestId);
    });

    it("converts ZodError to 400 VALIDATION_ERROR with structured field paths", () => {
      const schema = z.object({
        code: z.string().min(3, "Mã văn bản tối thiểu 3 ký tự"),
        sender: z.object({
          departmentId: z.string().min(1, "Đơn vị gửi là bắt buộc"),
        }),
      });

      const parse = schema.safeParse({ code: "VB", sender: { departmentId: "" } });
      assert.strictEqual(parse.success, false);
      if (!parse.success) {
        const res = toApiErrorResponse(parse.error, testRequestId);
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.code, "VALIDATION_ERROR");
        assert.strictEqual(res.body.error, "Validation failed");
        assert.deepStrictEqual(res.body.fieldErrors?.["code"], [
          "Mã văn bản tối thiểu 3 ký tự",
        ]);
        assert.deepStrictEqual(res.body.fieldErrors?.["sender.departmentId"], [
          "Đơn vị gửi là bắt buộc",
        ]);
        assert.strictEqual(res.body.requestId, testRequestId);
      }
    });

    it("redacts sensitive messages on unexpected 500 errors", () => {
      const fatalErr = new Error("DB_CONNECTION_STRING postgres://admin:secret@db:5432 failed");
      const res = toApiErrorResponse(fatalErr, testRequestId);

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.code, "INTERNAL_ERROR");
      assert.strictEqual(res.body.error, "Internal server error");
      assert.strictEqual(res.body.message, "Internal server error");
      assert.strictEqual(res.body.requestId, testRequestId);
      assert.strictEqual(JSON.stringify(res.body).includes("postgres"), false);
      assert.strictEqual(JSON.stringify(res.body).includes("secret"), false);
    });

    it("apiError helper attaches x-request-id header and returns exact status", async () => {
      const err = new NotFoundError("Nhiệm vụ không tồn tại");
      const response = apiError(err, testRequestId);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.headers.get("x-request-id"), testRequestId);

      const json = (await response.json()) as ApiErrorResponse;
      assert.strictEqual(json.error, "Nhiệm vụ không tồn tại");
      assert.strictEqual(json.code, "NOT_FOUND");
      assert.strictEqual(json.message, "Nhiệm vụ không tồn tại");
      assert.strictEqual(json.requestId, testRequestId);
    });
  });

  describe("parseApiError parsing helper", () => {
    it("parses canonical flat API error response", () => {
      const payload = {
        error: "Truy cập bị từ chối",
        code: "FORBIDDEN",
        message: "Truy cập bị từ chối",
        requestId: "req-abc-123",
      };

      const parsed = parseApiError(payload);
      assert.strictEqual(parsed.code, "FORBIDDEN");
      assert.strictEqual(parsed.message, "Truy cập bị từ chối");
      assert.strictEqual(parsed.requestId, "req-abc-123");
      assert.strictEqual(parsed.fieldErrors, undefined);
    });

    it("parses canonical error with fieldErrors", () => {
      const payload = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ",
        fieldErrors: { title: ["Thiếu tiêu đề"], deadline: ["Ngày không hợp lệ"] },
        requestId: "req-val-456",
      };

      const parsed = parseApiError(payload);
      assert.strictEqual(parsed.code, "VALIDATION_ERROR");
      assert.strictEqual(parsed.message, "Dữ liệu không hợp lệ");
      assert.deepStrictEqual(parsed.fieldErrors, {
        title: ["Thiếu tiêu đề"],
        deadline: ["Ngày không hợp lệ"],
      });
      assert.strictEqual(parsed.requestId, "req-val-456");
    });

    it("parses legacy string error { error: string } cleanly", () => {
      const legacyPayload = {
        error: "Người dùng chưa đăng nhập hoặc phiên làm việc đã hết hạn",
      };

      const parsed = parseApiError(legacyPayload);
      assert.strictEqual(parsed.code, "UNKNOWN_ERROR");
      assert.strictEqual(
        parsed.message,
        "Người dùng chưa đăng nhập hoặc phiên làm việc đã hết hạn"
      );
    });

    it("parses legacy string error with optional code { error: string, code: string }", () => {
      const legacyPayload = {
        error: "Phiên đăng nhập hết hạn",
        code: "AUTH_REQUIRED",
      };

      const parsed = parseApiError(legacyPayload);
      assert.strictEqual(parsed.code, "AUTH_REQUIRED");
      assert.strictEqual(parsed.message, "Phiên đăng nhập hết hạn");
    });

    it("parses nested error payload { error: { code, message, requestId } }", () => {
      const nestedPayload = {
        error: {
          code: "CONFLICT",
          message: "Mã số nhiệm vụ đã được sử dụng",
          requestId: "req-nested-999",
        },
      };

      const parsed = parseApiError(nestedPayload);
      assert.strictEqual(parsed.code, "CONFLICT");
      assert.strictEqual(parsed.message, "Mã số nhiệm vụ đã được sử dụng");
      assert.strictEqual(parsed.requestId, "req-nested-999");
    });

    it("gracefully handles plain strings and Error instances", () => {
      const stringResult = parseApiError("Lỗi kết nối máy chủ");
      assert.strictEqual(stringResult.code, "UNKNOWN_ERROR");
      assert.strictEqual(stringResult.message, "Lỗi kết nối máy chủ");

      const errorResult = parseApiError(new Error("Timeout khi đồng bộ"));
      assert.strictEqual(errorResult.code, "INTERNAL_ERROR");
      assert.strictEqual(errorResult.message, "Timeout khi đồng bộ");
    });

    it("gracefully handles null, undefined, and empty objects", () => {
      const nullResult = parseApiError(null);
      assert.strictEqual(nullResult.code, "INTERNAL_ERROR");
      assert.ok(nullResult.message.length > 0);

      const emptyResult = parseApiError({});
      assert.strictEqual(emptyResult.code, "UNKNOWN_ERROR");
      assert.ok(emptyResult.message.length > 0);
    });
  });
});

describe("Phase 9: Route-level Loading & Error Architecture", () => {
  const routes = [
    { name: "/tasks", dir: "src/app/tasks" },
    { name: "/dashboard", dir: "src/app/dashboard" },
    { name: "/documents", dir: "src/app/documents" },
    { name: "/calendar", dir: "src/app/calendar" },
    { name: "/org", dir: "src/app/org" },
    { name: "/notifications", dir: "src/app/notifications" },
  ];

  describe("Structural Validity of Loading Components", () => {
    const loadingComponents = [
      { name: "TasksLoading", Component: TasksLoading },
      { name: "DashboardLoading", Component: DashboardLoading },
      { name: "DocumentsLoading", Component: DocumentsLoading },
      { name: "CalendarLoading", Component: CalendarLoading },
      { name: "OrgLoading", Component: OrgLoading },
      { name: "NotificationsLoading", Component: NotificationsLoading },
    ];

    for (const { name, Component } of loadingComponents) {
      it(`${name} renders semantic skeleton with pulse animation and accessible label`, () => {
        const html = renderToStaticMarkup(React.createElement(Component));

        assert.ok(html.length > 0, `${name} must render non-empty HTML`);
        assert.ok(
          html.includes("animate-pulse"),
          `${name} must include animate-pulse for loading effect`
        );
        assert.ok(
          html.includes("aria-label"),
          `${name} must provide an aria-label for accessibility`
        );
        assert.ok(
          !html.includes("dark:"),
          `${name} must strictly adhere to light-only design (no dark: classes)`
        );
      });
    }
  });

  describe("Structural Validity of Error Components", () => {
    const errorComponents = [
      { name: "TasksError", Component: TasksError },
      { name: "DashboardError", Component: DashboardError },
      { name: "DocumentsError", Component: DocumentsError },
      { name: "CalendarError", Component: CalendarError },
      { name: "OrgError", Component: OrgError },
      { name: "NotificationsError", Component: NotificationsError },
    ];

    for (const { name, Component } of errorComponents) {
      it(`${name} renders error feedback, retry button, and handles error.digest`, () => {
        const testError = Object.assign(new Error("Lỗi kết nối cơ sở dữ liệu"), {
          digest: "err-digest-9876",
        });

        const html = renderToStaticMarkup(
          React.createElement(Component, {
            error: testError,
            reset: () => {},
          })
        );

        assert.ok(html.length > 0, `${name} must render non-empty markup`);
        assert.ok(
          html.includes('role="alert"'),
          `${name} must contain role="alert"`
        );
        assert.ok(
          html.includes("Thử lại"),
          `${name} must provide a "Thử lại" retry action`
        );
        assert.ok(
          html.includes("err-digest-9876"),
          `${name} must render error.digest when provided`
        );
        assert.ok(
          !html.includes("dark:"),
          `${name} must strictly adhere to light-only design (no dark: classes)`
        );
      });
    }
  });
});
