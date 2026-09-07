# Đặc Tả Thiết Kế Kỹ Thuật: Hệ Thống Onboarding Đa Tầng Cho Người Mới (QCET E-Office)

**Mã tài liệu:** `SPEC-2026-09-07-ONBOARDING`  
**Phiên bản:** `1.1.0 (Post-Adversarial Verification)`  
**Ngày lập:** 07/09/2026  
**Trạng thái:** Sẵn sàng triển khai (Ready for Implementation)  
**Tác giả:** Đội ngũ Kiến trúc Hệ thống QCET E-Office  
**Áp dụng:** Toàn bộ cán bộ, giảng viên, nhân viên mới tại Trường Cao đẳng Kinh tế Kỹ thuật Quảng Nam (QCET)

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ (Context & Goals)

### 1.1. Vấn đề thực tế
- Khi cán bộ, giảng viên hoặc nhân viên mới lần đầu tiếp cận hệ thống Văn phòng điện tử QCET E-Office, họ thường đối mặt với giao diện hành chính đa chiều (Nghị định 30/2020/NĐ-CP, ma trận nhiệm vụ DACUM, radar phòng ban).
- Tỷ lệ bỏ sót việc hoặc lúng túng trong tuần đầu tiên còn cao do thiếu sự dẫn dắt trực quan tại chỗ (In-App Guided Onboarding).
- Trạng thái màn hình rỗng (Zero/Empty State) khi mới tạo tài khoản chưa có việc được giao dễ gây hụt hẫng và giảm tỷ lệ kích hoạt tài khoản (Activation Rate).

### 1.2. Mục tiêu kỹ thuật & Trải nghiệm (Objectives)
1. **Time-to-Value (TTV) < 45 giây:** Người mới hiểu ngay giao diện trọng tâm của vai trò mình thông qua Welcome Modal và Spotlight Tour 3 bước ngắn gọn.
2. **Endowed Progress Checklist:** Widget khởi động tại góc màn hình áp dụng tâm lý học hành vi (tặng trước 25% tiến độ hoàn thành bước định danh vai trò), kèm chỉ dẫn trực quan *"Do This Next"* trên bước chưa làm đầu tiên, giúp tỷ lệ hoàn thành checklist đạt > 85%.
3. **Responsive & PWA Adaptive:** Tự động thích ứng: Desktop dùng SVG Spotlight Mask đục lỗ, Mobile (PWA) dùng Bottom Sheet vuốt chạm theo ngón tay cái (có thuật toán chống đè lấp mục tiêu).
4. **Zero Dependency Core:** Không cài thêm thư viện ngoài nặng nề (Driver.js, Joyride), 100% viết bằng React 19 + Tailwind CSS v4, đảm bảo tuyệt đối an toàn SSR Hydration trong Next.js 15 App Router (`useSyncExternalStore` / `mounted` guard).
5. **Event-Driven Auto-Completion:** Tự động bắt sự kiện hoàn thành các bước nghiệp vụ thật (bật Web Push qua nút bấm tường minh, nộp minh chứng, dùng `Cmd+K`) mà không bắt người dùng đánh dấu thủ công.

---

## 2. Phân Tầng Vai Trò & Ma Trận Lộ Trình (Role-Tailored Journeys)

Hệ thống tự động đồng bộ hóa vai trò giữa Prisma DB (`UserRole`) và AuthContext (`RoleHierarchy`):
- **Nhóm Lãnh đạo (`ADMIN` / `BAN_GIAM_HIEU`):** Cockpit chỉ đạo toàn trường, Radar sức khỏe đơn vị, Giải quyết điểm nghẽn.
- **Nhóm Quản lý (`MANAGER` / `TRUONG_PHONG`):** Bàn làm việc đơn vị, Phân công nhiệm vụ, Phê duyệt minh chứng.
- **Nhóm Thực thi (`STAFF` / `CHUYEN_VIEN`):** Bàn làm việc cá nhân, Nộp minh chứng (Deliverable), Nhận việc khẩn.
- **Nhóm Văn thư (`VAN_THU`):** Sổ văn bản đến/đi theo Nghị định 30/2020/NĐ-CP, Cấp số văn bản tự động, Luân chuyển văn bản.

