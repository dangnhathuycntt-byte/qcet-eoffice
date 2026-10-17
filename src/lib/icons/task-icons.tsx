import * as React from "react";

export interface TaskActionIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Bộ icon nhiệm vụ (nguồn chuẩn duy nhất cho trạng thái, ưu tiên, thuộc tính và thao tác):
 * cùng ngôn ngữ với icon sidebar
 * (lưới 19x19, nét 1.5, đầu nét tròn, chỉ viền, góc bo lớn, tô bằng currentColor).
 * Trạng thái, ưu tiên và ngày hạn theo hình học của Linear: lưới 16x16 (`LINEAR_GRID`),
 * trạng thái là lục giác 14px có lề 1px (`LINEAR_STATUS_GRID`).
 */
const LINEAR_GRID = "0 0 16 16";
const LINEAR_STATUS_GRID = "-1 -1 16 16";

function TaskActionSvg({
  size = 16,
  strokeWidth = 1.5,
  viewBox = "0 0 19 19",
  className,
  children,
  ...props
}: TaskActionIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Trạng thái (thuộc tính): các lớp = các bậc trạng thái */
export function TaskIconStatus(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M9.5 2.6L16.2 6.3L9.5 10L2.8 6.3Z" fill="currentColor" />
      <path d="M2.8 9.6L9.5 13.3L16.2 9.6" />
      <path d="M2.8 12.9L9.5 16.6L16.2 12.9" />
    </TaskActionSvg>
  );
}

/** Độ ưu tiên */
export function TaskIconPriority(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="2.6" y="10.4" width="3.2" height="5.6" rx="1.2" fill="currentColor" />
      <rect x="7.9" y="6.6" width="3.2" height="9.4" rx="1.2" fill="currentColor" />
      <rect x="13.2" y="2.8" width="3.2" height="13.2" rx="1.2" />
    </TaskActionSvg>
  );
}

/** Người chủ trì */
export function TaskIconAssignee(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="9.5" cy="6.2" r="3.2" fill="currentColor" />
      <path d="M3.4 16C3.4 12.8 6 10.8 9.5 10.8C13 10.8 15.6 12.8 15.6 16" />
    </TaskActionSvg>
  );
}

/** Hạn hoàn thành */
export function TaskIconDeadline(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="1.9" y="3.4" width="15.2" height="13.2" rx="3.2" />
      <path d="M1.9 6.6C1.9 5 3.2 3.4 5.1 3.4H13.9C15.8 3.4 17.1 5 17.1 6.6V8H1.9Z" fill="currentColor" />
      <path d="M6.4 1.8V4.8M12.6 1.8V4.8" />
      <path d="M6.6 12.2H6.61M9.5 12.2H9.51M12.4 12.2H12.41" />
    </TaskActionSvg>
  );
}

/** Trong tuần này: lịch với dải tuần */
export function TaskIconWeek(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="1.9" y="3.4" width="15.2" height="13.2" rx="3.2" />
      <path d="M1.9 8H17.1" />
      <path d="M6.4 1.8V4.8M12.6 1.8V4.8" />
      <path d="M5.4 12.2H13.6" />
    </TaskActionSvg>
  );
}

/** Sao chép liên kết */
export function TaskIconLink(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M10.4 8.6A3.1 3.1 0 0 0 6 8.6L3.5 11.1A3.1 3.1 0 0 0 7.9 15.5L8.9 14.5" />
      <path d="M8.6 10.4A3.1 3.1 0 0 0 13 10.4L15.5 7.9A3.1 3.1 0 0 0 11.1 3.5L10.1 4.5" />
    </TaskActionSvg>
  );
}

/** Sao chép */
export function TaskIconCopy(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="6.6" y="6.6" width="9.2" height="9.2" rx="2.8" />
      <path d="M12.4 6.6V5A2.8 2.8 0 0 0 9.6 2.2H5A2.8 2.8 0 0 0 2.2 5V9.6A2.8 2.8 0 0 0 5 12.4H6.6" />
    </TaskActionSvg>
  );
}

