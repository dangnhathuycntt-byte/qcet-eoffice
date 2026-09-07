import { NextRequest, NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/push-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request?: NextRequest) {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({
      success: true,
      publicKey,
    });
  } catch (error) {
    console.error('Failed to get VAPID public key:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
