import { NextRequest } from 'next/server';
import {
  GET as getSubscribe,
  POST as postSubscribe,
  DELETE as deleteSubscribe,
} from '@/app/api/notifications/push/subscribe/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return getSubscribe(request);
}

export async function POST(request: NextRequest) {
  return postSubscribe(request);
}

export async function DELETE(request: NextRequest) {
  return deleteSubscribe(request);
}
