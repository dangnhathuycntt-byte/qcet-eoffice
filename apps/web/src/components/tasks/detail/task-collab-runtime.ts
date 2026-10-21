import { YjsPlugin } from "@platejs/yjs/react";
import type { PlateEditor } from "platejs/react";
import type { CollabPeer, TaskEditorCollabOptions } from "./task-block-editor";

/**
 * Phần chạy của cùng sửa (ADR-014), tách khỏi `task-block-editor` để chỉ tải khi cờ `taskCollab` bật: `@platejs/yjs` kéo theo
 * yjs, lib0, Hocuspocus, y-webrtc, simple-peer, y-indexeddb (≥ 760KB ở bản dev), mà editor được tải trước ở mọi trang có hộp tạo
 * việc (người dùng báo web chậm 22/10/2026). `TaskDescriptionEditor` import động module này rồi truyền vào `collab.runtime`.
 */
export type TaskCollabRuntime = typeof import("./task-collab-runtime");

/** Plugin Yjs với provider Hocuspocus của tài liệu. `onSyncChange` đọc callback mới nhất qua hàm bọc của editor. */
export function collabPlugin(options: TaskEditorCollabOptions, onSyncChange: (synced: boolean) => void) {
  return YjsPlugin.configure({
    options: {
      cursors: { data: options.user },
      providers: [
        {
          type: "hocuspocus",
          // Provider Hocuspocus 3 tự nối ngay khi tạo, rồi `init` của Plate gọi `connect()` lần nữa: kết nối đầu bị bỏ
          // giữa chừng ("closed before the connection is established"). Để `init` nối một lần.
          options: { name: options.documentName, url: options.url, autoConnect: false },
        },
      ],
      onSyncChange: ({ isSynced }: { isSynced: boolean }) => onSyncChange(isSynced),
    },
  });
}

/**
 * Nối máy chủ cộng tác, trả hàm gỡ. StrictMode chạy effect hai lần (gắn → gỡ → gắn) trên cùng editor: tạo provider ngay thì lần
 * gỡ đầu để lại kết nối dở ("already connected"), nên hoãn một nhịp để lần gỡ đầu hủy trước khi có provider nào.
 */
export function connectCollab(editor: PlateEditor, options: TaskEditorCollabOptions): () => void {
  const api = editor.getApi(YjsPlugin).yjs;
  const awareness = editor.getOption(YjsPlugin, "awareness");
  // Awareness đổi mỗi lần ai đó di con trỏ (cả của chính mình): chỉ báo khi danh sách người đổi, kẻo render lại theo từng phím
  let lastPeersKey = "";
  const reportPeers = () => {
    if (!awareness) return;
    const seen = new Set<string>();
    const peers: CollabPeer[] = [];
    awareness.getStates().forEach((state, clientId) => {
      const data = (state as { data?: { id?: string; name?: string; color?: string } }).data;
      if (clientId === awareness.clientID || !data?.id || data.id === options.user.id || seen.has(data.id)) return;
      seen.add(data.id);
      peers.push({ clientId, userId: data.id, name: data.name || "Người dùng", color: data.color || "" });
    });
    const key = peers.map((peer) => `${peer.userId}:${peer.name}`).join("|");
    if (key === lastPeersKey) return;
    lastPeersKey = key;
    options.onPeersChange?.(peers);
  };
  awareness?.on("change", reportPeers);
  let started = false;
  const timer = window.setTimeout(() => {
    started = true;
    void api.init({ id: options.documentName, value: null, autoSelect: false });
  }, 0);
  return () => {
    window.clearTimeout(timer);
    awareness?.off("change", reportPeers);
    // Chưa init (lần gỡ đầu của StrictMode) thì không có gì để hủy: `destroy` lúc đó gỡ trình nghe chưa gắn, yjs báo lỗi
    if (!started) return;
    // `destroy` của @platejs/yjs chỉ ngắt provider đã kết nối xong; hủy hẳn provider Hocuspocus (cả kết nối đang mở dở) để
    // rời trang không để lại kết nối và "người đang mở" ảo
    const providers = editor.getOption(YjsPlugin, "_providers") as Array<{ provider?: { destroy?: () => void } }>;
    api.destroy();
    for (const wrapper of providers ?? []) wrapper.provider?.destroy?.();
  };
}
