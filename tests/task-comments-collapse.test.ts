import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isCommentListCollapsed } from "../src/components/tasks/detail/task-comments";

// Lựa chọn "thu gọn bình luận" lưu chung trong localStorage. Nhiệm vụ chưa có bình luận không có nút mở lại,
// nên trước đây ô viết bình luận biến mất hẳn (chỉ còn đường kẻ dưới tiêu đề).
describe("Bình luận nhiệm vụ: thu gọn", () => {
  test("chưa có bình luận thì không thu gọn dù người dùng từng thu gọn ở nhiệm vụ khác", () => {
    assert.equal(isCommentListCollapsed(true, 0), false);
  });

  test("đã có bình luận thì theo lựa chọn thu gọn của người dùng", () => {
    assert.equal(isCommentListCollapsed(true, 2), true);
    assert.equal(isCommentListCollapsed(false, 2), false);
    assert.equal(isCommentListCollapsed(false, 0), false);
  });
});
