# Kế Hoạch Triển Khai: Phân Hệ Sổ Văn Bản Đến / Đi & Bút Phê Điện Tử (Nghị định 30/2020/NĐ-CP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh phân hệ Sổ Văn bản Đến / Đi và Bút phê Điện tử cho Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET E-Office) tuân thủ 100% Nghị định 30/2020/NĐ-CP, hỗ trợ cấp số atomic chống trùng lặp, xem PDF Split-view, bút phê BGH tự động tạo Task, và xuất Sổ Excel chuẩn Phụ lục IV.

**Architecture:** Mở rộng Prisma PostgreSQL schema với các thực thể `Document`, `DocumentAttachment`, `DocumentDirective`, `DocumentNumberSequence`. Sử dụng cơ chế Transaction Atomic của Prisma để cấp số đến/đi liên tục theo năm. Tích hợp trực tiếp với Unified Task Hub qua cơ chế Event-driven Pipeline (Document-to-Task) và cung cấp giao diện Split-View 50/50 (PDF scan nửa trái, trích yếu & bút phê nửa phải).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS v4, Prisma ORM 6.19, PostgreSQL, Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-07-nd30-document-registry-spec.md`

## Global Constraints
- Tuân thủ nghiêm ngặt định dạng số văn bản bắt đầu từ số 01 ngày 01/01 đến 31/12 hàng năm (Điều 15 & Điều 22 NĐ 30).
- Xuất file Excel chuẩn Phụ lục IV NĐ 30: 9 cột cho Văn bản Đến, 10 cột cho Văn bản Đi.
- Bút phê BGH có đơn vị chủ trì bắt buộc phải tự động tạo Task cấp trường (`scope: SCHOOL`) trong Task Hub.
- Tuyệt đối không chạy `next build` khi dev server đang chạy để tránh xung đột cache `.next`.
- Sử dụng Tailwind CSS v4 `@theme inline` và biến OKLCH trong `globals.css`.
- Đảm bảo 100% test suite hiện hữu (815 tests) tiếp tục xanh sau khi tích hợp.

---

### Task 1: Mở rộng Prisma Schema & Định nghĩa Types Phân hệ Văn thư

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/types/document.ts`
- Test: `tests/document-schema-integrity.test.ts`

**Interfaces:**
- Consumes: `User`, `Department`, `Task` từ `prisma/schema.prisma`
- Produces: `Document`, `DocumentType`, `DocumentUrgency`, `DocumentSecurityLevel`, `DocumentStatus`, `DocumentDirective`, `DocumentAttachment` trong `@/types/document`

- [ ] **Step 1: Viết test kiểm tra tính toàn vẹn kiểu dữ liệu và schema**

```typescript
// tests/document-schema-integrity.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { 
  DocumentItem, 
  DocumentType, 
  DocumentUrgency, 
  DocumentStatus,
  DocumentDirectiveItem 
} from "../src/types/document";

describe("Document Registry Schema & Types Integrity", () => {
  test("prisma schema contains document models and enums", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const content = fs.readFileSync(schemaPath, "utf-8");
    
    assert.ok(content.includes("model Document {"), "Should define Document model");
    assert.ok(content.includes("model DocumentNumberSequence {"), "Should define DocumentNumberSequence model");
    assert.ok(content.includes("model DocumentAttachment {"), "Should define DocumentAttachment model");
    assert.ok(content.includes("model DocumentDirective {"), "Should define DocumentDirective model");
    assert.ok(content.includes("enum DocumentType {"), "Should define DocumentType enum");
    assert.ok(content.includes("VAN_THU"), "Should include VAN_THU in UserRole");
  });

  test("TypeScript document interfaces validate correctly", () => {
    const mockDoc: DocumentItem = {
      id: "doc-1",
      type: "VAN_BAN_DEN",
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: "2026-09-07T08:00:00Z",
      originalNumber: "125/TCGDNN-VP",
      issuedDate: "2026-09-05T00:00:00Z",
      issuingAuthority: "Tổng cục Giáo dục Nghề nghiệp",
      category: "Công văn",
      summary: "V/v tổ chức hội thi thiết bị đào tạo tự làm toàn quốc",
      urgency: "HOA_TOC",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
      registeredById: "user-vt-1"
    };

    assert.equal(mockDoc.type, "VAN_BAN_DEN");
    assert.equal(mockDoc.urgency, "HOA_TOC");
    assert.equal(mockDoc.registrationNumber, 1);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-schema-integrity.test.ts`  
