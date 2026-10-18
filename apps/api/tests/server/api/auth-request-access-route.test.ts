import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import {
  SharedMemoryRateLimitBackend,
  __clearRateLimitBackendForTesting,
  __setRateLimitBackendForTesting,
  getRateLimitBackendInfo,
} from "@/server/security/rate-limit";
import { POST as postRequestAccess } from "@/app/api/auth/request-access/route";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/jwt-session";

/**
 * Test đặc tả POST /api/auth/request-access — endpoint công khai trước đăng nhập.
 * Thứ tự trong route: rate limit (khóa `request-access:<ip>`, tier AUTH_REGISTER 5 lần/giờ) → validate JSON
 * (≤ 4 KB, schema strict) → ghi audit ACCESS_REQUESTED. Không có CSRF, không gửi thư/thông báo/outbox.
 *
 * Cô lập rate limit: mỗi test dùng IP riêng sinh ngẫu nhiên theo lần chạy, đặt qua `x-real-ip`
 * (không dùng X-Forwarded-For để không đóng khung việc tin phần tử đầu XFF do client gửi).
 * Backend thật (Redis nếu REDIS_URL có, ngược lại bộ nhớ trong tiến trình) được dùng cho mọi test,
 * trừ test bucket "unknown" (khóa hằng số) tiêm backend bộ nhớ riêng để không đụng tiến trình/lần chạy khác.
 */
