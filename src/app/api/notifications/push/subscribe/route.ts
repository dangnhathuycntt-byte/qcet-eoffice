import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/jwt-session';
import { getVapidPublicKey } from '@/lib/push-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(request);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const endpoint = body.endpoint;
    const p256dh = body.p256dh || body.keys?.p256dh;
    const auth = body.auth || body.keys?.auth;
    const deviceType = body.deviceType || body.platform || null;
    const userAgent = body.userAgent || request.headers.get('user-agent') || null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: endpoint, p256dh, and auth are required',
        },
        { status: 400 }
      );
    }

    try {
      const parsedEndpoint = new URL(endpoint);
      if (parsedEndpoint.protocol !== 'https:') {
        return NextResponse.json(
          { success: false, error: 'Push endpoint must be a valid HTTPS URL' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Push endpoint must be a valid HTTPS URL' },
        { status: 400 }
      );
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: session.id,
        p256dh,
        auth,
        deviceType: deviceType || null,
        userAgent: userAgent || null,
        status: 'ACTIVE',
        failureCount: 0,
        lastFailureCode: null,
        updatedAt: new Date(),
      },
      create: {
        userId: session.id,
        endpoint,
        p256dh,
        auth,
        deviceType: deviceType || null,
        userAgent: userAgent || null,
        status: 'ACTIVE',
        failureCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error('Failed to subscribe push notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.endpoint) {
      return NextResponse.json(
        { success: false, error: 'Missing endpoint' },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(request);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await prisma.pushSubscription.updateMany({
      where: {
        endpoint: body.endpoint,
        userId: session.id,
      },
      data: {
        status: 'REVOKED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to unsubscribe push notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
