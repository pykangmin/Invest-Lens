// verify-structure.mjs — LAYERS.md 의 YAML 매트릭스를 파싱해 src/ 의 import 위반을 검출.
// 외부 라이브러리 의존 없음. node ESM 으로 동작.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
const LAYERS_DOC = resolve(ROOT, "docs/architecture/LAYERS.md");

function fail(msg) {
  process.stderr.write(`\x1b[1;31m✗ verify-structure: ${msg}\x1b[0m\n`);
  process.exit(1);
}

// 1. LAYERS.md 에서 기계 판독용 YAML 블록 추출.
const doc = readFileSync(LAYERS_DOC, "utf8");
const yamlBlock = doc.match(/```yaml[\s\S]*?```/);
if (!yamlBlock) fail("LAYERS.md 에서 YAML 블록을 찾지 못함.");

// 2. - name: <layer> / can_import: [...] 항목 파싱.
const layers = {};
const re = /-\s+name:\s+([\w-]+)\s*\n\s+can_import:\s+\[([^\]]*)\]/g;
let m;
while ((m = re.exec(yamlBlock[0]))) {
  layers[m[1]] = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
if (Object.keys(layers).length === 0) fail("YAML 블록에서 레이어 정의를 파싱하지 못함.");

// 3. src/ 의 모든 .ts/.tsx 수집.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);

// 4. import 구문 추출 + 분석.
const importRe = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
const violations = [];

for (const file of files) {
  const rel = relative(SRC, file).split(sep);
  const fromLayer = rel.length > 1 ? rel[0] : null; // src 직속 파일은 레이어 없음
  if (!fromLayer || !layers[fromLayer]) continue;

  const allowed = new Set([...layers[fromLayer], fromLayer]); // 같은 레이어 내부는 항상 허용
  const src = readFileSync(file, "utf8");
  let im;
  importRe.lastIndex = 0;
  while ((im = importRe.exec(src))) {
    const spec = im[1];
    if (!spec.startsWith(".")) continue; // 외부 라이브러리는 매트릭스 제약 X
    const resolved = resolve(dirname(file), spec);
    const r = relative(SRC, resolved);
    if (r.startsWith("..")) continue; // src 밖
    const targetLayer = r.split(sep)[0];
    if (!layers[targetLayer]) continue; // 미등록 디렉토리는 검사 대상 외

    if (!allowed.has(targetLayer)) {
      const line = src.slice(0, im.index).split("\n").length;
      violations.push({ file: relative(ROOT, file), line, spec, fromLayer, targetLayer });
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`\x1b[1;31m✗ verify-structure: ${violations.length} 건의 의존성 위반\x1b[0m\n\n`);
  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line}\n`);
    process.stderr.write(`    Import: '${v.spec}'\n`);
    process.stderr.write(`    Problem: '${v.fromLayer}' 레이어가 '${v.targetLayer}' 레이어를 import 할 수 없음\n`);
    const allowList = layers[v.fromLayer].join(", ") || "(없음)";
    process.stderr.write(`    Rule: '${v.fromLayer}' 의 can_import = [${allowList}]\n\n`);
  }
  process.stderr.write("교정 방향은 docs/architecture/LAYERS.md 의 '위반 예시와 교정' 섹션 참조.\n");
  process.exit(1);
}

process.stdout.write(`\x1b[1;32m✓ verify-structure: ${files.length} 파일 검사, 위반 없음\x1b[0m\n`);
