import { PrismaClient, UnitType, UnitStatus, AssignmentType, AssignmentStatus, JobCatalogGroup } from "@prisma/client";

export const DEPARTMENT_TO_ORG_UNIT_CODE_MAP: Record<string, string> = {
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

export interface DepartmentBackfillReport {
  totalLegacyDepartments: number;
  mappedToCanonicalUnits: number;
  newUnitsCreated: number;
  tasksUpdatedWithLeadUnit: number;
  usersAssignedPosition: number;
  paritySuccess: boolean;
  unmappedDepartments: string[];
}

export async function backfillDepartmentToUnits(
  client?: PrismaClient,
  options: { dryRun?: boolean } = {}
): Promise<DepartmentBackfillReport> {
  const prisma = client || new PrismaClient();
  const dryRun = !!options.dryRun;

  console.log(`[DataMigration:Department->Units] Bắt đầu backfill (${dryRun ? "DRY-RUN" : "EXECUTE"})...`);

  // 1. Tải tất cả các đơn vị hiện có trong OrganizationalUnit
  const existingUnits = await prisma.organizationalUnit.findMany();
  const unitByCode = new Map<string, typeof existingUnits[0]>();
  const unitById = new Map<string, typeof existingUnits[0]>();

  for (const u of existingUnits) {
    unitByCode.set(u.code.toUpperCase(), u);
    unitById.set(u.id, u);
  }

  // Lấy đơn vị ROOT QCET làm parent fallback
  const schoolRoot = unitByCode.get("QCET");

  // 2. Tải tất cả legacy departments
  const legacyDepartments = await prisma.department.findMany();
  console.log(`[DataMigration:Department->Units] Tìm thấy ${legacyDepartments.length} legacy departments.`);

  let mappedToCanonicalUnits = 0;
  let newUnitsCreated = 0;
  const deptIdToUnitId = new Map<string, string>();
  const unmappedDepts: string[] = [];

  for (const dept of legacyDepartments) {
    const deptKey = dept.id.trim();
    const mappedCode = DEPARTMENT_TO_ORG_UNIT_CODE_MAP[deptKey];

    let targetUnit = mappedCode ? unitByCode.get(mappedCode.toUpperCase()) : undefined;

    if (!targetUnit) {
      // Thử tìm theo mã trực tiếp dept.id
      targetUnit = unitByCode.get(deptKey.toUpperCase()) || unitById.get(deptKey);
    }

    if (targetUnit) {
      deptIdToUnitId.set(deptKey, targetUnit.id);
      mappedToCanonicalUnits++;
    } else {
      // Đơn vị chưa có trong V2 (ví dụ các phòng ban sinh ra trong test)
      // Tạo đơn vị tương ứng đảm bảo 100% data parity
      const isFaculty =
        deptKey.toUpperCase().startsWith("K_") ||
        dept.name.toLowerCase().includes("khoa");
      const isCenter =
        deptKey.toUpperCase().startsWith("TT_") ||
        dept.name.toLowerCase().includes("trung tâm");
      const unitType: UnitType = isFaculty
        ? UnitType.FACULTY
        : isCenter
        ? UnitType.CENTER
        : UnitType.DEPARTMENT;

      const codeToUse = deptKey.toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 50);

      if (!dryRun) {
        // Kiểm tra xem code đã tồn tại chưa để tránh va chạm unique
        let resolvedCode = codeToUse;
        let counter = 1;
        while (unitByCode.has(resolvedCode)) {
          resolvedCode = `${codeToUse}_${counter}`.slice(0, 50);
          counter++;
        }

        const createdUnit = await prisma.organizationalUnit.create({
          data: {
            code: resolvedCode,
            name: dept.name,
            type: unitType,
            status: UnitStatus.ACTIVE,
            parentId: schoolRoot?.id ?? null,
            effectiveFrom: dept.createdAt ?? new Date(),
          },
        });

        unitByCode.set(resolvedCode, createdUnit);
        unitById.set(createdUnit.id, createdUnit);
        deptIdToUnitId.set(deptKey, createdUnit.id);
      } else {
        deptIdToUnitId.set(deptKey, `dry-run-unit-${deptKey}`);
      }
      newUnitsCreated++;
    }
  }

  // 3. Backfill Tasks có departmentId mà chưa có leadUnitId
  const tasksToUpdate = await prisma.task.findMany({
    where: {
      departmentId: { not: null },
      leadUnitId: null,
    },
    select: { id: true, departmentId: true },
  });

  console.log(`[DataMigration:Department->Units] Tìm thấy ${tasksToUpdate.length} tasks cần cập nhật leadUnitId.`);
  let tasksUpdatedWithLeadUnit = 0;

  for (const task of tasksToUpdate) {
    if (!task.departmentId) continue;
    const targetUnitId = deptIdToUnitId.get(task.departmentId);
    if (targetUnitId) {
      if (!dryRun) {
        await prisma.task.update({
          where: { id: task.id },
          data: { leadUnitId: targetUnitId },
        });

        // Tạo thêm Actor LEAD_UNIT nếu chưa có
        const existingActor = await prisma.taskActor.findFirst({
          where: {
            taskId: task.id,
            unitId: targetUnitId,
            role: "LEAD_UNIT",
          },
        });
        if (!existingActor) {
          await prisma.taskActor.create({
            data: {
              taskId: task.id,
              unitId: targetUnitId,
              role: "LEAD_UNIT",
            },
          });
        }
      }
      tasksUpdatedWithLeadUnit++;
    } else {
      unmappedDepts.push(task.departmentId);
    }
  }

  // 4. Backfill Users có departmentId nhưng chưa có PositionAssignment
  const usersWithDeptNoAssignment = await prisma.user.findMany({
    where: {
      departmentId: { not: null },
      positionAssignments: {
        none: { status: AssignmentStatus.ACTIVE },
      },
    },
    select: { id: true, role: true, departmentId: true, title: true },
  });

  console.log(`[DataMigration:Department->Units] Tìm thấy ${usersWithDeptNoAssignment.length} users cần gắn PositionAssignment.`);
  let usersAssignedPosition = 0;

  if (usersWithDeptNoAssignment.length > 0) {
    // Đảm bảo có PositionDefinition mặc định cho từng nhóm
    let defaultStaffDef = await prisma.positionDefinition.findFirst({
      where: { code: "CAN_BO_CHUYEN_VIEN_CANONICAL" },
    });
    let defaultHeadDef = await prisma.positionDefinition.findFirst({
      where: { code: "TRUONG_DON_VI_CANONICAL" },
    });

    if (!defaultStaffDef && !dryRun) {
      defaultStaffDef = await prisma.positionDefinition.create({
        data: {
          code: "CAN_BO_CHUYEN_VIEN_CANONICAL",
          title: "Chuyên viên / Giảng viên chức năng",
          group: JobCatalogGroup.VCMN,
          minLevel: 1,
          isLeadership: false,
        },
      });
    }
    if (!defaultHeadDef && !dryRun) {
      defaultHeadDef = await prisma.positionDefinition.create({
        data: {
          code: "TRUONG_DON_VI_CANONICAL",
          title: "Trưởng đơn vị / Trưởng phòng / Trưởng khoa",
          group: JobCatalogGroup.LDPU,
          minLevel: 2,
          isLeadership: true,
        },
      });
    }

    for (const u of usersWithDeptNoAssignment) {
      if (!u.departmentId) continue;
      const targetUnitId = deptIdToUnitId.get(u.departmentId);
      if (!targetUnitId) continue;

      const roleStr = u.role as string;
      const isLeaderRole =
        roleStr === "TRUONG_PHONG" ||
        roleStr === "TRUONG_KHOA" ||
        roleStr === "HIEU_TRUONG" ||
        roleStr === "PHO_HIEU_TRUONG" ||
        roleStr === "ADMIN" ||
        roleStr === "BAN_GIAM_HIEU" ||
        (u.title && u.title.toLowerCase().includes("trưởng"));

      const chosenDef = isLeaderRole ? defaultHeadDef : defaultStaffDef;

      if (!dryRun && chosenDef) {
        await prisma.positionAssignment.create({
          data: {
            userId: u.id,
            unitId: targetUnitId,
            positionDefinitionId: chosenDef.id,
            type: AssignmentType.PRIMARY,
            status: AssignmentStatus.ACTIVE,
            effectiveFrom: new Date(),
          },
        });
      }
      usersAssignedPosition++;
    }
  }

  const report: DepartmentBackfillReport = {
    totalLegacyDepartments: legacyDepartments.length,
    mappedToCanonicalUnits,
    newUnitsCreated,
    tasksUpdatedWithLeadUnit,
    usersAssignedPosition,
    paritySuccess: unmappedDepts.length === 0,
    unmappedDepartments: Array.from(new Set(unmappedDepts)),
  };

  console.log("[DataMigration:Department->Units] Báo cáo kết quả:", JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.includes("backfill-department-to-units")) {
  const isDryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  backfillDepartmentToUnits(prisma, { dryRun: isDryRun })
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
