# ĐẶC TẢ THIẾT KẾ: BỘ CHỌN THÁNG VẬN HÀNH TUẦN TỰ 1-12 (LOẠI BỎ PHÂN CHIA HỌC KỲ)
**Mã tài liệu:** SPEC-2026-09-09-FLAT-12-MONTH-SELECTOR  
**Ngày lập:** 09/09/2026  
**Trạng thái:** Chờ phê duyệt (Awaiting Review)  
**Phân hệ tác động:** `GlobalMonthSelector` (Topbar toàn cục), `TaskTableToolbar` (Thanh lọc công việc), Hệ thống Partitioning tháng  
**Tiêu chuẩn áp dụng:** Next.js 15+ App Router, Tailwind CSS v4 (Light-Only OKLCH), QCET Anti-Slop, WCAG 2.1 AA Ergonomics.

---

## I. BỐI CẢNH & MỤC TIÊU CẢI TIẾN

### 1.1. Thực trạng giao diện hiện tại
Bộ chọn tháng toàn cục `GlobalMonthSelector` (`src/components/layout/global-month-selector.tsx`) hiện đang tổ chức 12 tháng theo cấu trúc năm học học thuật chia thành 3 học kỳ:
- **Học kỳ I (4 tháng):** Tháng 9, Tháng 10, Tháng 11, Tháng 12.
- **Học kỳ II (5 tháng):** Tháng 1, Tháng 2, Tháng 3, Tháng 4, Tháng 5.
- **Học kỳ Hè (3 tháng):** Tháng 6, Tháng 7, Tháng 8.

**Nhược điểm vận hành thực tế:**
1. **Xáo trộn trực giác tìm kiếm tháng:** Thứ tự bắt đầu từ Tháng 9 rồi mới sang Tháng 1 khiến người dùng khi cần tìm các tháng đầu năm (Tháng 1, 2, 3...) phải lướt xuống tận giữa danh sách.
2. **Dung lượng hiển thị cồng kềnh:** Các tiêu đề phân nhóm ("Học kỳ I 4 tháng", "Học kỳ II 5 tháng", "Học kỳ Hè 3 tháng") chiếm dụng chiều cao popover, buộc giao diện phải dùng thanh cuộn dọc (`max-h-[60vh] overflow-y-auto`) gây khó khăn khi thao tác nhanh trên máy tính và thiết bị cảm ứng.
3. **Nhu cầu công vụ hành chính:** Các đơn vị phòng ban, tài chính, văn thư và lãnh đạo nhà trường thường quản lý kế hoạch công tác, báo cáo định kỳ theo thứ tự 12 tháng tự nhiên từ Tháng 1 đến Tháng 12.

### 1.2. Mục tiêu cải tiến (Directive)
Tuân thủ chỉ đạo của người dùng: **"cứ tháng 1-12 bỏ chia học kỳ"**:
- **Bỏ phân chia học kỳ:** Loại bỏ triệt để các khối gom nhóm "Học kỳ I", "Học kỳ II", "Học kỳ Hè" trên giao diện popover.
- **Hiển thị phẳng từ Tháng 1 đến Tháng 12:** Sắp xếp 12 tháng vận hành theo thứ tự tuyến tính chuẩn: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12`.
- **Gọn gàng, không cần thanh cuộn dài:** Toàn bộ 12 tháng được dàn trên lưới 2 cột tinh gọn, nhìn thấy toàn bộ 12 tháng ngay khi mở popover mà không cần cuộn.
- **Bảo toàn chu kỳ nghiệp vụ QCET (25 - 24):** Giữ nguyên chu kỳ ngày của từng tháng (`25/MM - 24/MM`), chấm xanh chỉ tháng hiện tại, số lượng nhiệm vụ của tháng, và các nút tắt nhanh "Tháng hiện tại", "Xem cả năm".
- **Không phá vỡ logic nền tảng:** Giữ nguyên các hàm cốt lõi trong `academic-calendar.ts` và export `SEMESTER_GROUPS` phục vụ tương thích ngược cho các kiểm thử tự động.

---

## II. SO SÁNH GIAO DIỆN TRƯỚC VÀ SAU (UI/UX WIREFRAME)

### 2.1. Hiện tại (Trước khi sửa - Chia theo Học kỳ)
```
┌────────────────────────────────────────────────────────┐
│ NĂM HỌC 2026-2027                          [Tháng 9]   │
│ Chu kỳ nghiệp vụ: ngày 25 đến 24 hàng tháng            │
├────────────────────────────┬───────────────────────────┤
│ ✨ Tháng hiện tại: T9   ✓  │ 🗂 Xem cả năm             │
├────────────────────────────┴───────────────────────────┤
│ Học kỳ I                                       4 tháng │
│ ┌──────────────────────────┬─────────────────────────┐ │
│ │ [✓] Tháng 9       (10)   │     Tháng 10       (35) │ │
│ │     25/08 - 24/09        │     25/09 - 24/10       │ │
│ │     Tháng 11        (2)  │     Tháng 12            │ │
│ │     25/10 - 24/11        │     25/11 - 24/12       │ │
│ └──────────────────────────┴─────────────────────────┘ │
│ Học kỳ II                                      5 tháng │
│ ┌──────────────────────────┬─────────────────────────┐ │
│ │     Tháng 1         (2)  │     Tháng 2         (1) │ │
│ │     25/12 - 24/01        │     25/01 - 24/02       │ │
│ │     ... (phải cuộn xem tiếp các tháng 3, 4, 5)     │ │
│ └────────────────────────────────────────────────────┘ │
│ Học kỳ Hè                                      3 tháng │
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

