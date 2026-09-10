# Đặc Tả Kỹ Thuật (Spec): Nâng Cấp Hệ Thống Onboarding & Tăng Tốc Kích Hoạt Người Dùng (Next-Gen Onboarding & User Activation Engine)

- **Mã tài liệu**: `SPEC-2026-09-09-ONBOARDING-ENHANCEMENT`
- **Phiên bản**: `2.0.0`
- **Ngày ban hành**: 2026-09-09
- **Trạng thái**: Đã phê duyệt kiến trúc (Ready for Implementation)
- **Hệ thống**: QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)
- **Tập trung cốt lõi**: Nâng cấp trải nghiệm tiếp cận hệ thống, rút ngắn Time-to-First-Value (TTFV < 60s), tối ưu hóa tỷ lệ chuyển đổi Web Push qua Soft-Ask Priming, cơ chế Tạm hoãn (Snooze 24h), khen thưởng trực quan (Celebration UX), và bảo vệ tính toàn vẹn dữ liệu đa thiết bị (Zero Step Loss).

---

## 1. Bối Cảnh & Vấn Đề Cần Giải Quyết (Problem Statement)

Hệ thống Onboarding V1 (triển khai ngày 07/09/2026) đã định hình thành công khung cấu trúc cơ bản gồm:
- Modal chào mừng (`WelcomeModal`) phân hóa theo vai trò.
- Spotlight Tour 3 bước (`SpotlightTour`) với SVG cutout mask.
- Widget tiến trình nổi (`OnboardingChecklistWidget`) áp dụng hiệu ứng *Endowed Progress* (tặng trước 25% tiến độ).
- Bottom Sheet chuẩn bị thông báo Web Push (`PushOnboardingSheet`).

Tuy nhiên, qua quá trình kiểm thử thực tế và đối chiếu với dữ liệu nghiên cứu chuẩn ngành (B2B SaaS / EduTech Benchmarks từ Exa Research), hệ thống hiện bộc lộ **5 điểm nghẽn nghiêm trọng**:

1. **Hội chứng "Tour Fatigue" do Chuyển bước Cưỡng bức (Invasive Tour Transition)**:
   - Khi người dùng bấm "Xem hướng dẫn", hệ thống lập tức kích hoạt `SpotlightTour` che phủ toàn bộ màn hình. Với cán bộ, giảng viên đang có việc gấp (ví dụ: cần nộp minh chứng ngay hoặc duyệt văn bản đến), việc bị ép vào tour gây ức chế tâm lý, dẫn đến xu hướng bấm phím `ESC` để thoát vội vã.
2. **Thiếu Cơ Chế Tạm Hoãn Linh Hoạt (Missing Snooze Option)**:
   - Dù Prisma Schema và Zod Schema đã có trường `snoozedUntil: string | null`, trên giao diện `OnboardingChecklistWidget` hiện chỉ có 2 lựa chọn cực đoan: hoặc để widget hiển thị liên tục, hoặc bấm nút ẩn (`isDismissed = true`) khiến widget thu thành mini-pill và khó quay lại. Cần một lựa chọn tự nhiên: *"Nhắc lại tôi sau 24 giờ"*.
3. **Xin Quyền Web Push Quá Sớm & Thiếu Ngữ Cảnh Giá Trị (Unprimed Early Push Ask)**:
   - Bước `step-push` hiện đứng ngay vị trí thứ 2 trong Checklist cố định. Cán bộ chưa cảm nhận được giá trị thực tế của hệ thống đã bị yêu cầu bật thông báo. Tỷ lệ cấp quyền (Opt-in Rate) của các thông báo dạng này trong thực tế chỉ đạt ~20-30%, trong khi nếu kích hoạt sau một hành động có giá trị (Value-Triggered Priming), tỷ lệ này đạt > 70%.
4. **Thiếu Yếu Tố Khen Thưởng & Ghi Nhận Thành Tựu (No Closure / Celebration UX)**:
   - Khi hoàn thành đủ 4/4 bước (100%), widget chỉ hiện một dòng text "Đã hoàn thành!" đơn điệu rồi biến mất sau 3 giây. Thiếu micro-interaction khen thưởng (Subtle Confetti / Milestone Badge) làm mất đi cảm giác thỏa mãn và ghi nhận sự cố gắng của người dùng trong việc làm quen với công nghệ mới.
