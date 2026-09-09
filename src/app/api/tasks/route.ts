import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/jwt-session';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { ApiError } from '@/server/api/errors';

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isAll = searchParams.get('all') === 'true' || searchParams.get('limit') === 'all';
    const pageParam = searchParams.get('page') || undefined;
    const limitParam = searchParams.get('limit') || undefined;

    const result = await taskQueryService.queryTasks(
      { user: session },
      {
        all: isAll,
        page: pageParam,
        limit: limitParam,
        academicMonth: searchParams.get('academicMonth') || searchParams.get('month') || undefined,
        departmentId: searchParams.get('departmentId') || searchParams.get('dept') || undefined,
        scope: searchParams.get('scope') || undefined,
        academicYear: searchParams.get('academicYear') || searchParams.get('year') || undefined,
        status: searchParams.get('status') || undefined,
        assignedTo: searchParams.get('assignedTo') || undefined,
        parentTaskId: searchParams.get('parentTaskId') || undefined,
        search: searchParams.get('search') || searchParams.get('q') || undefined,
      }
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      tasks: result.tasks, // backward compatibility
      total: result.total, // backward compatibility
      totalCount: result.totalCount, // backward compatibility
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    const status = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newTask = await taskCommandService.createTask({ user: session }, body);

    return NextResponse.json({ success: true, task: newTask, data: newTask }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    const status = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status }
    );
  }
}
