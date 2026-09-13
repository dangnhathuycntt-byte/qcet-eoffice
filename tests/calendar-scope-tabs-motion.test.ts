import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Wave 2 - Agent D: Calendar, Scope Switcher, Tabs Motion Invariants", () => {
  const rootDir = process.cwd();
  const calendarDaySheetPath = path.join(
    rootDir,
    "src/components/calendar/calendar-day-sheet.tsx"
  );
  const scopeSwitcherPath = path.join(
    rootDir,
    "src/components/layout/scope-switcher.tsx"
  );
  const tabsPath = path.join(rootDir, "src/components/ui/tabs.tsx");

  const calendarDaySheetSource = fs.readFileSync(calendarDaySheetPath, "utf8");
  const scopeSwitcherSource = fs.readFileSync(scopeSwitcherPath, "utf8");
  const tabsSource = fs.readFileSync(tabsPath, "utf8");

  describe("framer-motion bundle ban rule", () => {
    const files = [
      { name: "calendar-day-sheet.tsx", source: calendarDaySheetSource },
      { name: "scope-switcher.tsx", source: scopeSwitcherSource },
      { name: "tabs.tsx", source: tabsSource },
    ];

    const forbiddenDouble = ["from", '"framer' + '-motion"'].join(" ");
    const forbiddenSingle = ["from", "'framer" + "-motion'"].join(" ");

    files.forEach(({ name, source }) => {
      it(`${name} must not import full framer-motion library`, () => {
        assert.equal(
          source.includes(forbiddenDouble),
          false,
          `Forbidden import from framer-motion found in ${name}`
        );
        assert.equal(
          source.includes(forbiddenSingle),
          false,
          `Forbidden import from framer-motion found in ${name}`
        );
      });

      it(`${name} must import m from motion/react-m instead of motion from motion/react`, () => {
        assert.match(
          source,
          /from\s+["']motion\/react-m["']/,
          `${name} must import from motion/react-m`
        );
        assert.equal(
          /\bimport\s*\{\s*motion\s*\}\s*from/.test(source),
          false,
          `${name} must not import heavy { motion } component`
        );
      });
    });
  });

  describe("CalendarDaySheet motion & accessibility", () => {
    it("imports AnimatePresence from motion/react", () => {
      assert.match(
        calendarDaySheetSource,
        /import\s*\{[^}]*AnimatePresence[^}]*\}\s*from\s*["']motion\/react["']/
      );
    });

    it("imports sideSheetVariants from motion variants", () => {
      assert.match(
        calendarDaySheetSource,
        /import\s*\{[^}]*sideSheetVariants[^}]*\}\s*from\s*["']@\/lib\/motion\/variants["']/
      );
    });

    it("renders AnimatePresence with m.div backdrop and m.aside panel", () => {
      assert.ok(calendarDaySheetSource.includes("<AnimatePresence>"));
      assert.ok(calendarDaySheetSource.includes("<m.div"));
      assert.ok(calendarDaySheetSource.includes("<m.aside"));
      assert.ok(calendarDaySheetSource.includes('variants={sideSheetVariants}'));
      assert.ok(calendarDaySheetSource.includes('role="dialog"'));
      assert.ok(calendarDaySheetSource.includes('aria-modal="true"'));
    });
  });

  describe("ScopeSwitcher popover motion & invariants", () => {
    it("imports AnimatePresence from motion/react and popoverVariants", () => {
      assert.match(
        scopeSwitcherSource,
        /import\s*\{[^}]*AnimatePresence[^}]*\}\s*from\s*["']motion\/react["']/
      );
      assert.match(
        scopeSwitcherSource,
        /import\s*\{[^}]*popoverVariants[^}]*\}\s*from\s*["']@\/lib\/motion\/variants["']/
      );
    });

    it("renders desktop popover inside AnimatePresence with m.div and popoverVariants", () => {
      assert.ok(scopeSwitcherSource.includes("<AnimatePresence>"));
      assert.ok(scopeSwitcherSource.includes("<m.div"));
      assert.ok(scopeSwitcherSource.includes("variants={popoverVariants}"));
      assert.ok(scopeSwitcherSource.includes('role="menu"'));
    });

    it("preserves Role Is Not Scope boundary comment and logic", () => {
      assert.ok(scopeSwitcherSource.includes("Role Is Not Scope"));
    });
  });

  describe("Tabs motionIndicator support", () => {
    it("supports motionIndicator and layoutId opt-in", () => {
      assert.ok(tabsSource.includes("motionIndicator?: boolean"));
      assert.ok(tabsSource.includes("layoutId?: string"));
      assert.ok(tabsSource.includes("<m.div"));
      assert.ok(tabsSource.includes('layoutId={layoutId}'));
      assert.ok(tabsSource.includes('data-slot="tabs-indicator"'));
    });

    it("uses motionTransition tokens", () => {
      assert.match(
        tabsSource,
        /import\s*\{[^}]*motionTransition[^}]*\}\s*from\s*["']@\/lib\/motion\/tokens["']/
      );
    });
  });
});
