import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { resolveDepartmentId } from "@/lib/executive-matrix-aggregator";
import { matchesUser } from "@/lib/role-task-filter";
import { filterTasksByAcademicMonthStrict } from "@/lib/academic-calendar";
import {
  isTaskPastDue,
  isTaskDueToday,
  getSystemReferenceDate,
  extractIsoDateString,
} from "./table-date-helpers";
import type {
  ColumnSortState,
  FlattenedPersonalTask,
  SmartFilterTab,
  TaskSortField,
} from "../types";

export interface TaskFilterOptions {
  category?: TaskCategory | "ALL" | string;
  department?: string; // e.g. "ALL", "CNTT", "BGH", etc.
  departmentId?: string;
  searchQuery?: string;
  smartFilter?: SmartFilterTab;
  smartTab?: SmartFilterTab;
  currentUserId?: string;
  currentUserName?: string;
  currentUserDepartment?: string;
  referenceDate?: string | Date;
  month?: number | "ALL";
  academicYear?: string;
}

/**
 * Kiểm tra xem một người dùng có khớp với tên hoặc ID hay không.
 */
function isUserMatch(
  targetName?: string,
  targetId?: string,
  currentName?: string,
  currentId?: string
): boolean {
  if (currentId && targetId && currentId === targetId) return true;
  if (!currentName) return false;
  if (!targetName) return false;

  const t = targetName.trim().toLowerCase();
  const c = currentName.trim().toLowerCase();
  if (t === c || t.includes(c) || c.includes(t)) return true;

  return matchesUser(targetName, { name: currentName } as any);
}

/**
 * Kiểm tra xem nhiệm vụ trường có khớp với đơn vị được chọn hay không (Relational mapping)
 */
export function matchTaskDepartment(
  task: SchoolTask,
  canonicalDept: string
): boolean {
  if (canonicalDept === "ALL") return true;

  // 1. Kiểm tra trực tiếp các trường phòng ban của nhiệm vụ cha
  const taskDept =
    task.departmentId ||
    task.leadDepartmentId ||
    task.departmentCode ||
    task.leadDepartmentCode ||
    task.department ||
    task.leadDepartment;

  const matchTaskDept =
    taskDept &&
    (taskDept === canonicalDept ||
      resolveDepartmentId(taskDept) === canonicalDept);

  if (matchTaskDept) return true;

  // 2. Kiểm tra các đơn vị phối hợp (coDepartmentCodes / coDepartments)
  const matchCoDept =
    task.coDepartmentCodes?.some(
      (code) =>
        code === canonicalDept || resolveDepartmentId(code) === canonicalDept
    ) ||
    task.coDepartments?.some(
      (dept) =>
        dept === canonicalDept || resolveDepartmentId(dept) === canonicalDept
    );

  if (matchCoDept) return true;

  // 3. Kiểm tra liên kết phòng ban qua tên DRI hoặc người phối hợp
  const matchDri =
    resolveDepartmentId(task.leadAssigneeName) === canonicalDept ||
    resolveDepartmentId(undefined, task.leadAssigneeName) === canonicalDept;

  if (matchDri) return true;

  const matchCoAssignee = task.coAssignees?.some(
    (name) =>
      resolveDepartmentId(name) === canonicalDept ||
      resolveDepartmentId(undefined, name) === canonicalDept
  );

  if (matchCoAssignee) return true;

  // 4. Kiểm tra các việc con (Subtasks)
  const matchSubtasks = task.subTasks?.some((sub) => {
    const subDept = sub.departmentId || sub.departmentCode || sub.department;
    const matchSubDept =
      subDept &&
      (subDept === canonicalDept ||
        resolveDepartmentId(subDept) === canonicalDept);

    return (
      matchSubDept ||
      resolveDepartmentId(sub.assigneeName) === canonicalDept ||
      resolveDepartmentId(undefined, sub.assigneeName) === canonicalDept
    );
  });

  return Boolean(matchSubtasks);
}

/**
 * Kiểm tra xem nhiệm vụ có liên quan trực tiếp đến người dùng hiện tại hay không (My Tasks)
 */
