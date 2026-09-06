# DACUM AI-Assisted Approval & Bottleneck Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hệ thống phê duyệt thông minh DACUM gồm AI Executive Review Assistant, Hộp thư tiếp nhận Triage Queue và Cảnh báo quá hạn Escalation Timers, tuân thủ Nghị định 232 và Zero Emojis Policy.

**Architecture:** Bổ sung các pure functions vào `src/lib/dacum-workflow-engine.ts` và `src/lib/collaboration-manager.ts` để phân loại rủi ro minh chứng, xử lý tiếp nhận liên phòng ban và kích hoạt leo thang SLA 48h. Tích hợp giao diện tại `src/components/dashboard/task-detail-side-sheet.tsx` với thẻ AI Executive Brief và các nút tác vụ 1-click, đồng thời cập nhật `src/components/dashboard/executive-stat-strip.tsx`.

**Tech Stack:** TypeScript, React, Lucide React (strokeWidth 1.5), Tailwind CSS, Node.js Test Runner (`node:test`, `node:assert/strict`, `tsx`).

**Spec:** `docs/superpowers/specs/2026-09-06-dacum-ai-approval-workflow-design.md`

## Global Constraints

- Zero decorative emojis policy across all files, components, test strings, and log outputs.
- Adhere to Decree 232/2026/NĐ-CP administrative hierarchy: ADMIN (Ban Giám hiệu), MANAGER (Trưởng đơn vị), STAFF (Viên chức/Giảng viên).
- Strict non-breaking backward compatibility with existing 518 audit tests in `tests/dacum-integration-audit.test.ts`.
- Tabular numerals (`tabular-nums` / font-variant-numeric: tabular-nums) applied to numeric metrics and dates.
- Lucide icon stroke widths strictly adhere to 1.5 standard.

---

### Task 1: Type Definitions & Data Model Expansion

**Files:**
- Modify: `src/types/dashboard.ts`
- Test: `tests/dacum-ai-workflow-types.test.ts`

**Interfaces:**
- Produces: `AIRiskStatus`, `AISuggestedAction`, `TriageStatus`, `AIFlagItem`, `AIReviewSummary`, `EscalationMeta`, expanded `StaffTask` and `DashboardStats`.

- [ ] **Step 1: Write the failing type verification test**

```typescript
// tests/dacum-ai-workflow-types.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  StaffTask,
  AIReviewSummary,
  EscalationMeta,
  TriageStatus,
  AIRiskStatus,
  AISuggestedAction,
} from "../src/types/dashboard";

describe("DACUM AI Workflow Types Verification", () => {
  test("defines all required AI review and escalation types cleanly", () => {
    const aiReview: AIReviewSummary = {
      status: "CLEAN",
      executiveSummary: "Minh chứng đầy đủ theo chuẩn DACUM.",
      complianceScore: 95,
      dacumCriteriaMatched: ["Đề cương chi tiết", "Biên bản họp bộ môn"],
      flags: [{ type: "INFO", message: "Đã nộp đúng hạn." }],
      suggestedAction: "QUICK_APPROVE",
      analyzedAt: new Date().toISOString(),
      suggestedFeedback: "Nghiệm thu đạt yêu cầu.",
    };

    const escalation: EscalationMeta = {
      submittedForReviewAt: new Date().toISOString(),
      reviewDeadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      isEscalated: false,
    };

    const task: StaffTask = {
      id: "test-task-01",
      title: "Xây dựng ngân hàng đề thi môn Mạng máy tính",
      assigneeName: "Nguyễn Văn A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-30",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      triageStatus: "ACCEPTED",
      aiReview,
      escalation,
    };

    assert.equal(task.aiReview?.status, "CLEAN");
    assert.equal(task.escalation?.isEscalated, false);
    assert.equal(task.triageStatus, "ACCEPTED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dacum-ai-workflow-types.test.ts`  
Expected: FAIL (types not yet exported or properties missing in `src/types/dashboard.ts`).

- [ ] **Step 3: Update `src/types/dashboard.ts` with new interfaces**

Add the following type exports to `src/types/dashboard.ts`:

