/**
 * Máy chủ cộng tác (Hocuspocus 3) chạy trong process qcet-api, cổng riêng `COLLAB_PORT` (mặc định 3101) trên `COLLAB_HOST`
 * (mặc định 127.0.0.1; container đặt 0.0.0.0, không publish cổng). ADR-014.
 *
 * Tự dựng http + ws thay vì lớp `Server` của Hocuspocus: `Server.listen` truyền `address` cho `http.Server.listen` (Node bỏ qua,
 * phải là `host`) nên nghe mọi giao diện, và `stopOnSignals` gọi `process.exit` khi SIGTERM, cắt ngang tắt máy êm.
 * Singleton trên `globalThis`: route handler (PATCH mô tả) dùng chung bản do instrumentation khởi động; các gói Yjs nằm trong
 * `serverExternalPackages` để hai bên cùng một bản `yjs`.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import { Hocuspocus } from "@hocuspocus/server";
import { logger } from "@/server/observability/logger";
import { authorizeCollabConnection, isAllowedCollabOrigin, parseCollabDocumentName } from "./collab-auth";
import { loadCollabDocument, storeCollabDocument } from "./collab-persistence";

/** Bằng giới hạn thân yêu cầu của middleware (12 MB); ảnh, tệp nằm ở /api/upload, tài liệu chỉ giữ đường dẫn. */
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;
const GLOBAL_KEY = "__qcetCollabServer";

export interface CollabServer {
  hocuspocus: Hocuspocus;
  port: number;
  stop(): Promise<void>;
}

type CollabGlobal = typeof globalThis & { [GLOBAL_KEY]?: Promise<CollabServer> };

function taskIdOf(documentName: string): string {
  const taskId = parseCollabDocumentName(documentName);
  if (!taskId) throw new Error(`collab-invalid-document: ${documentName}`);
  return taskId;
}

export function createCollabHocuspocus(): Hocuspocus {
  return new Hocuspocus({
    name: "qcet-collab",
    quiet: true,
    // Mặc định của Hocuspocus: lưu sau 2 giây ngừng gõ, gõ liên tục thì tối đa 10 giây một lần
    debounce: 2000,
    maxDebounce: 10000,
    async onAuthenticate(data) {
      const access = await authorizeCollabConnection({
        documentName: data.documentName,
        requestHeaders: data.requestHeaders,
      });
      data.connectionConfig.readOnly = access.readOnly;
      return { userId: access.userId };
    },
    async onLoadDocument({ document, documentName }) {
      await loadCollabDocument(document, taskIdOf(documentName));
    },
    async onStoreDocument({ document, documentName, context }) {
      const userId = typeof context?.userId === "string" ? context.userId : null;
      try {
        await storeCollabDocument(document, taskIdOf(documentName), userId);
      } catch (error) {
        logger.error("collab.store.error", { metadata: { documentName } }, error);
        throw error;
      }
    },
  });
}

async function listen(port: number, host: string): Promise<CollabServer> {
  const hocuspocus = createCollabHocuspocus();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  const httpServer = http.createServer((_req, res) => {
    res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Upgrade Required");
  });
  httpServer.on("upgrade", (request, socket, head) => {
    // Chặn sớm WebSocket từ trang khác trước khi giữ kết nối; quyền từng tài liệu kiểm ở onAuthenticate
    if (!isAllowedCollabOrigin(request.headers)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.on("error", (error) => logger.warn("collab.socket.error", { metadata: { message: error.message } }));
      hocuspocus.handleConnection(ws, request);
    });
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  const stop = async () => {
    // Như Server.destroy của Hocuspocus: đóng kết nối, chờ các tài liệu lưu xong và gỡ khỏi bộ nhớ (tối đa 5 giây)
    httpServer.close();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      hocuspocus.configuration.extensions.push({
        async afterUnloadDocument({ instance }) {
          if (instance.getDocumentsCount() === 0) done();
        },
      });
      wss.close();
      if (hocuspocus.getDocumentsCount() === 0) done();
      hocuspocus.closeConnections();
    });
  };

  return { hocuspocus, port: (httpServer.address() as AddressInfo).port, stop };
}

/** Khởi động (một lần mỗi process) và trả máy chủ; gọi lại thì nhận đúng bản đang chạy. */
export function startCollabServer(options: { port?: number; host?: string } = {}): Promise<CollabServer> {
  const g = globalThis as CollabGlobal;
  if (!g[GLOBAL_KEY]) {
    const port = options.port ?? Number(process.env.COLLAB_PORT || 3101);
    const host = options.host ?? (process.env.COLLAB_HOST || "127.0.0.1");
    g[GLOBAL_KEY] = listen(port, host).then(
      (server) => {
        logger.info("collab.listen", { metadata: { host, port: server.port } });
        return server;
      },
      (error) => {
        delete g[GLOBAL_KEY];
        throw error;
      },
    );
  }
  return g[GLOBAL_KEY]!;
}

/** Máy chủ đang chạy trong process này, hoặc null (cờ tắt, chưa khởi động). */
export async function getCollabServer(): Promise<CollabServer | null> {
  const pending = (globalThis as CollabGlobal)[GLOBAL_KEY];
  if (!pending) return null;
  return pending.catch(() => null);
}

/** Dừng và quên singleton (tắt máy, test). */
export async function stopCollabServer(): Promise<void> {
  const g = globalThis as CollabGlobal;
  const server = await getCollabServer();
  delete g[GLOBAL_KEY];
  await server?.stop();
}
