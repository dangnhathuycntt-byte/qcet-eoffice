import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { UserRole as PrismaUserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, departmentId, title, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ email, mật khẩu và họ tên" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email này đã được đăng ký trong hệ thống" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const validRole = (role && Object.values(PrismaUserRole).includes(role))
      ? (role as PrismaUserRole)
      : PrismaUserRole.CHUYEN_VIEN;

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: hashedPassword,
        role: validRole,
        departmentId: departmentId || "CNTT",
        title: title?.trim() || "Chuyên viên",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        title: true,
      },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tạo tài khoản" },
      { status: 500 }
    );
  }
}
