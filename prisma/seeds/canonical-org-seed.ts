import {
  PrismaClient,
  UnitType,
  UnitStatus,
  ResponsibilityCategory,
} from '@prisma/client';

export interface CanonicalUnitSeedData {
  code: string;
  name: string;
  shortName: string;
  type: UnitType;
  level: number;
  displayOrder: number;
  description?: string;
}

/**
 * Danh mục 16 đơn vị cấu thành chuẩn tắc của QCET theo Quyết định số 282/QĐ-CĐKTCNQN
 * Gồm: 05 Phòng chức năng, 02 Trung tâm và 09 Khoa đào tạo chuyên môn
 * Cùng Đơn vị cấp Trường (QCET Root)
 */
export const CANONICAL_SCHOOL_ROOT: CanonicalUnitSeedData = {
  code: 'QCET',
  name: 'Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn ',
  shortName: 'QCET',
  type: UnitType.SCHOOL,
  level: 0,
  displayOrder: 0,
  description: 'Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  - Cấp chỉ đạo toàn trường',
};

export const CANONICAL_FUNCTIONAL_DEPARTMENTS: CanonicalUnitSeedData[] = [
  {
    code: 'P_QLDT',
    name: 'Phòng Quản lý Đào tạo',
    shortName: 'Phòng QLĐT',
    type: UnitType.DEPARTMENT,
    level: 1,
    displayOrder: 1,
    description: 'Tham mưu và quản lý công tác đào tạo, học vụ, khảo thí theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'P_CTHSSV',
    name: 'Phòng Công tác Học sinh - Sinh viên',
    shortName: 'Phòng CTHSSV',
    type: UnitType.DEPARTMENT,
    level: 1,
    displayOrder: 2,
    description: 'Quản lý công tác học sinh sinh viên, rèn luyện, chế độ chính sách theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'P_TCHC_QT',
    name: 'Phòng Tổ chức Hành chính - Quản trị',
    shortName: 'Phòng TCHC-QT',
    type: UnitType.DEPARTMENT,
    level: 1,
    displayOrder: 3,
    description: 'Tham mưu công tác tổ chức cán bộ, hành chính, văn thư, quản trị cơ sở vật chất theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'P_TCKT',
    name: 'Phòng Tài chính - Kế toán',
    shortName: 'Phòng TCKT',
    type: UnitType.DEPARTMENT,
    level: 1,
    displayOrder: 4,
    description: 'Quản lý tài chính, ngân sách, kế toán, thanh quyết toán theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'P_KT_DBCL',
    name: 'Phòng Khảo thí & Đảm bảo chất lượng',
    shortName: 'Phòng KT&ĐBCL',
    type: UnitType.DEPARTMENT,
    level: 1,
    displayOrder: 5,
    description: 'Thực hiện khảo thí, kiểm định và đảm bảo chất lượng giáo dục nghề nghiệp theo QĐ 282/QĐ-CĐKTCNQN',
  },
];

export const CANONICAL_CENTERS: CanonicalUnitSeedData[] = [
  {
    code: 'TT_NN_TH',
    name: 'Trung tâm Ngoại ngữ - Tin học',
    shortName: 'Trung tâm Ngoại ngữ - Tin học',
    type: UnitType.CENTER,
    level: 1,
    displayOrder: 6,
    description: 'Đào tạo, bồi dưỡng và sát hạch ngoại ngữ, tin học theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'TT_TS_HTVL',
    name: 'Trung tâm Tuyển sinh & Hợp tác việc làm',
    shortName: 'Trung tâm Tuyển sinh & HTVL',
    type: UnitType.CENTER,
    level: 1,
    displayOrder: 7,
    description: 'Công tác tuyển sinh, tư vấn hướng nghiệp và hợp tác việc làm doanh nghiệp theo QĐ 282/QĐ-CĐKTCNQN',
  },
];

