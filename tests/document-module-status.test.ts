import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

describe("Document Module Status & Roadmap Landing Test Suite", () => {
  const sidebarPath = path.join(process.cwd(), "src/components/layout/app-sidebar.tsx");
  const sidebarContextPath = path.join(process.cwd(), "src/components/layout/sidebar-context.tsx");
  const topbarPath = path.join(process.cwd(), "src/components/layout/app-topbar.tsx");
  const mobileDrawerPath = path.join(process.cwd(), "src/components/layout/mobile-menu-drawer.tsx");
  const documentsPagePath = path.join(process.cwd(), "src/app/documents/page.tsx");

  test("All target files exist on disk", () => {
    assert.ok(fs.existsSync(sidebarPath), "app-sidebar.tsx must exist");
    assert.ok(fs.existsSync(sidebarContextPath), "sidebar-context.tsx must exist");
    assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
    assert.ok(fs.existsSync(mobileDrawerPath), "mobile-menu-drawer.tsx must exist");
    assert.ok(fs.existsSync(documentsPagePath), "documents/page.tsx must exist");
  });

  describe("Sidebar Navigation Items & Badge Indicator", () => {
    test("sidebar-context.tsx marks documents module or item as isComingSoon", () => {
      const content = fs.readFileSync(sidebarContextPath, "utf-8");
      assert.ok(
        content.includes("isComingSoon"),
        "sidebar-context.tsx must include isComingSoon flag"
      );
      // Ensure documents item has isComingSoon: true
      const hasDocumentsComingSoon =
        content.includes('id: "documents"') &&
        content.includes("isComingSoon: true");
      assert.ok(hasDocumentsComingSoon, "Documents navigation item must be flagged with isComingSoon: true");
    });

    test("app-sidebar.tsx renders 'Đang phát triển' badge for coming soon items", () => {
      const content = fs.readFileSync(sidebarPath, "utf-8");
      assert.ok(
        content.includes("Đang phát triển"),
        "app-sidebar.tsx must render 'Đang phát triển' label"
      );
      assert.ok(
        content.includes("amber-500"),
        "app-sidebar.tsx must style the coming soon badge with amber theme"
      );
    });
  });

  describe("Topbar Breadcrumbs Indicator", () => {
    test("app-topbar.tsx displays 'Đang phát triển' badge when on documents route", () => {
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(
        content.includes('pathname.startsWith("/documents")') ||
        content.includes('pathname?.startsWith("/documents")'),
        "app-topbar.tsx must check for /documents route"
      );
      assert.ok(
        content.includes("Đang phát triển"),
        "app-topbar.tsx must render 'Đang phát triển' badge in breadcrumbs"
      );
    });
  });

  describe("Mobile Navigation & Drawer Indicator", () => {
    test("mobile-menu-drawer.tsx renders 'Đang phát triển' next to documents navigation", () => {
      const content = fs.readFileSync(mobileDrawerPath, "utf-8");
      assert.ok(
        content.includes("Văn bản & Điều hành") || content.includes("/documents"),
        "mobile-menu-drawer.tsx must contain documents link"
      );
      assert.ok(
        content.includes("Đang phát triển"),
        "mobile-menu-drawer.tsx must display 'Đang phát triển' badge next to documents"
      );
    });
  });

  describe("Documents Roadmap Landing Page (/documents)", () => {
    test("src/app/documents/page.tsx renders roadmap banner and retain DocumentRegistryView in Suspense", () => {
      const content = fs.readFileSync(documentsPagePath, "utf-8");

      // Must retain Suspense and DocumentRegistryView for existing features
      assert.ok(content.includes("React.Suspense"), "Must wrap view in React.Suspense");
      assert.ok(content.includes("DocumentRegistryView"), "Must continue to mount DocumentRegistryView");

      // Roadmap banner elements
      assert.ok(
        content.includes("LỘ TRÌNH GIAI ĐOẠN 2") || content.includes("ĐANG PHÁT TRIỂN"),
        "Page must display roadmap phase badge ('LỘ TRÌNH GIAI ĐOẠN 2' / 'ĐANG PHÁT TRIỂN')"
      );
      assert.ok(
        content.includes("Phân hệ Quản lý & Lưu trữ Văn bản (Đang hoàn thiện)"),
        "Page must have heading 'Phân hệ Quản lý & Lưu trữ Văn bản (Đang hoàn thiện)'"
      );
      assert.ok(
        content.includes("Hệ thống hiện đang tập trung toàn lực vận hành Phân hệ Quản lý & Điều hành Công việc"),
        "Page must explain roadmap focus on Task Management"
      );
      assert.ok(
        content.includes("Nghị định 30/2020/NĐ-CP"),
        "Page must reference integration with Decree 30/2020/ND-CP"
      );
      assert.ok(
        content.includes("Quay lại Bàn làm việc công việc"),
        "Page must provide action button 'Quay lại Bàn làm việc công việc'"
      );
      assert.ok(
        content.includes('href="/?zone=tasks"') || content.includes('href="/"'),
        "Action button must link back to task hub"
      );
    });
  });

  describe("Zero Emoji Compliance Rule", () => {
    test("Target source files contain 0% emojis (100% Lucide icons)", () => {
      const filesToCheck = [
        sidebarPath,
        sidebarContextPath,
        topbarPath,
        mobileDrawerPath,
        documentsPagePath,
      ];

      for (const file of filesToCheck) {
        const content = fs.readFileSync(file, "utf-8");
        const match = EMOJI_REGEX.exec(content);
        assert.equal(
          match,
          null,
          `File ${path.basename(file)} must not contain emojis. Found: ${match?.[0]}`
        );
      }
    });
  });
});
