import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/jwt-session';
import { taskCommandService } from '@/server/tasks';
import { ApiError } from '@/server/api/errors';

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await Promise.resolve(context.params);
    const body = await request.json();

    const deliverable = await taskCommandService.submitDeliverable(
      { user: session },
      taskId,
      body
    );

    return NextResponse.json(
      { success: true, deliverable, data: deliverable },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating deliverable:', error);
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

    const { id: taskId } = await Promise.resolve(context.params);
    const body = await request.json();

    const deliverable = await taskCommandService.reviewDeliverable(
      { user: session },
      taskId,
      body
    );

    return NextResponse.json({ success: true, deliverable, data: deliverable });
  } catch (error: any) {
    console.error('Error reviewing deliverable:', error);
    const status = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status }
    );
  }
}
