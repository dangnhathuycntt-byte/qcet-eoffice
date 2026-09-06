import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Database & Prisma Schema Contract", () => {
  test("schema.prisma must define PostgreSQL datasource and User model", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    assert.ok(fs.existsSync(schemaPath), "prisma/schema.prisma must exist");

    const content = fs.readFileSync(schemaPath, "utf-8");
    assert.match(content, /provider\s*=\s*"postgresql"/, "datasource provider must be postgresql");
    assert.match(content, /model\s+User/, "User model must be defined");
    assert.match(content, /model\s+Department/, "Department model must be defined");
    assert.match(content, /enum\s+UserRole/, "UserRole enum must be defined");
    assert.match(content, /BAN_GIAM_HIEU/, "UserRole must contain BAN_GIAM_HIEU");
    assert.match(content, /TRUONG_PHONG/, "UserRole must contain TRUONG_PHONG");
    assert.match(content, /CHUYEN_VIEN/, "UserRole must contain CHUYEN_VIEN");
  });

  test("src/lib/prisma.ts singleton must exist", () => {
    const prismaFilePath = path.resolve(process.cwd(), "src/lib/prisma.ts");
    assert.ok(fs.existsSync(prismaFilePath), "src/lib/prisma.ts must exist");
  });
});
