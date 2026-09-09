import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SessionPayload } from '@/lib/jwt-session';
import { mapPrismaTaskToSchoolTask } from '@/lib/adapters/task-db-adapter';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { ApiError } from '@/server/api/errors';

function getSessionPayload(request: NextRequest): SessionPayload | null {
  return getSessionFromRequest(request);
}

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const result = await taskQueryService.getTaskById(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      data: result.data,
      raw: result.raw,
    });
  } catch (error: any) {
    console.error('Error fetching task details:', error);
    const status = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const body = await request.json();

    // Server-side authorization invariants & Segregation of Duties (SoD):
    // 1. Completion of school-level tasks (existingTask.scope === TaskScope.SCHOOL) strictly requires BGH / ADMIN.
    // 2. Assignee self-approval prohibition (CANNOT_SELF_APPROVE): người thực hiện không được tự nghiệm thu nhiệm vụ của chính mình.
    const updated = await taskCommandService.updateTask({ user: session }, id, body);
    const mapped = mapPrismaTaskToSchoolTask(updated);

    return NextResponse.json({
      success: true,
      task: mapped,
      data: mapped,
      raw: updated,
    });
  } catch (error: any) {
    console.error('Error updating task:', error);
    const status = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const result = await taskCommandService.deleteTask({ user: session }, id);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    const status = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status }
    );
  }
}
