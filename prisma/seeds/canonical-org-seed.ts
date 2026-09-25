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
    code: 'TT_SO_TT',
    name: 'Trung tâm Số và Truyền thông',
    shortName: 'TT Số & Truyền thông',
    type: UnitType.CENTER,
    level: 1,
    displayOrder: 6,
    description: 'Chuyển đổi số, hạ tầng CNTT, an toàn thông tin và truyền thông theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'TT_NN_TH',
    name: 'Trung tâm Ngoại ngữ - Tin học',
    shortName: 'Trung tâm Ngoại ngữ - Tin học',
    type: UnitType.CENTER,
    level: 1,
    displayOrder: 7,
    description: 'Đào tạo, bồi dưỡng và sát hạch ngoại ngữ, tin học theo QĐ 282/QĐ-CĐKTCNQN',
  },
  {
    code: 'TT_TS_HTVL',
    name: 'Trung tâm Tuyển sinh & Hợp tác việc làm',
    shortName: 'Trung tâm Tuyển sinh & HTVL',
    type: UnitType.CENTER,
    level: 1,
    displayOrder: 8,
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

// ============================================================================
// DANH MỤC VỊ TRÍ VIỆC LÀM (POSITION DEFINITIONS) — NĐ 106/2020 & TT 12/2022
// ============================================================================
//
// Nguồn dữ liệu (không suy diễn):
// 1. `src/lib/dacum-definitions.ts#QCET_VTVL_ROLES` — danh mục VTVL pháp lý đã có
//    trong repo (Nghị định 106/2020/NĐ-CP Điều 4, Thông tư 12/2022/TT-BLĐTBXH).
// 2. Các mã vị trí mà tầng authorization thực sự tra cứu
//    (`document-policy.ts`, `document-classification.ts`, `user-directory-policy.ts`,
//    `dossier-policy.ts`): HIEU_TRUONG, PHO_HIEU_TRUONG, TRUONG_PHONG,
//    PHO_TRUONG_PHONG, TRUONG_KHOA, PHO_TRUONG_KHOA, GIAM_DOC_TRUNG_TAM,
//    PHO_GIAM_DOC_TRUNG_TAM, GIANG_VIEN, CHUYEN_VIEN, VAN_THU.
//
// Nhóm (`JobCatalogGroup`) lấy đúng định nghĩa trong `prisma/schema.prisma`:
//   LDPU = Lãnh đạo, quản lý (Điều 4 NĐ 106)
//   VCMN = Chức danh nghề nghiệp chuyên ngành (Giảng viên, Giáo viên GDNN)
//   VCDC = Chức danh nghề nghiệp chuyên môn dùng chung (Kế toán, CNTT, Hành chính)
//   HTPV = Vị trí việc làm hỗ trợ, phục vụ (Văn thư, Bảo vệ, Phục vụ xưởng)

export interface CanonicalPositionSeedData {
  code: string;
  title: string;
  group: 'LDPU' | 'VCMN' | 'VCDC' | 'HTPV';
  isLeadership: boolean;
  legalBasis: string;
}

export const CANONICAL_POSITION_DEFINITIONS: CanonicalPositionSeedData[] = [
  // --- Lãnh đạo, quản lý (LDPU) ---
  {
    code: 'HIEU_TRUONG',
    title: 'Hiệu trưởng',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1; Luật GDNN Điều 16',
  },
  {
    code: 'PHO_HIEU_TRUONG',
    title: 'Phó Hiệu trưởng',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1; Luật GDNN Điều 16',
  },
  {
    code: 'TRUONG_PHONG',
    title: 'Trưởng phòng / Trưởng đơn vị chức năng',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'PHO_TRUONG_PHONG',
    title: 'Phó Trưởng phòng / Phó Trưởng đơn vị chức năng',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    // Tương ứng `QCET_VTVL_ROLES[code=VTVL_TRUONG_KHOA]`
    code: 'TRUONG_KHOA',
    title: 'Trưởng khoa / Trưởng bộ môn trực thuộc',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    // Tương ứng `QCET_VTVL_ROLES[code=VTVL_PHO_TRUONG_KHOA]`
    code: 'PHO_TRUONG_KHOA',
    title: 'Phó Trưởng khoa phụ trách chuyên môn',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'GIAM_DOC_TRUNG_TAM',
    title: 'Giám đốc trung tâm',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'PHO_GIAM_DOC_TRUNG_TAM',
    title: 'Phó Giám đốc trung tâm',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'TRUONG_BO_MON',
    title: 'Trưởng bộ môn trực thuộc khoa',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1; Điều lệ trường Cao đẳng',
  },
  {
    code: 'PHO_TRUONG_BO_MON',
    title: 'Phó Trưởng bộ môn',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'TRUONG_XUONG',
    title: 'Trưởng xưởng thực hành',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'PHO_TRUONG_XUONG',
    title: 'Phó Trưởng xưởng thực hành',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1',
  },
  {
    code: 'KE_TOAN_TRUONG',
    title: 'Kế toán trưởng / Phụ trách kế toán',
    group: 'LDPU',
    isLeadership: true,
    legalBasis: 'Luật Kế toán 2015 Điều 53; Nghị định 106/2020/NĐ-CP',
  },

  // --- Chức danh nghề nghiệp chuyên ngành (VCMN) ---
  {
    code: 'GIANG_VIEN_CAO_CAP',
    title: 'Giảng viên cao cấp (Hạng I)',
    group: 'VCMN',
    isLeadership: false,
    legalBasis: 'Thông tư 10/2024/TT-BLĐTBXH; Thông tư 07/2023/TT-BLĐTBXH',
  },
  {
    code: 'GIANG_VIEN_CHINH',
    title: 'Giảng viên chính (Hạng II)',
    group: 'VCMN',
    isLeadership: false,
    legalBasis: 'Thông tư 10/2024/TT-BLĐTBXH; Thông tư 07/2023/TT-BLĐTBXH',
  },
  {
    // Tương ứng `QCET_VTVL_ROLES[code=VTVL_GV_CHUYEN_NGANH]`
    code: 'GIANG_VIEN',
    title: 'Giảng viên chuyên ngành (Hạng III)',
    group: 'VCMN',
    isLeadership: false,
    legalBasis: 'Thông tư 10/2024/TT-BLĐTBXH; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'GIANG_VIEN_THUC_HANH',
    title: 'Giảng viên thực hành',
    group: 'VCMN',
    isLeadership: false,
    legalBasis: 'Thông tư 10/2024/TT-BLĐTBXH; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'TRO_GIANG',
    title: 'Trợ giảng',
    group: 'VCMN',
    isLeadership: false,
    legalBasis: 'Thông tư 04/2024/TT-BGDĐT; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'GIAO_VIEN_CHU_NHIEM',
    title: 'Cố vấn học tập / Giáo viên chủ nhiệm',
    group: 'VCMN',
    isLeadership: false,
    legalBasis: 'Thông tư 15/2021/TT-BLĐTBXH; Điều lệ trường Cao đẳng',
  },

  // --- Chức danh nghề nghiệp chuyên môn dùng chung (VCDC) ---
  {
    code: 'CHUYEN_VIEN_CHINH',
    title: 'Chuyên viên chính',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH; Nghị định 106/2020/NĐ-CP',
  },
  {
    // Tương ứng `QCET_VTVL_ROLES[code=VTVL_CV_DAO_TAO]`
    code: 'CHUYEN_VIEN',
    title: 'Chuyên viên nghiệp vụ',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH; Nghị định 106/2020/NĐ-CP Điều 4',
  },
  {
    code: 'CHUYEN_VIEN_KHAO_THI',
    title: 'Chuyên viên khảo thí & đảm bảo chất lượng',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'CHUYEN_VIEN_PHAP_CHE',
    title: 'Chuyên viên pháp chế & thanh tra',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Nghị định 55/2011/NĐ-CP; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'CHUYEN_VIEN_TRUYEN_THONG',
    title: 'Chuyên viên truyền thông & sự kiện',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'CHUYEN_VIEN_QL_SINH_VIEN',
    title: 'Chuyên viên quản lý học sinh - sinh viên',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'KE_TOAN',
    title: 'Kế toán viên',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'NHAN_VIEN_CNTT',
    title: 'Nhân viên công nghệ thông tin',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'THU_VIEN_VIEN',
    title: 'Quản lý thư viện & học liệu số',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư 02/2022/TT-BVHTTDL; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'CAN_BO_Y_TE',
    title: 'Cán bộ y tế học đường',
    group: 'VCDC',
    isLeadership: false,
    legalBasis: 'Thông tư liên tịch 13/2016/TTLT-BYT-BGDĐT; Thông tư 12/2022/TT-BLĐTBXH',
  },

  // --- Vị trí việc làm hỗ trợ, phục vụ (HTPV) ---
  {
    code: 'VAN_THU',
    title: 'Văn thư',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Nghị định 30/2020/NĐ-CP; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    // Tương ứng `QCET_VTVL_ROLES[code=VTVL_KTV_PHONG_MAY]`
    code: 'KTV_PHONG_MAY',
    title: 'Kỹ thuật viên quản trị phòng thực hành',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'THU_QUY',
    title: 'Thủ quỹ cơ quan',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'THU_KHO',
    title: 'Thủ kho vật tư & thiết bị đào tạo',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'NHAN_VIEN_BAO_VE',
    title: 'Nhân viên bảo vệ cơ quan',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Nghị định 111/2022/NĐ-CP; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'NHAN_VIEN_LAI_XE',
    title: 'Nhân viên lái xe phục vụ công tác',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Nghị định 111/2022/NĐ-CP; Thông tư 12/2022/TT-BLĐTBXH',
  },
  {
    code: 'NHAN_VIEN_QUAN_TRI_KTX',
    title: 'Nhân viên quản lý ký túc xá',
    group: 'HTPV',
    isLeadership: false,
    legalBasis: 'Thông tư 12/2022/TT-BLĐTBXH',
  },
];

export interface SeedPositionsResult {
  definitionsCount: number;
  assignmentsCount: number;
  unresolvedUsers: string[];
}

/**
 * Gieo danh mục `PositionDefinition` (chuẩn tắc, không phụ thuộc dữ liệu người dùng).
 */
export async function seedCanonicalPositions(prisma: PrismaClient): Promise<number> {
  console.log('--- Bắt đầu gieo danh mục Vị trí việc làm (NĐ 106/2020 & TT 12/2022) ---');

  for (const position of CANONICAL_POSITION_DEFINITIONS) {
    await prisma.positionDefinition.upsert({
      where: { code: position.code },
      update: {
        title: position.title,
        group: position.group,
        isLeadership: position.isLeadership,
      },
      create: {
        code: position.code,
        title: position.title,
        group: position.group,
        isLeadership: position.isLeadership,
      },
    });
  }

  console.log(`--- Đã gieo ${CANONICAL_POSITION_DEFINITIONS.length} vị trí việc làm chuẩn tắc ---`);
  return CANONICAL_POSITION_DEFINITIONS.length;
}

/** Bỏ dấu tiếng Việt để so khớp chức danh với tên đơn vị. */
export function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/**
 * Suy ra mã vị trí việc làm từ chức danh + role hệ thống.
 * Thứ tự kiểm tra quan trọng: "Phó ..." phải xét trước để không khớp nhầm vào
 * vị trí trưởng tương ứng.
 *
 * Trả `null` khi chức danh không thuộc danh mục canonical — caller phải báo cáo
 * tường minh, không được gán bừa.
 */
export function resolvePositionCode(
  title: string | null | undefined,
  role: string | null | undefined
): string | null {
  const normalizedTitle = normalizeVietnamese(title || '');
  const normalizedRole = (role || '').toUpperCase();

  if (/pho hieu truong/.test(normalizedTitle)) return 'PHO_HIEU_TRUONG';
  if (/hieu truong/.test(normalizedTitle)) return 'HIEU_TRUONG';
  if (/pho truong khoa/.test(normalizedTitle)) return 'PHO_TRUONG_KHOA';
  if (/truong khoa/.test(normalizedTitle)) return 'TRUONG_KHOA';
  if (/pho giam doc/.test(normalizedTitle)) return 'PHO_GIAM_DOC_TRUNG_TAM';
  if (/giam doc/.test(normalizedTitle)) return 'GIAM_DOC_TRUNG_TAM';
  if (/pho truong bo mon/.test(normalizedTitle)) return 'PHO_TRUONG_BO_MON';
  if (/truong bo mon/.test(normalizedTitle)) return 'TRUONG_BO_MON';
  if (/pho truong xuong/.test(normalizedTitle)) return 'PHO_TRUONG_XUONG';
  if (/truong xuong/.test(normalizedTitle)) return 'TRUONG_XUONG';
  if (/ke toan truong/.test(normalizedTitle)) return 'KE_TOAN_TRUONG';
  if (/truong phong/.test(normalizedTitle)) return 'TRUONG_PHONG';
  if (/pho truong phong/.test(normalizedTitle)) return 'PHO_TRUONG_PHONG';
  if (/giang vien cao cap/.test(normalizedTitle)) return 'GIANG_VIEN_CAO_CAP';
  if (/giang vien chinh/.test(normalizedTitle)) return 'GIANG_VIEN_CHINH';
  if (/giang vien thuc hanh/.test(normalizedTitle)) return 'GIANG_VIEN_THUC_HANH';
  if (/giang vien/.test(normalizedTitle)) return 'GIANG_VIEN';
  if (/tro giang/.test(normalizedTitle)) return 'TRO_GIANG';
  if (/co van hoc tap|giao vien chu nhiem/.test(normalizedTitle)) return 'GIAO_VIEN_CHU_NHIEM';
  if (/chuyen vien chinh/.test(normalizedTitle)) return 'CHUYEN_VIEN_CHINH';
  if (/khao thi|dam bao chat luong/.test(normalizedTitle)) return 'CHUYEN_VIEN_KHAO_THI';
  if (/phap che|thanh tra/.test(normalizedTitle)) return 'CHUYEN_VIEN_PHAP_CHE';
  if (/truyen thong/.test(normalizedTitle)) return 'CHUYEN_VIEN_TRUYEN_THONG';
  if (/y te/.test(normalizedTitle)) return 'CAN_BO_Y_TE';
  if (/thu vien/.test(normalizedTitle)) return 'THU_VIEN_VIEN';
  if (/thu quy/.test(normalizedTitle)) return 'THU_QUY';
  if (/thu kho/.test(normalizedTitle)) return 'THU_KHO';
  if (/bao ve/.test(normalizedTitle)) return 'NHAN_VIEN_BAO_VE';
  if (/lai xe/.test(normalizedTitle)) return 'NHAN_VIEN_LAI_XE';
  if (/ky tuc xa/.test(normalizedTitle)) return 'NHAN_VIEN_QUAN_TRI_KTX';
  if (/ke toan/.test(normalizedTitle)) return 'KE_TOAN';
  if (/cntt|cong nghe thong tin|quan tri mang/.test(normalizedTitle)) return 'NHAN_VIEN_CNTT';
  if (/van thu/.test(normalizedTitle)) return 'VAN_THU';
  if (/chuyen vien/.test(normalizedTitle)) return 'CHUYEN_VIEN';
  // Tài khoản đại diện đơn vị đôi khi chỉ mang tên đơn vị làm chức danh
  // ("Phòng Quản lý Đào tạo") — role vẫn là trưởng đơn vị.
  if (normalizedRole === 'TRUONG_PHONG') return 'TRUONG_PHONG';
  if (normalizedRole === 'VAN_THU') return 'VAN_THU';
  if (normalizedRole === 'CHUYEN_VIEN') return 'CHUYEN_VIEN';
  // ADMIN là vai trò kỹ thuật, không thuộc danh mục VTVL — không gán bừa.
  return null;
}

/**
 * Khớp chức danh với một đơn vị canonical.
 *
 * Cách làm: bỏ cụm chức danh đứng trước ("Trưởng phòng", "Giảng viên", ...) để lấy
 * phần tên đơn vị, rồi so khớp với các "token đặc trưng" của tên đơn vị canonical.
 *
 * Quy tắc khớp dùng `endsWith` (không dùng `includes`/`startsWith`) vì tên đơn vị
 * tiếng Việt có phần đầu tố đứng cuối: dùng `includes` sẽ khiến chức danh
 * "Quản trị viên" bị khớp nhầm vào "Phòng Tổ chức Hành chính - Quản trị".
 *
 * Trả `null` khi không khớp, hoặc khi có nhiều đơn vị cùng điểm khớp (không đoán bừa).
 */
export function matchUnitCodeByTitle(
  title: string | null | undefined,
  units: Array<{ code: string; name: string }>
): string | null {
  const normalizedTitle = normalizeVietnamese(title || '');
  if (!normalizedTitle) return null;

  // Chỉ chức danh thuộc một trong hai dạng mới mang thông tin đơn vị:
  //  (a) bắt đầu bằng cụm chức danh: "Trưởng phòng ...", "Giảng viên ...";
  //  (b) bắt đầu bằng loại đơn vị: "Phòng ...", "Khoa ...", "Trung tâm ...".
  // Dạng khác ("Quản trị viên") mô tả một *người*, không phải một đơn vị — nếu vẫn
  // đem so khớp thì "Quản trị viên" sẽ khớp nhầm vào "... - Quản trị".
  const POSITION_PREFIX =
    /^(pho\s+)?(truong\s+(phong|khoa|trung tam|tt|bo mon)|giam doc\s+(tt|trung tam)|giang vien)\s+/;
  const UNIT_PREFIX = /^(phong|khoa|trung tam)\s+/;

  const hasPositionPrefix = POSITION_PREFIX.test(normalizedTitle);
  const hasUnitPrefix = UNIT_PREFIX.test(normalizedTitle);
  if (!hasPositionPrefix && !hasUnitPrefix) return null;

  const subject = normalizedTitle
    .replace(/\([^)]*\)/g, ' ')
    .replace(POSITION_PREFIX, '')
    .replace(UNIT_PREFIX, '')
    .trim();

  const haystack = subject.length >= 4 ? subject : normalizedTitle;

  const scored = units
    .map((unit) => {
      const tokens = normalizeVietnamese(unit.name)
        .replace(UNIT_PREFIX, '')
        .split(/[-–&]/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 4);
      const matches = tokens.filter(
        (token) => haystack === token || haystack.startsWith(token) || haystack.endsWith(token)
      ).length;
      return { code: unit.code, matches };
    })
    .filter((entry) => entry.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  if (scored.length === 0) return null;
  // Nhiều đơn vị cùng điểm khớp → không đủ căn cứ để chọn, báo cáo thay vì đoán.
  if (scored.length > 1 && scored[0].matches === scored[1].matches) return null;
  return scored[0].code;
}

/**
 * Gieo `PositionAssignment` cho người dùng mẫu: gắn mỗi người vào đơn vị canonical
 * của mình theo chức danh.
 *
 * Không suy diễn: nếu chức danh không khớp được với một đơn vị canonical nào, người
 * đó được **báo cáo tường minh** trong `unresolvedUsers` và bỏ qua — tuyệt đối không
 * gán bừa vào một đơn vị để seed "chạy cho xong".
 */
export async function seedCanonicalAssignments(
  prisma: PrismaClient,
  users: Array<{ id: string; name: string; role: string; title: string | null }>
): Promise<SeedPositionsResult> {
  const units = await prisma.organizationalUnit.findMany({
    select: { id: true, code: true, name: true },
  });
  const unitByCode = new Map(units.map((u) => [u.code, u]));
  const positionByCode = new Map(
    (await prisma.positionDefinition.findMany({ select: { id: true, code: true } })).map((p) => [
      p.code,
      p.id,
    ])
  );

  const unresolvedUsers: string[] = [];
  let assignmentsCount = 0;

  for (const user of users) {
    const positionCode = resolvePositionCode(user.title, user.role);

    if (!positionCode) {
      unresolvedUsers.push(`${user.name} <${user.title ?? 'không có chức danh'}>`);
      continue;
    }

    // Ban Giám hiệu thuộc đơn vị cấp Trường; các vị trí khác khớp theo tên đơn vị.
    const unitCode =
      positionCode === 'HIEU_TRUONG' || positionCode === 'PHO_HIEU_TRUONG'
        ? 'QCET'
        : positionCode === 'VAN_THU'
        ? 'P_TCHC_QT'
        : matchUnitCodeByTitle(user.title, units);

    if (!unitCode || !unitByCode.has(unitCode)) {
      unresolvedUsers.push(`${user.name} <${user.title ?? 'không có chức danh'}>`);
      continue;
    }

    const positionDefinitionId = positionByCode.get(positionCode);
    if (!positionDefinitionId) {
      unresolvedUsers.push(`${user.name} (thiếu PositionDefinition ${positionCode})`);
      continue;
    }

    const unit = unitByCode.get(unitCode)!;

    const existing = await prisma.positionAssignment.findFirst({
      where: { userId: user.id, positionDefinitionId, unitId: unit.id },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.positionAssignment.create({
      data: {
        userId: user.id,
        positionDefinitionId,
        unitId: unit.id,
        type: 'PRIMARY',
        status: 'ACTIVE',
        sourceDecisionNumber: '282/QĐ-CĐKTCNQN',
      },
    });
    assignmentsCount++;
  }

  if (unresolvedUsers.length > 0) {
    console.warn(
      `--- CẢNH BÁO: ${unresolvedUsers.length} người dùng chưa xác định được đơn vị canonical (bỏ qua, KHÔNG gán bừa):`
    );
    for (const entry of unresolvedUsers) {
      console.warn(`    - ${entry}`);
    }
  }

  console.log(
    `--- Đã gieo ${assignmentsCount} phân công vị trí việc làm; ${unresolvedUsers.length} chưa resolve được ---`
  );

  return {
    definitionsCount: CANONICAL_POSITION_DEFINITIONS.length,
    assignmentsCount,
    unresolvedUsers,
  };
}

export {
  seedMitacoPersonnel,
  MITACO_DEPT_TO_CANONICAL,
  KNOWN_PERSONNEL_OVERRIDE,
  FIXED_PERSONNEL_NAMES,
  generateBaseEmail,
  type MitacoRawPersonnel,
  type MitacoDeptMapping,
  type SeedMitacoResult,
} from './mitaco-personnel-seed';

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
