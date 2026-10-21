import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileMenuButton } from "../src/components/layout/mobile-menu-button";
import { SidebarBadgeContext, type SidebarBadgeCounts } from "../src/components/layout/sidebar-context";

function render(badgeCounts?: SidebarBadgeCounts, props: React.ComponentProps<typeof MobileMenuButton> = {}) {
  const button = React.createElement(MobileMenuButton, props);
  if (!badgeCounts) return renderToStaticMarkup(button);
  return renderToStaticMarkup(
    React.createElement(SidebarBadgeContext.Provider, { value: { badgeCounts, setBadgeCounts: () => {} } }, button)
  );
}

/**
 * Chấm chưa đọc trước chỉ có ở thanh trên cùng chung; trang có header riêng (Ghi chú, Nhiệm vụ, Hộp thư, Trợ lý…) không có
 * (phát hiện khi làm lại badge Hộp thư theo ảnh người dùng 21/10/2026). Chấm nay nằm trong chính nút menu.
 */
describe("Nút menu điện thoại báo Hộp thư còn thông báo chưa đọc", () => {
  it("có thông báo chưa đọc: chấm cạnh icon và tên nút nói số chưa đọc", () => {
    const html = render({ notifications: 3 });
    assert.match(html, /aria-label="Mở menu, 3 thông báo chưa đọc"/);
    assert.match(html, /data-slot="mobile-menu-unread-dot"/);
  });

  it("đọc hết, hoặc nút nằm ngoài khung sidebar (chưa có số): không chấm và không lỗi", () => {
    for (const html of [render({ notifications: 0 }), render()]) {
      assert.match(html, /aria-label="Mở menu"/);
      assert.doesNotMatch(html, /mobile-menu-unread-dot/);
    }
  });

  it("trang tự đặt tên nút thì giữ tên đó", () => {
    assert.match(render({ notifications: 2 }, { "aria-label": "Mở thanh điều hướng" }), /aria-label="Mở thanh điều hướng"/);
  });
});