/** Xem chi tiết */
export function TaskIconView(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M1.8 9.5C3.4 6 6.2 4.2 9.5 4.2C12.8 4.2 15.6 6 17.2 9.5C15.6 13 12.8 14.8 9.5 14.8C6.2 14.8 3.4 13 1.8 9.5Z" />
      <circle cx="9.5" cy="9.5" r="2.3" />
    </TaskActionSvg>
  );
}

/** Xóa / Hủy */
export function TaskIconTrash(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3 5.2H16" />
      <path d="M7.1 5.2V3.9C7.1 3 7.8 2.3 8.7 2.3H10.3C11.2 2.3 11.9 3 11.9 3.9V5.2" />
      <path d="M4.6 5.2L5.3 14.3C5.4 15.4 6.2 16.2 7.3 16.2H11.7C12.8 16.2 13.6 15.4 13.7 14.3L14.4 5.2" />
      <path d="M8 8.6V12.8M11 8.6V12.8" />
    </TaskActionSvg>
  );
}

/* ── Trạng thái nhiệm vụ (4 bậc: chưa bắt đầu → đang làm → chờ duyệt → hoàn thành) ──
 * Lục giác đỉnh nhọn bán kính 6 trên lưới 14 (vẽ trong ô 16px), nét 1.5, góc vát như cột Status
 * của danh sách Projects trên Linear; tiến độ là hình quạt bán kính 3.5 ở tâm.
 */

const STATUS_HEX = "M7 1L12.2 4V10L7 13L1.8 10V4Z";
/** Lục giác đặc lớn hơn nửa nét để cùng cỡ với lục giác viền */
const STATUS_HEX_SOLID = "M7 0.4L12.72 3.7V10.3L7 13.6L1.28 10.3V3.7Z";

/** Mới / chưa bắt đầu: lục giác nét đứt, chưa tô */
export function TaskIconStatusNew(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_STATUS_GRID} {...props}>
      <path d={STATUS_HEX} strokeLinejoin="bevel" strokeLinecap="butt" strokeDasharray="1.65 1.35" strokeDashoffset="0.825" />
    </TaskActionSvg>
  );
}

/** Đang thực hiện: lục giác, nửa hình quạt ở tâm */
export function TaskIconStatusInProgress(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_STATUS_GRID} {...props}>
      <path d={STATUS_HEX} strokeLinejoin="bevel" />
      <path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z" fill="currentColor" stroke="none" />
    </TaskActionSvg>
  );
}

/** Chờ duyệt: lục giác, ba phần tư hình quạt ở tâm */
export function TaskIconStatusReview(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_STATUS_GRID} {...props}>
      <path d={STATUS_HEX} strokeLinejoin="bevel" />
      <path d="M7 7V3.5A3.5 3.5 0 1 1 3.5 7Z" fill="currentColor" stroke="none" />
    </TaskActionSvg>
  );
}

/** Trễ hạn: lục giác viền, dấu chấm than ở giữa (khác hẳn các bậc trạng thái tiến độ) */
export function TaskIconStatusOverdue(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_STATUS_GRID} {...props}>
      <path d={STATUS_HEX} strokeLinejoin="bevel" />
      <path d="M7 4.4V7.6" />
      <path d="M7 9.7H7.01" />
    </TaskActionSvg>
  );
}

/** Hoàn thành: lục giác đặc, dấu tick khoét rỗng */
export function TaskIconStatusDone(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_STATUS_GRID} {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        stroke="none"
        d={`${STATUS_HEX_SOLID}M4 7.1L4.9 6.2L6.2 7.5L9.1 4.6L10 5.5L6.2 9.3Z`}
      />
    </TaskActionSvg>
  );
}

/* ── Mức độ ưu tiên (khẩn cấp + 3 cột tín hiệu), hình học như Linear ── */

/** Khẩn cấp: ô vuông bo góc đặc, dấu chấm than khoét rỗng (nền hàng lộ qua, hợp cả hàng đang chọn) */
export function TaskIconPriorityUrgent(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        stroke="none"
        d="M3 1H13A2 2 0 0 1 15 3V13A2 2 0 0 1 13 15H3A2 2 0 0 1 1 13V3A2 2 0 0 1 3 1ZM7.2 3.9V9.3H8.8V3.9ZM7.2 10.6V12.2H8.8V10.6Z"
      />
    </TaskActionSvg>
  );
}