```typescript
export type AIRiskStatus = 'CLEAN' | 'NEEDS_ATTENTION' | 'HIGH_RISK';
export type AISuggestedAction = 'QUICK_APPROVE' | 'REQUEST_CHANGES' | 'MANUAL_INSPECT';
export type TriageStatus = 'NONE' | 'PENDING_TRIAGE' | 'ACCEPTED' | 'REJECTED';

export interface AIFlagItem {
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

export interface AIReviewSummary {
  status: AIRiskStatus;
  executiveSummary: string;
  complianceScore: number;
  dacumCriteriaMatched: string[];
  flags: AIFlagItem[];
  suggestedAction: AISuggestedAction;
  analyzedAt: string;
  suggestedFeedback?: string;
}

export interface EscalationMeta {
  submittedForReviewAt?: string;
  reviewDeadline?: string;
  isEscalated?: boolean;
  escalatedAt?: string;
  escalatedToRole?: 'ADMIN';
  escalationNote?: string;
}
```

Extend `StaffTask`:
```typescript
export interface StaffTask {
  // ... existing fields ...
  triageStatus?: TriageStatus;
  triageSourceDept?: string;
  triageRequestedBy?: string;
  triageRejectionReason?: string;
  escalation?: EscalationMeta;
  aiReview?: AIReviewSummary;
}
```

Extend `DashboardStats`:
```typescript
export interface DashboardStats {
  // ... existing fields ...
  pendingTriageCount?: number;
  escalatedReviewCount?: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dacum-ai-workflow-types.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/types/dashboard.ts tests/dacum-ai-workflow-types.test.ts
git commit -m "feat(types): define dacum ai review, escalation, and triage types"
```

---

### Task 2: AI Executive Review Assistant Engine (`screenDeliverablesWithAI`)

**Files:**
- Modify: `src/lib/dacum-workflow-engine.ts`
- Test: `tests/dacum-ai-workflow-engine.test.ts`

**Interfaces:**
- Produces: `screenDeliverablesWithAI(task: StaffTask, schoolTask?: SchoolTask, now?: Date): AIReviewSummary`

- [ ] **Step 1: Write the failing unit tests for AI Screening**

```typescript
// tests/dacum-ai-workflow-engine.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { StaffTask, SchoolTask } from "../src/types/dashboard";
import { screenDeliverablesWithAI } from "../src/lib/dacum-workflow-engine";

describe("DACUM AI Executive Review Assistant", () => {
  const mockSchoolTask: SchoolTask = {
    id: "school-task-01",
    title: "Chuyển đổi số giáo trình năm 2026",
    category: "CHUYEN_DOI_SO",
    categoryLabel: "Chuyển đổi số",
    leadAssigneeName: "Trưởng phòng Đào tạo",
    assignedDate: "2026-09-01",
    dueDate: "2026-09-30",
    status: "IN_PROGRESS",
    subTasks: [],
    totalSubTasks: 1,
    completedSubTasks: 0,
    progressPercent: 0,
    coAssignees: [],
  };

  test("scores HIGH_RISK and MANUAL_INSPECT when deliverables are missing or trivial", () => {
    const task: StaffTask = {
      id: "task-01",
      title: "Biên soạn đề cương",
      assigneeName: "Chuyên viên A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      deliverables: [],
      deliverableDescription: "Xong rồi",
    };

    const review = screenDeliverablesWithAI(task, mockSchoolTask);
    assert.equal(review.status, "HIGH_RISK");
    assert.equal(review.suggestedAction, "REQUEST_CHANGES");
    assert.ok(review.complianceScore < 60);
    assert.ok(review.flags.some((f) => f.type === "CRITICAL"));
  });

  test("scores CLEAN and QUICK_APPROVE when deliverables are comprehensive and match DACUM criteria", () => {
    const task: StaffTask = {
      id: "task-02",
      title: "Biên soạn giáo trình Mạng máy tính theo DACUM",
      assigneeName: "Giảng viên B",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-20",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      deliverables: [
        {
          id: "deliv-1",
          name: "Giao_trinh_Mang_may_tinh_2026.pdf",
          url: "https://storage.qcet.edu.vn/giao-trinh.pdf",
        },
        {
          id: "deliv-2",
          name: "Bien_ban_nghiem_thu_to_bo_mon.pdf",
          url: "https://storage.qcet.edu.vn/bien-ban.pdf",
        },
      ],
      deliverableDescription:
        "Hoàn thành toàn bộ đề cương chi tiết, giáo trình 120 trang và biên bản nghiệm thu cấp khoa.",
    };

    const review = screenDeliverablesWithAI(task, mockSchoolTask);
    assert.equal(review.status, "CLEAN");
    assert.equal(review.suggestedAction, "QUICK_APPROVE");
    assert.ok(review.complianceScore >= 85);
    assert.ok(review.dacumCriteriaMatched.length >= 2);
  });

  test("flags WARNING when internal due date is within 24 hours of school task deadline", () => {
    const task: StaffTask = {
      id: "task-03",
      title: "Báo cáo tổng kết",
      assigneeName: "Chuyên viên C",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-30", // same as school task
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      deliverables: [
        { id: "deliv-3", name: "Bao_cao.pdf", url: "https://storage/bc.pdf" },
      ],
      deliverableDescription: "Báo cáo tổng kết hoàn chỉnh 20 trang.",
    };

    const review = screenDeliverablesWithAI(
      task,
      mockSchoolTask,
      new Date("2026-09-29T12:00:00Z")
    );
    assert.ok(
      review.flags.some(
        (f) => f.type === "WARNING" && f.message.includes("Nhiệm vụ cấp Trường")
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dacum-ai-workflow-engine.test.ts`  
Expected: FAIL (`screenDeliverablesWithAI is not a function`).

