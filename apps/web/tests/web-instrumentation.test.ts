/**
 * Lỗi khi vẽ trang ở web ghi một dòng JSON `app.request.error` mang service và requestId (bản một ứng dụng ghi qua
 * logger của server); thông tin nhạy cảm trong thông báo lỗi được che trước khi ghi.
 */
import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestError } from "@/instrumentation";

describe("instrumentation của web: onRequestError", () => {
  const savedService = process.env.SERVICE_NAME;
  const savedConsoleError = console.error;
  afterEach(() => {
    console.error = savedConsoleError;
    if (savedService === undefined) delete process.env.SERVICE_NAME;
    else process.env.SERVICE_NAME = savedService;
  });

  async function capture(err: { digest?: string } & Error, headers: Record<string, string>) {
    const lines: string[] = [];
    console.error = (line: unknown) => void lines.push(String(line));
    await onRequestError(err, { path: "/tasks/abc?tab=files", method: "GET", headers }, {
      routerKind: "App Router",
      routePath: "/tasks/[id]",
      routeType: "render",
    });
    console.error = savedConsoleError;
    assert.equal(lines.length, 1);
    return JSON.parse(lines[0]);
  }

  test("ghi event, service, requestId, digest và route", async () => {
    process.env.SERVICE_NAME = "qcet-web";
    const err = Object.assign(new Error("api trả 500"), { digest: "123456" });

    const entry = await capture(err, { "x-request-id": "req-1" });

    assert.equal(entry.level, "error");
    assert.equal(entry.event, "app.request.error");
    assert.equal(entry.service, "qcet-web");
    assert.equal(entry.requestId, "req-1");
    assert.equal(entry.errorCode, "123456");
    assert.equal(entry.metadata.routePath, "/tasks/[id]");
    assert.equal(entry.metadata.routeType, "render");
    assert.equal(entry.metadata.method, "GET");
    assert.equal(entry.metadata.error.message, "api trả 500");
  });

  test("không có digest, SERVICE_NAME hay x-request-id thì dùng REQUEST_ERROR và bỏ các trường đó", async () => {
    delete process.env.SERVICE_NAME;

    const entry = await capture(new Error("hỏng"), {});

    assert.equal(entry.errorCode, "REQUEST_ERROR");
    assert.equal("service" in entry, false);
    assert.equal("requestId" in entry, false);
  });

  test("che email trong thông báo lỗi", async () => {
    const entry = await capture(new Error("không tìm thấy nguyenvana@qnc.edu.vn"), {});

    assert.doesNotMatch(JSON.stringify(entry), /nguyenvana@qnc\.edu\.vn/);
  });
});
