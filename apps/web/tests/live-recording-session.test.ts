import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { LiveRecordingSession, micBlockedByPolicy } from "../src/components/meetings/live-recording-session";

/** Dựng môi trường trình duyệt tối thiểu cho `LiveRecordingSession.start` trong Node. */
function stubBrowser(options: { microphoneAllowed?: boolean; getUserMedia: () => Promise<unknown> }) {
  const g = globalThis as Record<string, unknown>;
  g.MediaRecorder = { isTypeSupported: () => true };
  Object.defineProperty(globalThis, "navigator", { value: { mediaDevices: { getUserMedia: options.getUserMedia } }, configurable: true });
  g.document =
    options.microphoneAllowed === undefined
      ? {}
      : { permissionsPolicy: { allowsFeature: (feature: string) => (feature === "microphone" ? options.microphoneAllowed : true) } };
}

const originals = {
  MediaRecorder: (globalThis as Record<string, unknown>).MediaRecorder,
  document: (globalThis as Record<string, unknown>).document,
  navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
};

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  g.MediaRecorder = originals.MediaRecorder;
  g.document = originals.document;
  if (originals.navigator) Object.defineProperty(globalThis, "navigator", originals.navigator);
});

describe("Ghi âm trực tiếp: micro bị chặn", () => {
  it("chính sách quyền của trang chặn micro thì báo lỗi cấu hình, không bảo người dùng bấm ổ khóa, và không xin micro", async () => {
    let asked = 0;
    stubBrowser({ microphoneAllowed: false, getUserMedia: async () => void asked++ });
    assert.equal(micBlockedByPolicy(), true);
    await assert.rejects(LiveRecordingSession.start("m1"), (error: Error) => {
      assert.match(error.message, /chưa được cấu hình cho phép micro/);
      assert.match(error.message, /báo quản trị/);
      assert.doesNotMatch(error.message, /ổ khóa/);
      return true;
    });
    assert.equal(asked, 0, "không gọi getUserMedia khi chính sách đã chặn");
  });

  it("người dùng từ chối quyền (trang cho phép micro) thì vẫn hướng dẫn mở ổ khóa", async () => {
    stubBrowser({
      microphoneAllowed: true,
      getUserMedia: async () => {
        throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      },
    });
    assert.equal(micBlockedByPolicy(), false);
    await assert.rejects(LiveRecordingSession.start("m1"), /ổ khóa/);
  });

  it("trình duyệt không có permissionsPolicy (Firefox, Safari) thì không coi là bị chặn", () => {
    stubBrowser({ getUserMedia: async () => ({}) });
    assert.equal(micBlockedByPolicy(), false);
  });
});
