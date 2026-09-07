# Đặc Tả Thiết Kế Kỹ Thuật: Hệ Thống Onboarding Đa Tầng Cho Người Mới (QCET E-Office)

**Mã tài liệu:** `SPEC-2026-09-07-ONBOARDING`  
**Ngày lập:** 07/09/2026  
**Trạng thái:** Chờ phê duyệt (Pending Review)  
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
2. **Endowed Progress Checklist:** Widget khởi động tại góc màn hình áp dụng tâm lý học hành vi (tặng trước 25% tiến độ hoàn thành bước định danh vai trò), giúp tỷ lệ hoàn thành checklist đạt > 85%.
3. **Responsive & PWA Adaptive:** Tự động thích ứng: Desktop dùng SVG Spotlight Mask đục lỗ, Mobile (PWA) dùng Bottom Sheet vuốt chạm theo ngón tay cái.
4. **Zero Dependency Core:** Không cài thêm thư viện ngoài nặng nề (Driver.js, Joyride), 100% viết bằng React 19 + Tailwind CSS v4, không lỗi SSR Hydration trong Next.js 15 App Router.
5. **Event-Driven Auto-Completion:** Tự động bắt sự kiện hoàn thành các bước nghiệp vụ thật (bật Web Push, nộp minh chứng, dùng `Cmd+K`) mà không bắt người dùng đánh dấu thủ công.

---

## 2. Phân Tầng Vai Trò & Ma Trận Nội Dung (Role-Tailored Journeys)

Hệ thống tự động nhận diện `user.role` từ `AuthContext` và áp dụng lộ trình chuyên biệt:

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

### 2.1. Chi tiết 3 bước Spotlight Tour theo từng vai trò

| Bước | 👔 Ban Giám hiệu (`BAN_GIAM_HIEU`) | 🏢 Trưởng đơn vị (`TRUONG_PHONG`) | 👤 Chuyên viên / Giảng viên (`CHUYEN_VIEN`) | 📑 Văn thư (`VAN_THU`) |
| :--- | :--- | :--- | :--- | :--- |
| **Bước 1** | **Scope Switcher:** Chuyển đổi giữa Toàn trường và Đơn vị trực thuộc được phân công. | **Phạm vi đơn vị:** Theo dõi toàn bộ khối lượng công việc trực thuộc Khoa/Phòng. | **Bàn làm việc trọng tâm:** Nơi hiển thị các nhiệm vụ được giao đích danh cần xử lý. | **Sổ đăng ký văn bản:** Sổ văn bản đến và đi theo Nghị định 30/2020/NĐ-CP. |
| **Bước 2** | **Radar & Điểm nghẽn:** Nhận diện ngay các đơn vị có tỷ lệ quá hạn cao để ban hành Nghị quyết. | **Phân công & Duyệt việc:** Nút giao việc nhanh cho nhân sự và phê duyệt minh chứng nộp. | **Nộp minh chứng (Deliverable):** Đính kèm tài liệu/báo cáo công việc để cấp trên duyệt. | **Cấp số văn bản tự động:** Đánh số văn bản tự động theo quy chuẩn của Nhà trường. |
| **Bước 3** | **Tìm kiếm toàn năng (`Cmd + K`):** Tra cứu thần tốc bất kỳ văn bản, tờ trình hay nhân sự nào. | **Tìm kiếm & Báo cáo (`Cmd + K`):** Lọc nhanh tiến độ tuần và xuất báo cáo công việc. | **Kênh nhận việc tức thời:** Bật thông báo Web Push để nhận chỉ đạo khẩn ngay tức thì. | **Luân chuyển & Phân phối:** Chuyển giao văn bản đến đúng phòng ban xử lý. |

---

## 3. Kiến Trúc Kỹ Thuật & Luồng Dữ Liệu (Technical Architecture)

### 3.1. Cấu trúc Thư mục & File đề xuất
```
src/
├── components/
│   └── onboarding/
│       ├── onboarding-provider.tsx          # Context & State Machine quản lý toàn cục
│       ├── welcome-modal.tsx                 # Màn hình chào mừng cá nhân hóa
│       ├── spotlight-tour.tsx                # Lớp phủ SVG Mask Spotlight + Popover tooltip
│       ├── onboarding-checklist-widget.tsx   # Widget góc dưới phải (Mini pill & Expanded card)
│       ├── actionable-empty-state.tsx        # Zero state sinh động cho Bàn làm việc
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
  onboardingData      Json?      @map("onboarding_data") // { hasSeenTour: boolean, completedSteps: string[], isDismissed: boolean }
}
```

