/**
 * Máy chủ cộng tác mô tả nhiệm vụ (ADR-014): máy chủ thật ở cổng 0, provider Hocuspocus thật qua WebSocket, dữ liệu trong
 * qcet_test. Kiểm đồng bộ hai người, seed từ mô tả và lưu lại (bản chiếu về `Task.description` không tăng `version`), chỉ đọc
 * khi thiếu `task.update_metadata`, từ chối khi không đọc được nhiệm vụ, sai Origin hay không có phiên, và PATCH mô tả khi đang
 * có người mở.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import WebSocket from "ws";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { prisma } from "@qcet/db/prisma";
import { TaskActorRole, TaskPriority, TaskScope, TaskStatus } from "@prisma/client";
import { plainTextToContent, contentToPlainText } from "@qcet/shared/lib/tasks/plate-block-codec";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { getCollabServer, startCollabServer, stopCollabServer } from "../src/server/collab/collab-server";
import { syncCollabAfterDescriptionPatch } from "../src/server/collab/collab-sync";
import {
  documentToDescription,
  normalizeDescription,
  replaceDocumentContent,
  seedDocumentFromDescription,
} from "../src/server/collab/collab-content";
import { isAllowedCollabOrigin, parseCollabDocumentName } from "../src/server/collab/collab-auth";

const ORIGIN = "http://localhost:3001";

function rootText(doc: Y.Doc): string {
  return contentToPlainText(documentToDescription(doc));
}

/** Thêm chữ vào đầu khối đầu tiên (khối của slate-yjs là Y.XmlText lồng trong gốc `content`). */
function typeAtStart(doc: Y.Doc, text: string) {
  const root = doc.get("content", Y.XmlText);
  const first = root.toDelta()[0]?.insert as Y.XmlText;
  first.insert(0, text);
}

async function waitFor(check: () => boolean | Promise<boolean>, label: string, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.fail(`hết giờ chờ: ${label}`);
}

describe("collab-content: mô tả ↔ tài liệu Yjs", () => {
  it("seed rồi chiếu lại ra đúng mô tả (đã chuẩn hóa), tài liệu rỗng thành null", () => {
    const description = plainTextToContent("Đoạn một\n- Ý thứ nhất\n- Ý thứ hai");
    const doc = new Y.Doc();
    assert.equal(seedDocumentFromDescription(doc, description), true);
    assert.equal(documentToDescription(doc), normalizeDescription(description));
    assert.equal(seedDocumentFromDescription(doc, plainTextToContent("Khác")), false, "đã có nội dung thì không seed lại");

    replaceDocumentContent(doc, plainTextToContent("Bản mới"));
    assert.equal(rootText(doc), "Bản mới");
    replaceDocumentContent(doc, null);
    assert.equal(documentToDescription(doc), null);
  });

  it("bỏ khối còn URL blob: (đang tải lên) khi chiếu ra mô tả, như editor tự lưu", () => {
    const description = JSON.stringify({
      qcetBlocks: true,
      version: 1,
      blocks: [
        { id: "a", type: "text", content: "Chữ" },
        { id: "b", type: "image", content: "", url: "blob:http://localhost/abc" },
      ],
    });
    const doc = new Y.Doc();
    seedDocumentFromDescription(doc, description);
    assert.equal(rootText(doc), "Chữ");
  });
});

describe("collab-auth: tên tài liệu và Origin", () => {
  it("chỉ nhận task:<id>", () => {
    assert.equal(parseCollabDocumentName("task:cmvabc1234567890abcdef"), "cmvabc1234567890abcdef");
    assert.equal(parseCollabDocumentName("task:../etc"), null);
    assert.equal(parseCollabDocumentName("meeting:cmvabc1234567890abcdef"), null);
  });

  it("Origin phải là chính trang (Host hoặc X-Forwarded-Host qua rewrite) hoặc APP_URL", () => {
    assert.equal(isAllowedCollabOrigin({ host: "localhost:3001", origin: "http://localhost:3001" }), true);
    assert.equal(
      isAllowedCollabOrigin({ host: "127.0.0.1:3101", "x-forwarded-host": "localhost:3001", origin: "http://localhost:3001" }),
      true,
    );
    assert.equal(
      isAllowedCollabOrigin({ host: "qcet.example", "x-forwarded-proto": "https", origin: "https://qcet.example" }),
      true,
    );
    assert.equal(isAllowedCollabOrigin({ host: "localhost:3001", origin: "https://evil.example" }), false);
    assert.equal(isAllowedCollabOrigin({ host: "localhost:3001" }), false, "thiếu Origin");
  });
});