- [ ] **Step 3: Implement `screenDeliverablesWithAI` in `src/lib/dacum-workflow-engine.ts`**

```typescript
export function screenDeliverablesWithAI(
  task: StaffTask,
  schoolTask?: SchoolTask,
  now: Date = new Date()
): AIReviewSummary {
  const deliverables = task.deliverables || [];
  const desc = (task.deliverableDescription || "").trim();
  const flags: AIFlagItem[] = [];
  const dacumCriteriaMatched: string[] = [];

  let complianceScore = 50;

  // Rule 1: Check physical attachments / links
  const validAttachments = deliverables.filter(
    (d) => d.url && d.url.trim().length > 0
  );
  if (validAttachments.length > 0) {
    complianceScore += 25;
    dacumCriteriaMatched.push(
      `Đính kèm ${validAttachments.length} tệp minh chứng có đường dẫn hợp lệ`
    );
  } else {
    flags.push({
      type: "CRITICAL",
      message: "Thiếu tệp minh chứng hoặc liên kết kiểm tra sản phẩm.",
    });
  }

  // Rule 2: Check narrative richness
  if (desc.length >= 30) {
    complianceScore += 15;
    dacumCriteriaMatched.push("Bản mô tả kết quả bàn giao đầy đủ chi tiết");
  } else if (desc.length === 0) {
    flags.push({
      type: "WARNING",
      message: "Chưa có phần thuyết minh tóm tắt sản phẩm.",
    });
  } else {
    flags.push({
      type: "INFO",
      message: "Phần thuyết minh sản phẩm còn ngắn gọn.",
    });
  }

  // Rule 3: Match DACUM keywords
  const textContent = `${task.title} ${desc} ${deliverables.map((d) => d.name).join(" ")}`.toLowerCase();
  const dacumKeywords = [
    { kw: "giáo trình", label: "Chuẩn hóa giáo trình môn học" },
    { kw: "đề cương", label: "Đề cương chi tiết học phần" },
    { kw: "nghiệm thu", label: "Biên bản nghiệm thu chuyên môn" },
    { kw: "báo cáo", label: "Báo cáo tiến độ và kết quả" },
    { kw: "ngân hàng đề", label: "Ngân hàng câu hỏi/đề thi chuẩn đầu ra" },
    { kw: "kế hoạch", label: "Kế hoạch giảng dạy/thực hành" },
  ];

  for (const { kw, label } of dacumKeywords) {
    if (textContent.includes(kw)) {
      dacumCriteriaMatched.push(label);
      complianceScore += 5;
    }
  }

  // Rule 4: Check deadline proximity to school task
  if (schoolTask?.dueDate && task.dueDate) {
    const schoolDue = new Date(schoolTask.dueDate).getTime();
    const taskDue = new Date(task.dueDate).getTime();
    const diffHours = (schoolDue - now.getTime()) / (1000 * 3600);

    if (diffHours >= 0 && diffHours <= 24) {
      flags.push({
        type: "WARNING",
        message: "Thời hạn hoàn thành cận kề hạn chót của Nhiệm vụ cấp Trường (dưới 24h).",
      });
      complianceScore = Math.max(0, complianceScore - 10);
    }
  }

  complianceScore = Math.min(100, Math.max(0, complianceScore));

  let status: AIRiskStatus = "CLEAN";
  let suggestedAction: AISuggestedAction = "QUICK_APPROVE";

  if (complianceScore < 60 || flags.some((f) => f.type === "CRITICAL")) {
    status = "HIGH_RISK";
    suggestedAction = "REQUEST_CHANGES";
  } else if (complianceScore < 85 || flags.some((f) => f.type === "WARNING")) {
    status = "NEEDS_ATTENTION";
    suggestedAction = "MANUAL_INSPECT";
  }

  let executiveSummary = "";
  if (status === "CLEAN") {
    executiveSummary = `Hồ sơ sản phẩm đầy đủ ${deliverables.length} minh chứng, đáp ứng chuẩn kỹ năng DACUM (Điểm tuân thủ: ${complianceScore}%). Đề xuất Lãnh đạo nghiệm thu.`;
  } else if (status === "NEEDS_ATTENTION") {
    executiveSummary = `Hồ sơ cơ bản hoàn thành nhưng có điểm cần lưu ý (${flags.map((f) => f.message).join("; ")}). Đề xuất Lãnh đạo kiểm tra trước khi duyệt.`;
  } else {
    executiveSummary = `Hồ sơ chưa đạt yêu cầu do thiếu minh chứng hoặc thông tin cốt lõi. Đề xuất Lãnh đạo yêu cầu bổ sung chỉnh sửa.`;
  }

  return {
    status,
    executiveSummary,
    complianceScore,
    dacumCriteriaMatched,
    flags,
    suggestedAction,
    analyzedAt: now.toISOString(),
    suggestedFeedback:
      status === "HIGH_RISK"
        ? "Yêu cầu viên chức bổ sung đường dẫn minh chứng và biên bản nghiệm thu theo đúng quy định."
        : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dacum-ai-workflow-engine.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/dacum-workflow-engine.ts tests/dacum-ai-workflow-engine.test.ts
git commit -m "feat(engine): implement ai executive screening and compliance scoring"
```

