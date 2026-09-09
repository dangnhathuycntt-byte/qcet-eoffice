import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, getSessionFromRequest } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { updateOnboardingSchema } from "@/lib/onboarding-schema";

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
      select: { onboardingData: true, onboardedAt: true },
    });

    const existingData =
      current?.onboardingData &&
      typeof current.onboardingData === "object" &&
      !Array.isArray(current.onboardingData)
        ? (current.onboardingData as Record<string, unknown>)
        : {};

    const currentSteps = Array.isArray(existingData.completedSteps)
      ? (existingData.completedSteps as string[])
      : [];
    const incomingSteps = Array.isArray(parsed.data.completedSteps)
      ? parsed.data.completedSteps
      : [];
    const mergedSteps = Array.from(new Set([...currentSteps, ...incomingSteps]));

    const mergedData = {
      ...existingData,
      ...parsed.data,
      completedSteps: mergedSteps,
    };

    const REQUIRED_STEPS = ["step-profile", "step-push", "step-action", "step-search"];
    const isFinished = REQUIRED_STEPS.every((step) => mergedSteps.includes(step));

    const updated = await prisma.user.update({
      where: { id: payload.id },
      data: {
        onboardingData: mergedData,
        onboardedAt: isFinished ? (current?.onboardedAt || new Date()) : undefined,
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

export async function DELETE(req: NextRequest) {
  try {
    const payload = getSessionFromRequest(req) || (() => {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      return token ? verifySessionToken(token) : null;
    })();

    if (!payload?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const updated = await prisma.user.update({
      where: { id: payload.id },
      data: {
        onboardedAt: null,
        onboardingData: Prisma.DbNull,
      },
      select: {
        id: true,
        onboardedAt: true,
        onboardingData: true,
      },
    });

    return NextResponse.json({ success: true, user: updated, message: "Đã xoá trạng thái onboarding thành công" });
  } catch (error) {
    console.error("Onboarding delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