describe("máy chủ cộng tác: kết nối thật", () => {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let url = "";
  let unitId = "";
  const userIds: string[] = [];
  const taskIds: string[] = [];
  const providers: HocuspocusProvider[] = [];
  let editor: { id: string; cookie: string };
  let observer: { id: string; cookie: string };
  let outsider: { id: string; cookie: string };

  async function makeUser(label: string, role: string) {
    const user = await prisma.user.create({
      data: { email: `collab_${label}_${stamp}@qcet.edu.vn`, name: `Cộng tác ${label}`, role: role as never },
    });
    userIds.push(user.id);
    const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    return { id: user.id, cookie: `${SESSION_COOKIE_NAME}=${token}` };
  }

  async function makeTask(description: string) {
    const task = await prisma.task.create({
      data: {
        code: `NV-COLLAB-${stamp}-${taskIds.length}`,
        title: "Nhiệm vụ thử cộng tác",
        description,
        priority: TaskPriority.NORMAL,
        scope: TaskScope.DEPARTMENT,
        createdById: editor.id,
        leadUnitId: unitId,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        academicMonth: 9,
        academicYear: "2026-2027",
        status: TaskStatus.IN_PROGRESS,
        actors: {
          create: [
            { userId: editor.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() },
            { userId: observer.id, role: TaskActorRole.OBSERVER, appointedAt: new Date() },
          ],
        },
      },
    });
    taskIds.push(task.id);
    return task;
  }

  function connect(
    user: { cookie: string } | null,
    taskId: string,
    options: { origin?: string } = {},
  ): Promise<{ provider: HocuspocusProvider; doc: Y.Doc; result: "synced" | `denied:${string}` }> {
    const headers: Record<string, string> = { origin: options.origin ?? ORIGIN };
    if (user) headers.cookie = user.cookie;
    class AuthedSocket extends WebSocket {
      constructor(address: string, protocols?: string | string[]) {
        super(address, protocols, { headers });
      }
    }
    const doc = new Y.Doc();
    return new Promise((resolve) => {
      const websocketProvider = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: AuthedSocket, maxAttempts: 1 });
      const provider: HocuspocusProvider = new HocuspocusProvider({
        websocketProvider,
        name: `task:${taskId}`,
        document: doc,
        onSynced: () => resolve({ provider, doc, result: "synced" }),
        onAuthenticationFailed: ({ reason }) => resolve({ provider, doc, result: `denied:${reason}` }),
      });
      providers.push(provider);
      provider.attach();
    });
  }

  function close(provider: HocuspocusProvider) {
    provider.destroy();
    provider.configuration.websocketProvider.destroy();
  }

  before(async () => {
    const unit = await prisma.organizationalUnit.create({
      data: { id: `dept_collab_${stamp}`, code: `dept_collab_${stamp}`, name: "Đơn vị thử cộng tác", type: "DEPARTMENT" as never, status: "ACTIVE" as never },
    });
    unitId = unit.id;
    editor = await makeUser("editor", "CHUYEN_VIEN");
    observer = await makeUser("observer", "CHUYEN_VIEN");
    outsider = await makeUser("outsider", "CHUYEN_VIEN");
    const server = await startCollabServer({ port: 0, host: "127.0.0.1" });
    url = `ws://127.0.0.1:${server.port}/collab`;
  });

  after(async () => {
    for (const provider of providers) {
      try {
        close(provider);
      } catch {
        /* đã đóng */
      }
    }
    await stopCollabServer();
    if (taskIds.length) {
      await prisma.auditEvent.deleteMany({ where: { entityId: { in: taskIds } } });
      await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
  });

  it("hai người cùng sửa: thấy nhau, rời đi thì lưu trạng thái và chiếu ra mô tả, không tăng version", async () => {
    const task = await makeTask(plainTextToContent("Mô tả ban đầu"));
    const a = await connect(editor, task.id);
    const b = await connect(editor, task.id);
    assert.equal(a.result, "synced");
    assert.equal(b.result, "synced");
    assert.equal(rootText(a.doc), "Mô tả ban đầu", "seed từ mô tả đã lưu");

    typeAtStart(a.doc, "Thêm ");
    await waitFor(() => rootText(b.doc) === "Thêm Mô tả ban đầu", "B thấy chữ A gõ");

    close(a.provider);
    close(b.provider);
    await waitFor(async () => {
      const row = await prisma.taskCollabDocument.findUnique({ where: { taskId: task.id } });
      return Boolean(row);
    }, "lưu trạng thái khi người cuối rời đi");

    const saved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(contentToPlainText(saved.description), "Thêm Mô tả ban đầu");
    assert.equal(saved.version, task.version, "bản chiếu không tăng Task.version");
    const row = await prisma.taskCollabDocument.findUniqueOrThrow({ where: { taskId: task.id } });
    assert.equal(row.updatedById, editor.id);

    // Mở lại: nạp từ trạng thái đã lưu, không seed chồng lên
    const again = await connect(editor, task.id);
    assert.equal(rootText(again.doc), "Thêm Mô tả ban đầu");
    close(again.provider);
  });

  it("mở rồi đóng mà không sửa: không ghi lại mô tả (updatedAt giữ nguyên)", async () => {
    const task = await makeTask(plainTextToContent("Chỉ xem"));
    const viewer = await connect(editor, task.id);
    assert.equal(viewer.result, "synced");
    close(viewer.provider);
    await new Promise((r) => setTimeout(r, 400));
    const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(after.updatedAt.getTime(), task.updatedAt.getTime());
    assert.equal(after.description, task.description);
  });

  it("người theo dõi (không có task.update_metadata) chỉ đọc: thay đổi của họ không tới người khác", async () => {
    const task = await makeTask(plainTextToContent("Không sửa được"));
    const ed = await connect(editor, task.id);
    const obs = await connect(observer, task.id);
    assert.equal(obs.result, "synced");
    assert.equal(obs.provider.authorizedScope, "readonly");
    assert.equal(ed.provider.authorizedScope, "read-write");

    typeAtStart(obs.doc, "Lén ");
    typeAtStart(ed.doc, "Chủ trì ");
    // Chữ gõ cục bộ của người chỉ đọc vẫn nằm trong bản của họ, nên chỉ kiểm có chữ người kia (thứ tự hai chèn ở cùng chỗ tùy clientID)
    await waitFor(() => rootText(obs.doc).includes("Chủ trì "), "người theo dõi vẫn thấy người khác gõ");
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(!rootText(ed.doc).includes("Lén"), "thay đổi của người chỉ đọc bị bỏ");
    close(ed.provider);
    close(obs.provider);
  });

  it("từ chối: không đọc được nhiệm vụ, không có phiên, sai Origin", async () => {
    const task = await makeTask(plainTextToContent("Riêng tư"));
    const out = await connect(outsider, task.id);
    assert.equal(out.result, "denied:forbidden");
    close(out.provider);

    const anon = await connect(null, task.id);
    assert.equal(anon.result, "denied:unauthenticated");
    close(anon.provider);

    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(url, { headers: { origin: "https://evil.example", cookie: editor.cookie } });
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => resolve(101));
      ws.on("error", () => undefined);
    });
    assert.equal(status, 403);
  });

  it("PATCH mô tả khi đang có người mở: người đó thấy bản mới; không ai mở thì quên trạng thái cũ", async () => {
    const task = await makeTask(plainTextToContent("Trước PATCH"));
    const ed = await connect(editor, task.id);
    await syncCollabAfterDescriptionPatch(task.id, plainTextToContent("Sau PATCH"), editor.id);
    await waitFor(() => rootText(ed.doc) === "Sau PATCH", "người đang mở thấy mô tả mới");
    close(ed.provider);
    await waitFor(async () => Boolean(await prisma.taskCollabDocument.findUnique({ where: { taskId: task.id } })), "đã lưu");
    await waitFor(async () => !(await getCollabServer())?.hocuspocus.documents.has(`task:${task.id}`), "đã gỡ khỏi bộ nhớ");

    await syncCollabAfterDescriptionPatch(task.id, plainTextToContent("Lần hai"), editor.id);
    assert.equal(await prisma.taskCollabDocument.findUnique({ where: { taskId: task.id } }), null);
  });
});