---

### Task 3: Cross-Department Triage Queue Logic (`processTriageDecision`)

**Files:**
- Modify: `src/lib/dacum-workflow-engine.ts`
- Test: `tests/dacum-ai-workflow-engine.test.ts`

**Interfaces:**
- Produces: `processTriageDecision(task: StaffTask, decision: 'ACCEPT' | 'REJECT', actor: AuthUser, payload: { targetAssigneeId?: string; targetAssigneeName?: string; internalDueDate?: string; rejectionReason?: string; }): { success: boolean; updatedTask?: StaffTask; error?: string }`

- [ ] **Step 1: Write failing tests for Triage Queue processing**

Append to `tests/dacum-ai-workflow-engine.test.ts`:

```typescript
describe("Cross-Department Triage Queue Processing", () => {
  const managerCNTT: AuthUser = {
    id: "user-mgr-cntt",
    name: "Trưởng khoa CNTT",
    email: "cntt@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng khoa",
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
  };

  const staffOtherDept: AuthUser = {
    id: "user-staff-khac",
    name: "Nhân viên khác",
    email: "staff@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "Phòng Khác",
    departmentCode: "P_KHAC",
  };

  const pendingTriageTask: StaffTask = {
    id: "task-triage-01",
    title: "Phối hợp cử giảng viên coi thi tuyển sinh",
    assigneeName: "Chưa phân công",
    status: "NEW",
    dueDate: "2026-10-05",
    parentSchoolTaskId: "school-task-01",
    updatedAt: new Date().toISOString(),
    triageStatus: "PENDING_TRIAGE",
    triageSourceDept: "P_KHTC",
  };

  test("rejects triage action if actor is not MANAGER or ADMIN of target department", () => {
    const result = processTriageDecision(
      pendingTriageTask,
      "ACCEPT",
      staffOtherDept,
      { targetAssigneeId: "staff-01", targetAssigneeName: "Lê Văn B" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("thẩm quyền"));
  });

  test("successfully accepts triage and reassigns task to internal staff", () => {
    const result = processTriageDecision(
      pendingTriageTask,
      "ACCEPT",
      managerCNTT,
      {
        targetAssigneeId: "staff-cntt-01",
        targetAssigneeName: "Nguyễn Văn C",
        internalDueDate: "2026-10-04",
      }
    );
    assert.equal(result.success, true);
    assert.equal(result.updatedTask?.triageStatus, "ACCEPTED");
    assert.equal(result.updatedTask?.status, "IN_PROGRESS");
    assert.equal(result.updatedTask?.assigneeName, "Nguyễn Văn C");
    assert.equal(result.updatedTask?.internalDueDate, "2026-10-04");
  });

  test("requires rejectionReason when declining a triage request", () => {
    const resultNoReason = processTriageDecision(
      pendingTriageTask,
      "REJECT",
      managerCNTT,
      {}
    );
    assert.equal(resultNoReason.success, false);
    assert.ok(resultNoReason.error?.includes("lý do"));

    const resultValid = processTriageDecision(
      pendingTriageTask,
      "REJECT",
      managerCNTT,
      { rejectionReason: "Trùng lịch bảo vệ đồ án tốt nghiệp." }
    );
    assert.equal(resultValid.success, true);
    assert.equal(resultValid.updatedTask?.triageStatus, "REJECTED");
    assert.equal(resultValid.updatedTask?.status, "BLOCKED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dacum-ai-workflow-engine.test.ts`  
