import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { parseAndValidateJson } from "@/server/api/validation";
import { UpdateOnboardingSchema } from "@/contracts/users";
import { assertRateLimit } from "@/server/security/rate-limit";
import { assertCsrf } from "@/server/security/csrf";
import { apiError, apiSuccess } from "@/server/api/response";

export async function PATCH(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    // Assert CSRF via assertCsrf(req)
    assertCsrf(req);

    const context = await getApiContext(req);
    requestId = context.requestId;

    // Require authentication
    const authUser = requireAuthenticated(context);

    // Rate limiting: MUTATIONS_SENSITIVE
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    // Parse and validate body using UpdateOnboardingSchema
    const parsed = await parseAndValidateJson(req, UpdateOnboardingSchema);

    const current = await prisma.user.findUnique({
      where: { id: authUser.id },
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
    const incomingSteps = Array.isArray(parsed.completedSteps)
      ? parsed.completedSteps
      : [];
    const mergedSteps = Array.from(new Set([...currentSteps, ...incomingSteps]));

    const mergedData = {
      ...existingData,
      ...parsed,
      completedSteps: mergedSteps,
    };

    const REQUIRED_STEPS = ["step-profile", "step-push", "step-action", "step-search"];
    const isFinished = REQUIRED_STEPS.every((step) => mergedSteps.includes(step));

    const updated = await prisma.user.update({
      where: { id: authUser.id },
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

    return apiSuccess(
      { success: true, user: updated },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}

export async function DELETE(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    // Assert CSRF via assertCsrf(req)
    assertCsrf(req);

    const context = await getApiContext(req);
    requestId = context.requestId;

    // Require authentication
    const authUser = requireAuthenticated(context);

    // Rate limiting: MUTATIONS_SENSITIVE
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const updated = await prisma.user.update({
      where: { id: authUser.id },
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

    return apiSuccess(
      {
        success: true,
        user: updated,
        message: "Đã xoá trạng thái onboarding thành công",
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
