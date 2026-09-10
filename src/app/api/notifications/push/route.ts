import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { getVapidPublicKey } from "@/lib/push-service";
import {
  DEFAULT_PUSH_PREFERENCES,
  type PushPreferences,
} from "@/lib/pwa/push-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/push
 * Returns VAPID public key and current user's push status & preferences.
 */
export async function GET(request: NextRequest) {
  try {
    const publicKey = getVapidPublicKey();
    const session = getSessionFromRequest(request);

    if (!session?.id) {
      return NextResponse.json({
        success: true,
        publicKey,
        preferences: DEFAULT_PUSH_PREFERENCES,
        subscriptionsCount: 0,
      });
    }

    const [user, activeSubsCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        select: { onboardingData: true },
      }),
      prisma.pushSubscription.count({
        where: {
          userId: session.id,
          status: "ACTIVE",
        },
      }),
    ]);

    const onboardingData = user?.onboardingData as Record<string, unknown> | null;
    const preferences: PushPreferences = {
      ...DEFAULT_PUSH_PREFERENCES,
      ...((onboardingData?.pushPreferences as Partial<PushPreferences>) || {}),
    };

    return NextResponse.json({
      success: true,
      publicKey,
      preferences,
      subscriptionsCount: activeSubsCount,
    });
  } catch (error) {
    console.error("Failed to GET push info:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/push
 * Subscribes to push notifications or updates push preferences.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(request);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 1. Handle preference updates
    if (body.preferences && typeof body.preferences === "object") {
      const existingUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { onboardingData: true },
      });

      const currentData =
        existingUser?.onboardingData &&
        typeof existingUser.onboardingData === "object" &&
        !Array.isArray(existingUser.onboardingData)
          ? (existingUser.onboardingData as Record<string, unknown>)
          : {};

      const updatedPrefs: PushPreferences = {
        taskAssigned: Boolean(body.preferences.taskAssigned ?? true),
        taskReview: Boolean(body.preferences.taskReview ?? true),
        deadlineReminder: Boolean(body.preferences.deadlineReminder ?? true),
        documentDirective: Boolean(body.preferences.documentDirective ?? true),
      };

      await prisma.user.update({
        where: { id: session.id },
        data: {
          onboardingData: {
            ...currentData,
            pushPreferences: updatedPrefs,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      if (!body.endpoint) {
        return NextResponse.json({
          success: true,
          preferences: updatedPrefs,
        });
      }
    }

    // 2. Handle push subscription registration
    const endpoint = body.endpoint;
    const p256dh = body.p256dh || body.keys?.p256dh;
    const auth = body.auth || body.keys?.auth;
    const deviceType = body.deviceType || body.platform || null;
    const userAgent = body.userAgent || request.headers.get("user-agent") || null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: endpoint, p256dh, and auth are required",
        },
        { status: 400 }
      );
    }

    try {
      const parsedEndpoint = new URL(endpoint);
      if (parsedEndpoint.protocol !== "https:") {
        return NextResponse.json(
          { success: false, error: "Push endpoint must be a valid HTTPS URL" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Push endpoint must be a valid HTTPS URL" },
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
        status: "ACTIVE",
        failureCount: 0,
        lastFailureCode: null,
        disabledAt: null,
        updatedAt: new Date(),
      },
      create: {
        userId: session.id,
        endpoint,
        p256dh,
        auth,
        deviceType: deviceType || null,
        userAgent: userAgent || null,
        status: "ACTIVE",
        failureCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("Failed to process POST push:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/push
 * Deactivates or revokes a push subscription.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const session = getSessionFromRequest(request);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const endpoint = body?.endpoint;
    if (endpoint) {
      await prisma.pushSubscription.updateMany({
        where: {
          endpoint,
          userId: session.id,
        },
        data: {
          status: "REVOKED",
          disabledAt: new Date(),
        },
      });
    } else {
      // Revoke all subscriptions for this user
      await prisma.pushSubscription.updateMany({
        where: {
          userId: session.id,
        },
        data: {
          status: "REVOKED",
          disabledAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription revoked successfully",
    });
  } catch (error) {
    console.error("Failed to delete push subscription:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
