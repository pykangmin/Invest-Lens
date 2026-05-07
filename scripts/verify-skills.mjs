// verify-skills.mjs — Skills 파일들의 정합성 검사.
// 검사 항목:
//   (1) 8개 필수 파일이 존재한다.
//   (2) frontmatter references 리스트의 파일이 모두 존재한다.
//   (3) 본문에서 인용한 다른 skills 파일이 모두 존재한다.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = resolve(ROOT, "skills");

const REQUIRED = [
  "00-assumptions.md",
  "01-data-profile.md",
  "02-data-analysis.md",
  "03-insight.md",
  "11-ingest.md",
  "12-analyze.md",
  "13-render.md",
  "21-frontend-aesthetics.md",
];

const errors = [];

// (1) 필수 파일 존재.
const present = new Set(readdirSync(SKILLS).filter((f) => f.endsWith(".md")));
for (const f of REQUIRED) {
  if (!present.has(f)) errors.push({ kind: "missing", file: f });
}

if (errors.length > 0) {
  for (const e of errors) {
    process.stderr.write(`\x1b[1;31m✗ MISSING: skills/${e.file}\x1b[0m\n`);
  }
  process.exit(1);
}

// (2) + (3) reference 무결성.
const refRegex = /(?<![\w/-])(\d{2}-[a-z-]+\.md)/g;

const dangling = [];
for (const f of REQUIRED) {
  const path = join(SKILLS, f);
  const body = readFileSync(path, "utf8");
  const matches = body.matchAll(refRegex);
  const seen = new Set();
  for (const m of matches) {
    const target = m[1];
    if (target === f) continue; // 자기 자신 제외
    if (seen.has(target)) continue;
    seen.add(target);
    if (!present.has(target)) {
      const line = body.slice(0, m.index).split("\n").length;
      dangling.push({ from: f, to: target, line });
    }
  }
}

if (dangling.length > 0) {
  process.stderr.write(`\x1b[1;31m✗ verify-skills: ${dangling.length} 건의 dangling reference\x1b[0m\n\n`);
  for (const d of dangling) {
    process.stderr.write(`  skills/${d.from}:${d.line}\n`);
    process.stderr.write(`    Reference: '${d.to}' 파일이 skills/ 에 존재하지 않음\n\n`);
  }
  process.stderr.write("교정 방향: 파일명 오타 확인, 또는 referenced 파일을 추가/rename.\n");
  process.exit(1);
}

process.stdout.write(
  `\x1b[1;32m✓ verify-skills: ${REQUIRED.length} 파일 존재, reference 무결성 OK\x1b[0m\n`,
);
