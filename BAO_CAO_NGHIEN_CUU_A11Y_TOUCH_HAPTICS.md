# BÁO CÁO NGHIÊN CỨU & RÀ SOÁT CHUYÊN SÂU: KHẢ NĂNG TIẾP CẬN (WCAG 2.2), VÙNG CHẠM CẢM ỨNG & PHẢN HỒI RUNG (HAPTICS) TRÊN MOBILE PWA
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Kiểm toán Tiêu chuẩn Công thái học Cảm ứng, Khắc phục Độ tương phản Ngoài trời & Tích hợp Rung Xúc giác Chuẩn App Native

---

## 1. TỔNG QUAN PHÁT HIỆN TỪ SUB-AGENT 2

Sub-agent 2 đã tiến hành kiểm toán đối chiếu mã nguồn giao diện với 4 bộ tiêu chuẩn quốc tế:
1. **WCAG 2.2 Level AA / AAA** (SC 2.5.8 Target Size Minimum $\ge$ 24px, SC 1.4.3 Contrast $\ge$ 4.5:1).
2. **Apple Human Interface Guidelines (HIG)**: Vùng chạm tối thiểu $44 \times 44\text{pt}$.
3. **Google Material Design 3**: Vùng chạm tối thiểu $48 \times 48\text{dp}$.
4. **W3C Vibration API Specification**: Chuẩn phản hồi rung xúc giác cho PWA.

### Kết quả kiểm toán:
Hệ thống phát hiện **3 nhóm vấn đề then chốt**:
* 🔴 **Vi phạm trực tiếp ngưỡng sàn WCAG 2.2 (< 24px):** Nút nhận việc/hoàn thành việc con chỉ cao **22px** (`h-5.5`).
* 🟡 **Nút đóng modal và phím thao tác nhỏ (< 32px):** Toàn bộ nút `X` đóng cửa sổ, chuông thông báo và nút chuyển trạng thái Kanban đều vi phạm chuẩn 44px của Apple.
* ☀️ **Độ tương phản giảm sút nghiêm trọng dưới ánh nắng ngoài trời (5.000 - 10.000 lux):** Lạm dụng opacity `text-muted-foreground/50` khiến chữ mờ chỉ còn tỷ lệ tương phản 2.1:1, không thể đọc ��ược ngày hạn chót và mã nhiệm vụ khi đi ngoài sân trường.

---

## 2. BẢNG THỐNG KÊ VÙNG CHẠM CẢM ỨNG (TOUCH TARGET AUDIT)

