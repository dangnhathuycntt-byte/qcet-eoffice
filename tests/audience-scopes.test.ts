import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { audienceScopeGroups, type AudienceScopePerson } from "@qcet/shared/domain/meetings/audience-scopes";

// Mã chức vụ lấy từ danh bạ thật (PositionDefinition.code), không có tên người
const person = (id: string, ...positionCodes: string[]): AudienceScopePerson => ({ id, positionCodes });

const DIRECTORY = [
  person("hieutruong", "HIEU_TRUONG"),
  person("phohieutruong", "PHO_HIEU_TRUONG"),
  person("truongphong", "TRUONG_PHONG"),
  person("truongkhoa", "TRUONG_KHOA"),
  person("giamdoc", "GIAM_DOC_TRUNG_TAM"),
  person("phogiamdoc", "PHO_GIAM_DOC_TRUNG_TAM"),
  person("giangvien1", "GIANG_VIEN"),
  person("giangvien2", "GIANG_VIEN"),
  person("chuyenvien", "CHUYEN_VIEN"),
  person("khongchucvu"),
];

const ids = (people: AudienceScopePerson[]) => people.map((p) => p.id);

describe("Phạm vi mời họp (Toàn trường, Ban Giám hiệu, Trưởng đơn vị…)", () => {
  it("chia đúng nhóm theo mã chức vụ, Toàn trường luôn đứng đầu và gồm mọi người", () => {
    const groups = audienceScopeGroups(DIRECTORY);
    assert.deepEqual(
      groups.map((g) => g.id),
      ["all", "executive", "unit-head", "unit-deputy", "lecturer"]
    );
    const byId = Object.fromEntries(groups.map((g) => [g.id, ids(g.people)]));
    assert.equal(byId.all.length, DIRECTORY.length);
    assert.deepEqual(byId.executive, ["hieutruong", "phohieutruong"]);
    assert.deepEqual(byId["unit-head"], ["truongphong", "truongkhoa", "giamdoc"]);
    assert.deepEqual(byId["unit-deputy"], ["phogiamdoc"]);
    assert.deepEqual(byId.lecturer, ["giangvien1", "giangvien2"]);
  });

  it("Phó Hiệu trưởng thuộc Ban Giám hiệu chứ không phải trưởng đơn vị", () => {
    const groups = audienceScopeGroups([person("pht", "PHO_HIEU_TRUONG")]);
    assert.deepEqual(groups.map((g) => g.id), ["all", "executive"]);
  });

  it("người kiêm nhiệm nằm trong mọi nhóm mình thuộc về", () => {
    const groups = audienceScopeGroups([person("kiemnhiem", "GIANG_VIEN", "TRUONG_KHOA")]);
    assert.deepEqual(groups.map((g) => g.id), ["all", "unit-head", "lecturer"]);
  });

  it("nhóm không có ai thì ẩn; danh bạ trống thì không có nhóm nào", () => {
    assert.deepEqual(audienceScopeGroups([person("a", "CHUYEN_VIEN")]).map((g) => g.id), ["all"]);
    assert.deepEqual(audienceScopeGroups([]), []);
  });

  it("không đổi thứ tự và giữ nguyên đối tượng người đầu vào", () => {
    const [all] = audienceScopeGroups(DIRECTORY);
    assert.equal(all.people[0], DIRECTORY[0]);
    assert.equal(all.people[all.people.length - 1], DIRECTORY[DIRECTORY.length - 1]);
  });
});