function PriorityBars({ level, ...props }: TaskActionIconProps & { level: 1 | 2 | 3 }) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <rect x="1.5" y="8" width="3" height="6" rx="1" fill="currentColor" stroke="none" />
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" stroke="none" fillOpacity={level >= 2 ? 1 : 0.4} />
      <rect x="11.5" y="2" width="3" height="12" rx="1" fill="currentColor" stroke="none" fillOpacity={level >= 3 ? 1 : 0.4} />
    </TaskActionSvg>
  );
}

/** Cao */
export function TaskIconPriorityHigh(props: TaskActionIconProps) {
  return <PriorityBars level={3} {...props} />;
}

/** Bình thường */
export function TaskIconPriorityNormal(props: TaskActionIconProps) {
  return <PriorityBars level={2} {...props} />;
}

/** Thấp */
export function TaskIconPriorityLow(props: TaskActionIconProps) {
  return <PriorityBars level={1} {...props} />;
}

/** Không ưu tiên: ba gạch ngang ở giữa, cùng cột với tín hiệu (như "No priority" của Linear) */
export function TaskIconPriorityNone(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <rect x="1.5" y="7.25" width="3" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="6.5" y="7.25" width="3" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="11.5" y="7.25" width="3" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
    </TaskActionSvg>
  );
}

/** Hủy: lục giác đặc, dấu X khoét rỗng */
export function TaskIconStatusCancelled(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_STATUS_GRID} {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        stroke="none"
        d={`${STATUS_HEX_SOLID}M4.6 5.52L5.52 4.6L7 6.08L8.48 4.6L9.4 5.52L7.92 7L9.4 8.48L8.48 9.4L7 7.92L5.52 9.4L4.6 8.48L6.08 7Z`}
      />
    </TaskActionSvg>
  );
}

/* ── Hạn hoàn thành theo tình trạng (lịch có dải đầu đặc, như cột Target date của Linear) ── */

/** Khung lịch hở góc dưới phải để đặt dấu phụ */
const DUE_FRAME_OPEN = "M8.5 13.25H4.75A2 2 0 0 1 2.75 11.25V5.25A2 2 0 0 1 4.75 3.25H11.25A2 2 0 0 1 13.25 5.25V8.5";
const DUE_HEADER = "M2 5.25A2.75 2.75 0 0 1 4.75 2.5H11.25A2.75 2.75 0 0 1 14 5.25V6.5H2Z";

/** Hạn: còn thời gian */
export function TaskIconDue(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <rect x="2.75" y="3.25" width="10.5" height="10" rx="2" />
      <path d={DUE_HEADER} fill="currentColor" stroke="none" />
    </TaskActionSvg>
  );
}

/** Hạn: sắp tới (đồng hồ ở góc) */
export function TaskIconDueSoon(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <path d={DUE_FRAME_OPEN} />
      <path d={DUE_HEADER} fill="currentColor" stroke="none" />
      <circle cx="12.25" cy="12.25" r="2.75" />
      <path d="M12.25 11.1V12.4L13.05 13" />
    </TaskActionSvg>
  );
}

/** Hạn: trễ (dấu X ở góc) */
export function TaskIconDueOverdue(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <path d={DUE_FRAME_OPEN} />
      <path d={DUE_HEADER} fill="currentColor" stroke="none" />
      <path d="M10.75 10.75L14.25 14.25M14.25 10.75L10.75 14.25" />
    </TaskActionSvg>
  );
}

/** Hạn: đã xong (dấu tick trong lịch) */
export function TaskIconDueClosed(props: TaskActionIconProps) {
  return (
    <TaskActionSvg viewBox={LINEAR_GRID} {...props}>
      <rect x="2.75" y="3.25" width="10.5" height="10" rx="2" />
      <path d={DUE_HEADER} fill="currentColor" stroke="none" />
      <path d="M5.75 9.75L7.25 11.1L10.25 8.25" />
    </TaskActionSvg>
  );
}

