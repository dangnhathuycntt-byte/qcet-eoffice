
import { fetchPageData } from '@/lib/server-api';
import { CalendarPageDataSchema } from '@qcet/contracts/page-data';
import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  // Nhiệm vụ và cuộc họp của tháng học hiện tại (GET /api/page-data/calendar); chưa đăng nhập thì hai danh sách rỗng
  const result = await fetchPageData('/api/page-data/calendar', CalendarPageDataSchema);
  if (!result.ok && result.status !== 401) {
    throw new Error(`GET /api/page-data/calendar trả ${result.status}`);
  }
  const { initialTasks, initialMeetings } = result.ok ? result.data : { initialTasks: [], initialMeetings: [] };

  return (
    <CalendarClient initialTasks={initialTasks} initialMeetings={initialMeetings} />
  );
}