Expected: FAIL (`processTriageDecision is not defined`).

- [ ] **Step 3: Implement `processTriageDecision` in `src/lib/dacum-workflow-engine.ts`**

```typescript
export function processTriageDecision(
  task: StaffTask,
  decision: "ACCEPT" | "REJECT",
  actor: AuthUser,
  payload: {
    targetAssigneeId?: string;
    targetAssigneeName?: string;
    internalDueDate?: string;
    rejectionReason?: string;
  }
): { success: boolean; updatedTask?: StaffTask; error?: string } {
  // Only MANAGER of target department or ADMIN can triage
  const isTargetManager =
    actor.role === "ADMIN" ||
    (actor.role === "MANAGER" &&
      (!task.departmentCode || actor.departmentCode === task.departmentCode));

  if (!isTargetManager) {
    return {
      success: false,
      error:
        "Chỉ Lãnh đạo đơn vị tiếp nhận hoặc Ban Giám hiệu mới có thẩm quyền phân loại và tiếp nhận yêu cầu phối hợp.",
    };
  }

  if (decision === "ACCEPT") {
    if (!payload.targetAssigneeName || !payload.targetAssigneeName.trim()) {
      return {
        success: false,
        error: "Bắt buộc phải chỉ định nhân sự phụ trách khi tiếp nhận công việc.",
      };
    }

    const updatedTask: StaffTask = {
      ...task,
      triageStatus: "ACCEPTED",
      status: "IN_PROGRESS",
      assigneeName: payload.targetAssigneeName,
      internalDueDate: payload.internalDueDate || task.dueDate,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, updatedTask };
  }

  if (decision === "REJECT") {
    if (!payload.rejectionReason || !payload.rejectionReason.trim()) {
      return {
        success: false,
        error: "Bắt buộc phải ghi rõ lý do khi từ chối tiếp nhận yêu cầu phối hợp.",
      };
    }

    const updatedTask: StaffTask = {
      ...task,
      triageStatus: "REJECTED",
      status: "BLOCKED",
      triageRejectionReason: payload.rejectionReason,
      blockedReason: `Từ chối phối hợp: ${payload.rejectionReason}`,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, updatedTask };
  }

  return { success: false, error: "Hành động không hợp lệ." };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dacum-ai-workflow-engine.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/dacum-workflow-engine.ts tests/dacum-ai-workflow-engine.test.ts
git commit -m "feat(engine): implement cross-department triage decision processing"
```

