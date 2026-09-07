import * as React from "react";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import DocumentsPage, { metadata } from "@/app/documents/page";

describe("Documents Module Test Suite", () => {
  const pagePath = path.join(process.cwd(), "src/app/documents/page.tsx");
  const viewPath = path.join(
    process.cwd(),
    "src/components/documents/document-registry-view.tsx"
  );

  test("src/app/documents/page.tsx exists on disk", () => {
    assert.ok(fs.existsSync(pagePath), "src/app/documents/page.tsx must exist");
  });

  test("Metadata title and description match QCET specification", () => {
    assert.ok(metadata, "Metadata must be exported from page");
    assert.ok(
      typeof metadata.title === "string" && metadata.title.includes("Văn bản & Quản lý Công văn"),
      "Page title must include 'Văn bản & Quản lý Công văn'"
    );
    assert.ok(
      typeof metadata.description === "string" && metadata.description.length > 0,
      "Page description must be non-empty"
    );
  });

  test("DocumentsPage component is a valid callable function returning JSX", () => {
    assert.strictEqual(typeof DocumentsPage, "function");
    const element = DocumentsPage();
    assert.ok(element, "DocumentsPage must return JSX element");
  });

  describe("Operational Registry Architecture & Anti-Slop Audit", () => {
    test("Page mounts DocumentRegistryView inside React.Suspense", () => {
      const pageContent = fs.readFileSync(pagePath, "utf-8");
      assert.ok(
        pageContent.includes("DocumentRegistryView"),
        "Must import and render DocumentRegistryView"
      );
      assert.ok(
        pageContent.includes("React.Suspense"),
        "Must wrap in React.Suspense for search params"
      );
    });

    test("DocumentRegistryView contains zero decorative emojis (100% Lucide icons)", () => {
      const viewContent = fs.readFileSync(viewPath, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(viewContent),
        false,
        "DocumentRegistryView must not contain any decorative emojis"
      );
    });

    test("Header contains breadcrumb linking to Trang chủ and official title", () => {
      const viewContent = fs.readFileSync(viewPath, "utf-8");
      assert.ok(viewContent.includes('href="/"'), "Must contain Link to '/'");
      assert.ok(viewContent.includes("Trang chủ"), "Must contain 'Trang chủ' text");
      assert.ok(
        viewContent.includes("Sổ Quản Lý Văn Bản &amp; Công Văn Điện Tử") ||
          viewContent.includes("Sổ Quản Lý Văn Bản & Công Văn Điện Tử"),
        "Must contain official title 'Sổ Quản Lý Văn Bản & Công Văn Điện Tử'"
      );
      assert.ok(
        viewContent.includes("Nghị định 30/2020/NĐ-CP"),
        "Must reference Decree 30/2020/ND-CP"
      );
    });

    test("Includes operational KPI cards for inbox, outbox, and linked tasks", () => {
      const viewContent = fs.readFileSync(viewPath, "utf-8");
      assert.ok(viewContent.includes("VĂN BẢN ĐẾN"), "Must display VĂN BẢN ĐẾN KPI card");
      assert.ok(viewContent.includes("VĂN BẢN ĐI"), "Must display VĂN BẢN ĐI KPI card");
      assert.ok(viewContent.includes("TỜ TRÌNH DUYỆT"), "Must display TỜ TRÌNH DUYỆT KPI card");
      assert.ok(
        viewContent.includes("LIÊN THÔNG NHIỆM VỤ"),
        "Must display LIÊN THÔNG NHIỆM VỤ KPI card"
      );
    });

    test("Action buttons allow creating new documents and exporting registry", () => {
      const viewContent = fs.readFileSync(viewPath, "utf-8");
      assert.ok(
        viewContent.includes("Soạn văn bản / Tờ trình"),
        "Must have button to compose document or proposal"
      );
      assert.ok(
        viewContent.includes("Xuất sổ điện tử"),
        "Must have button to export registry"
      );
    });

    test("DensityToggle and ergonomic table density classes are integrated", () => {
      const viewContent = fs.readFileSync(viewPath, "utf-8");
      assert.ok(
        viewContent.includes("<DensityToggle") && viewContent.includes("import { DensityToggle }"),
        "DocumentRegistryView must import and render DensityToggle in toolbar"
      );
      assert.ok(
        viewContent.includes("table-row-dense"),
        "Table must apply table-row-dense class"
      );
      assert.ok(
        viewContent.includes("table-cell-dense"),
        "Table cells must apply table-cell-dense class"
      );
    });

    test("Document summary and official code follow typography standards", () => {
      const viewContent = fs.readFileSync(viewPath, "utf-8");
      assert.ok(
        viewContent.includes("text-sm font-medium text-foreground line-clamp-2 leading-relaxed"),
        "Trích yếu summary must be styled with text-sm font-medium text-foreground line-clamp-2 leading-relaxed"
      );
      assert.ok(
        viewContent.includes("font-mono text-xs md:text-[13px] font-semibold text-primary"),
        "Document official number must be styled with font-mono text-xs md:text-[13px] font-semibold text-primary"
      );
      assert.ok(
        viewContent.includes("text-xs font-semibold uppercase tracking-wider text-muted-foreground"),
        "Table headers must use uppercase tracking-wider text-xs font-semibold"
      );
    });

    test("Zero micro-typography classes (< 12px) in documents components", () => {
      const docsDir = path.join(process.cwd(), "src/components/documents");
      const files = fs.readdirSync(docsDir).filter((f) => /\.(tsx|ts)$/.test(f));
      const forbiddenRegex = /\btext-\[(8|9|10|11)px\]/g;
      const violations: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(path.join(docsDir, file), "utf-8");
        const matches = content.match(forbiddenRegex);
        if (matches) {
          violations.push(`${file}: ${matches.join(", ")}`);
        }
      }

      assert.strictEqual(
        violations.length,
        0,
        `Found micro-typography violations in documents: ${violations.join("; ")}`
      );
    });
  });
});
