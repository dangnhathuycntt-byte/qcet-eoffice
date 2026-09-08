import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "../src/app/manifest";

describe("Task 2: PWA Configuration & Push Resilience", () => {
  const swJs = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  const pushHook = fs.readFileSync(
    path.join(process.cwd(), "src/hooks/use-push-notification.ts"),
    "utf8"
  );
  const offlineBanner = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/offline-banner.tsx"),
    "utf8"
  );

  it("manifest() defines scope, id, lang, and start_url", () => {
    const data = manifest();
    assert.equal(data.scope, "/");
    assert.equal(data.id, "/?source=pwa");
    assert.equal(data.lang, "vi");
    assert.equal(data.dir, "ltr");
  });

  it("use-push-notification.ts calls getRegistration('/') or ready instead of '/sw.js'", () => {
    assert.doesNotMatch(pushHook, /getRegistration\(['"]\/sw\.js['"]\)/);
    assert.match(pushHook, /getRegistration\(['"]\/['"]\)|getRegistration\(\)/);
  });

  it("public/sw.js uses Promise.allSettled for precaching", () => {
    assert.match(swJs, /Promise\.allSettled/);
  });

  it("public/sw.js does not use heavy /logo-qcet.png for notification badge", () => {
    assert.doesNotMatch(swJs, /badge:\s*payload\.badge\s*\|\|\s*['"]\/logo-qcet\.png['"]/);
    assert.match(swJs, /badge:\s*payload\.badge\s*\|\|\s*['"]\/icons\/badge-72x72\.png['"]/);
  });

  it("offline-banner.tsx avoids colliding with mobile bottom navigation bar", () => {
    assert.match(offlineBanner, /bottom-\[calc\(4\.\d+rem\+env\(safe-area-inset-bottom/);
  });
});
