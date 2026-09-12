import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
  getNextSecurityHeaders,
  applySecurityHeaders,
} from "@/config/security-headers";
import nextConfig from "../../next.config";
import {
  POST as cspReportPost,
  OPTIONS as cspReportOptions,
} from "@/app/api/csp-report/route";
import {
  sanitizeCspUrl,
  sanitizeSample,
  extractViolations,
} from "@/lib/security/csp-report";

describe("Security Headers & CSP Engine", () => {
  describe("buildContentSecurityPolicy", () => {
    it("includes all essential security baselines and required directives", () => {
      const csp = buildContentSecurityPolicy();

      // Essential browser restrictions
      assert.ok(csp.includes("default-src 'self'"), "Must have default-src 'self'");
      assert.ok(csp.includes("base-uri 'self'"), "Must have base-uri 'self'");
      assert.ok(csp.includes("object-src 'none'"), "Must have object-src 'none'");
      assert.ok(csp.includes("frame-ancestors 'none'"), "Must have frame-ancestors 'none'");
      assert.ok(csp.includes("form-action 'self'"), "Must have form-action 'self'");
    });

    it("whitelists required Next.js, Google OAuth, fonts, and media sources", () => {
      const csp = buildContentSecurityPolicy();

      // Script whitelist
      assert.ok(csp.includes("script-src"), "Must define script-src");
      assert.ok(csp.includes("https://accounts.google.com"), "Must whitelist Google accounts in script-src or connect-src");

      // Style & Font whitelist
      assert.ok(csp.includes("style-src"), "Must define style-src");
      assert.ok(csp.includes("https://fonts.googleapis.com"), "Must whitelist Google fonts in style-src");
      assert.ok(csp.includes("font-src"), "Must define font-src");
      assert.ok(csp.includes("https://fonts.gstatic.com"), "Must whitelist Google gstatic in font-src");

      // Image whitelist
      assert.ok(csp.includes("img-src"), "Must define img-src");
      assert.ok(csp.includes("data:"), "Must whitelist data: in img-src");
      assert.ok(csp.includes("blob:"), "Must whitelist blob: in img-src");
      assert.ok(csp.includes("https://lh3.googleusercontent.com"), "Must whitelist Google avatar domain in img-src");
      assert.ok(csp.includes("https://images.unsplash.com"), "Must whitelist Unsplash in img-src");

      // Connect & Report whitelist
      assert.ok(csp.includes("connect-src 'self'"), "Must include connect-src 'self'");
      assert.ok(csp.includes("report-uri /api/csp-report"), "Must configure report-uri to /api/csp-report");
    });

    it("allows custom directive additions without dropping base directives", () => {
      const csp = buildContentSecurityPolicy({
        extraScriptSrc: ["https://trusted-scripts.com"],
        extraImgSrc: ["https://trusted-cdn.com"],
        reportUri: "/custom-report-endpoint",
      });

      assert.ok(csp.includes("https://trusted-scripts.com"));
      assert.ok(csp.includes("https://trusted-cdn.com"));
      assert.ok(csp.includes("report-uri /custom-report-endpoint"));
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes("frame-ancestors 'none'"));
    });
  });

  describe("getSecurityHeaders", () => {
    it("returns Report-Only CSP and standard security headers in development", () => {
      const headers = getSecurityHeaders(false);

      // Report-Only CSP in Step 1 rollout
      assert.ok(headers["Content-Security-Policy-Report-Only"], "Must set Content-Security-Policy-Report-Only in dev");
      assert.strictEqual(headers["Content-Security-Policy"], undefined, "Must not set enforcing CSP by default");

      // Standard headers
      assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
      assert.strictEqual(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
      assert.strictEqual(headers["X-Frame-Options"], "DENY");
      assert.ok(headers["Permissions-Policy"].includes("camera=()"));
      assert.ok(headers["Permissions-Policy"].includes("microphone=()"));
      assert.ok(headers["Permissions-Policy"].includes("geolocation=()"));
      assert.ok(headers["Permissions-Policy"].includes("payment=()"));
      assert.strictEqual(headers["X-DNS-Prefetch-Control"], "on");
      assert.strictEqual(headers["X-XSS-Protection"], "0");

      // HSTS omitted in dev
      assert.strictEqual(headers["Strict-Transport-Security"], undefined);
    });

    it("enables Strict-Transport-Security in production", () => {
      const headers = getSecurityHeaders(true);

      assert.strictEqual(
        headers["Strict-Transport-Security"],
        "max-age=31536000; includeSubDomains; preload"
      );
      assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
      assert.strictEqual(headers["X-Frame-Options"], "DENY");
      assert.ok(headers["Content-Security-Policy-Report-Only"]);
    });

    it("enables HSTS when enableHsts is explicitly requested", () => {
      const headers = getSecurityHeaders(false, { enableHsts: true });
      assert.strictEqual(
        headers["Strict-Transport-Security"],
        "max-age=31536000; includeSubDomains; preload"
      );
    });

    it("switches to enforcing Content-Security-Policy when reportOnly is false", () => {
      const headers = getSecurityHeaders(false, { reportOnly: false });
      assert.strictEqual(headers["Content-Security-Policy-Report-Only"], undefined);
      assert.ok(headers["Content-Security-Policy"]);
      assert.ok(headers["Content-Security-Policy"].includes("default-src 'self'"));
    });
  });

  describe("getNextSecurityHeaders & applySecurityHeaders", () => {
    it("returns headers array suitable for next.config.ts headers()", () => {
      const nextHeaders = getNextSecurityHeaders(false);
      assert.ok(Array.isArray(nextHeaders));

      const headerMap = new Map(nextHeaders.map((h) => [h.key, h.value]));
      assert.strictEqual(headerMap.get("X-Content-Type-Options"), "nosniff");
      assert.strictEqual(headerMap.get("X-Frame-Options"), "DENY");
      assert.ok(headerMap.has("Content-Security-Policy-Report-Only"));
    });

    it("applies security headers onto a Web Response object", () => {
      const original = new Response("OK", { status: 200 });
      const secured = applySecurityHeaders(original, true);

      assert.strictEqual(secured.headers.get("X-Content-Type-Options"), "nosniff");
      assert.strictEqual(secured.headers.get("X-Frame-Options"), "DENY");
      assert.ok(secured.headers.get("Strict-Transport-Security")?.includes("max-age=31536000"));
      assert.ok(secured.headers.get("Content-Security-Policy-Report-Only")?.includes("default-src 'self'"));
    });
  });

  describe("next.config.ts Integration", () => {
    it("configures security headers for all routes in next.config.ts", async () => {
      assert.ok(typeof nextConfig.headers === "function");
      const rules = await nextConfig.headers!();

      // Find the /:path* rule
      const catchAllRule = rules.find((r) => r.source === "/:path*");
      assert.ok(catchAllRule, "next.config.ts must contain /:path* header configuration");

      const headerMap = new Map(catchAllRule.headers.map((h) => [h.key, h.value]));
      assert.strictEqual(headerMap.get("X-Content-Type-Options"), "nosniff");
      assert.strictEqual(headerMap.get("X-Frame-Options"), "DENY");
      assert.strictEqual(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
      assert.ok(headerMap.has("Content-Security-Policy-Report-Only"));
    });

    it("preserves service worker caching header configuration", async () => {
      const rules = await nextConfig.headers!();
      const swRule = rules.find((r) => r.source === "/sw.js");
      assert.ok(swRule, "Must preserve /sw.js configuration rule");

      const swMap = new Map(swRule.headers.map((h) => [h.key, h.value]));
      assert.strictEqual(swMap.get("Service-Worker-Allowed"), "/");
    });
  });

  describe("CSP Report Endpoint (/api/csp-report)", () => {
    it("handles legacy application/csp-report payload and returns 204", async () => {
      const payload = {
        "csp-report": {
          "document-uri": "https://eoffice.qcet.edu.vn/tasks?token=secret12345",
          "referrer": "https://eoffice.qcet.edu.vn/dashboard",
          "violated-directive": "script-src 'self'",
          "effective-directive": "script-src",
          "original-policy": "default-src 'self'",
          "disposition": "report",
          "blocked-uri": "https://malicious-cdn.example/evil.js?apiKey=999",
          "line-number": 42,
          "column-number": 15,
          "source-file": "https://eoffice.qcet.edu.vn/main.js",
          "status-code": 200,
          "script-sample": "alert(1)",
        },
      };

      const request = new Request("http://localhost:3000/api/csp-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/csp-report",
        },
        body: JSON.stringify(payload),
      });

      const response = await cspReportPost(request);
      assert.strictEqual(response.status, 204);
      assert.strictEqual(response.body, null);
    });

    it("handles application/json modern Reporting API payload and returns 204", async () => {
      const payload = [
        {
          type: "csp-violation",
          age: 5,
          url: "https://eoffice.qcet.edu.vn/login",
          body: {
            documentURL: "https://eoffice.qcet.edu.vn/login",
            blockedURL: "https://eval-script.example",
            effectiveDirective: "script-src",
            disposition: "report",
          },
        },
      ];

      const request = new Request("http://localhost:3000/api/csp-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const response = await cspReportPost(request);
      assert.strictEqual(response.status, 204);
    });

    it("handles empty body gracefully returning 204", async () => {
      const request = new Request("http://localhost:3000/api/csp-report", {
        method: "POST",
        body: "",
      });

      const response = await cspReportPost(request);
      assert.strictEqual(response.status, 204);
    });

    it("handles malformed JSON gracefully returning 400 Bad Request", async () => {
      const request = new Request("http://localhost:3000/api/csp-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ bad-json:",
      });

      const response = await cspReportPost(request);
      assert.strictEqual(response.status, 400);
      const json = await response.json();
      assert.strictEqual(json.error, "Invalid JSON report payload");
    });

    it("rejects oversized payload with 413 Payload Too Large", async () => {
      const largeString = "a".repeat(70 * 1024);
      const request = new Request("http://localhost:3000/api/csp-report", {
        method: "POST",
        body: largeString,
      });

      const response = await cspReportPost(request);
      assert.strictEqual(response.status, 413);
    });

    it("handles OPTIONS preflight method with 204 and CORS headers", async () => {
      const response = await cspReportOptions();
      assert.strictEqual(response.status, 204);
      assert.strictEqual(response.headers.get("Allow"), "POST, OPTIONS");
    });
  });

  describe("Sanitization Utilities", () => {
    it("sanitizeCspUrl redacts sensitive query parameters", () => {
      const urlWithToken = "https://qcet.edu.vn/api/tasks?token=supersecret&role=STAFF&api_key=123";
      const sanitized = sanitizeCspUrl(urlWithToken);

      assert.ok(!sanitized.includes("supersecret"), "Token value must be redacted");
      assert.ok(!sanitized.includes("123"), "api_key value must be redacted");
      assert.ok(sanitized.includes("role=STAFF"), "Non-sensitive parameter preserved");
      assert.ok(sanitized.includes("token=%5BREDACTED%5D") || sanitized.includes("token=[REDACTED]"));
    });

    it("sanitizeCspUrl handles relative and malformed URLs safely", () => {
      const relative = "/tasks?session=abc123xyz&unit=daotao";
      const sanitized = sanitizeCspUrl(relative);

      assert.ok(!sanitized.includes("abc123xyz"));
      assert.ok(sanitized.includes("unit=daotao"));
    });

    it("sanitizeSample truncates and cleans malicious code samples", () => {
      const dirty = "var x = 1;\x00\x07console.log('test');\n";
      const clean = sanitizeSample(dirty, 20);

      assert.ok(clean.length <= 25);
      assert.ok(!clean.includes("\x00"));
      assert.ok(!clean.includes("\x07"));
    });

    it("extractViolations normalizes legacy report structure", () => {
      const raw = {
        "csp-report": {
          "document-uri": "https://example.com/page?token=secret",
          "blocked-uri": "http://evil.com/x.js",
          "effective-directive": "script-src",
        },
      };

      const violations = extractViolations(raw);
      assert.strictEqual(violations.length, 1);
      assert.ok(!violations[0].documentUri?.includes("secret"));
      assert.strictEqual(violations[0].effectiveDirective, "script-src");
      assert.strictEqual(violations[0].blockedUri, "http://evil.com/x.js");
    });
  });
});
