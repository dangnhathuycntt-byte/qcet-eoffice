import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Wave 1: Motion System Architecture", () => {
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  it("package.json includes motion and strictly omits framer-motion", () => {
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    assert.ok(
      dependencies["motion"] || devDependencies["motion"],
      "motion must be present in package dependencies"
    );
    assert.strictEqual(
      dependencies["framer-motion"],
      undefined,
      "framer-motion must not be installed in dependencies"
    );
    assert.strictEqual(
      devDependencies["framer-motion"],
      undefined,
      "framer-motion must not be installed in devDependencies"
    );
  });

  it("features.ts strictly exports domMax from motion/react", () => {
    const featuresPath = path.join(rootDir, "src/lib/motion/features.ts");
    assert.ok(fs.existsSync(featuresPath), "src/lib/motion/features.ts must exist");
    const content = fs.readFileSync(featuresPath, "utf8");
    assert.match(content, /import\s*\{\s*domMax\s*\}\s*from\s*["']motion\/react["']/);
    assert.match(content, /export\s+default\s+domMax/);
    assert.doesNotMatch(content, /domAnimation/, "Must not use domAnimation as domMax is required for layout/layoutId");
  });

  it("motion tokens define required durations, easings, and transitions", () => {
    const tokensPath = path.join(rootDir, "src/lib/motion/tokens.ts");
    assert.ok(fs.existsSync(tokensPath), "src/lib/motion/tokens.ts must exist");
    const content = fs.readFileSync(tokensPath, "utf8");
    assert.match(content, /motionDuration/);
    assert.match(content, /instant:\s*0\.1/);
    assert.match(content, /fast:\s*0\.14/);
    assert.match(content, /normal:\s*0\.18/);
    assert.match(content, /panel:\s*0\.22/);
    assert.match(content, /motionEase/);
    assert.match(content, /motionTransition/);
  });

  it("motion variants define canonical variants", () => {
    const variantsPath = path.join(rootDir, "src/lib/motion/variants.ts");
    assert.ok(fs.existsSync(variantsPath), "src/lib/motion/variants.ts must exist");
    const content = fs.readFileSync(variantsPath, "utf8");
    assert.match(content, /export\s+const\s+fadeVariants/);
    assert.match(content, /export\s+const\s+popoverVariants/);
    assert.match(content, /export\s+const\s+dialogVariants/);
    assert.match(content, /export\s+const\s+sideSheetVariants/);
    assert.match(content, /export\s+const\s+toastVariants/);
    assert.match(content, /export\s+const\s+listItemVariants/);
  });

  it("MotionProvider enforces LazyMotion strict and MotionConfig user preference", () => {
    const providerPath = path.join(
      rootDir,
      "src/components/motion/motion-provider.tsx"
    );
    assert.ok(
      fs.existsSync(providerPath),
      "src/components/motion/motion-provider.tsx must exist"
    );
    const content = fs.readFileSync(providerPath, "utf8");
    assert.match(content, /"use client"/);
    assert.match(content, /<MotionConfig\s+reducedMotion="user">/);
    assert.match(content, /<LazyMotion\s+features=\{loadFeatures\}\s+strict>/);
  });

  it("src/app/layout.tsx wraps tree in MotionProvider as a Server Component", () => {
    const layoutPath = path.join(rootDir, "src/app/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf8");
    assert.doesNotMatch(content, /"use client"/, "layout.tsx must remain a Server Component");
    assert.match(
      content,
      /import\s*\{\s*MotionProvider\s*\}\s*from\s*["']@\/components\/motion\/motion-provider["']/
    );
    assert.match(
      content,
      /<MotionProvider>[\s\S]*?<AuthProvider>[\s\S]*?<\/AuthProvider>[\s\S]*?<\/MotionProvider>/
    );
  });

  it("No codebase file imports from framer-motion", () => {
    function searchFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...searchFiles(fullPath));
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = [
      ...searchFiles(path.join(rootDir, "src")),
      ...searchFiles(path.join(rootDir, "tests")),
    ];

    const forbiddenImportDouble = ['from', '"framer-motion"'].join(' ');
    const forbiddenImportSingle = ['from', "'framer-motion'"].join(' ');

    const violations: string[] = [];
    for (const file of files) {
      if (file === path.join(rootDir, "tests/motion-system.test.ts")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf8");
      if (content.includes(forbiddenImportDouble) || content.includes(forbiddenImportSingle)) {
        violations.push(path.relative(rootDir, file));
      }
    }

    assert.deepStrictEqual(
      violations,
      [],
      `framer-motion imports detected in files: ${violations.join(", ")}`
    );
  });
});