5. **Rủi Ro Tranh Chấp Ghi Đè Tiến Trình Đa Thiết Bị (Concurrent Step Race Condition)**:
   - API `PATCH /api/users/onboarding` hiện tại ghi đè trực tiếp mảng `completedSteps` từ body request:
     `const mergedData = { ...existingData, ...parsed.data };`
   - Nếu người dùng thao tác đồng thời trên cả máy tính bàn và điện thoại di động (PWA), hoặc hoàn thành 2 bước nhanh liên tiếp khi mạng chập chờn, request sau có thể ghi đè làm mất bước mà request trước vừa lưu.

---

## 2. Mục Tiêu Thiết Kế & Chỉ Số Đo Lường (Objectives & KPIs)

| Chỉ số (Metric) | Hiện trạng V1 | Mục tiêu V2 | Giải pháp kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Checklist Completion Rate** | ~35% - 40% | **≥ 70%** | Giữ vững Endowed Progress (25%), bổ sung Snooze 24h và Deep-link hành động 1-click. |
| **Push Notification Opt-in** | ~28% | **≥ 65%** | Chuyển từ Fixed Step sang Contextual Value-Triggered Priming (hỏi sau khi tạo/duyệt việc đầu tiên). |
| **Time-to-First-Value (TTFV)** | ~180 giây | **≤ 45 giây** | Zero-Modal Quick Start: Cho phép bỏ qua tour để làm ngay, gợi ý bước tiếp theo theo ngữ cảnh. |
| **Tour Completion Rate** | ~30% (bị skip nhiều) | **≥ 60%** | Biến tour thành On-Demand / Interactive Walkthrough ngắn (chỉ 3 bước trọng tâm, không ép buộc). |
| **Data Integrity (Zero Loss)** | Tiềm ẩn race condition | **100% Consistent** | Backend áp dụng Set Union / Atomic Merge cho mảng `completedSteps`. |

---

## 3. Thiết Kế Kiến Trúc & Chi Tiết Kỹ Thuật

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT LAYER                                         |
|                                                                                         |
|  [AppShell]                                                                             |
|      ├── [WelcomeModal]  --> Lựa chọn: "Vào việc ngay" vs "Khám phá 45s"                |
|      ├── [SpotlightTour] --> On-demand 3 bước (Safe fallback khi chưa có dữ liệu)       |
|      ├── [OnboardingChecklistWidget]                                                    |
|      │       ├── Progress Bar (Endowed Progress 25% -> 100%)                            |
|      │       ├── 1-Click Actionable Items (Deep-link tới Modal nghiệp vụ)               |
|      │       ├── Snooze Action ("Nhắc lại sau 24h" -> snoozedUntil)                     |
|      │       └── Celebration Engine (Canvas Confetti / OKLCH Light-Mode particles)      |
|      └── [PushOnboardingSheet]                                                          |
|              ├── Value Proposition Priming ("Nhận thông báo lịch họp khẩn BGH")        |
|              └── Recovery Guide (Hướng dẫn mở lại quyền nếu đã lỡ ấn Block)            |
+--------------------------------------------▲--------------------------------------------+
                                             │ Custom Events & Hook Sync
+--------------------------------------------▼--------------------------------------------+
|                                  STATE & HOOK LAYER                                     |
|                                                                                         |
|  [useOnboarding]                                                                        |
|      ├── State: hasSeenWelcome, hasCompletedTour, completedSteps, isDismissed, snoozed   |
|      ├── Optimistic Updates & Debounced Network Sync                                    |
|      ├── Contextual Trigger Listeners (qcet:task-created, qcet:deliverable-submitted)   |
|      └── Dual Storage: LocalStorage Cache <---> Session Auth Me Sync                    |
+--------------------------------------------▲--------------------------------------------+
                                             │ HTTP REST (JWT Session)
+--------------------------------------------▼--------------------------------------------+
|                                 BACKEND / API LAYER                                     |
|                                                                                         |
|  [PATCH /api/users/onboarding]                                                          |
|      ├── Session Validation & User Scoping (Chống IDOR)                                 |
|      ├── Zod Schema Validation (updateOnboardingSchema)                                 |
|      ├── Atomic Step Merging: Set Union (completedSteps = Array.from(new Set([...])))   |
|      ├── Auto-detect isFinished (>= 4 steps) -> Set onboardedAt = new Date()            |
|      └── Prisma Postgres: users.onboarding_data (jsonb) + users.onboarded_at (DateTime) |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Đặc Tả Chi Tiết Từng Thành Phần

