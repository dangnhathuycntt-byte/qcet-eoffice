import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import manifest from "../../src/app/manifest";

describe("Task 5: Web App Manifest Audit, Stable Identity, Maskable Icons & Shortcuts", () => {
  const manifestData = manifest();

  describe("1. Stable Identity & PWA Installability Requirements", () => {
    it("defines a stable, canonical identity via 'id' and 'scope'", () => {
      assert.ok(manifestData.id, "Manifest must have an id");
      assert.strictEqual(manifestData.id, "/", "id must be stable canonical '/'");
      assert.strictEqual(manifestData.scope, "/", "scope must be root '/'");
      assert.strictEqual(
        manifestData.start_url,
        "/?source=pwa",
        "start_url must carry ?source=pwa tracking parameter"
      );
    });

    it("has valid display, orientation, and language properties for standalone mode", () => {
      assert.strictEqual(manifestData.display, "standalone");
      assert.strictEqual(manifestData.orientation, "portrait-primary");
      assert.strictEqual(manifestData.lang, "vi");
      assert.strictEqual(manifestData.dir, "ltr");
    });

    it("uses standardized theme and background colors aligned with light theme", () => {
      assert.strictEqual(manifestData.background_color, "#f8fafc");
      assert.strictEqual(manifestData.theme_color, "#0f172a");
    });

    it("includes relevant application categories", () => {
      assert.ok(Array.isArray(manifestData.categories));
      assert.ok(manifestData.categories.includes("productivity"));
      assert.ok(manifestData.categories.includes("education"));
      assert.ok(manifestData.categories.includes("business"));
    });
  });

  describe("2. Institutional Naming & Real QCET Brand Alignment", () => {
    it("specifies correct QCET  administrative name and short name", () => {
      assert.strictEqual(
        manifestData.name,
        "QCET E-Office - Trường CĐ Kinh tế & Công nghệ "
      );
      assert.strictEqual(manifestData.short_name, "QCET E-Office");
      assert.strictEqual(
        manifestData.description,
        "Hệ thống quản lý điều hành tác nghiệp và hành chính điện tử QCET"
      );
    });

    it("does not contain outdated Quy Nhon or non-canonical institution references", () => {
      const serialized = JSON.stringify(manifestData);
      assert.ok(
        !serialized.toLowerCase().includes("quy nhơn"),
        "Manifest must not contain references to Quy Nhơn"
      );
      assert.ok(
        !serialized.toLowerCase().includes("quy nhon"),
        "Manifest must not contain references to Quy Nhon"
      );
    });

    it("contains zero decorative emojis in names, descriptions, or shortcuts", () => {
      const serialized = JSON.stringify(manifestData);
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.ok(
        !emojiRegex.test(serialized),
        "Manifest must contain zero decorative emojis"
      );
    });
  });

  describe("3. Standard & Maskable App Icons", () => {
    it("declares standard 192x192 and 512x512 icons with purpose 'any'", () => {
      const anyIcons = manifestData.icons?.filter((i) => i.purpose === "any" || !i.purpose);
      assert.ok(anyIcons && anyIcons.length >= 2, "Must declare at least two 'any' icons");

      const has192 = anyIcons.some(
        (i) => i.sizes === "192x192" && (i.type === "image/png" || !i.type)
      );
      const has512 = anyIcons.some(
        (i) => i.sizes === "512x512" && (i.type === "image/png" || !i.type)
      );

      assert.ok(has192, "Must have 192x192 icon with purpose 'any'");
      assert.ok(has512, "Must have 512x512 icon with purpose 'any'");
    });

    it("declares maskable 192x192 and 512x512 icons with purpose 'maskable'", () => {
      const maskableIcons = manifestData.icons?.filter(
        (i) => i.purpose === "maskable"
      );
      assert.ok(
        maskableIcons && maskableIcons.length >= 2,
        "Must declare at least two 'maskable' icons"
      );

      const has192Maskable = maskableIcons.some(
        (i) => i.sizes === "192x192" && i.src.includes("maskable")
      );
      const has512Maskable = maskableIcons.some(
        (i) => i.sizes === "512x512" && i.src.includes("maskable")
      );

      assert.ok(has192Maskable, "Must have 192x192 maskable icon");
      assert.ok(has512Maskable, "Must have 512x512 maskable icon");
    });

    it("ensures all icon assets referenced in manifest physically exist on disk", () => {
      const icons = manifestData.icons || [];
      assert.ok(icons.length >= 4, "Must have at least 4 icons configured");

      for (const icon of icons) {
        // Strip leading slash to get relative public path
        const relativePath = icon.src.startsWith("/")
          ? icon.src.slice(1)
          : icon.src;
        const fullDiskPath = path.resolve(process.cwd(), "public", relativePath);

        assert.ok(
          fs.existsSync(fullDiskPath),
          `Referenced icon file must exist on disk: ${icon.src} -> ${fullDiskPath}`
        );

        const stats = fs.statSync(fullDiskPath);
        assert.ok(stats.size > 0, `Icon file must not be empty: ${icon.src}`);
      }
    });

    it("verifies public/icons directory contains both standard and maskable icon variants", () => {
      const requiredFiles = [
        "icon-192.png",
        "icon-512.png",
        "icon-192-maskable.png",
        "icon-512-maskable.png",
      ];

      for (const fileName of requiredFiles) {
        const filePath = path.resolve(process.cwd(), "public", "icons", fileName);
        assert.ok(
          fs.existsSync(filePath),
          `Required icon file public/icons/${fileName} must exist`
        );
        const stats = fs.statSync(filePath);
        assert.ok(stats.size > 1000, `Icon file ${fileName} must be valid non-trivial image`);
      }
    });
  });

  describe("4. App Shortcuts (Quick Actions)", () => {
    it("configures essential institutional shortcuts (Tasks, Documents, Calendar)", () => {
      const shortcuts = manifestData.shortcuts;
      assert.ok(Array.isArray(shortcuts), "shortcuts must be an array");
      assert.ok(shortcuts.length >= 3, "Must have at least 3 shortcuts");

      const taskShortcut = shortcuts.find((s) => s.url === "/tasks");
      assert.ok(taskShortcut, "Must have /tasks shortcut");
      assert.strictEqual(taskShortcut.name, "Nhiệm vụ");

      const docShortcut = shortcuts.find((s) => s.url === "/documents");
      assert.ok(docShortcut, "Must have /documents shortcut");
      assert.strictEqual(docShortcut.name, "Văn bản");

      const calShortcut = shortcuts.find((s) => s.url === "/calendar");
      assert.ok(calShortcut, "Must have /calendar shortcut");
      assert.strictEqual(calShortcut.name, "Lịch công tác");
    });

    it("provides valid icon references for each shortcut", () => {
      const shortcuts = manifestData.shortcuts || [];
      for (const shortcut of shortcuts) {
        assert.ok(shortcut.name, "Shortcut must have a name");
        assert.ok(shortcut.url, "Shortcut must have a url");
        assert.ok(
          Array.isArray(shortcut.icons) && shortcut.icons.length > 0,
          `Shortcut '${shortcut.name}' must have at least one icon`
        );

        for (const icon of shortcut.icons) {
          const relativePath = icon.src.startsWith("/")
            ? icon.src.slice(1)
            : icon.src;
          const fullDiskPath = path.resolve(
            process.cwd(),
            "public",
            relativePath
          );
          assert.ok(
            fs.existsSync(fullDiskPath),
            `Shortcut icon must exist: ${icon.src}`
          );
        }
      }
    });
  });
});
