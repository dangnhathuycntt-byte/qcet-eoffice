/**
 * Trung thực về chữ ký (spec Văn bản G1/G4, quyết định D1): QCET chưa ký số bằng chứng thư nên mã nguồn không được ghi
 * bản ghi ký VALID cho văn bản đi, không được gán cứng tên nhà cung cấp CA. Quét mã nguồn để chặn tái phạm; hành vi
 * ghi bản ghi được kiểm ở `outgoing-documents-v2` và `outgoing-initial-sign`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const API_SRC = path.resolve(__dirname, "../src");
const WEB_SRC = path.resolve(__dirname, "../../web/src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("Chữ ký văn bản đi: không giả vờ có chứng thư", () => {
  it("không nơi nào gán cứng tên nhà cung cấp CA", () => {
    const hits = [...sourceFiles(API_SRC), ...sourceFiles(WEB_SRC)].filter((file) =>
      /Ban Cơ yếu Chính phủ|Cục Chứng thực số/.test(readFileSync(file, "utf8"))
    );
    assert.deepEqual(hits.map((f) => path.relative(path.resolve(__dirname, "../../.."), f)), []);
  });

  it("các nơi ghi bản ghi ký của văn bản đi dùng trạng thái xác nhận nội bộ, không VALID", () => {
    for (const rel of ["documents/outgoing-document-service.ts", "documents/outgoing-initial-sign.ts"]) {
      const source = readFileSync(path.join(API_SRC, "server", rel), "utf8");
      assert.ok(!/verificationStatus:\s*SignatureVerificationStatus\.VALID/.test(source), `${rel} ghi VALID`);
    }
  });
});
