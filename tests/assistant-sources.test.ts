import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { AssistantSourceRef, AssistantSourceType } from "@qcet/contracts/assistant";
import {
  assistantSourceHref,
  dedupeSources,
  linkSourceCodes,
  selectCitedSources,
} from "@qcet/shared/domain/assistant/assistant-sources";

function source(type: AssistantSourceType, id: string, code: string | null, title = `Tiêu đề ${id}`): AssistantSourceRef {
  return { type, id, code, title, href: assistantSourceHref(type, id) };
}

const TASK_1 = source("task", "t1", "NV-2026-09-001", "Chuẩn bị hội nghị");
const TASK_2 = source("task", "t2", "NV-2026-09-002", "Rà soát kinh phí");
const DOC_1 = source("document", "d1", "123/QĐ-UBND", "Quyết định phân công");

describe("Trợ lý: đường dẫn nguồn", () => {
  test("href theo loại bản ghi, mã văn bản được mã hóa", () => {
    assert.equal(assistantSourceHref("task", "t1"), "/tasks/t1");
    assert.equal(assistantSourceHref("meeting", "m1"), "/meetings/m1");
    assert.equal(assistantSourceHref("document", "a b/c"), "/documents?docId=a%20b%2Fc");
  });

  test("khử trùng theo loại và mã, giữ phần tử đầu tiên", () => {
    const first = source("task", "t1", "NV-2026-09-001", "Bản đầu");
    const again = source("task", "t1", "NV-2026-09-001", "Bản sau");
    const sameIdOtherType = source("document", "t1", null, "Văn bản cùng mã");
    assert.deepEqual(dedupeSources([first, again, sameIdOtherType]), [first, sameIdOtherType]);
  });
});

describe("linkSourceCodes: tách mã nguồn trong chữ", () => {
  test("mã ở đầu, giữa và cuối câu", () => {
    const parts = linkSourceCodes("NV-2026-09-001 đang trễ hạn, xem thêm NV-2026-09-002", [TASK_1, TASK_2]);
    assert.deepEqual(parts, [
      { text: "NV-2026-09-001", href: "/tasks/t1", title: "Chuẩn bị hội nghị" },
      { text: " đang trễ hạn, xem thêm " },
      { text: "NV-2026-09-002", href: "/tasks/t2", title: "Rà soát kinh phí" },
    ]);
  });

  test("mã là tiền tố của mã dài hơn: mã dài khớp trước, mã ngắn không khớp giữa chừng", () => {
    const longer = source("task", "t9", "NV-2026-09-0011", "Mã dài");
    const parts = linkSourceCodes("NV-2026-09-0011 và NV-2026-09-001 cùng NV-2026-09-0012", [TASK_1, longer]);
    assert.deepEqual(parts, [
      { text: "NV-2026-09-0011", href: "/tasks/t9", title: "Mã dài" },
      { text: " và " },
      { text: "NV-2026-09-001", href: "/tasks/t1", title: "Chuẩn bị hội nghị" },
      { text: " cùng NV-2026-09-0012" },
    ]);
  });

  test("mã dính liền chữ hoặc số không bị tách", () => {
    assert.deepEqual(linkSourceCodes("ABCNV-2026-09-001 và NV-2026-09-001x", [TASK_1]), [{ text: "ABCNV-2026-09-001 và NV-2026-09-001x" }]);
    // Chữ Việt có dấu cũng là chữ
    assert.deepEqual(linkSourceCodes("ĐNV-2026-09-001", [TASK_1]), [{ text: "ĐNV-2026-09-001" }]);
  });

  test("mã có ký tự đặc biệt (số/ký hiệu văn bản) khớp đúng", () => {
    assert.deepEqual(linkSourceCodes("Theo 123/QĐ-UBND, việc đã xong.", [DOC_1]), [
      { text: "Theo " },
      { text: "123/QĐ-UBND", href: "/documents?docId=d1", title: "Quyết định phân công" },
      { text: ", việc đã xong." },
    ]);
  });

  test("URL trong chữ giữ nguyên, không thành link và không tách mã bên trong", () => {
    const parts = linkSourceCodes("Xem https://qcet.example/tasks/NV-2026-09-001 nhé", [TASK_1]);
    assert.deepEqual(parts, [{ text: "Xem " }, { text: "https://qcet.example/tasks/NV-2026-09-001" }, { text: " nhé" }]);
  });

  test("dấu tổ hợp (chữ Việt dạng NFD) dính vào mã cũng là chữ, không tách", () => {
    const nfd = "Ệ".normalize("NFD"); // Ệ ở dạng E + dấu dưới + dấu mũ
    assert.equal(nfd.length, 3);
    assert.deepEqual(linkSourceCodes(`${nfd}NV-2026-09-001`, [TASK_1]), [{ text: `${nfd}NV-2026-09-001` }]);
    assert.deepEqual(linkSourceCodes("NV-2026-09-001́", [TASK_1]), [{ text: "NV-2026-09-001́" }]);
  });

  test("mã lặp lại đều thành link; hai nguồn cùng mã thì nguồn đầu thắng", () => {
    const twin = source("task", "t3", "NV-2026-09-001", "Bản trùng mã");
    const link = { href: "/tasks/t1", title: "Chuẩn bị hội nghị" };
    assert.deepEqual(linkSourceCodes("NV-2026-09-001, rồi NV-2026-09-001", [TASK_1, twin]), [
      { text: "NV-2026-09-001", ...link },
      { text: ", rồi " },
      { text: "NV-2026-09-001", ...link },
    ]);
  });

  test("mã trong ngoặc, cạnh dấu / hoặc - vẫn là mã đứng riêng; mã nối tiếp chữ/số qua dấu nối thì không tách", () => {
    const link = { href: "/tasks/t1", title: "Chuẩn bị hội nghị" };
    assert.deepEqual(linkSourceCodes("(NV-2026-09-001)/NV-2026-09-001-A", [TASK_1]), [
      { text: "(" },
      { text: "NV-2026-09-001", ...link },
      { text: ")/NV-2026-09-001-A" },
    ]);
  });

  test("mã kết thúc câu bằng dấu chấm vẫn là link", () => {
    const link = { href: "/tasks/t1", title: "Chuẩn bị hội nghị" };
    assert.deepEqual(linkSourceCodes("Việc NV-2026-09-001. Tiếp theo", [TASK_1]), [
      { text: "Việc " },
      { text: "NV-2026-09-001", ...link },
      { text: ". Tiếp theo" },
    ]);
  });

  test("mã nối sau bằng dấu nối/chia/chấm rồi chữ hoặc số thì không tách (mã dài hơn)", () => {
    assert.deepEqual(linkSourceCodes("NV-2026-09-001-A và NV-2026-09-001/2 và NV-2026-09-001.5", [TASK_1]), [
      { text: "NV-2026-09-001-A và NV-2026-09-001/2 và NV-2026-09-001.5" },
    ]);
  });

  test("mã nối phía trước bằng dấu nối/chia/chấm rồi chữ hoặc số thì không tách", () => {
    assert.deepEqual(linkSourceCodes("A-NV-2026-09-001 và 2026/NV-2026-09-001", [TASK_1]), [
      { text: "A-NV-2026-09-001 và 2026/NV-2026-09-001" },
    ]);
  });

  test("mã có dấu / ở giữa: 12/QĐ-ABC/2026 không tách, 12/QĐ-ABC đứng riêng thì tách", () => {
    const decree = source("document", "d3", "12/QĐ-ABC", "Quyết định");
    const link = { href: "/documents?docId=d3", title: "Quyết định" };
    assert.deepEqual(linkSourceCodes("Số 12/QĐ-ABC/2026 và 12/QĐ-ABC.", [decree]), [
      { text: "Số 12/QĐ-ABC/2026 và " },
      { text: "12/QĐ-ABC", ...link },
      { text: "." },
    ]);
  });

  test("URL www. cũng giữ nguyên như chữ", () => {
    assert.deepEqual(linkSourceCodes("Xem www.qcet.example/NV-2026-09-001 nhé", [TASK_1]), [
      { text: "Xem " },
      { text: "www.qcet.example/NV-2026-09-001" },
      { text: " nhé" },
    ]);
  });

  test("mã null, mã quá ngắn hoặc không có trong nguồn không bao giờ thành link", () => {
    const noCode = source("meeting", "m1", null);
    const short = source("document", "d2", "1");
    assert.deepEqual(linkSourceCodes("Mã 1 và NV-2026-09-999 không có nguồn", [noCode, short]), [
      { text: "Mã 1 và NV-2026-09-999 không có nguồn" },
    ]);
  });

  test("không có nguồn thì trả đúng chữ gốc", () => {
    assert.deepEqual(linkSourceCodes("Chữ thường", []), [{ text: "Chữ thường" }]);
    assert.deepEqual(linkSourceCodes("", [TASK_1]), []);
  });
});