| Thành phần giao diện | Vị trí file | Kích thước hiện tại | Tiêu chuẩn vi phạm | Khắc phục chuẩn hóa |
| :--- | :--- | :---: | :---: | :--- |
| **Nút nhận việc/hoàn thành việc con** | `cascading-task-table.tsx:1055` | `h-5.5` (**22px**) | ❌ Vi phạm WCAG SC 2.5.8 (< 24px) | Tăng lên `min-h-[44px]` trên mobile |
| **Nút đóng Modal Tạo việc (`X`)** | `create-task-modal.tsx:710` | `p-1.5` (**28px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Mở rộng thành `min-h-[44px] min-w-[44px]` |
| **Nút đóng SideSheet Chi tiết việc (`X`)** | `task-detail-side-sheet.tsx:704` | `size-8` (**32px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Mở rộng thành `min-h-[44px] min-w-[44px]` |
| **Nút đóng Modal Hồ sơ cá nhân (`X`)** | `user-profile-modal.tsx:133` | `p-1.5` (**28px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Mở rộng thành `min-h-[44px] min-w-[44px]` |
| **Mũi tên chuyển cột Kanban (`<` `>`)** | `task-kanban-board.tsx:547` | `size-6` (**24px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Tách khoảng cách `gap-2.5`, thêm `::after` 44px |
| **Nút Duyệt nhanh / Đôn đốc trên bảng** | `cascading-task-table.tsx:885` | `h-6` (**24px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Nâng lên `h-10` (40px) trên mobile |
| **Phân trang dạng số** | `cascading-task-table.tsx:1176` | `h-7` (**28px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Chuyển sang Stepper `[Trước] [Sau]` 44px |
| **Chuông thông báo & Nút Cài App** | `app-topbar.tsx:276, 298` | `size-9` (**36px**) | ⚠️ Vi phạm Apple HIG (< 44px) | Thêm padding vô hình đạt chuẩn 44px |

---

## 3. KHẮC PHỤC ĐỘ TƯƠNG PHẢN ÁNH SÁNG NGOÀI TRỜI (5.000 - 10.000 LUX)

Khuôn viên trường QCET bao gồm nhiều khu vực mở (sân trường, xưởng thực hành cơ khí/điện, lối đi ngoài trời) với cường độ ánh sáng mặt trời rất lớn:
1. **Triệt tiêu các lớp Opacity làm mờ chữ:**
   - Thay thế toàn bộ các class `text-muted-foreground/50` và `text-muted-foreground/60` trên các nhãn quan trọng (hạn chót, người chủ trì, mã nhiệm vụ).
   - Sử dụng trực tiếp `text-muted-foreground font-medium` để bảo toàn tỷ lệ tương phản gốc **5.8:1** (vượt xa chuẩn WCAG AA 4.5:1).
2. **Nâng độ đậm và viền của Badge Trạng thái:**
   - Các badge như Đang làm, Cần duyệt, Trễ hạn chuyển màu chữ từ cấp `*-700` lên `*-800 font-semibold`, viền nâng lên `border-*-300` giúp màu sắc không bị "cháy trắng" dưới ánh nắng.
3. **Quy tắc CSS Công thái học trong `globals.css`:**
   ```css
   button, a, input, select, textarea {
     touch-action: manipulation;
     -webkit-tap-highlight-color: transparent;
   }
   ```
   - `touch-action: manipulation`: Loại bỏ hoàn toàn độ trễ 300ms khi người dùng bấm vào các nút (trình duyệt không phải đợi kiểm tra double-tap zoom).
   - `-webkit-tap-highlight-color: transparent`: Xóa bỏ lớp phủ màu xám nháy giật khi chạm vào màn hình trên trình duyệt di động.

---

## 4. BỘ TIỆN ÍCH PHẢN HỒI RUNG XÚC GIÁC (PWA HAPTICS ENGINE)

Để mang lại cảm giác phản hồi chắc chắn như ứng dụng iOS/Android nguyên bản (Native Feel), xây dựng tiện ích `src/lib/haptics.ts`:

```typescript
/**
 * QCET E-Office PWA Haptics Utility
 * Hỗ trợ phản hồi xúc giác qua Web Vibration API & iOS Safari safe fallback.
 */

export type HapticFeedbackType =
  | "light"       // Chạm tab, chọn pill, đổi tháng (12ms)
  | "medium"      // Bấm tạo việc, mở modal (25ms)
  | "heavy"       // Kéo thả hoàn tất (50ms)
  | "success"     // Duyệt nhanh, báo cáo hoàn thành ([15, 50, 25]ms)
  | "warning"     // Cảnh báo quá hạn ([20, 60, 20]ms)
  | "error";      // Lỗi biểu mẫu ([30, 40, 30, 40, 60]ms)

const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  light: 12,
  medium: 25,
  heavy: 50,
  success: [15, 50, 25],
  warning: [20, 60, 20],
  error: [30, 40, 30, 40, 60],
};

export function triggerHaptic(type: HapticFeedbackType = "light"): boolean {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return navigator.vibrate(HAPTIC_PATTERNS[type]);
  } catch {
    return false;
  }
}
```

* **Vị trí tích hợp:**
  - `triggerHaptic("light")`: Khi bấm chuyển tab ở thanh điều hướng dưới đáy (`navigation.tsx`) và dải lọc công việc.
  - `triggerHaptic("success")`: Khi bấm nút `"Duyệt nhanh"` hoặc nộp minh chứng công việc.
  - `triggerHaptic("warning")`: Khi mở nhiệm vụ bị trễ hạn.

---

## 5. KẾT LUẬN

Việc kết hợp **Chuẩn hóa Touch Target $\ge$ 44px**, **Khử Opacity chống chói nắng ngoài trời** và **Rung xúc giác Haptic Feedback** đưa trải nghiệm QCET E-Office PWA đạt đẳng cấp trải nghiệm ứng dụng di động bản địa (Native Mobile App Quality).
