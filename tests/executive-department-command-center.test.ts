import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import {
  QCET_12_DEPARTMENTS,
  computeExecutiveDepartmentSummaries,
  matchDepartmentForTask,
  isTaskOverdue,
  isTaskDueSoon,
  extractFocusInitiative,
  type DepartmentMetadata,
} from "../src/lib/tasks/executive-department-aggregator";
import {
  filterExecutiveDepartmentSummaries,
  getTriageFilterCounts,
  getRAGBadgeConfig,
  getPriorityBadgeConfig,
  getTaskStatusConfig,
  splitDepartmentTasks,
} from "../src/components/tasks/executive-department-command-center";
import {
  SCOPE_TABS,
  VIEW_MODE_OPTIONS,
  DEFAULT_AVAILABLE_DEPARTMENTS,
} from "../src/components/dashboard/unified-task-toolbar";

// ============================================================================
// Helpers
// ============================================================================

function createMockSchoolTask(
  overrides: Partial<SchoolTask> & { id: string; [key: string]: unknown }
): SchoolTask {
  return {
    title: `Nhiệm vụ kiểm thử ${overrides.id}`,
    category: "CNTT",
    categoryLabel: "Công nghệ thông tin",
    leadAssigneeName: "TS. Trần Văn Nam",
    leadDepartmentId: "KHOA_CNTT",
    leadDepartmentCode: "KHOA_CNTT",
    coAssignees: [],
    assignedDate: "2026-08-15",
    dueDate: "2026-09-15",
    status: "IN_PROGRESS",
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
    progressPercent: 65,
    ...overrides,
  };
}

function createMockStaffTask(overrides: Partial<StaffTask> & { id: string }): StaffTask {
  return {
    title: `Công việc nội bộ ${overrides.id}`,
    assigneeName: "Nguyễn Văn A",
    status: "IN_PROGRESS",
    dueDate: "2026-09-12",
    parentSchoolTaskId: "task-parent-1",
    updatedAt: "2026-09-01",
    ...overrides,
  };
}

// Comprehensive decorative emoji regex
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