describe("POST /api/auth/request-access", () => {
  const runId = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  // Cửa sổ rộng để chịu lệch đồng hồ app/DB; chỉ dùng cho bucket "unknown" (khóa hằng số).
  const unknownBucketSince = new Date(Date.now() - 10 * 60 * 1000);
  const ipPrefix = `10.${crypto.randomInt(0, 256)}.${crypto.randomInt(0, 256)}`;
  let ipSeq = 0;
  const nextIp = () => `${ipPrefix}.${++ipSeq}`;

  const RATE_LIMIT_AUDIT_ENTITY_ID = "qcet:eoffice:ratelimit:AUTH_REGISTER:ip";
  const SUCCESS_MESSAGE = "Đã gửi yêu cầu cấp quyền. Quản trị viên sẽ xem và phản hồi qua email.";

  const emailsUsed = new Set<string>();
  const rateLimitedIdentifiers = new Set<string>();
  const email = (tag: string) => {
    const value = `${runId}.ra-${tag}@qcet-test.edu.vn`;
    emailsUsed.add(value);
    return value;
  };

  let reqSeq = 0;
  function makeRequest(
    opts: { ip?: string; body?: string; contentType?: string | null; headers?: Record<string, string> } = {}
  ) {
    const requestId = `tra-${runId}-${++reqSeq}`;
    const headers = new Headers({ "x-request-id": requestId, ...opts.headers });
    if (opts.ip) headers.set("x-real-ip", opts.ip);
    if (opts.contentType !== null) headers.set("Content-Type", opts.contentType ?? "application/json");
    return {
      req: new NextRequest("http://localhost:3000/api/auth/request-access", {
        method: "POST",
        headers,
        body: opts.body ?? "",
      }),
      requestId,
    };
  }

  const jsonBody = (value: unknown) => JSON.stringify(value);

  async function accessAudits(entityId: string) {
    return prisma.auditEvent.findMany({ where: { action: "ACCESS_REQUESTED", entityId } });
  }

  /**
   * Audit 429 không mang runId: lọc theo identifier. IP sinh ngẫu nhiên theo lần chạy nên đã duy nhất;
   * riêng bucket "unknown" thêm pid của tiến trình test và mốc thời gian.
   */
  function rateLimitAuditWhere(identifier: string): Prisma.AuditEventWhereInput {
    const isUnknown = identifier.endsWith(":unknown");
    return {
      action: "RATE_LIMIT_EXCEEDED",
      entityId: RATE_LIMIT_AUDIT_ENTITY_ID,
      ...(isUnknown ? { createdAt: { gte: unknownBucketSince } } : {}),
      AND: [
        { metadata: { path: ["identifier"], equals: identifier } },
        ...(isUnknown ? [{ metadata: { path: ["pid"], equals: process.pid } }] : []),
      ],
    };
  }

  /** Audit 429 ghi kiểu fire-and-forget nên chờ ngắn tới khi xuất hiện. */
  async function waitForRateLimitAudit(identifier: string) {
    for (let i = 0; i < 30; i++) {
      const rows = await prisma.auditEvent.findMany({ where: rateLimitAuditWhere(identifier) });
      if (rows.length > 0) return rows;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return [];
  }

  before(() => {
    // Ghi lại backend đang dùng để đọc trong log khi cần chẩn đoán 429/503.
    const info = getRateLimitBackendInfo();
    console.log(`[request-access test] rate-limit backend=${info.mode} redisConfigured=${info.redisConfigured}`);
  });

  after(async () => {
    __clearRateLimitBackendForTesting();
    // Chờ các audit fire-and-forget còn treo trước khi dọn.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await prisma.auditEvent.deleteMany({
      where: { action: "ACCESS_REQUESTED", entityId: { in: [...emailsUsed] } },
    });
    for (const identifier of rateLimitedIdentifiers) {
      await prisma.auditEvent.deleteMany({ where: rateLimitAuditWhere(identifier) });
    }
  });

  describe("thành công (không cần đăng nhập)", () => {
    test("200: chuẩn hóa email (trim + lowercase), ghi đúng một audit ACCESS_REQUESTED", async () => {
      const ip = nextIp();
      const normalized = email("ok");
      const { req, requestId } = makeRequest({
        ip,
        body: jsonBody({ email: `  ${normalized.toUpperCase()}  `, name: "  Nguyễn Văn Kiểm Thử  " }),
      });
      const res = await postRequestAccess(req);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      assert.equal(res.headers.get("x-request-id"), requestId);
      const body = await res.json();
      assert.deepEqual(body, { success: true, message: SUCCESS_MESSAGE });

      const rows = await accessAudits(normalized);
      assert.equal(rows.length, 1);
      const [row] = rows;
      assert.equal(row.actorId, null);
      assert.equal(row.entityType, "User");
      assert.equal(row.entityId, normalized);
      const metadata = row.metadata as Record<string, unknown>;
      assert.deepEqual(Object.keys(metadata).sort(), ["email", "ip", "name", "source", "timestamp", "type"]);
      assert.equal(metadata.type, "ACCESS_REQUEST");
      assert.equal(metadata.email, normalized);
      assert.equal(metadata.name, "Nguyễn Văn Kiểm Thử");
      assert.equal(metadata.source, "LOGIN_FLOW");
      assert.equal(metadata.ip, ip);
      assert.ok(!Number.isNaN(Date.parse(String(metadata.timestamp))));
      // Không còn bản ghi theo dạng email chưa chuẩn hóa
      assert.equal((await accessAudits(`  ${normalized.toUpperCase()}  `)).length, 0);
    });

    test("còn phiên cũ không hợp lệ (tài khoản bị khóa, token hỏng): vẫn 200 và ghi yêu cầu (trước là 401)", async () => {
      const disabled = await prisma.user.create({
        data: { email: email("disabled-user"), name: `RA disabled ${runId}`, isActive: false },
      });
      try {
        const staleToken = signSessionToken({ id: disabled.id, email: disabled.email, name: disabled.name, role: disabled.role });
        const cases: Array<[string, Record<string, string>]> = [
          ["cookie-disabled", { Cookie: `${SESSION_COOKIE_NAME}=${staleToken}` }],
          ["bearer-disabled", { Authorization: `Bearer ${staleToken}` }],
          ["bearer-malformed", { Authorization: "Bearer khong-phai-jwt" }],
        ];
        for (const [tag, headers] of cases) {
          const requested = email(tag);
          const { req, requestId } = makeRequest({ ip: nextIp(), headers, body: jsonBody({ email: requested }) });
          const res = await postRequestAccess(req);
          assert.equal(res.status, 200, tag);
          assert.equal(res.headers.get("x-request-id"), requestId, `${tag}: giữ request id của client`);
          assert.deepEqual(await res.json(), { success: true, message: SUCCESS_MESSAGE });
          assert.equal((await accessAudits(requested)).length, 1, `${tag}: có audit ACCESS_REQUESTED`);
        }
      } finally {
        await prisma.auditEvent.deleteMany({ where: { actorId: disabled.id } });
        await prisma.user.delete({ where: { id: disabled.id } });
      }
    });

    test("name bỏ trống hoặc chỉ khoảng trắng: metadata không có khóa name", async () => {
      const ip = nextIp();
      const omitted = email("noname");
      const blank = email("blankname");

      const r1 = await postRequestAccess(makeRequest({ ip, body: jsonBody({ email: omitted }) }).req);
      assert.equal(r1.status, 200);
      const r2 = await postRequestAccess(makeRequest({ ip, body: jsonBody({ email: blank, name: "   " }) }).req);
      assert.equal(r2.status, 200);

      for (const e of [omitted, blank]) {
        const rows = await accessAudits(e);
        assert.equal(rows.length, 1, `thiếu audit cho ${e}`);
        const metadata = rows[0].metadata as Record<string, unknown>;
        assert.equal("name" in metadata, false);
        assert.equal(metadata.email, e);
      }
    });
  });

  describe("validate đầu vào (không ghi audit)", () => {
    test("email sai định dạng, thừa khóa (strict), thiếu email: 400 VALIDATION_ERROR", async () => {
      const ip = nextIp();
      const strictEmail = email("strict");

      const badEmail = await postRequestAccess(makeRequest({ ip, body: jsonBody({ email: `${runId}-not-an-email` }) }).req);
      assert.equal(badEmail.status, 400);
      assert.equal(badEmail.headers.get("cache-control"), "private, no-store");
      const badBody = await badEmail.json();
      assert.equal(badBody.success, false);
      assert.equal(badBody.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(badBody.fieldErrors?.email) && badBody.fieldErrors.email.length > 0);
      assert.equal("message" in badBody && badBody.message === SUCCESS_MESSAGE, false);

      const extraKey = await postRequestAccess(
        makeRequest({ ip, body: jsonBody({ email: strictEmail, role: "ADMIN" }) }).req,
      );
      assert.equal(extraKey.status, 400);
      assert.equal((await extraKey.json()).code, "VALIDATION_ERROR");

      const missing = await postRequestAccess(makeRequest({ ip, body: jsonBody({ name: "Thiếu email" }) }).req);
      assert.equal(missing.status, 400);
      const missingBody = await missing.json();
      assert.equal(missingBody.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(missingBody.fieldErrors?.email));

      assert.equal((await accessAudits(strictEmail)).length, 0);
      assert.equal((await accessAudits(`${runId}-not-an-email`)).length, 0);
    });

    test("email quá 254 ký tự hoặc name quá 255 ký tự: 400 VALIDATION_ERROR", async () => {
      const ip = nextIp();
      const longEmail = `${"a".repeat(240)}${runId}@qcet-test.edu.vn`;
      emailsUsed.add(longEmail);
      const longName = email("longname");

      const r1 = await postRequestAccess(makeRequest({ ip, body: jsonBody({ email: longEmail }) }).req);
      assert.equal(r1.status, 400);
      const b1 = await r1.json();
      assert.equal(b1.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(b1.fieldErrors?.email));

      const r2 = await postRequestAccess(makeRequest({ ip, body: jsonBody({ email: longName, name: "N".repeat(256) }) }).req);
      assert.equal(r2.status, 400);
      const b2 = await r2.json();
      assert.equal(b2.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(b2.fieldErrors?.name));

      assert.equal((await accessAudits(longEmail)).length, 0);
      assert.equal((await accessAudits(longName)).length, 0);
    });

    test("body rỗng hoặc JSON hỏng: 400 VALIDATION_ERROR 'Invalid JSON body'; sai Content-Type: 415", async () => {
      const ip = nextIp();
      const textEmail = email("textplain");

      const empty = await postRequestAccess(makeRequest({ ip, body: "" }).req);
      assert.equal(empty.status, 400);
      const emptyBody = await empty.json();
      assert.equal(emptyBody.code, "VALIDATION_ERROR");
      assert.equal(emptyBody.message, "Invalid JSON body");

      const malformed = await postRequestAccess(makeRequest({ ip, body: "{not json" }).req);
      assert.equal(malformed.status, 400);
      assert.equal((await malformed.json()).message, "Invalid JSON body");

      const textPlain = await postRequestAccess(
        makeRequest({ ip, body: jsonBody({ email: textEmail }), contentType: "text/plain" }).req,
      );
      assert.equal(textPlain.status, 415);
      assert.equal(textPlain.headers.get("cache-control"), "private, no-store");
      assert.equal((await textPlain.json()).code, "UNSUPPORTED_MEDIA_TYPE");

      const formEncoded = await postRequestAccess(
        makeRequest({ ip, body: `email=${encodeURIComponent(textEmail)}`, contentType: "application/x-www-form-urlencoded" }).req,
      );
      assert.equal(formEncoded.status, 415);
      assert.equal((await formEncoded.json()).code, "UNSUPPORTED_MEDIA_TYPE");

      assert.equal((await accessAudits(textEmail)).length, 0);
    });

    test("body vượt 4 KB: 413 PAYLOAD_TOO_LARGE", async () => {
      const ip = nextIp();
      const bigEmail = email("big");
      const res = await postRequestAccess(makeRequest({ ip, body: jsonBody({ email: bigEmail, name: "N".repeat(5000) }) }).req);
      assert.equal(res.status, 413);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      assert.equal((await res.json()).code, "PAYLOAD_TOO_LARGE");
      assert.equal((await accessAudits(bigEmail)).length, 0);
    });
  });

  describe("rate limit theo IP (AUTH_REGISTER: 5 lần/giờ, đếm trước khi validate)", () => {
    test("lần thứ 6 cùng IP: 429 RATE_LIMITED + Retry-After, không ghi yêu cầu; IP khác vẫn được nhận", async () => {
      const ip = nextIp();
      const identifier = `request-access:${ip}`;
      rateLimitedIdentifiers.add(identifier);
      const blockedEmail = email("blocked");

      // 5 lần đầu đều sai schema (400) nhưng vẫn bị đếm vì rate limit chạy trước validate.
      for (let i = 0; i < 5; i++) {
        const res = await postRequestAccess(makeRequest({ ip, body: jsonBody({}) }).req);
        assert.equal(res.status, 400, `lần ${i + 1} phải là 400`);
      }

      const { req, requestId } = makeRequest({ ip, body: jsonBody({ email: blockedEmail }) });
      const blocked = await postRequestAccess(req);
      assert.equal(blocked.status, 429);
      assert.equal(blocked.headers.get("cache-control"), "private, no-store");
      assert.equal(blocked.headers.get("x-request-id"), requestId);
      const retryAfter = Number(blocked.headers.get("retry-after"));
      assert.ok(Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 3600, `Retry-After=${retryAfter}`);
      const blockedBody = await blocked.json();
      assert.equal(blockedBody.success, false);
      assert.equal(blockedBody.code, "RATE_LIMITED");
      assert.equal((await accessAudits(blockedEmail)).length, 0);

      // Cùng body từ IP khác: không bị ảnh hưởng.
      const otherIp = nextIp();
      const allowed = await postRequestAccess(makeRequest({ ip: otherIp, body: jsonBody({ email: blockedEmail }) }).req);
      assert.equal(allowed.status, 200);
      const rows = await accessAudits(blockedEmail);
      assert.equal(rows.length, 1);
      assert.equal((rows[0].metadata as Record<string, unknown>).ip, otherIp);

      // Lần bị chặn ghi audit RATE_LIMIT_EXCEEDED (không gắn actor).
      const limitRows = await waitForRateLimitAudit(identifier);
      assert.equal(limitRows.length, 1);
      assert.equal(limitRows[0].entityType, "System");
      assert.equal(limitRows[0].actorId, null);
      const limitMeta = limitRows[0].metadata as Record<string, unknown>;
      assert.equal(limitMeta.tier, "AUTH_REGISTER");
      assert.equal(limitMeta.subjectType, "ip");
    });

    test("không có header IP: mọi request dùng chung bucket 'request-access:unknown'", async () => {
      // Khóa hằng số → tiêm backend bộ nhớ riêng của test này để không ảnh hưởng lần chạy/tiến trình khác.
      __setRateLimitBackendForTesting(new SharedMemoryRateLimitBackend());
      rateLimitedIdentifiers.add("request-access:unknown");
      try {
        for (let i = 0; i < 5; i++) {
          const res = await postRequestAccess(makeRequest({ body: jsonBody({}) }).req);
          assert.equal(res.status, 400, `lần ${i + 1} phải là 400`);
        }
        const blocked = await postRequestAccess(makeRequest({ body: jsonBody({}) }).req);
        assert.equal(blocked.status, 429);
        assert.equal((await blocked.json()).code, "RATE_LIMITED");

        // Client có IP riêng không dùng chung bucket "unknown".
        const withIp = await postRequestAccess(makeRequest({ ip: nextIp(), body: jsonBody({}) }).req);
        assert.equal(withIp.status, 400);
        assert.equal((await withIp.json()).code, "VALIDATION_ERROR");

        const limitRows = await waitForRateLimitAudit("request-access:unknown");
        assert.equal(limitRows.length, 1);
      } finally {
        __clearRateLimitBackendForTesting();
      }
    });
  });
});