```
                  ┌─────────────────────────────────┐
                  │ Đăng nhập lần đầu (First Login)  │
                  └────────────────┬────────────────┘
                                   │
                     ┌─────────────▼─────────────┐
                     │   Welcome Modal & Profile │
                     │  "Khám phá trong 45 giây"  │
                     └─────────────┬─────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼──────┐             ┌──────▼──────┐             ┌──────▼──────┐
│  BGH (ADMIN)│             │TRƯỞNG PHÒNG │             │CHUYÊN VIÊN /│
│  Cockpit &  │             │Phân công &  │             │ GIẢNG VIÊN  │
│  Radar đơn vị             │Duyệt việc   │             │Nhận việc &  │
└──────┬──────┘             └──────┬──────┘             │Nộp chứng cứ │
       │                           │                    └──────┬──────┘
       └───────────────────────────┼───────────────────────────┘
                                   │
                     ┌─────────────▼─────────────┐
                     │ Onboarding Checklist Hub  │
                     │  Dockable Pill ở góc phải │
                     └───────────────────────────┘
```

### 2.1. Chi tiết 3 bước Spotlight Tour theo từng vai trò (có Safe Fallback khi rỗng việc)

| Bước | 👔 Ban Giám hiệu (`BAN_GIAM_HIEU`) | 🏢 Trưởng đơn vị (`TRUONG_PHONG`) | 👤 Chuyên viên / Giảng viên (`CHUYEN_VIEN`) | 📑 Văn thư (`VAN_THU`) |
| :--- | :--- | :--- | :--- | :--- |
| **Bước 1** | **Scope Switcher:** Chuyển đổi giữa Toàn trường và Đơn vị trực thuộc được phân công. | **Phạm vi đơn vị:** Theo dõi toàn bộ khối lượng công việc trực thuộc Khoa/Phòng. | **Bàn làm việc trọng tâm:** Nơi hiển thị các nhiệm vụ được giao đích danh cần xử lý. | **Sổ đăng ký văn bản:** Sổ văn bản đến và đi theo Nghị định 30/2020/NĐ-CP. |
| **Bước 2** | **Radar & Điểm nghẽn:** Nhận diện ngay các đơn vị có tỷ lệ quá hạn cao để ban hành Nghị quyết. | **Phân công & Duyệt việc:** Nút giao việc nhanh cho nhân sự và phê duyệt minh chứng nộp. | **Nộp minh chứng (Deliverable):** Thẻ nhiệm vụ thật (hoặc nút *"Soạn Tờ trình nội bộ"* trên Actionable Empty State nếu chưa có việc). | **Cấp số văn bản tự động:** Đánh số văn bản tự động theo quy chuẩn của Nhà trường. |
| **Bước 3** | **Tìm kiếm toàn năng (`Cmd + K`):** Tra cứu thần tốc bất kỳ văn bản, tờ trình hay nhân sự nào. | **Tìm kiếm & Báo cáo (`Cmd + K`):** Lọc nhanh tiến độ tuần và xuất báo cáo công việc. | **Kênh nhận việc tức thời:** Bật thông báo Web Push để nhận chỉ đạo khẩn ngay tức thì. | **Luân chuyển & Phân phối:** Chuyển giao văn bản đến đúng phòng ban xử lý. |

---

## 3. Kiến Trúc Kỹ Thuật & Luồng Dữ Liệu (Technical Architecture)

### 3.1. Cấu trúc Thư mục & File đề xuất
```
src/
├── app/
│   └── api/
│       └── users/
│           └── onboarding/
│               └── route.ts                  # PATCH API cập nhật trạng thái onboarding có Zod validation
├── components/
│   └── onboarding/
│       ├── onboarding-provider.tsx          # Context & State Machine quản lý toàn cục (Next.js 15 Client Safe)
│       ├── welcome-modal.tsx                 # Màn hình chào mừng cá nhân hóa
│       ├── spotlight-tour.tsx                # Lớp phủ SVG Mask Spotlight + FocusTrap + Popover tooltip
│       ├── onboarding-checklist-widget.tsx   # Widget góc dưới phải (Mini pill & Expanded card)
│       ├── actionable-empty-state.tsx        # Zero state sinh động cho Bàn làm việc (Không dead-pixel)
│       └── celebration-confetti.tsx          # Canvas confetti vi tương tác khi đạt 100%
├── hooks/
│   └── use-onboarding.ts                     # Hook truy xuất trạng thái và kích hoạt hành động
└── lib/
    └── onboarding-constants.ts               # Định nghĩa các bước tour và checklist theo vai trò
```

