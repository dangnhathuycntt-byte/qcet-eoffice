import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  COMMAND_INTENT_LABELS,
  scopedRecentSearchesKey,
  scopedSearchCacheKey,
} from "../../src/components/layout/command-search-modal";

describe("P6 · Command Palette semantics", () => {
  describe("T39 · the five intents are visually separated", () => {
    test("exposes the five canonical intent-group labels", () => {
      assert.equal(COMMAND_INTENT_LABELS.navigation, "Đi tới");
      assert.equal(COMMAND_INTENT_LABELS.task, "Nhiệm vụ");
      assert.equal(COMMAND_INTENT_LABELS.document, "Văn bản");
      assert.equal(COMMAND_INTENT_LABELS.user, "Cán bộ");
      assert.equal(COMMAND_INTENT_LABELS.command, "Hành động");
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
  });
});
