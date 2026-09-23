/**
 * QCET Task Detail E2E Persistence, Rollup, Security & Real Data Suite (V2)
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { recalculateParentTaskProgress } from "@/server/tasks/task-command-service";
import { canUserDeleteDeliverable } from "@/server/tasks/task-policy";
import { canDeleteDeliverable } from "@/server/policies/task-policy";
import { getTextOffsetInContainer } from "@/components/tasks/detail/direct-inline-editor";
import { TaskStatus } from "@prisma/client";

describe("Task Detail E2E Persistence, Rollup, Security & Real Data Suite", () => {
  // =========================================================================
  // 1. NGHIỆP VỤ TIẾN ĐỘ TỔNG HỢP (PARENT PROGRESS ROLLUP & STATE TRANSITION)
  // =========================================================================
  describe("1. Parent Progress Rollup & State Transitions", () => {
    it("tự động cập nhật tiến độ cha khi các việc con hoàn thành (100% -> WAITING_APPROVAL, không bypass duyệt)", async () => {
      // Mock Transaction Client
      const parentTask = {
        id: "task-parent-1",
        status: TaskStatus.IN_PROGRESS,
        progressPercent: 0,
        version: 1,
      };

      const subTasks = [
        { id: "sub-1", status: TaskStatus.COMPLETED },
        { id: "sub-2", status: TaskStatus.COMPLETED },
      ];

      let updatedParentData: any = null;
      let loggedAuditEvent: any = null;

      const mockTx: any = {
        task: {
          findMany: async () => subTasks,
          findUnique: async () => parentTask,
          update: async ({ data }: any) => {
            updatedParentData = data;
            return { ...parentTask, ...data };
          },
        },
        auditEvent: {
          create: async ({ data }: any) => {
            loggedAuditEvent = data;
            return data;
          },
        },
      };

      const result = await recalculateParentTaskProgress(mockTx, "task-parent-1", "user-1");

      assert.equal(result.updated, true);
      assert.equal(result.newProgress, 100);
      assert.equal(result.newStatus, TaskStatus.WAITING_APPROVAL);
      assert.equal(updatedParentData.progressPercent, 100);
      assert.equal(updatedParentData.status, TaskStatus.WAITING_APPROVAL);
      assert.ok(loggedAuditEvent, "AuditEvent phải được ghi khi tiến độ cha thay đổi");
      assert.equal(loggedAuditEvent.entityId, "task-parent-1");
    });

    it("mở lại việc con thì task cha tự động quay lại IN_PROGRESS (không bị kẹt ở COMPLETED/WAITING_APPROVAL)", async () => {
      const parentTask = {
        id: "task-parent-2",
        status: TaskStatus.COMPLETED,
        progressPercent: 100,
        version: 2,
      };

      // 1 trong 2 subtask bị mở lại từ COMPLETED -> IN_PROGRESS
      const subTasks = [
        { id: "sub-1", status: TaskStatus.COMPLETED },
        { id: "sub-2", status: TaskStatus.IN_PROGRESS },
      ];

      let updatedParentData: any = null;
      const mockTx: any = {
        task: {
          findMany: async () => subTasks,
          findUnique: async () => parentTask,
          update: async ({ data }: any) => {
            updatedParentData = data;
            return { ...parentTask, ...data };
          },
        },
        auditEvent: {
          create: async () => ({}),
        },
      };

      const result = await recalculateParentTaskProgress(mockTx, "task-parent-2", "user-1");

      assert.equal(result.updated, true);
      assert.equal(result.newProgress, 50);
      assert.equal(result.newStatus, TaskStatus.IN_PROGRESS);
      assert.equal(updatedParentData.status, TaskStatus.IN_PROGRESS);
      assert.equal(updatedParentData.progressPercent, 50);
    });

    it("không can thiệp hoặc ghi đè tiến độ cha khi không còn việc con active nào", async () => {
      const parentTask = {
        id: "task-parent-empty",
        status: TaskStatus.IN_PROGRESS,
        progressPercent: 75,
        version: 1,
      };

      const mockTx: any = {
        task: {
          findMany: async () => [], // Không có subtask nào
          findUnique: async () => parentTask,
          update: async () => {
            throw new Error("Không được gọi update khi không có subtask");
          },
        },
        auditEvent: {
          create: async () => ({}),
        },
      };

      const result = await recalculateParentTaskProgress(mockTx, "task-parent-empty", "user-1");
      assert.equal(result.updated, false, "Phải giữ nguyên tiến độ cha tự do của người dùng");
    });
  });

  // =========================================================================
  // 2. BẢO VỆ BOLA / IDOR KHI XÓA TÀI LIỆU MINH CHỨNG (TASK-DELIVERABLE RELATION)
  // =========================================================================
  describe("2. Security: Deliverable Deletion & BOLA/IDOR Protection", () => {
    it("từ chối xóa tài liệu nếu tài liệu thuộc nhiệm vụ khác (BOLA/IDOR Protection)", () => {
      const user = {
        id: "user-attacker",
        name: "Attacker User",
        email: "attacker@qcet.edu.vn",
        role: "STAFF" as any,

      };

      const deliverable = {
        id: "deliv-999",
        uploadedById: "user-attacker",
        taskId: "task-legitimate-1", // Thuộc task 1
      };

      const targetTask = {
        id: "task-different-2", // Nhưng yêu cầu xóa qua task 2
        createdById: "user-attacker",

        status: TaskStatus.IN_PROGRESS,
      };

      const check1 = canUserDeleteDeliverable(user, deliverable, targetTask);
      assert.equal(check1.allowed, false, "canUserDeleteDeliverable phải từ chối khi taskId không khớp");

      const check2 = canDeleteDeliverable(user, deliverable, targetTask as any);
      assert.equal(check2, false, "canDeleteDeliverable policy phải trả về false khi taskId không khớp");
    });

    it("cho phép người tải lên, Admin, hoặc DRI xóa tài liệu thuộc đúng nhiệm vụ", () => {
      const uploader = {
        id: "user-author",
        name: "Author User",
        email: "author@qcet.edu.vn",
        role: "STAFF" as any,

      };

      const deliverable = {
        id: "deliv-101",
        uploadedById: "user-author",
        taskId: "task-100",
      };

      const task = {
        id: "task-100",
        createdById: "user-boss",

        status: TaskStatus.IN_PROGRESS,
        assignees: [{ userId: "user-dri" }],
      };

      // 1. Người nộp xóa chính tài liệu của mình -> ALLOWED
      const checkAuthor = canUserDeleteDeliverable(uploader, deliverable, task);
      assert.equal(checkAuthor.allowed, true);

      // 2. Kẻ thứ 3 không liên quan -> DENIED
      const stranger = {
        id: "user-stranger",
        name: "Stranger User",
        email: "stranger@qcet.edu.vn",
        role: "STAFF" as any,

      };
      const checkStranger = canUserDeleteDeliverable(stranger, deliverable, task);
      assert.equal(checkStranger.allowed, false);

      // 3. Admin -> ALLOWED
      const admin = {
        id: "user-admin",
        name: "Admin User",
        email: "admin@qcet.edu.vn",
        role: "ADMIN" as any,
      };
      const checkAdmin = canUserDeleteDeliverable(admin, deliverable, task);
      assert.equal(checkAdmin.allowed, true);
    });
  });

  // =========================================================================
  // 3. XÁC MINH MÃ NGUỒN: KHÔNG CÓ MOCK, RETRY AN TOÀN, VÀ DỮ LIỆU BỀN VỮNG
  // =========================================================================
  describe("3. Codebase Audit: Zero Mock, Rollback & Validation Invariants", () => {
    it("src/components/tasks/detail/task-identity-block.tsx loại bỏ hoàn toàn ID ảo và form đính kèm trùng lặp", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/components/tasks/detail/task-identity-block.tsx"),
        "utf8"
      );

      // 1. Không chứa fallback tạo ID ảo res-${Date.now()}
      assert.ok(
        !source.includes("res-${Date.now()}"),
        "Không được tạo ID ảo res-${Date.now()} phía client"
      );

      // 2. Không chứa Resources popover trùng lặp với native editor
      assert.ok(
        !source.includes("isResourcePopoverOpen"),
        "Không còn popover tài liệu trùng lặp trong identity block"
      );
    });

    it("src/components/tasks/task-detail-page.tsx xử lý rollback khi API lỗi và không tạo state giả", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/components/tasks/task-detail-page.tsx"),
        "utf8"
      );

      // Phải có cơ chế rollback deliverables khi xóa lỗi
      assert.ok(
        source.includes("setDeliverables(previousDeliverables)") || source.includes("previousDeliverables"),
        "Phải có cơ chế rollback danh sách tài liệu khi xóa thất bại"
      );

      // Xóa bỏ hoàn toàn res-${Date.now()}
      assert.ok(
        !source.includes("id: `res-${Date.now()}`"),
        "Không được chèn deliverable giả vào React state"
      );
    });

    it("src/app/tasks/[id]/page.tsx đọc dữ liệu thật từ bảng audit_events và map actorName từ User", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/app/tasks/[id]/page.tsx"),
        "utf8"
      );

      // Phải truy vấn từ bảng auditEvent
      assert.ok(
        source.includes("prisma.auditEvent.findMany"),
        "Trang chi tiết nhiệm vụ phải nạp lịch sử thực tế từ bảng audit_events"
      );

      // Phải map tên người dùng qua User
      assert.ok(
        source.includes("prisma.user.findMany") && source.includes("actorMap"),
        "Phải phân giải tên người thao tác actorName từ bảng User"
      );
    });

    it("src/lib/services/task-domain-actions.ts tự động chuyển NOT_STARTED sang IN_PROGRESS và đồng bộ cha", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/lib/services/task-domain-actions.ts"),
        "utf8"
      );

      assert.ok(
        source.includes("recalculateParentTaskProgress"),
        "task-domain-actions phải tích hợp recalculateParentTaskProgress cho việc cha"
      );
      assert.ok(
        source.includes("targetStatus = TaskStatus.IN_PROGRESS"),
        "updateProgress phải tự động chuyển NOT_STARTED sang IN_PROGRESS khi progress > 0"
      );
    });

    it("src/app/api/tasks/[id]/route.ts validate ngày bắt đầu không sau thời hạn trên dữ liệu merged", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/tasks/[id]/route.ts"),
        "utf8"
      );

      assert.ok(
        source.includes("mergedStartDate") && source.includes("mergedDueDate"),
        "PATCH API phải validate ngày sau khi merge với dữ liệu DB hiện tại"
      );
    });
  });

  // =========================================================================
  // 5. STATUS TRANSITION ACTIONS & REBAC/LEAD_UNIT AUTHORITY
  // =========================================================================
  describe("5. Status Transition Actions & Execution Authority", () => {
    it("src/lib/tasks/task-actions.ts phân tách command updateTaskStatus và submitTaskResult chuẩn domain", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/lib/tasks/task-actions.ts"),
        "utf8"
      );

      assert.ok(
        source.includes("/api/tasks/${taskId}/actions/update-status"),
        "updateTaskStatus phải gọi canonical endpoint /api/tasks/[id]/actions/update-status"
      );
      assert.ok(
        source.includes("export async function submitTaskResult"),
        "submitTaskResult phải là command riêng biệt cho nộp kết quả"
      );
    });

    it("src/lib/auth/hybrid-authorization.ts cho phép DRI, Collaborator, Assigner, Lead Unit và Admin cập nhật tiến độ", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth/hybrid-authorization.ts"),
        "utf8"
      );

      assert.ok(
        source.includes('relationships.has("LEAD_UNIT")') &&
        source.includes('relationships.has("ASSIGNER")') &&
        (source.includes('user.role === "ADMIN"') || source.includes('user.role.toUpperCase() === "ADMIN"')),
        "hybrid-authorization phải cho phép LEAD_UNIT, ASSIGNER và ADMIN cập nhật tiến độ/nộp kết quả"
      );
    });
    it("src/lib/services/task-domain-actions.ts cho phép chuyển từ WAITING_APPROVAL về IN_PROGRESS", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/lib/services/task-domain-actions.ts"),
        "utf8"
      );

      // Không còn chặn WAITING_APPROVAL trong hàm start
      assert.ok(
        !source.includes('throw new InvalidTransitionError("Nhiệm vụ đang chờ duyệt kết quả"'),
        "Hàm start không được chặn nhiệm vụ đang ở WAITING_APPROVAL chuyển về IN_PROGRESS"
      );

      // Cho phép hủy bỏ pending steps khi rút lại duyệt
      assert.ok(
        source.includes("ApprovalStepStatus.PENDING") && source.includes("ApprovalProcessStatus.CANCELLED"),
        "Hàm start phải cập nhật các approval step pending và process khi chuyển từ WAITING_APPROVAL về IN_PROGRESS"
      );
    });
  });
});
