// figma-fetch.mjs — .env.local 의 FIGMA_TOKEN 으로 Figma API 호출.
// 결과를 docs/figma/ 와 images/figma/ 에 저장.

import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvLocal();

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY ?? "UJoPeW9SMzwDqX8B44eMrc";
const ROOT_NODE = process.env.FIGMA_ROOT_NODE ?? "251:4045";

if (!TOKEN) {
  console.error("FIGMA_TOKEN 이 .env.local 에 없음.");
  process.exit(1);
}

const headers = { "X-Figma-Token": TOKEN };

async function api(path) {
  const res = await fetch(`https://api.figma.com${path}`, { headers });
  const status = res.status;
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = null; }
  return { status, json, body };
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

const cmd = process.argv[2] ?? "tree";

if (cmd === "ping") {
  // 토큰 검증 — /v1/me
  const r = await api("/v1/me");
  console.log(`HTTP ${r.status}`);
  if (r.status === 200 && r.json) {
    console.log(`✓ token OK · user=${r.json.email ?? r.json.handle ?? "?"} · id=${r.json.id ?? "?"}`);
  } else {
    console.error("token 검증 실패:");
    console.error(r.body.slice(0, 500));
    process.exit(2);
  }
} else if (cmd === "tree") {
  // /v1/files/<key> 또는 /v1/files/<key>/nodes?ids=...
  console.log(`→ /v1/files/${FILE_KEY}/nodes?ids=${ROOT_NODE}`);
  const r = await api(`/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(ROOT_NODE)}`);
  console.log(`HTTP ${r.status}`);
  if (r.status !== 200 || !r.json) {
    console.error(r.body.slice(0, 1000));
    process.exit(3);
  }
  const outDir = resolve(ROOT, "docs/figma");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "figma-tree.json");
  writeFileSync(out, JSON.stringify(r.json, null, 2));
  console.log(`✓ saved ${out} (${(JSON.stringify(r.json).length / 1024).toFixed(1)}KB)`);

  // 파일 자체 메타도 받기 (페이지 목록 등)
  console.log(`→ /v1/files/${FILE_KEY}?depth=1`);
  const meta = await api(`/v1/files/${FILE_KEY}?depth=1`);
  if (meta.status === 200 && meta.json) {
    const metaOut = resolve(outDir, "figma-meta.json");
    writeFileSync(metaOut, JSON.stringify(meta.json, null, 2));
    console.log(`✓ saved ${metaOut}`);
    console.log(`  file name: ${meta.json.name}`);
    const pages = meta.json.document?.children ?? [];
    console.log(`  pages: ${pages.length}`);
    for (const p of pages) console.log(`    - ${p.id}  ${p.name}  (${p.type})`);
  }
} else if (cmd === "image") {
  const ids = process.argv.slice(3).join(",") || ROOT_NODE;
  console.log(`→ /v1/images/${FILE_KEY}?ids=${ids}&format=png&scale=2`);
  const r = await api(`/v1/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=png&scale=2`);
  console.log(`HTTP ${r.status}`);
  if (r.status !== 200 || !r.json || r.json.err) {
    console.error(r.body.slice(0, 1000));
    process.exit(4);
  }
  const outDir = resolve(ROOT, "images/figma");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const [nodeId, url] of Object.entries(r.json.images)) {
    if (!url) continue;
    const safe = nodeId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dest = resolve(outDir, `${safe}.png`);
    const size = await downloadTo(url, dest);
    console.log(`✓ ${nodeId} → ${dest} (${(size / 1024).toFixed(1)}KB)`);
  }
} else {
  console.error(`unknown cmd: ${cmd}. usage: figma-fetch.mjs <ping|tree|image [nodeId,...]>`);
  process.exit(1);
}