---

### Task 4: SLA & Escalation Timers Logic (`evaluateReviewEscalation`)

**Files:**
- Modify: `src/lib/dacum-workflow-engine.ts`
- Test: `tests/dacum-ai-workflow-engine.test.ts`

**Interfaces:**
- Produces: `evaluateReviewEscalation(task: StaffTask, now?: Date, slaHours?: number): StaffTask`
- Enhances: `transitionStaffTaskStatus` to support AI Quick-Approve and Executive Override.

- [ ] **Step 1: Write failing tests for Escalation Timers**

Append to `tests/dacum-ai-workflow-engine.test.ts`:

```typescript
describe("SLA Escalation Timers & Executive Override", () => {
  const bghAdmin: AuthUser = {
    id: "bgh-01",
    name: "Hiệu trưởng QCET",
    email: "bgh@qcet.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
  };

  test("initiates escalation meta when task moves to NEEDS_REVIEW", () => {
    const task: StaffTask = {
      id: "task-esc-01",
      title: "Rà soát đề cương",
      assigneeName: "Chuyên viên D",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-01",
      updatedAt: new Date().toISOString(),
      deliverables: [{ id: "del-1", name: "Doc.pdf", url: "https://url.com" }],
    };

    const staffUser: AuthUser = {
      id: "staff-01",
      name: "Chuyên viên D",
      email: "d@qcet.edu.vn",
      role: "STAFF",
      roleLabel: "Chuyên viên",
      department: "Khoa CNTT",
    };

    const res = transitionStaffTaskStatus(task, "NEEDS_REVIEW", staffUser, {
      deliverables: task.deliverables,
      notes: "Nộp đề cương hoàn chỉnh",
    });

    assert.equal(res.success, true);
    assert.ok(res.updatedTask?.escalation?.reviewDeadline);
    assert.equal(res.updatedTask?.escalation?.isEscalated, false);
  });

  test("evaluates escalation and sets isEscalated when past 48h SLA", () => {
    const submittedTime = new Date("2026-09-01T08:00:00Z");
    const deadlineTime = new Date("2026-09-03T08:00:00Z"); // +48h

    const task: StaffTask = {
      id: "task-esc-02",
      title: "Chấm thi tuyển sinh",
      assigneeName: "Giảng viên E",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-10",
      parentSchoolTaskId: "school-01",
      updatedAt: submittedTime.toISOString(),
      escalation: {
        submittedForReviewAt: submittedTime.toISOString(),
        reviewDeadline: deadlineTime.toISOString(),
        isEscalated: false,
      },
    };

    // Before deadline
    const taskBefore = evaluateReviewEscalation(
      task,
      new Date("2026-09-02T10:00:00Z")
    );
    assert.equal(taskBefore.escalation?.isEscalated, false);

    // After deadline (+50h)
    const taskAfter = evaluateReviewEscalation(
      task,
      new Date("2026-09-03T10:00:00Z")
    );
    assert.equal(taskAfter.escalation?.isEscalated, true);
    assert.equal(taskAfter.escalation?.escalatedToRole, "ADMIN");
  });

  test("allows BGH ADMIN executive override on escalated tasks", () => {
    const escalatedTask: StaffTask = {
      id: "task-esc-03",
      title: "Nghiệm thu phòng thí nghiệm",
      assigneeName: "Giảng viên F",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-15",
      parentSchoolTaskId: "school-01",
      updatedAt: new Date().toISOString(),
      escalation: {
        isEscalated: true,
        escalatedToRole: "ADMIN",
        escalationNote: "Quá hạn duyệt 48h tại Trưởng khoa",
      },
    };

    const res = transitionStaffTaskStatus(
      escalatedTask,
      "COMPLETED",
      bghAdmin,
      {
        notes: "Ban Giám hiệu nghiệm thu trực tiếp do quá hạn phê duyệt tại đơn vị.",
      }
    );
    assert.equal(res.success, true);
    assert.equal(res.updatedTask?.status, "COMPLETED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dacum-ai-workflow-engine.test.ts`  
