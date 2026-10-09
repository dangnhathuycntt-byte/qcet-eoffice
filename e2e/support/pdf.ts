// Bộ dựng PDF tối thiểu cho fixture E2E (không thêm dependency). Mỗi trang có thể đặt khổ giấy,
// góc xoay và có/không có lớp văn bản (trang "scan" không có text).
export interface PdfPageSpec {
  width?: number;
  height?: number;
  rotate?: 0 | 90 | 180 | 270;
  text?: string | null;
}

export function buildPdf(pages: PdfPageSpec[]): Buffer {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length;
  const catalog = add("");
  const pagesRoot = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids: number[] = [];
  pages.forEach((page, index) => {
    const { width = 595, height = 842, rotate = 0, text } = page;
    const label = text === undefined ? `Trang ${index + 1}` : text;
    const stream = label ? `BT /F1 24 Tf 72 ${height - 96} Td (${label.replace(/[()\\]/g, "")}) Tj ET` : "q 0.9 g 0 0 10 10 re f Q";
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageObj = add(
      `<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${width} ${height}] ${rotate ? `/Rotate ${rotate} ` : ""}` +
        `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
    );
    kids.push(pageObj);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
  objects[pagesRoot - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export const corruptPdf = () => Buffer.from("%PDF-1.4\nthis is not a valid pdf body\n", "latin1");
