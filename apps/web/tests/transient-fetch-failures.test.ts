import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { listRecordings, RecordingRequestError } from "../src/components/meetings/recording-client";
import { fetchDepartments, resetDepartmentListCache } from "../src/hooks/use-department-list";
import { fetchPersonnel, resetPersonnelListCache } from "../src/hooks/use-personnel-list";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  resetDepartmentListCache();
  resetPersonnelListCache();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Danh sách ghi âm: hủy chủ động không phải mất mạng", () => {
  // Trang cuộc họp báo "Chưa tải được danh sách bản ghi âm" vì React dựng lại hiệu ứng (hủy lần tải đầu) bị coi là lỗi mạng
  it("fetch bị hủy thì ném nguyên AbortError để nơi gọi bỏ qua, không đổi thành RecordingRequestError", async () => {
    globalThis.fetch = (async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    }) as typeof fetch;
    await assert.rejects(listRecordings("m1", new AbortController().signal), (error: Error) => {
      assert.equal(error.name, "AbortError");
      assert.equal(error instanceof RecordingRequestError, false);
      return true;
    });
  });

  it("mất mạng thật vẫn là RecordingRequestError mã 0 kèm câu hướng dẫn", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await assert.rejects(listRecordings("m1"), (error: Error) => {
      assert.ok(error instanceof RecordingRequestError);
      assert.equal(error.status, 0);
      assert.match(error.message, /Mất kết nối/);
      return true;
    });
  });
});

describe("Danh bạ đơn vị: lỗi thoáng qua không bị nhớ thành danh sách rỗng", () => {
  const UNITS = [{ id: "u1", name: "Phòng A", code: "A", personnel: [{ id: "p1", name: "Người một" }] }];

  it("503, thân không phải danh sách hay mất mạng đều ném lỗi, lần gọi sau tải lại và nhận danh sách thật", async () => {
    for (const failing of [
      async () => json({ detail: "busy" }, 503),
      async () => json({ success: true, data: { not: "a list" } }),
      async () => new Response("<html>", { status: 200 }),
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ]) {
      resetDepartmentListCache();
      globalThis.fetch = failing as typeof fetch;
      await assert.rejects(fetchDepartments(true));

      let calls = 0;
      globalThis.fetch = (async () => {
        calls += 1;
        return json({ success: true, data: UNITS });
      }) as typeof fetch;
      assert.deepEqual(await fetchDepartments(true), UNITS, "lỗi trước đó không được nhớ");
      assert.deepEqual(await fetchDepartments(true), UNITS);
      assert.equal(calls, 1, "danh sách hợp lệ thì được nhớ");
    }
  });

  it("429 cũng không được nhớ", async () => {
    globalThis.fetch = (async () => json({ detail: "Quá nhiều yêu cầu" }, 429)) as typeof fetch;
    await assert.rejects(fetchDepartments(false));
    globalThis.fetch = (async () => json({ data: UNITS })) as typeof fetch;
    assert.deepEqual(await fetchDepartments(false), UNITS);
  });
});

describe("Danh sách nhân sự: lỗi thoáng qua không bị nhớ thành danh sách rỗng", () => {
  const USERS = [{ id: "p1", name: "Người một", email: "a@example.com" }];

  it("401 hay mất mạng trả rỗng nhưng không nhớ; lần sau tải lại được", async () => {
    globalThis.fetch = (async () => json({ success: false, error: "UNAUTHORIZED" }, 401)) as typeof fetch;
    assert.deepEqual(await fetchPersonnel(), []);
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    assert.deepEqual(await fetchPersonnel(), []);

    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return json({ success: true, users: USERS });
    }) as typeof fetch;
    const first = await fetchPersonnel();
    assert.equal(first.length, 1);
    assert.equal(first[0].id, "p1");
    await fetchPersonnel();
    assert.equal(calls, 1, "danh sách hợp lệ thì được nhớ");
  });
});
