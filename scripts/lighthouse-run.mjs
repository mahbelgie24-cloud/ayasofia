/** Lighthouse mobile runs against the local production server. */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "docs/ux-audit/2026-08-17";
mkdirSync(OUT, { recursive: true });
const routes = [
  ["landing", "/"],
  ["menu", "/m/qalqilya"],
  ["login", "/login"],
  ["wifi", "/wifi"],
];
for (const [name, path] of routes) {
  const res = spawnSync(
    "npx",
    [
      "lighthouse",
      `http://localhost:3000${path}`,
      "--preset=perf",
      "--quiet",
      "--chrome-flags=--headless=new",
      `--output-path=${OUT}/lighthouse-${name}.json`,
      "--output=json",
    ],
    { encoding: "utf8", timeout: 180000 },
  );
  if (res.status !== 0) {
    console.log(`${name}: FAILED`, (res.stderr || "").slice(0, 300));
    continue;
  }
  try {
    const report = JSON.parse(
      await import("node:fs").then((m) => m.readFileSync(`${OUT}/lighthouse-${name}.json`, "utf8")),
    );
    const a = report.audits;
    console.log(
      `${name}: perf=${Math.round(report.categories.performance.score * 100)} LCP=${a["largest-contentful-paint"].displayValue} CLS=${a["cumulative-layout-shift"].displayValue} TBT=${a["total-blocking-time"].displayValue} FCP=${a["first-contentful-paint"].displayValue} SI=${a["speed-index"].displayValue}`,
    );
  } catch (e) {
    console.log(`${name}: parse error`, String(e).slice(0, 120));
  }
}
