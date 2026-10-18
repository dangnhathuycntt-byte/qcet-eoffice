import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@qcet/db/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { POST as postOnboarding } from "@/app/api/auth/onboarding/route";

/**
 * Test đặc tả POST /api/auth/onboarding.
 * Thứ tự guard trong route: CSRF → giải mã phiên → requireAuthenticated → completeOnboarding.
 * Route không có rate limit, không ghi audit/outbox (completeOnboarding chỉ update bảng users).
 */
describe("POST /api/auth/onboarding", () => {
  const runId = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const userKeys = ["bearer", "cookie", "csrf", "inactive", "crosssite"] as const;
  type UserKey = (typeof userKeys)[number];
  const userId = (k: UserKey) => `tonb-u-${k}-${runId}`;
  const emailOf = (k: UserKey) => `${runId}.onb-${k}@qcet-test.edu.vn`;
  const userIds = userKeys.map(userId);

  const tokenFor = (k: UserKey) =>
    signSessionToken({ id: userId(k), email: emailOf(k), name: `Kiểm thử ${k}`, role: "CHUYEN_VIEN" });

  let reqSeq = 0;
  function makeRequest(headersInit: Record<string, string> = {}) {
    const requestId = `tonb-${runId}-${++reqSeq}`;
    const headers = new Headers({ "x-request-id": requestId, ...headersInit });
    return {
      req: new NextRequest("http://localhost:3000/api/auth/onboarding", { method: "POST", headers }),
      requestId,
    };
  }

  async function readOnboarding(k: UserKey) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId(k) },
      select: { onboardedAt: true, onboardingData: true },
    });
  }

  before(async () => {
    await prisma.user.createMany({
      data: userKeys.map((k) => ({
        id: userId(k),
        email: emailOf(k),
        name: `Kiểm thử ${k}`,
        role: "CHUYEN_VIEN" as const,
        isActive: k !== "inactive",
      })),
    });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  describe("CSRF (chạy trước xác thực)", () => {
    test("cookie phiên, thiếu Origin/Referer: 403 CSRF_VALIDATION_FAILED, không ghi onboarding", async () => {
      const { req } = makeRequest({ Cookie: `${SESSION_COOKIE_NAME}=${tokenFor("csrf")}` });
      const res = await postOnboarding(req);
      assert.equal(res.status, 403);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "CSRF_VALIDATION_FAILED");
      // CSRF chạy trước getApiContext: requestId do route tự sinh, header và body khớp nhau.
      assert.ok(typeof body.requestId === "string" && body.requestId.length > 0);
      assert.equal(res.headers.get("x-request-id"), body.requestId);
      assert.equal("user" in body, false);
      assert.equal((await readOnboarding("csrf")).onboardedAt, null);
    });

    test("cookie phiên + Origin khác miền: 403 CSRF_VALIDATION_FAILED, không ghi onboarding", async () => {
      const { req } = makeRequest({
        Cookie: `${SESSION_COOKIE_NAME}=${tokenFor("csrf")}`,
        Origin: "https://evil.example.com",
      });
      const res = await postOnboarding(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, "CSRF_VALIDATION_FAILED");
      assert.equal((await readOnboarding("csrf")).onboardedAt, null);
    });

    test("cookie phiên + Sec-Fetch-Site: cross-site: 403 CSRF_VALIDATION_FAILED, không ghi onboarding", async () => {
      const { req } = makeRequest({
        Cookie: `${SESSION_COOKIE_NAME}=${tokenFor("csrf")}`,
        "Sec-Fetch-Site": "cross-site",
      });
      const res = await postOnboarding(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, "CSRF_VALIDATION_FAILED");
      assert.equal((await readOnboarding("csrf")).onboardedAt, null);
    });

    test("cookie phiên + Referer khác miền: 403 CSRF_VALIDATION_FAILED, không ghi onboarding", async () => {
      const { req } = makeRequest({
        Cookie: `${SESSION_COOKIE_NAME}=${tokenFor("csrf")}`,
        Referer: "https://evil.example.com/page",
      });
      const res = await postOnboarding(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, "CSRF_VALIDATION_FAILED");
      assert.equal((await readOnboarding("csrf")).onboardedAt, null);
    });

    test("cookie token rác, thiếu Origin: CSRF chặn trước nên trả 403 (không phải 401)", async () => {
      const { req } = makeRequest({ Cookie: `${SESSION_COOKIE_NAME}=garbage-token` });
      const res = await postOnboarding(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, "CSRF_VALIDATION_FAILED");
    });
  });

  describe("xác thực", () => {
    test("không có thông tin đăng nhập (không cookie nên qua CSRF): 401 AUTH_REQUIRED", async () => {
      const { req, requestId } = makeRequest();
      const res = await postOnboarding(req);
      assert.equal(res.status, 401);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      assert.equal(res.headers.get("x-request-id"), requestId);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "AUTH_REQUIRED");
      assert.equal(body.requestId, requestId);
      assert.equal("user" in body, false);
    });

    test("Bearer token rác: 401 SESSION_INVALID", async () => {
      const { req } = makeRequest({ Authorization: "Bearer not-a-real-token" });
      const res = await postOnboarding(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.code, "SESSION_INVALID");
      assert.equal("user" in body, false);
    });

    test("token hợp lệ chữ ký nhưng user không tồn tại: 401 SESSION_INVALID", async () => {
      const ghost = signSessionToken({
        id: `tonb-ghost-${runId}`,
        email: `${runId}.onb-ghost@qcet-test.edu.vn`,
        name: "Không tồn tại",
        role: "CHUYEN_VIEN",
      });
      const { req } = makeRequest({ Authorization: `Bearer ${ghost}` });
      const res = await postOnboarding(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.code, "SESSION_INVALID");
    });

    test("tài khoản bị khóa: 401 ACCOUNT_DISABLED, không ghi onboarding", async () => {
      const { req } = makeRequest({ Authorization: `Bearer ${tokenFor("inactive")}` });
      const res = await postOnboarding(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.code, "ACCOUNT_DISABLED");
      assert.equal("user" in body, false);
      const row = await readOnboarding("inactive");
      assert.equal(row.onboardedAt, null);
      assert.equal(row.onboardingData, null);
    });
  });

  describe("thành công", () => {
    test("Bearer: 200, trả user tối thiểu {id,email,name,onboardedAt}, ghi onboardedAt và onboardingData", async () => {
      const startedAt = Date.now();
      const { req, requestId } = makeRequest({ Authorization: `Bearer ${tokenFor("bearer")}` });
      const res = await postOnboarding(req);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      assert.equal(res.headers.get("x-request-id"), requestId);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.deepEqual(Object.keys(body).sort(), ["success", "user"]);
      assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name", "onboardedAt"]);
      assert.equal(body.user.id, userId("bearer"));
      assert.equal(body.user.email, emailOf("bearer"));
      assert.equal(body.user.name, "Kiểm thử bearer");

      const row = await readOnboarding("bearer");
      assert.ok(row.onboardedAt instanceof Date);
      assert.ok(row.onboardedAt.getTime() >= startedAt - 1000 && row.onboardedAt.getTime() <= Date.now() + 1000);
      assert.equal(body.user.onboardedAt, row.onboardedAt.toISOString());
      assert.deepEqual(row.onboardingData, { hasSeenWelcome: true, hasCompletedTour: true });
    });

    test("Bearer bỏ qua CSRF kể cả khi Sec-Fetch-Site: cross-site (không có thông tin xác thực ngầm)", async () => {
      const { req } = makeRequest({
        Authorization: `Bearer ${tokenFor("crosssite")}`,
        "Sec-Fetch-Site": "cross-site",
      });
      const res = await postOnboarding(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.user.id, userId("crosssite"));
      assert.ok((await readOnboarding("crosssite")).onboardedAt instanceof Date);
    });

    test("cookie phiên + Origin cùng miền: 200 và ghi onboarding cho đúng user của phiên", async () => {
      const { req } = makeRequest({
        Cookie: `${SESSION_COOKIE_NAME}=${tokenFor("cookie")}`,
        Origin: "http://localhost:3000",
      });
      const res = await postOnboarding(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.user.id, userId("cookie"));
      const row = await readOnboarding("cookie");
      assert.ok(row.onboardedAt instanceof Date);
      assert.deepEqual(row.onboardingData, { hasSeenWelcome: true, hasCompletedTour: true });
      // Các thử CSRF bị chặn ở trên không làm thay đổi user khác
      assert.equal((await readOnboarding("csrf")).onboardedAt, null);
    });
  });
});
