import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MITACO_DEPT_TO_CANONICAL,
  KNOWN_PERSONNEL_OVERRIDE,
  FIXED_PERSONNEL_NAMES,
  generateBaseEmail,
  removeVietnameseTones,
  type MitacoRawPersonnel,
} from '../prisma/seeds/mitaco-personnel-seed';
import { CANONICAL_16_UNITS, CANONICAL_SCHOOL_ROOT, CANONICAL_POSITION_DEFINITIONS } from '../prisma/seeds/canonical-org-seed';

describe('Mitaco Personnel Seed & Mapping Suite', () => {
  const jsonPath = path.join(process.cwd(), 'prisma', 'seeds', 'extracted_personnel_mitaco.json');

  test('1. File extracted_personnel_mitaco.json tồn tại và có đúng 258 bản ghi duy nhất', () => {
    assert.ok(fs.existsSync(jsonPath), 'File extracted_personnel_mitaco.json phải tồn tại');
    const data: MitacoRawPersonnel[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(data.length, 258, 'Dữ liệu trích xuất phải có đúng 258 bản ghi');

    const uniqueMa = new Set(data.map((p) => p.MaNhanVien));
    assert.equal(uniqueMa.size, 258, 'Mã nhân viên phải duy nhất không trùng lặp');
  });

  test('2. Thuật toán sinh email chuẩn tắc và xử lý không trùng lặp', () => {
    assert.equal(generateBaseEmail('Nguyễn Văn Thắng'), 'thangnv');
    assert.equal(generateBaseEmail('Đặng Nhật Huy'), 'huydn');
    assert.equal(generateBaseEmail('Lê Phương Thúy Oanh'), 'oanhlpt');
    assert.equal(generateBaseEmail('Phạm Thị Dịu'), 'diupt');
    assert.equal(removeVietnameseTones('Trần Đình Anh'), 'Tran Dinh Anh');
  });

  test('3. Ánh xạ phòng ban MITACO khớp với 16 đơn vị Canonical chuẩn', () => {
    const canonicalCodes = new Set([CANONICAL_SCHOOL_ROOT.code, ...CANONICAL_16_UNITS.map((u) => u.code)]);
    const validPositions = new Set(CANONICAL_POSITION_DEFINITIONS.map((p) => p.code));

    for (const [deptCode, mapping] of Object.entries(MITACO_DEPT_TO_CANONICAL)) {
      assert.ok(
        canonicalCodes.has(mapping.unitCode),
        `Đơn vị ${mapping.unitCode} ánh xạ từ ${deptCode} phải nằm trong Canonical Units`
      );
      assert.ok(
        validPositions.has(mapping.defaultPositionCode),
        `Vị trí ${mapping.defaultPositionCode} phải nằm trong Position Definitions`
      );
    }
  });

  test('4. Khắc phục lỗi font 5 bản ghi và định danh bản ghi trống', () => {
    assert.equal(FIXED_PERSONNEL_NAMES['00027'], 'Mai Xuân Lực');
    assert.equal(FIXED_PERSONNEL_NAMES['00037'], 'Nguyễn Văn Tiến');
    assert.equal(FIXED_PERSONNEL_NAMES['00040'], 'Hoàng Bảo Khanh');
    assert.equal(FIXED_PERSONNEL_NAMES['00049'], 'Lê Thanh Nhật');
    assert.equal(FIXED_PERSONNEL_NAMES['00051'], 'Nguyễn Thị Xuân Hà');
    assert.equal(FIXED_PERSONNEL_NAMES['00079'], 'Cán bộ dự phòng 079');
  });

  test('5. Bảo lưu tài khoản lãnh đạo và cấu hình đặc biệt', () => {
    assert.equal(KNOWN_PERSONNEL_OVERRIDE['00258'].email, 'dangnhathuy@cdktcnqn.edu.vn');
    assert.equal(KNOWN_PERSONNEL_OVERRIDE['00258'].positionCode, 'NHAN_VIEN_CNTT');
    assert.equal(KNOWN_PERSONNEL_OVERRIDE['00081'].positionCode, 'HIEU_TRUONG');
    assert.equal(KNOWN_PERSONNEL_OVERRIDE['00003'].unitCode, 'P_QLDT');
    assert.equal(KNOWN_PERSONNEL_OVERRIDE['00105'].unitCode, 'P_TCKT');
    assert.equal(KNOWN_PERSONNEL_OVERRIDE['00072'].unitCode, 'P_KT_DBCL');
  });

  test('6. Sinh toàn bộ 258 email từ file JSON đảm bảo 100% email @cdktcnqn.edu.vn và không trùng lặp', () => {
    const data: MitacoRawPersonnel[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const usedEmails = new Set<string>([
      'bgh@cdktcnqn.edu.vn',
      'admin@cdktcnqn.edu.vn',
      'vanthu@cdktcnqn.edu.vn',
      'daotao@cdktcnqn.edu.vn',
      'taichinh@cdktcnqn.edu.vn',
      'tochuc@cdktcnqn.edu.vn',
      'tuyensinh@cdktcnqn.edu.vn',
      'hanhchinh@cdktcnqn.edu.vn',
      'quantrimang@cdktcnqn.edu.vn',
      'tt.stt@cdktcnqn.edu.vn',
      'k.cntt@cdktcnqn.edu.vn',
    ]);

    const generatedMap = new Map<string, string>();

    for (const raw of data) {
      const maNV = raw.MaNhanVien;
      const cleanName = (FIXED_PERSONNEL_NAMES[maNV] || raw.TenNhanVien).trim();
      const override = KNOWN_PERSONNEL_OVERRIDE[maNV];

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
      assert.ok(userEmail.endsWith('@cdktcnqn.edu.vn'), `Email ${userEmail} phải kết thúc bằng @cdktcnqn.edu.vn`);
      assert.ok(!usedEmails.has(userEmail) || override?.email === userEmail, `Email ${userEmail} không được trùng`);
      usedEmails.add(userEmail);
      generatedMap.set(maNV, userEmail);
    }

    assert.equal(generatedMap.size, 258, 'Phải sinh đủ 258 email duy nhất');
  });
});
