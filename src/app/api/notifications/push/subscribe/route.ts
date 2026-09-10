import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { ValidationError } from '@/server/api/errors';
import {
  assertJsonContentType,
  assertRequestBodySize,
  extractFieldErrors,
  MAX_JSON_BODY_SIZE,
} from '@/server/api/validation';
import { PushSubscriptionSchema } from '@/contracts/notifications';
import { getVapidPublicKey } from '@/lib/push-service';
import { assertCsrf } from '@/server/security/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let requestId = 'req-push-key';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const publicKey = getVapidPublicKey();
    return apiSuccess(
      { publicKey },
      {
        requestId,
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}

export async function POST(request: NextRequest) {
  let requestId = 'req-push-subscribe';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    assertCsrf(request);
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    if (!rawBody || typeof rawBody !== 'object') {
      throw new ValidationError('Invalid JSON body');
    }

    const parseResult = PushSubscriptionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw new ValidationError(
        firstIssue?.message || 'Thiếu thông tin endpoint, p256dh hoặc auth',
        extractFieldErrors(parseResult.error)
      );
    }

    const validated = parseResult.data;
    const p256dh = validated.keys?.p256dh || validated.p256dh;
    const auth = validated.keys?.auth || validated.auth;
    const deviceType = validated.deviceType || (rawBody as Record<string, any>).platform || null;
    const userAgent = validated.userAgent || request.headers.get('user-agent') || null;

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: validated.endpoint },
      update: {
        userId: authUser.id,
        p256dh: p256dh!,
        auth: auth!,
        deviceType: deviceType || null,
        userAgent: userAgent || null,
        status: 'ACTIVE',
        failureCount: 0,
        lastFailureCode: null,
        updatedAt: new Date(),
      },
      create: {
        userId: authUser.id,
        endpoint: validated.endpoint,
        p256dh: p256dh!,
        auth: auth!,
        deviceType: deviceType || null,
        userAgent: userAgent || null,
        status: 'ACTIVE',
        failureCount: 0,
      },
    });

    return apiSuccess(
      {
        subscriptionId: subscription.id,
        subscription,
      },
      {
        requestId,
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}

export async function DELETE(request: NextRequest) {
  let requestId = 'req-push-unsubscribe';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    assertCsrf(request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    if (!body || !body.endpoint) {
      throw new ValidationError('Missing endpoint');
    }

    await prisma.pushSubscription.updateMany({
      where: {
        endpoint: body.endpoint,
        userId: authUser.id,
      },
      data: {
        status: 'REVOKED',
        updatedAt: new Date(),
      },
    });

    return apiSuccess(
      { success: true },
      {
        requestId,
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
