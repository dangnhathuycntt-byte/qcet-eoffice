import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Wave 2 - Agent B: Overlay Foundation Motion Invariants", () => {
  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, "src/components/ui/drawer.tsx");
  const commandModalPath = path.join(
    rootDir,
    "src/components/layout/command-search-modal.tsx"
  );
  const notificationPopoverPath = path.join(
    rootDir,
    "src/components/notifications/notification-popover.tsx"
  );

  const overlayFiles = [
    { name: "drawer.tsx", path: drawerPath },
    { name: "command-search-modal.tsx", path: commandModalPath },
    { name: "notification-popover.tsx", path: notificationPopoverPath },
  ];

  it("all overlay files exist", () => {
    for (const file of overlayFiles) {
      assert.ok(fs.existsSync(file.path), `${file.name} must exist`);
    }
  });

  it("strictly prohibits framer-motion in all overlay files", () => {
    for (const file of overlayFiles) {
      const content = fs.readFileSync(file.path, "utf8");
      assert.doesNotMatch(
        content,
        /from\s+["']framer-motion["']/,
        `${file.name} must not import from framer-motion`
      );
    }
  });

  it("strictly prohibits full motion component import from motion/react in all overlay files", () => {
    for (const file of overlayFiles) {
      const content = fs.readFileSync(file.path, "utf8");
      assert.doesNotMatch(
        content,
        /import\s*\{\s*motion\b/,
        `${file.name} must not import full 'motion' component; use '* as m from "motion/react-m"'`
      );
      assert.match(
        content,
        /import\s+\*\s+as\s+m\s+from\s+["']motion\/react-m["']/,
        `${file.name} must import '* as m from "motion/react-m"'`
      );
      assert.match(
        content,
        /import\s*\{[^}]*AnimatePresence[^}]*\}\s*from\s+["']motion\/react["']/,
        `${file.name} must import AnimatePresence from "motion/react"`
      );
    }
  });

  describe("src/components/ui/drawer.tsx", () => {
    const content = fs.readFileSync(drawerPath, "utf8");

    it("removes manual visible state and double requestAnimationFrame", () => {
      assert.doesNotMatch(content, /requestAnimationFrame/);
      assert.doesNotMatch(content, /const\s*\[visible,\s*setVisible\]/);
      assert.doesNotMatch(content, /duration-300/);
    });

    it("uses AnimatePresence, m.div backdrop and m.aside panel with canonical variants", () => {
      assert.match(content, /<AnimatePresence>/);
      assert.match(content, /<m\.div[^>]*key="drawer-backdrop"/);
      assert.match(content, /<m\.aside[^>]*key="drawer-panel"/);
      assert.match(content, /variants=\{fadeVariants\}/);
      assert.match(content, /variants=\{sideSheetVariants\}/);
      assert.match(
        content,
        /import\s*\{[^}]*fadeVariants[^}]*sideSheetVariants[^}]*\}\s*from\s+["']@\/lib\/motion\/variants["']/
      );
    });

    it("preserves portal, escape handler, scroll lock, and accessibility roles", () => {
      assert.match(content, /createPortal\(/);
      assert.match(content, /e\.key === ["']Escape["']/);
      assert.match(content, /document\.body\.style\.overflow = ["']hidden["']/);
      assert.match(content, /role=["']dialog["']/);
      assert.match(content, /aria-modal=["']true["']/);
    });
  });

  describe("src/components/layout/command-search-modal.tsx", () => {
    const content = fs.readFileSync(commandModalPath, "utf8");

    it("replaces CSS enter-only animations with AnimatePresence and m.div", () => {
      assert.match(content, /<AnimatePresence>/);
      assert.match(content, /<m\.div[^>]*key="command-palette-backdrop"/);
      assert.match(content, /<m\.div[^>]*key="command-palette-panel"/);
      assert.doesNotMatch(
        content,
        /animate-in fade-in duration-150/,
        "Must remove CSS enter-only fade-in"
      );
      assert.doesNotMatch(
        content,
        /animate-in zoom-in-98 duration-150/,
        "Must remove CSS enter-only zoom-in"
      );
    });

    it("implements panel animation with y: -6 and scale: 0.985", () => {
      assert.match(content, /y:\s*-6/);
      assert.match(content, /scale:\s*0\.985/);
    });

    it("preserves dialog role, aria-modal, and Light-Only standard", () => {
      assert.match(content, /role=["']dialog["']/);
      assert.match(content, /aria-modal=["']true["']/);
      assert.match(content, /data-slot=["']command-palette["']/);
      assert.doesNotMatch(content, /dark:/, "No dark: classes permitted");
    });
  });

  describe("src/components/notifications/notification-popover.tsx", () => {
    const content = fs.readFileSync(notificationPopoverPath, "utf8");

    it("replaces CSS enter-only animation with AnimatePresence and popoverVariants", () => {
      assert.match(content, /<AnimatePresence>/);
      assert.match(content, /<m\.div[^>]*key="notification-popover"/);
      assert.match(content, /variants=\{popoverVariants\}/);
      assert.match(
        content,
        /import\s*\{[^}]*popoverVariants[^}]*\}\s*from\s+["']@\/lib\/motion\/variants["']/
      );
      assert.doesNotMatch(
        content,
        /animate-in fade-in-0 zoom-in-95 duration-150/,
        "Must remove CSS enter-only popover animation"
      );
    });

    it("preserves dialog role, scrollbar styling, and zero emojis", () => {
      assert.match(content, /role=["']dialog["']/);
      assert.match(content, /aria-label=["']Trung tâm thông báo["']/);
      assert.match(content, /thin-scrollbar/);
      const emojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "No emojis permitted in notification-popover.tsx"
      );
    });
  });
});
