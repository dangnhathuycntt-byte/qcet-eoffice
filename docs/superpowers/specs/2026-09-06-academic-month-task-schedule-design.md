# QCET Academic Month Cycle & Task Schedule Specification

## 1. Problem Statement & Operational Rules
Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET) áp dụng quy định chu kỳ công tác và năm học đặc thù:
- **Chu kỳ 1 tháng công tác**: Bắt đầu vào **ngày 25 của tháng trước** và kết thúc vào **ngày 24 của tháng danh nghĩa**.
  - Ví dụ:
    - **Tháng 9**: từ `25/08` đến `24/09`
    - **Tháng 10**: từ `25/09` đến `24/10`
    - **Tháng 11**: từ `25/10` đến `24/11`
    - **Tháng 12**: từ `25/11` đến `24/12`
    - **Tháng 1**: từ `25/12` đến `24/01` (năm kế tiếp)
    - **Tháng 2**: từ `25/01` đến `24/02`
    - **Tháng 3**: từ `25/02` đến `24/03`
    - **Tháng 4**: từ `25/03` đến `24/04`
    - **Tháng 5**: từ `25/04` đến `24/05`
    - **Tháng 6**: từ `25/05` đến `24/06`
    - **Tháng 7**: từ `25/06` đến `24/07`
    - **Tháng 8**: từ `25/07` đến `24/08`
- **Chu kỳ Năm học / Năm công tác**: "Hết tháng 8 là hết một năm".
  - Một năm học bắt đầu vào **ngày 25/08 (khởi đầu Tháng 9)** và kết thúc vào **ngày 24/08 năm sau (kết thúc Tháng 8)**.
  - Ví dụ: Năm học `2026 - 2027` kéo dài từ `25/08/2026` đến `24/08/2027`.

## 2. Core Architecture & Interfaces

### 2.1 Module `src/lib/academic-calendar.ts`
Cung cấp các hàm toán học thuần túy (pure functions, zero-dependency) để chuyển đổi thời gian:
- `getAcademicMonthInfo(dateInput: string | Date): AcademicMonthPeriod`
- `getAcademicYear(dateInput: string | Date): string` ("2026-2027")
- `getAcademicMonthsForYear(academicYear: string): AcademicMonthPeriod[]` (12 tháng: Tháng 9 -> Tháng 8)
- `isDateInAcademicMonth(dateInput: string | Date, targetMonth: number, academicYear: string): boolean`
- `generateAcademicMonthGrid(academicYear: string, monthNumber: number): CalendarDayCell[]`
- `formatAcademicMonthTitle(period: AcademicMonthPeriod): string`
  - Ví dụ: `"Tháng 9 / 2026 (25/08 - 24/09) • Năm học 2026 - 2027"`

### 2.2 Re-architected Calendar Month Grid (`src/components/calendar/calendar-month-view.tsx`)
- Không sử dụng lưới ngày 1 đến ngày 30/31 dương lịch thông thường.
- Lưới hiển thị chu kỳ công tác:
  - Ngày bắt đầu chu kỳ: ngày 25 tháng trước.
  - Ngày kết thúc chu kỳ: ngày 24 tháng này.
  - Các ngày từ 25 đến 24 được đánh dấu là `isCurrentMonth: true` (hoặc `isCurrentPeriod: true`).
  - Nút chuyển tháng (Next/Prev) chuyển đổi giữa các chu kỳ tháng công tác từ Tháng 9 đến Tháng 8.
  - Hiển thị đầy đủ thông tin: Tháng công tác, khoảng thời gian thực tế, năm học.

### 2.3 Task Hub & Toolbar Month Filter (`src/components/dashboard/unified-task-toolbar.tsx` & `src/app/page.tsx`)
- Bổ sung bộ lọc 12 tháng công tác trên thanh công cụ điều khiển nhiệm vụ (Tháng 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8 và "Tất cả").
- Hiển thị badge số lượng nhiệm vụ của từng tháng công tác.
- Lọc nhiệm vụ (SchoolTask & StaffTask) dựa trên `dueDate` rơi vào chu kỳ tháng công tác được chọn.

## 3. Anti-Slop & Precision Design System Requirements
- Stroke width: 1.5px (bảo đảm quy tắc anti-slop).
- Tránh làm tròn ngày tùy tiện; date format chuẩn ISO `YYYY-MM-DD`.
- Hỗ trợ đầy đủ dark/light theme, token OKLCH.
