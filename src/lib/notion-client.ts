import {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskCategory,
  TaskStatus,
  UpcomingItem,
  ActivityEvent,
} from "../types/dashboard";
import { computeSchoolTaskRollup, computeDashboardStats } from "./dashboard-aggregator";
import { getMockDashboardPayload, CATEGORY_LABELS } from "./mock-dashboard-data";

export const NOTION_TOKEN =
  process.env.NOTION_TOKEN || "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";

export const HOAT_DONG_DB_ID =
  process.env.NOTION_HOAT_DONG_DB_ID || "6e1726a4-e693-45ec-a961-3774c3e9c582";

export const LICH_LAM_VIEC_DB_ID =
  process.env.NOTION_LICH_LAM_VIEC_DB_ID || "63c187f9-7c5a-49a4-a854-26e830fd44c7";

const NOTION_API_VERSION = "2022-06-28";
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface CacheEntry {
  data: DashboardPayload;
  timestamp: number;
}

let memoryCache: CacheEntry | null = null;

export function clearNotionCache(): void {
  memoryCache = null;
}

export function mapNotionCategory(name?: string): TaskCategory {
  if (!name) return "KHAC";
  const lower = name.toLowerCase();
  if (lower.includes("chuyển đổi số") || lower.includes("cds") || lower.includes("cđs")) return "CHUYEN_DOI_SO";
  if (lower.includes("truyền thông")) return "TRUYEN_THONG";
  if (lower.includes("an toàn thông tin") || lower.includes("attt")) return "ATTT";
  if (lower.includes("cntt") || lower.includes("công nghệ thông tin")) return "CNTT";
  if (lower.includes("thư viện")) return "THU_VIEN";
  if (lower.includes("báo cáo")) return "BAO_CAO";
  return "KHAC";
}

export function mapStaffStatus(name?: string): TaskStatus {
  if (!name) return "NEW";
  const lower = name.toLowerCase();
  if (lower.includes("hoàn thành")) return "COMPLETED";
  if (lower.includes("đang thực hiện")) return "IN_PROGRESS";
  if (lower.includes("chỉnh sửa") || lower.includes("cần")) return "NEEDS_REVIEW";
  if (lower.includes("mới")) return "NEW";
  return "IN_PROGRESS";
}

interface NotionPageResult {
  id: string;
  properties: Record<string, any>;
  last_edited_time?: string;
}