export function isTaskAssignedToUser(
  task: SchoolTask,
  currentUserId?: string,
  currentUserName?: string
): boolean {
  if (!currentUserId && !currentUserName) return true;

  // 1. Người dùng là DRI chính của nhiệm vụ cha
  const isLead = isUserMatch(
    task.leadAssigneeName,
    task.leadAssigneeId,
    currentUserName,
    currentUserId
  );
  if (isLead) return true;

  // 2. Người dùng thuộc danh sách phối hợp cha
  const isCoAssignee = task.coAssignees?.some((name) =>
    isUserMatch(name, undefined, currentUserName, currentUserId)
  );
  if (isCoAssignee) return true;

  // 3. Người dùng được giao một trong các việc con (hoặc là phối hợp việc con)
  const hasAssignedSubtask = task.subTasks?.some((sub) => {
    const subAny = sub as any;
    const isSubAssignee = isUserMatch(
      sub.assigneeName,
      sub.assigneeId || subAny.assignedTo,
      currentUserName,
      currentUserId
    );
    if (isSubAssignee) return true;

    // Kiểm tra danh sách collaborator của subtask
    if (currentUserId && subAny.collaboratorIds?.includes(currentUserId)) {
      return true;
    }
    if (subAny.collaborators && Array.isArray(subAny.collaborators)) {
      return subAny.collaborators.some((c: any) =>
        isUserMatch(c.name, c.id || c.userId, currentUserName, currentUserId)
      );
    }

    return false;
  });

  return Boolean(hasAssignedSubtask);
}

/**
 * Kiểm tra xem nhiệm vụ hoặc bất kỳ việc con nào có bị quá hạn SLA không
 */
export function isTaskOrSubtaskOverdue(
  task: SchoolTask,
  referenceDate: string | Date = getSystemReferenceDate()
): boolean {
  // Nếu cả nhiệm vụ cha đã hoàn thành hoặc hủy thì không coi là quá hạn
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    return false;
  }

  // 1. Kiểm tra chính nhiệm vụ cha
  if (
    task.status === "OVERDUE" ||
    isTaskPastDue(task.dueDate, referenceDate)
  ) {
    return true;
  }

  // 2. Kiểm tra các việc con chưa hoàn thành
  if (task.subTasks && task.subTasks.length > 0) {
    const hasOverdueSubtask = task.subTasks.some((sub) => {
      if (sub.status === "COMPLETED" || sub.status === "CANCELLED") {
        return false;
      }
      return (
        sub.status === "OVERDUE" ||
        isTaskPastDue(sub.dueDate, referenceDate)
      );
    });

    if (hasOverdueSubtask) return true;
  }

  return false;
}

/**
 * Kiểm tra xem nhiệm vụ hoặc việc con có đang cần xét duyệt / nghiệm thu
 */
export function isTaskOrSubtaskPendingReview(task: SchoolTask): boolean {
  // Trạng thái phê duyệt ở cấp cha
  const parentReview =
    task.status === "WAITING_APPROVAL" ||
    task.status === "PENDING_EXECUTIVE_APPROVAL" ||
    task.status === "NEEDS_REVIEW";

  if (parentReview) return true;

  // Trạng thái phê duyệt ở các việc con
  if (task.subTasks && task.subTasks.length > 0) {
    return task.subTasks.some((sub) => {
      const subAny = sub as any;
      return (
        sub.status === "WAITING_APPROVAL" ||
        sub.status === "PENDING_EXECUTIVE_APPROVAL" ||
        sub.status === "NEEDS_REVIEW" ||
        subAny.requiresReview === true ||
        subAny.triageStatus === "PENDING_TRIAGE"
      );
    });
  }

  return false;
}

/**
 * Kiểm tra xem nhiệm vụ hoặc việc con có hạn chót là ngày hôm nay hay không
 */
export function isTaskOrSubtaskDueToday(
  task: SchoolTask,
  referenceDate: string | Date = getSystemReferenceDate()
): boolean {
  if (isTaskDueToday(task.dueDate, referenceDate)) {
    return true;
  }

  if (task.subTasks && task.subTasks.length > 0) {
    return task.subTasks.some((sub) =>
      isTaskDueToday(sub.dueDate, referenceDate)
    );
  }

  return false;
}

/**
 * Bộ lọc đa chiều tổng hợp cho bảng nhiệm vụ (Table Filter Engine)
 */
