import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildPaneSearch, parsePaneParams, planPaneHistory } from "../src/lib/documents/document-pane-history";

describe("Tham số pane trên URL", () => {
  test("parse docId/file; file chỉ có nghĩa khi có docId", () => {
    assert.deepEqual(parsePaneParams("type=inbox&docId=A&file=F"), { docId: "A", file: "F" });
    assert.deepEqual(parsePaneParams("file=F"), { docId: null, file: null });
    assert.deepEqual(parsePaneParams(""), { docId: null, file: null });
  });

  test("ghi docId giữ nguyên bộ lọc/trang; bỏ docId thì bỏ luôn file", () => {
    assert.equal(buildPaneSearch("type=inbox&page=3", { docId: "A" }), "?type=inbox&page=3&docId=A");
    assert.equal(buildPaneSearch("type=inbox&docId=A&file=F", { docId: "B", file: null }), "?type=inbox&docId=B");
    assert.equal(buildPaneSearch("type=inbox&docId=A&file=F", { docId: null }), "?type=inbox");
    assert.equal(buildPaneSearch("docId=A", { docId: null }), "");
    assert.equal(buildPaneSearch("docId=A", { file: "F" }), "?docId=A&file=F");
    assert.equal(buildPaneSearch("type=inbox", { file: "F" }), "?type=inbox");
  });
});

describe("planPaneHistory (SPEC §6.3)", () => {
  const list = { search: "type=inbox", hasPaneMark: false };

  test("mở từ danh sách khi pane đóng: push + đánh dấu", () => {
    assert.deepEqual(planPaneHistory({ type: "open", docId: "A" }, list), { op: "push", search: "?type=inbox&docId=A", mark: true });
  });

  test("đổi văn bản khi pane đang mở: replace, bỏ file, giữ dấu", () => {
    const ctx = { search: "type=inbox&docId=A&file=F", hasPaneMark: true };
    assert.deepEqual(planPaneHistory({ type: "switch-doc", docId: "B" }, ctx), { op: "replace", search: "?type=inbox&docId=B", mark: true });
    assert.deepEqual(planPaneHistory({ type: "open", docId: "B" }, ctx), { op: "replace", search: "?type=inbox&docId=B", mark: true });
  });

  test("đổi tệp: replace, giữ docId", () => {
    const ctx = { search: "docId=A", hasPaneMark: true };
    assert.deepEqual(planPaneHistory({ type: "switch-file", file: "F2" }, ctx), { op: "replace", search: "?docId=A&file=F2", mark: true });
  });

  test("đóng khi entry có dấu: history.back()", () => {
    assert.deepEqual(planPaneHistory({ type: "close" }, { search: "docId=A", hasPaneMark: true }), { op: "back" });
  });

  test("đóng khi vào bằng deep link (không dấu): replace bỏ docId/file, không thoát app", () => {
    assert.deepEqual(planPaneHistory({ type: "close" }, { search: "type=inbox&docId=A&file=F", hasPaneMark: false }), {
      op: "replace",
      search: "?type=inbox",
      mark: false,
    });
  });

  test("mở lại cùng văn bản/tệp đang mở, hoặc đóng khi đã đóng: không làm gì", () => {
    assert.deepEqual(planPaneHistory({ type: "open", docId: "A" }, { search: "docId=A", hasPaneMark: true }), { op: "none" });
    assert.deepEqual(planPaneHistory({ type: "switch-file", file: "F" }, { search: "docId=A&file=F", hasPaneMark: true }), { op: "none" });
    assert.deepEqual(planPaneHistory({ type: "close" }, list), { op: "none" });
    assert.deepEqual(planPaneHistory({ type: "switch-file", file: "F" }, list), { op: "none" });
  });

  test("mở với tệp chỉ định (từ Full Page quay lại / chia sẻ link)", () => {
    assert.deepEqual(planPaneHistory({ type: "open", docId: "A", file: "F" }, list), { op: "push", search: "?type=inbox&docId=A&file=F", mark: true });
  });
});
