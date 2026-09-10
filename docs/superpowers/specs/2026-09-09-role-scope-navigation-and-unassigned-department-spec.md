# Đặc Tả Kỹ Thuật (Spec): Chuẩn Hóa Phân Quyền Phạm Vi (Role Scope Navigation) & Xử Lý Trạng Thái Cán Bộ Chưa Phân Bổ Đơn Vị (Unassigned Department Resolution Engine)

- **Mã tài liệu**: `SPEC-2026-09-09-ROLE-SCOPE-UNASSIGNED-DEPT`
- **Phiên bản**: `1.0.0`
- **Ngày ban hành**: 2026-09-09
- **Trạng thái**: Đề xuất kiến trúc & Sẵn sàng triển khai (Ready for Implementation)
- **Hệ thống**: QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)
- **Tham chiếu thiết kế**: B2B SaaS Role-Based UX, Enterprise RBAC Scope Hierarchy, SaaS Empty State Guidelines (2026).

---

## 1. Bối Cảnh & Vấn Đề Cần Giải Quyết (Problem Statement)

Hệ thống Quản lý công việc của QCET E-Office sử dụng mô hình điều hướng đa phạm vi (Adaptive Scope Switcher) gồm 3 cấp:
1. **Toàn trường (School / Executive Scope)**: Dành cho Ban Giám Hiệu và Quản trị viên để bao quát toàn bộ 100% nhiệm vụ toàn trường và phê duyệt các tờ trình/kết quả thẩm định.
2. **Đơn vị (Unit / Department Scope)**: Dành cho Trưởng đơn vị và Cán bộ/Giảng viên trực thuộc để theo dõi tiến độ, phân rã công việc của Khoa/Phòng mình.
3. **Cá nhân (Personal / My Tasks Scope)**: Hiển thị các công việc được phân công đích danh cho tài khoản.

Tuy nhiên, qua quá trình đưa vào vận hành thử nghiệm, hệ thống đã bộc lộ **3 lỗi tư duy thiết kế (UX Pitfalls) nghiêm trọng** gây hiểu nhầm lớn cho người dùng:

### Hiện trạng 1: Fallback "mù mờ" đánh đồng ��ơn vị với Tên Trường (Misleading Department Fallback)
* **Nguyên nhân cốt lõi**: Khi cán bộ đăng nhập qua Google OAuth (`@qnh.edu.vn`), tài khoản mới được tạo với `role = STAFF` và `departmentId = null`.
* Trong `src/lib/auth-context.tsx`, logic gán mặc định:
  ```ts
  department: dbUser.department?.name || "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
  departmentCode: dbUser.departmentId || "QCET",
  ```
* **Hậu quả**: Tab Đơn vị (Unit Scope) của cán bộ này hiển thị dòng chữ:
  `[Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn]` kèm icon tòa nhà.
* **Hệ lụy UX**: Người dùng tưởng mình đang ở chế độ xem việc **"Toàn trường"**, đặt câu hỏi: *"Sao nhân sự này không xem việc của đơn vị mà xem việc toàn trường?"*.

### Hiện trạng 2: Màn hình rỗng thụ động (Dead-end Empty State) gây hoang mang
* Do `departmentCode = "QCET"`, hệ thống lọc nhiệm vụ theo đơn vị `"QCET"`. Trong cơ sở dữ liệu, toàn bộ nhiệm vụ đều được giao về các đơn vị chuyên môn cụ thể (*Khoa CNTT, Phòng Đào tạo, Khoa Cơ khí, Phòng TCHC...*), **không có nhiệm vụ nào có đơn vị phụ trách là "QCET"**.
* Màn hình trả về **0 nhiệm vụ** kèm dòng thông báo chung chung:
  *"Chưa có nhiệm vụ nào trong danh sách. Hệ thống chưa ghi nhận nhiệm vụ nào phù hợp với bộ lọc và điều kiện hiển thị hiện thời."*
* Cán bộ không hiểu lý do vì sao danh sách trống trơn, tưởng hệ thống bị lỗi dữ liệu hoặc mất kết nối máy chủ.

### Hiện trạng 3: Thiếu cơ chế kích hoạt bổ sung thông tin (Missing Onboarding Trigger)
* Người dùng không nhận được bất kỳ lời nhắc hay nút bấm nào (Call-to-Action) để chọn Khoa/Phòng của mình, dẫn đến việc bị "mắc kẹt" vĩnh viễn ở trạng thái 0 công việc cho đến khi có can thiệp kỹ thuật từ quản trị viên.