/** Tất cả trạng thái */
export function TaskIconStatusAll(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="9.5" cy="9.5" r="7.2" />
      <path d="M6.2 9.5H6.21M9.5 9.5H9.51M12.8 9.5H12.81" />
    </TaskActionSvg>
  );
}

/* ── Thuộc tính / bộ lọc khác ── */

/** Người phối hợp */
export function TaskIconCollaborators(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="7" cy="6.4" r="2.8" fill="currentColor" />
      <path d="M1.8 15.6C1.8 12.8 4 11 7 11C10 11 12.2 12.8 12.2 15.6" />
      <path d="M12.4 3.9A2.8 2.8 0 0 1 12.4 9" />
      <path d="M14.2 11.4C15.9 12 17.2 13.4 17.2 15.6" />
    </TaskActionSvg>
  );
}

/** Danh mục (nhãn) */
export function TaskIconCategory(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M2.4 4.6C2.4 3.4 3.4 2.4 4.6 2.4H9.2C9.8 2.4 10.4 2.6 10.8 3.1L16 8.3C16.8 9.1 16.8 10.4 16 11.2L11.2 16C10.4 16.8 9.1 16.8 8.3 16L3.1 10.8C2.6 10.4 2.4 9.8 2.4 9.2Z" />
      <circle cx="6.6" cy="6.6" r="1.3" fill="currentColor" />
    </TaskActionSvg>
  );
}

/** Đơn vị / phòng ban */
export function TaskIconDepartment(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="3.2" y="2.2" width="12.6" height="14.6" rx="3" />
      <path d="M7 6.2H7.01M12 6.2H12.01M7 9.4H7.01M12 9.4H12.01" />
      <path d="M7.9 16.8V13.9C7.9 13.3 8.4 12.8 9 12.8H10C10.6 12.8 11.1 13.3 11.1 13.9V16.8Z" fill="currentColor" />
    </TaskActionSvg>
  );
}

/** Thời gian / tháng học vụ */
export function TaskIconTime(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="9.5" cy="9.5" r="7.2" />
      <path d="M9.5 5.4V9.5L12.2 11.2" />
    </TaskActionSvg>
  );
}

/** Sức khỏe / tiến độ (nhịp) */
export function TaskIconHealth(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M1.9 9.8H4.8L6.8 4.6L10.4 14.6L12.4 9.8H17.1" />
    </TaskActionSvg>
  );
}

/** Tiến độ: đồng hồ đo (cung hở phía dưới và kim chỉ mức) */
export function TaskIconProgress(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M4.7 14.3A6.8 6.8 0 1 1 14.3 14.3" />
      <path d="M9.5 9.5L12.4 6.6" />
      <circle cx="9.5" cy="9.5" r="1.7" fill="currentColor" />
    </TaskActionSvg>
  );
}

/** Nguồn / văn bản gốc */
export function TaskIconOrigin(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M4.2 2.2H10.6L15.2 6.8V14.8C15.2 15.9 14.3 16.8 13.2 16.8H5.8C4.7 16.8 3.8 15.9 3.8 14.8V2.6" />
      <path d="M10.4 2.4V6.9H15Z" fill="currentColor" />
      <path d="M6.6 10.4H12.4M6.6 13.2H10" />
    </TaskActionSvg>
  );
}

/** Sắp rủi ro (tam giác cảnh báo) */
export function TaskIconAtRisk(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M8.1 3.4C8.8 2.2 10.2 2.2 10.9 3.4L16.6 13.3C17.3 14.5 16.6 15.9 15.2 15.9H3.8C2.4 15.9 1.7 14.5 2.4 13.3Z" />
      <path d="M9.5 7V10.4" />
      <path d="M9.5 12.6H9.51" />
    </TaskActionSvg>
  );
}

/** Trễ hạn (hình thoi có dấu X) */
export function TaskIconOverdue(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M8.2 2.7C8.9 2 10.1 2 10.8 2.7L16.3 8.2C17 8.9 17 10.1 16.3 10.8L10.8 16.3C10.1 17 8.9 17 8.2 16.3L2.7 10.8C2 10.1 2 8.9 2.7 8.2Z" />
      <path d="M7.3 7.3L11.7 11.7M11.7 7.3L7.3 11.7" />
    </TaskActionSvg>
  );
}