### 3.3. Thuật toán SVG Mask Spotlight (Zero Stacking Issues)
Sử dụng phần tử SVG toàn màn hình kết hợp thẻ `<mask id="qcet-spotlight-mask">`:
1. Hình chữ nhật màu trắng bao phủ 100% viewport (`fill="white"`).
2. Hình chữ nhật màu đen bao quanh toạ độ `targetRect` với padding 8px và bo góc `rx="8"` (`fill="black"`).
3. Lớp phủ mờ `rgba(0,0,0,0.65)` áp dụng mask này, tạo hiệu ứng đục lỗ hoàn hảo trên mọi layout (không bị lỗi bởi `overflow:hidden` hay CSS Stacking context).

### 3.4. Định vị Tooltip thông minh & Fallback Mobile
- Desktop: Tự động đo đạc khoảng trống 4 hướng qua `getBoundingClientRect()`, chọn hướng tối ưu và kẹp vị trí `Math.max(12, Math.min(left, vw - tooltipWidth - 12))` chống tràn màn hình.
- Mobile (`< 768px`): Tự động chuyển thành **Bottom Sheet** cố định đáy màn hình, phù hợp thao tác ngón tay cái.

---

## 4. Cơ Chế Bắt Sự Kiện Tự Động (Event-Driven Auto-Completion)

| Bước trong Checklist | Điều kiện hoàn thành tự động | Hành động kích hoạt tương ứng |
| :--- | :--- | :--- |
| **1. Định danh vai trò** | Tự động hoàn thành ngay khi User đăng nhập hợp lệ (Tặng trước 25%). | Đăng nhập hệ thống thành công. |
| **2. Bật nhận thông báo** | Trạng thái Push Permission chuyển sang `'granted'` và có subscription hợp lệ. | Bấm nút *"Bật thông báo"* trong widget hoặc Topbar. |
| **3. Thao tác nghiệp vụ đầu tiên** | - Chuyên viên: Mở modal nộp minh chứng hoặc nộp 1 file.<br>- Trưởng phòng: Mở modal giao việc hoặc duyệt 1 deliverable.<br>- BGH: Mở Drawer Nghị quyết điều hành hoặc xem Radar.<br>- Văn thư: Mở Sổ văn bản đến NĐ 30. | Thao tác trên giao diện nghiệp vụ thật. |
| **4. Kỹ năng tìm kiếm nhanh** | Bấm tổ hợp phím `Cmd + K` / `Ctrl + K` hoặc bấm vào thanh tìm kiếm Topbar. | Thao tác phím tắt hoặc thanh tìm kiếm. |

---

## 5. Micro-Interactions & Trải Nghiệm Hoàn Thành (Delight & Completion)

1. **Hiệu ứng chúc mừng (Celebration Confetti):**
   - Khi bước thứ 4 được hoàn thành (Tiến độ chạm 100%):
   - Kích hoạt chùm pháo hoa giấy Canvas Confetti nhẹ nhàng trong 1.5 giây (hỗ trợ `prefers-reduced-motion` theo chuẩn WCAG 2.1 AA).
   - Hiển thị huy hiệu: *"Xuất sắc! Thầy/Cô đã sẵn sàng 100% làm việc cùng QCET E-Office."*
2. **Thu gọn tự động (Auto-Minimization):**
   - Sau 3 giây kể từ khi chúc mừng, widget tự động chuyển về dạng biểu tượng thu nhỏ kín đáo ở góc phải.
   - Người dùng có thể bấm vào để xem lại bất cứ lúc nào, hoặc ẩn vĩnh viễn.
3. **Trung tâm Hỗ trợ & Khởi động lại (Re-onboard Capability):**
   - Bổ sung mục *"Hướng dẫn làm quen (Onboarding)"* trong menu hồ sơ cá nhân của Topbar, cho phép bất kỳ cán bộ nào mở lại Tour hoặc Checklist khi cần.

---

## 6. Kế Hoạch Kiểm Thử (Testing & Quality Assurance)

1. **Unit & State Tests:**
   - Kiểm tra `useOnboarding`: Tính toán % tiến độ chính xác theo vai trò.
   - Kiểm tra lưu trữ kép: Cập nhật đồng thời `localStorage` và gọi API đồng bộ.
2. **UI & Accessibility Tests:**
   - Bấm `Escape` đóng tour mượt mà, không bị kẹt phím (No keyboard trap).
   - Điều hướng bàn phím (`Tab`, `Enter`, `ArrowRight`, `ArrowLeft`).
   - Kiểm tra tính toán tọa độ SVG Mask khi resize trình duyệt hoặc cuộn trang.
3. **End-to-End Walkthrough:**
   - Thử nghiệm tài khoản Ban Giám hiệu, Trưởng khoa và Chuyên viên.
   - Kiểm tra hiển thị trên thiết bị di động (Mobile PWA viewport 375px).