export function filterTasks(
  tasks: SchoolTask[],
  options: TaskFilterOptions
): SchoolTask[] {
  let result = tasks;
  const refDate =
    options.referenceDate instanceof Date
      ? options.referenceDate.toISOString().slice(0, 10)
      : options.referenceDate || getSystemReferenceDate();

  // 1. Lọc theo tháng năm học thuật nếu có
  if (
    options.month !== undefined &&
    options.month !== "ALL" &&
    typeof options.month === "number"
  ) {
    result = filterTasksByAcademicMonthStrict(
      result,
      options.month,
      options.academicYear
    );
  }

  // 2. Lọc theo đơn vị / phòng ban (Department)
  const rawDept = options.departmentId || options.department;
  if (rawDept && rawDept !== "ALL") {
    const canonicalDept =
      resolveDepartmentId(rawDept) || rawDept.trim().toUpperCase();
    result = result.filter((task) => {
      if (task.departmentId === rawDept || task.leadDepartmentId === rawDept) {
        return true;
      }
      return matchTaskDepartment(task, canonicalDept);
    });
  }

  // 3. Lọc theo danh mục chuyên môn DACUM
  if (options.category && options.category !== "ALL") {
    result = result.filter((task) => task.category === options.category);
  }

  // 4. Lọc theo thẻ thông minh (Smart Filter Pills)
  const activeTab = options.smartTab || options.smartFilter;
  if (activeTab && activeTab !== "all") {
    switch (activeTab) {
      case "my_tasks":
        result = result.filter((task) =>
          isTaskAssignedToUser(
            task,
            options.currentUserId,
            options.currentUserName
          )
        );
        break;
      case "overdue":
        result = result.filter((task) =>
          isTaskOrSubtaskOverdue(task, refDate)
        );
        break;
      case "review":
        result = result.filter((task) =>
          isTaskOrSubtaskPendingReview(task)
        );
        break;
      case "today":
        result = result.filter((task) =>
          isTaskOrSubtaskDueToday(task, refDate)
        );
        break;
      case "in_progress":
        result = result.filter((task) => task.status === "IN_PROGRESS");
        break;
      case "completed":
        result = result.filter((task) => task.status === "COMPLETED");
        break;
    }
  }

  // 5. Tìm kiếm từ khóa (Search Query)
  const query = options.searchQuery?.trim().toLowerCase();
  if (query) {
    result = result.filter((task) => {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchId = task.id.toLowerCase().includes(query);
      const matchCode = (task.code || (task as any).taskCode || "")
        .toLowerCase()
        .includes(query);
      const matchLead = (task.leadAssigneeName || "")
        .toLowerCase()
        .includes(query);
      const matchDesc = task.description
        ? task.description.toLowerCase().includes(query)
        : false;
      const matchCo = task.coAssignees?.some((name) =>
        name.toLowerCase().includes(query)
      );
      const matchDacum =
        (task.dacumTaskDef?.code &&
          task.dacumTaskDef.code.toLowerCase().includes(query)) ||
        (task.dacumTaskDef?.title &&
          task.dacumTaskDef.title.toLowerCase().includes(query));

      const matchSubtasks = task.subTasks?.some((sub) => {
        const subCode = (sub.code || (sub as any).taskCode || "").toLowerCase();
        return (
          sub.title.toLowerCase().includes(query) ||
          sub.id.toLowerCase().includes(query) ||
          subCode.includes(query) ||
          sub.assigneeName.toLowerCase().includes(query)
        );
      });

      return Boolean(
        matchTitle ||
          matchId ||
          matchCode ||
          matchLead ||
          matchDesc ||
          matchCo ||
          matchDacum ||
          matchSubtasks
      );
    });
  }

  return result;
}

/**
 * Tính toán số lượng tác vụ cho từng SmartFilterTab dựa trên danh sách tác vụ và options
 */
export function computeSmartTabCounts(
  tasks: SchoolTask[],
  options?: TaskFilterOptions
): Record<SmartFilterTab, number> {
  const refDate =
    options?.referenceDate instanceof Date
      ? options.referenceDate.toISOString().slice(0, 10)
      : options?.referenceDate || getSystemReferenceDate();

  let base = tasks;
  if (
    options?.month !== undefined &&
    options?.month !== "ALL" &&
    typeof options.month === "number"
  ) {
    base = filterTasksByAcademicMonthStrict(
      base,
      options.month,
      options.academicYear
    );
  }

  const rawDept = options?.departmentId || options?.department;
  if (rawDept && rawDept !== "ALL") {
    const canonicalDept =
      resolveDepartmentId(rawDept) || rawDept.trim().toUpperCase();
    base = base.filter((task) => {
      if (task.departmentId === rawDept || task.leadDepartmentId === rawDept) {
        return true;
      }
      return matchTaskDepartment(task, canonicalDept);
    });
  }

  if (options?.category && options.category !== "ALL") {
    base = base.filter((task) => task.category === options.category);
  }

  const counts: Record<SmartFilterTab, number> = {
    all: base.length,
    my_tasks: 0,
    overdue: 0,
    review: 0,
    today: 0,
    in_progress: 0,
    completed: 0,
  };

  for (const task of base) {
    if (
      isTaskAssignedToUser(
        task,
        options?.currentUserId,
        options?.currentUserName
      )
    ) {
      counts.my_tasks++;
    }
    if (isTaskOrSubtaskOverdue(task, refDate)) {
      counts.overdue++;
    }
    if (isTaskOrSubtaskPendingReview(task)) {
      counts.review++;
    }
    if (isTaskOrSubtaskDueToday(task, refDate)) {
      counts.today++;
    }
    if (task.status === "IN_PROGRESS") {
      counts.in_progress++;
    }
    if (task.status === "COMPLETED") {
      counts.completed++;
    }
  }

  return counts;
}

