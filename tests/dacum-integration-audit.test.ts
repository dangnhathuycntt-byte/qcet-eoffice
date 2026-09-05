import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { AuthUser } from "../src/types/auth";
import type {
  SchoolTask,
  StaffTask,
  DeliverableItem,
  CollaborationRequest,
} from "../src/types/dashboard";
import {
  canAssignStaffTask,
  validateDueDate,
  validateDeliverableSubmission,
  transitionStaffTaskStatus,
  calculateSchoolTaskRollup,
} from "../src/lib/dacum-workflow-engine";
import {
  createCollaborationRequest,
  acceptCollaborationRequest,
  rejectCollaborationRequest,
  getCollaborationRequestsForDepartment,
} from "../src/lib/collaboration-manager";

function getAllFiles(dir: string, extensions: string[]): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("DACUM 3-Tier Workflow End-to-End Integration & Audit", () => {
  // Key Actors in the 3-Tier Hierarchy (Nghị định 232/2026/NĐ-CP)
  const hieuTruongBGH: AuthUser = {
    id: "user-bgh-01",
    name: "Ban Giám Hiệu QCET",
    email: "bgh@qcet.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const truongPhongDaoTao: AuthUser = {
    id: "user-mgr-daotao",
    name: "Trần Hùng",
    email: "hung.th@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const truongKhoaCNTT: AuthUser = {
    id: "user-mgr-cntt",
    name: "Trần Văn An",
    email: "an.tv@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng khoa",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  const chuyenVienVinh: AuthUser = {
    id: "user-staff-vinh",
    name: "Nguyễn Ngọc Vinh",
    email: "vinh.nn@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  test("End-to-End 7-Step Lifecycle: BGH -> Department -> Staff -> Deliverable -> Multi-tier Approval", () => {
    // Step 1: BGH khởi tạo School Task giao cho Trưởng phòng Đào tạo (Lead Department)
    const schoolTaskInitial: SchoolTask = {
      id: "school-task-2026-cds",
      title: "Chuyển đổi số công tác Tuyển sinh và Quản lý Đào tạo 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: truongPhongDaoTao.name,
      leadDepartment: truongPhongDaoTao.department,
      leadDepartmentCode: truongPhongDaoTao.departmentCode,
      coAssignees: [truongKhoaCNTT.name],
      coDepartments: [truongKhoaCNTT.department],
      coDepartmentCodes: [truongKhoaCNTT.departmentCode],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
      executiveCriteria:
        "Hệ thống CSDL tuyển sinh trực tuyến vận hành liên thông có biên bản nghiệm thu kỹ thuật",
    };

    assert.equal(schoolTaskInitial.status, "IN_PROGRESS");
    assert.equal(schoolTaskInitial.leadDepartmentCode, "DAO_TAO");
    assert.deepEqual(schoolTaskInitial.coDepartmentCodes, ["CNTT"]);

    // Step 2: Trưởng phòng Đào tạo không được giao trực tiếp cho nhân viên CNTT -> Gửi Phiếu phối hợp
    const directAssignCheck = canAssignStaffTask(
      truongPhongDaoTao,
      chuyenVienVinh.departmentCode
    );
    assert.equal(directAssignCheck.allowed, false);
    assert.ok(
      directAssignCheck.reason?.includes(
        "không được giao việc trực tiếp cho nhân viên phòng khác"
      )
    );

    const collabRequest = createCollaborationRequest({
      schoolTaskId: schoolTaskInitial.id,
      schoolTaskTitle: schoolTaskInitial.title,
      fromDeptCode: truongPhongDaoTao.departmentCode,
      fromDeptName: truongPhongDaoTao.department,
      toDeptCode: truongKhoaCNTT.departmentCode,
      toDeptName: truongKhoaCNTT.department,
      requestedBy: truongPhongDaoTao.name,
      description:
        "Phát triển mô-đun API liên thông CSDL tuyển sinh và cổng thí sinh",
      requiredDeliverables:
        "Mã nguồn API + Tài liệu tích hợp Swagger + Báo cáo kiểm thử bảo mật",
      dueDate: "2026-09-20",
    });

    assert.equal(collabRequest.status, "PENDING");
    assert.equal(collabRequest.fromDeptCode, "DAO_TAO");
    assert.equal(collabRequest.toDeptCode, "CNTT");
    assert.ok(collabRequest.id.startsWith("collab-"));

    // Step 3: Trưởng khoa CNTT nhận phiếu và bổ việc cho Chuyên viên Vinh kèm hạn chót và yêu cầu minh chứng
    const incomingRequests = getCollaborationRequestsForDepartment(
      [collabRequest],
      "CNTT",
      "incoming"
    );
    assert.equal(incomingRequests.length, 1);
    assert.equal(incomingRequests[0].id, collabRequest.id);

    const { request: acceptedRequest, subTasksToCreate } =
      acceptCollaborationRequest(incomingRequests[0], truongKhoaCNTT, [
        chuyenVienVinh.id,
      ]);

    assert.equal(acceptedRequest.status, "ACCEPTED");
    assert.deepEqual(acceptedRequest.assignedStaffIds, [chuyenVienVinh.id]);
    assert.equal(subTasksToCreate.length, 1);

    // Kiểm tra ràng buộc hạn chót: internalDueDate <= schoolTask.dueDate
    const validDueDateCheck = validateDueDate(
      "2026-09-20",
      schoolTaskInitial.dueDate
    );
    assert.equal(validDueDateCheck.valid, true);

    const invalidDueDateCheck = validateDueDate(
      "2026-10-05",
      schoolTaskInitial.dueDate
    );
    assert.equal(invalidDueDateCheck.valid, false);
    assert.ok(
      invalidDueDateCheck.error?.includes(
        "không được vượt quá hạn chót của Nhiệm vụ cấp Trường"
      )
    );

    // Trưởng khoa giao việc cho nhân viên cùng đơn vị -> allowed
    const internalAssignCheck = canAssignStaffTask(
      truongKhoaCNTT,
      chuyenVienVinh.departmentCode
    );
    assert.equal(internalAssignCheck.allowed, true);

    const staffTask: StaffTask = {
      id: "staff-task-cds-vinh-01",
      title:
        subTasksToCreate[0].title || "Phát triển API liên thông CSDL tuyển sinh",
      assigneeName: chuyenVienVinh.name,
      status: "NEW",
      dueDate: "2026-09-20",
      internalDueDate: "2026-09-18",
      parentSchoolTaskId: schoolTaskInitial.id,
      updatedAt: "2026-09-06T08:00:00Z",
      vtvlRole: "Chuyên viên Công nghệ thông tin",
      deliverableDescription: subTasksToCreate[0].deliverableDescription,
    };

    // Step 4: Chuyên viên Vinh thực hiện, nộp link minh chứng sang NEEDS_REVIEW
    // 4.1: Chuyển sang IN_PROGRESS
    const startResult = transitionStaffTaskStatus(
      staffTask,
      "IN_PROGRESS",
      chuyenVienVinh
    );
    assert.equal(startResult.success, true);
    const inProgressTask = startResult.updatedTask!;
    assert.equal(inProgressTask.status, "IN_PROGRESS");

    // 4.2: Nhân viên không thể tự bấm COMPLETED (Quy tắc RBAC DACUM)
    const illegalCompleteResult = transitionStaffTaskStatus(
      inProgressTask,
      "COMPLETED",
      chuyenVienVinh
    );
    assert.equal(illegalCompleteResult.success, false);
    assert.ok(
      illegalCompleteResult.error?.includes(
        "Chỉ Trưởng phòng hoặc BGH mới có quyền nghiệm thu"
      )
    );

    // 4.3: Chuyển sang NEEDS_REVIEW mà không có minh chứng -> Bị chặn
    const emptySubmitResult = transitionStaffTaskStatus(
      inProgressTask,
      "NEEDS_REVIEW",
      chuyenVienVinh,
      {
        deliverables: [],
        notes: "",
      }
    );
    assert.equal(emptySubmitResult.success, false);
    assert.ok(
      emptySubmitResult.error?.includes(
        "bắt buộc phải có sản phẩm minh chứng"
      )
    );

    // 4.4: Nộp minh chứng hợp lệ (Đường dẫn tài liệu / Git repo và ghi chú bàn giao)
    const deliverable: DeliverableItem = {
      id: "deliv-vinh-01",
      name: "Tài liệu API Swagger & Kho mã nguồn Git",
      url: "https://git.qcet.edu.vn/cds/api-tuyensinh-2026",
      fileType: "link",
      submittedAt: "2026-09-18T14:30:00Z",
    };

    const validSubmitResult = transitionStaffTaskStatus(
      inProgressTask,
      "NEEDS_REVIEW",
      chuyenVienVinh,
      {
        deliverables: [deliverable],
        notes:
          "Đã hoàn thành kiểm thử tích hợp 100% đạt chuẩn bảo mật và bàn giao tài liệu Swagger.",
      }
    );

    assert.equal(validSubmitResult.success, true);
    assert.equal(validSubmitResult.updatedTask?.status, "NEEDS_REVIEW");
    assert.equal(validSubmitResult.updatedTask?.deliverables?.length, 1);
    assert.ok(
      validSubmitResult.updatedTask?.deliverableDescription?.includes(
        "Đã hoàn thành kiểm thử"
      )
    );

    const taskInReview = validSubmitResult.updatedTask!;

    // Step 5: Trưởng khoa CNTT kiểm tra và duyệt COMPLETED
    // 5.1: Quản lý từ chối nếu thiếu yêu cầu (kèm lý do)
    const rejectReviewResult = transitionStaffTaskStatus(
      taskInReview,
      "IN_PROGRESS",
      truongKhoaCNTT,
      {
        rejectionReason:
          "Bổ sung chữ ký điện tử xác thực JWT vào tài liệu Swagger trước khi nghiệm thu.",
      }
    );
    assert.equal(rejectReviewResult.success, true);
    assert.equal(rejectReviewResult.updatedTask?.status, "IN_PROGRESS");
    assert.equal(
      rejectReviewResult.updatedTask?.rejectionReason,
      "Bổ sung chữ ký điện tử xác thực JWT vào tài liệu Swagger trước khi nghiệm thu."
    );

    // 5.2: Chuyên viên bổ sung minh chứng và nộp lại
    const reSubmitResult = transitionStaffTaskStatus(
      rejectReviewResult.updatedTask!,
      "NEEDS_REVIEW",
      chuyenVienVinh,
      {
        deliverables: [
          deliverable,
          {
            id: "deliv-vinh-02",
            name: "Bản cập nhật xác thực JWT và chữ ký điện tử",
            url: "https://git.qcet.edu.vn/cds/api-jwt-update",
            fileType: "link",
            submittedAt: "2026-09-19T09:00:00Z",
          },
        ],
        notes: "Đã cập nhật đầy đủ xác thực JWT bảo mật.",
      }
    );
    assert.equal(reSubmitResult.success, true);
    assert.equal(reSubmitResult.updatedTask?.status, "NEEDS_REVIEW");

    // 5.3: Trưởng khoa nghiệm thu thành công COMPLETED
    const finalApprovalResult = transitionStaffTaskStatus(
      reSubmitResult.updatedTask!,
      "COMPLETED",
      truongKhoaCNTT
    );
    assert.equal(finalApprovalResult.success, true);
    assert.equal(finalApprovalResult.updatedTask?.status, "COMPLETED");

    const completedStaffTask = finalApprovalResult.updatedTask!;

    // Step 6: Hệ thống tự động tính rollup của School Task thành 100% và chuyển sang PENDING_EXECUTIVE_APPROVAL
    const schoolTaskWithSubTask: SchoolTask = {
      ...schoolTaskInitial,
      subTasks: [completedStaffTask],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const rollup = calculateSchoolTaskRollup(schoolTaskWithSubTask);
    assert.equal(rollup.progressPercent, 100);
    assert.equal(rollup.completedSubTasks, 1);
    assert.equal(rollup.totalSubTasks, 1);
    assert.equal(rollup.calculatedStatus, "PENDING_EXECUTIVE_APPROVAL");

    const pendingExecutiveTask: SchoolTask = {
      ...schoolTaskWithSubTask,
      progressPercent: rollup.progressPercent,
      completedSubTasks: rollup.completedSubTasks,
      totalSubTasks: rollup.totalSubTasks,
      status: rollup.calculatedStatus,
      completionReport: {
        summary:
          "Hoàn tất module API liên thông và biên bản bàn giao kỹ thuật giữa Phòng Đào tạo và Khoa CNTT",
        submittedBy: truongPhongDaoTao.name,
        submittedAt: "2026-09-20T16:00:00Z",
        reportUrl: "https://drive.google.com/file/d/bien-ban-nghiem-thu-cds-2026",
      },
    };

    assert.equal(pendingExecutiveTask.status, "PENDING_EXECUTIVE_APPROVAL");
    assert.ok(pendingExecutiveTask.completionReport?.reportUrl);

    // Step 7: Hiệu trưởng kiểm tra hồ sơ tổng hợp và bấm duyệt đóng COMPLETED
    assert.equal(
      pendingExecutiveTask.completionReport.submittedBy,
      truongPhongDaoTao.name
    );
    assert.ok(pendingExecutiveTask.completionReport.reportUrl);

    const completedSchoolTask: SchoolTask = {
      ...pendingExecutiveTask,
      status: "COMPLETED",
    };

    const finalRollup = calculateSchoolTaskRollup(completedSchoolTask);
    assert.equal(finalRollup.progressPercent, 100);
    assert.equal(finalRollup.calculatedStatus, "COMPLETED");
    assert.equal(finalRollup.completedSubTasks, 1);
    assert.equal(finalRollup.totalSubTasks, 1);
    assert.equal(completedSchoolTask.status, "COMPLETED");
  });

  test("BGH Emergency Direct Assignment Bypass adheres to Decree 232 logging", () => {
    const directAdminAssign = canAssignStaffTask(
      hieuTruongBGH,
      chuyenVienVinh.departmentCode,
      true // isEmergencyBypass
    );
    assert.equal(directAdminAssign.allowed, true);
    assert.equal(directAdminAssign.isBypassWarning, true);
    assert.ok(
      directAdminAssign.reason?.includes("Chỉ đạo khẩn cấp từ Ban Giám hiệu")
    );
  });

  test("Inter-departmental collaboration rejection records specific reason", () => {
    const collabReq = createCollaborationRequest({
      schoolTaskId: "school-task-2026-cds",
      schoolTaskTitle: "Chuyển đổi số 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Cần 3 kỹ sư hỗ trợ kiểm thử",
      requiredDeliverables: "Báo cáo test",
      dueDate: "2026-09-15",
    });

    const rejected = rejectCollaborationRequest(
      collabReq,
      "Khoa CNTT đang tập trung đợt bảo vệ khóa luận tốt nghiệp, không bố trí được nhân sự."
    );

    assert.equal(rejected.status, "REJECTED");
    assert.equal(
      rejected.rejectionReason,
      "Khoa CNTT đang tập trung đợt bảo vệ khóa luận tốt nghiệp, không bố trí được nhân sự."
    );
  });

  test("Anti-slop audit: Zero decorative emojis across all source files and tests", () => {
    // Unicode regex covering all emoji ranges
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    const srcFiles = getAllFiles(path.join(process.cwd(), "src"), [
      ".tsx",
      ".ts",
      ".css",
    ]);
    const testFiles = getAllFiles(path.join(process.cwd(), "tests"), [".ts"]);
    const allFiles = [...srcFiles, ...testFiles];

    const violations: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (emojiRegex.test(line)) {
          violations.push(
            `${path.relative(process.cwd(), file)}:${idx + 1}: ${line.trim()}`
          );
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Found decorative emojis in source or test code:\n${violations.slice(0, 10).join("\n")}`
    );
  });

  test("Anti-slop audit: Tabular figures strictly used in numeric UI components", () => {
    const requiredTabularComponents = [
      "src/components/dashboard/executive-stat-strip.tsx",
      "src/components/dashboard/cascading-task-table.tsx",
      "src/components/dashboard/task-detail-side-sheet.tsx",
      "src/components/tasks/task-kanban-board.tsx",
      "src/components/calendar/calendar-month-view.tsx",
      "src/components/org/organization-tree.tsx",
    ];

    for (const relPath of requiredTabularComponents) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        content.includes("tabular-nums"),
        `Component ${relPath} must use tabular-nums for numeric precision and executive tables`
      );
    }
  });

  test("Anti-slop audit: Lucide icons strictly maintain 1.5 stroke width across components", () => {
    const keyComponents = [
      "src/components/dashboard/unified-task-toolbar.tsx",
      "src/components/dashboard/cascading-task-table.tsx",
      "src/components/dashboard/task-detail-side-sheet.tsx",
      "src/components/dashboard/create-task-modal.tsx",
      "src/components/tasks/task-kanban-board.tsx",
      "src/components/calendar/calendar-month-view.tsx",
      "src/components/org/organization-tree.tsx",
      "src/components/layout/app-topbar.tsx",
      "src/components/layout/app-sidebar.tsx",
    ];

    for (const relPath of keyComponents) {
      const fullPath = path.join(process.cwd(), relPath);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes('from "lucide-react"')) {
        assert.ok(
          content.includes("strokeWidth={1.5}") ||
            content.includes('strokeWidth="1.5"') ||
            content.includes("strokeWidth: 1.5"),
          `${relPath} should adhere to strokeWidth 1.5 for crisp, executive micro-icons`
        );
      }
    }
  });

  test("Anti-slop audit: Zero corrupt replacement characters in codebase", () => {
    const srcFiles = getAllFiles(path.join(process.cwd(), "src"), [
      ".tsx",
      ".ts",
      ".css",
    ]);
    const violations: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("\uFFFD")) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found replacement character in: ${violations.join(", ")}`
    );
  });
});
