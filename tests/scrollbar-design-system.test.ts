import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Scrollbar Modernization & Anti-Slop Audit", () => {
  const cssPath = path.join(process.cwd(), "src/app/globals.css");
  const popoverPath = path.join(process.cwd(), "src/components/notifications/notification-popover.tsx");

  it("globals.css defines refined .thin-scrollbar utility", () => {
    assert.ok(fs.existsSync(cssPath), "globals.css must exist");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Check Firefox rules
    assert.ok(css.includes("scrollbar-width: thin;"), "Must include scrollbar-width: thin");
    assert.ok(
      css.includes("scrollbar-color: color-mix(in srgb, var(--foreground) 18%, transparent) transparent;"),
      "Must include semi-transparent Firefox scrollbar-color"
    );
    assert.ok(
      css.includes("scrollbar-color: color-mix(in srgb, var(--foreground) 35%, transparent) transparent;"),
      "Must include semi-transparent Firefox hover scrollbar-color"
    );

    // Check WebKit rules
    assert.ok(css.includes(".thin-scrollbar::-webkit-scrollbar"), "Must include WebKit scrollbar rules");
    assert.ok(css.includes("width: 5px;"), "Must set scrollbar width to 5px");
    assert.ok(css.includes("height: 5px;"), "Must set scrollbar height to 5px");
    assert.ok(
      css.includes(".thin-scrollbar::-webkit-scrollbar-track") && css.includes("background: transparent;"),
      "Must set WebKit scrollbar track to transparent"
    );
    assert.ok(css.includes("border-radius: 9999px;"), "Must set pill border-radius 9999px");
    assert.ok(
      css.includes("background: color-mix(in srgb, var(--foreground) 18%, transparent);"),
      "Must use semi-transparent thumb background"
    );
    assert.ok(
      css.includes("background: color-mix(in srgb, var(--foreground) 35%, transparent);"),
      "Must use semi-transparent hover thumb background"
    );
  });

  it("Scrollbar contract is applied to all key interactive overflow containers", () => {
    const containersToCheck = [
      {
        path: "src/components/notifications/notification-popover.tsx",
        name: "NotificationPopover list container",
      },
      {
        path: "src/components/layout/app-sidebar.tsx",
        name: "AppSidebar navigation container",
      },
      {
        path: "src/components/auth/user-profile-modal.tsx",
        name: "UserProfileModal body container",
      },
      {
        path: "src/components/dashboard/create-task-modal.tsx",
        name: "CreateTaskModal body container",
      },
    ];

    containersToCheck.forEach(({ path: relPath, name }) => {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        content.includes("thin-scrollbar"),
        `${name} (${relPath}) must apply thin-scrollbar`
      );
    });
  });

  it("NotificationPopover scrollable list container applies thin-scrollbar", () => {
    assert.ok(fs.existsSync(popoverPath), "notification-popover.tsx must exist");
    const content = fs.readFileSync(popoverPath, "utf-8");

    // Verify container class
    assert.ok(
      content.includes("overflow-y-auto") && content.includes("thin-scrollbar"),
      "Notification list container must apply thin-scrollbar"
    );
  });
});
