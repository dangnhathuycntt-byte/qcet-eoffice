import { describe, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Check } from "lucide-react";
import { ListToolbarFilterPopover } from "../src/components/ui/list-toolbar";

const categories = [
  {
    id: "status",
    label: "Trạng thái",
    Icon: Check,
    options: [{ value: "ALL", label: "Tất cả" }],
    value: "ALL",
    onSelect: () => {},
  },
];

function render(activeCount: number) {
  return renderToStaticMarkup(
    React.createElement(ListToolbarFilterPopover, {
      open: false,
      onOpenChange: () => {},
      categories,
      activeCount,
      onClear: () => {},
      ariaLabel: "Bộ lọc văn bản",
    })
  );
}

describe("ListToolbarFilterPopover (bộ lọc dùng chung với trang Nhiệm vụ)", () => {
  test("nút lọc báo đang lọc bằng chấm, không bằng số", () => {
    const idle = render(0);
    const active = render(2);

    assert.ok(idle.includes('aria-label="Bộ lọc văn bản"'));
    assert.ok(!idle.includes("bg-primary"), "không lọc thì không có chấm");
    assert.ok(active.includes("bg-primary"), "đang lọc thì có chấm");
    assert.ok(!active.includes(">2<"), "không hiện số trên nút để bề rộng không đổi");
  });
});
