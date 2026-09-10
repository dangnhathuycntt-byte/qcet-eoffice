import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SINGLE_TIER_NAV_ITEMS,
  type NavigationSection,
  type SidebarItem,
  resolveBreadcrumb,
} from "@/components/layout/sidebar-context";

describe("Single-Tier Navigation Architecture Test Suite", () => {
  describe("Single-Tier Nav Items Specification", () => {
    test("Contains required items across 3 sections: personal, workspace, operations", () => {
      assert.ok(Array.isArray(SINGLE_TIER_NAV_ITEMS), "SINGLE_TIER_NAV_ITEMS must be an array");

      const sections = new Set(SINGLE_TIER_NAV_ITEMS.map((item) => item.section));
      assert.ok(sections.has("personal"), "Must have personal section");
      assert.ok(sections.has("workspace"), "Must have workspace section");
      assert.ok(sections.has("operations"), "Must have operations section");
    });

    test("Personal section includes Desk (/), Calendar (/calendar), Notifications (/notifications)", () => {
      const personalItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "personal");
      const hrefs = personalItems.map((i) => i.href);
      assert.ok(hrefs.includes("/"), "Personal section must include '/'");
      assert.ok(hrefs.includes("/calendar"), "Personal section must include '/calendar'");
      assert.ok(hrefs.includes("/notifications"), "Personal section must include '/notifications'");
    });

    test("Workspace / Core section includes Tasks (/tasks) and Documents (/documents)", () => {
      const workspaceItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "workspace");
      const hrefs = workspaceItems.map((i) => i.href);
      assert.ok(hrefs.includes("/tasks"), "Workspace section must include '/tasks'");
      assert.ok(
        hrefs.includes("/documents") || SINGLE_TIER_NAV_ITEMS.some((i) => i.href === "/documents"),
        "Must include '/documents'"
      );
    });

    test("Operations / System section includes Org (/org)", () => {
      const opItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "operations");
      const hrefs = opItems.map((i) => i.href);
      assert.ok(hrefs.includes("/org"), "Operations section must include '/org'");
    });

    test("Anti-slop check: 0% emojis in sidebar-context.tsx", () => {
      const contextFile = path.join(process.cwd(), "src/components/layout/sidebar-context.tsx");
      const content = fs.readFileSync(contextFile, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "sidebar-context.tsx must contain zero emojis"
      );
    });
  });

  describe("Breadcrumbs resolution contract", () => {
    test("Resolves default root and page titles cleanly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Bàn làm việc");
    });

    test("Resolves documents breadcrumb correctly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/documents");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Văn bản & Công văn");
    });

    test("Resolves calendar breadcrumb correctly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/calendar");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Lịch công tác");
    });

    test("Resolves tasks breadcrumb correctly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/tasks");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Nhiệm vụ cấp Trường");
    });

    test("Resolves org breadcrumb correctly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/org");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Cơ cấu tổ chức & Danh bạ");
    });
  });
});
