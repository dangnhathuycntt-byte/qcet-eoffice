/**
 * Thiết lập riêng của Trợ lý cho từng người (ADR-012): hướng dẫn riêng, ghi nhớ, kỹ năng, bật bản tin sáng.
 * Mọi hàm nhận `userId` từ phiên; chỉ chủ nhân đọc, sửa được bản ghi của mình. Không ghi nội dung vào log hay audit.
 */
import type { AssistantMemory, AssistantSkill } from "@prisma/client";
import {
  ASSISTANT_MEMORIES_PER_USER,
  ASSISTANT_SKILLS_PER_USER,
  type AssistantMemoryDTO,
  type AssistantPreferencesDTO,
  type AssistantPreferencesUpdate,
  type AssistantSkillDTO,
  type AssistantSkillInput,
} from "@qcet/contracts/assistant";
import { prisma } from "@qcet/db/prisma";
import { ApiError, NotFoundError } from "@/server/api/errors";

export function toMemoryDTO(row: AssistantMemory): AssistantMemoryDTO {
  return { id: row.id, content: row.content, source: row.source === "assistant" ? "assistant" : "user", createdAt: row.createdAt.toISOString() };
}

export function toSkillDTO(row: AssistantSkill): AssistantSkillDTO {
  return { id: row.id, name: row.name, prompt: row.prompt, lastUsedAt: row.lastUsedAt?.toISOString() ?? null };
}

export async function getAssistantPreferences(userId: string): Promise<AssistantPreferencesDTO> {
  const row = await prisma.assistantPreference.findUnique({ where: { userId } });
  return { instructions: row?.instructions ?? "", briefingEnabled: row?.briefingEnabled ?? false };
}

export async function updateAssistantPreferences(userId: string, input: AssistantPreferencesUpdate): Promise<AssistantPreferencesDTO> {
  const data = {
    ...(input.instructions !== undefined ? { instructions: input.instructions.trim() } : {}),
    ...(input.briefingEnabled !== undefined ? { briefingEnabled: input.briefingEnabled } : {}),
  };
  const row = await prisma.assistantPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { instructions: row.instructions, briefingEnabled: row.briefingEnabled };
}

export async function listAssistantMemories(userId: string): Promise<AssistantMemoryDTO[]> {
  const rows = await prisma.assistantMemory.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return rows.map(toMemoryDTO);
}

/** Thêm ghi nhớ; đủ trần thì báo lỗi (người dùng xóa bớt), trùng nội dung thì trả mục đã có. */
export async function addAssistantMemory(userId: string, content: string, source: "user" | "assistant"): Promise<AssistantMemoryDTO> {
  const text = content.trim();
  return prisma.$transaction(async (tx) => {
    // Khóa theo người dùng để hai lần thêm song song không vượt trần
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const existing = await tx.assistantMemory.findFirst({ where: { userId, content: text } });
    if (existing) return toMemoryDTO(existing);
    const count = await tx.assistantMemory.count({ where: { userId } });
    if (count >= ASSISTANT_MEMORIES_PER_USER) {
      throw new ApiError(409, "MEMORY_LIMIT", `Đã có ${ASSISTANT_MEMORIES_PER_USER} ghi nhớ. Xóa bớt trong Cài đặt Trợ lý rồi thử lại.`);
    }
    return toMemoryDTO(await tx.assistantMemory.create({ data: { userId, content: text, source } }));
  });
}

export async function updateAssistantMemory(userId: string, id: string, content: string): Promise<AssistantMemoryDTO> {
  const { count } = await prisma.assistantMemory.updateMany({ where: { id, userId }, data: { content: content.trim() } });
  if (count === 0) throw new NotFoundError("Không tìm thấy ghi nhớ.");
  return toMemoryDTO(await prisma.assistantMemory.findUniqueOrThrow({ where: { id } }));
}

/** Xóa ghi nhớ của chính người gọi; trả false khi không có (đã xóa). */
export async function deleteAssistantMemory(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.assistantMemory.deleteMany({ where: { id, userId } });
  return count > 0;
}

export async function listAssistantSkills(userId: string): Promise<AssistantSkillDTO[]> {
  const rows = await prisma.assistantSkill.findMany({ where: { userId }, orderBy: [{ name: "asc" }] });
  return rows.map(toSkillDTO);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

const DUPLICATE_SKILL = new ApiError(409, "SKILL_NAME_TAKEN", "Đã có kỹ năng cùng tên. Đặt tên khác.");

export async function createAssistantSkill(userId: string, input: AssistantSkillInput): Promise<AssistantSkillDTO> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const count = await tx.assistantSkill.count({ where: { userId } });
      if (count >= ASSISTANT_SKILLS_PER_USER) {
        throw new ApiError(409, "SKILL_LIMIT", `Đã có ${ASSISTANT_SKILLS_PER_USER} kỹ năng. Xóa bớt rồi thử lại.`);
      }
      return toSkillDTO(await tx.assistantSkill.create({ data: { userId, name: input.name, prompt: input.prompt } }));
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw DUPLICATE_SKILL;
    throw error;
  }
}

export async function updateAssistantSkill(userId: string, id: string, input: AssistantSkillInput): Promise<AssistantSkillDTO> {
  try {
    const { count } = await prisma.assistantSkill.updateMany({ where: { id, userId }, data: { name: input.name, prompt: input.prompt } });
    if (count === 0) throw new NotFoundError("Không tìm thấy kỹ năng.");
  } catch (error) {
    if (isUniqueViolation(error)) throw DUPLICATE_SKILL;
    throw error;
  }
  return toSkillDTO(await prisma.assistantSkill.findUniqueOrThrow({ where: { id } }));
}

export async function deleteAssistantSkill(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.assistantSkill.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Ghi lần dùng kỹ năng (để xếp kỹ năng hay dùng lên đầu); không có thì bỏ qua. */
export async function touchAssistantSkill(userId: string, id: string, now: Date = new Date()): Promise<void> {
  await prisma.assistantSkill.updateMany({ where: { id, userId }, data: { lastUsedAt: now } });
}

/** Phần thiết lập đưa vào lời nhắc của mỗi lượt: hướng dẫn riêng và các ghi nhớ (cũ trước). */
export async function loadAssistantPromptProfile(userId: string): Promise<{ instructions: string; memories: string[] }> {
  const [preference, memories] = await Promise.all([
    prisma.assistantPreference.findUnique({ where: { userId }, select: { instructions: true } }),
    prisma.assistantMemory.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: ASSISTANT_MEMORIES_PER_USER,
      select: { content: true },
    }),
  ]);
  return { instructions: preference?.instructions ?? "", memories: memories.map((row) => row.content) };
}