/**
 * Trọng số ưu tiên (Priority weight) để sắp xếp
 */
const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * Sắp xếp danh sách nhiệm vụ theo cột và chiều được chọn
 */
export function sortTasks(
  tasks: SchoolTask[],
  sortState: ColumnSortState | null
): SchoolTask[] {
  if (!sortState) return tasks;

  const field = (sortState as any).field || (sortState as any).column;
  const { direction } = sortState;
  const factor = direction === "asc" ? 1 : -1;

  return [...tasks].sort((a, b) => {
    switch (field) {
      case "code": {
        const codeA = a.code || (a as any).taskCode || a.id || "";
        const codeB = b.code || (b as any).taskCode || b.id || "";
        return factor * codeA.localeCompare(codeB, "vi", { numeric: true });
      }
      case "title": {
        return factor * a.title.localeCompare(b.title, "vi");
      }
      case "dueDate": {
        const dateA = extractIsoDateString(a.dueDate) || "9999-99-99";
        const dateB = extractIsoDateString(b.dueDate) || "9999-99-99";
        return factor * dateA.localeCompare(dateB);
      }
      case "status": {
        const statusA = a.status || "";
        const statusB = b.status || "";
        return factor * statusA.localeCompare(statusB);
      }
      case "progress":
      case "progressPercent": {
        const pA = a.progressPercent ?? 0;
        const pB = b.progressPercent ?? 0;
        return factor * (pA - pB);
      }
      case "leadAssignee": {
        const nameA = a.leadAssigneeName || "";
        const nameB = b.leadAssigneeName || "";
        return factor * nameA.localeCompare(nameB, "vi");
      }
      case "category": {
        const catA = a.category || "";
        const catB = b.category || "";
        return factor * catA.localeCompare(catB);
      }
      case "priority": {
        const wA = PRIORITY_WEIGHTS[a.priority || "NORMAL"] || 0;
        const wB = PRIORITY_WEIGHTS[b.priority || "NORMAL"] || 0;
        return factor * (wA - wB);
      }
      case "department": {
        const deptA = a.departmentId || a.leadDepartment || "";
        const deptB = b.departmentId || b.leadDepartment || "";
        return factor * deptA.localeCompare(deptB, "vi");
      }
      default:
        return 0;
    }
  });
}

/**
 * Cấu trúc kết quả phân trang
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Phân trang danh sách dữ liệu an toàn
 */
export function paginateTasks<T>(
  items: T[],
  page = 1,
  pageSize = 15
): PaginatedResult<T> {
  const safePage = Math.max(1, page);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

/**
 * Xử lý hoàn chỉnh dữ liệu bảng: Lọc đa chiều -> Sắp xếp
 */
export function processTaskTableData(
  tasks: SchoolTask[],
  filterOptions: TaskFilterOptions,
  sortState?: ColumnSortState | null
): SchoolTask[] {
  const filtered = filterTasks(tasks, filterOptions);
  if (!sortState) return filtered;
  return sortTasks(filtered, sortState);
}

/**
 * Làm phẳng (flatten) các việc con của người dùng thành các dòng công việc độc lập ở cấp cao nhất
 * đi kèm Breadcrumb nguồn gốc cho chế độ xem việc cá nhân (Personal Workbox).
 */
export function flattenPersonalTasks(
  tasks: SchoolTask[],
  userName?: string,
  userId?: string
): FlattenedPersonalTask[] {
  const result: FlattenedPersonalTask[] = [];

  for (const task of tasks) {
    const isLead = isUserMatch(
      task.leadAssigneeName,
      task.leadAssigneeId,
      userName,
      userId
    );

    // 1. Nếu người dùng là người phụ trách chính (DRI), giữ nhiệm vụ cha
    if (isLead) {
      result.push(task);
    }

    // 2. Tìm các việc con được giao hoặc phối hợp cho người dùng
    if (task.subTasks && Array.isArray(task.subTasks)) {
      for (const sub of task.subTasks) {
        const subAny = sub as any;
        const isSubAssignee = isUserMatch(
          sub.assigneeName,
          sub.assigneeId || subAny.assignedTo,
          userName,
          userId
        );

        const isCollaborator =
          (userId && subAny.collaboratorIds?.includes(userId)) ||
          (subAny.collaborators &&
            Array.isArray(subAny.collaborators) &&
            subAny.collaborators.some((c: any) =>
              isUserMatch(c.name, c.id || c.userId, userName, userId)
            ));

        if (isSubAssignee || isCollaborator) {
          result.push({
            ...sub,
            parentSchoolTaskId: task.id,
            parentSchoolTaskTitle: task.title,
            parentSchoolTaskCode: (task as any).taskCode || task.code,
            isFlattenedSubtask: true,
          } as FlattenedPersonalTask);
        }
      }
    }
  }

  return result;
}
