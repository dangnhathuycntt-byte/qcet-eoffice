import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrgDirectory,
  countPeople,
  directoryToCsv,
  filterDirectory,
  matchesUnit,
  type OrgUnitInput,
} from "../src/lib/org/org-directory";

// Mã đơn vị theo DB (OrganizationalUnit), khác cấu hình tĩnh QCET_ORG_UNITS: trang cũ khớp theo mã tĩnh nên hầu hết đơn vị rỗng
const UNITS: OrgUnitInput[] = [
  {
    id: "u-khoa-cntt",
    code: "K_CNTT",
    name: "Khoa Công nghệ thông tin",
    type: "FACULTY",
    parentId: "u-qcet",
    displayOrder: 20,
    personnel: [
      { id: "p-gv-an", name: "Trần Văn An", email: "an@x.vn", position: "Giảng viên chuyên ngành (Hạng III)", positionCode: "GIANG_VIEN" },
      { id: "p-pk", name: "Lê Thị Bình", email: "binh@x.vn", position: "Phó Trưởng khoa", positionCode: "PHO_TRUONG_KHOA", isLeadership: true },
      { id: "p-tk", name: "Phạm Minh Đức", email: "duc@x.vn", phone: "0256.3846.483", position: "Trưởng khoa", positionCode: "TRUONG_KHOA", isLeadership: true },
      { id: "p-it", name: "Võ Quốc Cường", email: "cuong@x.vn", position: "Nhân viên công nghệ thông tin", positionCode: "NHAN_VIEN_CNTT" },
    ],
  },
  { id: "u-bomon", code: "BM_PM", name: "Bộ môn Phần mềm", type: "SECTION", parentId: "u-khoa-cntt", personnel: [] },
  {
    id: "u-ttso",
    code: "TT_SO_TT",
    name: "Trung tâm Số và Truyền thông",
    type: "CENTER",
    parentId: "u-qcet",
    displayOrder: 30,
    personnel: [{ id: "p-it", name: "Võ Quốc Cường", email: "cuong@x.vn", position: "Nhân viên công nghệ thông tin", positionCode: "NHAN_VIEN_CNTT" }],
  },
  {
    id: "u-phong",
    code: "P_QLDT",
    name: "Phòng Quản lý Đào tạo",
    type: "DEPARTMENT",
    parentId: "u-qcet",
    displayOrder: 10,
    personnel: [],
  },
  {
    id: "u-qcet",
    code: "QCET",
    name: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
    type: "SCHOOL",
    parentId: null,
    displayOrder: 0,
    personnel: [
      { id: "p-pht", name: "Nguyễn Hữu Phúc", email: "phuc@x.vn", position: "Phó Hiệu trưởng", positionCode: "PHO_HIEU_TRUONG", isLeadership: true },
      { id: "p-ht", name: "Đặng Văn Hùng", email: "hung@x.vn", position: "Hiệu trưởng", positionCode: "HIEU_TRUONG", isLeadership: true },
    ],
  },
];

describe("Cơ cấu & Danh bạ: dựng từ đơn vị trong DB", () => {
  const directory = buildOrgDirectory(UNITS);

  test("nhóm theo loại đơn vị; trường đứng riêng, đơn vị con đi ngay sau đơn vị cha", () => {
    assert.deepEqual(
      directory.groups.map((g) => [g.label, g.units.map((u) => `${u.code}@${u.depth}`)]),
      [
        ["Cấp trường", ["QCET@0"]],
        ["Phòng chức năng", ["P_QLDT@0"]],
        ["Khoa", ["K_CNTT@0", "BM_PM@1"]],
        ["Trung tâm", ["TT_SO_TT@0"]],
      ],
    );
  });

  test("đơn vị chưa có nhân sự vẫn được liệt kê với 0 người", () => {
    assert.equal(directory.units.find((u) => u.code === "P_QLDT")?.members.length, 0);
  });

  test("lãnh đạo lên đầu: Hiệu trưởng, cấp trưởng, cấp phó; còn lại xếp theo tên gọi", () => {
    assert.deepEqual(directory.units.find((u) => u.code === "QCET")?.members.map((m) => m.position), ["Hiệu trưởng", "Phó Hiệu trưởng"]);
    assert.deepEqual(
      directory.units.find((u) => u.code === "K_CNTT")?.members.map((m) => m.name),
      ["Phạm Minh Đức", "Lê Thị Bình", "Trần Văn An", "Võ Quốc Cường"],
    );
    assert.deepEqual(directory.units.find((u) => u.code === "K_CNTT")?.leaders.map((m) => m.positionCode), ["TRUONG_KHOA", "PHO_TRUONG_KHOA"]);
  });

  test("đếm người không lặp khi một người giữ chức vụ ở hai đơn vị", () => {
    assert.equal(directory.peopleCount, 6);
    assert.equal(countPeople(filterDirectory(directory, {})), 6);
  });

  test("tìm không dấu, mọi từ đều phải khớp; tìm cả chức vụ, đơn vị và số điện thoại", () => {
    const names = (query: string) => filterDirectory(directory, { query }).flatMap((s) => s.members.map((m) => m.name));
    assert.deepEqual(names("truong khoa"), ["Phạm Minh Đức", "Lê Thị Bình"]);
    assert.deepEqual(names("duc cong nghe"), ["Phạm Minh Đức"]);
    assert.deepEqual(names("38463483"), []);
    assert.deepEqual(names("3846483"), ["Phạm Minh Đức"]);
    // Người ở hai đơn vị hiện ở cả hai nhóm
    assert.deepEqual(
      filterDirectory(directory, { query: "cuong" }).map((s) => s.unit.code),
      ["K_CNTT", "TT_SO_TT"],
    );
  });

  test("lọc đơn vị giữ đơn vị đó kể cả khi rỗng; lọc lãnh đạo bỏ người không giữ chức vụ lãnh đạo", () => {
    const empty = filterDirectory(directory, { unitId: "u-phong" });
    assert.equal(empty.length, 1);
    assert.equal(empty[0].members.length, 0);
    assert.deepEqual(
      filterDirectory(directory, { leadersOnly: true }).map((s) => [s.unit.code, s.members.length]),
      [["QCET", 2], ["K_CNTT", 2]],
    );
  });

  test("tìm đơn vị theo tên, mã hoặc tên lãnh đạo", () => {
    const khoa = directory.units.find((u) => u.code === "K_CNTT")!;
    assert.ok(matchesUnit(khoa, "cong nghe"));
    assert.ok(matchesUnit(khoa, "k_cntt"));
    assert.ok(matchesUnit(khoa, "binh"));
    assert.ok(!matchesUnit(khoa, "du lich"));
  });

  test("CSV: đầu cột tiếng Việt, ngoặc kép được nhân đôi, chặn công thức ở đầu ô", () => {
    const csv = directoryToCsv([
      {
        unit: directory.units[0],
        members: [
          { ...directory.units[0].members[0], name: 'Đặng "Hùng"', email: "=HYPERLINK(1)", phone: "+84 256 384" },
        ],
      },
    ]);
    const [header, row] = csv.split("\r\n");
    assert.equal(header, '"Họ và tên","Chức vụ","Đơn vị","Email","Điện thoại"');
    assert.equal(row, '"Đặng ""Hùng""","Hiệu trưởng","Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn","\'=HYPERLINK(1)","+84 256 384"');
  });
});
