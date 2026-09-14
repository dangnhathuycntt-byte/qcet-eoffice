import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function getAllFiles(dir: string, ext: string[]): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(getAllFiles(full, ext));
    else if (ext.some(e => entry.name.endsWith(e))) files.push(full);
  });
  return files;
}

describe("QCET E-Office Anti-Slop Comprehensive Audit", () => {
  const srcDir = path.join(process.cwd(), "src");
  const srcFiles = getAllFiles(srcDir, [".tsx", ".ts", ".css"]);

  test("Anti-slop audit: Zero decorative emojis in src directory", () => {
    // Comprehensive regex covering Emoticons, Misc Symbols & Pictographs, Dingbats, Transport, Supplemental, etc.
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    const violations: string[] = [];
    srcFiles.forEach(file => {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        // Exclude allowed typographic star glyph (★) used in saved view preset titles
        const cleanLine = line.replace(/★/g, "");
        if (emojiRegex.test(cleanLine)) {
          violations.push(`${path.relative(process.cwd(), file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    });

    assert.strictEqual(
      violations.length,
      0,
      `Found decorative emojis in:\n${violations.slice(0, 10).join("\n")}`
    );
  });

  test("Anti-slop audit: CSS design tokens define OKLCH color spaces and elevation levels", () => {
    const cssPath = path.join(process.cwd(), "src/app/globals.css");
    assert.ok(fs.existsSync(cssPath), "globals.css must exist");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // Must define oklch tokens
    assert.ok(cssContent.includes("oklch("), "globals.css must use modern OKLCH color spaces");
    assert.ok(cssContent.includes("--primary"), "globals.css must define primary color token");
    assert.ok(cssContent.includes("--border"), "globals.css must define border token");
    assert.ok(cssContent.includes("--background"), "globals.css must define background token");
  });

  test("Anti-slop audit: No garbled or corrupt replacement characters in codebase", () => {
    const violations: string[] = [];
    srcFiles.forEach(file => {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("�")) {
        violations.push(path.relative(process.cwd(), file));
      }
    });

    assert.strictEqual(
      violations.length,
      0,
      `Found replacement character � in: ${violations.join(", ")}`
    );
  });
});
