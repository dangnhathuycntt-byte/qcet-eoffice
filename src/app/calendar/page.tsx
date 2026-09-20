// Server Component — fetches initial calendar data before handing off to the client
// No "use client" directive: this runs on the server, enabling loading.tsx to show immediately
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { getLiveDashboardData } from '@/lib/server/dashboard-service';
import { MeetingService } from '@/server/services/meeting-service';
import { isAdmin } from '@/server/policies/document-policy';
import {
  getTodayIctDate,
  getAcademicMonthInfo,
} from '@/lib/academic-calendar';
import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  // Resolve authenticated user via Auth.js server helper
  const session = await auth();
  const userId = session?.user?.id;

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

  return (
    <CalendarClient initialTasks={initialTasks} initialMeetings={initialMeetings} />
  );
}
