import { NextRequest } from 'next/server';
import { POST as postTest } from '@/app/api/notifications/push/test/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return postTest(request);
}
