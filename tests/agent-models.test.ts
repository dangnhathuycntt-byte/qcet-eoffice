/**
 * Danh sách model chọn được ở ô soạn của Trợ lý và Agent tạo nhiệm vụ: máy chủ và giao diện dùng cùng hàm, model mặc
 * định luôn đứng đầu. Kèm câu báo giới hạn tệp đính kèm của hai nơi.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  agentModelLabel,
  isAllowedAgentModel,
  parseAgentModels,
  resolveAgentModel,
} from "../src/domain/agent/agent-models";
import { ASSISTANT_ATTACHMENT_WORDING, checkTaskAgentAttachments } from "../src/domain/tasks/task-agent-attachments";

describe("Model của Trợ lý và Agent tạo nhiệm vụ", () => {
  test("model mặc định đứng đầu, bỏ trùng, bỏ mã sai dạng và khoảng trắng", () => {
    const catalog = parseAgentModels(" opus-4.6 , sonnet-4.6,,gemini-3.8-flash, có dấu, x;rm ,opus-4.6", "sonnet-4.6");
    assert.deepEqual(catalog?.models.map((m) => m.id), ["sonnet-4.6", "opus-4.6", "gemini-3.8-flash"]);
    assert.equal(catalog?.defaultModel, "sonnet-4.6");
    assert.deepEqual(catalog?.models.map((m) => m.label), ["Claude Sonnet 4.6", "Claude Opus 4.6", "Gemini 3.8 Flash"]);
  });

  test("không đặt TASK_AGENT_MODELS: chỉ model mặc định (bộ chọn ẩn); thiếu TASK_AGENT_MODEL: không có danh sách", () => {
    assert.deepEqual(parseAgentModels(undefined, "sonnet-4.6")?.models.map((m) => m.id), ["sonnet-4.6"]);
    assert.equal(parseAgentModels("opus-4.6", undefined), null);
    assert.equal(parseAgentModels("opus-4.6", "   "), null);
  });

  test("máy chủ chỉ nhận đúng mã trong danh sách, phân biệt hoa thường", () => {
    const catalog = parseAgentModels("opus-4.6", "sonnet-4.6");
    assert.equal(isAllowedAgentModel(catalog, "opus-4.6"), true);
    assert.equal(isAllowedAgentModel(catalog, "sonnet-4.6"), true);
    assert.equal(isAllowedAgentModel(catalog, "Opus-4.6"), false);
    assert.equal(isAllowedAgentModel(catalog, "gemini-3.8-flash"), false);
    assert.equal(isAllowedAgentModel(null, "sonnet-4.6"), false);
  });

  test("model nhớ ở trình duyệt không còn trong danh sách thì về model mặc định", () => {
    const catalog = parseAgentModels("opus-4.6", "sonnet-4.6");
    assert.equal(resolveAgentModel(catalog, "opus-4.6"), "opus-4.6");
    assert.equal(resolveAgentModel(catalog, "gemini-3.8-flash"), "sonnet-4.6");
    assert.equal(resolveAgentModel(catalog, null), "sonnet-4.6");
    assert.equal(resolveAgentModel(null, "opus-4.6"), null);
  });

  test("Trợ lý báo giới hạn tệp theo lượt hỏi; Agent tạo nhiệm vụ giữ câu theo cuộc trò chuyện", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `a-${i}.png`, size: 10 }));
    assert.equal(checkTaskAgentAttachments(six, ASSISTANT_ATTACHMENT_WORDING), "Mỗi lượt hỏi đính kèm tối đa 5 tệp.");
    assert.equal(checkTaskAgentAttachments(six), "Mỗi cuộc trò chuyện đính kèm tối đa 5 tệp.");
    assert.match(checkTaskAgentAttachments([{ name: "a.exe", size: 1 }], ASSISTANT_ATTACHMENT_WORDING) ?? "", /Trợ lý nhận ảnh PNG/);
  });

  test("hai mã cùng tên hiển thị (biệt danh và mã đầy đủ) thì mã sau ghi kèm mã, bộ chọn không có hai dòng trùng", () => {
    const catalog = parseAgentModels("claude-opus-4-6-thinking,claude-sonnet-4-6", "opus-4.6");
    assert.deepEqual(catalog?.models.map((m) => m.label), ["Claude Opus 4.6", "Claude Opus 4.6 (claude-opus-4-6-thinking)", "Claude Sonnet 4.6"]);
  });

  test("mã chưa có tên hiển thị thì hiện nguyên mã", () => {
    assert.equal(agentModelLabel("grok-4.7"), "grok-4.7");
  });
});
