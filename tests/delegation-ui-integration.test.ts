import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { canUserApproveTask } from "../src/lib/delegation-authority-engine";
import type { DelegationRule } from "../src/types/delegation";

const departmentGroupedTaskViewPath = path.resolve(
  process.cwd(),
  "src/components/dashboard/department-grouped-task-view.tsx"
);
const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
const taskDetailSideSheetPath = path.resolve(
  process.cwd(),
  "src/components/dashboard/task-detail-side-sheet.tsx"
);

describe("Task 3: Stanford Authority Delegation UI Integration Tests", () => {
  const deptViewContent = fs.readFileSync(departmentGroupedTaskViewPath, "utf-8");
  const pageContent = fs.readFileSync(pagePath, "utf-8");
  const sideSheetContent = fs.readFileSync(taskDetailSideSheetPath, "utf-8");

  describe("1. DepartmentGroupedTaskView Delegation Support", () => {
    test("interface DepartmentGroupedTaskViewProps co cac props onManageDelegation va delegations", () => {
      assert.match(
        deptViewContent,
        /onManageDelegation\?\s*:\s*\(departmentCode:\s*string\)\s*=>\s*void/,
        "DepartmentGroupedTaskViewProps phải khai báo prop onManageDelegation"
      );
      assert.match(
        deptViewContent,
        /delegations\?\s*:\s*DelegationRule\[\]/,
        "DepartmentGroupedTaskViewProps phải khai báo prop delegations"
      );
    });

    test("import dung DelegationRule tu @/types/delegation va isDelegationActive tu @/lib/delegation-authority-engine", () => {
      assert.match(
        deptViewContent,
        /import\s+(?:type\s+)?\{\s*[^}]*DelegationRule[^}]*\}\s+from\s+["']@\/types\/delegation["']/,
        "Phải import DelegationRule từ @/types/delegation"
      );
      assert.match(
        deptViewContent,
        /import\s+\{[^}]*isDelegationActive[^}]*\}\s+from\s+["']@\/lib\/delegation-authority-engine["']/,
        "Phải import isDelegationActive từ @/lib/delegation-authority-engine"
      );
    });

    test("import ShieldCheck tu lucide-react voi strokeWidth={1.5}", () => {
      assert.match(
        deptViewContent,
        /ShieldCheck/,
        "Phải import và sử dụng ShieldCheck từ lucide-react"
      );
      assert.match(
        deptViewContent,
        /<ShieldCheck[^>]*strokeWidth=\{1\.5\}/,
        "Icon ShieldCheck phải có strokeWidth={1.5}"
      );
    });

    test("ngan chan su kien toggle accordion khi click nut Uy quyen bang e.stopPropagation()", () => {
      assert.match(
        deptViewContent,
        /e\.stopPropagation\(\)/,
        "Phải gọi e.stopPropagation() để không toggle accordion khi bấm Ủy quyền"
      );
      assert.match(
        deptViewContent,
        /onManageDelegation\(group\.departmentCode\)/,
        "Phải gọi onManageDelegation với mã đơn vị group.departmentCode"
      );
    });

    test("hien thi badge so luong uy quyen con hieu luc", () => {
      assert.match(
        deptViewContent,
        /isDelegationActive/,
        "Phải sử dụng isDelegationActive để lọc các ủy quyền còn hiệu lực"
      );
      assert.match(
        deptViewContent,
        /ủy quyền/,
        "Phải hiển thị nhãn ủy quyền trong badge"
      );
    });
  });

  describe("2. TaskDetailSideSheet Authority & Delegation Support", () => {
    test("interface TaskDetailSideSheetProps ho tro prop delegations", () => {
      assert.match(
        sideSheetContent,
        /delegations\?\s*:\s*DelegationRule\[\]/,
        "TaskDetailSideSheetProps phải khai báo prop delegations"
      );
    });

    test("import DelegationRule va canUserApproveTask", () => {
      assert.match(
        sideSheetContent,
        /import\s+(?:type\s+)?\{\s*[^}]*DelegationRule[^}]*\}\s+from\s+["']@\/types\/delegation["']/,
        "Phải import DelegationRule từ @/types/delegation"
      );
      assert.match(
        sideSheetContent,
        /import\s+\{[^}]*canUserApproveTask[^}]*\}\s+from\s+["']@\/lib\/delegation-authority-engine["']/,
        "Phải import canUserApproveTask từ @/lib/delegation-authority-engine"
      );
    });

    test("hien thi thong bao uy quyen khi approvalResult.isDelegated === true", () => {
      assert.match(
        sideSheetContent,
        /approvalResult\.isDelegated/,
        "Phải kiểm tra approvalResult.isDelegated"
      );
      assert.match(
        sideSheetContent,
        /Phê duyệt theo thẩm quyền ủy quyền của/,
        "Phải hiển thị dòng thông báo thẩm quyền ủy quyền của GrantorName"
      );
    });

    test("hien thi canh bao phan lap nhiem vu (Separation of Duties) va vo hieu hoa nut duyet", () => {
      assert.match(
        sideSheetContent,
        /Theo chuẩn quản trị đại học \(Separation of Duties\), bạn không thể tự nghiệm thu công việc do chính mình phụ trách\./,
        "Phải hiển thị cảnh báo phân lập nhiệm vụ"
      );
      assert.match(
        sideSheetContent,
        /isSeparationOfDutiesBlocked/,
        "Phải có cờ kiểm tra Separation of Duties"
      );
      assert.match(
        sideSheetContent,
        /Nghiệm thu Đạt \(Vô hiệu hóa\)/,
        "Nút duyệt phải bị vô hiệu hóa khi vi phạm phân lập nhiệm vụ"
      );
    });
  });

  describe("3. UnifiedTaskHubPage (src/app/page.tsx) Integration", () => {
    test("import DelegationManagementModal va DelegationRule", () => {
      assert.match(
        pageContent,
        /DelegationManagementModal/,
        "src/app/page.tsx phải import DelegationManagementModal"
      );
      assert.match(
        pageContent,
        /import\s+(?:type\s+)?\{\s*[^}]*DelegationRule[^}]*\}\s+from\s+["']@\/types\/delegation["']/,
        "src/app/page.tsx phải import DelegationRule từ @/types/delegation"
      );
    });

    test("khoi tao state delegations voi du lieu mau chuan QCET", () => {
      assert.match(
        pageContent,
        /TS\.\s*Nguyễn Ngọc Vinh/,
        "Dữ liệu mẫu phải có Trưởng khoa CNTT TS. Nguyễn Ngọc Vinh"
      );
      assert.match(
        pageContent,
        /ThS\.\s*Lê Văn Phó/,
        "Dữ liệu mẫu phải có ThS. Lê Văn Phó"
      );
      assert.match(
        pageContent,
        /K_CNTT/,
        "Dữ liệu mẫu phải thuộc khoa CNTT"
      );
      assert.match(
        pageContent,
        /DACUM_REVIEW_STEP1/,
        "Dữ liệu mẫu phải có phạm vi DACUM_REVIEW_STEP1"
      );
    });

    test("khoi tao state isDelegationModalOpen va delegationDeptCode", () => {
      assert.match(
        pageContent,
        /const\s*\[isDelegationModalOpen,\s*setIsDelegationModalOpen\]/,
        "Phải có state isDelegationModalOpen"
      );
      assert.match(
        pageContent,
        /const\s*\[delegationDeptCode,\s*setDelegationDeptCode\]/,
        "Phải có state delegationDeptCode"
      );
    });

    test("co cac handlers handleOpenDelegation, handleSaveDelegation, handleRevokeDelegation", () => {
      assert.match(
        pageContent,
        /handleOpenDelegation/,
        "Phải có handler handleOpenDelegation"
      );
      assert.match(
        pageContent,
        /handleSaveDelegation/,
        "Phải có handler handleSaveDelegation"
      );
      assert.match(
        pageContent,
        /handleRevokeDelegation/,
        "Phải có handler handleRevokeDelegation"
      );
    });

    test("truyen delegations va onManageDelegation vao DepartmentGroupedTaskView", () => {
      assert.match(
        pageContent,
        /<DepartmentGroupedTaskView[\s\S]*?delegations=\{delegations\}[\s\S]*?\/>/,
        "Phải truyền delegations vào DepartmentGroupedTaskView"
      );
      assert.match(
        pageContent,
        /<DepartmentGroupedTaskView[\s\S]*?onManageDelegation=\{handleOpenDelegation\}[\s\S]*?\/>/,
        "Phải truyền onManageDelegation vào DepartmentGroupedTaskView"
      );
    });

    test("truyen delegations vao TaskDetailSideSheet", () => {
      assert.match(
        pageContent,
        /<TaskDetailSideSheet[\s\S]*?delegations=\{delegations\}[\s\S]*?\/>/,
        "Phải truyền delegations vào TaskDetailSideSheet"
      );
    });

    test("render DelegationManagementModal khi modal duoc kich hoat", () => {
      assert.match(
        pageContent,
        /\{isDelegationModalOpen\s*&&\s*\(\s*<DelegationManagementModal/,
        "Phải render DelegationManagementModal theo điều kiện isDelegationModalOpen"
      );
    });
  });

  describe("4. Business Logic Validation: canUserApproveTask", () => {
    const mockDelegations: DelegationRule[] = [
      {
        id: "del-cntt-001",
        grantorId: "staff-vinh-nn",
        grantorName: "TS. Nguyễn Ngọc Vinh",
        grantorRole: "MANAGER",
        granteeId: "staff-pho-lv",
        granteeName: "ThS. Lê Văn Phó",
        granteeRole: "STAFF",
        departmentCode: "K_CNTT",
        scope: "DACUM_REVIEW_STEP1",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        status: "ACTIVE",
        reason: "Ủy quyền thẩm định DACUM",
        createdAt: "2026-09-01T08:00:00Z",
      },
    ];

    test("can bo duoc uy quyen (Le Van Pho) co quyen duyet nhiem vu cua don vi", () => {
      const result = canUserApproveTask({
        actor: {
          id: "staff-pho-lv",
          name: "ThS. Lê Văn Phó",
          role: "STAFF",
          departmentCode: "K_CNTT",
        },
        task: {
          id: "task-dacum-01",
          departmentCode: "K_CNTT",
          assigneeId: "staff-another-person",
        },
        activeDelegations: mockDelegations,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.isDelegated, true);
      assert.equal(result.rule?.grantorName, "TS. Nguyễn Ngọc Vinh");
    });

    test("vi pham Separation of Duties khi chinh nguoi thuc hien tu duyet", () => {
      const result = canUserApproveTask({
        actor: {
          id: "staff-pho-lv",
          name: "ThS. Lê Văn Phó",
          role: "STAFF",
          departmentCode: "K_CNTT",
        },
        task: {
          id: "task-dacum-02",
          departmentCode: "K_CNTT",
          assigneeId: "staff-pho-lv",
        },
        activeDelegations: mockDelegations,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason || "", /Separation of Duties/);
    });

    test("truong don vi khong the tu duyet viec do chinh minh thuc hien (Separation of Duties)", () => {
      const result = canUserApproveTask({
        actor: {
          id: "staff-vinh-nn",
          name: "TS. Nguyễn Ngọc Vinh",
          role: "MANAGER",
          departmentCode: "K_CNTT",
        },
        task: {
          id: "task-dacum-manager-own",
          departmentCode: "K_CNTT",
          assigneeId: "staff-vinh-nn",
        },
        activeDelegations: mockDelegations,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason || "", /Separation of Duties/);
    });
  });

  describe("5. Anti-Slop & Zero-Emoji Audit", () => {
    const filesToAudit = [
      { name: "department-grouped-task-view.tsx", content: deptViewContent },
      { name: "page.tsx", content: pageContent },
      { name: "task-detail-side-sheet.tsx", content: sideSheetContent },
    ];

    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D0}\u{1F6E0}-\u{1F6E5}\u{1F6F0}-\u{1F6F3}]/gu;

    for (const file of filesToAudit) {
      test(`0% emoji trong file ${file.name}`, () => {
        const matches = [...file.content.matchAll(emojiRegex)];
        assert.equal(
          matches.length,
          0,
          `Phát hiện ${matches.length} emoji trong ${file.name}: ${matches
            .map((m) => m[0])
            .join(", ")}`
        );
      });
    }
  });
});
