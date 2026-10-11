import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INSTITUTION_CONFIG, getOfficialSigningCapacity } from "../src/config/institution";

describe("Task 3.18 - Institutional Profile & Identity Configuration", () => {
  describe("1. Canonical Configuration Integrity", () => {
    it("exports complete institutional profile with all required attributes", () => {
      assert.equal(
        INSTITUTION_CONFIG.officialName,
        "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
      );
      assert.equal(INSTITUTION_CONFIG.shortName, "QCET");
      assert.equal(
        INSTITUTION_CONFIG.subordinateTo,
        "ỦY BAN NHÂN DÂN TỈNH BÌNH ĐỊNH"
      );
      assert.equal(INSTITUTION_CONFIG.institutionCode, "QCET");
      assert.equal(
        INSTITUTION_CONFIG.issuingAuthority,
        "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
      );
      assert.ok(INSTITUTION_CONFIG.address.includes("Quy Nhơn"));
      assert.ok(INSTITUTION_CONFIG.email?.includes("@cdktcnqn.edu.vn"));
      assert.equal(INSTITUTION_CONFIG.website, "https://cdktcnqn.edu.vn");
      assert.equal(INSTITUTION_CONFIG.logoUrl, "/logo-qcet.png");
      assert.equal(
        INSTITUTION_CONFIG.abbreviatedName,
        "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn"
      );
      assert.equal(INSTITUTION_CONFIG.domain, "cdktcnqn.edu.vn");
    });

    it("does not contain references to deprecated or foreign institutions", () => {
      const configStr = JSON.stringify(INSTITUTION_CONFIG).toLowerCase();
      assert.ok(
        !configStr.includes("quảng ninh"),
        "Configuration must not contain references to Quảng Ninh"
      );
      assert.ok(
        !configStr.includes("quang ninh"),
        "Configuration must not contain references to Quang Ninh"
      );
      assert.ok(
        !configStr.includes("hạ long"),
        "Configuration must not contain references to Hạ Long"
      );
      assert.ok(
        !configStr.includes("kinh tế"),
        "Configuration must not contain the deprecated 'Kinh tế' institution name"
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

    it("formats digital signature capacity correctly for administrative departments", () => {
      const defaultCapacity = getOfficialSigningCapacity();
      assert.equal(
        defaultCapacity,
        "VĂN PHÒNG / TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN"
      );

      const customCapacity = getOfficialSigningCapacity("PHÒNG TỔ CHỨC CÁN BỘ");
      assert.equal(
        customCapacity,
        "PHÒNG TỔ CHỨC CÁN BỘ / TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN"
      );
    });
  });
});
