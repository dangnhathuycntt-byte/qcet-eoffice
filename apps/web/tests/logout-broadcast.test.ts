import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { broadcastLogout, onLogoutBroadcast } from "../src/lib/logout-broadcast";

const nextMessage = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("Đăng xuất ở một tab báo cho các tab khác", () => {
  it("nơi nghe nhận tin đăng xuất; hủy nghe rồi thì không nhận nữa", async () => {
    let received = 0;
    const stop = onLogoutBroadcast(() => {
      received += 1;
    });
    broadcastLogout();
    await nextMessage();
    assert.equal(received, 1);

    stop();
    broadcastLogout();
    await nextMessage();
    assert.equal(received, 1);
  });

  it("tin khác trên cùng kênh không bị coi là đăng xuất", async () => {
    let received = 0;
    const stop = onLogoutBroadcast(() => {
      received += 1;
    });
    const other = new BroadcastChannel("qcet-auth");
    other.postMessage("ping");
    other.close();
    await nextMessage();
    stop();
    assert.equal(received, 0);
  });
});
