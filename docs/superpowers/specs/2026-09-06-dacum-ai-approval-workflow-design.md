# Tai lieu Thiet ke Ky thuat: He thong Phe duyet Thong minh DACUM voi AI ho tro Lanh dao, Hang doi Tiep nhan (Triage) va Canh bao Qua han (Escalation)

**Ngay lap:** 2026-09-06  
**Tac gia:** QCET Engineering Team & Claude  
**Nhanh phat trien:** `feat/dacum-role-delegation-workflow`  
**Trang thai:** Cho phe duyet (Pending Review)

---

## 1. Tong quan & Boi canh (Executive Summary)

Tai Truong Cao dang Ky thuat Cong nghe Quy Nhon (QCET), he thong quan ly cong viec 3 cap (Truong -> Don vi -> Vien chuc) da ap dung quy trinh phan cap theo Nghi dinh 232 va tieu chuan phan tich nghe DACUM. Tuy nhien, qua trinh van hanh thuc te doi mat voi 3 diem nghen hanh chinh cot loi:

1. **Diem nghen tai ban Lanh dao (Review Bottleneck):** Lanh dao (Hieu truong, Truong phong) mat nhieu thoi gian doc va kiem tra thu cong hang chuc trang tai lieu, bien ban, de cuong truoc khi bam nghiem thu.
2. **Diem nghen giao viec cheo don vi (Cross-dept Friction):** Theo quy che, Truong phong A khong duoc giao viec truc tiep cho chuyen vien phong B. Cac phieu yeu cau phoi hop thuong bi roi vao tinh trang "cong viec khong nguoi nhan" hoac ton dong do thieu hang doi tiep nhan ro rang.
3. **Diem nghen cham tre nghiem thu (Silent Stalls):** Chuyen vien da nop san pham dung han nhung cong viec bi nghen tai trang thai cho duyet ma khong co co che dem gio va canh bao vuot cap.

Tai lieu nay thiet ke giai phap tich hop cac chuan muc tu cac nen tang quan tri hien dai (**Velt, Linear, Taskade, Spide.ai, Microsoft Copilot Approvals, ProvenanceOne**), bo sung 3 module nang luc chinh:
* **AI Executive Review Assistant (Tro ly Tham dinh AI cho Lanh dao):** Tu dong quet san pham ban giao, danh gia do tuan thu DACUM, tom tat cot loi 2-3 cau va de xuat Duyet nhanh 1-click.
* **Cross-Department Triage Queue (Hop thu Tiep nhan Phoi hop theo chuan Linear):** Quan ly tap trung cac yeu cau phoi hop lien phong ban de Truong phong phe duyet va phan bo cho chuyen vien noi bo.
* **Escalation Timers & SLA (Bo dem Canh bao Qua han theo chuan Taskade/Velt):** Thiet lap thoi han tham dinh (48h), tu dong leo thang len Ban Giam hieu neu Truong phong cham tre.

---

## 2. Mo hinh Du lieu & Kieu (Data Models & TypeScript Definitions)

Mo rong mo hinh du lieu trong `src/types/dashboard.ts` ma khong lam vo tinh tuong thich nguoc:

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
  complianceScore: number; // 0 - 100
  dacumCriteriaMatched: string[];
  flags: AIFlagItem[];
  suggestedAction: AISuggestedAction;
  analyzedAt: string;
  suggestedFeedback?: string; // Mau phan hoi hanh chinh san co neu can sua doi
}

export interface EscalationMeta {
  submittedForReviewAt?: string;
  reviewDeadline?: string; // ISO String (mac dinh: submitted + 48h lam viec)
  isEscalated?: boolean;
  escalatedAt?: string;
  escalatedToRole?: 'ADMIN';
  escalationNote?: string;
}

// Mo rong StaffTask hien huu (cac truong deu la optional):
export interface StaffTask {
  id: string;
  title: string;
  description?: string;
  departmentCode: string;
  assigneeId: string;
  assigneeName: string;
  status: TaskStatus; // PENDING | IN_PROGRESS | NEEDS_REVIEW | COMPLETED | BLOCKED | CANCELLED
  dueDate: string;
  schoolTaskId?: string;
  deliverables?: DeliverableItem[];
  deliverableDescription?: string;
  rejectionReason?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;

