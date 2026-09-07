import { describe, it } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";

describe("Next.js Standalone Configuration", () => {
  it("should have output set to 'standalone' for lightweight Docker production", () => {
    assert.equal(nextConfig.output, "standalone");
  });

  it("should preserve redirects configuration", async () => {
    assert.ok(typeof nextConfig.redirects === "function");
    const redirects = await nextConfig.redirects!();
    assert.ok(Array.isArray(redirects));
    assert.ok(redirects.some((r) => r.source === "/tasks"));
  });
});
