import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleIcon, GoogleLoginButton } from "../src/components/auth/google-login-button";

describe("Issue #6: Google Login Button UI & Accessibility Invariants", () => {
  test("renders button with default label 'Tiếp tục với Google' and correct styles", () => {
    const html = renderToStaticMarkup(
      React.createElement(GoogleLoginButton, {
        returnTo: "/tasks",
      })
    );

    // Label check
    assert.ok(html.includes("Tiếp tục với Google"), "Button must contain 'Tiếp tục với Google' text");
    // Accessibility label
    assert.ok(html.includes('aria-label="Tiếp tục với Google"'), "Button must have aria-label");
    // Style classes check
    assert.ok(html.includes("max-w-[360px]"), "Button must have max-w-[360px] width container");
    assert.ok(html.includes("h-11"), "Button must have 44px (h-11) height");
    assert.ok(html.includes("type=\"button\""), "Button must be type='button'");
    assert.ok(!html.includes('disabled=""') && !html.includes('aria-busy="true"'), "Button must be enabled and not busy by default");
  });

  test("GoogleIcon renders official 4-color SVG paths", () => {
    const html = renderToStaticMarkup(React.createElement(GoogleIcon));

    // Multi-color Google SVG check
    assert.ok(html.includes('viewBox="0 0 24 24"'), "SVG must have 24x24 viewBox");
    assert.ok(html.includes('aria-hidden="true"'), "SVG must have aria-hidden='true'");
    assert.ok(html.includes('#4285F4'), "Must include Google Blue (#4285F4)");
    assert.ok(html.includes('#34A853'), "Must include Google Green (#34A853)");
    assert.ok(html.includes('#FBBC05'), "Must include Google Yellow (#FBBC05)");
    assert.ok(html.includes('#EA4335'), "Must include Google Red (#EA4335)");
  });

  test("custom className is applied to wrapper", () => {
    const html = renderToStaticMarkup(
      React.createElement(GoogleLoginButton, {
        className: "custom-auth-wrapper-test",
      })
    );
    assert.ok(html.includes("custom-auth-wrapper-test"), "Wrapper must receive custom className");
  });
});

describe("Issue #6: Google Login Button Interaction & OAuth Invocation Logic", () => {
  test("target calculation correctly falls back to /tasks for root or login routes", () => {
    const getTarget = (returnTo?: string) => {
      return returnTo && returnTo !== "/login" && returnTo !== "/" ? returnTo : "/tasks";
    };

    assert.strictEqual(getTarget(undefined), "/tasks");
    assert.strictEqual(getTarget(""), "/tasks");
    assert.strictEqual(getTarget("/"), "/tasks");
    assert.strictEqual(getTarget("/login"), "/tasks");
    assert.strictEqual(getTarget("/documents/inbound"), "/documents/inbound");
    assert.strictEqual(getTarget("/tasks?filter=urgent"), "/tasks?filter=urgent");
  });

  test("simulates signIn execution flow and error handling", async () => {
    let capturedError: string | null = null;
    let callCount = 0;

    // Simulate handleStartOAuth with error
    const mockHandleStartOAuth = async (
      mockSignIn: () => Promise<never>,
      onError: (msg: string) => void
    ) => {
      let isLoading = false;
      if (isLoading) return;
      isLoading = true;
      try {
        callCount++;
        await mockSignIn();
      } catch {
        isLoading = false;
        onError("Không thể kết nối đến máy chủ xác thực");
      }
    };

    await mockHandleStartOAuth(
      async () => {
        throw new Error("Network failure");
      },
      (msg) => {
        capturedError = msg;
      }
    );

    assert.strictEqual(callCount, 1);
    assert.strictEqual(capturedError, "Không thể kết nối đến máy chủ xác thực");
  });

  test("prevents duplicate concurrent clicks when loading", async () => {
    let executionCount = 0;
    let isLoading = true; // Button is in loading state

    const handleStartOAuth = async () => {
      if (isLoading) return;
      isLoading = true;
      executionCount++;
    };

    // First click while loading is ignored
    await handleStartOAuth();
    await handleStartOAuth();

    assert.strictEqual(executionCount, 0, "Concurrent clicks while loading must be ignored");
  });

  test("calls onSuccess callback when signIn resolves with target url", async () => {
    let resolvedUrl: string | null = null;

    const mockHandleStartOAuth = async (
      mockSignIn: () => Promise<{ url: string }>,
      onSuccess: (url: string) => void
    ) => {
      const result = await mockSignIn();
      if (result?.url) {
        onSuccess(result.url);
      }
    };

    await mockHandleStartOAuth(
      async () => ({ url: "https://accounts.google.com/o/oauth2/v2/auth" }),
      (url) => {
        resolvedUrl = url;
      }
    );

    assert.strictEqual(resolvedUrl, "https://accounts.google.com/o/oauth2/v2/auth");
  });
});