Expected: FAIL (`evaluateReviewEscalation is not defined`).

- [ ] **Step 3: Implement `evaluateReviewEscalation` and update `transitionStaffTaskStatus` in `src/lib/dacum-workflow-engine.ts`**

Update `transitionStaffTaskStatus`:
When moving to `NEEDS_REVIEW`, attach `escalation` with 48h SLA deadline and run `screenDeliverablesWithAI` to populate `aiReview`:

```typescript
export function evaluateReviewEscalation(
  task: StaffTask,
  now: Date = new Date(),
  slaHours: number = 48
): StaffTask {
  if (task.status !== "NEEDS_REVIEW" || !task.escalation?.reviewDeadline) {
    return task;
  }

  const deadline = new Date(task.escalation.reviewDeadline).getTime();
  if (now.getTime() > deadline && !task.escalation.isEscalated) {
    return {
      ...task,
      escalation: {
        ...task.escalation,
        isEscalated: true,
        escalatedAt: now.toISOString(),
        escalatedToRole: "ADMIN",
        escalationNote: `Quá hạn thẩm định ${slaHours} giờ tại cấp đơn vị. Đã tự động chuyển Ban Giám hiệu theo dõi.`,
      },
      updatedAt: now.toISOString(),
    };
  }

  return task;
}
```

In `transitionStaffTaskStatus`, set `escalation` and `aiReview` when `newStatus === 'NEEDS_REVIEW'`:
```typescript
if (newStatus === "NEEDS_REVIEW") {
  const submittedAt = new Date().toISOString();
  const reviewDeadline = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  updatedTask.escalation = {
    submittedForReviewAt: submittedAt,
    reviewDeadline,
    isEscalated: false,
  };
  updatedTask.aiReview = screenDeliverablesWithAI(updatedTask);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dacum-ai-workflow-engine.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/dacum-workflow-engine.ts tests/dacum-ai-workflow-engine.test.ts
git commit -m "feat(engine): implement sla escalation evaluation and bgh executive override"
```

---

### Task 5: UI Integration - AI Executive Brief & Quick Actions in Side-Sheet

