// Kiểm tay sau khi triển khai web + api tách rời: trang (qcet-web), /api (qcet-api qua cloudflared hoặc rewrite),
// phiên đăng nhập, tạo nhiệm vụ, tải tệp và stream Trợ lý không bị gom.
//
//   QCET_SMOKE_COOKIE='__Secure-authjs.session-token=…' node scripts/smoke-split.mjs --base https://qcet.example [--write [--unit <mã đơn vị>]] [--chat]
//
// Đăng nhập chỉ qua Google nên phiên lấy từ cookie của trình duyệt đã đăng nhập (DevTools > Application > Cookies);
// script không in cookie. Mặc định chỉ đọc. --write: tạo nhiệm vụ "[SMOKE]…" (đơn vị chủ trì từ --unit hoặc đơn vị
// của tài khoản), tải một tệp nhỏ gắn vào đó, tải lại, rồi lưu trữ nhiệm vụ (DELETE là lưu trữ; nhiệm vụ và tệp vẫn còn
// trong CSDL). --chat: một lượt Trợ lý (tốn lượt gọi gateway), xóa cuộc trò chuyện sau đó.
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = arg("--base", "http://127.0.0.1:3000").replace(/\/+$/, "");
const ORIGIN = new URL(BASE).origin;
const COOKIE = process.env.QCET_SMOKE_COOKIE?.trim() || "";
const WRITE = args.includes("--write");
const CHAT = args.includes("--chat");

let failures = 0;
const report = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
};
const skip = (label, why) => console.log(`SKIP ${label}: ${why}`);
const withSession = (headers = {}) => (COOKIE ? { cookie: COOKIE, ...headers } : headers);
// Yêu cầu ghi đi kèm Origin/Fetch Metadata như trình duyệt cùng origin (CSRF)
const mutation = (headers = {}) => withSession({ origin: ORIGIN, "sec-fetch-site": "same-origin", ...headers });
const get = (path, headers) => fetch(`${BASE}${path}`, { headers, redirect: "manual" });
/** Thông báo lỗi của API (RFC 9457 `detail` hoặc `error.message`) để biết vì sao thất bại. */
const errorText = (body) => (body ? ` ${body.detail || body.error?.message || body.message || ""}`.trimEnd() : "");
const json = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

