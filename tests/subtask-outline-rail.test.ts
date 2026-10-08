import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubtaskOutlineRail } from "../src/components/tasks/detail/subtask-outline-rail";
import type { StaffTask } from "../src/types/dashboard";

const subs = [
  { id: "s1", title: "Soạn kế hoạch", status: "IN_PROGRESS", description: "Chuẩn bị bản nháp đầu tiên" },
  { id: "s2", title: "Duyệt kế hoạch", status: "COMPLETED" },
  { id: "s3", title: "Công bố", status: "NOT_STARTED" },
] as unknown as StaffTask[];

describe("SubtaskOutlineRail", () => {
  it("không hiển thị khi không có việc con", () => {
    const html = renderToStaticMarkup(
      React.createElement(SubtaskOutlineRail, { subTasks: [], onSelectSubtask: () => {} })
    );
    assert.equal(html, "");
  });

  it("mỗi việc con có một vạch, thẻ xem nhanh chỉ hiện khi lướt", () => {
    const html = renderToStaticMarkup(
      React.createElement(SubtaskOutlineRail, { subTasks: subs, activeSubtaskId: "s2", onSelectSubtask: () => {} })
    );
    assert.equal((html.match(/aria-label="Mở việc con: /g) ?? []).length, 3);
    for (const s of subs) assert.ok(html.includes(s.title));
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
    // Thẻ xem nhanh chỉ hiện khi lướt tới một vạch (một thẻ duy nhất bám theo con trỏ)
    assert.ok(!html.includes('role="tooltip"'), "thẻ xem nhanh ẩn khi chưa lướt");
    assert.equal((html.match(/data-tick-id=/g) ?? []).length, 3);
  });
});