export const CANONICAL_FACULTIES: CanonicalUnitSeedData[] = [
  {
    code: 'K_CNTT',
    name: 'Khoa Công nghệ thông tin',
    shortName: 'Khoa CNTT',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 8,
    description: 'Đào tạo chuyên ngành Công nghệ thông tin, Phần mềm, Mạng máy tính theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_DIEN_DTV',
    name: 'Khoa Điện - Điện tử',
    shortName: 'Khoa Điện - Điện tử',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 9,
    description: 'Đào tạo chuyên ngành Kỹ thuật Điện, Điện tử, Tự động hóa theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_CK',
    name: 'Khoa Cơ khí',
    shortName: 'Khoa Cơ khí',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 10,
    description: 'Đào tạo ngành Cơ khí chế tạo, Hàn, Cắt gọt kim loại theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_KT',
    name: 'Khoa Kinh tế',
    shortName: 'Khoa Kinh tế',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 11,
    description: 'Đào tạo chuyên ngành Kế toán, Tài chính, Quản trị doanh nghiệp theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_DL',
    name: 'Khoa Du lịch',
    shortName: 'Khoa Du lịch',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 12,
    description: 'Đào tạo nghiệp vụ Hướng dẫn du lịch, Quản trị khách sạn, Nhà hàng theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_XD',
    name: 'Khoa Xây dựng',
    shortName: 'Khoa Xây dựng',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 13,
    description: 'Đào tạo kỹ thuật Xây dựng dân dụng và công nghiệp theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_KHCB',
    name: 'Khoa Khoa học cơ bản',
    shortName: 'Khoa Khoa học cơ bản',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 14,
    description: 'Giảng dạy các môn chung, Khoa học đại cương và văn hóa THPT theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_MAY_TT',
    name: 'Khoa May - Thời trang',
    shortName: 'Khoa May - Thời trang',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 15,
    description: 'Đào tạo May thời trang và Thiết kế thời trang công nghiệp theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'K_NL_TS',
    name: 'Khoa Nông lâm - Thủy sản',
    shortName: 'Khoa Nông lâm - Thủy sản',
    type: UnitType.FACULTY,
    level: 1,
    displayOrder: 16,
    description: 'Đào tạo Nông nghiệp công nghệ cao, Lâm nghiệp và Nuôi trồng thủy sản theo QĐ 282/QĐ-CĐKTCNQN',
  },
];

export const CANONICAL_16_UNITS: CanonicalUnitSeedData[] = [
  ...CANONICAL_FUNCTIONAL_DEPARTMENTS,
  ...CANONICAL_CENTERS,
  ...CANONICAL_FACULTIES,
];

export interface CanonicalResponsibilityAreaData {
  code: string;
  name: string;
  description: string;
  category: ResponsibilityCategory;
}

/**
 * 11 Mảng trách nhiệm chuẩn tắc của Ban Giám hiệu theo Quyết định số 420/QĐ-CĐKTCNQN
 */
