import type { SchoolTask } from "@/types/dashboard";
import {
  getCalendarAttentionState,
  sortCalendarItemsByAttention,
} from "@/lib/calendar/calendar-presentation";
import type { DayTaskItem } from "./calendar-day-sheet";
import type { CalendarScope } from "./calendar-toolbar";

export interface DayTaskItemFilters {
  scope: CalendarScope;
  currentUserId?: string;
  currentUserName?: string;
  /** Đã `trim().toLowerCase()`. */
  query: string;
  statusFilter?: string;
  levelFilter?: string;
  referenceDate: string;
}

export interface DayTaskItemsByDate {
  tasks: Map<string, DayTaskItem[]>;
  events: Map<string, DayTaskItem[]>;
}

function addItem(map: Map<string, DayTaskItem[]>, dateKey: string, item: DayTaskItem) {
  const list = map.get(dateKey);
  if (list) list.push(item);
  else map.set(dateKey, [item]);
}

/**
 * Gom nhiệm vụ (trường + đơn vị) và sự kiện theo ngày hạn sau khi áp bộ lọc phạm vi, trạng thái,
 * cấp và từ khóa; mỗi ngày được xếp theo mức cần chú ý. Dùng chung cho lưới tháng và lưới tuần.
 */
export function groupDayTaskItemsByDate(
  tasks: SchoolTask[],
  events: DayTaskItem[],
  filters: DayTaskItemFilters
): DayTaskItemsByDate {
  const { scope, currentUserId, currentUserName, query, statusFilter, levelFilter, referenceDate } = filters;
  const taskMap = new Map<string, DayTaskItem[]>();
  const eventMap = new Map<string, DayTaskItem[]>();

  const matchesStatus = (status: string, dueDate?: string) => {
    if (!statusFilter || statusFilter === "ALL") return true;
    if (statusFilter === "OVERDUE") {
      return (
        getCalendarAttentionState({ id: "filter", title: "filter", status, dueDate }, referenceDate) === "overdue"
      );
    }
    return status === statusFilter;
  };

  for (const st of tasks) {
    const matchesSchoolLevel = !levelFilter || levelFilter === "ALL" || levelFilter === "TRUONG";
    const isSchoolMatchScope =
      scope === "school" ||
      (scope === "my" &&
        ((currentUserId && st.leadAssigneeId === currentUserId) ||
          (currentUserName && st.leadAssigneeName === currentUserName)));

    if (isSchoolMatchScope && matchesSchoolLevel && st.dueDate && matchesStatus(st.status, st.dueDate)) {
      const matchesQuery =
        !query ||
        st.title.toLowerCase().includes(query) ||
        Boolean(st.leadAssigneeName?.toLowerCase().includes(query));

      if (matchesQuery) {
        addItem(taskMap, st.dueDate.split("T")[0], {
          id: st.id,
          title: st.title,
          level: "Trường",
          category: st.category,
          categoryLabel: st.categoryLabel,
          assigneeName: st.leadAssigneeName,
          assigneeAvatar: st.leadAssigneeAvatar,
          dueDate: st.dueDate,
          status: st.status,
          progressPercent: st.progressPercent,
          originalTask: st,
        });
      }
    }

    const matchesSubLevel = !levelFilter || levelFilter === "ALL" || levelFilter === "DON_VI";
    if (!matchesSubLevel || !Array.isArray(st.subTasks)) continue;

    for (const sub of st.subTasks) {
      const isUnitMatchScope =
        scope === "unit" ||
        (scope === "my" &&
          ((currentUserId && sub.assigneeId === currentUserId) ||
            (currentUserName && sub.assigneeName === currentUserName)));

      if (!isUnitMatchScope || !sub.dueDate || !matchesStatus(sub.status, sub.dueDate)) continue;

      const matchesQuery =
        !query ||
        sub.title.toLowerCase().includes(query) ||
        Boolean(sub.assigneeName?.toLowerCase().includes(query));
      if (!matchesQuery) continue;

      addItem(taskMap, sub.dueDate.split("T")[0], {
        id: sub.id,
        title: sub.title,
        level: "Đơn vị",
        category: st.category,
        categoryLabel: st.categoryLabel,
        assigneeName: sub.assigneeName,
        assigneeAvatar: sub.assigneeAvatar,
        dueDate: sub.dueDate,
        status: sub.status,
        parentSchoolTaskId: st.id,
        parentSchoolTaskTitle: st.title,
        originalTask: sub,
      });
    }
  }

  if (statusFilter === "ALL") {
    for (const event of events) {
      const matchesLevel =
        levelFilter === "ALL" ||
        (levelFilter === "TRUONG" && event.level === "Trường") ||
        (levelFilter === "DON_VI" && event.level === "Đơn vị");
      const matchesScope =
        scope === "my" ||
        (scope === "school" && event.level === "Trường") ||
        (scope === "unit" && event.level === "Đơn vị");
      const matchesQuery =
        !query ||
        [event.title, event.assigneeName, event.host, event.location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      if (matchesLevel && matchesScope && matchesQuery && event.dueDate) {
        addItem(eventMap, event.dueDate.split("T")[0], event);
      }
    }
  }

  for (const [key, items] of taskMap) {
    taskMap.set(key, sortCalendarItemsByAttention(items, referenceDate));
  }

  return { tasks: taskMap, events: eventMap };
}
