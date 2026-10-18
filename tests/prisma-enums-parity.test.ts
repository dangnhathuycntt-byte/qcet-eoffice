/**
 * Enum thuần trong @qcet/contracts/prisma-enums phải trùng tên, giá trị và thứ tự khóa với @prisma/client:
 * z.nativeEnum dùng các hằng số này để kiểm đầu vào và liệt kê giá trị trong thông báo lỗi theo thứ tự khóa.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as Prisma from "@prisma/client";
import * as Mirror from "@qcet/contracts/prisma-enums";

describe("@qcet/contracts/prisma-enums khớp @prisma/client", () => {
  const names = Object.keys(Mirror);

  test("có đủ enum dùng trong contracts và domain", () => {
    assert.ok(names.length >= 17, `chỉ có ${names.length} enum`);
  });

  for (const name of names) {
    test(`${name}: cùng khóa, giá trị và thứ tự`, () => {
      const prismaEnum = (Prisma as unknown as Record<string, Record<string, string> | undefined>)[name];
      assert.ok(prismaEnum, `@prisma/client không có enum ${name}`);
      assert.deepEqual(Object.entries((Mirror as unknown as Record<string, Record<string, string>>)[name]), Object.entries(prismaEnum));
    });
  }
});
