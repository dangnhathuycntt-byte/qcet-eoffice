import { test } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";

test("PWA manifest exports required standalone metadata", () => {
  const data = manifest();
  assert.ok(data.name && data.name.includes("QCET E-Office"));
  assert.equal(data.short_name, "QCET E-Office");
  assert.equal(data.display, "standalone");
  assert.ok(data.start_url === "/" || (data.start_url ? data.start_url.startsWith("/?source=pwa") : false));
  assert.ok(Array.isArray(data.icons) && data.icons.length >= 2);
  const maskable = data.icons?.find((icon) => icon.purpose === "maskable");
  assert.ok(maskable, "Phải có ít nhất 1 maskable icon cho Android");
});
