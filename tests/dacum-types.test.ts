import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  StaffTask,
  SchoolTask,
  DeliverableItem,
  CollaborationRequest,
  TaskStatus,
} from "../src/types/dashboard";

describe("DACUM & Decree 232 Types Specification", () => {
  test("StaffTask supports all 5 statuses and deliverable attachments", () => {
    const validStatuses: TaskStatus[] = [
      "NEW",
      "IN_PROGRESS",
      "BLOCKED",
      "NEEDS_REVIEW",
      "COMPLETED",
    ];
    assert.equal(validStatuses.length, 5);

    const deliverable: DeliverableItem = {
      id: "deliv-1",
      name: "Dự thảo Quy chế đào tạo số 2026",
      url: "https://drive.google.com/file/d/example",
      fileType: "pdf",
      submittedAt: "2026-09-06T10:00:00Z",
    };

    const task: StaffTask = {
      id: "staff-task-1",
      title: "Biên soạn dự thảo quy chế đào tạo số",
      assigneeName: "Nguyễn Ngọc Vinh",
      assigneeAvatar: undefined,
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-15",
      internalDueDate: "2026-09-12",
      parentSchoolTaskId: "school-task-101",
      updatedAt: "2026-09-06T10:00:00Z",
      deliverables: [deliverable],
      deliverableDescription: "Đã hoàn thiện bản dự thảo 12 trang xin ý kiến BGH",
      vtvlRole: "Chuyên viên Quản lý Đào tạo",
    };

    assert.equal(task.status, "NEEDS_REVIEW");
    assert.equal(task.deliverables?.length, 1);
    assert.equal(task.vtvlRole, "Chuyên viên Quản lý Đào tạo");
  });

  test("SchoolTask supports PENDING_EXECUTIVE_APPROVAL status and lead/co-departments", () => {
    const schoolTask: SchoolTask = {
      id: "school-task-101",
      title: "Chuyển đổi số công tác Tuyển sinh năm 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      leadDepartment: "Phòng Đào tạo & QLKH",
      leadDepartmentCode: "DAO_TAO",
      coAssignees: ["Trần Văn An"],
      coDepartments: ["Khoa Công nghệ thông tin"],
      coDepartmentCodes: ["CNTT"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "PENDING_EXECUTIVE_APPROVAL",
      subTasks: [],
      totalSubTasks: 3,
      completedSubTasks: 3,
      progressPercent: 100,
      executiveCriteria: "Hệ thống nộp hồ sơ online hoạt động ổn định + Quyết định ban hành",
    };

    assert.equal(schoolTask.status, "PENDING_EXECUTIVE_APPROVAL");
    assert.equal(schoolTask.leadDepartmentCode, "DAO_TAO");
    assert.deepEqual(schoolTask.coDepartmentCodes, ["CNTT"]);
  });

  test("CollaborationRequest adheres to inter-departmental format", () => {
    const request: CollaborationRequest = {
      id: "collab-req-01",
      schoolTaskId: "school-task-101",
      schoolTaskTitle: "Chuyển đổi số công tác Tuyển sinh năm 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo & QLKH",
      toDeptCode: "CNTT",
      toDeptName: "Khoa Công nghệ thông tin",
      requestedBy: "Trần Hùng",
      description: "Cần lập trình viên hỗ trợ đồng bộ API CSDL tuyển sinh",
      requiredDeliverables: "Mã nguồn API + Tài liệu tích hợp Swagger",
      dueDate: "2026-09-20",
      status: "PENDING",
      createdAt: "2026-09-06T08:00:00Z",
    };

    assert.equal(request.fromDeptCode, "DAO_TAO");
    assert.equal(request.toDeptCode, "CNTT");
    assert.equal(request.status, "PENDING");
  });
});