### 3.2. Cập nhật Cơ sở dữ liệu (Prisma Schema)
Bổ sung các trường lưu trữ trong bảng `users`:
```prisma
model User {
  // ... các trường hiện tại
  onboardedAt         DateTime?  @map("onboarded_at")
  onboardingData      Json?      @map("onboarding_data") // { hasSeenTour: boolean, completedSteps: string[], isDismissed: boolean, snoozedUntil: string? }
}
```

### 3.3. Thuật toán SVG Mask Spotlight & Tránh Xung Đột DOM
1. **Lớp phủ SVG Mask:**
   - Dùng `<svg className="fixed inset-0 z-50 pointer-events-none" aria-hidden="true">`.
   - `<mask id="qcet-spotlight-mask">`: `<rect fill="white">` cho toàn màn hình, và `<rect fill="black" rx="8">` cắt lỗ quanh `targetRect`.
   - Lớp mờ nền `fill="rgba(0,0,0,0.65)"` được áp dụng mask.
   - **Click-through & Hit Testing:** Vùng đục lỗ cho phép người dùng click xuyên qua (pointer-events) hoặc tương tác trực tiếp.
2. **Khả năng quan sát bố cục động (ResizeObserver & MutationObserver):**
   - Hỗ trợ hàm `waitForElement(selector, timeout = 3000)` để xử lý các component nạp lười (`dynamic()`).
   - Tự động cập nhật toạ độ `targetRect` khi màn hình resize, zoom hoặc cuộn trang (`scroll` listener gắn cờ passive, điều phối bằng `requestAnimationFrame`).
3. **Định vị Tooltip & Thuật toán chống đè lấp Mobile (Bottom Sheet Collision Handling):**
   - Desktop: Tự động đo đạc khoảng trống 4 hướng qua `getBoundingClientRect()`, chọn hướng tối ưu và kẹp vị trí `Math.max(12, Math.min(left, vw - tooltipWidth - 12))` chống tràn màn hình.
   - Mobile (`< 768px`):
     - Nếu mục tiêu nằm ở nửa trên màn hình (`targetRect.top < vh / 2`): Hiển thị Bottom Sheet ở đáy màn hình.
     - Nếu mục tiêu nằm ở nửa dưới màn hình (`targetRect.top >= vh / 2`): Tự động cuộn phần tử lên giữa màn hình (`scrollIntoView({ block: 'center' })`) trước khi hiển thị, đảm bảo không bao giờ che khuất mục tiêu.

---

## 4. Chuẩn Tiếp Cận WCAG 2.1 Level AA & Khả Năng Thao Tác Bàn Phím

1. **Bẫy tiêu điểm & Ngữ nghĩa (FocusTrap & ARIA):**
   - Cửa sổ Tooltip / Modal có thuộc tính `role="dialog"`, `aria-modal="true"`, `aria-labelledby="tour-title"`, `aria-describedby="tour-desc"`.
   - Toàn bộ SVG Mask nền được đánh dấu `aria-hidden="true"`.
   - Phím tắt bàn phím: `Escape` để đóng tour hoặc tạm hoãn; phím `Tab` luân chuyển vòng tròn bên trong hộp thoại; `Enter` hoặc `Space` để kích hoạt nút bấm tiếp tục.
   - Khi đóng tour: Tiêu điểm bàn phím tự động trả về phần tử kích hoạt trước đó (trigger element).
2. **Cập nhật tiến độ tiếp cận (Live Region):**
   - Widget checklist góc dưới phải khi cập nhật tiến độ (25% -> 50% -> 100%) có thẻ ẩn `aria-live="polite"` thông báo tiến độ cho phần mềm đọc màn hình (Screen Reader).
3. **Chế độ Giảm chuyển động (Prefers-Reduced-Motion):**
   - Khi phát hiện `window.matchMedia('(prefers-reduced-motion: reduce)')`: Tắt toàn bộ hiệu ứng chuyển dịch bounding box và hiệu ứng Canvas Confetti.

---

## 5. Cơ Chế Bắt Sự Kiện Tự Động & Xử Lý Quyền Trình Duyệt

