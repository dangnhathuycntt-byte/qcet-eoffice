import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { ValidationError } from '@/server/api/errors';
import { parseAndValidateJson } from '@/server/api/validation';
import { PushSubscriptionSchema } from '@/contracts/notifications';
import { getVapidPublicKey } from '@/server/notifications/push-service';
import {
  revokePushSubscriptionByEndpoint,
  upsertPushSubscription,
} from '@/server/notifications/push-subscription-service';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DeletePushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(1, 'Missing endpoint'),
});

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
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
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    await assertRateLimit(authUser.id, 'MUTATION');

    const validated = await parseAndValidateJson(request, PushSubscriptionSchema);

    const p256dh = validated.keys?.p256dh || validated.p256dh;
    const auth = validated.keys?.auth || validated.auth;
    const deviceType = validated.deviceType || validated.platform || null;
    const userAgent = validated.userAgent || request.headers.get('user-agent') || null;

    const subscription = await upsertPushSubscription(authUser.id, {
      endpoint: validated.endpoint,
      p256dh: p256dh!,
      auth: auth!,
      deviceType,
      userAgent,
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
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    await assertRateLimit(authUser.id, 'MUTATION');

    const body = await parseAndValidateJson(request, DeletePushSubscriptionSchema);

    await revokePushSubscriptionByEndpoint(authUser.id, body.endpoint);

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
