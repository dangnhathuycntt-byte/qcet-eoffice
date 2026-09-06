import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { id: "BGH", name: "Ban Giám hiệu Nhà trường", shortName: "BGH", color: "amber" },
  { id: "CNTT", name: "Phòng Quản trị Mạng và CNTT", shortName: "QTM-CNTT", color: "blue" },
  { id: "TCHC", name: "Phòng Tổ chức Hành chính", shortName: "TCHC", color: "emerald" },
  { id: "KHTC", name: "Phòng Kế hoạch Tài chính", shortName: "KHTC", color: "indigo" },
  { id: "DT_QLKH", name: "Phòng Đào tạo & Quản lý Khoa học", shortName: "ĐT-QLKH", color: "cyan" },
];

async function main() {
  console.log("Starting database seed...");

  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name, shortName: dept.shortName, color: dept.color },
      create: dept,
    });
  }

  const defaultPasswordHash = await bcrypt.hash("Qcet@2026", 10);

  const SEED_USERS = [
    {
      email: "bgh@qcet.edu.vn",
      name: "TS. Nguyễn Văn Hiệu",
      role: UserRole.BAN_GIAM_HIEU,
      departmentId: "BGH",
      title: "Hiệu trưởng",
      phone: "028.3896.8641",
    },
    {
      email: "cntt.lead@qcet.edu.vn",
      name: "ThS. Lê Hoàng Nam",
      role: UserRole.TRUONG_PHONG,
      departmentId: "CNTT",
      title: "Trưởng phòng QTM & CNTT",
      phone: "0908.123.456",
    },
    {
      email: "chuyenvien@qcet.edu.vn",
      name: "Kỹ sư Trần Hùng",
      role: UserRole.CHUYEN_VIEN,
      departmentId: "CNTT",
      title: "Chuyên viên mạng & ATTT",
      phone: "0912.345.678",
    },
  ];

  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        title: user.title,
        phone: user.phone,
        passwordHash: defaultPasswordHash,
      },
      create: {
        ...user,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  console.log("Database seeded successfully with 5 departments and 3 seed users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
