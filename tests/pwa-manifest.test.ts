import { test } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";

test("PWA manifest exports required standalone metadata", () => {
  const data = manifest();
  assert.equal(data.name, "QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử");
  assert.equal(data.short_name, "QCET E-Office");
  assert.equal(data.display, "standalone");
  assert.equal(data.start_url, "/");
  assert.ok(Array.isArray(data.icons) && data.icons.length >= 2);
  const maskable = data.icons?.find((icon) => icon.purpose === "maskable");
  assert.ok(maskable, "Phải có ít nhất 1 maskable icon cho Android");
});
