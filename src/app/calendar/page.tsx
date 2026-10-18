
import { auth } from '@/auth';
import { loadCalendarPageData } from '@/server/services/calendar-page-data';
import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  // Resolve authenticated user via Auth.js server helper
  const session = await auth();
  const userId = session?.user?.id;

  const { initialTasks, initialMeetings } = await loadCalendarPageData(userId);

  return (
    <CalendarClient initialTasks={initialTasks} initialMeetings={initialMeetings} />
  );
}
