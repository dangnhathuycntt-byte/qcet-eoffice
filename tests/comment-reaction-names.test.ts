/**
 * Chú thích người đã thả emoji: "Bạn" đứng đầu, nhiều người thì gộp "và N người khác".
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { joinReactionNames, reactionNamesLabel } from "@qcet/shared/domain/tasks/comment-reactions";

const label = (names: string[], reacted: boolean, limit?: number) =>
  joinReactionNames(reactionNamesLabel({ names, reacted }, "Huy", limit));
const many = (n: number) => Array.from({ length: n }, (_, i) => `Người ${i + 1}`);

describe("Chú thích người thả emoji", () => {
  test("một và hai người", () => {
    assert.equal(label(["Nhật Huy"], false), "Nhật Huy");
    assert.equal(label(["An", "Bình"], false), "An và Bình");
  });

  test("người xem đứng đầu và được gọi là Bạn, kể cả khi thả sau cùng", () => {
    assert.equal(label(["An", "Huy"], true), "Bạn và An");
    assert.equal(label(["An", "Bình", "Huy"], true), "Bạn, An và Bình");
    assert.equal(label(["Huy"], true), "Bạn");
  });

  test("nhiều người: chỉ hiện tối đa limit tên rồi gộp phần dư", () => {
    assert.equal(label(many(10), false, 3), "Người 1, Người 2, Người 3 và 7 người khác");
    assert.deepEqual(reactionNamesLabel({ names: many(10), reacted: false }, "Huy", 3).rest, 7);
  });

  test("dư đúng một người thì nói thẳng tên, không viết '1 người khác'", () => {
    assert.equal(label(many(4), false, 3), "Người 1, Người 2, Người 3 và Người 4");
  });

  test("người xem không thả thì không bị đổi tên trùng", () => {
    assert.equal(label(["Huy"], false), "Huy");
  });
});
