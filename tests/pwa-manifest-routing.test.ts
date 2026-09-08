// tests/pwa-manifest-routing.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifestFn from "@/app/manifest";
import { enqueueOfflineMutation, getOfflineMutationQueue, removeOfflineMutation } from "@/lib/offline-sync";

describe("PWA Manifest, Service Worker & Offline Sync Suite", () => {
  test("manifest.ts generates light-only theme with shortcuts", () => {
    const manifest = manifestFn();
    assert.strictEqual(manifest.background_color, "#fbfbfb");
    assert.strictEqual(manifest.theme_color, "#fbfbfb");
    assert.ok(Array.isArray(manifest.shortcuts));
    assert.strictEqual(manifest.shortcuts.length, 3);
    assert.strictEqual(manifest.shortcuts[0].url, "/?action=create_task");
  });

  test("public/sw.js includes static Cache-First and API timeout fallback", () => {
    const swPath = path.resolve(process.cwd(), "public/sw.js");
    const swContent = fs.readFileSync(swPath, "utf-8");
    assert.ok(swContent.includes("/?zone=tasks"));
    assert.ok(swContent.includes("/_next/static/"));
    assert.ok(swContent.includes("X-QCET-Offline-Cache") || swContent.includes("API_CACHE_NAME"));
  });

  test("offline-sync manages queue and does not throw in node environment", () => {
    const mutation = enqueueOfflineMutation({
      url: "/api/tasks/123",
      method: "PATCH",
      body: { status: "COMPLETED" },
      description: "Duyệt nhanh nhiệm vụ 123",
    });
    assert.ok(mutation.id);
    const queue = getOfflineMutationQueue();
    assert.ok(queue.some((item) => item.id === mutation.id));
    removeOfflineMutation(mutation.id);
  });
});