/* ── Thanh thao tác hàng loạt ── */

/** Đã chọn nhiều mục */
export function TaskIconChecklist(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="2.4" y="2.4" width="14.2" height="14.2" rx="4" />
      <path d="M6.2 9.7L8.5 12L12.9 7.2" />
    </TaskActionSvg>
  );
}

/** Đánh dấu hoàn thành (vòng tròn có dấu tick) */
export function TaskIconComplete(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="9.5" cy="9.5" r="7.2" />
      <path d="M6.3 9.8L8.6 12.1L12.9 7.2" />
    </TaskActionSvg>
  );
}

/** Xuất tệp */
export function TaskIconExport(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M4.2 2.2H10.6L15.2 6.8V14.8C15.2 15.9 14.3 16.8 13.2 16.8H5.8C4.7 16.8 3.8 15.9 3.8 14.8V2.6" />
      <path d="M10.4 2.4V6.9H15" />
      <path d="M9.5 9.2V13.4M7.5 11.5L9.5 13.5L11.5 11.5" />
    </TaskActionSvg>
  );
}

/** Đóng / bỏ chọn */
export function TaskIconClose(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M4.8 4.8L14.2 14.2M14.2 4.8L4.8 14.2" />
    </TaskActionSvg>
  );
}

/* ── Khối nội dung (menu gõ "/" trong trình soạn thảo) ─────────────────── */

/** Văn bản */
export function TaskIconBlockText(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M4.2 4.6H14.8M9.5 4.6V14.6M7.4 14.6H11.6" />
    </TaskActionSvg>
  );
}

/** Danh sách dấu đầu dòng */
export function TaskIconBlockBulletList(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M7.6 5H15.4M7.6 9.5H15.4M7.6 14H15.4" />
      <path d="M3.9 5H4M3.9 9.5H4M3.9 14H4" />
    </TaskActionSvg>
  );
}

/** Danh sách đánh số */
export function TaskIconBlockNumberedList(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M8 5.5H15.4M8 13.5H15.4" />
      <path d="M3.4 4.4L4.6 3.6V7.2" />
      <path d="M3.3 11.2C3.5 10.1 5.5 10.2 5.4 11.5C5.3 12.4 3.5 13.2 3.3 14.8H5.5" />
    </TaskActionSvg>
  );
}

/** Danh sách việc cần làm (checklist) */
export function TaskIconBlockChecklist(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="3" y="3" width="13" height="13" rx="3.5" />
      <path d="M6.6 9.8L8.7 11.9L12.5 7.4" />
    </TaskActionSvg>
  );
}

/** Tiêu đề 1 */
export function TaskIconBlockHeading1(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3.4 4.6V14.4M9 4.6V14.4M3.4 9.5H9" />
      <path d="M11.8 7.6L13.6 6.4V14.4" />
    </TaskActionSvg>
  );
}

/** Tiêu đề 2 */
export function TaskIconBlockHeading2(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3.4 4.6V14.4M9 4.6V14.4M3.4 9.5H9" />
      <path d="M11.7 8C12.2 6.4 15.1 6.6 15.1 8.4C15.1 10.2 11.8 11.8 11.7 14.4H15.4" />
    </TaskActionSvg>
  );
}

/** Tiêu đề 3 */
export function TaskIconBlockHeading3(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3.4 4.6V14.4M9 4.6V14.4M3.4 9.5H9" />
      <path d="M11.7 7.4C12.4 6.2 15 6.4 14.9 8.1C14.8 9.3 13.6 9.9 12.9 9.9C14.7 9.8 15.5 10.9 15.1 12.5C14.7 14.3 12.3 14.5 11.7 13.2" />
    </TaskActionSvg>
  );
}