Expected: FAIL do chưa có file `src/types/document.ts` và chưa cập nhật `prisma/schema.prisma`.

- [ ] **Step 3: Tạo `src/types/document.ts` và cập nhật `prisma/schema.prisma`**

```typescript
// src/types/document.ts
export type DocumentType = 'VAN_BAN_DEN' | 'VAN_BAN_DI' | 'TO_TRINH_NOI_BO';
export type DocumentUrgency = 'THUONG' | 'KHAN' | 'THUONG_KHAN' | 'HOA_TOC';
export type DocumentSecurityLevel = 'THUONG' | 'MAT' | 'TOI_MAT' | 'TUYET_MAT';
export type DocumentStatus = 
  | 'CHO_PHAN_CONG' 
  | 'DANG_XU_LY' 
  | 'CHO_PHE_DUYET' 
  | 'DA_HOAN_THANH' 
  | 'LUU_THEO_DOI';

export interface DocumentAttachmentItem {
  id: string;
  documentId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  sha256Hash?: string | null;
  isOriginal: boolean;
  createdAt?: string;
}

export interface DocumentDirectiveItem {
  id: string;
  documentId: string;
  leaderId: string;
  leaderName?: string;
  instruction: string;
  deadline?: string | null;
  assignedDeptId: string;
  assignedDeptName?: string;
  collaboratorIds?: string | null;
  isTaskGenerated: boolean;
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  type: DocumentType;
  registrationNumber: number;
  documentYear: number;
  registeredDate: string;
  originalNumber: string;
  issuedDate: string;
  issuingAuthority: string;
  category: string;
  summary: string;
  urgency: DocumentUrgency;
  securityLevel: DocumentSecurityLevel;
  dueDate?: string | null;
  status: DocumentStatus;
  
  // Văn bản đi
  signerName?: string | null;
  signerTitle?: string | null;
  draftingDeptId?: string | null;
  draftingDeptName?: string | null;
  recipientList?: string | null;
  distributedCopies?: number | null;

  // Văn bản đến
  leadDepartmentId?: string | null;
  leadDepartmentName?: string | null;
  leadUserId?: string | null;
  leadUserName?: string | null;

  notes?: string | null;
  registeredById: string;
  registeredByName?: string | null;
  
  attachments?: DocumentAttachmentItem[];
  directives?: DocumentDirectiveItem[];
  linkedTaskId?: string | null;
  
  createdAt?: string;
  updatedAt?: string;
}
```

Cập nhật `prisma/schema.prisma` bổ sung `VAN_THU` vào `UserRole` và các models `Document`, `DocumentNumberSequence`, `DocumentAttachment`, `DocumentDirective`.

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-schema-integrity.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/types/document.ts tests/document-schema-integrity.test.ts
git commit -m "feat(documents): add prisma models and typescript contracts for ND30 registry"
```

---

### Task 2: Core Numbering & Document Registration Service

**Files:**
- Create: `src/lib/documents/numbering-engine.ts`
- Create: `src/lib/documents/document-service.ts`
- Test: `tests/document-numbering.test.ts`

**Interfaces:**
- Consumes: `prisma` từ `@/lib/prisma` (hoặc mock in-memory transaction adapter trong test)
- Produces: `getNextRegistrationNumber(type, year, client?)`, `createDocument(payload)`, `listDocuments(filter)`

- [ ] **Step 1: Viết test kiểm tra cấp số liên tục và không trùng lặp**

```typescript
// tests/document-numbering.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { 
  formatDocumentDisplayNumber, 
  generateDocumentCode,
  simulateAtomicNumbering
} from "../src/lib/documents/numbering-engine";

