import { PrismaClient } from "@prisma/client";

/**
 * Test-DB safety guard.
 *
 * Bộ test ghi dữ liệu thật (user/đơn vị/nhiệm vụ mẫu) vào database. `npm test`
 * đi qua `scripts/run-tests.mjs` — nơi redirect `qcet_eoffice` → `qcet_test`.
 * Nhưng chạy thẳng một file (`npx tsx --test tests/<file>.test.ts`) sẽ bỏ qua
 * runner, thừa hưởng `DATABASE_URL` từ `.env`, và ghi fixture vào thẳng DB dev.
 * Đó là nguồn dữ liệu test rác hiện lên trong dropdown nhân sự trên UI.
 *
 * Mọi test đều đi qua Prisma singleton này, nên đây là chốt chặn duy nhất cần thiết.
 */
function guardTestDatabase(): void {
  if (process.env.NODE_ENV !== "test") return;

  const url = process.env.DATABASE_URL;
  if (!url) return; // Prisma sẽ tự báo lỗi thiếu biến môi trường

  // Cùng quy tắc với `scripts/run-tests.mjs`: trỏ về DB test.
  if (/\/qcet_eoffice(\?.*)?$/.test(url)) {
    process.env.DATABASE_URL = url.replace(/\/qcet_eoffice(\?.*)?$/, "/qcet_test$1");
    return;
  }

  // Tên DB khác nhưng không phải DB test → dừng trước khi ghi bẩn dữ liệu.
  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, "");
  } catch {
    return; // URL không hợp lệ — để Prisma báo lỗi rõ ràng
  }
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `[test-guard] NODE_ENV=test nhưng DATABASE_URL trỏ vào database "${dbName}" ` +
        `không phải database test. Test sẽ ghi dữ liệu mẫu vào DB thật. ` +
        `Chạy qua \`npm test\` để tự động redirect sang DB test.`
    );
  }
}

guardTestDatabase();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Guarantee singleton across process lifecycle, hot reloads, and serverless warm containers
globalForPrisma.prisma = prisma;

export default prisma;