---

## 2. Mục Tiêu Thiết Kế & Chỉ Số Đo Lường (Objectives & KPIs)

| Mục tiêu | Hiện trạng | Tiêu chuẩn V2 (Sau khi nâng cấp) |
| :--- | :--- | :--- |
| **Tính minh bạch Scope (Scope Clarity)** | Tab đơn vị hiện tên trường gây nhầm lẫn là việc Toàn trường | Tab Đơn vị hiển thị rõ ràng: `[⚠️ Chưa chọn đơn vị]` với viền cam và badge nhắc nhở. Không bao giờ lấy tên trường làm tên đơn vị. |
| **Chuyển đổi rỗng thành hành động (Actionable Empty State)** | 0 việc, dead-end text | 1-Click Actionable Empty State: Card thông báo giải thích lý do rõ ràng kèm nút `[ Chọn Khoa / Phòng công tác ngay ]`. |
| **Thời gian kích hoạt tài khoản (Time-to-Activate)** | Bị kẹt vô thời hạn | **≤ 15 giây**: Tự động bật Modal Onboarding yêu cầu chọn Khoa/Phòng ngay trong lần đăng nhập đầu tiên. |
| **Phân quyền hiển thị (Strict RBAC Isolation)** | Staff không thấy tab Toàn trường nhưng bị tên trường gây nhầm | 100% người dùng phân biệt rõ rệt: BGH thấy tab Toàn trường (Màu vàng/Amber), Staff chỉ thấy tab Đơn vị (Màu xanh/Blue hoặc Cam/Warning khi chưa gán). |

---

## 3. Kiến Trúc Giải Pháp Kỹ Thuật (Architecture & Implementation Spec)

```
+--------------------------------------------------------------------------------------------------+
|                                          AUTH & PROFILE LAYER                                    |
|                                                                                                  |
|  Google OAuth Login ──> Prisma User Record (departmentId: string | null)                         |
|                                  │                                                               |
|                                  ▼                                                               |
|              mapDbUserToAuthUser() / AuthContext                                                 |
|              ├── isUnassignedDepartment = !user.departmentId || user.departmentId === "QCET"     |
|              ├── department = isUnassignedDepartment ? null : dept.name                         |
|              └── departmentCode = isUnassignedDepartment ? null : dept.code                     |
+----------------------------------┬────────────────────────────────────────────────---------------+
                                   │
                                   ▼
+--------------------------------------------------------------------------------------------------+
|                                   ADAPTIVE NAVIGATION (UI LAYER)                                 |
|                                                                                                  |
|  [AdaptiveScopeHeader]                                                                           |
|    ├── Case A: BGH / Executive ──> [Toàn trường (149)] [Khoa/Phòng (X)] [Việc của tôi]           |
|    ├── Case B: Staff (Đã có Đơn vị) ──> [Khoa CNTT (12)] [Việc của tôi (3)]                      |
|    └── Case C: Staff (Chưa chọn Đơn vị) ──> [⚠️ Chưa chọn đơn vị] [Việc của tôi (0)]            |
|                                                                                                  |
+----------------------------------┬────────────────────────────────────────────────---------------+
                                   │
                                   ▼
+--------------------------------------------------------------------------------------------------+
|                                    WORKSPACE EMPTY STATE LAYER                                   |
|                                                                                                  |
|  IF activeScope === "unit" AND isUnassignedDepartment:                                           |
|  Render <UnassignedDepartmentState>                                                              |
|    ├── Icon: Building2 (Màu hổ phách / Amber warning)                                            |
|    ├── Title: "Tài khoản chưa liên kết Khoa / Phòng công tác"                                    |
|    ├── Description: "Vui lòng chọn Khoa, Phòng ban hoặc Trung tâm bạn đang công tác để hệ thống   |
|    │                đồng bộ và hiển thị công việc đơn vị."                                       |
|    └── Action CTA: Button "Cập nhật Đơn vị công tác ngay" ──> Mở UserProfileModal               |
+--------------------------------------------------------------------------------------------------+
```

---

## 4. Chi Tiết Thay Đổi Mã Nguồn (Detailed Code Changes)

### 4.1. Chuẩn hóa Auth Model & Helper (`src/lib/auth-context.tsx`)

Xóa bỏ hoàn toàn việc fallback `department` thành tên trường cho cán bộ:

```typescript
// src/lib/auth-context.tsx

export function isUserUnassignedDepartment(user?: AuthUser | null): boolean {
  if (!user) return false;
  // BGH hoặc Admin không bị coi là unassigned vì phạm vi hoạt động của họ là toàn trường
  if (isExecutiveUser(user)) return false;
  return (
    !user.departmentId ||
    !user.department ||
    user.departmentId === "QCET" ||
    user.department === "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn" ||
    user.department === "Chưa cập nhật đơn vị"
  );
}
```

Trong hàm `mapDbUserToAuthUser`:
```typescript
const isExecutive = role === "ADMIN";
const hasValidDept = dbUser.departmentId && dbUser.departmentId !== "QCET";

const department = hasValidDept
  ? (dbUser.department?.name || resolveDepartment(dbUser.departmentId)?.name || null)
  : (isExecutive ? "Ban Giám hiệu Nhà trường" : null);

const departmentCode = hasValidDept
  ? dbUser.departmentId
  : (isExecutive ? "BGH" : null);
```

### 4.2. Cập nhật Tab Điều Hướng (`src/components/workspace/components/adaptive-scope-header.tsx`)

Khi người dùng ở trạng thái `isUnassignedDepartment`:
1. Tab Đơn vị mang nhãn: `"Chưa chọn đơn vị"`.
2. Style hiển thị cảnh báo nhẹ: Viền nét đứt màu cam (amber border dashed) và chấm tròn màu hổ phách (pulsing dot).
3. Người dùng bấm vào tab này sẽ kích hoạt modal cập nhật hồ sơ hoặc hiển thị Empty State tương ứng.

```tsx
const isUnassigned = isUserUnassignedDepartment(user);
const unitLabel = isUnassigned
  ? "Chưa chọn đơn vị"
  : (user.department || user.departmentCode || "Đơn vị");

const scopes = [
  // ...
  {
    id: "unit",
    label: unitLabel,
    shortLabel: isUnassigned ? "Chưa chọn đ/vị" : unitLabel,
    icon: Building2,
    visible: true,
    isWarning: isUnassigned,
  },
  // ...
];
```

### 4.3. Thiết kế Component Empty State Chuyên Biệt (`UnassignedDepartmentState.tsx`)

Tạo component thân thiện, chuẩn Light-mode công sở giáo dục:

```tsx
export function UnassignedDepartmentState({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/40 my-6">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 mb-4 shadow-xs">
        <Building2 className="size-7" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1.5">
        Tài khoản chưa được liên kết Khoa / Phòng công tác
      </h3>
      <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
        Bạn đang đăng nhập với tư cách Cán bộ / Giảng viên nhưng hồ sơ chưa được xếp vào Khoa hoặc Phòng ban cụ thể. Vui lòng cập nhật đơn vị để xem danh sách công việc trực thuộc.
      </p>
      <Button
        onClick={onOpenProfile}
        className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
      >
        <Building2 className="size-4" strokeWidth={1.5} />
        Cập nhật Khoa / Phòng công tác ngay
      </Button>
    </div>
  );
}
```

### 4.4. Tự Động Kích Hoạt Onboarding Khi Đăng Nhập Đầu Tiên

Tại `app/layout.tsx` hoặc `AppShell`:
* Nếu người dùng đăng nhập thành công (`user != null`)
* Và `isUserUnassignedDepartment(user) === true`
* Và chưa lưu `snoozed_department_prompt`:
➔ Tự động kích hoạt `setIsProfileModalOpen(true)` để hướng dẫn cán bộ chọn Phòng/Khoa ngay lần đầu vào hệ thống, giải quyết tận gốc tình trạng tài khoản bơ vơ.

---

## 5. Kế Hoạch Kiểm Thử & Xác Nhận (Testing & Verification Strategy)

1. **Unit Tests (`tests/auth-role-isolation.test.ts` & `tests/scope-switcher.test.ts`)**:
   - Kiểm tra `isUserUnassignedDepartment` trả về `true` khi user có `departmentId: null` hoặc `"QCET"`.
   - Kiểm tra user BGH không bao giờ bị coi là unassigned.
   - Kiểm tra nhãn hiển thị của tab Đơn vị khi user là unassigned.
2. **Integration Tests (`tests/adaptive-scope-header.test.ts`)**:
   - Kiểm tra render nút CTA "Cập nhật Khoa / Phòng công tác ngay".
   - Kiểm tra click CTA mở đúng `UserProfileModal`.
3. **TypeScript & Build Check**:
   - Chạy `npm run typecheck` đảm bảo không có lỗi type nào phát sinh.
   - Chạy `npm test` xác nhận toàn bộ test suite pass 100%.