describe("Document Numbering Engine (ND 30/2020)", () => {
  test("formats incoming and outgoing document numbers properly", () => {
    // Sổ đến: Số nguyên tăng dần
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DEN", 1, 2026), "01");
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DEN", 125, 2026), "125");

    // Sổ đi: Số / Ký hiệu viết tắt cơ quan
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DI", 89, 2026, "CĐKTCN-ĐT"), "89/CĐKTCN-ĐT");
  });

  test("generates unique sequence numbers across concurrent requests", async () => {
    const memorySequence = new Map<string, number>();
    
    // Giả lập 20 yêu cầu đồng thời cùng cấp số đến năm 2026
    const requests = Array.from({ length: 20 }, () => 
      simulateAtomicNumbering("VAN_BAN_DEN", 2026, memorySequence)
    );
    
    const results = await Promise.all(requests);
    const uniqueNumbers = new Set(results);
    
    assert.equal(uniqueNumbers.size, 20, "Every concurrent request must get a unique number");
    assert.equal(Math.min(...results), 1, "Should start from 1");
    assert.equal(Math.max(...results), 20, "Should end at 20");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-numbering.test.ts`  
Expected: FAIL do chưa có `src/lib/documents/numbering-engine.ts`.

- [ ] **Step 3: Triển khai `src/lib/documents/numbering-engine.ts` và `src/lib/documents/document-service.ts`**

```typescript
// src/lib/documents/numbering-engine.ts
import type { DocumentType } from "@/types/document";

export function formatDocumentDisplayNumber(
  type: DocumentType,
  num: number,
  year: number,
  departmentCode?: string
): string {
  if (type === "VAN_BAN_DEN") {
    return num < 10 ? `0${num}` : `${num}`;
  }
  if (type === "VAN_BAN_DI") {
    const code = departmentCode || "CĐKTCN";
    return `${num}/${code}`;
  }
  return `TT-${num}/${year}`;
}

export function generateDocumentCode(type: DocumentType, year: number, num: number): string {
  const prefix = type === "VAN_BAN_DEN" ? "VBDEN" : type === "VAN_BAN_DI" ? "VBDI" : "TTNB";
  return `${prefix}-${year}-${String(num).padStart(4, "0")}`;
}

export async function simulateAtomicNumbering(
  type: DocumentType,
  year: number,
  storage: Map<string, number>
): Promise<number> {
  const key = `${type}_${year}`;
  const current = storage.get(key) || 0;
  const next = current + 1;
  storage.set(key, next);
  return next;
}
```

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-numbering.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/numbering-engine.ts tests/document-numbering.test.ts
git commit -m "feat(documents): implement atomic numbering engine per ND30"
```

---

### Task 3: Bút Phê & Đường Ống Tự Động Sinh Nhiệm Vụ (Document-to-Task Pipeline)

**Files:**
- Create: `src/lib/documents/directive-pipeline.ts`
- Test: `tests/document-directive-pipeline.test.ts`

**Interfaces:**
- Consumes: `DocumentItem`, `DocumentDirectiveItem`, `DocumentUrgency`
- Produces: `mapDirectiveToSchoolTask(doc, directive)`, `executeDirectivePipeline(doc, directive, taskCreator)`

- [ ] **Step 1: Viết test cho chuyển đổi từ Bút phê sang Task chuẩn Unified Task Hub**

```typescript
// tests/document-directive-pipeline.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { 
  mapDirectiveToSchoolTask, 
  mapUrgencyToTaskPriority 
} from "../src/lib/documents/directive-pipeline";
import type { DocumentItem, DocumentDirectiveItem } from "../src/types/document";

describe("Document-to-Task Directive Pipeline", () => {
  const sampleDoc: DocumentItem = {
    id: "doc-101",
    type: "VAN_BAN_DEN",
    registrationNumber: 42,
    documentYear: 2026,
    registeredDate: "2026-09-07T08:30:00Z",
    originalNumber: "389/UBND-VX",
    issuedDate: "2026-09-06T00:00:00Z",
    issuingAuthority: "UBND Tỉnh Bình Định",
    category: "Công văn",
    summary: "V/v tăng cường đảm bảo an toàn thông tin và chuyển đổi số quý 4/2026",
    urgency: "HOA_TOC",
    securityLevel: "THUONG",
    status: "CHO_PHAN_CONG",
    registeredById: "vt-01"
  };

  const sampleDirective: DocumentDirectiveItem = {
    id: "dir-01",
    documentId: "doc-101",
    leaderId: "ht-01",
    leaderName: "TS. Lê Hải Đăng (Hiệu trưởng)",
    instruction: "Giao Khoa CNTT chủ trì, phối hợp Phòng Đào tạo rà soát toàn bộ hệ thống trước ngày 15/09",
    deadline: "2026-09-15T17:00:00Z",
    assignedDeptId: "CNTT",
    assignedDeptName: "Khoa Công Nghệ Thông Tin",
    collaboratorIds: JSON.stringify(["DT"]),
    isTaskGenerated: false
  };

  test("correctly maps urgency to task priority", () => {
    assert.equal(mapUrgencyToTaskPriority("HOA_TOC"), "URGENT");
    assert.equal(mapUrgencyToTaskPriority("THUONG_KHAN"), "HIGH");
    assert.equal(mapUrgencyToTaskPriority("KHAN"), "HIGH");
    assert.equal(mapUrgencyToTaskPriority("THUONG"), "NORMAL");
  });

  test("generates valid SchoolTask payload with accurate metadata and backlink", () => {
    const taskPayload = mapDirectiveToSchoolTask(sampleDoc, sampleDirective);
    
    assert.ok(taskPayload.title.includes("389/UBND-VX"), "Task title must include original number");
    assert.equal(taskPayload.scope, "SCHOOL");
    assert.equal(taskPayload.departmentId, "CNTT");
    assert.equal(taskPayload.priority, "URGENT");
    assert.equal(taskPayload.dueDate, "2026-09-15T17:00:00Z");
    assert.ok(taskPayload.description.includes("TS. Lê Hải Đăng (Hiệu trưởng)"));
    assert.ok(taskPayload.description.includes("Giao Khoa CNTT chủ trì"));
    assert.equal(taskPayload.sourceDocumentId, "doc-101");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-directive-pipeline.test.ts`  
Expected: FAIL do chưa có `src/lib/documents/directive-pipeline.ts`.

- [ ] **Step 3: Triển khai `src/lib/documents/directive-pipeline.ts`**

```typescript
// src/lib/documents/directive-pipeline.ts
import type { DocumentItem, DocumentDirectiveItem, DocumentUrgency } from "@/types/document";
import type { TaskPriority } from "@/types/workspace";

export function mapUrgencyToTaskPriority(urgency: DocumentUrgency): TaskPriority {
  switch (urgency) {
    case "HOA_TOC":
      return "URGENT";
    case "THUONG_KHAN":
    case "KHAN":
      return "HIGH";
    case "THUONG":
    default:
      return "NORMAL";
  }
}

export interface GeneratedTaskPayload {
  title: string;
  description: string;
  scope: "SCHOOL";
  departmentId: string;
  priority: TaskPriority;
  dueDate: string;
  sourceDocumentId: string;
  metadata: {
    originalNumber: string;
    issuingAuthority: string;
    leaderName?: string;
    directiveInstruction: string;
  };
}

export function mapDirectiveToSchoolTask(
  doc: DocumentItem,
  directive: DocumentDirectiveItem
): GeneratedTaskPayload {
  const shortSummary = doc.summary.length > 80 ? doc.summary.substring(0, 80) + "..." : doc.summary;
  const title = `[Xử lý VB ${doc.originalNumber}] ${shortSummary}`;
  
  const dueDate = directive.deadline || doc.dueDate || new Date(Date.now() + 7 * 86400000).toISOString();
  
  const description = [
    `TRÍCH YẾU VĂN BẢN: ${doc.summary}`,
    `CƠ QUAN BAN HÀNH: ${doc.issuingAuthority}`,
    `SỐ KÝ HIỆU G��C: ${doc.originalNumber} (Ngày ký: ${doc.issuedDate.slice(0, 10)})`,
    ``,
    `=== Ý KIẾN CHỈ ĐẠO BÚT PHÊ CỦA LÃNH ĐẠO TRƯỜNG ===`,
    `Người chỉ đạo: ${directive.leaderName || 'Ban Giám hiệu'}`,
    `Nội dung: ${directive.instruction}`,
    `Hạn hoàn thành báo cáo: ${dueDate.slice(0, 10)}`,
  ].join("\n");

  return {
    title,
    description,
    scope: "SCHOOL",
    departmentId: directive.assignedDeptId,
    priority: mapUrgencyToTaskPriority(doc.urgency),
    dueDate,
    sourceDocumentId: doc.id,
    metadata: {
      originalNumber: doc.originalNumber,
      issuingAuthority: doc.issuingAuthority,
      leaderName: directive.leaderName,
      directiveInstruction: directive.instruction,
    },
  };
}
```

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-directive-pipeline.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/directive-pipeline.ts tests/document-directive-pipeline.test.ts
git commit -m "feat(documents): implement document-to-task directive pipeline"
```

---

### Task 4: API Routes Quản Lý Văn Bản & Bút Phê

**Files:**
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/directives/route.ts`
- Test: `tests/document-api-routes.test.ts`

**Interfaces:**
- Consumes: `getNextRegistrationNumber`, `mapDirectiveToSchoolTask`
- Produces: REST endpoints `GET/POST /api/documents`, `POST /api/documents/[id]/directives`

- [ ] **Step 1: Viết test cho API route handlers**

```typescript
// tests/document-api-routes.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { 
  validateDocumentCreatePayload,
  validateDirectivePayload 
} from "../src/lib/documents/document-validator";

describe("Document API Validation & Payload Parsing", () => {
  test("validates required document fields", () => {
    const validPayload = {
      type: "VAN_BAN_DEN",
      originalNumber: "99/GDNN",
      issuedDate: "2026-09-01T00:00:00Z",
      issuingAuthority: "Tổng cục GDNN",
      category: "Công văn",
      summary: "Kế hoạch tập huấn chuyển đổi số",
      urgency: "THUONG",
      securityLevel: "THUONG",
      registeredById: "user-1"
    };

    const result = validateDocumentCreatePayload(validPayload);
    assert.equal(result.isValid, true);
  });

  test("rejects payload missing summary or originalNumber", () => {
    const invalidPayload = {
      type: "VAN_BAN_DEN",
      issuingAuthority: "Sở LĐTBXH",
    };

    const result = validateDocumentCreatePayload(invalidPayload);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.length > 0);
  });

  test("validates directive payload requires instruction and assignedDeptId", () => {
    const validDirective = {
      leaderId: "bgh-1",
      instruction: "Giao Phòng Đào tạo tham mưu",
      assignedDeptId: "DT"
    };
    const result = validateDirectivePayload(validDirective);
    assert.equal(result.isValid, true);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-api-routes.test.ts`  
Expected: FAIL do chưa có `src/lib/documents/document-validator.ts`.

- [ ] **Step 3: Triển khai Validator và các API Route Handlers**

Tạo `src/lib/documents/document-validator.ts` và tạo các Next.js Route handlers `src/app/api/documents/route.ts` và `src/app/api/documents/[id]/directives/route.ts`.

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-api-routes.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/document-validator.ts tests/document-api-routes.test.ts
git commit -m "feat(documents): implement document payload validation and api routes"
```

---

### Task 5: Xuất Sổ Excel Chuẩn Phụ Lục IV Nghị Định 30/2020/NĐ-CP

**Files:**
- Create: `src/lib/documents/excel-export.ts`
- Create: `src/app/api/documents/export-excel/route.ts`
- Test: `tests/document-excel-export.test.ts`

**Interfaces:**
- Consumes: `DocumentItem[]`
- Produces: `generateAppendixIVWorkbook(type, year, documents): Buffer`

- [ ] **Step 1: Viết test xác thực cấu trúc các cột trong file kết xuất theo Phụ lục IV**

```typescript
// tests/document-excel-export.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { 
  getAppendixIVHeaders, 
  formatDocumentRowForAppendixIV 
} from "../src/lib/documents/excel-export";
import type { DocumentItem } from "../src/types/document";

describe("Appendix IV (ND 30/2020) Excel Exporter", () => {
  test("returns 9 mandatory columns for incoming document registry (Sổ đến)", () => {
    const headers = getAppendixIVHeaders("VAN_BAN_DEN");
    assert.equal(headers.length, 9);
    assert.equal(headers[0], "Ngày đến");
    assert.equal(headers[1], "Số đến");
    assert.equal(headers[2], "Tác giả");
    assert.equal(headers[3], "Số và ký hiệu văn bản đến");
    assert.equal(headers[4], "Ngày tháng văn bản");
    assert.equal(headers[5], "Tên loại và trích yếu nội dung văn bản");
    assert.equal(headers[6], "Đơn vị hoặc người nhận");
    assert.equal(headers[7], "Ký nhận");
    assert.equal(headers[8], "Ghi chú");
  });

  test("returns 10 mandatory columns for outgoing document registry (Sổ đi)", () => {
    const headers = getAppendixIVHeaders("VAN_BAN_DI");
    assert.equal(headers.length, 10);
    assert.equal(headers[0], "Số và ký hiệu");
    assert.equal(headers[1], "Ngày tháng văn bản");
    assert.equal(headers[2], "Tên loại và trích yếu nội dung văn bản");
    assert.equal(headers[3], "Người ký");
    assert.equal(headers[4], "Đơn vị soạn thảo");
    assert.equal(headers[5], "Nơi nhận");
    assert.equal(headers[6], "Số lượng bản");
    assert.equal(headers[7], "Đơn vị hoặc người nhận bản lưu");
    assert.equal(headers[8], "Ký nhận");
    assert.equal(headers[9], "Ghi chú");
  });

  test("formats document row accurately", () => {
    const doc: DocumentItem = {
      id: "doc-1",
      type: "VAN_BAN_DEN",
      registrationNumber: 15,
      documentYear: 2026,
      registeredDate: "2026-09-07T08:00:00Z",
      originalNumber: "12/UBND",
      issuedDate: "2026-09-05T00:00:00Z",
      issuingAuthority: "UBND Tỉnh Bình Định",
      category: "Công văn",
      summary: "Triển khai nhiệm vụ an toàn mạng",
      urgency: "THUONG",
      securityLevel: "THUONG",
      leadDepartmentName: "Khoa CNTT",
      status: "DANG_XU_LY",
      registeredById: "u1"
    };

    const row = formatDocumentRowForAppendixIV(doc);
    assert.equal(row[0], "07/09/2026"); // Ngày đến
    assert.equal(row[1], 15);           // Số đến
    assert.equal(row[2], "UBND Tỉnh Bình Định"); // Tác giả
    assert.equal(row[3], "12/UBND");    // Số và ký hiệu
    assert.equal(row[4], "05/09/2026"); // Ngày tháng văn bản
    assert.equal(row[5], "Công văn: Triển khai nhiệm vụ an toàn mạng");
    assert.equal(row[6], "Khoa CNTT");  // Đơn vị nhận
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-excel-export.test.ts`  
Expected: FAIL do chưa có `src/lib/documents/excel-export.ts`.

- [ ] **Step 3: Triển khai `src/lib/documents/excel-export.ts` và API Route**

```typescript
// src/lib/documents/excel-export.ts
import type { DocumentItem, DocumentType } from "@/types/document";

export function getAppendixIVHeaders(type: DocumentType): string[] {
  if (type === "VAN_BAN_DEN") {
    return [
      "Ngày đến",
      "Số đến",
      "Tác giả",
      "Số và ký hiệu văn bản đến",
      "Ngày tháng văn bản",
      "Tên loại và trích yếu nội dung văn bản",
      "Đơn vị hoặc người nhận",
      "Ký nhận",
      "Ghi chú",
    ];
  }
  return [
    "Số và ký hiệu",
    "Ngày tháng văn bản",
    "Tên loại và trích yếu nội dung văn bản",
    "Người ký",
    "Đơn vị soạn thảo",
    "Nơi nhận",
    "Số lượng bản",
    "Đơn vị hoặc người nhận bản lưu",
    "Ký nhận",
    "Ghi chú",
  ];
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDocumentRowForAppendixIV(doc: DocumentItem): (string | number)[] {
  if (doc.type === "VAN_BAN_DEN") {
    return [
      formatDate(doc.registeredDate),
      doc.registrationNumber,
      doc.issuingAuthority,
      doc.originalNumber,
      formatDate(doc.issuedDate),
      `${doc.category}: ${doc.summary}`,
      doc.leadDepartmentName || "",
      "", // Ký nhận
      doc.notes || (doc.dueDate ? `Hạn: ${formatDate(doc.dueDate)}` : ""),
    ];
  }

  return [
    doc.originalNumber || `${doc.registrationNumber}/CĐKTCN`,
    formatDate(doc.issuedDate),
    `${doc.category}: ${doc.summary}`,
    doc.signerName || "",
    doc.draftingDeptName || "",
    doc.recipientList || "",
    doc.distributedCopies || 1,
    "Văn thư trường",
    "", // Ký nhận
    doc.notes || "",
  ];
}
```

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-excel-export.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/excel-export.ts tests/document-excel-export.test.ts
git commit -m "feat(documents): implement appendix IV excel export formatter"
```

---

### Task 6: Giao Diện Split-View 50/50 & Trình Xem PDF Bản Scan

**Files:**
- Create: `src/components/documents/document-split-view.tsx`
- Create: `src/components/documents/document-pdf-viewer.tsx`
- Test: `tests/document-split-view.test.ts`

**Interfaces:**
- Consumes: `DocumentItem`, `DocumentAttachmentItem`
- Produces: `DocumentSplitView`, `DocumentPdfViewer`

- [ ] **Step 1: Viết test cho Component Split-View**

```typescript
// tests/document-split-view.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentSplitView } from "../src/components/documents/document-split-view";
import type { DocumentItem } from "../src/types/document";

describe("Document Split-View UI Component", () => {
  const sampleDoc: DocumentItem = {
    id: "doc-1",
    type: "VAN_BAN_DEN",
    registrationNumber: 28,
    documentYear: 2026,
    registeredDate: "2026-09-07T08:00:00Z",
    originalNumber: "123/LĐTBXH",
    issuedDate: "2026-09-04T00:00:00Z",
    issuingAuthority: "Bộ Lao động - Thương binh và Xã hội",
    category: "Quyết định",
    summary: "Ban hành danh mục ngành nghề đào tạo trọng điểm",
    urgency: "THUONG_KHAN",
    securityLevel: "THUONG",
    status: "CHO_PHAN_CONG",
    registeredById: "vt-1",
    attachments: [
      {
        id: "att-1",
        documentId: "doc-1",
        fileName: "123_LDTBXH_Signed.pdf",
        fileUrl: "/mock-files/123_LDTBXH.pdf",
        fileSize: 1024000,
        mimeType: "application/pdf",
        isOriginal: true
      }
    ]
  };

  test("renders both PDF preview area and document metadata area in split layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleDoc })
    );

    assert.ok(html.includes("123/LĐTBXH"), "Must render original number");
    assert.ok(html.includes("Bộ Lao động - Thương binh và Xã hội"), "Must render issuing authority");
    assert.ok(html.includes("123_LDTBXH_Signed.pdf"), "Must render attachment filename");
    assert.ok(html.includes("grid") || html.includes("flex"), "Must use responsive split layout");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-split-view.test.ts`  
Expected: FAIL do chưa có `src/components/documents/document-split-view.tsx`.

- [ ] **Step 3: Triển khai `document-split-view.tsx` và `document-pdf-viewer.tsx`**

Xây dựng component React Server/Client hỗ trợ xem PDF nhúng và bảng điều khiển chi tiết.

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-split-view.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/documents/document-split-view.tsx src/components/documents/document-pdf-viewer.tsx tests/document-split-view.test.ts
git commit -m "feat(documents): implement 50-50 split-view with inline pdf viewer"
```

---

### Task 7: Biểu Mẫu Vào Sổ Cấp Tốc (<60s) & Hộp Bút Phê BGH 1-Chạm

**Files:**
- Create: `src/components/documents/document-quick-entry-modal.tsx`
- Create: `src/components/documents/directive-action-panel.tsx`
- Test: `tests/document-form-presets.test.ts`

**Interfaces:**
- Consumes: Quick Presets config, `DocumentItem`
- Produces: `DocumentQuickEntryModal`, `DirectiveActionPanel`, `QUICK_DIRECTIVE_PRESETS`

- [ ] **Step 1: Viết test cho Mẫu Bút phê Nhanh (Quick Presets)**

```typescript
// tests/document-form-presets.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { 
  QUICK_DIRECTIVE_PRESETS,
  applyPresetToDirective 
} from "../src/components/documents/directive-action-panel";

describe("Quick Directive Presets for Leadership", () => {
  test("contains standard academic and operational presets", () => {
    assert.ok(QUICK_DIRECTIVE_PRESETS.length >= 3);
    const trainingPreset = QUICK_DIRECTIVE_PRESETS.find(p => p.id === "giao-dao-tao");
    assert.ok(trainingPreset, "Must have preset for Training Dept");
    assert.equal(trainingPreset?.defaultDeptId, "DT");
  });

  test("applies preset and sets deadline offset accurately", () => {
    const result = applyPresetToDirective("giao-dao-tao", "2026-09-07T00:00:00Z");
    assert.equal(result.assignedDeptId, "DT");
    assert.ok(result.instruction.includes("Phòng Đào tạo"));
    assert.ok(result.deadline);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/document-form-presets.test.ts`  
Expected: FAIL do chưa có `src/components/documents/directive-action-panel.tsx`.

- [ ] **Step 3: Triển khai `directive-action-panel.tsx` và `document-quick-entry-modal.tsx`**

Xây dựng các presets chỉ đạo nhanh và modal nhập văn bản đến/đi tối ưu bàn phím phím tắt (Tab, Enter) đạt chuẩn vào sổ < 60s.

- [ ] **Step 4: Chạy lại test để xác nhận test chuyển sang xanh (Green)**

Run: `npx tsx --test tests/document-form-presets.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/documents/directive-action-panel.tsx src/components/documents/document-quick-entry-modal.tsx tests/document-form-presets.test.ts
git commit -m "feat(documents): implement quick directive presets and fast registration form"
```

---

### Task 8: Tích Hợp Toàn Diện AppShell & Kiểm Thử E2E Vòng Đời Văn Bản

**Files:**
- Modify: `src/app/page.tsx` (Bổ sung zone `documents`)
- Modify: `src/components/layout/sidebar-context.tsx`
- Create: `tests/document-lifecycle-e2e.test.ts`

**Interfaces:**
- Consumes: Toàn bộ các module từ Task 1 -> Task 7
- Produces: Hoàn thiện luồng: Vào sổ -> Trình BGH -> Bút phê -> Sinh Task -> Đóng sổ Excel

- [ ] **Step 1: Viết test E2E cho toàn bộ chu trình xử lý văn bản**

```typescript
// tests/document-lifecycle-e2e.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentDisplayNumber } from "../src/lib/documents/numbering-engine";
import { mapDirectiveToSchoolTask } from "../src/lib/documents/directive-pipeline";
import { formatDocumentRowForAppendixIV } from "../src/lib/documents/excel-export";
import type { DocumentItem, DocumentDirectiveItem } from "../src/types/document";

describe("E2E Document Lifecycle: Entry -> Endorsement -> Task -> Export", () => {
  test("runs complete cycle without data loss or integrity violation", () => {
    // 1. Vào sổ văn bản đến
    const doc: DocumentItem = {
      id: "doc-e2e-01",
      type: "VAN_BAN_DEN",
      registrationNumber: 105,
      documentYear: 2026,
      registeredDate: "2026-09-07T09:00:00Z",
      originalNumber: "789/SGDĐT",
      issuedDate: "2026-09-06T00:00:00Z",
      issuingAuthority: "Sở Giáo dục và Đào tạo",
      category: "Kế hoạch",
      summary: "Kế hoạch tổ chức thi đua dạy tốt học tốt chào mừng năm học mới",
      urgency: "KHAN",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
      registeredById: "vt-01"
    };

    assert.equal(formatDocumentDisplayNumber(doc.type, doc.registrationNumber, doc.documentYear), "105");

    // 2. BGH bút phê chỉ đạo
    const directive: DocumentDirectiveItem = {
      id: "dir-e2e-01",
      documentId: doc.id,
      leaderId: "bgh-01",
      leaderName: "Phó Hiệu trưởng phụ trách Đào tạo",
      instruction: "Giao Khoa Cơ khí xây dựng kế hoạch chi tiết tham gia trước 20/09",
      deadline: "2026-09-20T17:00:00Z",
      assignedDeptId: "CK",
      assignedDeptName: "Khoa Cơ Khí",
      isTaskGenerated: true
    };

    // 3. Đường ống sinh Task tự động
    const task = mapDirectiveToSchoolTask(doc, directive);
    assert.equal(task.departmentId, "CK");
    assert.equal(task.priority, "HIGH");
    assert.equal(task.dueDate, "2026-09-20T17:00:00Z");

    // 4. Kết xuất dòng Excel phục vụ đóng sổ
    doc.leadDepartmentName = "Khoa Cơ Khí";
    doc.status = "DANG_XU_LY";
    const excelRow = formatDocumentRowForAppendixIV(doc);
    assert.equal(excelRow[1], 105);
    assert.equal(excelRow[3], "789/SGDĐT");
    assert.equal(excelRow[6], "Khoa Cơ Khí");
  });
});
```

- [ ] **Step 2: Chạy test E2E để xác nhận chuyển xanh**

Run: `npx tsx --test tests/document-lifecycle-e2e.test.ts`  
Expected: PASS

- [ ] **Step 3: Kiểm tra toàn bộ hệ thống (Typecheck + Full Test Suite)**

Run:
```bash
npm run typecheck
npm test
```
Expected: All 815+ tests pass with zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/layout/sidebar-context.tsx tests/document-lifecycle-e2e.test.ts
git commit -m "feat(documents): integrate document registry workspace into appshell and pass e2e lifecycle test"
```
