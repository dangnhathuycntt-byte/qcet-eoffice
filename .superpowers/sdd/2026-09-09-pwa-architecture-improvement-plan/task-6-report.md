# Báo Cáo Kỹ Thuật Task 6: PWA Onboarding Coordinator & Install UX Orchestration

- **Mã công việc:** Task 6 (Kế hoạch Cải tiến Kiến trúc PWA QCET E-Office)
- **Người thực hiện:** Antigravity / Claude Subagent
- **Trạng thái:** HOÀN THÀNH XUẤT SẮC (DONE)
- **Thời gian thực hiện:** 2026-09-09
- **Tệp kiểm thử:** `tests/pwa/onboarding-coordinator.test.ts`

---

## 1. Tóm Tắt Thực Hiện

Task 6 giải quyết dứt điểm vấn đề "bắn tỉa hộp thoại / modal spam" khi người dùng vừa đăng nhập vào hệ thống: loại bỏ hoàn toàn việc hiển thị đồng thời hoặc hiển thị ngay lúc tải trang đầu tiên (cold load) của các thành phần như Welcome Modal, Spotlight Tour, PWA Install Banner, và Push Notification Request.

Theo các chuẩn mực giao tiếp người dùng Web Permission Best Practices và bộ quy chuẩn Anti-Slop QCET:
1. **Thiết lập Máy Trạng Thái Điều Phối (State Machine):**
   `NEW_USER -> WELCOME_DONE -> ENGAGED -> INSTALL_ELIGIBLE -> INSTALLED -> PUSH_ELIGIBLE`.
2. **Không làm phiền khi tải trang lạnh (Cold Load Invariant):**
   Người dùng mới hoặc phiên tải mới tuyệt đối không bị hiện banner Cài đặt hay Xin quyền thông báo đẩy.
3. **Thu nạp và Trì hoãn sự kiện `beforeinstallprompt` (Chromium):**
   Lắng nghe và lưu trữ sự kiện `beforeinstallprompt`, chuyển sang chế độ sẵn sàng cài đặt nhưng chỉ kích hoạt hộp thoại cài đặt khi người dùng chủ động nhấn hoặc ở trạng thái `INSTALL_ELIGIBLE`.
4. **Phát hiện nền tảng thông minh (iOS Safari & Desktop Standalone):**
   Nhận diện chính xác trình duyệt iOS Safari (bao gồm iPadOS 13+ với multi-touch) và trạng thái standalone (`display-mode: standalone` hoặc `navigator.standalone`). Nếu chưa cài đặt trên iOS, cung cấp hướng dẫn từng bước rõ ràng ("Nhấn biểu tượng Chia sẻ -> Chọn Thêm vào Màn hình chính").
5. **Giao diện chuẩn hành chính QCET (Light-only Institutional UI):**
   Không dark mode (`0 dark:` classes), 0% emoji, nút bấm đạt chuẩn công thái học di động tối thiểu 44px, thông điệp giá trị thực tế và chỉn chu.
6. **Cô lập dữ liệu người dùng (User Isolation & Snooze):**
   Khóa lưu trữ theo `userId`, hỗ trợ tạm ẩn (snooze) có thời hạn cho cả cài đặt và thông báo đẩy.

---

## 2. Chi Tiết Thay Đổi & Triển Khai

### 2.1. Bộ Điều Phối Hành Trình `src/lib/pwa/onboarding-coordinator.ts`
- Định nghĩa các trạng thái hành trình `JourneyStage` (`NEW_USER`, `WELCOME_DONE`, `ENGAGED`, `INSTALL_ELIGIBLE`, `INSTALLED`, `PUSH_ELIGIBLE`).
- Quản lý tín hiệu tương tác `EngagementSignals` (`actionCount`, `pageViews`, `stepsCompleted`, `sessionDurationMs`, `lastActiveAt`).
- Cung cấp lớp đối tượng `PWAOnboardingCoordinator` và hook React `usePWAOnboardingCoordinator()`.
- Xử lý lưu trữ cách ly theo người dùng qua hàm `getCoordinatorStorageKey(userId)`.
- Xử lý phát hiện môi trường:
  - `checkIsIOS(userAgent, maxTouchPoints)`: Phát hiện iPhone/iPad và MacIntel có touch points > 1.
  - `checkIsStandalone()`: Kiểm tra `display-mode: standalone` hoặc `navigator.standalone`.
  - `checkIsIOSSafari(userAgent, maxTouchPoints)`: Xác định khi người dùng duyệt web bằng Safari trên iOS chưa cài PWA.
- Phương thức `handleBeforeInstallPrompt` ngăn chặn hành vi mặc định của trình duyệt (`event.preventDefault()`) và giữ tham chiếu `deferredPrompt`.
- Phương thức `promptInstall()` gọi `prompt()` an toàn và cập nhật trạng thái sang `INSTALLED` -> `PUSH_ELIGIBLE` khi người dùng chấp thuận.
- Phương thức `snoozeInstall(days)` và `snoozePush(days)` thiết lập thời gian hoãn nhắc nhở (mặc định 7 ngày).

