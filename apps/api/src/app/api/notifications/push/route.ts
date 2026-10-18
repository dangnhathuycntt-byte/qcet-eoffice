import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { ValidationError } from "@/server/api/errors";
import { parseAndValidateJson } from "@/server/api/validation";
import { getVapidPublicKey } from "@/server/notifications/push-service";
import { DEFAULT_PUSH_PREFERENCES } from "@qcet/shared/lib/pwa/push-preferences";
import {
  getPushStatus,
  revokePushSubscriptions,
  savePushPreferences,
  upsertPushSubscription,
} from "@/server/notifications/push-subscription-service";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PushPreferencesSchema = z.object({
  taskAssigned: z.boolean().optional(),
  taskReview: z.boolean().optional(),
  deadlineReminder: z.boolean().optional(),
  documentDirective: z.boolean().optional(),
  taskExtension: z.boolean().optional(),
  taskDecline: z.boolean().optional(),
  unitRequest: z.boolean().optional(),
});

const PushPostSchema = z.object({
  preferences: PushPreferencesSchema.optional(),
  endpoint: z.string().trim().max(1024).optional(),
  p256dh: z.string().trim().max(255).optional(),
  auth: z.string().trim().max(255).optional(),
  keys: z
    .object({
      p256dh: z.string().trim().max(255).optional(),
      auth: z.string().trim().max(255).optional(),
    })
    .optional(),
  deviceType: z.string().trim().max(50).optional().nullable(),
  platform: z.string().trim().max(50).optional().nullable(),
  userAgent: z.string().trim().max(500).optional().nullable(),
});

const PushDeleteSchema = z.object({
  endpoint: z.string().trim().max(1024).optional().nullable(),
});

/**
 * GET /api/notifications/push
 * Returns VAPID public key and current user's push status & preferences.
 */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const publicKey = getVapidPublicKey();
    const context = await getApiContext(request);
    requestId = context.requestId;

    if (!context.user?.id) {
      return apiSuccess(
        {
          publicKey,
          preferences: DEFAULT_PUSH_PREFERENCES,
          subscriptionsCount: 0,
        },
        { requestId, legacyCompat: true }
      );
    }

    const userId = context.user.id;
    const { preferences, subscriptionsCount } = await getPushStatus(userId);

    return apiSuccess(
      {
        publicKey,
        preferences,
        subscriptionsCount,
      },
      { requestId, legacyCompat: true }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}

/**
 * POST /api/notifications/push
 * Subscribes to push notifications or updates push preferences.
 */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    await assertRateLimit(authUser.id, "MUTATION");

    const body = await parseAndValidateJson(request, PushPostSchema);

    // 1. Handle preference updates
    if (body.preferences) {
      const updatedPrefs = await savePushPreferences(authUser.id, body.preferences);

      if (!body.endpoint) {
        return apiSuccess(
          {
            preferences: updatedPrefs,
          },
          { requestId, legacyCompat: true }
        );
      }
    }

    // 2. Handle push subscription registration
    const endpoint = body.endpoint;
    const p256dh = body.p256dh || body.keys?.p256dh;
    const auth = body.auth || body.keys?.auth;
    const deviceType = body.deviceType || body.platform || null;
    const userAgent = body.userAgent || request.headers.get("user-agent") || null;

    if (!endpoint || !p256dh || !auth) {
      throw new ValidationError("Missing required fields: endpoint, p256dh, and auth are required");
    }

    try {
      const parsedEndpoint = new URL(endpoint);
      if (parsedEndpoint.protocol !== "https:") {
        throw new ValidationError("Push endpoint must be a valid HTTPS URL");
      }
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError("Push endpoint must be a valid HTTPS URL");
    }

    const subscription = await upsertPushSubscription(authUser.id, {
      endpoint,
      p256dh,
      auth,
      deviceType,
      userAgent,
    });

    return apiSuccess(
      {
        subscriptionId: subscription.id,
      },
      { requestId, legacyCompat: true }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}

/**
 * DELETE /api/notifications/push
 * Deactivates or revokes a push subscription.
 */
export async function DELETE(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    await assertRateLimit(authUser.id, "MUTATION");

    const body = await parseAndValidateJson(request, PushDeleteSchema, { allowEmpty: true });

    const endpoint = body?.endpoint;
    await revokePushSubscriptions(authUser.id, endpoint);

    return apiSuccess(
      {
        message: "Push subscription revoked successfully",
      },
      { requestId, legacyCompat: true }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
