import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@qcet/db/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/jwt-session";
import { GET as getLoginAs, POST as postLoginAs } from "@/app/api/dev/login-as/route";

/**
 * Test đặc tả /api/dev/login-as — ranh giới bảo mật: chỉ mở khi NODE_ENV === "development"
 * và Host là localhost/127.0.0.1/[::1] (có thể kèm cổng), `x-forwarded-host` (Host gốc qua rewrite của web) nếu có cũng
 * phải cục bộ; mọi trường hợp khác trả 404 rỗng, không cấp cookie.
 *
 * `isLocalDev()` đọc `process.env.NODE_ENV` lúc xử lý request (không phải lúc nạp module), nên test đổi
 * NODE_ENV trong từng ca và luôn khôi phục đúng giá trị ban đầu trong finally/after.
 * Không có CSRF/rate limit/audit trong route này.
 */
describe("/api/dev/login-as", () => {
  const runId = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;

  const activeId = `tdla-active-${runId}`;
  const inactiveId = `tdla-inactive-${runId}`;
  const userIds = [activeId, inactiveId];

  function setNodeEnv(value: string | undefined) {
    if (value === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = value;
  }

  async function withNodeEnv<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
    setNodeEnv(value);
    try {
      return await fn();
    } finally {
      setNodeEnv(originalNodeEnv);
    }
  }

  function getRequest(host: string | null, forwardedHost?: string) {
    const headers = new Headers();
    if (host !== null) headers.set("host", host);
    if (forwardedHost !== undefined) headers.set("x-forwarded-host", forwardedHost);
    return new NextRequest("http://localhost:3000/api/dev/login-as", { headers });
  }

  function postRequest(host: string | null, body: string, forwardedHost?: string) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (host !== null) headers.set("host", host);
    if (forwardedHost !== undefined) headers.set("x-forwarded-host", forwardedHost);
    return new NextRequest("http://localhost:3000/api/dev/login-as", { method: "POST", headers, body });
  }

  async function assertBlocked(res: Response) {
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("set-cookie"), null);
    assert.equal(await res.text(), "");
  }

  before(async () => {
    assert.equal(originalNodeEnv, "test", "runner phải chạy với NODE_ENV=test");
    await prisma.user.createMany({
      data: [
        {
          id: activeId,
          email: `${runId}.dla-active@qcet-test.edu.vn`,
          name: `Kiểm thử đăng nhập dev ${runId}`,
          role: "TRUONG_PHONG",
          title: "Trưởng phòng thử",
          isActive: true,
        },
        {
          id: inactiveId,
          email: `${runId}.dla-inactive@qcet-test.edu.vn`,
          name: `Kiểm thử bị khóa ${runId}`,
          role: "ADMIN",
          isActive: false,
        },
      ],
    });
  });

  after(async () => {
    setNodeEnv(originalNodeEnv);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  describe("bị chặn ngoài dev cục bộ (404 rỗng, không cookie)", () => {
    test("NODE_ENV=production + Host localhost: GET 404", async () => {
      await withNodeEnv("production", async () => {
        await assertBlocked(await getLoginAs(getRequest("localhost:3000")));
      });
    });

    test("NODE_ENV=production + Host localhost + userId hợp lệ: POST 404, không cấp phiên", async () => {
      await withNodeEnv("production", async () => {
        await assertBlocked(await postLoginAs(postRequest("localhost:3000", JSON.stringify({ userId: activeId }))));
      });
    });

    test("NODE_ENV=test (mặc định của runner) cũng bị chặn: GET và POST 404", async () => {
      assert.equal(process.env.NODE_ENV, "test");
      await assertBlocked(await getLoginAs(getRequest("localhost:3000")));
      await assertBlocked(await postLoginAs(postRequest("localhost:3000", JSON.stringify({ userId: activeId }))));
    });

    test("NODE_ENV không đặt: GET và POST 404", async () => {
      await withNodeEnv(undefined, async () => {
        await assertBlocked(await getLoginAs(getRequest("localhost:3000")));
        await assertBlocked(await postLoginAs(postRequest("localhost:3000", JSON.stringify({ userId: activeId }))));
      });
    });

    test("NODE_ENV=development nhưng Host không phải cục bộ: GET và POST 404", async () => {
      await withNodeEnv("development", async () => {
        for (const host of [
          "qcet.dixxie.store",
          "192.168.1.10:3000",
          "0.0.0.0:3000",
          "localhost.evil.example",
          "evil.example:3000",
          "localhost:3000.evil.example",
        ]) {
          const getRes = await getLoginAs(getRequest(host));
          assert.equal(getRes.status, 404, `GET Host=${host}`);
          assert.equal(await getRes.text(), "");
          const postRes = await postLoginAs(postRequest(host, JSON.stringify({ userId: activeId })));
          assert.equal(postRes.status, 404, `POST Host=${host}`);
          assert.equal(postRes.headers.get("set-cookie"), null, `POST Host=${host} không được cấp cookie`);
        }
      });
    });

    test("NODE_ENV=development, Host cục bộ nhưng x-forwarded-host (Host gốc qua rewrite của web) không cục bộ: GET và POST 404", async () => {
      await withNodeEnv("development", async () => {
        for (const forwardedHost of ["192.168.1.10:3000", "qcet.dixxie.store", "localhost.evil.example", ""]) {
          await assertBlocked(await getLoginAs(getRequest("localhost:3100", forwardedHost)));
          await assertBlocked(await postLoginAs(postRequest("localhost:3100", JSON.stringify({ userId: activeId }), forwardedHost)));
        }
      });
    });

    test("NODE_ENV=development nhưng thiếu header Host: GET và POST 404", async () => {
      await withNodeEnv("development", async () => {
        await assertBlocked(await getLoginAs(getRequest(null)));
        await assertBlocked(await postLoginAs(postRequest(null, JSON.stringify({ userId: activeId }))));
      });
    });
  });

  describe("dev cục bộ (NODE_ENV=development + Host cục bộ)", () => {
    test("GET: 200 no-store, danh sách user đang hoạt động gồm user fixture, không có user bị khóa", async () => {
      await withNodeEnv("development", async () => {
        const res = await getLoginAs(getRequest("localhost:3000"));
        assert.equal(res.status, 200);
        assert.match(res.headers.get("content-type") ?? "", /application\/json/);
        assert.equal(res.headers.get("cache-control"), "no-store");
        const body = await res.json();
        assert.deepEqual(Object.keys(body), ["users"]);
        assert.ok(Array.isArray(body.users));
        const mine = body.users.find((u: { id: string }) => u.id === activeId);
        assert.deepEqual(mine, {
          id: activeId,
          name: `Kiểm thử đăng nhập dev ${runId}`,
          email: `${runId}.dla-active@qcet-test.edu.vn`,
          role: "TRUONG_PHONG",
          title: "Trưởng phòng thử",
        });
        assert.equal(body.users.some((u: { id: string }) => u.id === inactiveId), false);
      });
    });

    test("GET chấp nhận các dạng Host cục bộ: localhost, 127.0.0.1:port, [::1]:port", async () => {
      await withNodeEnv("development", async () => {
        for (const host of ["localhost", "127.0.0.1:3001", "[::1]:3000"]) {
          const res = await getLoginAs(getRequest(host));
          assert.equal(res.status, 200, `Host=${host}`);
          const body = await res.json();
          assert.ok(body.users.some((u: { id: string }) => u.id === activeId), `Host=${host} thiếu user fixture`);
        }
      });
    });

    test("GET qua rewrite của web chạy cục bộ (Host api + x-forwarded-host localhost): 200", async () => {
      await withNodeEnv("development", async () => {
        assert.equal((await getLoginAs(getRequest("localhost:3100", "localhost:3000"))).status, 200);
      });
    });

    test("POST userId hợp lệ: 200 {ok:true}, cấp cookie phiên httpOnly/lax/path=/ 24h cho đúng user", async () => {
      await withNodeEnv("development", async () => {
        const res = await postLoginAs(postRequest("localhost:3000", JSON.stringify({ userId: activeId })));
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });

        const cookie = res.cookies.get(SESSION_COOKIE_NAME);
        assert.ok(cookie, "thiếu cookie phiên");
        assert.equal(cookie.httpOnly, true);
        assert.equal(cookie.sameSite, "lax");
        assert.equal(cookie.path, "/");
        assert.equal(cookie.maxAge, 60 * 60 * 24);
        assert.notEqual(cookie.secure, true);

        const rawSetCookie = res.headers.get("set-cookie") ?? "";
        assert.match(rawSetCookie, /HttpOnly/i);
        assert.match(rawSetCookie, /SameSite=lax/i);

        const payload = verifySessionToken(cookie.value);
        assert.ok(payload, "token trong cookie phải xác minh được");
        assert.equal(payload.id, activeId);
        assert.equal(payload.email, `${runId}.dla-active@qcet-test.edu.vn`);
        assert.equal(payload.role, "TRUONG_PHONG");
      });
    });

    test("POST user bị khóa, user không tồn tại, thiếu/không phải chuỗi userId, JSON hỏng: 404 'Không tìm thấy tài khoản', không cookie", async () => {
      await withNodeEnv("development", async () => {
        const bodies = [
          JSON.stringify({ userId: inactiveId }),
          JSON.stringify({ userId: `tdla-ghost-${runId}` }),
          JSON.stringify({}),
          JSON.stringify({ userId: 123 }),
          JSON.stringify({ userId: "" }),
          "{not json",
        ];
        for (const body of bodies) {
          const res = await postLoginAs(postRequest("localhost:3000", body));
          assert.equal(res.status, 404, `body=${body}`);
          assert.equal(res.headers.get("set-cookie"), null, `body=${body} không được cấp cookie`);
          assert.deepEqual(await res.json(), { error: "Không tìm thấy tài khoản" });
        }
      });
    });
  });

  test("NODE_ENV được khôi phục về 'test' sau các ca đổi môi trường", () => {
    assert.equal(process.env.NODE_ENV, "test");
    assert.equal(process.env.NODE_ENV, originalNodeEnv);
  });
});