async function main() {
  console.log(`Kiểm ${BASE} (${WRITE ? "có ghi" : "chỉ đọc"}${CHAT ? ", có Trợ lý" : ""})`);

  const login = await get("/login");
  report(login.status === 200, "trang đăng nhập (qcet-web)", String(login.status));
  const health = await get("/api/health");
  report(health.status === 200, "GET /api/health (qcet-api)", `${health.status}, x-request-id=${health.headers.get("x-request-id") ? "có" : "không"}`);
  const providers = await get("/api/auth/providers");
  const providerBody = await json(providers);
  report(providers.status === 200 && Boolean(providerBody?.google), "Auth.js /api/auth/providers có google", String(providers.status));
  const config = await json(await get("/api/runtime-config"));
  report(Boolean(config?.features), "GET /api/runtime-config", config ? `môi trường ${config.environment}` : "không đọc được");

  if (!COOKIE) {
    skip("phiên, nhiệm vụ, tải tệp, Trợ lý", "chưa đặt QCET_SMOKE_COOKIE");
    return;
  }
  const me = await json(await get("/api/auth/me", withSession()));
  report(me?.authenticated === true, "GET /api/auth/me", me?.authenticated ? `vai trò ${me.user?.role}` : "chưa đăng nhập (cookie hết hạn?)");
  if (!me?.authenticated) return;
  const tasksPage = await get("/tasks", withSession());
  report(tasksPage.status === 200, "trang /tasks đọc dữ liệu qua API", String(tasksPage.status));

  const leadUnitId = arg("--unit", me.user?.departmentId || "");
  if (WRITE && !leadUnitId) skip("tạo nhiệm vụ, tải tệp", "tài khoản chưa có đơn vị; thêm --unit <mã đơn vị>");
  else if (WRITE) {
    const dueDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const created = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: mutation({ "content-type": "application/json" }),
      body: JSON.stringify({ title: `[SMOKE] Kiểm tra tách web/api ${new Date().toISOString()}`, dueDate, leadUnitId, priority: "LOW" }),
    });
    const createdBody = await json(created);
    const task = createdBody?.task;
    report((created.status === 200 || created.status === 201) && Boolean(task?.id), "POST /api/tasks", `${created.status}${task?.id ? ` id=${task.id}` : errorText(createdBody)}`);

    const form = new FormData();
    form.append("file", new Blob([`QCET smoke ${new Date().toISOString()}\n`], { type: "text/plain" }), "qcet-smoke.txt");
    if (task?.id) form.append("taskId", task.id);
    const uploaded = await fetch(`${BASE}/api/upload`, { method: "POST", headers: mutation(), body: form });
    const file = await json(uploaded);
    report(uploaded.status === 200 && Boolean(file?.fileId), "POST /api/upload", `${uploaded.status}${file?.scanStatus ? ` quét=${file.scanStatus}` : errorText(file)}`);
    if (file?.fileUrl) {
      const download = await get(file.fileUrl, withSession());
      report(download.status === 200, "tải lại tệp vừa lưu", String(download.status));
    }

    if (task?.id) {
      const removed = await fetch(`${BASE}/api/tasks/${task.id}`, {
        method: "DELETE",
        headers: mutation({ "content-type": "application/json" }),
        body: JSON.stringify({ reason: "Nhiệm vụ kiểm tra sau triển khai (smoke)", expectedVersion: task.version ?? 0 }),
      });
      report(removed.status < 300, "lưu trữ nhiệm vụ [SMOKE]", `${removed.status}${removed.status < 300 ? "" : errorText(await json(removed))}`);
    }
  } else skip("tạo nhiệm vụ, tải tệp", "thêm --write");

  if (CHAT) {
    if (!config?.features?.assistant) skip("Trợ lý", "cờ assistant đang tắt");
    else await checkChat();
  } else skip("stream Trợ lý", "thêm --chat");
}

/** Một lượt Trợ lý: các sự kiện ndjson phải tới rải theo thời gian (proxy không gom cả phản hồi). */
async function checkChat() {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/assistant/chat`, {
    method: "POST",
    headers: mutation({ "content-type": "application/json" }),
    body: JSON.stringify({ message: "Trả lời đúng một câu ngắn: hôm nay là thứ mấy?" }),
  });
  if (res.status !== 200 || !res.body) {
    report(false, "POST /api/assistant/chat", `${res.status} ${JSON.stringify(await json(res))?.slice(0, 200)}`);
    return;
  }
  const arrivals = [];
  let conversationId;
  let lastType;
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      arrivals.push(Date.now() - t0);
      const event = JSON.parse(line);
      lastType = event.type;
      if (event.type === "conversation") conversationId = event.conversation?.id;
    }
  }
  const spread = arrivals.length > 1 ? arrivals[arrivals.length - 1] - arrivals[0] : 0;
  report(
    arrivals.length > 1 && spread >= 300 && lastType === "done",
    "stream Trợ lý không bị gom",
    `${arrivals.length} sự kiện, đầu ${arrivals[0]}ms, cuối ${arrivals.at(-1)}ms, kết thúc=${lastType}, content-type=${res.headers.get("content-type")}`,
  );
  if (conversationId) {
    const removed = await fetch(`${BASE}/api/assistant/conversations/${conversationId}`, { method: "DELETE", headers: mutation() });
    report(removed.status < 300, "xóa cuộc trò chuyện kiểm tra", String(removed.status));
  }
}

main()
  .catch((error) => {
    failures++;
    console.error(error);
  })
  .finally(() => {
    console.log(failures ? `THẤT BẠI: ${failures}` : "TẤT CẢ OK");
    process.exitCode = failures ? 1 : 0;
  });
