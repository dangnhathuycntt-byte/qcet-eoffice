/**
 * Người duyệt nội dung dự thảo văn bản đi mà người soạn chọn được khi trình: trưởng đơn vị soạn (mặc định) và lãnh đạo
 * trường. Cùng tập với `assertContentReviewScope` (trưởng/phó đơn vị soạn hoặc lãnh đạo) trừ cấp phó đơn vị, vì cấp phó
 * chỉ duyệt khi có ủy quyền nên không phải người duyệt mặc định. Người soạn không tự duyệt nên không có trong danh sách.
 */
import { prisma } from "@qcet/db/prisma";
import type { OutgoingReviewer } from "@qcet/contracts/types/document";
import { isExecutivePosition, isUnitLeaderPosition } from "@/server/authorization/authorization-engine";

export async function listContentReviewers(
  draftingUnitId: string | null,
  drafterId: string
): Promise<OutgoingReviewer[]> {
  const rows = await prisma.positionAssignment.findMany({
    where: {
      status: "ACTIVE",
      userId: { not: drafterId },
      user: { isActive: true },
      OR: [
        ...(draftingUnitId ? [{ unitId: draftingUnitId }] : []),
        { positionDefinition: { code: { in: ["HIEU_TRUONG", "PHO_HIEU_TRUONG"] } } },
      ],
    },
    orderBy: [{ type: "asc" }, { effectiveFrom: "asc" }],
    select: {
      userId: true,
      unitId: true,
      user: { select: { name: true } },
      positionDefinition: { select: { code: true, title: true } },
      unit: { select: { name: true } },
    },
  });

  const reviewers = new Map<string, OutgoingReviewer & { rank: number }>();
  for (const row of rows) {
    const code = row.positionDefinition.code;
    const unitLeader = row.unitId === draftingUnitId && isUnitLeaderPosition(code);
    if (!unitLeader && !isExecutivePosition(code)) continue;
    // Người kiêm nhiệm giữ một dòng, ưu tiên chức danh ở đơn vị soạn
    const rank = unitLeader ? 0 : 1;
    const existing = reviewers.get(row.userId);
    if (existing && existing.rank <= rank) continue;
    reviewers.set(row.userId, {
      id: row.userId,
      name: row.user.name,
      // Tên chức danh trong danh mục có thể ghi gộp "Trưởng phòng / Trưởng đơn vị chức năng": lấy phần đầu cho gọn
      title: `${row.positionDefinition.title.split(" / ")[0]}, ${row.unit.name}`,
      recommended: false,
      rank,
    });
  }

  const sorted = [...reviewers.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "vi"));
  const first = sorted[0];
  return sorted.map(({ rank, ...reviewer }) => ({ ...reviewer, recommended: rank === 0 && reviewer.id === first?.id }));
}
