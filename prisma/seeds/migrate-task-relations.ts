import { PrismaClient, TaskActorRole, OrganizationalUnit } from "@prisma/client";

// Local fallback: AssigneeRole was removed from @prisma/client in Phase 9
const AssigneeRole = {
  PRIMARY_OWNER: 'PRIMARY_OWNER',
  COLLABORATOR: 'COLLABORATOR',
  SUPERVISOR: 'SUPERVISOR',
} as const;
type AssigneeRole = keyof typeof AssigneeRole;

export const DEPARTMENT_TO_ORG_UNIT_MAP: Record<string, string> = {
  // Đào tạo
  P_QLDT: "P_QLDT",
  "phong-dao-tao": "P_QLDT",
  DT_QLKH: "P_QLDT",

  // Tài chính kế toán
  P_TCKT: "P_TCKT",
  P_TC: "P_TCKT",
  "phong-tckt": "P_TCKT",
  KHTC: "P_TCKT",

  // Khảo thí & ĐBCL
  P_KT_DBCL: "P_KT_DBCL",
  P_TCDBCL: "P_KT_DBCL",

  // Công tác HSSV
  P_CTHSSV: "P_CTHSSV",
  "phong-cthssv": "P_CTHSSV",

  // Tổ chức Hành chính Quản trị
  P_TCHC_QT: "P_TCHC_QT",
  P_HCQT: "P_TCHC_QT",
  "phong-qctb": "P_TCHC_QT",
  TCHC: "P_TCHC_QT",

  // Tuyển sinh & Hợp tác việc làm
  TT_TS_HTVL: "TT_TS_HTVL",
  P_TSHTQT: "TT_TS_HTVL",
  "tt-tuyensinh": "TT_TS_HTVL",

  // Ngoại ngữ Tin học
  TT_NN_TH: "TT_NN_TH",
  TT_NNTH: "TT_NN_TH",

  // Khoa CNTT
  K_CNTT: "K_CNTT",
  "khoa-cntt": "K_CNTT",
  TT_STT: "K_CNTT",
  CNTT: "K_CNTT",

  // Khoa Điện - Điện tử
  K_DIEN_DTV: "K_DIEN_DTV",
  K_DIEN: "K_DIEN_DTV",
  "khoa-dien": "K_DIEN_DTV",

  // Khoa Cơ khí
  K_CK: "K_CK",
  "khoa-co-khi": "K_CK",
  K_CNOTO: "K_CK",
  "khoa-oto": "K_CK",
  "tt-laixe": "K_CK",

  // Khoa Kinh tế
  K_KT: "K_KT",
  K_KTQT: "K_KT",

  // Khoa Du lịch
  K_DL: "K_DL",
  K_DULICH: "K_DL",

  // Khoa Xây dựng
  K_XD: "K_XD",

  // Khoa Khoa học cơ bản
  K_KHCB: "K_KHCB",
  K_VHNT: "K_KHCB",
  K_DAICUONG: "K_KHCB",

  // Khoa May - Thời trang
  K_MAY_TT: "K_MAY_TT",

  // Khoa Nông lâm - Thủy sản
  K_NL_TS: "K_NL_TS",
  K_KTNN: "K_NL_TS",

  // Ban Giám hiệu / Đơn vị cấp Trường
  QCET: "QCET",
  BGH: "QCET",
  "ban-giam-hieu": "QCET",
};

export interface MigrationSummary {
  totalTasks: number;
  driCreatedOrUpdated: number;
  assignerCreated: number;
  leadUnitCreated: number;
  tasksUpdatedWithLeadUnit: number;
}

export interface MigrateTaskRelationsOptions {
  taskIds?: string[];
}

/**
 * Idempotent backfill script that reads existing Task records and creates TaskActors:
 * 1. For each task with assigneeId (or primary assignee), creates a TaskActor with role 'DRI', isPrimaryDRI: true.
 * 2. For each task with createdById, creates a TaskActor with role 'ASSIGNER'.
 * 3. For each task with departmentId, matches code against OrganizationalUnit and sets leadUnitId and TaskActor 'LEAD_UNIT'.
 */