### 2.2. Giao Diện Biểu Ngữ Cài Đặt `src/components/pwa/pwa-install-prompt.tsx`
- Tích hợp chặt chẽ với `usePWAOnboardingCoordinator()`.
- Chỉ xuất hiện khi `canShowInstallPrompt` là `true` (người dùng đã đạt trạng thái tương tác và thiết bị hỗ trợ).
- Thông điệp giá trị hành chính:
  > "Cài đặt QCET E-Office trên thiết bị để truy cập nhanh, nhận thông báo công việc tức thì và làm việc ngay cả khi mất mạng."
- Tương tác thích ứng:
  - Trên Chromium/Android: Nút `[Cài đặt ngay]` gọi trực tiếp `promptInstall()`.
  - Trên iOS Safari: Mở modal hướng dẫn chi tiết các bước thêm vào màn hình chính.
  - Nút `[Để sau]` gọi `snoozeInstall(7)`.
- Tiêu chuẩn thiết kế:
  - 100% Light-only (Slate-900, Slate-600, Blue-50, Blue-800, Emerald-50).
  - 0% emoji slop (sử dụng icon SVG từ `lucide-react`: `Download`, `Smartphone`, `X`, `CheckCircle2`).
  - Đảm bảo touch target tối thiểu 44px (`min-h-[44px]`).

### 2.3. Tích Hợp Vào Khung Ứng Dụng `src/components/layout/app-shell.tsx`
- Kết nối `OnboardingHub` với `pwaOnboardingCoordinator`:
  - Hoàn tất Welcome Modal gọi `pwaOnboardingCoordinator.completeWelcome()`.
  - Thao tác trên tour hoặc checklist gọi `pwaOnboardingCoordinator.recordAction(...)`.
- `PWAInstallPrompt` được đặt vào `AppShellInner` dưới dạng Client Component (dynamically imported with `ssr: false`).

---

## 3. Kết Quả Kiểm Thử (100% Passed)

### 3.1. Đơn vị kiểm thử `tests/pwa/onboarding-coordinator.test.ts`
Chạy lệnh: `npx tsx --test tests/pwa/onboarding-coordinator.test.ts`
- **1. State Machine Transitions**:
  - `initializes cold load as NEW_USER with zero prompts allowed` (PASSED)
  - `transitions NEW_USER -> WELCOME_DONE when welcome is completed` (PASSED)
  - `transitions WELCOME_DONE -> ENGAGED after user completes actions or visits pages` (PASSED)
  - `transitions ENGAGED -> INSTALL_ELIGIBLE when platform is installable` (PASSED)
  - `transitions INSTALL_ELIGIBLE -> INSTALLED -> PUSH_ELIGIBLE upon app installation` (PASSED)
- **2. Deferred Prompt Capture and Invocation**:
  - `holds deferred prompt and triggers it upon promptInstall call` (PASSED)
  - `handles user dismissal cleanly without breaking state` (PASSED)
- **3. Platform Detection: iOS vs Standalone**:
  - `detects iOS browser and provides step-by-step guidance` (PASSED)
  - `detects iOS standalone mode as already INSTALLED` (PASSED)
- **4. User Isolation & Snooze Logic**:
  - `isolates onboarding state between different users` (PASSED)
  - `snoozes install prompt for specified days` (PASSED)
  - `snoozes push prompt for specified days` (PASSED)
- **5. Anti-Slop, Institutional QCET UI & Touch Target Invariants**:
  - `coordinator file contains 0% emojis` (PASSED)
  - `pwa-install-prompt.tsx contains 0% emojis and 0 dark theme classes` (PASSED)
  - `pwa-install-prompt.tsx enforces institutional QCET styling and >=44px touch targets` (PASSED)

**Tổng số test:** 15/15 tests đạt (0 fail, 0 skip).

### 3.2. Toàn Bộ Bộ Kiểm Thử PWA (`tests/pwa/*.test.ts`)
Chạy lệnh: `npx tsx --test tests/pwa/*.test.ts`
- **100 tests** thuộc 43 suites thành công 100% (0 lỗi, 0 gián đoạn).

### 3.3. Kiểm Tra Kiểu TypeScript Toàn Dự Án
Chạy lệnh: `npm run typecheck`
- **Kết quả:** `tsc --noEmit` hoàn thành sạch sẽ, không có bất kỳ lỗi kiểu dữ liệu nào.

---

## 4. Danh Sách Tệp Thay Đổi & Tạo Mới

1. `src/lib/pwa/onboarding-coordinator.ts` (Tạo mới: Bộ điều phối máy trạng thái onboarding và PWA)
2. `src/components/pwa/pwa-install-prompt.tsx` (Tạo mới: Banner cài đặt PWA chuẩn QCET)
3. `tests/pwa/onboarding-coordinator.test.ts` (Tạo mới: 15 kịch bản kiểm thử toàn diện)
4. `src/components/layout/app-shell.tsx` (Tích hợp: Kết nối OnboardingHub và PWAInstallPrompt)
5. `src/hooks/use-pwa-install.ts` (Cập nhật: Đồng bộ với onboarding coordinator)