export const CANONICAL_RESPONSIBILITY_AREAS: CanonicalResponsibilityAreaData[] = [
  {
    code: 'FINANCE',
    name: 'Tài chính & Ngân sách',
    description: 'Dự toán, thu chi, tài khoản, thanh quyết toán, chế độ chính sách viên chức theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.EXECUTIVE,
  },
  {
    code: 'HR',
    name: 'Tổ chức & Cán bộ',
    description: 'Bổ nhiệm, điều động, tuyển dụng, kỷ luật, quy hoạch, vị trí việc làm theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.EXECUTIVE,
  },
  {
    code: 'QUALITY_ASSURANCE',
    name: 'Khảo thí & Đảm bảo chất lượng',
    description: 'Kiểm định chất lượng trường/chương trình, thanh tra nội bộ, khảo sát ý kiến theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.ACADEMIC,
  },
  {
    code: 'TRAINING',
    name: 'Đào tạo & Học vụ',
    description: 'Chương trình đào tạo, lịch giảng dạy, thi tốt nghiệp, cấp phát văn bằng theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.ACADEMIC,
  },
  {
    code: 'STUDENT_AFFAIRS',
    name: 'Công tác Học sinh - Sinh viên',
    description: 'Chế độ chính sách HSSV, rèn luyện, khen thưởng HSSV, ký túc xá, an ninh trật tự theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.OPERATIONAL,
  },
  {
    code: 'DIGITAL_TRANSFORMATION',
    name: 'Chuyển đổi số & CNTT',
    description: 'Hệ điều hành E-Office, hạ tầng mạng, bảo mật, ứng dụng AI, Cổng thông tin theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.OPERATIONAL,
  },
  {
    code: 'ADMINISTRATION',
    name: 'Hành chính & Văn thư',
    description: 'Tiếp nhận văn bản, phát hành văn bản, lưu trữ hồ sơ, quản lý con dấu, xe cơ quan theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.OPERATIONAL,
  },
  {
    code: 'FACILITIES',
    name: 'Cơ sở vật chất & Tài sản',
    description: 'Mua sắm thường xuyên, quản trị đất đai, bảo dưỡng thiết bị, an toàn lao động, PCCC theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.OPERATIONAL,
  },
  {
    code: 'ADMISSIONS',
    name: 'Tuyển sinh & Hướng nghiệp',
    description: 'Kế hoạch tuyển sinh các hệ, truyền thông tư vấn hướng nghiệp, chỉ tiêu tuyển sinh theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.OPERATIONAL,
  },
  {
    code: 'INTERNATIONAL_RELATIONS',
    name: 'Hợp tác quốc tế & Đối ngoại',
    description: 'Dự án hợp tác nước ngoài, trao đổi giảng viên/chuyên gia, kết nối doanh nghiệp FDI theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.OPERATIONAL,
  },
  {
    code: 'RESEARCH',
    name: 'Nghiên cứu khoa học & Đổi mới sáng tạo',
    description: 'Đề tài nghiên cứu các cấp, sáng kiến cải tiến kỹ thuật, phong trào tự làm thiết bị theo QĐ 420/QĐ-CĐKTCNQN',
    category: ResponsibilityCategory.ACADEMIC,
  },
];