### 4.1. Cải Tiến Backend API: Atomic Step Union (`src/app/api/users/onboarding/route.ts`)

#### Vấn đề:
Khi người dùng cập nhật `completedSteps`, việc merge nông `{ ...existingData, ...parsed.data }` sẽ ghi đè toàn bộ mảng nếu client gửi mảng mới.

#### Giải pháp Đặc tả:
Thực hiện toán tử hợp nhất tập hợp (Set Union) đảm bảo các bước đã hoàn thành không bao giờ bị xóa trừ khi gọi endpoint `DELETE`:

```typescript
// Trích xuất mảng hiện tại và mảng mới
const currentSteps = Array.isArray(existingData.completedSteps)
  ? existingData.completedSteps
  : [];
const incomingSteps = Array.isArray(parsed.data.completedSteps)
  ? parsed.data.completedSteps
  : [];

// Hợp nhất không trùng lặp (Set Union)
const mergedSteps = Array.from(new Set([...currentSteps, ...incomingSteps]));

// Hợp nhất dữ liệu tổng thể
const mergedData: OnboardingState = {
  ...existingData,
  ...parsed.data,
  completedSteps: mergedSteps,
};

// Đánh giá hoàn thành (4 bước cơ bản của hệ thống)
const REQUIRED_STEPS = ["step-profile", "step-push", "step-action", "step-search"];
const isFinished = REQUIRED_STEPS.every((step) => mergedSteps.includes(step));

const updated = await prisma.user.update({
  where: { id: payload.id },
  data: {
    onboardingData: mergedData,
    onboardedAt: isFinished ? (current?.onboardedAt || new Date()) : undefined,
  },
  select: {
    id: true,
    onboardedAt: true,
    onboardingData: true,
  },
});
```

---

### 4.2. Quản Lý Trạng Thái Client & Snooze Logic (`src/hooks/use-onboarding.ts`)

#### Bổ sung State & Action:
1. **Kiểm tra trạng thái Tạm hoãn (Snooze Check):**
   ```typescript
   export function isSnoozed(snoozedUntil: string | null | undefined): boolean {
     if (!snoozedUntil) return false;
     const snoozeDate = new Date(snoozedUntil);
     return !isNaN(snoozeDate.getTime()) && snoozeDate.getTime() > Date.now();
   }
   ```
2. **Hành động `snoozeOnboarding(hours: number = 24)`:**
   - Tính toán mốc thời gian: `new Date(Date.now() + hours * 3600 * 1000).toISOString()`.
   - Cập nhật optimistic local state: `snoozedUntil = mốc_mới`.
   - Gọi API `PATCH /api/users/onboarding` với payload `{ snoozedUntil }`.
   - Bắn toast thông báo nhẹ nhàng: *"Đã tạm hoãn hướng dẫn trong 24 giờ. Bạn có thể mở lại bất kỳ lúc nào từ menu cá nhân."*
3. **Kích hoạt theo sự kiện nghiệp vụ thực tế (Contextual Value-Triggered Priming):**
   - Lắng nghe sự kiện `qcet:task-created` hoặc `qcet:deliverable-submitted`.
   - Nếu người dùng chưa hoàn thành `step-push`:
     - Không nảy popup ngay lập tức.
     - Hiển thị một banner gợi ý tinh tế (In-app Notification Banner): *"Bạn có muốn nhận thông báo khi Ban Giám hiệu duyệt tờ trình này không? [Bật thông báo ngay]"*.
     - Bấm vào banner sẽ kích hoạt `PushOnboardingSheet`.

---

### 4.3. Nâng Cấp Widget Checklist & Gamification (`src/components/onboarding/onboarding-checklist-widget.tsx`)

