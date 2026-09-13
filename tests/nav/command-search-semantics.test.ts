import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COMMAND_INTENT_LABELS,
  scopedRecentSearchesKey,
  scopedSearchCacheKey,
} from "../../src/components/layout/command-search-modal";

const ROOT = path.resolve(__dirname, "..", "..");
const modalPath = path.join(ROOT, "src/components/layout/command-search-modal.tsx");
const topbarPath = path.join(ROOT, "src/components/layout/app-topbar.tsx");
const tableToolbarPath = path.join(
  ROOT,
  "src/components/tasks/table/components/task-table-toolbar.tsx"
);

const modalContent = fs.readFileSync(modalPath, "utf-8");

describe("P6 · Command Palette semantics (C5, C10, T38, T39, T40, T41, T42, D8)", () => {
  describe("T38 · every item is classified", () => {
    test("declares an explicit item-kind classification union", () => {
      assert.ok(
        modalContent.includes("export type CommandPaletteItemKind"),
        "must export CommandPaletteItemKind"
      );
      for (const kind of ["navigation", "command", "task", "document", "user", "recent"]) {
        assert.ok(
          new RegExp(`"${kind}"`).test(modalContent),
          `classification must include the "${kind}" kind`
        );
      }
    });

    test("each surfaced item is tagged with its classification, not inferred ad-hoc", () => {
      assert.ok(modalContent.includes('kind: "recent"'), "recents are classified as recent");
      assert.ok(modalContent.includes('kind: "navigation"'), "navigation items are classified");
      assert.ok(modalContent.includes('kind: "command"'), "command items are classified");
    });
  });

  describe("T39 · the five intents are visually separated", () => {
    test("exposes the five canonical intent-group labels", () => {
      assert.equal(COMMAND_INTENT_LABELS.navigation, "Đi tới");
      assert.equal(COMMAND_INTENT_LABELS.task, "Nhiệm vụ");
      assert.equal(COMMAND_INTENT_LABELS.document, "Văn bản");
      assert.equal(COMMAND_INTENT_LABELS.user, "Cán bộ");
      assert.equal(COMMAND_INTENT_LABELS.command, "Hành động");
    });

    test("renders one section per intent group from the shared label map", () => {
      for (const label of ["Đi tới", "Nhiệm vụ", "Văn bản", "Cán bộ", "Hành động"]) {
        assert.ok(modalContent.includes(`"${label}"`), `intent label "${label}" must be declared`);
      }
      assert.ok(
        modalContent.includes("COMMAND_INTENT_LABELS.navigation") &&
          modalContent.includes("COMMAND_INTENT_LABELS.command"),
        "sections must be driven by COMMAND_INTENT_LABELS, not duplicated strings"
      );
    });

    test("the recents section heading is sourced from the shared label map", () => {
      assert.equal(COMMAND_INTENT_LABELS.recent, "Gần đây");
      assert.ok(
        modalContent.includes("COMMAND_INTENT_LABELS.recent"),
        "the recents heading must render COMMAND_INTENT_LABELS.recent"
      );
      assert.equal(
        modalContent.includes("Đã xem gần đây"),
        false,
        "the recents heading must not hardcode a divergent label"
      );
    });
  });

  describe("C5 · the palette is not global-search, not current-view search, not filter", () => {
    test("current-view search inside /tasks never triggers the global command palette", () => {
      const toolbar = fs.readFileSync(tableToolbarPath, "utf-8");
      assert.ok(
        toolbar.includes("qcet:focus-task-search"),
        "the /tasks toolbar owns a local current-view search focus event"
      );
      assert.equal(
        toolbar.includes("qcet:open-command-search"),
        false,
        "current-view search must never open global command search"
      );
    });

    test("the command palette does not hijack the local /tasks current-view search", () => {
      assert.equal(
        modalContent.includes("qcet:focus-task-search"),
        false,
        "the palette must not drive the /tasks local search"
      );
    });
  });

  describe("T41 · recents are account-safe", () => {
    test("recent storage key is namespaced per authenticated user", () => {
      assert.equal(scopedRecentSearchesKey("user-a"), "qcet_recent_searches:user-a");
      assert.equal(scopedRecentSearchesKey("user-b"), "qcet_recent_searches:user-b");
      assert.notEqual(
        scopedRecentSearchesKey("user-a"),
        scopedRecentSearchesKey("user-b"),
        "two accounts must never share a recents namespace"
      );
      assert.equal(scopedRecentSearchesKey(null), "qcet_recent_searches:anonymous");
    });

    test("the modal reads the authenticated user and never uses an unscoped key", () => {
      assert.ok(modalContent.includes("useAuth"), "must read the authenticated user");
      assert.ok(
        modalContent.includes("recentStorageKey") ||
          modalContent.includes("scopedRecentSearchesKey"),
        "must scope the storage key by user"
      );
      assert.equal(
        /localStorage\.(getItem|setItem|removeItem)\(\s*RECENT_SEARCHES_STORAGE_KEY\s*\)/.test(
          modalContent
        ),
        false,
        "no localStorage call may use the bare unscoped key constant"
      );
    });

    test("the in-memory result cache is namespaced per authenticated user", () => {
      assert.equal(scopedSearchCacheKey("user-a", "nv-2026"), "user-a::nv-2026");
      assert.equal(scopedSearchCacheKey("user-b", "nv-2026"), "user-b::nv-2026");
      assert.notEqual(
        scopedSearchCacheKey("user-a", "nv-2026"),
        scopedSearchCacheKey("user-b", "nv-2026"),
        "two accounts must never share a cached search result"
      );
      assert.equal(scopedSearchCacheKey(null, "  nv  "), "anonymous::nv");
    });

    test("the debounced search keys the cache and effect by the authenticated user", () => {
      assert.ok(
        modalContent.includes("scopedSearchCacheKey(user?.id"),
        "the cache key must derive from the authenticated user id"
      );
      assert.ok(
        modalContent.includes("user?.id"),
        "the search effect must react to the authenticated user id"
      );
    });
  });

  describe("T42 · keyboard, focus containment, IME safety", () => {
    test("Up/Down/Enter/Escape remain wired", () => {
      assert.ok(modalContent.includes('e.key === "ArrowDown"'), "ArrowDown navigates");
      assert.ok(modalContent.includes('e.key === "ArrowUp"'), "ArrowUp navigates");
      assert.ok(modalContent.includes('e.key === "Enter"'), "Enter activates");
      assert.ok(modalContent.includes('e.key === "Escape"'), "Escape closes");
    });

    test("Tab is trapped inside the dialog and no longer switches groups", () => {
      assert.ok(modalContent.includes("dialogRef"), "must hold a dialog ref for containment");
      assert.ok(modalContent.includes('e.key === "Tab"'), "Tab must be handled for focus containment");
      assert.ok(
        modalContent.includes("querySelectorAll"),
        "must enumerate focusable elements for the focus trap"
      );
      assert.equal(
        modalContent.includes("setActiveTab(tabs["),
        false,
        "the old Tab->group-switch hijack must be removed"
      );
    });

    test("IME composition keystrokes are ignored (Vietnamese input safety)", () => {
      assert.ok(
        modalContent.includes("isComposing"),
        "must guard command handling against IME composition"
      );
    });
  });

  describe("C10 · cancellation / staleness", () => {
    test("in-flight search requests are abortable", () => {
      assert.ok(modalContent.includes("AbortController"), "must use AbortController");
      assert.ok(modalContent.includes("controller.abort()"), "must abort on query change");
      assert.ok(modalContent.includes("AbortError"), "must ignore aborted responses");
    });
  });

  describe("D8 · critical actions stay reachable without shortcuts", () => {
    test("the topbar exposes a non-keyboard palette trigger", () => {
      const topbar = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(
        topbar.includes("qcet:open-command-search"),
        "the topbar must dispatch qcet:open-command-search without a keyboard shortcut"
      );
    });

    test("palette items are clickable, not keyboard-only", () => {
      const onClickCount = (modalContent.match(/onClick=\{\(\) => /g) || []).length;
      assert.ok(onClickCount >= 4, `expected clickable affordances, found ${onClickCount}`);
    });
  });
});
