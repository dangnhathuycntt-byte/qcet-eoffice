/**
 * Định dạng tối giản cho câu trả lời của Agent (một phần Markdown): đoạn văn, tiêu đề `#`, danh sách `-`/`*`/`1.`
 * và chữ đậm `**…**`. Thuần, trả cấu trúc để giao diện dựng thành phần tử React (không chèn HTML).
 */

export type AgentReplyInline = { text: string; bold: boolean };

export type AgentReplyBlock =
  | { type: "heading"; inline: AgentReplyInline[] }
  | { type: "paragraph"; inline: AgentReplyInline[] }
  | { type: "list"; ordered: boolean; items: AgentReplyInline[][] };

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

export function parseAgentReply(text: string): AgentReplyBlock[] {
  const blocks: AgentReplyBlock[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", inline: parseAgentReplyInline(paragraph.join("\n")) });
    paragraph = [];
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
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
      return join(block.inline);
    })
    .join("\n\n");
}