#### Giao diện & Trải nghiệm mới:
1. **Actionable Deep-links theo vai trò người dùng:**
   - **`step-profile`** (25% sẵn có): Đã tích xanh, ghi chú: *"Đã xác thực định danh & thẩm quyền"*.
   - **`step-push`**: Nút *"Bật thông báo"* -> Mở `PushOnboardingSheet`.
   - **`step-action`**: Nút động tương ứng vai trò:
     - `BAN_GIAM_HIEU` / `ADMIN`: Nút *"Xem Radar điểm nghẽn"* -> Cuộn mượt đến bảng Radar cấp trường.
     - `TRUONG_PHONG` / `TRUONG_KHOA`: Nút *"Giao việc bộ môn"* -> Mở `CreateTaskModal`.
     - `CHUYEN_VIEN` / `GIANG_VIEN`: Nút *"Nộp minh chứng / Tờ trình"* -> Mở `SubmitDeliverableModal` hoặc điều hướng tới danh sách việc của tôi.
     - `VAN_THU`: Nút *"Vào sổ văn bản NĐ 30"* -> Mở phân hệ Văn thư lưu trữ.
   - **`step-search`**: Nút *"Thử bấm Cmd+K"* -> Kích hoạt mở `CommandSearchModal`.
2. **Nút Tạm hoãn 24h (Snooze Action):**
   - Bổ sung nút bấm icon đồng hồ hoặc text link *"Nhắc lại sau 24h"* bên cạnh nút Đóng.
3. **Hiệu ứng Khen thưởng Hoàn tất (Celebration Confetti):**
   - Khi `progress === 100` và người dùng vừa hoàn tất bước cuối cùng:
     - Kích hoạt animation confetti nhẹ (sử dụng lightweight canvas confetti hoặc CSS particle emitter chuẩn Light-mode).
     - Đổi tiêu đề widget thành: *"🎉 Tuyệt vời! Bạn đã làm chủ không gian làm việc QCET"*.
     - Hiển thị huy hiệu mốc: *"Cán bộ số hóa tiêu biểu"*.
     - Sau 4 giây, widget tự động chuyển thành trạng thái hoàn thành gọn gàng và không hiển thị lại trừ khi được yêu cầu từ menu.

---

### 4.4. Spotlight Tour Thân Thiện & Không Cưỡng Bức (`src/components/onboarding/spotlight-tour.tsx`)

1. **Cho phép Tạm dừng & Xem lại bất cứ lúc nào:**
   - Thay vì chỉ có nút "Đóng", bổ sung tùy chọn: *"Để sau (Tự khám phá)"* và *"Tiếp tục"*.
2. **Bảo vệ DOM Selector (Defensive Selector Engine):**
   - Đối với từng bước trong tour, nếu phần tử DOM mục tiêu không tồn tại trên màn hình (do người dùng đang ở tab khác hoặc dữ liệu chưa tải kịp):
     - Không hiển thị khung cutout bị lệch vào góc `(0,0)`.
     - Tự động chuyển tooltip về dạng **Modal trung tâm (Centered Fallback Card)** với thông điệp: *"Khu vực này sẽ hiển thị khi bạn truy cập bàn làm việc phòng ban"*.
3. **Tuân thủ chuẩn Light-Only & OKLCH:**
   - Nền cutout sử dụng lớp phủ tối mờ có độ tương phản đạt chuẩn WCAG AA: `rgba(15, 23, 42, 0.65)`.
   - Khung viền spotlight sử dụng màu nhấn thương hiệu QCET: `oklch(0.55 0.20 250)` với viền bo góc mượt mà `rounded-xl`.

---

### 4.5. Phục Hồi Quyền Thông Báo (Permission Recovery Guide) (`src/components/pwa/push-onboarding-sheet.tsx`)

Trong trường hợp người dùng trước đó đã vô tình bấm nút **"Block / Chặn"** trên hộp thoại của trình duyệt, việc gọi `Notification.requestPermission()` sẽ luôn bị trình duyệt từ chối âm thầm.

#### Đặc tả màn hình Khôi phục quyền (Permission Recovery Screen):
Khi phát hiện `Notification.permission === 'denied'`:
1. Hiển thị hình minh họa 3 bước mở lại quyền theo từng trình duyệt:
   - **Google Chrome / Cốc Cốc / Edge (Desktop):**
     *Bước 1:* Bấm vào biểu tượng ổ khóa 🔒 (hoặc cài đặt trang web) ở đầu thanh địa chỉ URL.
     *Bước 2:* Tại mục **Thông báo (Notifications)**, chuyển từ *Chặn* sang *Cho phép*.
     *Bước 3:* Tải lại trang web (`Cmd+R` hoặc `Ctrl+R`).
   - **Safari trên iOS (iPhone/iPad):**
     *Bước 1:* Vào **Cài đặt (Settings)** của máy -> Tìm ứng dụng **QCET E-Office** (hoặc Safari).
     *Bước 2:* Bật công tắc **Cho phép Thông báo (Allow Notifications)**.
