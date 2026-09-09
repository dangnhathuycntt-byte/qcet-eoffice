import { NextRequest, NextResponse } from 'next/server';
import { getLiveDashboardData, LiveDashboardOptions } from '@/lib/server/dashboard-service';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { isAdmin } from '@/server/policies/executive-policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request?: NextRequest): Promise<NextResponse> {
  let requestId = 'req-dashboard-overview';
  try {
    if (!request) {
      return NextResponse.json(
        { success: false, error: 'Chưa xác thực danh tính' },
        { status: 401 }
      );
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
    };

    const userIsAdmin = isAdmin(authUser);

    if (userIsAdmin) {
      if (requestedDept && requestedDept !== 'all') {
        options.departmentId = requestedDept;
      }
    } else {
      // Non-admin: strictly bound to own department to prevent unauthorized cross-department leakage
      if (authUser.departmentId) {
        options.departmentId = authUser.departmentId;
      }
    }

    const data = await getLiveDashboardData(options);

    // Filter sensitive cross-department details for non-admin callers
    if (!userIsAdmin && authUser.departmentId) {
      const userDeptId = authUser.departmentId;
      if (data.tasks) {
        data.tasks = data.tasks.filter(
          (task) =>
            task.departmentId === userDeptId ||
            task.leadDepartmentId === userDeptId ||
            task.subTasks?.some(
              (sub) =>
                sub.assignedToDepartmentId === userDeptId ||
                sub.assigneeId === authUser.id
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