export async function migrateTaskRelations(
  client?: PrismaClient,
  options?: MigrateTaskRelationsOptions
): Promise<MigrationSummary> {
  const prisma = client || new PrismaClient();

  console.log("--- Bắt đầu di chuyển quan hệ ReBAC Task (Phase 5.2 & 5.3) ---");

  // 1. Tải toàn bộ đơn vị tổ chức canonical
  const orgUnits = await prisma.organizationalUnit.findMany();
  const orgUnitByCode = new Map<string, OrganizationalUnit>();
  for (const u of orgUnits) {
    orgUnitByCode.set(u.code, u);
  }

  // 2. Tải tasks cùng quan hệ liên quan (có thể giới hạn qua options.taskIds)
  const tasks = await prisma.task.findMany({
    where: options?.taskIds ? { id: { in: options.taskIds } } : undefined,
    include: {
      assignees: true,
      actors: true,
    },
  });

  console.log(`Đang xử lý ${tasks.length} nhiệm vụ...`);

  let driCount = 0;
  let assignerCount = 0;
  let leadUnitCount = 0;
  let tasksUpdatedWithLeadUnit = 0;

  for (const task of tasks) {
    try {
      // ----------------------------------------------------
      // 1. DRI Actor: Identify assigneeId
      // ----------------------------------------------------
      const primaryAssignee =
        task.assignees
          .filter((a) => a.roleInTask === AssigneeRole.PRIMARY_OWNER)
          .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())[0] ??
        task.assignees[0];

      const assigneeId = (task as any).assigneeId ?? primaryAssignee?.userId;

      if (assigneeId) {
        const existingDRI = task.actors.find(
          (a) => a.role === TaskActorRole.DRI && a.userId === assigneeId
        );

        if (!existingDRI) {
          // Demote any existing non-matching primary DRI if present
          const otherExistingDRIs = task.actors.filter(
            (a) => a.role === TaskActorRole.DRI && a.userId !== assigneeId
          );
          for (const oldDri of otherExistingDRIs) {
            await prisma.taskActor.update({
              where: { id: oldDri.id },
              data: {
                role: TaskActorRole.COLLABORATOR,
                isPrimaryDRI: false,
              },
            });
          }

          // Upsert target user as primary DRI
          const existingActorForUser = task.actors.find(
            (a) => a.userId === assigneeId
          );

          if (existingActorForUser) {
            await prisma.taskActor.update({
              where: { id: existingActorForUser.id },
              data: {
                role: TaskActorRole.DRI,
                isPrimaryDRI: true,
                assignedById: task.createdById,
              },
            });
          } else {
            await prisma.taskActor.create({
              data: {
                taskId: task.id,
                userId: assigneeId,
                role: TaskActorRole.DRI,
                isPrimaryDRI: true,
                assignedById: task.createdById,
                appointedAt: task.createdAt,
              },
            });
          }
          driCount++;
        } else if (!existingDRI.isPrimaryDRI) {
          await prisma.taskActor.update({
            where: { id: existingDRI.id },
            data: { isPrimaryDRI: true },
          });
          driCount++;
        }
      }

      // ----------------------------------------------------
      // 2. ASSIGNER Actor: from createdById
      // ----------------------------------------------------
      if (task.createdById) {
        let hasAssigner = task.actors.some(
          (a) => a.role === TaskActorRole.ASSIGNER && a.userId === task.createdById
        );

        if (!hasAssigner) {
          const count = await prisma.taskActor.count({
            where: {
              taskId: task.id,
              userId: task.createdById,
              role: TaskActorRole.ASSIGNER,
            },
          });
          hasAssigner = count > 0;
        }

        if (!hasAssigner) {
          const userExists = await prisma.user.count({
            where: { id: task.createdById },
          });

          if (userExists > 0) {
            await prisma.taskActor.create({
              data: {
                taskId: task.id,
                userId: task.createdById,
                role: TaskActorRole.ASSIGNER,
                isPrimaryDRI: false,
                assignedById: task.createdById,
                appointedAt: task.createdAt,
              },
            });
            assignerCount++;
          }
        }
      }

      // ----------------------------------------------------
      // 3. LEAD_UNIT: from departmentId / leadUnitId
      // ----------------------------------------------------
      let targetOrgUnit: OrganizationalUnit | undefined;

      if (task.leadUnitId) {
        targetOrgUnit = orgUnits.find((u) => u.id === task.leadUnitId);
      } else if (task.departmentId) {
        const canonicalCode =
          DEPARTMENT_TO_ORG_UNIT_MAP[task.departmentId] ??
          DEPARTMENT_TO_ORG_UNIT_MAP[task.departmentId.toUpperCase()];

        if (canonicalCode && orgUnitByCode.has(canonicalCode)) {
          targetOrgUnit = orgUnitByCode.get(canonicalCode);
        } else {
          // Direct code or ID fallback match
          targetOrgUnit = orgUnits.find(
            (u) =>
              u.code.toLowerCase() === task.departmentId?.toLowerCase() ||
              u.id === task.departmentId
          );
        }

        if (targetOrgUnit) {
          await prisma.task.update({
            where: { id: task.id },
            data: { leadUnitId: targetOrgUnit.id },
          });
          tasksUpdatedWithLeadUnit++;
        }
      }

      if (targetOrgUnit) {
        const existingLeadUnitActor = task.actors.find(
          (a) =>
            a.role === TaskActorRole.LEAD_UNIT && a.unitId === targetOrgUnit?.id
        );

        if (!existingLeadUnitActor) {
          await prisma.taskActor.create({
            data: {
              taskId: task.id,
              unitId: targetOrgUnit.id,
              role: TaskActorRole.LEAD_UNIT,
              isPrimaryDRI: false,
              assignedById: task.createdById,
              appointedAt: task.createdAt,
            },
          });
          leadUnitCount++;
        }
      }
    } catch (err: any) {
      if (err?.code === "P2003" || err?.code === "P2025") {
        // Task or relation was concurrently deleted during migration scan; safely ignore
        continue;
      }
      throw err;
    }
  }

  const summary: MigrationSummary = {
    totalTasks: tasks.length,
    driCreatedOrUpdated: driCount,
    assignerCreated: assignerCount,
    leadUnitCreated: leadUnitCount,
    tasksUpdatedWithLeadUnit,
  };

  console.log("✓ Hoàn thành di chuyển quan hệ ReBAC Task:");
  console.log(`  - Tổng số nhiệm vụ đã quét: ${summary.totalTasks}`);
  console.log(`  - TaskActor vai trò DRI đã tạo/cập nhật: ${summary.driCreatedOrUpdated}`);
  console.log(`  - TaskActor vai trò ASSIGNER đã tạo: ${summary.assignerCreated}`);
  console.log(`  - TaskActor vai trò LEAD_UNIT đã tạo: ${summary.leadUnitCreated}`);
  console.log(`  - Nhiệm vụ đã cập nhật leadUnitId: ${summary.tasksUpdatedWithLeadUnit}`);

  return summary;
}

if (process.argv[1]?.includes("migrate-task-relations")) {
  const prisma = new PrismaClient();
  migrateTaskRelations(prisma)
    .catch((err) => {
      console.error("Lỗi khi chạy migrateTaskRelations:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
