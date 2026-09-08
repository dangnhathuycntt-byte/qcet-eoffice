import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "../src/app/manifest";

describe("Task 3: PWA & Service Worker Resilience", () => {
  it("manifest() includes id and scope properties for iOS/Android standalone mode", () => {
    const m = manifest();
    assert.equal(m.id, "/");
    assert.equal(m.scope, "/");
    assert.equal(m.display, "standalone");
  });

  it("layout.tsx does NOT unregister ServiceWorker on localhost", () => {
    const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    assert.ok(
      !content.includes("r.unregister()"),
      "layout.tsx must not unregister service workers on localhost"
    );
  });

  it("use-push-notification.ts wraps SW ready and getSubscription in 4000ms timeout", () => {
    const hookPath = path.resolve(__dirname, "../src/hooks/use-push-notification.ts");
    const content = fs.readFileSync(hookPath, "utf-8");
    assert.ok(
      content.includes("withTimeout") || content.includes("4000") || content.includes("Promise.race"),
      "use-push-notification.ts must use timeout on SW operations"
    );
  });
});