| Bước trong Checklist | Điều kiện hoàn thành tự động | Hành động kích hoạt & Xử lý đặc thù |
| :--- | :--- | :--- |
| **1. Định danh vai trò** | Tự động hoàn thành ngay khi User đăng nhập hợp lệ (Tặng trước 25%). | Đăng nhập hệ thống thành công (Endowed Progress). |
| **2. Bật nhận thông báo** | Trạng thái Push Permission chuyển sang `'granted'` và có subscription hợp lệ. | Bắt buộc thông qua hành động **người dùng bấm nút trực tiếp** `[Bật thông báo ngay]`. Nếu thiết bị không hỗ trợ (ví dụ Safari thường chưa cài PWA), hệ thống đánh dấu qua bước an toàn (Graceful bypass). |
| **3. Thao tác nghiệp vụ đầu tiên** | - Chuyên viên: Mở modal nộp minh chứng hoặc bấm nút *"Soạn Tờ trình nội bộ"* trên Empty State.<br>- Trưởng phòng: Mở modal giao việc hoặc duyệt 1 deliverable.<br>- BGH: Mở Drawer Nghị quyết điều hành hoặc xem Radar.<br>- Văn thư: Mở Sổ văn bản đến NĐ 30. | Thao tác trên giao diện nghiệp vụ thật. |
| **4. Kỹ năng tìm kiếm nhanh** | Bấm tổ hợp phím `Cmd + K` / `Ctrl + K` hoặc bấm vào thanh tìm kiếm Topbar. | Thao tác phím tắt hoặc thanh tìm kiếm. |

---

## 6. Micro-Interactions & Trải Nghiệm Hoàn Thành (Delight & Completion)

1. **Hiển thị "Do This Next":**
   - Trên danh sách Checklist, nhiệm vụ chưa hoàn thành đầu tiên sẽ có hiệu ứng viền phát sáng nhẹ (Subtle Glow Ring) kèm nhãn nhỏ `👉 Cần làm tiếp theo`, giảm tối đa chi phí suy nghĩ cho người dùng.
2. **Hiệu ứng chúc mừng (Celebration Confetti):**
   - Khi bước thứ 4 được hoàn thành (Tiến độ chạm 100%):
   - Kích hoạt chùm pháo hoa giấy Canvas Confetti nhẹ nhàng trong 1.5 giây (hỗ trợ `prefers-reduced-motion`).
   - Hiển thị huy hiệu: *"Xuất sắc! Thầy/Cô đã sẵn sàng 100% làm việc cùng QCET E-Office."*
3. **Thu gọn tự động & Đồng bộ đa tab (Multi-tab Sync):**
   - Sau 3 giây kể từ khi chúc mừng, widget tự động chuyển về dạng biểu tượng thu nhỏ kín đáo ở góc phải.
   - Đồng bộ trạng thái đóng/thu nhỏ giữa các tab đang mở thông qua sự kiện `storage` / `BroadcastChannel`.
4. **Trung tâm Hỗ trợ & Khởi động lại (Re-onboard Capability):**
   - Bổ sung mục *"Hướng dẫn làm quen (Onboarding)"* trong menu hồ sơ cá nhân của Topbar, cho phép bất kỳ cán bộ nào mở lại Tour hoặc Checklist khi cần.

---

## 7. Kế Hoạch Kiểm Thử (Testing & Quality Assurance)

1. **Unit & State Tests (`tests/onboarding-state.test.ts`):**
   - Kiểm tra tính toán % tiến độ chính xác theo vai trò (25% -> 50% -> 75% -> 100%).
   - Kiểm tra lưu trữ kép: Cập nhật đồng thời `localStorage` và gọi API đồng bộ `/api/users/onboarding`.
2. **UI & Accessibility Tests (`tests/onboarding-ui-ux.test.ts`):**
   - Bấm `Escape` đóng tour mượt mà, không bị kẹt phím (No keyboard trap).
   - Kiểm tra chuyển bước bằng bàn phím (`Tab`, `Enter`).
   - Kiểm tra tính toán tọa độ SVG Mask khi resize trình duyệt hoặc cuộn trang.
3. **Role & Fallback Tests:**
   - Kiểm tra tài khoản Chuyên viên mới (0 nhiệm vụ) -> Tour neo chính xác vào Actionable Empty State.
   - Kiểm tra tài khoản Ban Giám hiệu -> Tour neo chính xác vào Scope Switcher và Radar Đơn vị.
