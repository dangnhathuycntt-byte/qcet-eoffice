import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Global Command Search Palette", () => {
  const modalComponentPath = path.resolve(
    process.cwd(),
    "src/components/layout/command-search-modal.tsx"
  );
  const apiRoutePath = path.resolve(
    process.cwd(),
    "src/app/api/search/route.ts"
  );
  const appShellPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-shell.tsx"
  );

  test("CommandSearchModal component file exists and contains core search features", () => {
    assert.ok(fs.existsSync(modalComponentPath), "Modal component must exist");
    const content = fs.readFileSync(modalComponentPath, "utf-8");

    // Check event listener
    assert.ok(
      content.includes("qcet:open-command-search"),
      "Must listen to 'qcet:open-command-search' event"
    );

    // Check keyboard shortcut
    assert.ok(
      content.includes("e.key === \"k\" || e.key === \"K\""),
      "Must support Cmd+K / Ctrl+K keyboard shortcut toggle"
    );

    // Check accessibility attributes
    assert.ok(content.includes('role="dialog"'), "Must have role='dialog'");
    assert.ok(content.includes('aria-modal="true"'), "Must have aria-modal='true'");

    // Check Light-Only Standard (no dark: classes)
    assert.ok(
      !content.includes("dark:"),
      "Must strictly follow Light-Only standard without dark: classes"
    );

    // Check quick actions
    assert.ok(content.includes("create-task"), "Must support creating task action");
    assert.ok(content.includes("nav-dashboard"), "Must support dashboard navigation");
    assert.ok(content.includes("nav-tasks"), "Must support tasks navigation");
    assert.ok(content.includes("nav-calendar"), "Must support calendar navigation");
    assert.ok(content.includes("nav-documents"), "Must support documents navigation");
    assert.ok(content.includes("nav-portal"), "Must support portal navigation");
  });

  test("Global Search API endpoint exists and handles authentication & querying", () => {
    assert.ok(fs.existsSync(apiRoutePath), "API route file must exist");
    const content = fs.readFileSync(apiRoutePath, "utf-8");

    assert.ok(
      content.includes("getSessionFromRequest"),
      "Must authenticate via getSessionFromRequest"
    );
    assert.ok(
      content.includes("prisma.task.findMany"),
      "Must query tasks from database"
    );
    assert.ok(
      content.includes("prisma.user.findMany"),
      "Must query users from database"
    );
  });

  test("AppShell mounts CommandSearchModal globally", () => {
    assert.ok(fs.existsSync(appShellPath), "AppShell file must exist");
    const content = fs.readFileSync(appShellPath, "utf-8");

    assert.ok(
      content.includes("CommandSearchModal"),
      "AppShell must import and render CommandSearchModal"
    );
  });

  test("Eliminates duplicate keydown listener conflict between AppTopbar and CommandSearchModal", () => {
    const topbarComponentPath = path.resolve(
      process.cwd(),
      "src/components/layout/app-topbar.tsx"
    );
    const topbarContent = fs.readFileSync(topbarComponentPath, "utf-8");
    const modalContent = fs.readFileSync(modalComponentPath, "utf-8");

    // AppTopbar dispatches open-command-search event
    assert.ok(
      topbarContent.includes("qcet:open-command-search"),
      "AppTopbar must dispatch 'qcet:open-command-search'"
    );

    // CommandSearchModal guards against event conflict with e.defaultPrevented
    assert.ok(
      modalContent.includes("e.defaultPrevented"),
      "CommandSearchModal must check e.defaultPrevented to prevent duplicate toggle race condition"
    );

    // CommandSearchModal handles global keydown with IME resilience
    assert.ok(
      modalContent.includes("KeyK"),
      "CommandSearchModal must check KeyK for IME resilience"
    );
  });

  test("Vietnamese Search Utility correctly folds diacritics, extracts acronyms, and scores queries", async () => {
    const {
      foldVietnamese,
      normalizeTelexQuery,
      extractAcronym,
      scoreVietnameseSearch,
      highlightMatchSegments,
    } = await import("../src/lib/search/vietnamese-search");

    // 1. Accent folding
    assert.equal(
      foldVietnamese("Kế hoạch Đào tạo & Bồi dưỡng"),
      "ke hoach dao tao & boi duong"
    );
    assert.equal(
      foldVietnamese("Đặng Đình Đức"),
      "dang dinh duc"
    );

    // 2. Acronym extraction
    assert.equal(
      extractAcronym("Khoa Công nghệ thông tin"),
      "cntt"
    );
    assert.equal(
      extractAcronym("Phòng Đảm bảo chất lượng giáo dục"),
      "dbclgd"
    );
    assert.equal(
      extractAcronym("Ban Giám hiệu"),
      "bgh"
    );

    // 3. Multi-tier scoring
    const scoreAcronym = scoreVietnameseSearch(
      "Khoa Công nghệ thông tin",
      "cntt"
    );
    assert.ok(scoreAcronym >= 70, `Score for acronym should be >= 70, got ${scoreAcronym}`);

    const scoreUnaccented = scoreVietnameseSearch(
      "Kế hoạch đào tạo học kỳ 1",
      "ke hoach dao tao"
    );
    assert.ok(
      scoreUnaccented >= 60,
      `Score for unaccented query should be >= 60, got ${scoreUnaccented}`
    );

    // 4. Highlight segmentation
    const segments = highlightMatchSegments(
      "Kế hoạch đào tạo",
      "ke hoach"
    );
    assert.ok(segments.length > 0);
    assert.equal(segments[0].match, true);
    assert.equal(segments[0].text, "Kế hoạch");
  });

  test("CommandSearchModal includes recent searches, highlighted text, and Raycast/Linear footer", () => {
    const content = fs.readFileSync(modalComponentPath, "utf-8");

    // Recent searches in localStorage
    assert.ok(
      content.includes("qcet_recent_searches"),
      "Must persist recent searches to localStorage using qcet_recent_searches"
    );

    // HighlightedText integration
    assert.ok(
      content.includes("HighlightedText"),
      "Must integrate HighlightedText component for search matches"
    );

    // In-memory client cache
    assert.ok(
      content.includes("searchCacheRef"),
      "Must maintain in-memory cache to prevent layout shift and redundant network calls"
    );

    // Footer actions
    assert.ok(
      content.includes("Mở tab mới"),
      "Must offer Cmd+Enter secondary shortcut for opening in new tab"
    );
    assert.ok(
      content.includes("Chuyển nhóm"),
      "Must offer Tab key hint for tab navigation"
    );
  });
});
