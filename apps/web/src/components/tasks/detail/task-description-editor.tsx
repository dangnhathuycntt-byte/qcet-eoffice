"use client";

import * as React from "react";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useRuntimeFeature } from "@/lib/runtime-features";
import { TaskBlockEditor, type CollabPeer, type TaskBlockEditorProps, type TaskEditorCollabOptions } from "./task-block-editor";
import type { TaskCollabRuntime } from "./task-collab-runtime";

/** Quá lâu chưa đồng bộ được với máy chủ cộng tác thì báo và cho thử lại (vẫn xem được bản mô tả đã lưu). */
const SYNC_STALL_MS = 10_000;

/** Màu nhận diện người cùng sửa, chọn theo id cho ổn định giữa các lần mở (dữ liệu awareness, không phải lớp CSS). */
const PEER_COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[hash % PEER_COLORS.length];
}

function collabUrl(): string {
  return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/collab`;
}

interface TaskDescriptionEditorProps extends Omit<TaskBlockEditorProps, "collab"> {
  currentUser?: { id?: string | null; name?: string | null } | null;
}

/**
 * Ô mô tả của nhiệm vụ đã có (trang chi tiết, ngăn việc con). Cờ `taskCollab` bật thì nhiều người cùng sửa trực tiếp (ADR-014),
 * tắt thì editor lưu qua PATCH như cũ. Cờ tải sau lần render đầu nên editor có thể đổi chế độ một lần ngay khi mở.
 */
export function TaskDescriptionEditor({ currentUser, ...props }: TaskDescriptionEditorProps) {
  const collabEnabled = useRuntimeFeature("taskCollab");
  if (!collabEnabled || !currentUser?.id) return <TaskBlockEditor {...props} />;
  return (
    <CollaborativeDescription
      key={props.taskId}
      {...props}
      user={{ id: currentUser.id, name: currentUser.name || "Người dùng" }}
    />
  );
}

/**
 * Trước lần đồng bộ đầu, hiện mô tả đã lưu ở chế độ chỉ xem (editor cộng tác gắn ẩn bên dưới); không cho gõ vào tài liệu chưa
 * đồng bộ. Đồng bộ rồi thì giữ editor cộng tác cả khi rớt mạng: chữ gõ lúc mất kết nối nằm trong tab và gộp khi nối lại.
 */
function CollaborativeDescription({
  user,
  ...props
}: Omit<TaskBlockEditorProps, "collab"> & { user: { id: string; name: string } }) {
  const [attempt, setAttempt] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [synced, setSynced] = React.useState(false);
  const [stalled, setStalled] = React.useState(false);
  const [peers, setPeers] = React.useState<CollabPeer[]>([]);
  // Phần Yjs chỉ tải khi cờ bật (≥ 760KB): trong lúc tải vẫn hiện mô tả đã lưu ở chế độ chỉ xem như lúc chờ đồng bộ
  const [runtime, setRuntime] = React.useState<TaskCollabRuntime | null>(null);

  React.useEffect(() => {
    if (runtime) return;
    let cancelled = false;
    // Tải hỏng (mất mạng) thì để cảnh báo "Chưa kết nối được" sau 10 s; "Thử lại" tải lại
    import("./task-collab-runtime").then((mod) => !cancelled && setRuntime(mod), () => {});
    return () => {
      cancelled = true;
    };
  }, [runtime, attempt]);

  React.useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setStalled(true), SYNC_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [ready, attempt]);

  const collab = React.useMemo<TaskEditorCollabOptions | null>(
    () => runtime && ({
      runtime,
      documentName: `task:${props.taskId}`,
      url: collabUrl(),
      user: { id: user.id, name: user.name, color: colorFor(user.id) },
      onSyncChange: (isSynced) => {
        setSynced(isSynced);
        if (isSynced) {
          setReady(true);
          setStalled(false);
        }
      },
      onPeersChange: setPeers,
    }),
    // Mỗi lần thử lại là một editor mới (key) với tùy chọn mới
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.taskId, user.id, user.name, attempt, runtime],
  );

  const retry = () => {
    setStalled(false);
    setPeers([]);
    setAttempt((value) => value + 1);
  };

  return (
    <div data-slot="task-description-collab" className="flex min-h-0 flex-1 flex-col">
      {(peers.length > 0 || (ready && !synced)) && (
        <div className="flex h-5 items-center justify-end gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {ready && !synced ? (
            <span>Mất kết nối, đang nối lại…</span>
          ) : (
            <>
              <span>Đang cùng sửa</span>
              <span className="flex -space-x-1">
                {peers.map((peer) => (
                  <Tooltip key={peer.userId}>
                    <TooltipTrigger asChild>
                      <UserAvatar size="xs" name={peer.name} className="ring-2 ring-background" />
                    </TooltipTrigger>
                    <TooltipContent>{peer.name}</TooltipContent>
                  </Tooltip>
                ))}
              </span>
            </>
          )}
        </div>
      )}
      {stalled && !ready && (
        <InlineAlert variant="warning" actionLabel="Thử lại" onAction={retry} className="mb-2">
          Chưa kết nối được máy chủ cùng sửa. Mô tả đang ở chế độ chỉ xem.
        </InlineAlert>
      )}
      {!ready && <TaskBlockEditor {...props} canEdit={false} globalFileDrop={false} />}
      {collab && (
        <div className={ready ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <TaskBlockEditor key={attempt} {...props} collab={collab} />
        </div>
      )}
    </div>
  );
}
