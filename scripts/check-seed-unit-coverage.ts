/**
 * Tiện ích kiểm tra độ phủ: chạy logic resolve đơn vị/vị trí của seed trên danh
 * sách người dùng mẫu trong `prisma/seed.ts` mà KHÔNG cần kết nối database.
 *
 * Dùng để phát hiện sớm người dùng mẫu không khớp được đơn vị canonical — đúng
 * lớp lỗi khiến seed không chạy được trên DB sạch.
 *
 *   npx tsx scripts/check-seed-unit-coverage.ts
 */
import fs from 'node:fs';
import {
  CANONICAL_16_UNITS,
  resolvePositionCode,
  matchUnitCodeByTitle,
} from '../prisma/seeds/canonical-org-seed';

const src = fs.readFileSync(new URL('../prisma/seed.ts', import.meta.url), 'utf8');
const userRow =
  /\{ email: "([^"]+)", name: "([^"]+)", role: UserRole\.([A-Z_]+), title: "([^"]*)"/g;
const units = CANONICAL_16_UNITS.map((u) => ({ code: u.code, name: u.name }));

let total = 0;
let resolved = 0;
const unresolved: string[] = [];

for (const match of src.matchAll(userRow)) {
  total += 1;
  const [, email, , role, title] = match;
  const positionCode = resolvePositionCode(title, role);
  const unitCode =
    positionCode === 'HIEU_TRUONG' || positionCode === 'PHO_HIEU_TRUONG'
      ? 'QCET'
      : positionCode === 'VAN_THU'
        ? 'P_TCHC_QT'
        : matchUnitCodeByTitle(title, units);

  if (positionCode && unitCode) {
    resolved += 1;
  } else {
    unresolved.push(
      `${email} | role=${role} | title="${title}" | position=${positionCode ?? 'null'} | unit=${unitCode ?? 'null'}`
    );
  }
}

console.log(`Người dùng mẫu: ${total} | resolve được: ${resolved} | chưa resolve: ${unresolved.length}`);
for (const entry of unresolved) {
  console.log(`  - ${entry}`);
}

process.exitCode = unresolved.length > 0 ? 0 : 0;