describe("selectCitedSources: nguồn lưu kèm câu trả lời", () => {
  test("nguồn có mã được nhắc trước, rồi tới nguồn đọc chi tiết chưa được nhắc; khử trùng", () => {
    const answer = "Có NV-2026-09-002 cần xử lý.";
    const read = [TASK_1, TASK_2, DOC_1];
    const detailed = [TASK_1, TASK_1];
    assert.deepEqual(selectCitedSources(answer, read, detailed), [TASK_2, TASK_1]);
  });

  test("nguồn được nhắc giữ thứ tự xuất hiện trong câu trả lời", () => {
    const answer = "Trước hết NV-2026-09-002, sau đó NV-2026-09-001.";
    assert.deepEqual(selectCitedSources(answer, [TASK_1, TASK_2], []), [TASK_2, TASK_1]);
  });

  test("nguồn đọc (không chi tiết) chưa được nhắc thì không lưu", () => {
    assert.deepEqual(selectCitedSources("Không có mã nào.", [TASK_1, DOC_1], []), []);
  });

  test("mã nằm trong URL không tính là đã nhắc tới", () => {
    const answer = "Xem https://qcet.example/tasks/NV-2026-09-002 để biết thêm.";
    assert.deepEqual(selectCitedSources(answer, [TASK_2], []), []);
  });

  test("giới hạn số nguồn bằng max, mặc định 12", () => {
    const many = Array.from({ length: 15 }, (_, i) => source("task", `x${i}`, `NV-2026-10-${String(i).padStart(3, "0")}`));
    assert.equal(selectCitedSources("", [], many).length, 12);
    assert.deepEqual(selectCitedSources("", [], many, 2), many.slice(0, 2));
  });

  test("mã trong câu trả lời phải đúng ranh giới chữ/số", () => {
    // NV-2026-09-0011 không được tính là đã nhắc tới NV-2026-09-001
    assert.deepEqual(selectCitedSources("Có NV-2026-09-0011.", [TASK_1], []), []);
    // NV-2026-09-001-A là mã khác, không tính là đã nhắc tới NV-2026-09-001
    assert.deepEqual(selectCitedSources("Có NV-2026-09-001-A.", [TASK_1], []), []);
  });

  test("bỏ qua nguồn đã đọc không có mã hoặc mã quá ngắn", () => {
    const noCode = source("meeting", "m1", null);
    const short = source("document", "d2", "1");
    assert.deepEqual(selectCitedSources("Mã 1 và NV-2026-09-002", [noCode, short, TASK_2], []), [TASK_2]);
  });
});