**Files:**
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`
- Test: `tests/dacum-ui-sidesheet.test.ts`

**Interfaces:**
- Consumes: `AIReviewSummary`, `EscalationMeta`, `screenDeliverablesWithAI`, `transitionStaffTaskStatus`
- Produces: AI Executive Brief Card with risk badges, Quick Approve button, Request Changes modal with AI feedback.

- [ ] **Step 1: Write failing UI test checking AI card and quick actions rendering**

```typescript
// tests/dacum-ui-sidesheet.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task Detail Side-Sheet AI Integration Audit", () => {
  const filePath = path.resolve(
    __dirname,
    "../src/components/dashboard/task-detail-side-sheet.tsx"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  test("contains AI Executive Brief card integration", () => {
    assert.ok(content.includes("aiReview") || content.includes("screenDeliverablesWithAI"));
    assert.ok(content.includes("Điểm tuân thủ") || content.includes("complianceScore"));
  });

  test("provides Quick Approve action according to AI recommendation", () => {
    assert.ok(content.includes("Duyệt nhanh") || content.includes("QUICK_APPROVE"));
  });

  test("adheres strictly to Zero Emojis policy", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.equal(emojiRegex.test(content), false, "Must contain zero emojis");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dacum-ui-sidesheet.test.ts`  
Expected: FAIL (missing AI card & quick approve logic).

- [ ] **Step 3: Update `src/components/dashboard/task-detail-side-sheet.tsx`**

Integrate:
1. When `task.status === 'NEEDS_REVIEW'` and viewer has `role === 'MANAGER'` or `role === 'ADMIN'`:
   Display `AI Executive Brief` component:
   - Compliance score badge (`bg-emerald-50 text-emerald-700` for CLEAN, `bg-amber-50 text-amber-700` for NEEDS_ATTENTION, `bg-rose-50 text-rose-700` for HIGH_RISK).
   - Executive Summary text.
   - List of matched DACUM criteria and warning flags.
2. Two prominent buttons:
   - "Duyệt nhanh theo đề xuất AI" (calls `transitionStaffTaskStatus(task, 'COMPLETED', user)`).
   - "Yêu cầu chỉnh sửa" (pre-fills `aiReview.suggestedFeedback` into rejection reason textarea).
3. If `task.escalation?.isEscalated`:
   Show escalation notice banner (`bg-rose-50 text-rose-700 border-rose-200`) noting that the task exceeded the 48h SLA and is visible to BGH.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dacum-ui-sidesheet.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/dashboard/task-detail-side-sheet.tsx tests/dacum-ui-sidesheet.test.ts
git commit -m "feat(side-sheet): add ai executive brief card, quick approval, and escalation notice"
```

---

### Task 6: UI Integration - Executive Stat Strip Escalation & Triage Metrics

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx`
- Modify: `tests/executive-stat-strip.test.ts`

**Interfaces:**
- Consumes: `DashboardStats.pendingTriageCount`, `DashboardStats.escalatedReviewCount`
- Produces: Escalation alert badge and Triage queue counter on the executive strip.

- [ ] **Step 1: Update `tests/executive-stat-strip.test.ts` to expect escalation metric card**

Ensure the test checks for escalated review count and pending triage count:

```typescript
test("renders escalated review count when present", () => {
  const stats: DashboardStats = {
    ...mockStats,
    escalatedReviewCount: 3,
    pendingTriageCount: 2,
  };
  // assert presence of escalated alert
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-stat-strip.test.ts`  
Expected: FAIL if updated test checks for new badges/metrics.

- [ ] **Step 3: Update `src/components/dashboard/executive-stat-strip.tsx`**

Add cards for `Chờ tiếp nhận (Triage)` and `Quá hạn thẩm định (Escalated)` using Lucide icons (`Clock`, `AlertTriangle`), tabular nums, and clean administrative styling without any emojis.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/executive-stat-strip.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/dashboard/executive-stat-strip.tsx tests/executive-stat-strip.test.ts
git commit -m "feat(stat-strip): integrate triage queue and escalated review metrics"
```

---

### Task 7: Comprehensive End-to-End Integration Audit & Zero-Emoji Verification

**Files:**
- Modify: `tests/dacum-integration-audit.test.ts`
- Run: Full suite audit `npm test`

- [ ] **Step 1: Add End-to-End lifecycle test to `tests/dacum-integration-audit.test.ts`**

Add comprehensive test covering the full 6-phase journey:
1. Cross-dept Collaboration Request created -> enters `PENDING_TRIAGE`.
2. Target Department Head accepts via `processTriageDecision` -> task assigned to internal staff as `IN_PROGRESS`.
3. Staff works and submits deliverables -> status `NEEDS_REVIEW`, `aiReview` generated, `escalation` SLA initialized.
4. Time passes beyond 48h -> `evaluateReviewEscalation` triggers `isEscalated = true`.
5. BGH ADMIN opens task, views `AIReviewSummary`, performs 1-click Quick Approval -> status `COMPLETED`.
6. `calculateSchoolTaskRollup` verifies School Task reaches 100% and transitions to `COMPLETED` / `PENDING_EXECUTIVE_APPROVAL`.
7. Zero decorative emojis verified across all modified files.

- [ ] **Step 2: Run full test suite**

Run: `npm test`  
Expected: 100% tests pass (over 525 tests passing, 0 failures, 0 regressions).

- [ ] **Step 3: Commit audit tests**

```bash
git add tests/dacum-integration-audit.test.ts
git commit -m "test(audit): verify complete dacum ai review, triage queue, and escalation lifecycle"
```
