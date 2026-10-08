import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blocksToPlate,
  plateToBlocks,
  serializeBlocksToContent,
  parseContentToBlocks,
  TOGGLE_PLACEHOLDER,
} from "../src/components/tasks/detail/plate-block-codec";
import type { ContentBlockItem, ContentBlockType } from "../src/components/tasks/detail/task-block-editor";
import { readFileSync } from "node:fs";

const roundTrip = (blocks: ContentBlockItem[]) => serializeBlocksToContent(plateToBlocks(blocksToPlate(blocks)));

describe("Menu '/' — khối rỗng không được sinh ra khi lưu", () => {
  const emptyTypes: ContentBlockType[] = [
    "text", "bulleted_list", "numbered_list", "checklist", "heading", "quote", "callout",
    "toggle", "image", "attachment", "link", "bookmark", "media_embed",
  ];

  for (const type of emptyTypes) {
    it(`khối "${type}" chưa nhập nội dung → nội dung lưu là rỗng`, () => {
      assert.equal(roundTrip([{ id: "b1", type, content: "", ...(type === "heading" ? { level: 1 as const } : {}) }]), "");
    });
  }

  it("bảng chỉ có tiêu đề cột mẫu và ô trống → không lưu", () => {
    const table: ContentBlockItem = {
      id: "t1", type: "table", content: "",
      rows: [
        { cells: [1, 2, 3].map((n) => ({ content: `Cột ${n}`, isHeader: true })) },
        { cells: [0, 1, 2].map(() => ({ content: "" })) },
      ],
    };
    assert.equal(roundTrip([table]), "");
  });

  it("toggle còn nguyên chữ mẫu → không lưu", () => {
    assert.equal(roundTrip([{ id: "g1", type: "toggle", content: TOGGLE_PLACEHOLDER, open: true }]), "");
  });

  it("tài liệu chỉ có các khối rỗng → chuỗi rỗng; có thêm một đoạn chữ thì chỉ giữ đoạn chữ", () => {
    const blocks: ContentBlockItem[] = [
      { id: "a", type: "text", content: "" },
      { id: "b", type: "bulleted_list", content: "" },
      { id: "c", type: "text", content: "Nội dung thật" },
    ];
    const raw = roundTrip(blocks);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.blocks.length, 1);
    assert.equal(parsed.blocks[0].content, "Nội dung thật");
  });
});

describe("Menu '/' — khối có nội dung được lưu và đọc lại đủ", () => {
  it("bảng có dữ liệu giữ nguyên hàng/ô/tiêu đề", () => {
    const table: ContentBlockItem = {
      id: "t2", type: "table", content: "",
      rows: [
        { cells: [{ content: "Việc", isHeader: true }, { content: "Hạn", isHeader: true }] },
        { cells: [{ content: "Soạn kế hoạch" }, { content: "30/10" }] },
      ],
    };
    const [back] = parseContentToBlocks(roundTrip([table]));
    assert.equal(back.type, "table");
    assert.deepEqual(back.rows?.map((r) => r.cells.map((c) => c.content)), [["Việc", "Hạn"], ["Soạn kế hoạch", "30/10"]]);
    assert.equal(back.rows?.[0].cells[0].isHeader, true);
    assert.equal(back.rows?.[1].cells[0].isHeader, false);
  });

  it("toggle có chữ và trạng thái mở/đóng", () => {
    const [back] = parseContentToBlocks(roundTrip([{ id: "g2", type: "toggle", content: "Hướng dẫn nộp hồ sơ", open: false }]));
    assert.equal(back.type, "toggle");
    assert.equal(back.content, "Hướng dẫn nộp hồ sơ");
    assert.equal(back.open, false);
  });

  it("khối nhúng có URL được giữ lại", () => {
    const [back] = parseContentToBlocks(roundTrip([{ id: "m1", type: "media_embed", content: "", url: "https://www.youtube.com/watch?v=abc" }]));
    assert.equal(back.type, "media_embed");
    assert.equal(back.url, "https://www.youtube.com/watch?v=abc");
  });

  it("các loại văn bản cơ bản vẫn lưu đúng", () => {
    const blocks: ContentBlockItem[] = [
      { id: "1", type: "heading", content: "Mục tiêu", level: 2 },
      { id: "2", type: "checklist", content: "Gửi báo cáo", checked: true },
      { id: "3", type: "quote", content: "Chỉ đạo của Ban Giám đốc" },
      { id: "4", type: "divider", content: "" },
    ];
    const back = parseContentToBlocks(roundTrip(blocks));
    assert.deepEqual(back.map((b) => b.type), ["heading", "checklist", "quote", "divider"]);
    assert.equal(back[1].checked, true);
  });
});

describe("Menu '/' — giao diện", () => {
  const src = readFileSync("src/components/tasks/detail/task-block-editor.tsx", "utf8");

  it("mọi mục menu dùng icon vẽ riêng của dự án, không còn icon lucide", () => {
    const menu = src.slice(src.indexOf("const MENU_OPTIONS"), src.indexOf("];", src.indexOf("const MENU_OPTIONS")));
    const iconNames = [...menu.matchAll(/icon: (\w+)/g)].map((m) => m[1]);
    assert.equal(iconNames.length, 17);
    for (const n of iconNames) assert.ok(n.startsWith("TaskIconBlock"), `${n} phải là icon của dự án`);
  });

  it("ô nhập lệnh '/' có <input> thật giữ focus để gõ tiếp (node slash_input là void)", () => {
    const el = src.slice(src.indexOf("function foldText"), src.indexOf("function SlashMenu({"));
    assert.ok(el.includes("<input") && el.includes("inputRef.current?.focus()"), "phải tự lấy focus để gõ tiếp");
    assert.ok(el.includes("editor.tf.focus()"), "đóng/chọn xong phải trả focus về trình soạn thảo");
    assert.ok(el.includes('normalize("NFD")'), "lọc không phân biệt dấu để gõ 'hinh anh' vẫn khớp");
  });

  it("khối nhúng không còn URL mặc định có sẵn", () => {
    assert.ok(!src.includes("dQw4w9WgXcQ"));
  });
});
