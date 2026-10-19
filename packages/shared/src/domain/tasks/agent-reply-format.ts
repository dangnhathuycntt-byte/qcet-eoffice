/**
 * Định dạng tối giản cho câu trả lời của Agent (một phần Markdown): đoạn văn, tiêu đề `#`, danh sách `-`/`*`/`1.`,
 * trích dẫn `>`, đường kẻ `---`, chữ đậm `**…**` và bảng kiểu GFM (dòng tiêu đề, dòng `|---|`, các dòng dữ liệu). Thuần, trả cấu trúc để giao diện dựng
 * thành phần tử React (không chèn HTML).
 */

export type AgentReplyInline = { text: string; bold: boolean };

export type AgentReplyBlock =
  | { type: "heading"; inline: AgentReplyInline[] }
  | { type: "paragraph"; inline: AgentReplyInline[] }
  /** Dòng `>` liền nhau (mô hình hay dùng cho "Lưu ý"); giữ xuống dòng giữa các dòng. */
  | { type: "quote"; inline: AgentReplyInline[] }
  /** Dòng chỉ có `---` (hay `***`, `___`): mô hình dùng để ngăn hai phần của câu trả lời. */
  | { type: "divider" }
  | { type: "list"; ordered: boolean; items: AgentReplyInline[][] }
  /** Mỗi ô là chữ đã tách đậm; mọi dòng có đúng số ô của dòng tiêu đề (thiếu thì thêm ô rỗng, thừa thì bỏ). */
  | { type: "table"; header: AgentReplyInline[][]; rows: AgentReplyInline[][][] };

/** Tách `**đậm**`; dấu `**` lẻ giữ nguyên là chữ. */
export function parseAgentReplyInline(text: string): AgentReplyInline[] {
  const out: AgentReplyInline[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), bold: false });
    out.push({ text: match[1], bold: true });
    last = at + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.filter((part) => part.text.length > 0);
}

const LIST_ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const DIVIDER = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
/** Dòng ngăn tiêu đề của bảng: `|---|:--:|`, ống đầu và cuối có thể bỏ. */
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((cell) => cell.trim());
}

export function parseAgentReply(text: string): AgentReplyBlock[] {
  const blocks: AgentReplyBlock[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", inline: parseAgentReplyInline(paragraph.join("\n")) });
    paragraph = [];
  };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    // Bảng: dòng có `|` ngay trên dòng ngăn. Đang chạy dần mà chưa tới dòng ngăn thì vẫn là đoạn văn, tới thì thành bảng
    if (line.includes("|") && index + 1 < lines.length && TABLE_SEPARATOR.test(lines[index + 1]) && lines[index + 1].includes("-")) {
      flushParagraph();
      const header = splitTableRow(line);
      const fit = (cells: string[]) => header.map((_, i) => parseAgentReplyInline(cells[i] ?? ""));
      const rows: AgentReplyInline[][][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(fit(splitTableRow(lines[index])));
        index++;
      }
      index--;
      blocks.push({ type: "table", header: fit(header), rows });
      continue;
    }
    if (DIVIDER.test(line)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }
    const quote = line.match(QUOTE);
    if (quote) {
      flushParagraph();
      const quoted = [quote[1].trim()];
      while (index + 1 < lines.length && QUOTE.test(lines[index + 1]) && lines[index + 1].trim() !== ">") {
        index++;
        quoted.push((lines[index].match(QUOTE)?.[1] ?? "").trim());
      }
      blocks.push({ type: "quote", inline: parseAgentReplyInline(quoted.join("\n")) });
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", inline: parseAgentReplyInline(heading[1].trim()) });
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (item) {
      flushParagraph();
      const ordered = Boolean(item[2]);
      const prev = blocks[blocks.length - 1];
      const inline = parseAgentReplyInline(item[3].trim());
      if (prev?.type === "list" && prev.ordered === ordered) prev.items.push(inline);
      else blocks.push({ type: "list", ordered, items: [inline] });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

/** Chữ thuần (bỏ dấu định dạng) để sao chép câu trả lời. */
export function agentReplyToPlainText(text: string): string {
  return parseAgentReply(text)
    .map((block) => {
      const join = (inline: AgentReplyInline[]) => inline.map((part) => part.text).join("");
      if (block.type === "list") return block.items.map((item, i) => `${block.ordered ? `${i + 1}.` : "-"} ${join(item)}`).join("\n");
      // Bảng sao chép thành các dòng cách nhau bằng Tab: dán vào Excel hay Word ra đúng cột
      if (block.type === "table") return [block.header, ...block.rows].map((row) => row.map(join).join("\t")).join("\n");
      if (block.type === "divider") return "";
      return join(block.inline);
    })
    .filter(Boolean)
    .join("\n\n");
}
