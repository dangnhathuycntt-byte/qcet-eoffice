/**
 * Đăng xuất ở một tab thì các tab khác cùng trình duyệt cũng rời trang đang mở: máy dùng chung không còn tab hiện dữ liệu của người
 * vừa đăng xuất. Tab đang nằm trong bfcache nhận tin thì bị trình duyệt loại khỏi bfcache, bấm Back không khôi phục lại được.
 * Kênh `BroadcastChannel` không gửi lại cho chính đối tượng đã gửi, nhưng có gửi cho đối tượng khác trong cùng tab: nơi nghe tự bỏ qua
 * khi chính tab đó đang đăng xuất.
 */
const CHANNEL_NAME = "qcet-auth";
const LOGOUT_MESSAGE = "logout";

export function broadcastLogout(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(LOGOUT_MESSAGE);
  channel.close();
}

/** Nghe tin đăng xuất từ tab khác; trả về hàm hủy nghe. */
export function onLogoutBroadcast(handler: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent) => {
    if (event.data === LOGOUT_MESSAGE) handler();
  };
  return () => channel.close();
}
