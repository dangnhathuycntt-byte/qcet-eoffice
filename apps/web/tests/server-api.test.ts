/**
 * Lời gọi API từ server component của web (src/lib/server-api.ts): chỉ chuyển các header phiên, mã yêu cầu,
 * địa chỉ gốc; địa chỉ API lấy từ API_INTERNAL_URL.
 */
import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiInternalUrl, forwardedHeaders } from "../src/lib/server-api";

describe("server-api: header chuyển sang API", () => {
  test("chỉ chuyển cookie, authorization, x-request-id và x-forwarded-*", () => {
    const out = forwardedHeaders(
      new Headers({
        cookie: "authjs.session-token=abc",
        authorization: "Bearer t",
        "x-request-id": "req-1",
        "x-forwarded-for": "203.0.113.5, 10.0.0.2",
        "x-forwarded-host": "office.example.vn",
        "x-forwarded-proto": "https",
        host: "qcet-web:3000",
        "content-type": "application/json",
        "x-user-role": "ADMIN",
      }),
    );
    assert.deepEqual(Object.fromEntries(out.entries()), {
      authorization: "Bearer t",
      cookie: "authjs.session-token=abc",
      "x-forwarded-for": "203.0.113.5, 10.0.0.2",
      "x-forwarded-host": "office.example.vn",
      "x-forwarded-proto": "https",
      "x-request-id": "req-1",
    });
  });

  test("thiếu x-forwarded-host thì lấy Host của trang", () => {
    const out = forwardedHeaders(new Headers({ host: "localhost:3001" }));
    assert.equal(out.get("x-forwarded-host"), "localhost:3001");
    assert.equal(out.get("host"), null);
  });
});

describe("server-api: địa chỉ API nội bộ", () => {
  const saved = { API_INTERNAL_URL: process.env.API_INTERNAL_URL, API_PORT: process.env.API_PORT, NODE_ENV: process.env.NODE_ENV };
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("dùng API_INTERNAL_URL, bỏ dấu / cuối", () => {
    process.env.API_INTERNAL_URL = "http://qcet-api:3000/";
    assert.equal(apiInternalUrl(), "http://qcet-api:3000");
  });

  test("dev chưa đặt API_INTERNAL_URL thì gọi API ở cổng API_PORT", () => {
    delete process.env.API_INTERNAL_URL;
    process.env.API_PORT = "3101";
    assert.equal(apiInternalUrl(), "http://127.0.0.1:3101");
  });

  test("production thiếu API_INTERNAL_URL thì báo lỗi, không tự gọi lại web", () => {
    delete process.env.API_INTERNAL_URL;
    (process.env as Record<string, string>).NODE_ENV = "production";
    assert.throws(() => apiInternalUrl(), /API_INTERNAL_URL/);
  });
});
