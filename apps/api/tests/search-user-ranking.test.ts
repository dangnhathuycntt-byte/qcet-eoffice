import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { scoreSearchUser } from "../src/server/search/global-search-service";

describe("Tìm kiếm toàn cục: thứ hạng người dùng", () => {
  test("khớp tên xếp trên người chỉ có chức danh chứa chuỗi gõ (\"Chuyên viên\" chứa \"huy\")", () => {
    const byName = scoreSearchUser({ name: "Đặng Nhật Huy", email: "a@qcet.edu.vn", title: "Chuyên viên" }, "Huy");
    const byTitle = scoreSearchUser({ name: "Bùi Chí Lương", email: "b@qcet.edu.vn", title: "Chuyên viên nghiệp vụ" }, "Huy");
    assert.ok(byName > byTitle, `tên ${byName} phải cao hơn chức danh ${byTitle}`);
    assert.ok(byTitle > 0, "khớp chức danh vẫn được tính");
  });

  test("khớp trọn tên riêng xếp trên tên chỉ bắt đầu giống khi bỏ dấu (\"Huy\" và \"Huỳnh\")", () => {
    const given = scoreSearchUser({ name: "Đặng Nhật Huy", email: "a@qcet.edu.vn" }, "Huy");
    const prefix = scoreSearchUser({ name: "Huỳnh Đăng Dũng", email: "c@qcet.edu.vn" }, "Huy");
    assert.ok(given > prefix, `"Đặng Nhật Huy" ${given} phải cao hơn "Huỳnh Đăng Dũng" ${prefix}`);
    assert.ok(scoreSearchUser({ name: "Đặng Nhật Huy", email: "a@qcet.edu.vn" }, "nhat huy") >= 82, "gõ không dấu nhiều chữ vẫn khớp trọn chữ");
  });

  test("gõ đúng chức danh vẫn tìm ra người", () => {
    assert.ok(scoreSearchUser({ name: "Bùi Chí Lương", email: "b@qcet.edu.vn", title: "Trưởng phòng" }, "trưởng phòng") > 0);
  });
});