2. Cung cấp nút: *"Tôi đã mở lại quyền - Kiểm tra ngay"* để re-check trạng thái.

---

## 5. Kế Hoạch Kiểm Thử & Đảm Bảo Chất Lượng (QA & Test Matrix)

| Hạng mục kiểm thử | File test tương ứng | Kịch bản chi tiết | Tiêu chí đạt |
| :--- | :--- | :--- | :--- |
| **Atomic Step Merging** | `tests/onboarding-api.test.ts` | Gửi song song 2 request PATCH với mảng completedSteps khác nhau. | Cả hai bước đều được lưu trữ đầy đủ trong DB, không bước nào bị ghi đè mất. |
| **Snooze Logic 24h** | `tests/onboarding-state.test.ts` | Gọi `snoozeOnboarding(24)`. Kiểm tra `isSnoozed()` trong 23h59m và sau 24h01m. | Trả về `true` khi còn hạn snooze, trả về `false` khi hết hạn. |
| **Widget Deep-links** | `tests/onboarding-widget.test.ts` | Click các nút hành động trong checklist cho từng vai trò (`BAN_GIAM_HIEU`, `CHUYEN_VIEN`). | Dispatch đúng custom event (`qcet:open-create-task`, `qcet:open-push-onboarding`). |
| **Celebration Trigger** | `tests/onboarding-widget.test.ts` | Cập nhật bước thứ 4/4 để đạt 100% tiến độ. | Banner chúc mừng và cờ hoàn thành được kích hoạt đúng chu kỳ. |
| **Permission Denied Guide** | `tests/push-onboarding-ui.test.ts` | Mô phỏng `Notification.permission = 'denied'`. | Hiển thị đúng tab hướng dẫn mở khóa theo trình duyệt (Chrome vs Safari iOS). |
| **A11y & Contrast (WCAG AA)** | `tests/a11y-contrast-onboarding.test.ts` | Kiểm tra toàn bộ nút bấm, badge, tooltip trong Spotlight và Widget. | Tỷ lệ tương phản ≥ 4.5:1 với văn bản thường, ≥ 3.0:1 với nút bấm đồ họa. |

---

## 6. Lộ Trình Triển Khai (Implementation Roadmap)

### Giai đoạn 1: Nâng cấp Backend & Core State (Ưu tiên cao nhất)
1. Cập nhật logic Atomic Set Union trong `src/app/api/users/onboarding/route.ts`.
2. Bổ sung helper `isSnoozed` và action `snoozeOnboarding` vào `src/hooks/use-onboarding.ts`.
3. Bổ sung test cases kiểm tra concurrency và snooze trong `tests/onboarding-api.test.ts` và `tests/onboarding-state.test.ts`.

### Giai đoạn 2: Hoàn thiện Trải nghiệm Widget & Khen thưởng (UI/UX)
1. Cập nhật `src/components/onboarding/onboarding-checklist-widget.tsx`:
   - Thêm nút *"Nhắc lại sau 24h"*.
   - Tích hợp 1-click Deep-links cho 4 vai trò.
   - Thêm Celebration Confetti / Milestone Badge khi đạt 100%.
2. Cập nhật `tests/onboarding-widget.test.ts` xác thực tương tác người dùng mới.

### Giai đoạn 3: Tối ưu Spotlight Tour & Hướng Dẫn Mở Quyền Push
1. Cập nhật `src/components/onboarding/spotlight-tour.tsx` với chế độ Centered Fallback khi target DOM chưa sẵn sàng.
2. Cập nhật `src/components/pwa/push-onboarding-sheet.tsx` bổ sung hướng dẫn chi tiết khi bị `denied`.
3. Chạy toàn bộ test suite (`npm test`) và kiểm tra kiểu dữ liệu (`npm run typecheck`).
