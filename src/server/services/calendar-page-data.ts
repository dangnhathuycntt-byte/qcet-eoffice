import { getLiveDashboardData } from '@/server/services/dashboard-service';
import { MeetingService } from '@/server/services/meeting-service';
import {
  getTodayIctDate,
  getAcademicMonthInfo,
} from '@/lib/academic-calendar';

// Dữ liệu ban đầu cho trang Lịch (src/app/calendar/page.tsx): nhiệm vụ và cuộc họp của tháng học hiện tại.
// Không có userId thì trả hai danh sách rỗng, không gọi DB; lỗi từng nguồn trả danh sách rỗng.
export async function loadCalendarPageData(userId: string | undefined) {
  // Compute current academic month period for the initial fetch
  const sysDate = getTodayIctDate();
  const monthInfo = getAcademicMonthInfo(sysDate);

  // Fetch tasks and meetings in parallel, server-side (no HTTP round-trip)
  const [dashboardData, meetingData] = await Promise.all([
    userId
      ? getLiveDashboardData({
          userId,
          // Non-admin: scope to their own data — same logic as /api/dashboard/overview
        }).catch(() => ({ tasks: [] }))
      : Promise.resolve({ tasks: [] }),
    userId
      ? MeetingService.listMeetings(
          {
            from: new Date(`${monthInfo.startDate}T00:00:00+07:00`).toISOString(),
            to: new Date(`${monthInfo.endDate}T23:59:59+07:00`).toISOString(),
            limit: 100,
            page: 1,
          },
          userId
        ).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] }),
  ]);

  const initialTasks = Array.isArray((dashboardData as any)?.tasks)
    ? (dashboardData as any).tasks
    : [];
  const initialMeetings = Array.isArray((meetingData as any)?.items)
    ? (meetingData as any).items
    : [];

  return { initialTasks, initialMeetings };
}
