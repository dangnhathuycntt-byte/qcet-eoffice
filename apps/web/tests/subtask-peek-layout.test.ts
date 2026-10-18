import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampPeekWidth,
  DEFAULT_PEEK_WIDTH,
  SINGLE_PEEK_WIDTH,
  MIN_PEEK_WIDTH,
  MAX_PEEK_WIDTH,
} from "../src/components/tasks/detail/subtask-peek-layout";

describe("Giới hạn chiều rộng việc con", () => {
  it("giữ nguyên các kích thước mặc định hiện tại", () => {
    assert.equal(DEFAULT_PEEK_WIDTH, 480);
    assert.equal(SINGLE_PEEK_WIDTH, 480);
    assert.equal(MIN_PEEK_WIDTH, 380);
    assert.equal(MAX_PEEK_WIDTH, 960);
  });

  it("giữ nguyên chiều rộng hợp lệ, kể cả phần thập phân", () => {
    assert.equal(clampPeekWidth(650.5, 1440), 650.5);
  });

  it("giới hạn theo chiều rộng tối thiểu và tối đa", () => {
    assert.equal(clampPeekWidth(200, 1920), MIN_PEEK_WIDTH);
    assert.equal(clampPeekWidth(1200, 1920), MAX_PEEK_WIDTH);
  });

  it("giới hạn theo 75% viewport khi viewport hẹp hơn", () => {
    assert.equal(clampPeekWidth(900, 1024), 768);
  });

  it("giữ ưu tiên kích thước tối thiểu trên viewport rất hẹp", () => {
    assert.equal(clampPeekWidth(500, 400), MIN_PEEK_WIDTH);
  });
});
