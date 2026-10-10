import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cn } from "../src/lib/utils";

describe("cn với cỡ chữ tùy biến của theme", () => {
  it("giữ text-compact khi đi cùng màu chữ", () => {
    assert.equal(cn("text-compact text-foreground"), "text-compact text-foreground");
    assert.equal(cn("text-hero", "text-muted-foreground"), "text-hero text-muted-foreground");
  });

  it("vẫn gộp đúng khi hai cỡ chữ xung đột: cỡ sau thắng", () => {
    assert.equal(cn("text-compact", "text-xs"), "text-xs");
    assert.equal(cn("text-xs", "text-compact"), "text-compact");
  });
});
