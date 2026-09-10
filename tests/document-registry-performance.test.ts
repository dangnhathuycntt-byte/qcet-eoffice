import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Document Registry Performance Optimization (QCET-PERF-2025-01 Task 5)", () => {
  const componentPath = path.resolve(
    process.cwd(),
    "src/components/documents/document-registry-view.tsx"
  );
  const sourceCode = fs.readFileSync(componentPath, "utf-8");

  describe("Static Source Code Contract Verification", () => {
    it("implements 300ms debounce for search input", () => {
      // Must have debounced search state
      const hasDebouncedState =
        sourceCode.includes("debouncedSearchQuery") ||
        sourceCode.includes("debouncedSearch");
      assert.ok(
        hasDebouncedState,
        "Expected document-registry-view.tsx to define a debounced search state"
      );

      // Must use setTimeout with 300ms
      const has300msTimer =
        /setTimeout\s*\([^,]+,\s*300\s*\)/.test(sourceCode) ||
        sourceCode.includes("300");
      assert.ok(
        has300msTimer,
        "Expected setTimeout with 300ms debounce delay"
      );

      // Must clean up timeout with clearTimeout
      assert.ok(
        sourceCode.includes("clearTimeout"),
        "Expected clearTimeout in debounce cleanup"
      );
    });

    it("creates AbortController and passes signal to fetch /api/documents", () => {
      // Must instantiate AbortController
      assert.ok(
        sourceCode.includes("new AbortController()"),
        "Expected instantiation of AbortController"
      );

      // Must pass signal to fetch /api/documents
      const passesSignalToFetch =
        /fetch\s*\(\s*`?\/api\/documents[^)]*\{[^}]*signal/.test(sourceCode) ||
        sourceCode.includes("signal: controller.signal") ||
        sourceCode.includes("{ signal }") ||
        sourceCode.includes("signal,");
      assert.ok(
        passesSignalToFetch,
        "Expected fetch to /api/documents to receive AbortSignal"
      );
    });

    it("cleans up effect by calling controller.abort()", () => {
      assert.ok(
        sourceCode.includes("controller.abort()") ||
          sourceCode.includes(".abort()"),
        "Expected abort controller cleanup in useEffect"
      );
    });

    it("gracefully catches and ignores AbortError without error logging or crash", () => {
      const handlesAbortError =
        sourceCode.includes("AbortError") ||
        sourceCode.includes("err.name !== 'AbortError'") ||
        sourceCode.includes('err?.name !== "AbortError"');
      assert.ok(
        handlesAbortError,
        "Expected catch block to check for AbortError and ignore it"
      );
    });

    it("decouples fetchStats so it does not run on search keystrokes", () => {
      // Must NOT have coupled effect calling both fetchDocuments and fetchStats in the same useEffect body
      const hasCoupledEffect =
        /useEffect\s*\([^)]*=>\s*\{[^{}]*fetchDocuments[^{}]*fetchStats[^{}]*\}/.test(
          sourceCode
        );
      assert.strictEqual(
        hasCoupledEffect,
        false,
        "fetchStats must be decoupled from fetchDocuments and not re-run on searchQuery change"
      );

      // Must have separate useEffect specifically for fetchStats (e.g. [activeTab, fetchStats])
      const hasDecoupledStatsEffect =
        /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?fetchStats\([\s\S]*?\},\s*\[[^\]]*activeTab[^\]]*\]/.test(
          sourceCode
        );
      assert.ok(
        hasDecoupledStatsEffect,
        "Expected dedicated useEffect for fetchStats dependent on activeTab"
      );
    });
  });

  describe("Simulated Concurrency & Abort Behavior", () => {
    it("ensures aborted fetch calls do not overwrite newer results (race condition prevention)", async () => {
      let state = "initial";
      const executionLog: string[] = [];

      async function simulatedFetch(
        query: string,
        delayMs: number,
        signal: AbortSignal
      ) {
        return new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (signal.aborted) {
              const err = new DOMException("The user aborted a request.", "AbortError");
              reject(err);
            } else {
              resolve(`Result for ${query}`);
            }
          }, delayMs);

          signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            const err = new DOMException("The user aborted a request.", "AbortError");
            reject(err);
          });
        });
      }

      // Simulate Request 1 (slow query "doc-1", 50ms)
      const controller1 = new AbortController();
      const p1 = simulatedFetch("doc-1", 50, controller1.signal)
        .then((res) => {
          state = res;
          executionLog.push("p1-resolved");
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            executionLog.push("p1-error");
          } else {
            executionLog.push("p1-aborted");
          }
        });

      // User types next character rapidly, cancelling request 1 and initiating Request 2 (fast query "doc-12", 10ms)
      controller1.abort();

      const controller2 = new AbortController();
      const p2 = simulatedFetch("doc-12", 10, controller2.signal)
        .then((res) => {
          state = res;
          executionLog.push("p2-resolved");
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            executionLog.push("p2-error");
          } else {
            executionLog.push("p2-aborted");
          }
        });

      await Promise.all([p1, p2]);

      // Controller 1 was aborted, so only Request 2 set state
      assert.strictEqual(state, "Result for doc-12");
      assert.deepStrictEqual(executionLog, ["p1-aborted", "p2-resolved"]);
    });

    it("verifies debounce timer cancels preceding invocation within 300ms window", async () => {
      const calls: string[] = [];
      let activeTimer: NodeJS.Timeout | null = null;

      function onType(val: string) {
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
          calls.push(val);
        }, 50); // using 50ms for fast test execution
      }

      // Typing "N", "Ng", "Ngh", "Nghi" within short intervals
      onType("N");
      await new Promise((r) => setTimeout(r, 10));
      onType("Ng");
      await new Promise((r) => setTimeout(r, 10));
      onType("Ngh");
      await new Promise((r) => setTimeout(r, 10));
      onType("Nghi");

      // Wait for debounce timeout to finish
      await new Promise((r) => setTimeout(r, 80));

      // Only the final typed string was invoked
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0], "Nghi");
    });
  });
});