  // Truong moi:
  triageStatus?: TriageStatus;
  triageSourceDept?: string;
  triageRequestedBy?: string;
  triageRejectionReason?: string;
  escalation?: EscalationMeta;
  aiReview?: AIReviewSummary;
}

// Mo rong thong ke dieu hanh BGH:
export interface DashboardStats {
  // ... cac truong hien co
  pendingTriageCount?: number;
  escalatedReviewCount?: number;
}
```

---

## 3. Thiet ke Engine Xu ly Nghiep vu (`src/lib/dacum-workflow-engine.ts`)

Bao gom 3 ham logic thuan tuy (pure functions) phuc vu kiem thu doc lap va tich hop:

### 3.1. Ham Tham dinh Tu dong bang AI (`screenDeliverablesWithAI`)
* **Dau vao:** `task: StaffTask`, `schoolTask?: SchoolTask`
* **Quy tac danh gia:**
  1. *Kiem tra minh chung:* Phai co it nhat 1 duong dan tai lieu/tep dinh kem hop le hoac mo ta san pham tren 20 ky tu. Neu thieu: `status = HIGH_RISK`, `complianceScore < 50`.
  2. *Kiem tra han chot:* Neu ngay nop gan sat ngay het han cua Nhiem vu cap Truong (< 24h): Canh bao `WARNING` ve rui ro cham tien do chung.
  3. *Doi chieu tieu chi DACUM:* Nhan dien tu khoa ve san pham dau ra (giao trinh, de cuong, bien ban nghiem thu, thiet bi, phan mem, bao cao).
  4. *Sinh Executive Brief:* Doan van 2-3 cau tom tat trang thai hoan thanh va chat luong ho so.
  5. *De xuat hanh dong:* Neu `complianceScore >= 85` -> `QUICK_APPROVE`; neu phat hien loi lon -> `REQUEST_CHANGES` kem mau gop y hanh chinh; nguoc lai -> `MANUAL_INSPECT`.

### 3.2. Ham Quan ly Hang doi Tiep nhan (`processTriageDecision`)
* **Dau vao:**
  - `task: StaffTask`
  - `decision: 'ACCEPT' | 'REJECT'`
  - `actor: AuthUser`
  - `payload?: { targetAssigneeId?: string; targetAssigneeName?: string; internalDueDate?: string; rejectionReason?: string; }`
* **Quy tac:**
  - Chi Truong phong/Lanh dao don vi thu huong (`actor.departmentCode === task.departmentCode` hoac `ADMIN`) moi co quyen ra quyet dinh Triage.
  - Khi `ACCEPT`: Bat buoc phai co `targetAssigneeId`. Trang thai task chuyen tu `PENDING_TRIAGE` sang `IN_PROGRESS`.
  - Khi `REJECT`: Bat buoc phai co `rejectionReason`. Task chuyen sang `CANCELLED` hoac hoan tra ve don vi khoi tao.

### 3.3. Ham Canh bao Qua han Duyet (`evaluateReviewEscalation`)
* **Dau vao:** `task: StaffTask`, `now: Date = new Date()`
* **Quy tac:**
  - Chi ap dung khi `task.status === 'NEEDS_REVIEW'` va da co `escalation.reviewDeadline`.
  - Neu `now.getTime() > new Date(reviewDeadline).getTime()`:
    - Gan `isEscalated = true`.
    - Gan `escalatedAt = now.toISOString()`.
    - Gan `escalatedToRole = 'ADMIN'`.
  - Cung cap quyen `executiveOverride`: Cho phep Tai khoan BGH (`role === 'ADMIN'`) duyet hoan thanh truc tiep doi voi cac task bi can qua han ma Truong phong chua kip xu ly.

---

## 4. Thiet ke Giao dien Nguoi dung (UI/UX Specifications)

### 4.1. Khung Tham dinh AI tren Side-sheet Chi tiet Cong viec (`task-detail-sidesheet.tsx`)
Khi Lanh dao (Truong phong / BGH) mo cong viec o trang thai `NEEDS_REVIEW`:
* **The Tham dinh Nhanh (Executive Brief Card):**
  - Banner trang thai: Xanh la cay (`Dat chuan - San sang nghiem thu`), Vang (`Can luu y`), hoac Do (`Chua dat`).
  - Muc Diem tuan thu: Badge hien thi ti le phan tram (vd: `92% Tuan thu DACUM`).
  - Noi dung tom tat ngan gon (Executive Summary) in dam.
  - Danh sach Co canh bao (neu co).
* **Nhom nut hanh dong Lanh dao:**
  - **Nut "Duyet nhanh theo de xuat AI":** Mau xanh chu dao. Khi bam, tu dong ghi nhan xet nghiem thu cua AI va chuyen trang thai sang `COMPLETED`.
  - **Nut "Yeu cau sua doi":** Mau vang/cam. Mo popup kem noi dung ly do do AI soan thao san, cho phep Truong phong chinh sua truoc khi gui lai cho Chuyen vien.
  - **Nut "Kiem tra thu cong":** Mo day du cac link/file minh chung.

### 4.2. Tab Hop thu Tiep nhan Phoi hop (Triage Queue View)
* Nam tren thanh dieu huong Dashboard cua Lanh dao Don vi.
* Danh sach cac cong viec tu don vi khac chuyen sang dang cho phan cong.
* Nhanh chong thao tac: "Phan cong cho vien chuc" hoac "Tu choi tiep nhan".

### 4.3. Thanh Chi so Dieu hanh (`executive-stat-strip.tsx`)
* Bo sung widget canh bao:
  - `Canh bao ton dong`: So luong task bi tre han tham dinh (>48h).
  - Khi bam vao widget, tu dong loc danh sach cac task `isEscalated == true` de Lanh dao xu ly khan.

---

## 5. Chuan muc Ngon ngu & Tuan thu Hanh chinh (Compliance & Style Rules)

1. **Zero Emojis Policy:** Khong su dung emoji trong toan bo ma nguon, thong bao he thong, nhan giao dien, log hay test case. Su dung badge, mau sac CSS (`text-emerald-700`, `bg-amber-50`, v.v.) va Lucide icons de bieu dat trang thai.
2. **Ngon ngu Hanh chinh Chuan muc:** Thong diep phan hoi, ly do tu choi va tom tat AI phai dung van phong quan ly giao duc nghe nghiep Viet Nam theo Nghi dinh 232 va quy che Truong CD KTCN Quy Nhon.
3. **Audit Trail Minh bach:** Moi hanh dong (AI danh gia, Truong phong duyet nhanh, BGH can thiep vuot cap, Phan cong Triage) deu duoc luu vet thoi gian va nguoi thuc hien trong lich su cong viec.

---

## 6. Ke hoach Kiem thu & Kiem toan (Verification & Audit Plan)

1. **Unit Test cho Engine:**
   - Test cac ca `screenDeliverablesWithAI`: Minh chung hoan hao (Clean), Minh chung so sai (High Risk), Minh chung sat han (Warning).
   - Test quy trinh `processTriageDecision`: Chi Truong phong/BGH duoc tiep nhan, bat buoc chi dinh nguoi nhan khi dong y, bat buoc ghi ly do khi tu choi.
   - Test co che `evaluateReviewEscalation`: Task qua 48h tu dong bat co `isEscalated`, BGH co quyen override.
2. **Integration Test:**
   - Mo rong file `tests/dacum-integration-audit.test.ts` de kiem toan toan bo chu trinh song moi (Life-cycle): Tao phieu phoi hop -> Triage -> Chuyen vien lam viec -> Nop minh chung -> AI Tham dinh -> Lanh dao Duyet nhanh hoac Escalation len BGH -> Rollup cap Truong hoan thanh 100%.
   - Kiem tra chat che tieu chi khong chua bat ky emoji nao (`zero emojis`).