export async function seedCanonicalOrg(prisma: PrismaClient) {
  console.log('--- Bắt đầu gieo hạt Cơ cấu Tổ chức chuẩn tắc QCET (QĐ 282 & QĐ 420) ---');

  // 1. Tạo Đơn vị cấp Trường (Root School Unit)
  const schoolRoot = await prisma.organizationalUnit.upsert({
    where: { code: CANONICAL_SCHOOL_ROOT.code },
    update: {
      name: CANONICAL_SCHOOL_ROOT.name,
      type: CANONICAL_SCHOOL_ROOT.type,
      status: UnitStatus.ACTIVE,
      effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      metadata: {
        shortName: CANONICAL_SCHOOL_ROOT.shortName,
        level: CANONICAL_SCHOOL_ROOT.level,
        displayOrder: CANONICAL_SCHOOL_ROOT.displayOrder,
        description: CANONICAL_SCHOOL_ROOT.description,
        legalDocumentRef: '282/QĐ-CĐKTCNQN',
      },
    },
    create: {
      code: CANONICAL_SCHOOL_ROOT.code,
      name: CANONICAL_SCHOOL_ROOT.name,
      type: CANONICAL_SCHOOL_ROOT.type,
      status: UnitStatus.ACTIVE,
      effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      metadata: {
        shortName: CANONICAL_SCHOOL_ROOT.shortName,
        level: CANONICAL_SCHOOL_ROOT.level,
        displayOrder: CANONICAL_SCHOOL_ROOT.displayOrder,
        description: CANONICAL_SCHOOL_ROOT.description,
        legalDocumentRef: '282/QĐ-CĐKTCNQN',
      },
    },
  });

  // 2. Tạo đường dẫn đóng (Closure path) cho Root Unit (tự thân)
  await prisma.unitClosurePath.upsert({
    where: {
      ancestorId_descendantId: {
        ancestorId: schoolRoot.id,
        descendantId: schoolRoot.id,
      },
    },
    update: { depth: 0 },
    create: {
      ancestorId: schoolRoot.id,
      descendantId: schoolRoot.id,
      depth: 0,
    },
  });

  // 3. Tạo 16 đơn vị trực thuộc (05 Phòng, 02 Trung tâm, 09 Khoa)
  const createdUnits = [];
  for (const unit of CANONICAL_16_UNITS) {
    const orgUnit = await prisma.organizationalUnit.upsert({
      where: { code: unit.code },
      update: {
        name: unit.name,
        type: unit.type,
        parentId: schoolRoot.id,
        status: UnitStatus.ACTIVE,
        effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
        metadata: {
          shortName: unit.shortName,
          level: unit.level,
          displayOrder: unit.displayOrder,
          description: unit.description,
          legalDocumentRef: '282/QĐ-CĐKTCNQN',
        },
      },
      create: {
        code: unit.code,
        name: unit.name,
        type: unit.type,
        parentId: schoolRoot.id,
        status: UnitStatus.ACTIVE,
        effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
        metadata: {
          shortName: unit.shortName,
          level: unit.level,
          displayOrder: unit.displayOrder,
          description: unit.description,
          legalDocumentRef: '282/QĐ-CĐKTCNQN',
        },
      },
    });

    // 4. Tạo đường dẫn đóng (Closure Path): tự thân (depth 0) và từ Trường (depth 1)
    await prisma.unitClosurePath.upsert({
      where: {
        ancestorId_descendantId: {
          ancestorId: orgUnit.id,
          descendantId: orgUnit.id,
        },
      },
      update: { depth: 0 },
      create: {
        ancestorId: orgUnit.id,
        descendantId: orgUnit.id,
        depth: 0,
      },
    });

    await prisma.unitClosurePath.upsert({
      where: {
        ancestorId_descendantId: {
          ancestorId: schoolRoot.id,
          descendantId: orgUnit.id,
        },
      },
      update: { depth: 1 },
      create: {
        ancestorId: schoolRoot.id,
        descendantId: orgUnit.id,
        depth: 1,
      },
    });

    createdUnits.push(orgUnit);
  }

  // 5. Gieo hạt 11 Mảng trách nhiệm chuẩn tắc theo QĐ 420/QĐ-CĐKTCNQN
  const createdResponsibilityAreas = [];
  for (const area of CANONICAL_RESPONSIBILITY_AREAS) {
    const respArea = await prisma.responsibilityArea.upsert({
      where: { code: area.code },
      update: {
        name: area.name,
        description: area.description,
        category: area.category,
      },
      create: {
        code: area.code,
        name: area.name,
        description: area.description,
        category: area.category,
      },
    });
    createdResponsibilityAreas.push(respArea);
  }

  console.log(`✓ Đã thiết lập thành công:`);
  console.log(`  - 01 Đơn vị cấp Trường (${schoolRoot.name})`);
  console.log(`  - 16 Đơn vị cấu thành (05 Phòng, 02 Trung tâm, 09 Khoa)`);
  console.log(`  - ${createdResponsibilityAreas.length} Mảng trách nhiệm BGH theo QĐ 420/QĐ-CĐKTCNQN`);

  return {
    schoolRoot,
    unitsCount: createdUnits.length,
    units: createdUnits,
    responsibilityAreasCount: createdResponsibilityAreas.length,
    responsibilityAreas: createdResponsibilityAreas,
  };
}

// Cho phép chạy trực tiếp qua `npx tsx prisma/seeds/canonical-org-seed.ts`
if (process.argv[1]?.includes('canonical-org-seed')) {
  const prisma = new PrismaClient();
  seedCanonicalOrg(prisma)
    .catch((e) => {
      console.error('Lỗi khởi tạo canonical-org-seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
