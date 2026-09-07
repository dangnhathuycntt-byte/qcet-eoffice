import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, getSessionFromRequest } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const updateOnboardingSchema = z.object({
  hasSeenWelcome: z.boolean().optional(),
  hasCompletedTour: z.boolean().optional(),
  completedSteps: z.array(z.string()).optional(),
  isDismissed: z.boolean().optional(),
  snoozedUntil: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const payload = getSessionFromRequest(req) || (() => {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      return token ? verifySessionToken(token) : null;
    })();

    if (!payload?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = updateOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { onboardingData: true },
    });

    const mergedData = {
      ...(typeof current?.onboardingData === "object" && current?.onboardingData !== null
        ? current.onboardingData
        : {}),
      ...parsed.data,
    };

    const isFinished = Array.isArray(mergedData.completedSteps) && mergedData.completedSteps.length >= 4;

    const updated = await prisma.user.update({
      where: { id: payload.id },
      data: {
        onboardingData: mergedData,
        onboardedAt: isFinished ? new Date() : undefined,
      },
      select: {
        id: true,
        onboardedAt: true,
        onboardingData: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Onboarding sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
