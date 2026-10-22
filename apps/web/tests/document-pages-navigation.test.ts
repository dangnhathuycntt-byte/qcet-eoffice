import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SIDEBAR_NAV_GROUPS } from "../src/components/layout/sidebar-nav-list";
import { isCardPagePath, isRouteActive, resolveBreadcrumb } from "../src/lib/navigation/active-matcher";

/**
 * Mục "Hồ sơ công việc" ở sidebar từng trỏ `/documents?tab=dossiers`: tham số lạ nên sổ văn bản hiện "Sổ văn bản" (mọi văn bản)
 * trong khi sidebar tô mục Hồ sơ công việc (22/10/2026). Trang hồ sơ thật là `/dossiers`, dựng trong khung một thẻ như các trang
 * cùng nhóm nên AppShell không vẽ thêm thanh trên cùng và đệm bao ngoài.
 */
describe("điều hướng nhóm Văn bản", () => {
  const dossierItem = SIDEBAR_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === "docs-dossiers");

  it("Hồ sơ công việc mở trang hồ sơ, không mở sổ văn bản", () => {
    assert.ok(dossierItem, "có mục Hồ sơ công việc");
    assert.equal(dossierItem.href, "/dossiers");
    assert.ok(isRouteActive(dossierItem.href, "/dossiers", new URLSearchParams(), dossierItem.aliases));
    assert.ok(!isRouteActive(dossierItem.href, "/documents", new URLSearchParams("type=inbox"), dossierItem.aliases));
  });

  it("trang hồ sơ và báo cáo thời gian duyệt dùng khung một thẻ như các trang cùng nhóm", () => {
    assert.ok(isCardPagePath("/dossiers"));
    assert.ok(isCardPagePath("/documents/approval-report"));
    assert.ok(!isCardPagePath("/dossiers/abc"), "chi tiết hồ sơ giữ khung riêng");
  });

  it("thanh trên cùng (điện thoại) gọi đúng tên báo cáo, không kế thừa tên sổ văn bản", () => {
    assert.equal(resolveBreadcrumb("/documents/approval-report")[1], "Báo cáo thời gian duyệt");
    assert.equal(resolveBreadcrumb("/dossiers")[1], "Hồ sơ công việc");
  });
});
