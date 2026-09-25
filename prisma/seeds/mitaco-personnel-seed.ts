import { PrismaClient, UserRole, AssignmentType, AssignmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export interface MitacoRawPersonnel {
  MaNhanVien: string;
  TenNhanVien: string;
  MaChamCong: number;
  TenChamCong: string;
  MaPhongBan: string | null;
  TenPhongBan: string | null;
  ChucVu: string;
  GioiTinh: boolean;
  NgaySinh: string;
  DienThoaiLienHe: string;
  Email: string;
  TrinhDo: string | null;
  GhiChu: string | null;
}

export interface MitacoDeptMapping {
  unitCode: string;
  role: UserRole;
  defaultPositionCode: string;
}

/**
 * Bảng ánh xạ 16 mã phòng ban thực tế từ MITACOSQL sang 16 đơn vị cấu thành chuẩn tắc (QĐ 282/QĐ-CĐKTCNQN)
 */
export const MITACO_DEPT_TO_CANONICAL: Record<string, MitacoDeptMapping> = {
  PB00016: { unitCode: 'QCET', role: UserRole.BAN_GIAM_HIEU, defaultPositionCode: 'PHO_HIEU_TRUONG' },
  PB00004: { unitCode: 'P_QLDT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'CHUYEN_VIEN' },
  PB00002: { unitCode: 'P_TCKT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'KE_TOAN' },
  PB00003: { unitCode: 'P_TCHC_QT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'CHUYEN_VIEN' },
  PB00001: { unitCode: 'P_KT_DBCL', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'CHUYEN_VIEN_KHAO_THI' },
  PB00005: { unitCode: 'TT_TS_HTVL', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'CHUYEN_VIEN' },
  PB00006: { unitCode: 'TT_SO_TT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'NHAN_VIEN_CNTT' },
  PB00007: { unitCode: 'K_CK', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00008: { unitCode: 'K_CK', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00009: { unitCode: 'K_KHCB', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00010: { unitCode: 'K_DIEN_DTV', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00011: { unitCode: 'K_CNTT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00012: { unitCode: 'K_DL', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00013: { unitCode: 'K_KT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00014: { unitCode: 'K_NL_TS', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  PB00015: { unitCode: 'K_KHCB', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'GIANG_VIEN' },
  null: { unitCode: 'P_TCHC_QT', role: UserRole.CHUYEN_VIEN, defaultPositionCode: 'CHUYEN_VIEN' },
};

/**
 * Danh sách cán bộ chủ chốt có chức danh / email được chỉ định riêng biệt
 */
export const KNOWN_PERSONNEL_OVERRIDE: Record<
  string,
  {
    role: UserRole;
    positionCode: string;
    unitCode: string;
    title: string;
    email?: string;
  }
> = {
  // Trung tâm Số & Truyền thông / Quản trị hệ thống
  '00258': {
    role: UserRole.ADMIN,
    positionCode: 'NHAN_VIEN_CNTT',
    unitCode: 'TT_SO_TT',
    title: 'Chuyên viên chuyển đổi số',
    email: 'dangnhathuy@cdktcnqn.edu.vn',
  },
  '00009': {
    role: UserRole.TRUONG_PHONG,
    positionCode: 'GIAM_DOC_TRUNG_TAM',
    unitCode: 'TT_SO_TT',
    title: 'Phó Giám đốc phụ trách TT Số - Truyền thông',
    email: 'vinhnn@cdktcnqn.edu.vn',
  },
  '00080': {
    role: UserRole.CHUYEN_VIEN,
    positionCode: 'PHO_GIAM_DOC_TRUNG_TAM',
    unitCode: 'TT_SO_TT',
    title: 'Phó Giám đốc TT Số - Truyền thông',
    email: 'xuanmdt@cdktcnqn.edu.vn',
  },
  // Ban Giám hiệu
  '00081': {
    role: UserRole.BAN_GIAM_HIEU,
    positionCode: 'HIEU_TRUONG',
    unitCode: 'QCET',
    title: 'Hiệu trưởng',
    email: 'tuongpv@cdktcnqn.edu.vn',
  },
  '00082': {
    role: UserRole.BAN_GIAM_HIEU,
    positionCode: 'PHO_HIEU_TRUONG',
    unitCode: 'QCET',
    title: 'Phó Hiệu trưởng (HC & CSVC)',
    email: 'nguyenlx@cdktcnqn.edu.vn',
  },
  '00083': {
    role: UserRole.BAN_GIAM_HIEU,
    positionCode: 'PHO_HIEU_TRUONG',
    unitCode: 'QCET',
    title: 'Phó Hiệu trưởng (Đào tạo & NCKH)',
    email: 'kiemtt@cdktcnqn.edu.vn',
  },
  // Lãnh đạo Phòng / Ban / Trung tâm
  '00003': {
    role: UserRole.TRUONG_PHONG,
    positionCode: 'TRUONG_PHONG',
    unitCode: 'P_QLDT',
    title: 'Trưởng phòng Quản lý Đào tạo',
    email: 'levanthi@cdktcnqn.edu.vn',
  },
  '00105': {
    role: UserRole.TRUONG_PHONG,
    positionCode: 'TRUONG_PHONG',
    unitCode: 'P_TCKT',
    title: 'Trưởng phòng Tài chính - Kế toán',
    email: 'lephuongthuyoanh@cdktcnqn.edu.vn',
  },
  '00072': {
    role: UserRole.TRUONG_PHONG,
    positionCode: 'TRUONG_PHONG',
    unitCode: 'P_KT_DBCL',
    title: 'Trưởng phòng Khảo thí & Đảm bảo chất lượng',
    email: 'phongnt@cdktcnqn.edu.vn',
  },
  '00048': {
    role: UserRole.TRUONG_PHONG,
    positionCode: 'GIAM_DOC_TRUNG_TAM',
    unitCode: 'TT_TS_HTVL',
    title: 'Giám đốc Trung tâm Tuyển sinh & Hợp tác việc làm',
    email: 'vynq@cdktcnqn.edu.vn',
  },
  '00116': {
    role: UserRole.TRUONG_PHONG,
    positionCode: 'TRUONG_KHOA',
    unitCode: 'K_DIEN_DTV',
    title: 'Trưởng khoa Điện - Điện tử',
    email: 'thangnv@cdktcnqn.edu.vn',
  },
};

/**
 * Khắc phục lỗi encoding ký tự hỏi chấm '?' trong tên tiếng Việt
 */
export const FIXED_PERSONNEL_NAMES: Record<string, string> = {
  '00027': 'Mai Xuân Lực',
  '00037': 'Nguyễn Văn Tiến',
  '00040': 'Hoàng Bảo Khanh',
  '00049': 'Lê Thanh Nhật',
  '00051': 'Nguyễn Thị Xuân Hà',
  '00079': 'Cán bộ dự phòng 079',
};

/**
 * Bỏ dấu tiếng Việt phục vụ tạo email chuẩn tắc
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
}

/**
 * Sinh email cơ bản theo quy chuẩn [tên][chữ cái đầu họ và tên đệm]
 */
export function generateBaseEmail(fullName: string): string {
  const clean = removeVietnameseTones(fullName);
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'user';
  if (parts.length === 1) return parts[0].toLowerCase();
  const lastName = parts[parts.length - 1].toLowerCase();
  const initials = parts
    .slice(0, -1)
    .map((p) => p[0].toLowerCase())
    .join('');
  return `${lastName}${initials}`;
}

export interface SeedMitacoResult {
  totalRecords: number;
  usersCreatedOrUpdated: number;
  assignmentsCreatedOrUpdated: number;
  unresolvedUnits: string[];
}

/**
 * Gieo dữ liệu 258 nhân sự thực tế từ MITACOSQL vào hệ thống
 */
export async function seedMitacoPersonnel(
  prisma: PrismaClient,
  options?: {
    rawPersonnelPath?: string;
    defaultPasswordHash?: string;
    preservedEmails?: Set<string>;
  }
): Promise<SeedMitacoResult> {
  console.log('--- Bắt đầu gieo hạt 258 Nhân sự thực tế từ MITACOSQL ---');

  const jsonPath =
    options?.rawPersonnelPath ||
    path.join(process.cwd(), 'prisma', 'seeds', 'extracted_personnel_mitaco.json');

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Không tìm thấy file dữ liệu nhân sự MITACO: ${jsonPath}`);
  }

  const rawData: MitacoRawPersonnel[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const defaultPasswordHash =
    options?.defaultPasswordHash || (await bcrypt.hash('Qcet@123456', 10));

  // Tập hợp các email đặc biệt / đã được sử dụng
  const usedEmails = new Set<string>(options?.preservedEmails || []);

  // Đọc danh sách đơn vị và vị trí việc làm hiện có trong DB
  const orgUnits = await prisma.organizationalUnit.findMany({
    select: { id: true, code: true, name: true },
  });
  const unitByCode = new Map(orgUnits.map((u) => [u.code, u]));

  const positionDefs = await prisma.positionDefinition.findMany({
    select: { id: true, code: true, title: true },
  });
  const positionByCode = new Map(positionDefs.map((p) => [p.code, p]));

  let usersCount = 0;
  let assignmentsCount = 0;
  const unresolvedUnits: string[] = [];

  for (const raw of rawData) {
    const maNV = raw.MaNhanVien;
    const cleanName = (FIXED_PERSONNEL_NAMES[maNV] || raw.TenNhanVien).trim();
    const override = KNOWN_PERSONNEL_OVERRIDE[maNV];
    const deptKey = raw.MaPhongBan || 'null';
    const deptMap = MITACO_DEPT_TO_CANONICAL[deptKey] || MITACO_DEPT_TO_CANONICAL['null'];

    // 1. Xác định Email chuẩn tắc
    let userEmail = override?.email;
    if (!userEmail) {
      const base = generateBaseEmail(cleanName);
      let candidate = `${base}@cdktcnqn.edu.vn`;
      let counter = 2;
      while (usedEmails.has(candidate)) {
        candidate = `${base}${counter}@cdktcnqn.edu.vn`;
        counter++;
      }
      userEmail = candidate;
    }
    usedEmails.add(userEmail);

    // 2. Xác định Role, Title, UnitCode, PositionCode
    const finalRole = override?.role || deptMap.role;
    const finalUnitCode = override?.unitCode || deptMap.unitCode;
    const finalPositionCode = override?.positionCode || deptMap.defaultPositionCode;
    const positionDef = positionByCode.get(finalPositionCode);
    const finalTitle = override?.title || positionDef?.title || 'Chuyên viên';

    // 3. Upsert User
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {
        name: cleanName,
        role: finalRole,
        title: finalTitle,
        phone: raw.DienThoaiLienHe ? raw.DienThoaiLienHe.trim() : undefined,
        isActive: true,
      },
      create: {
        email: userEmail,
        name: cleanName,
        role: finalRole,
        title: finalTitle,
        phone: raw.DienThoaiLienHe ? raw.DienThoaiLienHe.trim() : undefined,
        passwordHash: defaultPasswordHash,
        isActive: true,
      },
    });
    usersCount++;

    // 4. Upsert PositionAssignment
    const unit = unitByCode.get(finalUnitCode);
    if (!unit) {
      unresolvedUnits.push(`[${maNV}] ${cleanName} -> Thiếu đơn vị canonical ${finalUnitCode}`);
      continue;
    }

    if (!positionDef) {
      unresolvedUnits.push(
        `[${maNV}] ${cleanName} -> Thiếu PositionDefinition ${finalPositionCode}`
      );
      continue;
    }

    const existingAssignment = await prisma.positionAssignment.findFirst({
      where: {
        userId: user.id,
        positionDefinitionId: positionDef.id,
        unitId: unit.id,
      },
      select: { id: true },
    });

    if (!existingAssignment) {
      await prisma.positionAssignment.create({
        data: {
          userId: user.id,
          positionDefinitionId: positionDef.id,
          unitId: unit.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          sourceDecisionNumber: '282/QĐ-CĐKTCNQN',
        },
      });
      assignmentsCount++;
    }
  }

  console.log(`✓ Hoàn thành gieo hạt 258 nhân sự MITACO:`);
  console.log(`  - ${usersCount} người dùng đã được tạo / cập nhật`);
  console.log(`  - ${assignmentsCount} phân công vị trí việc làm mới được liên kết`);
  if (unresolvedUnits.length > 0) {
    console.warn(`  - Cảnh báo: ${unresolvedUnits.length} trường hợp chưa gán được vị trí.`);
  }

  return {
    totalRecords: rawData.length,
    usersCreatedOrUpdated: usersCount,
    assignmentsCreatedOrUpdated: assignmentsCount,
    unresolvedUnits,
  };
}