describe("Executive Department Command Center: Anti-Slop & Design Compliance", () => {
  const targetSourceFiles = [
    "src/types/executive-command.ts",
    "src/lib/tasks/executive-department-aggregator.ts",
    "src/components/tasks/executive-department-command-center.tsx",
    "src/components/dashboard/unified-task-toolbar.tsx",
    "src/components/tasks/unified-task-toolbar.tsx",
  ];

  // --------------------------------------------------------------------------
  // 1. Anti-Slop: 0% Decorative Emojis
  // --------------------------------------------------------------------------
  describe("1. Anti-Slop: 0% Decorative Emojis", () => {
    test("All files in Tasks 1-4 contain zero decorative emojis", () => {
      const violations: string[] = [];

      for (const relPath of targetSourceFiles) {
        const fullPath = path.join(process.cwd(), relPath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          if (EMOJI_REGEX.test(line)) {
            violations.push(`${relPath}:${index + 1} -> ${line.trim()}`);
          }
        });
      }

      assert.strictEqual(
        violations.length,
        0,
        `Found decorative emojis in command center files:\n${violations.join("\n")}`
      );
    });

    test("Toolbar configuration constants contain zero decorative emojis", () => {
      SCOPE_TABS.forEach((tab) => {
        assert.ok(!EMOJI_REGEX.test(tab.label), `Scope tab contains emoji: ${tab.label}`);
      });

      VIEW_MODE_OPTIONS.forEach((opt) => {
        assert.ok(!EMOJI_REGEX.test(opt.label), `View mode option contains emoji: ${opt.label}`);
      });

      DEFAULT_AVAILABLE_DEPARTMENTS.forEach((dept) => {
        assert.ok(!EMOJI_REGEX.test(dept.name), `Department contains emoji: ${dept.name}`);
      });
    });

    test("QCET 12 official department names and titles contain zero decorative emojis", () => {
      QCET_12_DEPARTMENTS.forEach((dept) => {
        assert.ok(!EMOJI_REGEX.test(dept.name), `Department name contains emoji: ${dept.name}`);
        assert.ok(!EMOJI_REGEX.test(dept.head.name), `Head name contains emoji: ${dept.head.name}`);
        assert.ok(!EMOJI_REGEX.test(dept.head.title), `Head title contains emoji: ${dept.head.title}`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. Lucide Icon Stroke Width: 100% Explicit strokeWidth={1.5}
  // --------------------------------------------------------------------------
  describe("2. Lucide Icon Stroke Width Compliance", () => {
    test("100% of Lucide icon instances in executive-department-command-center.tsx specify strokeWidth={1.5}", () => {
      const filePath = path.join(
        process.cwd(),
        "src/components/tasks/executive-department-command-center.tsx"
      );
      assert.ok(fs.existsSync(filePath), "Component file must exist");
      const sourceCode = fs.readFileSync(filePath, "utf-8");

      const sourceFile = ts.createSourceFile(
        "executive-department-command-center.tsx",
        sourceCode,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );

      // Extract all imported names from 'lucide-react'
      const lucideIconNames = new Set<string>();

      function findImports(node: ts.Node) {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === "lucide-react"
        ) {
          if (node.importClause && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const spec of node.importClause.namedBindings.elements) {
              lucideIconNames.add(spec.name.text);
            }
          }
        }
        ts.forEachChild(node, findImports);
      }

      findImports(sourceFile);
      assert.ok(lucideIconNames.size > 0, "Must import Lucide icons");

      // Verify every JSX element using a Lucide icon explicitly sets strokeWidth={1.5}
      const iconOccurrences: { tag: string; hasValidStrokeWidth: boolean; line: number }[] = [];

      function checkJsxElement(node: ts.Node) {
        let tagName: string | null = null;
        let attributes: ts.JsxAttributes | null = null;

        if (ts.isJsxSelfClosingElement(node)) {
          if (ts.isIdentifier(node.tagName) && lucideIconNames.has(node.tagName.text)) {
            tagName = node.tagName.text;
            attributes = node.attributes;
          }
        } else if (ts.isJsxOpeningElement(node)) {
          if (ts.isIdentifier(node.tagName) && lucideIconNames.has(node.tagName.text)) {
            tagName = node.tagName.text;
            attributes = node.attributes;
          }
        }

        if (tagName && attributes) {
          let hasStrokeWidth15 = false;

          for (const prop of attributes.properties) {
            if (
              ts.isJsxAttribute(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === "strokeWidth"
            ) {
              if (prop.initializer) {
                // Check {1.5} expression or "1.5" string
                if (
                  ts.isJsxExpression(prop.initializer) &&
                  prop.initializer.expression &&
                  ts.isNumericLiteral(prop.initializer.expression) &&
                  prop.initializer.expression.text === "1.5"
                ) {
                  hasStrokeWidth15 = true;
                } else if (
                  ts.isStringLiteral(prop.initializer) &&
                  prop.initializer.text === "1.5"
                ) {
                  hasStrokeWidth15 = true;
                }
              }
            }
          }

          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          iconOccurrences.push({
            tag: tagName,
            hasValidStrokeWidth: hasStrokeWidth15,
            line: line + 1,
          });
        }

        ts.forEachChild(node, checkJsxElement);
      }

      checkJsxElement(sourceFile);

      assert.ok(
        iconOccurrences.length >= 15,
        `Expected at least 15 Lucide icon instances, found ${iconOccurrences.length}`
      );

      const missingStroke = iconOccurrences.filter((occ) => !occ.hasValidStrokeWidth);
      assert.strictEqual(
        missingStroke.length,
        0,
        `Found Lucide icons missing strokeWidth={1.5}:\n${missingStroke
          .map((m) => `Line ${m.line}: <${m.tag}>`)
          .join("\n")}`
      );
    });

    test("All Lucide icons in unified-task-toolbar.tsx explicitly specify strokeWidth={1.5}", () => {
      const filePath = path.join(
        process.cwd(),
        "src/components/dashboard/unified-task-toolbar.tsx"
      );
      assert.ok(fs.existsSync(filePath), "Unified task toolbar file must exist");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.ok(
        content.includes("strokeWidth={1.5}") || content.includes('strokeWidth="1.5"'),
        "unified-task-toolbar.tsx must define strokeWidth 1.5 for icons"
      );

      // Check specific icon tags in JSX
      const toolbarIcons = ["Building2", "Plus", "Search", "X", "Filter"];
      for (const icon of toolbarIcons) {
        const regex = new RegExp(`<${icon}[^>]*>`, "g");
        const matches = content.match(regex);
        if (matches) {
          for (const match of matches) {
            assert.ok(
              match.includes("strokeWidth={1.5}") || match.includes('strokeWidth="1.5"'),
              `<${icon}> in toolbar must have strokeWidth={1.5}: ${match}`
            );
          }
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Tabular Numerals & Monospace Font Compliance
  // --------------------------------------------------------------------------
  describe("3. Tabular Numerals & Monospace Font Compliance", () => {
    test("executive-department-command-center.tsx strictly enforces font-mono tabular-nums", () => {
      const filePath = path.join(
        process.cwd(),
        "src/components/tasks/executive-department-command-center.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify presence of classes
      assert.ok(content.includes("tabular-nums"), "Must contain tabular-nums for numeric precision");
      assert.ok(content.includes("font-mono"), "Must contain font-mono for metrics and codes");

      // Check key metric containers
      assert.ok(
        content.includes("font-mono tabular-nums") || content.includes("font-mono font-semibold tabular-nums"),
        "Must pair font-mono and tabular-nums together for metric values"
      );

      // Verify specific displays:
      // 1. Completion rate percentage
      assert.ok(
        content.includes("summary.metrics.completionRate}%") &&
          content.includes("tabular-nums font-semibold text-foreground"),
        "Completion rate percentage must have tabular-nums and font-semibold"
      );

      // 2. Metrics counts: inProgress, dueSoon, overdue
      assert.ok(
        content.includes("summary.metrics.inProgress") && content.includes("tabular-nums"),
        "inProgress metric must use tabular-nums"
      );
      assert.ok(
        content.includes("summary.metrics.dueSoon") && content.includes("tabular-nums"),
        "dueSoon metric must use tabular-nums"
      );
      assert.ok(
        content.includes("summary.metrics.overdue") && content.includes("tabular-nums"),
        "overdue metric must use tabular-nums"
      );

      // 3. Deadline display formatting
      assert.ok(
        content.includes("formatDeadlineDisplay(focus.dueDate)") &&
          content.includes("font-mono tabular-nums"),
        "Focus initiative deadline must use font-mono tabular-nums"
      );
      assert.ok(
        content.includes("formatDeadlineDisplay(task.dueDate)") &&
          content.includes("font-mono tabular-nums"),
        "Drilldown task row deadline must use font-mono tabular-nums"
      );

      // 4. Drill-down metric summary pill row
      assert.ok(
        content.includes("summary.metrics.totalTasks") && content.includes("tabular-nums"),
        "Drill-down totalTasks metric must use tabular-nums"
      );
      assert.ok(
        content.includes("summary.metrics.completed") && content.includes("tabular-nums"),
        "Drill-down completed metric must use tabular-nums"
      );

      // 5. Triage tab counter badges
      assert.ok(
        content.includes("triageCounts.all") && content.includes("tabular-nums"),
        "Triage tab 'all' count must use tabular-nums"
      );
      assert.ok(
        content.includes("triageCounts.bottlenecks") && content.includes("tabular-nums"),
        "Triage tab 'bottlenecks' count must use tabular-nums"
      );
      assert.ok(
        content.includes("triageCounts.pendingApproval") && content.includes("tabular-nums"),
        "Triage tab 'pendingApproval' count must use tabular-nums"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. RAG Semantic Color Mapping & Token Conformance
  // --------------------------------------------------------------------------
  describe("4. RAG Semantic Color Mapping & Token Conformance", () => {
    test("getRAGBadgeConfig returns calibrated QCET tokens for RED, AMBER, GREEN", () => {
      // RED: alert, rose/destructive palette, pulsing indicator
      const redConfig = getRAGBadgeConfig("RED");
      assert.equal(redConfig.label, "Báo động trễ");
      assert.ok(redConfig.className.includes("bg-rose-50"));
      assert.ok(redConfig.className.includes("text-rose-700"));
      assert.ok(redConfig.className.includes("border-rose-200"));
      assert.equal(redConfig.dotColor, "bg-rose-500");
      assert.strictEqual(redConfig.pulse, true, "RED alert must have pulsing dot");

      // AMBER: warning, amber palette, non-pulsing
      const amberConfig = getRAGBadgeConfig("AMBER");
      assert.equal(amberConfig.label, "Cần chú ý");
      assert.ok(amberConfig.className.includes("bg-amber-50"));
      assert.ok(amberConfig.className.includes("text-amber-700"));
      assert.ok(amberConfig.className.includes("border-amber-200"));
      assert.equal(amberConfig.dotColor, "bg-amber-500");
      assert.strictEqual(amberConfig.pulse, false);

      // GREEN: healthy, emerald/primary palette, non-pulsing
      const greenConfig = getRAGBadgeConfig("GREEN");
      assert.equal(greenConfig.label, "Đúng hạn");
      assert.ok(greenConfig.className.includes("bg-emerald-50"));
      assert.ok(greenConfig.className.includes("text-emerald-700"));
      assert.ok(greenConfig.className.includes("border-emerald-200"));
      assert.equal(greenConfig.dotColor, "bg-emerald-500");
      assert.strictEqual(greenConfig.pulse, false);
    });

    test("Priority badge configs conform to QCET semantic design tokens", () => {
      const high = getPriorityBadgeConfig("HIGH");
      assert.equal(high.label, "Ưu tiên cao");
      assert.ok(high.className.includes("bg-rose-50"));
      assert.ok(high.className.includes("text-rose-700"));

      const med = getPriorityBadgeConfig("MEDIUM");
      assert.equal(med.label, "Trung bình");
      assert.ok(med.className.includes("bg-amber-50"));
      assert.ok(med.className.includes("text-amber-700"));

      const low = getPriorityBadgeConfig("LOW");
      assert.equal(low.label, "Tiêu chuẩn");
      assert.ok(low.className.includes("bg-slate-50"));
    });

    test("Task status semantic configs map properly to QCET design tokens", () => {
      const completed = getTaskStatusConfig("COMPLETED");
      assert.equal(completed.label, "Hoàn thành");
      assert.ok(completed.className.includes("emerald"));

      const blocked = getTaskStatusConfig("BLOCKED");
      assert.equal(blocked.label, "Bị nghẽn");
      assert.ok(blocked.className.includes("rose"));

      const pendingExec = getTaskStatusConfig("PENDING_EXECUTIVE_APPROVAL");
      assert.equal(pendingExec.label, "Chờ BGH duyệt");
      assert.ok(pendingExec.className.includes("purple"));

      const inProgress = getTaskStatusConfig("IN_PROGRESS");
      assert.equal(inProgress.label, "Đang thực hiện");
      assert.ok(inProgress.className.includes("blue"));
    });

    test("Aggregator assigns RAG status correctly based on threshold logic", () => {
      const refDate = "2026-09-06";

      // 1. Department with overdue tasks -> RED
      const overdueTask = createMockSchoolTask({
        id: "task-overdue",
        dueDate: "2026-09-01", // Overdue relative to 2026-09-06
        status: "IN_PROGRESS",
        leadDepartmentId: "KHOA_CNTT",
      });
      const overdueSummaries = computeExecutiveDepartmentSummaries([overdueTask], refDate);
      const cnttSummary = overdueSummaries.find((s) => s.departmentId === "KHOA_CNTT");
      assert.ok(cnttSummary);
      assert.equal(cnttSummary.ragStatus, "RED");
      assert.ok(cnttSummary.metrics.overdue >= 1);

      // 2. Department with due soon tasks (<= 3 days) -> AMBER
      const dueSoonTask = createMockSchoolTask({
        id: "task-duesoon",
        dueDate: "2026-09-08", // 2 days from 2026-09-06
        status: "IN_PROGRESS",
        leadDepartmentId: "KHOA_DIEN",
      });
      const dueSoonSummaries = computeExecutiveDepartmentSummaries([dueSoonTask], refDate);
      const dienSummary = dueSoonSummaries.find((s) => s.departmentId === "KHOA_DIEN");
      assert.ok(dienSummary);
      assert.equal(dienSummary.ragStatus, "AMBER");
      assert.ok(dienSummary.metrics.dueSoon >= 1);

      // 3. Department with healthy tasks (completionRate >= 60, no overdue) -> GREEN
      const healthyTask = createMockSchoolTask({
        id: "task-healthy",
        dueDate: "2026-09-25",
        status: "IN_PROGRESS",
        progressPercent: 75,
        leadDepartmentId: "KHOA_CK",
      });
      const healthySummaries = computeExecutiveDepartmentSummaries([healthyTask], refDate);
      const ckSummary = healthySummaries.find((s) => s.departmentId === "KHOA_CK");
      assert.ok(ckSummary);
      assert.equal(ckSummary.ragStatus, "GREEN");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Stanford / Workday Higher Ed Governance Features
  // --------------------------------------------------------------------------
  describe("5. Stanford / Workday Higher Ed Governance Features", () => {
    test("Official 12 QCET Departments mapped with Heads of Department", () => {
      // Must have exactly 12 official departments
      assert.equal(
        QCET_12_DEPARTMENTS.length,
        12,
        "QCET must map exactly 12 official departments"
      );

      const expectedCodes = [
        "KHOA_CNTT",
        "KHOA_DIEN",
        "KHOA_CK",
        "KHOA_XD",
        "KHOA_KTO",
        "KHOA_SP",
        "PHONG_DT",
        "PHONG_HCQT",
        "PHONG_KHTC",
        "PHONG_CTHSSV",
        "TT_TTTV",
        "TT_NNTH",
      ];

      const actualCodes = QCET_12_DEPARTMENTS.map((d) => d.code);
      assert.deepEqual(actualCodes, expectedCodes);

      // Verify every department has complete leadership metadata
      QCET_12_DEPARTMENTS.forEach((dept) => {
        assert.ok(dept.id, `Department ID missing for ${dept.code}`);
        assert.ok(dept.code, `Department Code missing for ${dept.id}`);
        assert.ok(dept.name.length > 5, `Department Name too short for ${dept.code}`);
        assert.ok(dept.head.name.length > 3, `Head name missing for ${dept.code}`);
        assert.ok(dept.head.title.length > 3, `Head title missing for ${dept.code}`);
        assert.ok(dept.head.email?.endsWith("@qcet.edu.vn"), `Official email missing for ${dept.code}`);
        assert.ok(dept.aliases.length > 0, `Aliases missing for ${dept.code}`);
        assert.ok(dept.keywords.length > 0, `Keywords missing for ${dept.code}`);
      });

      // Verify faculties (6), functional departments (4), and service centers (2)
      const faculties = QCET_12_DEPARTMENTS.filter((d) => d.id.startsWith("KHOA_"));
      const functionalDepts = QCET_12_DEPARTMENTS.filter((d) => d.id.startsWith("PHONG_"));
      const centers = QCET_12_DEPARTMENTS.filter((d) => d.id.startsWith("TT_"));

      assert.equal(faculties.length, 6, "Must have 6 faculties (Khoa)");
      assert.equal(functionalDepts.length, 4, "Must have 4 functional rooms (Phòng)");
      assert.equal(centers.length, 2, "Must have 2 centers (Trung tâm)");
    });

    test("Distinct separation of School-level vs Unit-level task scopes", () => {
      const mockSchoolTask1 = createMockSchoolTask({
        id: "school-task-1",
        title: "Triển khai kiểm định chất lượng cấp trường",
        leadDepartmentId: "KHOA_CNTT",
        subTasks: [
          createMockStaffTask({
            id: "sub-internal-1",
            title: "Thu thập hồ sơ minh chứng tiêu chí 1",
            assigneeName: "Nguyễn Văn A",
          }),
          createMockStaffTask({
            id: "sub-internal-2",
            title: "Rà soát đề cương môn học",
            assigneeName: "Lê Văn B",
          }),
        ],
      });

      const mockUnitTask = createMockSchoolTask({
        id: "unit-task-only",
        title: "Họp chuyên môn tổ bộ môn Phần mềm",
        leadDepartmentId: "KHOA_CNTT",
        scope: "UNIT" as unknown as undefined,
      });

      const { schoolTasks, unitTasks } = splitDepartmentTasks([mockSchoolTask1, mockUnitTask]);

      // School tasks should include the school-level task
      assert.ok(schoolTasks.some((t) => t.id === "school-task-1"));
      assert.ok(!schoolTasks.some((t) => t.id === "unit-task-only"));

      // Unit tasks should include the unit-scoped task AND the subtasks
      assert.ok(unitTasks.some((t) => t.id === "unit-task-only"));
      assert.ok(unitTasks.some((t) => t.id === "sub-internal-1"));
      assert.ok(unitTasks.some((t) => t.id === "sub-internal-2"));
      assert.equal(unitTasks.length, 3);
    });

    test("Department summaries calculate separate schoolLevelTaskCount and unitLevelTaskCount", () => {
      const taskWithSubs = createMockSchoolTask({
        id: "task-with-subs",
        leadDepartmentId: "PHONG_DT",
        subTasks: [
          createMockStaffTask({ id: "sub-1" }),
          createMockStaffTask({ id: "sub-2" }),
          createMockStaffTask({ id: "sub-3" }),
        ],
      });

      const summaries = computeExecutiveDepartmentSummaries([taskWithSubs]);
      const dtSummary = summaries.find((s) => s.departmentId === "PHONG_DT");

      assert.ok(dtSummary);
      assert.equal(dtSummary.schoolLevelTaskCount, 1, "School-level task count should be 1");
      assert.equal(dtSummary.unitLevelTaskCount, 3, "Unit-level internal subtask count should be 3");
    });

    test("Quick Triage Tabs for executive bottleneck identification", () => {
      const taskOverdue = createMockSchoolTask({
        id: "bottleneck-task",
        leadDepartmentId: "KHOA_XD",
        dueDate: "2026-08-20",
        status: "IN_PROGRESS",
      });

      const taskPendingApproval = createMockSchoolTask({
        id: "approval-task",
        leadDepartmentId: "PHONG_HCQT",
        dueDate: "2026-09-20",
        status: "PENDING_EXECUTIVE_APPROVAL",
        progressPercent: 100,
      });

      const taskNormal = createMockSchoolTask({
        id: "normal-task",
        leadDepartmentId: "TT_TTTV",
        dueDate: "2026-09-25",
        status: "IN_PROGRESS",
        progressPercent: 80,
      });

      const summaries = computeExecutiveDepartmentSummaries([
        taskOverdue,
        taskPendingApproval,
        taskNormal,
      ]);

      // 1. Check getTriageFilterCounts
      const counts = getTriageFilterCounts(summaries);
      assert.equal(counts.all, 12, "All tab must show all 12 departments");
      assert.ok(counts.bottlenecks >= 1, "Must detect at least 1 bottleneck department");
      assert.ok(counts.pendingApproval >= 1, "Must detect at least 1 pending approval department");

      // 2. Check filterExecutiveDepartmentSummaries("ALL")
      const allFiltered = filterExecutiveDepartmentSummaries(summaries, "ALL");
      assert.equal(allFiltered.length, 12);

      // 3. Check filterExecutiveDepartmentSummaries("BOTTLENECKS")
      const bottleneckFiltered = filterExecutiveDepartmentSummaries(summaries, "BOTTLENECKS");
      assert.ok(
        bottleneckFiltered.every(
          (s) => s.ragStatus === "RED" || s.metrics.overdue > 0
        ),
        "Every department in bottlenecks filter must have RED status or overdue tasks"
      );
      assert.ok(
        bottleneckFiltered.some((s) => s.departmentId === "KHOA_XD"),
        "KHOA_XD must be caught in bottlenecks triage tab"
      );

      // 4. Check filterExecutiveDepartmentSummaries("PENDING_APPROVAL")
      const pendingFiltered = filterExecutiveDepartmentSummaries(summaries, "PENDING_APPROVAL");
      assert.ok(
        pendingFiltered.every((s) => s.pendingApprovalCount > 0),
        "Every department in pending approval filter must have pendingApprovalCount > 0"
      );
      assert.ok(
        pendingFiltered.some((s) => s.departmentId === "PHONG_HCQT"),
        "PHONG_HCQT must be caught in pending approval triage tab"
      );
    });

    test("Focus Initiative resolves highest priority urgent task for department", () => {
      const lowPrioTask = createMockSchoolTask({
        id: "prio-low",
        title: "Nhiệm vụ định kỳ",
        dueDate: "2026-09-30",
        progressPercent: 90,
      });

      const urgentTask = createMockSchoolTask({
        id: "prio-urgent",
        title: "Khẩn: Chuẩn bị kiểm định quốc tế",
        dueDate: "2026-09-07",
        progressPercent: 20,
      });

      const focus = extractFocusInitiative([lowPrioTask, urgentTask], "2026-09-06");
      assert.ok(focus);
      assert.equal(focus.taskId, "prio-urgent", "Focus initiative should prioritize urgent lagging task");
      assert.equal(focus.priority, "HIGH");
    });
  });
});
