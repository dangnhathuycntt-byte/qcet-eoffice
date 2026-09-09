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
    assert.ok(manifest.background_color === "#fbfbfb" || manifest.background_color === "#f8fafc");
    assert.ok(manifest.theme_color === "#fbfbfb" || manifest.theme_color === "#0f172a");
    assert.ok(Array.isArray(manifest.shortcuts));
    assert.ok(manifest.shortcuts.length >= 3);
    assert.ok(manifest.shortcuts.some((s) => s.url === "/?action=create_task"));
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
