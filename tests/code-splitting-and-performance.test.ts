import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { clientTelemetry } from "../src/telemetry/client.js";
import { recordNextWebVital, SUPPORTED_WEB_VITALS } from "../src/components/telemetry/web-vitals-reporter.js";
import {
  useDashboardNav,
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "../src/components/dashboard/dashboard-context.js";
import { useTaskFilters, useTaskMutations } from "../src/components/workspace/unified-adaptive-workspace.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

test("Phase 16: Dynamic imports configured for heavy surfaces", () => {
  // 1. app-shell.tsx -> CommandSearchModal
  const appShellPath = path.join(ROOT_DIR, "src/components/layout/app-shell.tsx");
  const appShellCode = fs.readFileSync(appShellPath, "utf-8");
  assert.match(
    appShellCode,
    /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/layout\/command-search-modal["']\)\.then\(\(mod\)\s*=>\s*mod\.CommandSearchModal\),\s*\{\s*ssr:\s*false\s*\}\s*\)/,
    "app-shell.tsx must dynamic import CommandSearchModal with ssr: false"
  );
  assert.ok(
    !appShellCode.includes('import { CommandSearchModal } from "@/components/layout/command-search-modal"'),
    "app-shell.tsx must not statically import CommandSearchModal"
  );

  // 2. document-split-view.tsx -> DocumentPdfViewer
  const splitViewPath = path.join(ROOT_DIR, "src/components/documents/document-split-view.tsx");
  const splitViewCode = fs.readFileSync(splitViewPath, "utf-8");
  assert.match(
    splitViewCode,
    /dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/document-pdf-viewer["']\)\.then\(\(mod\)\s*=>\s*mod\.DocumentPdfViewer\)/,
    "document-split-view.tsx must dynamic import DocumentPdfViewer"
  );
  assert.ok(
    !splitViewCode.includes('import { DocumentPdfViewer } from "./document-pdf-viewer"'),
    "document-split-view.tsx must not statically import DocumentPdfViewer"
  );
  assert.match(
    splitViewCode,
    /role=["']status["']/,
    "document-split-view.tsx DocumentPdfViewer loading fallback must include role='status'"
  );
  assert.match(
    splitViewCode,
    /aria-live=["']polite["']/,
    "document-split-view.tsx DocumentPdfViewer loading fallback must include aria-live='polite'"
  );

  // 3. document-registry-view.tsx -> DocumentPdfViewer
  const registryViewPath = path.join(ROOT_DIR, "src/components/documents/document-registry-view.tsx");
  const registryViewCode = fs.readFileSync(registryViewPath, "utf-8");
  assert.match(
    registryViewCode,
    /dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/document-pdf-viewer["']\)\.then\(\(mod\)\s*=>\s*mod\.DocumentPdfViewer\)/,
    "document-registry-view.tsx must dynamic import DocumentPdfViewer"
  );
  assert.ok(
    !registryViewCode.includes('import { DocumentPdfViewer } from "./document-pdf-viewer"'),
    "document-registry-view.tsx must not statically import DocumentPdfViewer"
  );
  assert.match(
    registryViewCode,
    /role=["']status["']/,
    "document-registry-view.tsx DocumentPdfViewer loading fallback must include role='status'"
  );
  assert.match(
    registryViewCode,
    /aria-live=["']polite["']/,
    "document-registry-view.tsx DocumentPdfViewer loading fallback must include aria-live='polite'"
  );

  // 4. unified-adaptive-workspace.tsx -> CreateTaskModal, ReviewActionDialog, SubmitDeliverableModal
  const workspacePath = path.join(ROOT_DIR, "src/components/workspace/unified-adaptive-workspace.tsx");
  const workspaceCode = fs.readFileSync(workspacePath, "utf-8");
  assert.match(
    workspaceCode,
    /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/dashboard\/create-task-modal["']\)\.then\(\(mod\)\s*=>\s*mod\.CreateTaskModal\),\s*\{\s*ssr:\s*false\s*\}\s*\)/,
    "unified-adaptive-workspace.tsx must dynamic import CreateTaskModal with ssr: false"
  );
  assert.match(
    workspaceCode,
    /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/portal\/review-action-dialog["']\)\.then\(\(mod\)\s*=>\s*mod\.ReviewActionDialog\),\s*\{\s*ssr:\s*false\s*\}\s*\)/,
    "unified-adaptive-workspace.tsx must dynamic import ReviewActionDialog with ssr: false"
  );
  assert.match(
    workspaceCode,
    /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/portal\/submit-deliverable-modal["']\)\.then\(\(mod\)\s*=>\s*mod\.SubmitDeliverableModal\),\s*\{\s*ssr:\s*false\s*\}\s*\)/,
    "unified-adaptive-workspace.tsx must dynamic import SubmitDeliverableModal with ssr: false"
  );

  // 5. task-management-workspace.tsx -> No eager static component imports (protecting route JS budget)
  const taskWorkspacePath = path.join(ROOT_DIR, "src/components/tasks/task-management-workspace.tsx");
  const taskWorkspaceCode = fs.readFileSync(taskWorkspacePath, "utf-8");
  assert.ok(
    !/import\s+{[^}]*\bCreateTaskModal\b[^}]*}\s+from/.test(taskWorkspaceCode),
    "task-management-workspace.tsx must not statically import CreateTaskModal"
  );
  assert.ok(
    !/import\s+{[^}]*\bModularCascadingTaskTable\b[^}]*}\s+from/.test(taskWorkspaceCode),
    "task-management-workspace.tsx must not statically import ModularCascadingTaskTable"
  );
  assert.ok(
    !/import\s+{[^}]*\bTaskKanbanBoard\b[^}]*}\s+from/.test(taskWorkspaceCode),
    "task-management-workspace.tsx must not statically import TaskKanbanBoard"
  );
  assert.ok(
    !/import\s+{[^}]*\bTaskDetailSideSheet\b[^}]*}\s+from/.test(taskWorkspaceCode),
    "task-management-workspace.tsx must not statically import TaskDetailSideSheet"
  );
  assert.ok(
    !/import\s+{[^}]*\bUnassignedDepartmentState\b[^}]*}\s+from/.test(taskWorkspaceCode),
    "task-management-workspace.tsx must not statically import UnassignedDepartmentState"
  );
  assert.match(
    taskWorkspaceCode,
    /import\s+type\s+{\s*CreateTaskFormData\s*}\s+from\s+["']@\/components\/dashboard\/create-task-modal["']/,
    "task-management-workspace.tsx must import CreateTaskFormData only as a type"
  );
});

test("Phase 14 & Phase 15: Component and Context Decomposition exports verified", () => {
  assert.equal(typeof useDashboardNav, "function", "useDashboardNav hook must be exported");
  assert.equal(typeof useDashboardData, "function", "useDashboardData hook must be exported");
  assert.equal(typeof useDashboardActions, "function", "useDashboardActions hook must be exported");
  assert.equal(typeof useDashboardModal, "function", "useDashboardModal hook must be exported");

  assert.equal(typeof useTaskFilters, "function", "useTaskFilters sub-hook must be exported");
  assert.equal(typeof useTaskMutations, "function", "useTaskMutations sub-hook must be exported");
});

test("Phase 17: PERFORMANCE_BUDGETS.md exists and defines valid thresholds", () => {
  const budgetPath = path.join(ROOT_DIR, "docs/architecture/PERFORMANCE_BUDGETS.md");
  assert.ok(fs.existsSync(budgetPath), "PERFORMANCE_BUDGETS.md must exist in docs/architecture/");

  const content = fs.readFileSync(budgetPath, "utf-8");

  // Verify specified thresholds are documented
  assert.match(content, /INP.*200\s*ms/i, "Must document INP <= 200ms");
  assert.match(content, /LCP.*2500\s*ms/i, "Must document LCP <= 2500ms");
  assert.match(content, /CLS.*0\.1/i, "Must document CLS <= 0.1");
  assert.match(content, /Initial JS.*150\s*KB/i, "Must document Route Initial JS budget <= 150KB");
  assert.match(content, /API.*(?:latency|p95).*300\s*ms|300\s*ms.*API/i, "Must document API p95 latency <= 300ms");
  assert.match(content, /Database.*(?:latency|p95).*100\s*ms|100\s*ms.*Database/i, "Must document Database query p95 latency <= 100ms");
});

test("Phase 17: WebVitalsReporter maps web vitals metrics to clientTelemetry", () => {
  clientTelemetry.setEnabled(true);
  const initialLength = clientTelemetry.getQueueLength();

  // Test supported web vitals
  assert.ok(SUPPORTED_WEB_VITALS.includes("LCP"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("INP"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("CLS"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("FCP"));
  assert.ok(SUPPORTED_WEB_VITALS.includes("TTFB"));

  // 1. Record valid LCP
  const lcpSuccess = recordNextWebVital({
    id: "vital-lcp-test-1",
    name: "LCP",
    startTime: 1200,
    value: 1540.24,
    navigationType: "navigate",
  });
  assert.equal(lcpSuccess, true, "LCP metric should be accepted");

  // 2. Record valid INP
  const inpSuccess = recordNextWebVital({
    id: "vital-inp-test-1",
    name: "INP",
    startTime: 2000,
    value: 85.6,
  });
  assert.equal(inpSuccess, true, "INP metric should be accepted");

  // 3. Record valid CLS
  const clsSuccess = recordNextWebVital({
    id: "vital-cls-test-1",
    name: "CLS",
    startTime: 3000,
    value: 0.02456,
  });
  assert.equal(clsSuccess, true, "CLS metric should be accepted");

  // 4. Reject invalid metric name
  const invalidSuccess = recordNextWebVital({
    id: "vital-unknown",
    name: "UNKNOWN_METRIC",
    startTime: 100,
    value: 50,
  });
  assert.equal(invalidSuccess, false, "Unknown metric should be rejected");

  // 5. Reject invalid negative value
  const negativeSuccess = recordNextWebVital({
    id: "vital-negative",
    name: "LCP",
    startTime: 100,
    value: -10,
  });
  assert.equal(negativeSuccess, false, "Negative value should be rejected");

  assert.equal(
    clientTelemetry.getQueueLength(),
    initialLength + 3,
    "Queue length should increase by exactly 3 accepted metrics"
  );
});
