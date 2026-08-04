import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components", "lib", "hooks"];
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx"]);

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (ALLOWED_EXTENSIONS.has(extname(entry))) {
        results.push(full);
      }
    }
  }
  return results;
}

describe("Grep hygiene — no native alert() in application code", () => {
  it("does not contain any alert( call sites", () => {
    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const scanDir of SCAN_DIRS) {
      const dir = join(ROOT, scanDir);
      const files = findSourceFiles(dir);
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (/^\s*alert\s*\(/.test(line)) {
            violations.push({
              file: file.replace(ROOT + "/", ""),
              line: idx + 1,
              content: line.trim(),
            });
          }
        });
      }
    }

    if (violations.length > 0) {
      console.error("Found alert() call sites:\n", JSON.stringify(violations, null, 2));
    }
    expect(violations).toHaveLength(0);
  });
});
