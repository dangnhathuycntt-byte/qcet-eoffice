import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createCollaborationRequest,
  acceptCollaborationRequest,
  rejectCollaborationRequest,
  getCollaborationRequestsForDepartment,
} from "../src/lib/collaboration-manager";
import type { AuthUser } from "../src/types/auth";
import type { CollaborationRequest } from "../src/types/dashboard";

describe("Collaboration Manager (Điều phối liên phòng ban)", () => {
  const managerCNTT: AuthUser = {
    id: "manager-cntt",
    name: "Võ Thị Mai",
    email: "cntt@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng khoa CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  test("createCollaborationRequest creates pending request with unique ID and timestamp", () => {
    const req = createCollaborationRequest({
      schoolTaskId: "st-101",
      schoolTaskTitle: "Tuyển sinh 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Hỗ trợ cấu hình CSDL",
      requiredDeliverables: "Tài liệu kỹ thuật",
      dueDate: "2026-09-20",
    });

    assert.ok(req.id.startsWith("collab-"));
    assert.equal(req.status, "PENDING");
    assert.equal(req.fromDeptCode, "DAO_TAO");
    assert.equal(req.toDeptCode, "CNTT");
    assert.ok(req.createdAt);
  });

  test("acceptCollaborationRequest assigns internal staff and prepares subtasks", () => {
    const req: CollaborationRequest = {
      id: "collab-1",
      schoolTaskId: "st-101",
      schoolTaskTitle: "Tuyển sinh 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Hỗ trợ cấu hình CSDL",
      requiredDeliverables: "Tài liệu kỹ thuật",
      dueDate: "2026-09-20",
      status: "PENDING",
      createdAt: "2026-09-06T00:00:00Z",
    };

    const result = acceptCollaborationRequest(req, managerCNTT, ["staff-vinh"]);
    assert.equal(result.request.status, "ACCEPTED");
    assert.deepEqual(result.request.assignedStaffIds, ["staff-vinh"]);
    assert.equal(result.subTasksToCreate.length, 1);
    assert.equal(result.subTasksToCreate[0].parentSchoolTaskId, "st-101");
  });

  test("acceptCollaborationRequest handles multiple staff assignments", () => {
    const req: CollaborationRequest = {
      id: "collab-multi",
      schoolTaskId: "st-102",
      schoolTaskTitle: "Chuyển đổi số thư viện",
      fromDeptCode: "THU_VIEN",
      fromDeptName: "Thư viện trường",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Lê Văn C",
      description: "Tích hợp phần mềm tra cứu và cổng API",
      requiredDeliverables: "Hệ thống tra cứu thử nghiệm",
      dueDate: "2026-10-15",
      status: "PENDING",
      createdAt: "2026-09-06T01:00:00Z",
    };

    const result = acceptCollaborationRequest(req, managerCNTT, ["staff-vinh", "staff-linh"]);
    assert.equal(result.request.status, "ACCEPTED");
    assert.deepEqual(result.request.assignedStaffIds, ["staff-vinh", "staff-linh"]);
    assert.equal(result.subTasksToCreate.length, 2);
    assert.equal(result.subTasksToCreate[0].parentSchoolTaskId, "st-102");
    assert.equal(result.subTasksToCreate[1].parentSchoolTaskId, "st-102");
    assert.ok(result.subTasksToCreate[0].title?.includes("Thư viện trường"));
  });

  test("rejectCollaborationRequest marks as REJECTED and records reason", () => {
    const req: CollaborationRequest = {
      id: "collab-1",
      schoolTaskId: "st-101",
      schoolTaskTitle: "Tuyển sinh 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Hỗ trợ",
      requiredDeliverables: "Báo cáo",
      dueDate: "2026-09-20",
      status: "PENDING",
      createdAt: "2026-09-06T00:00:00Z",
    };

    const rejected = rejectCollaborationRequest(req, "Nhân sự khoa đang tập trung cao điểm thi tốt nghiệp");
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.rejectionReason, "Nhân sự khoa đang tập trung cao điểm thi tốt nghiệp");
  });

  test("filters requests by department code for incoming and outgoing", () => {
    const requests: CollaborationRequest[] = [
      {
        id: "c1",
        schoolTaskId: "s1",
        schoolTaskTitle: "T1",
        fromDeptCode: "DAO_TAO",
        fromDeptName: "Đào tạo",
        toDeptCode: "CNTT",
        toDeptName: "CNTT",
        requestedBy: "A",
        description: "",
        requiredDeliverables: "",
        dueDate: "",
        status: "PENDING",
        createdAt: "",
      },
      {
        id: "c2",
        schoolTaskId: "s2",
        schoolTaskTitle: "T2",
        fromDeptCode: "CNTT",
        fromDeptName: "CNTT",
        toDeptCode: "TCKT",
        toDeptName: "Tài chính",
        requestedBy: "B",
        description: "",
        requiredDeliverables: "",
        dueDate: "",
        status: "PENDING",
        createdAt: "",
      },
    ];

    const incomingCNTT = getCollaborationRequestsForDepartment(requests, "CNTT", "incoming");
    assert.equal(incomingCNTT.length, 1);
    assert.equal(incomingCNTT[0].id, "c1");

    const outgoingCNTT = getCollaborationRequestsForDepartment(requests, "CNTT", "outgoing");
    assert.equal(outgoingCNTT.length, 1);
    assert.equal(outgoingCNTT[0].id, "c2");

    const incomingOther = getCollaborationRequestsForDepartment(requests, "KHAC", "incoming");
    assert.equal(incomingOther.length, 0);

    const emptyFilter = getCollaborationRequestsForDepartment([], "CNTT", "incoming");
    assert.deepEqual(emptyFilter, []);
  });
});