### 2.2. Mới (Sau khi áp dụng - Tuần tự Tháng 1 đến Tháng 12)
```
┌────────────────────────────────────────────────────────┐
│ NĂM HỌC 2026-2027                          [Tháng 9]   │
│ Chu kỳ nghiệp vụ: ngày 25 đến 24 hàng tháng            │
├────────────────────────────┬───────────────────────────┤
│ ✨ Tháng hiện tại: T9   ✓  │ 🗂 Xem cả năm             │
├────────────────────────────┴───────────────────────────┤
│ ┌──────────────────────────┬─────────────────────────┐ │
│ │ Tháng 1             (2)  │ Tháng 2             (1) │ │
│ │ 25/12 - 24/01            │ 25/01 - 24/02           │ │
│ ├──────────────────────────┼─────────────────────────┤ │
│ │ Tháng 3                  │ Tháng 4             (1) │ │
│ │ 25/02 - 24/03            │ 25/03 - 24/04           │ │
│ ├──────────────────────────┼─────────────────────────┤ │
│ │ Tháng 5             (1)  │ Tháng 6             (1) │ │
│ │ 25/04 - 24/05            │ 25/05 - 24/06           │ │
│ ├──────────────────────────┼─────────────────────────┤ │
│ │ Tháng 7                  │ Tháng 8                 │ │
│ │ 25/06 - 24/07            │ 25/07 - 24/08           │ │
│ ├──────────────────────────┼─────────────────────────┤ │
│ │ [✓] Tháng 9 •      (10)  │ Tháng 10           (35) │ │
│ │ 25/08 - 24/09            │ 25/09 - 24/10           │ │
│ ├──────────────────────────┼─────────────────────────┤ │
│ │ Tháng 11            (2)  │ Tháng 12                │ │
│ │ 25/10 - 24/11            │ 25/11 - 24/12           │ │
│ └──────────────────────────┴─────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**Ưu điểm vượt trội:**
- Người dùng tìm kiếm bất kỳ tháng nào theo phản xạ tự nhiên từ đầu đ���n cuối năm.
- Không còn phân cấp thừa thãi, giảm 3 khối tiêu đề cồng kềnh.
- Độ cao tổng thể của hộp thoại cố định vừa vặn màn hình (~440px), không bị tràn và loại bỏ cảm giác phải cuộn danh sách.

---

## III. THIẾT KẾ KỸ THUẬT CHI TIẾT (TECHNICAL SPECIFICATION)

### 3.1. Hằng số danh sách tháng vận hành tuần tự
Định nghĩa mảng thứ tự 12 tháng từ 1 đến 12:
```typescript
export const CALENDAR_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
```

Giữ nguyên hằng số `SEMESTER_GROUPS` trong `global-month-selector.tsx` để bảo đảm tính tương thích với các module phụ trợ hoặc test suite:
```typescript
export const SEMESTER_GROUPS: SemesterGroup[] = [
  { id: "hk1", name: "Học kỳ I", shortName: "HK I", months: [9, 10, 11, 12] },
  { id: "hk2", name: "Học kỳ II", shortName: "HK II", months: [1, 2, 3, 4, 5] },
  { id: "summer", name: "Học kỳ Hè", shortName: "HK Hè", months: [6, 7, 8] },
];
```

### 3.2. Cấu trúc Render trong `GlobalMonthSelector`
Thay thế đoạn mã duyệt theo nhóm học kỳ:
```tsx
{/* Danh sách 12 tháng tuần tự từ Tháng 1 đến Tháng 12 */}
<div className="pt-2">
  <div className="grid grid-cols-2 gap-1.5">
    {CALENDAR_MONTHS.map((m) => {
      const period = getAcademicMonthPeriod(m, currentAcademicYear);
      const isSelected = selectedMonth === m;
      const isActualCurrent = currentActualMonth === m;
      const count = monthlyTaskCounts[m];

      return (
        <button
          key={m}
          type="button"
          onClick={() => handleSelectMonth(m)}
          className={cn(
            "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer border min-h-[42px]",
            isSelected
              ? "bg-primary/10 text-primary border-primary/40 font-semibold shadow-2xs ring-1 ring-primary/20"
              : "bg-muted/30 hover:bg-muted/70 text-foreground border-border/40"
          )}
        >
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium leading-tight truncate">
                {period.label}
              </span>
              {isActualCurrent && (
                <span
                  title="Tháng hiện tại trên lịch thực tế"
                  className="size-1.5 rounded-full bg-emerald-500 shrink-0"
                />
              )}
            </div>
            <span className="block text-xs text-muted-foreground font-mono leading-tight mt-0.5">
              {period.shortDateSpan}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {typeof count === "number" && count > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-xs font-semibold font-mono",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
            {isSelected && (
              <Check size={13} className="text-primary shrink-0" />
            )}
          </div>
        </button>
      );
    })}
  </div>
</div>
```

### 3.3. Cập nhật đồng bộ tại `TaskTableToolbar`
Tại `src/components/tasks/table/components/task-table-toolbar.tsx` (dòng 420-440), chuyển đổi thẻ `<select>` loại bỏ `<optgroup>` và sắp xếp từ Tháng 1 đến Tháng 12:
```tsx
<select
  value={selectedAcademicMonth === "ALL" ? "ALL" : String(selectedAcademicMonth)}
  onChange={(e) => {
    const val = e.target.value;
    onAcademicMonthChange(val === "ALL" ? "ALL" : Number(val));
  }}
  aria-label="Lọc theo tháng vận hành"
  className="h-9 pl-8 pr-7 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none max-w-[195px] truncate"
>
  <option value="ALL">Cả năm học (2026 - 2027)</option>
  <option value="1">Kỳ Tháng 1/2027</option>
  <option value="2">Kỳ Tháng 2/2027</option>
  <option value="3">Kỳ Tháng 3/2027</option>
  <option value="4">Kỳ Tháng 4/2027</option>
  <option value="5">Kỳ Tháng 5/2027</option>
  <option value="6">Kỳ Tháng 6/2027</option>
  <option value="7">Kỳ Tháng 7/2027</option>
  <option value="8">Kỳ Tháng 8/2027</option>
  <option value="9">Kỳ Tháng 9/2026</option>
  <option value="10">Kỳ Tháng 10/2026</option>
  <option value="11">Kỳ Tháng 11/2026</option>
  <option value="12">Kỳ Tháng 12/2026</option>
</select>
```

---

## IV. KẾ HOẠCH KIỂM ĐỊNH CHẤT LƯỢNG (QA & TEST PLAN)

1. **Kiểm tra biên dịch & Typecheck:**
   - Chạy `npm run typecheck` xác nhận không có bất kỳ lỗi TypeScript nào.
2. **Kiểm tra Unit Test hồi quy:**
   - Chạy `npx tsx --test tests/system-wide-monthly-partitioning.test.ts` đảm bảo toàn bộ 35/35 test cases vẫn vượt qua xuất sắc.
   - Bổ sung/điều chỉnh kiểm thử kiểm tra sự xuất hiện của `CALENDAR_MONTHS` và thứ tự tuần tự 1-12 nếu cần.
3. **Quy tắc Build & Dev an toàn:**
   - Không chạy `next build` đè lên `.next` khi dev server đang phục vụ, bảo toàn 100% css/assets.

---

## V. TỔNG KẾT & DANH MỤC FILE THAY ĐỔI
| STT | Đường dẫn file | Nội dung thay đổi |
|---|---|---|
| 1 | `src/components/layout/global-month-selector.tsx` | Khai báo `CALENDAR_MONTHS`, chuyển render sang danh sách phẳng 1-12, bỏ chia nhóm học kỳ. |
| 2 | `src/components/tasks/table/components/task-table-toolbar.tsx` | Xóa bỏ `<optgroup>` học kỳ, sắp xếp dropdown từ Tháng 1 đến Tháng 12 đồng bộ. |
| 3 | `tests/system-wide-monthly-partitioning.test.ts` | Xác nhận test suite toàn hệ thống xanh 100%. |