/** Trích dẫn */
export function TaskIconBlockQuote(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3.6 12.6V8.4C3.6 6.6 4.8 5.4 6.6 5.4M3.6 12.6H7.2V8.8H3.6" />
      <path d="M10.6 12.6V8.4C10.6 6.6 11.8 5.4 13.6 5.4M10.6 12.6H14.2V8.8H10.6" />
    </TaskActionSvg>
  );
}

/** Ghi chú nổi bật */
export function TaskIconBlockCallout(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="9.5" cy="9.5" r="7.2" />
      <path d="M9.5 8.8V13M9.5 6.2H9.6" />
    </TaskActionSvg>
  );
}

/** Bảng biểu */
export function TaskIconBlockTable(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="3" y="3.6" width="13" height="12" rx="2.8" />
      <path d="M3 8.2H16M8 8.2V15.6" />
    </TaskActionSvg>
  );
}

/** Khối thu gọn (toggle) */
export function TaskIconBlockToggle(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M6.4 4.6L13.4 9.5L6.4 14.4Z" />
    </TaskActionSvg>
  );
}

/** Hình ảnh */
export function TaskIconBlockImage(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="2.8" y="3.4" width="13.4" height="12.2" rx="3" />
      <circle cx="6.8" cy="7.6" r="1.2" />
      <path d="M3 13.4L7.2 9.6L10.2 12.3L12.4 10.4L16 13.6" />
    </TaskActionSvg>
  );
}

/** Tệp đính kèm (kẹp giấy) */
export function TaskIconBlockAttachment(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M13.6 8.4L8.6 13.4C7.5 14.5 5.9 14.5 4.9 13.5C3.9 12.5 3.9 10.9 5 9.8L10.5 4.3C11.2 3.6 12.3 3.6 13 4.3C13.7 5 13.7 6.1 13 6.8L7.7 12.1" />
    </TaskActionSvg>
  );
}

/** Nhúng phương tiện */
export function TaskIconBlockEmbed(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <rect x="2.8" y="4.4" width="13.4" height="10.4" rx="3" />
      <path d="M8 7.6L11.8 9.6L8 11.6Z" />
    </TaskActionSvg>
  );
}

/** Dấu trang web */
export function TaskIconBlockBookmark(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M5.2 3.6H13.8V15.6L9.5 12.6L5.2 15.6Z" />
    </TaskActionSvg>
  );
}

/** Liên kết */
export function TaskIconBlockLink(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M8 11L11 8" />
      <path d="M7.4 6.2L8.5 5.1C9.8 3.8 11.8 3.8 13 5.1C14.2 6.3 14.2 8.3 13 9.5L11.9 10.6" />
      <path d="M11.6 12.8L10.5 13.9C9.2 15.2 7.2 15.2 6 13.9C4.8 12.7 4.8 10.7 6 9.5L7.1 8.4" />
    </TaskActionSvg>
  );
}

/** Đường phân cách */
export function TaskIconBlockDivider(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3.4 9.5H15.6" />
    </TaskActionSvg>
  );
}

/** Tìm kiếm (ba icon thanh công cụ dùng chung khung 12,5/19, tâm 9,5 để cân thị giác) */
export function TaskIconSearch(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <circle cx="8.25" cy="8.25" r="5" />
      <path d="M11.9 11.9L15.75 15.75" />
    </TaskActionSvg>
  );
}

/** Bộ lọc: phễu */
export function TaskIconFilter(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M4.1 4H14.9A.75.75 0 0 1 15.47 5.24L11.35 9.98A1.5 1.5 0 0 0 11 10.94V15H8V10.94A1.5 1.5 0 0 0 7.65 9.98L3.53 5.24A.75.75 0 0 1 4.1 4Z" />
    </TaskActionSvg>
  );
}

/** Tùy chọn hiển thị: hai thanh trượt, núm viền */
export function TaskIconDisplay(props: TaskActionIconProps) {
  return (
    <TaskActionSvg {...props}>
      <path d="M3.25 6H4.75M8.75 6H15.75" />
      <circle cx="6.75" cy="6" r="2" />
      <path d="M3.25 13H10.25M14.25 13H15.75" />
      <circle cx="12.25" cy="13" r="2" />
    </TaskActionSvg>
  );
}
