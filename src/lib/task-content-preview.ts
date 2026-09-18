type ContentBlock = {
  type?: string;
  content?: unknown;
  title?: unknown;
  text?: unknown;
  items?: unknown;
  checked?: boolean;
};

/** Convert persisted QCET block content to a small, safe plain-text preview. */
export function getTaskContentPreview(raw?: string | null): string {
  if (!raw?.trim()) return "";
  if (!raw.includes('"qcetBlocks":true')) return raw.trim();
  try {
    const parsed = JSON.parse(raw) as { blocks?: ContentBlock[] };
    if (!Array.isArray(parsed.blocks)) return raw.trim();
    return parsed.blocks
      .flatMap((block) => {
        if (!block || ["divider", "image", "video", "file", "subtasks_view"].includes(block.type || "")) return [];
        const values = [block.content, block.title, block.text, ...(Array.isArray(block.items) ? block.items : [])];
        const text = values
          .map((value) => typeof value === "string" ? value : value && typeof value === "object" && "content" in value ? String((value as { content?: unknown }).content ?? "") : "")
          .filter(Boolean)
          .join(" ")
          .trim();
        return text ? [text] : [];
      })
      .join("\n")
      .trim();
  } catch {
    return raw.trim();
  }
}
