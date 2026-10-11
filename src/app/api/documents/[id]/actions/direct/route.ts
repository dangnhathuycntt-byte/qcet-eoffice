import { z } from "zod";
import { directDocument } from "@/lib/services/incoming-document-service";
import { documentActionRoute } from "../shared";

const DirectDocumentSchema = z
  .object({
    leadUnitId: z.string().trim().min(1, "leadUnitId là bắt buộc"),
    coordinatingUnitIds: z.array(z.string().trim()).optional().nullable(),
    leadershipInstruction: z.string().trim().max(5000).optional().nullable(),
    instruction: z.string().trim().max(5000).optional().nullable(),
    deadline: z.union([z.string().trim(), z.date()]).optional().nullable(),
    responsibilityAreaId: z.string().trim().max(64).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.leadershipInstruction && data.leadershipInstruction.trim().length > 0) ||
          (data.instruction && data.instruction.trim().length > 0)
      ),
    {
      message: "Ý kiến chỉ đạo / bút phê (leadershipInstruction hoặc instruction) là bắt buộc",
      path: ["leadershipInstruction"],
    }
  );

export const POST = documentActionRoute(
  DirectDocumentSchema,
  (user, body, { documentId, requestId }) =>
    directDocument(
      {
        documentId,
        leadUnitId: body.leadUnitId,
        coordinatingUnitIds: body.coordinatingUnitIds ?? undefined,
        leadershipInstruction: (body.leadershipInstruction || body.instruction)!,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        responsibilityAreaId: body.responsibilityAreaId ?? undefined,
        notes: body.notes ?? undefined,
      },
      user,
      requestId
    )
);
