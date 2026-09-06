import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { UserRole as PrismaUserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, departmentId, title } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ email, mật khẩu và họ tên" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6 || password.length > 72) {
      return NextResponse.json(
        { error: "Mật khẩu phải từ 6 đến 72 ký tự" },
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

    let assignedDepartmentId: string | null = null;
    if (departmentId !== undefined && departmentId !== null && typeof departmentId === "string" && departmentId.trim() !== "") {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId.trim() },
      });
      if (!dept) {
        return NextResponse.json(
          { error: "Phòng ban không tồn tại trong hệ thống" },
          { status: 400 }
        );
      }
      assignedDepartmentId = dept.id;
    } else if (departmentId !== undefined && departmentId !== null && departmentId !== "") {
      return NextResponse.json(
        { error: "Mã phòng ban không hợp lệ" },
        { status: 400 }
      );
    } else {
      const defaultDept = await prisma.department.findUnique({
        where: { id: "CNTT" },
      });
      if (defaultDept) {
        assignedDepartmentId = defaultDept.id;
      }
    }

    const hashedPassword = await hashPassword(password);

    // Public registration strictly enforces CHUYEN_VIEN role unconditionally
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: hashedPassword,
        role: PrismaUserRole.CHUYEN_VIEN,
        departmentId: assignedDepartmentId,
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
