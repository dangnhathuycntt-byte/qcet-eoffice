import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INSTITUTION_CONFIG,
  getInstitutionName,
  getInstitutionShortName,
  getInstitutionSubordinateTo,
  getInstitutionCode,
  getInstitutionHeader,
  getOfficialSigningCapacity,
  getAppTitle,
  isCurrentInstitution,
} from "../src/config/institution";

describe("Task 3.18 - Institutional Profile & Identity Configuration", () => {
  describe("1. Canonical Configuration Integrity", () => {
    it("exports complete institutional profile with all required attributes", () => {
      assert.equal(
        INSTITUTION_CONFIG.officialName,
        "Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh"
      );
      assert.equal(INSTITUTION_CONFIG.shortName, "QCET");
      assert.equal(
        INSTITUTION_CONFIG.subordinateTo,
        "ỦY BAN NHÂN DÂN TỈNH QUẢNG NINH"
      );
      assert.equal(INSTITUTION_CONFIG.institutionCode, "QCET");
      assert.equal(
        INSTITUTION_CONFIG.issuingAuthority,
        "Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh"
      );
      assert.ok(INSTITUTION_CONFIG.address.includes("Hạ Long"));
      assert.ok(INSTITUTION_CONFIG.phone);
      assert.ok(INSTITUTION_CONFIG.email?.includes("@cdktcnqn.edu.vn"));
      assert.equal(INSTITUTION_CONFIG.website, "https://cdktcnqn.edu.vn");
      assert.equal(INSTITUTION_CONFIG.logoUrl, "/logo-qcet.png");
      assert.equal(
        INSTITUTION_CONFIG.abbreviatedName,
        "Trường CĐ Kinh tế & Công nghệ Quảng Ninh"
      );
      assert.equal(INSTITUTION_CONFIG.domain, "cdktcnqn.edu.vn");
    });

    it("does not contain references to deprecated or foreign institutions", () => {
      const configStr = JSON.stringify(INSTITUTION_CONFIG).toLowerCase();
      assert.ok(
        !configStr.includes("quy nhơn"),
        "Configuration must not contain references to Quy Nhơn"
      );
      assert.ok(
        !configStr.includes("quy nhon"),
        "Configuration must not contain references to Quy Nhon"
      );
    });

    it("ensures INSTITUTION_CONFIG is deeply frozen and immutable", () => {
      assert.ok(Object.isFrozen(INSTITUTION_CONFIG), "INSTITUTION_CONFIG must be frozen");

      assert.throws(
        () => {
          (INSTITUTION_CONFIG as any).officialName = "Modified University";
        },
        TypeError,
        "Mutating officialName must throw in strict mode"
      );

      assert.throws(
        () => {
          (INSTITUTION_CONFIG as any).newField = "Hacked";
        },
        TypeError,
        "Adding new field must throw in strict mode"
      );
    });
  });

  describe("2. Institutional Helper Functions", () => {
    it("returns correct institutional name and acronym via getters", () => {
      assert.equal(getInstitutionName(), "Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh");
      assert.equal(getInstitutionShortName(), "QCET");
      assert.equal(getInstitutionSubordinateTo(), "ỦY BAN NHÂN DÂN TỈNH QUẢNG NINH");
      assert.equal(getInstitutionCode(), "QCET");
    });

    it("formats Decree 30/2020/ND-CP institutional header correctly", () => {
      const header = getInstitutionHeader();
      assert.equal(header.subordinateTo, "ỦY BAN NHÂN DÂN TỈNH QUẢNG NINH");
      assert.equal(
        header.officialName,
        "TRƯỜNG CAO ĐẲNG KINH TẾ VÀ CÔNG NGHỆ QUẢNG NINH"
      );
      assert.equal(
        header.formattedHeader,
        "ỦY BAN NHÂN DÂN TỈNH QUẢNG NINH\nTRƯỜNG CAO ĐẲNG KINH TẾ VÀ CÔNG NGHỆ QUẢNG NINH"
      );
    });

    it("formats digital signature capacity correctly for administrative departments", () => {
      const defaultCapacity = getOfficialSigningCapacity();
      assert.equal(
        defaultCapacity,
        "VĂN PHÒNG / TRƯỜNG CAO ĐẲNG KINH TẾ VÀ CÔNG NGHỆ QUẢNG NINH"
      );

      const customCapacity = getOfficialSigningCapacity("PHÒNG TỔ CHỨC CÁN BỘ");
      assert.equal(
        customCapacity,
        "PHÒNG TỔ CHỨC CÁN BỘ / TRƯỜNG CAO ĐẲNG KINH TẾ VÀ CÔNG NGHỆ QUẢNG NINH"
      );
    });

    it("formats application page titles consistently", () => {
      assert.equal(getAppTitle(), "QCET E-Office");
      assert.equal(getAppTitle("Quản lý Văn bản"), "Quản lý Văn bản - QCET E-Office");
    });

    it("correctly identifies valid and invalid institutional identifiers", () => {
      assert.equal(isCurrentInstitution("Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh"), true);
      assert.equal(isCurrentInstitution("QCET"), true);
      assert.equal(isCurrentInstitution("Trường CĐ Kinh tế & Công nghệ Quảng Ninh"), true);
      assert.equal(isCurrentInstitution("user@cdktcnqn.edu.vn"), true);
      assert.equal(isCurrentInstitution("Trường Đại học Bách Khoa"), false);
      assert.equal(isCurrentInstitution(null), false);
      assert.equal(isCurrentInstitution(undefined), false);
    });
  });
});
