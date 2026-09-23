import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_16_UNITS,
  CANONICAL_SCHOOL_ROOT,
  CANONICAL_POSITION_DEFINITIONS,
  resolvePositionCode,
  matchUnitCodeByTitle,
  normalizeVietnamese,
} from "../prisma/seeds/canonical-org-seed";
import { QCET_VTVL_ROLES } from "../src/lib/dacum-definitions";

/**
 * Phase 9 / WS3: kiểm tra logic suy ra vị trí việc làm và đơn vị canonical cho
 * người dùng seed. Phần này thuần logic nên chạy được không cần DATABASE_URL —
 * đúng lớp lỗi đã làm seed không chạy được trên DB sạch.
 */
describe("Seed: PositionAssignment & canonical unit resolution", () => {
  // 16 đơn vị cấu thành + đơn vị cấp Trường (QCET root) — đúng tập mà
  // `seedCanonicalAssignments` đọc từ `prisma.organizationalUnit.findMany()`.
  const canonicalUnits = [CANONICAL_SCHOOL_ROOT, ...CANONICAL_16_UNITS].map((u) => ({
    code: u.code,
    name: u.name,
  }));

  describe("1. Danh mục vị trí việc làm (NĐ 106/2020 & TT 12/2022)", () => {
    test("mã vị trí là duy nhất và không rỗng", () => {
      const codes = CANONICAL_POSITION_DEFINITIONS.map((p) => p.code);
      assert.equal(new Set(codes).size, codes.length, "Mã vị trí việc làm phải duy nhất");
      for (const code of codes) {
        assert.match(code, /^[A-Z][A-Z0-9_]*$/, `Mã vị trí "${code}" phải ở dạng UPPER_SNAKE`);
      }
    });

    test("mọi vị trí đều có căn cứ pháp lý và nhóm hợp lệ", () => {
      const validGroups = new Set(["LDPU", "VCMN", "VCDC", "HTPV"]);
      for (const position of CANONICAL_POSITION_DEFINITIONS) {
        assert.ok(
          position.legalBasis.trim().length > 0,
          `${position.code} phải có căn cứ pháp lý`
        );
        assert.ok(
          validGroups.has(position.group),
          `${position.code} có nhóm không hợp lệ: ${position.group}`
        );
        assert.equal(
          position.isLeadership,
          position.group === "LDPU",
          `${position.code}: isLeadership phải khớp nhóm LDPU`
        );
      }
    });

    test("mọi mã vị trí mà tầng authorization tra cứu đều có trong danh mục", () => {
      // Các mã được đối chiếu trực tiếp trong document-policy, document-classification,
      // user-directory-policy và dossier-policy.
      const requiredCodes = [
        "HIEU_TRUONG",
        "PHO_HIEU_TRUONG",
        "TRUONG_PHONG",
        "TRUONG_KHOA",
        "GIANG_VIEN",
        "VAN_THU",
      ];
      const seededCodes = new Set(CANONICAL_POSITION_DEFINITIONS.map((p) => p.code));
      for (const code of requiredCodes) {
        assert.ok(seededCodes.has(code), `Thiếu PositionDefinition cho mã ${code}`);
      }
    });

    test("mọi vị trí trong danh mục VTVL pháp lý đều có vị trí tương ứng", () => {
      // QCET_VTVL_ROLES là nguồn chuẩn tắc; seed không được bỏ sót vị trí nào.
      const vtvlToPosition: Record<string, string> = {
        VTVL_TRUONG_KHOA: "TRUONG_KHOA",
        VTVL_PHO_TRUONG_KHOA: "PHO_TRUONG_KHOA",
        VTVL_GV_CHUYEN_NGANH: "GIANG_VIEN",
        VTVL_CV_DAO_TAO: "CHUYEN_VIEN",
        VTVL_KTV_PHONG_MAY: "KTV_PHONG_MAY",
      };
      const seededCodes = new Set(CANONICAL_POSITION_DEFINITIONS.map((p) => p.code));
      for (const role of QCET_VTVL_ROLES) {
        const mapped = vtvlToPosition[role.code];
        assert.ok(mapped, `VTVL ${role.code} chưa được ánh xạ sang PositionDefinition`);
        assert.ok(seededCodes.has(mapped), `Thiếu PositionDefinition ${mapped} cho ${role.code}`);
      }
    });
  });

  describe("2. Suy ra vị trí việc làm từ chức danh", () => {
    test("ưu tiên vị trí 'Phó' trước vị trí 'Trưởng'", () => {
      assert.equal(resolvePositionCode("Phó Hiệu trưởng", "BAN_GIAM_HIEU"), "PHO_HIEU_TRUONG");
      assert.equal(resolvePositionCode("Hiệu trưởng", "BAN_GIAM_HIEU"), "HIEU_TRUONG");
      assert.equal(
        resolvePositionCode("Phó Trưởng khoa Điện tử - Tin học", "CHUYEN_VIEN"),
        "PHO_TRUONG_KHOA"
      );
      assert.equal(resolvePositionCode("Trưởng khoa Cơ khí", "TRUONG_PHONG"), "TRUONG_KHOA");
      assert.equal(
        resolvePositionCode("Phó Giám đốc TT Số - Truyền thông", "CHUYEN_VIEN"),
        "PHO_GIAM_DOC_TRUNG_TAM"
      );
      assert.equal(
        resolvePositionCode("Giám đốc TT Ngoại ngữ - Tin học", "TRUONG_PHONG"),
        "GIAM_DOC_TRUNG_TAM"
      );
    });

    test("suy ra từ role hệ thống khi chức danh không nêu vị trí", () => {
      assert.equal(resolvePositionCode("Văn thư trường", "VAN_THU"), "VAN_THU");
      assert.equal(resolvePositionCode(null, "VAN_THU"), "VAN_THU");
      assert.equal(resolvePositionCode("Cán bộ nghiệp vụ", "CHUYEN_VIEN"), "CHUYEN_VIEN");
    });

    test("trả null khi không xác định được — không được đoán bừa", () => {
      assert.equal(resolvePositionCode("Quản trị viên", "ADMIN"), null);
      assert.equal(resolvePositionCode("", "MANAGER"), null);
      assert.equal(resolvePositionCode(null, null), null);
      assert.equal(resolvePositionCode(undefined, undefined), null);
    });
  });

  describe("3. Khớp đơn vị canonical theo chức danh", () => {
    test("khớp đúng đơn vị canonical cho các chức danh có thật trong seed", () => {
      const cases: Array<[string, string]> = [
        ["Trưởng phòng Quản lý Đào tạo", "P_QLDT"],
        ["Trưởng phòng Tài chính", "P_TCKT"],
        ["Trưởng phòng Hành chính - Quản trị", "P_TCHC_QT"],
        ["Trưởng khoa Cơ khí", "K_CK"],
        ["Trưởng khoa Điện", "K_DIEN_DTV"],
        ["Trưởng khoa Du lịch - Dịch vụ", "K_DL"],
        ["Trưởng khoa Kinh tế - Tổng hợp", "K_KT"],
        ["Giám đốc TT Ngoại ngữ - Tin học", "TT_NN_TH"],
        // Tài khoản đại diện đơn vị: chức danh chính là tên đơn vị
        ["Phòng Quản lý Đào tạo", "P_QLDT"],
        ["Phòng Tài chính", "P_TCKT"],
      ];
      for (const [title, expectedCode] of cases) {
        assert.equal(
          matchUnitCodeByTitle(title, canonicalUnits),
          expectedCode,
          `Chức danh "${title}" phải khớp đơn vị ${expectedCode}`
        );
      }
    });

    test("KHÔNG khớp nhầm 'Quản trị viên' vào 'Phòng Tổ chức Hành chính - Quản trị'", () => {
      // Hồi quy: dùng so khớp chuỗi con (`includes`) sẽ khiến "quan tri vien" khớp
      // nhầm vào token "quan tri". Chức danh mô tả một người, không phải một đơn vị.
      assert.equal(matchUnitCodeByTitle("Quản trị viên", canonicalUnits), null);
      assert.equal(matchUnitCodeByTitle("Nhân viên kế toán", canonicalUnits), null);
      assert.equal(matchUnitCodeByTitle("Chuyên viên hành chính", canonicalUnits), null);
    });

    test("trả null thay vì gán bừa khi chức danh không khớp đơn vị nào", () => {
      assert.equal(matchUnitCodeByTitle("Phòng Không Tồn Tại XYZ", canonicalUnits), null);
      assert.equal(matchUnitCodeByTitle(null, canonicalUnits), null);
      assert.equal(matchUnitCodeByTitle("", canonicalUnits), null);
      assert.equal(matchUnitCodeByTitle(undefined, canonicalUnits), null);
    });

    test("trả null khi tên viết tắt không suy ra được đơn vị canonical", () => {
      // Các chức danh này có thật trong seed nhưng dùng viết tắt/đơn vị không nằm
      // trong danh mục 16 đơn vị canonical. Seed phải báo cáo tường minh, không đoán.
      const abbreviations = [
        "Trưởng phòng TC-ĐBCL",
        "Giảng viên CNTT",
        "Phó Trưởng khoa (ATTT)",
        "Phó Giám đốc TT Số - Truyền thông",
        "Trưởng khoa Công nghệ Ô tô",
        "Trưởng khoa Văn hóa Nghệ thuật",
        "Trưởng khoa Kỹ thuật Nông nghiệp",
      ];
      for (const title of abbreviations) {
        assert.equal(
          matchUnitCodeByTitle(title, canonicalUnits),
          null,
          `Chức danh "${title}" không được gán bừa vào một đơn vị`
        );
      }
    });

    test("không khớp nhầm giữa các khoa có tên gần giống nhau", () => {
      // 'Khoa Kinh tế' (K_KT) và 'Khoa Kỹ thuật Nông lâm - Thủy sản' (K_NL_TS) khác nhau.
      assert.equal(matchUnitCodeByTitle("Trưởng khoa Kinh tế - Tổng hợp", canonicalUnits), "K_KT");
      // 'Khoa Nông lâm - Thủy sản' khớp khi chức danh nêu đúng tên đơn vị.
      assert.equal(
        matchUnitCodeByTitle("Trưởng khoa Nông lâm - Thủy sản", canonicalUnits),
        "K_NL_TS"
      );
    });
  });

  describe("4. Chuẩn hóa tiếng Việt", () => {
    test("bỏ dấu và hạ chữ thường, xử lý đ/Đ", () => {
      assert.equal(normalizeVietnamese("Trưởng phòng Đào tạo"), "truong phong dao tao");
      assert.equal(normalizeVietnamese("ĐIỆN - ĐIỆN TỬ"), "dien - dien tu");
      assert.equal(normalizeVietnamese(""), "");
    });
  });

  describe("5. Bất biến toàn cục của dữ liệu seed", () => {
    test("mọi đơn vị canonical đều có mã và tên phân biệt được", () => {
      const codes = CANONICAL_16_UNITS.map((u) => u.code);
      assert.equal(new Set(codes).size, codes.length, "Mã đơn vị phải duy nhất");
      for (const unit of CANONICAL_16_UNITS) {
        assert.ok(unit.name.trim().length > 0, `Đơn vị ${unit.code} phải có tên`);
      }
    });

    test("không có người dùng nào bị gán vào đơn vị không tồn tại", () => {
      // Bất biến: mọi đơn vị mà resolver trả về phải nằm trong danh mục canonical.
      const canonicalCodes = new Set(canonicalUnits.map((u) => u.code));
      const titles = [
        "Hiệu trưởng",
        "Phó Hiệu trưởng",
        "Trưởng phòng Quản lý Đào tạo",
        "Trưởng khoa Cơ khí",
        "Giảng viên CNTT",
      ];
      for (const title of titles) {
        const code = matchUnitCodeByTitle(title, canonicalUnits);
        if (code !== null) {
          assert.ok(canonicalCodes.has(code), `Đơn vị ${code} không nằm trong danh mục`);
        }
      }
      assert.ok(canonicalCodes.has("QCET"), "Đơn vị cấp Trường QCET phải tồn tại");
    });
  });
});