async function queryNotionDatabase(
  databaseId: string,
  pageSize = 100,
  startCursor?: string
): Promise<{ results: NotionPageResult[]; nextCursor?: string | null }> {
  const cleanDbId = databaseId.replace(/-/g, "");
  const url = `https://api.notion.com/v1/databases/${cleanDbId}/query`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const body: Record<string, any> = { page_size: pageSize };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Notion API error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    return {
      results: data.results || [],
      nextCursor: data.has_more ? data.next_cursor : null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchNotionDashboardData(): Promise<DashboardPayload> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.data;
  }

  try {
    // Fetch School Tasks & Staff Tasks in parallel
    const [schoolRes, staffRes] = await Promise.all([
      queryNotionDatabase(HOAT_DONG_DB_ID, 100),
      queryNotionDatabase(LICH_LAM_VIEC_DB_ID, 100),
    ]);

    if (!schoolRes.results || schoolRes.results.length === 0) {
      throw new Error("No school tasks returned from Notion");
    }

    // Map Staff tasks
    const staffTaskMap = new Map<string, StaffTask[]>();
    const staffTaskList: StaffTask[] = [];

    for (const page of staffRes.results) {
      const props = page.properties;
      const titleObj = props["Công việc"]?.title || [];
      const title = titleObj.map((t: any) => t.plain_text).join("") || "Công việc không tên";

      const people = props["Người phụ trách"]?.people || [];
      const assigneeName = people[0]?.name || "Chưa phân công";
      const assigneeAvatar = people[0]?.avatar_url || undefined;

      const rawStatus = props["Trạng thái"]?.select?.name || props["Trạng thái"]?.status?.name;
      const status = mapStaffStatus(rawStatus);

      const dueDate = props["Ngày thực hiện"]?.date?.start || new Date().toISOString().split("T")[0];
      const updatedAt = page.last_edited_time || new Date().toISOString();

      const parentRelations = props["Hoạt động"]?.relation || [];
      const parentSchoolTaskId = parentRelations[0]?.id || "unlinked";

      const staffTask: StaffTask = {
        id: page.id,
        title,
        assigneeName,
        assigneeAvatar,
        status,
        dueDate,
        parentSchoolTaskId,
        updatedAt,
      };

      staffTaskList.push(staffTask);

      if (!staffTaskMap.has(parentSchoolTaskId)) {
        staffTaskMap.set(parentSchoolTaskId, []);
      }
      staffTaskMap.get(parentSchoolTaskId)!.push(staffTask);
    }

    // Map School tasks
    const schoolTasks: SchoolTask[] = [];

    for (const page of schoolRes.results) {
      const props = page.properties;
      const titleObj = props["Tiêu đề"]?.title || [];
      const title = titleObj.map((t: any) => t.plain_text).join("") || "Nhiệm vụ không tên";

      const rawCategory = props["Nhiệm vụ"]?.select?.name;
      const category = mapNotionCategory(rawCategory);

      const leadPeople = props["Xử lý chính"]?.people || [];
      const leadAssigneeName = leadPeople[0]?.name || "Chưa phân công";
      const leadAssigneeAvatar = leadPeople[0]?.avatar_url || undefined;

      const coAssignees = (props["Phối hợp"]?.multi_select || []).map((m: any) => m.name);
      const assignedDate = props["Ngày giao việc"]?.date?.start || new Date().toISOString().split("T")[0];
      const dueDate = props["Hạn xử lý"]?.date?.start || new Date().toISOString().split("T")[0];

      const rawStatus = props["Trạng thái"]?.status?.name || props["Trạng thái"]?.select?.name;
      const isCompleted = rawStatus ? rawStatus.toLowerCase().includes("hoàn thành") : false;

      const subTasks = staffTaskMap.get(page.id) || [];

      const rawSchoolTask: SchoolTask = {
        id: page.id,
        title,
        category,
        categoryLabel: CATEGORY_LABELS[category] || "Khác",
        leadAssigneeName,
        leadAssigneeAvatar,
        coAssignees,
        assignedDate,
        dueDate,
        status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
        subTasks,
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 0,
      };

      schoolTasks.push(computeSchoolTaskRollup(rawSchoolTask));
    }

    // Compute stats
    const stats = computeDashboardStats(schoolTasks);

    // Build upcoming deadlines (from school tasks & staff tasks)
    const upcoming: UpcomingItem[] = [];
    const today = new Date();
    const todayIso = today.toISOString().split("T")[0];

    // Collect school tasks due soon
    for (const st of schoolTasks.slice(0, 5)) {
      upcoming.push({
        id: `upcoming-st-${st.id}`,
        title: st.title,
        dueDate: st.dueDate,
        assigneeName: st.leadAssigneeName,
        assigneeAvatar: st.leadAssigneeAvatar,
        level: "Trường",
        category: st.category,
        isOverdue: st.dueDate < todayIso && st.status !== "COMPLETED",
      });
    }

    // Collect staff tasks due soon
    for (const sub of staffTaskList.slice(0, 5)) {
      upcoming.push({
        id: `upcoming-sub-${sub.id}`,
        title: sub.title,
        dueDate: sub.dueDate,
        assigneeName: sub.assigneeName,
        assigneeAvatar: sub.assigneeAvatar,
        level: "Đơn vị",
        isOverdue: sub.dueDate < todayIso && sub.status !== "COMPLETED",
      });
    }

    // Build activities from staff tasks
    const activities: ActivityEvent[] = staffTaskList.slice(0, 8).map((sub, idx) => ({
      id: `act-${sub.id}-${idx}`,
      actorName: sub.assigneeName,
      action:
        sub.status === "COMPLETED"
          ? "vừa hoàn thành công việc"
          : sub.status === "NEEDS_REVIEW"
          ? "vừa gửi duyệt công việc"
          : "đang thực hiện công việc",
      targetTitle: sub.title,
      timestamp: `${(idx + 1) * 15} phút trước`,
      category: "CNTT",
    }));

    const payload: DashboardPayload = {
      stats,
      tasks: schoolTasks,
      upcoming: upcoming.slice(0, 7),
      activities: activities.length > 0 ? activities : getMockDashboardPayload().activities,
      source: "notion-live",
    };

    memoryCache = {
      data: payload,
      timestamp: now,
    };

    return payload;
  } catch (err) {
    console.warn("Notion live fetch failed or offline; using mock fallback:", err);
    const mock = getMockDashboardPayload();
    const fallbackPayload: DashboardPayload = {
      ...mock,
      source: "mock-fallback",
    };

    // Cache fallback briefly (15s) so repeated hits don't hammer failed endpoints
    memoryCache = {
      data: fallbackPayload,
      timestamp: now - (CACHE_TTL_MS - 15000),
    };

    return fallbackPayload;
  }
}
