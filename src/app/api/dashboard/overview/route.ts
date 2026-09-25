import { NextRequest } from 'next/server';
import { getLiveDashboardData, LiveDashboardOptions } from '@/lib/server/dashboard-service';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { AuthenticationError } from '@/server/api/errors';
import { isAdmin } from '@/server/policies/document-policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<Response>;
export async function GET(): Promise<Response>;
export async function GET(request?: NextRequest): Promise<Response> {
  let requestId = 'req-dashboard-overview';
  try {
    if (!request) {
      throw new AuthenticationError('Chưa xác thực danh tính', 'AUTH_REQUIRED');
    }

    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    const { searchParams } = request.nextUrl;
    const academicMonth = searchParams.get('academicMonth')
      ? parseInt(searchParams.get('academicMonth')!, 10)
      : undefined;
    const academicYear = searchParams.get('academicYear') || undefined;
    const requestedDept =
      searchParams.get('departmentId') || searchParams.get('dept') || undefined;

    const options: LiveDashboardOptions = {
      academicMonth: isNaN(Number(academicMonth)) ? undefined : academicMonth,
      academicYear,
      userId: authUser.id,
    };

    const userIsAdmin = isAdmin(authUser);

    if (userIsAdmin) {
      if (requestedDept && requestedDept !== 'all') {
        options.departmentId = requestedDept;
      }
    } else {
      // Non-admin: strictly bound to own department to prevent unauthorized cross-department leakage.
      // Fail closed when the account has no department (schema-legal `departmentId: null`): rather than
      // leaving the query unscoped (which would return the school-wide dataset and inflated stats),
      // restrict it to the caller's own task participation.
      if (authUser.departmentId) {
        options.departmentId = authUser.departmentId;
      } else {
        options.userId = authUser.id;
        options.restrictSubTasksToUser = true;
      }
    }

    const data = await getLiveDashboardData(options);

    // Server-side confinement of school-wide aggregates for non-admin callers.
    // `isAdmin` resolves statutory leadership positions (Hiệu trưởng / Phó Hiệu trưởng / Ban Giám hiệu)
    // to ADMIN, so callers reaching this branch are unit leaders, specialists, lecturers or clerks.
    // Client-side rendering conditions are NOT a security boundary (API rule 2, Server-Truth-Wins):
    // the response body itself must carry only data the caller may see.
    if (!userIsAdmin) {
      const userDeptId = authUser.departmentId;

      // `departmentHealth` is an institution-wide per-department aggregate computed independently of
      // the caller. Confine unit leaders to their own unit; accounts with no unit receive none.
      // `tasks`/`stats`/`upcoming` are already confined by the query-level guards above: `departmentId`
      // for unit-bound callers, or `userId` (own task participation) for dept-less callers — so only the
      // department-scoped `tasks` list needs the cross-department in-memory filter below.
      data.departmentHealth = userDeptId
        ? (data.departmentHealth || []).filter(
            (dept: { departmentId?: string }) => dept.departmentId === userDeptId
          )
        : [];

      // `activities` are derived from a recipient-agnostic, school-wide notification scan (the service's
      // `notification.findMany` carries no `where` clause), exposing other users' actor names and titles.
      // This layer has no per-activity attribution to filter on, so fail closed rather than leak.
      // Per-caller activity requires scoping that query by `Notification.userId` — the canonical
      // recipient semantics used by /api/notifications — at its source.
      data.activities = [];

      // `departmentId` trên SchoolTask/StaffTask được adapter gán từ `Task.leadUnitId`
      // (`dashboard-service.ts` mapper). `leadDepartmentId` là bản sao cùng nguồn nên không
      // cần kiểm tra lại; `assignedToDepartmentId` không bao giờ được populate (field chết).
      if (userDeptId && data.tasks) {
        data.tasks = data.tasks.filter(
          (task) =>
            task.departmentId === userDeptId ||
            task.leadAssigneeId === authUser.id ||
            task.createdById === authUser.id ||
            task.subTasks?.some(
              (sub) => sub.departmentId === userDeptId || sub.assigneeId === authUser.id
            )
        );
      }
    }

    return apiSuccess(data, {
      requestId,
      headers: {
        'Cache-Control': 'private, no-store',
      },
      legacyCompat: true,
    });
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
