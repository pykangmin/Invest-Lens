// figma-extract-screens.mjs — figma-tree.json 의 4 화면 프레임 각각을
// 텍스트·hex·폰트·좌표가 모두 살아있는 wireframe spec 으로 추출.
//
// 입력: docs/figma/figma-tree.json (이미 fetch 된 것)
// 출력: docs/figma/screens/<frame-id>.json — 화면별 1 파일
//       docs/figma/screens/_index.md — 사람이 훑는 요약
//
// 기존 figma-extract-slots.mjs 와 차이:
//   - depth 무제한 (전체 트리 보존)
//   - 좌표는 화면 프레임 기준 상대값 (절대 px 가 아님)
//   - 화면 단위 분리 (4 화면 4 파일)
//   - TEXT 노드는 부모에 흡수하지 않고 자체 노드로 남김 — 본문 캡처 손실 0

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TREE_PATH = resolve(ROOT, "docs/figma/figma-tree.json");
const OUT_DIR = resolve(ROOT, "docs/figma/screens");

const SCREENS = [
  { id: "219:2558", slug: "home", label: "진입화면" },
  { id: "251:3523", slug: "main", label: "개별 주식화면" },
  { id: "271:561", slug: "main-commodity", label: "원자재 영향 분석" },
  { id: "327:456", slug: "main-technical", label: "기술적 흐름" },
];

const tree = JSON.parse(readFileSync(TREE_PATH, "utf8"));
const pageEntry = tree.nodes?.["0:1"]?.document;
if (!pageEntry) {
  console.error("page node 0:1 not found");
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function find(n, id) {
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const r = find(c, id);
    if (r) return r;
  }
  return null;
}

function rgbToHex(c) {
  if (!c) return null;
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  const hex = `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  if (c.a !== undefined && c.a < 1) return `${hex}${to(c.a)}`;
  return hex;
}

function fillsToHexList(fills) {
  if (!Array.isArray(fills)) return [];
  return fills
    .filter((f) => f.visible !== false)
    .map((f) => {
      if (f.type === "SOLID") return { type: "SOLID", hex: rgbToHex(f.color), opacity: f.opacity ?? 1 };
      if (f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL") {
        return {
          type: f.type,
          stops: (f.gradientStops ?? []).map((s) => ({ pos: s.position, hex: rgbToHex(s.color) })),
        };
      }
      if (f.type === "IMAGE") return { type: "IMAGE", scaleMode: f.scaleMode ?? null };
      return { type: f.type };
    });
}

function strokeToHex(strokes) {
  if (!Array.isArray(strokes)) return null;
  const f = strokes.find((s) => s.type === "SOLID" && s.visible !== false);
  return f ? rgbToHex(f.color) : null;
}

function relBox(originBox, box) {
  if (!box) return null;
  return {
    x: Math.round(box.x - originBox.x),
    y: Math.round(box.y - originBox.y),
    w: Math.round(box.width),
    h: Math.round(box.height),
  };
}

// 노드 1개 → 직렬화 가능한 lean object.
// children 은 재귀.
function serializeNode(node, originBox) {
  const box = relBox(originBox, node.absoluteBoundingBox);
  const out = {
    id: node.id,
    name: node.name,
    type: node.type,
    box,
  };

  if (node.type === "TEXT") {
    out.text = node.characters ?? "";
    const s = node.style ?? {};
    out.font = {
      family: s.fontFamily ?? null,
      weight: s.fontWeight ?? null,
      size: s.fontSize ?? null,
      lineHeight: s.lineHeightPx ?? s.lineHeightPercent ?? null,
      letterSpacing: s.letterSpacing ?? null,
      align: s.textAlignHorizontal ?? null,
      decoration: s.textDecoration ?? null,
    };
    out.fills = fillsToHexList(node.fills);
    // styled spans (다른 색·굵기 강조)
    if (node.characterStyleOverrides && node.styleOverrideTable) {
      const overrides = {};
      for (const [k, v] of Object.entries(node.styleOverrideTable)) {
        const styled = {};
        if (v.fontFamily) styled.family = v.fontFamily;
        if (v.fontWeight) styled.weight = v.fontWeight;
        if (v.fontSize) styled.size = v.fontSize;
        if (v.fills) styled.fills = fillsToHexList(v.fills);
        if (Object.keys(styled).length) overrides[k] = styled;
      }
      if (Object.keys(overrides).length) {
        out.characterStyleOverrides = node.characterStyleOverrides;
        out.styleOverrideTable = overrides;
      }
    }
    if (Array.isArray(node.effects) && node.effects.length) {
      out.effects = node.effects
        .filter((e) => e.visible !== false)
        .map((e) => ({
          type: e.type,
          color: e.color ? rgbToHex(e.color) : null,
          offset: e.offset ? { x: Math.round(e.offset.x), y: Math.round(e.offset.y) } : null,
          radius: e.radius ?? null,
          spread: e.spread ?? null,
        }));
    }
    return out;
  }

  if (node.fills?.length) out.fills = fillsToHexList(node.fills);
  if (node.strokes?.length) {
    const sh = strokeToHex(node.strokes);
    if (sh) out.stroke = { hex: sh, weight: node.strokeWeight ?? null };
  }
  if (Array.isArray(node.effects) && node.effects.length) {
    out.effects = node.effects
      .filter((e) => e.visible !== false)
      .map((e) => ({
        type: e.type, // DROP_SHADOW / INNER_SHADOW / LAYER_BLUR / BACKGROUND_BLUR
        color: e.color ? rgbToHex(e.color) : null,
        offset: e.offset ? { x: Math.round(e.offset.x), y: Math.round(e.offset.y) } : null,
        radius: e.radius ?? null,
        spread: e.spread ?? null,
      }));
  }
  if (node.cornerRadius != null) out.cornerRadius = node.cornerRadius;
  if (node.rectangleCornerRadii) out.cornerRadii = node.rectangleCornerRadii;

  if (node.type === "INSTANCE") {
    out.componentId = node.componentId ?? null;
    out.componentName = null; // 후속 단계에서 component map 으로 채움
  }

  // layout
  if (node.layoutMode) {
    out.layout = {
      mode: node.layoutMode, // HORIZONTAL / VERTICAL
      padding: {
        l: node.paddingLeft ?? 0,
        r: node.paddingRight ?? 0,
        t: node.paddingTop ?? 0,
        b: node.paddingBottom ?? 0,
      },
      gap: node.itemSpacing ?? null,
      counterAlign: node.counterAxisAlignItems ?? null,
      primaryAlign: node.primaryAxisAlignItems ?? null,
    };
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    out.children = node.children
      .filter((c) => c.visible !== false)
      .map((c) => serializeNode(c, originBox));
  }
  return out;
}

// 컴포넌트 메타 사전 (componentId → name)
function buildComponentMap(root) {
  const map = {};
  function walk(n) {
    if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") {
      map[n.id] = { name: n.name, type: n.type };
    }
    for (const c of n.children ?? []) walk(c);
  }
  walk(root);
  return map;
}

// 직렬화 후 INSTANCE 의 componentId 를 이름으로 보강.
function backfillComponentNames(node, compMap) {
  if (node.type === "INSTANCE" && node.componentId && compMap[node.componentId]) {
    node.componentName = compMap[node.componentId].name;
  }
  for (const c of node.children ?? []) backfillComponentNames(c, compMap);
}

// 통계: TEXT 라벨 / 색 / 폰트 enumerate
function collectStats(node, stats) {
  if (node.type === "TEXT") {
    stats.texts.push({
      text: node.text,
      size: node.font?.size,
      weight: node.font?.weight,
      family: node.font?.family,
      fill: node.fills?.[0]?.hex ?? null,
      box: node.box,
    });
  }
  for (const f of node.fills ?? []) {
    if (f.hex) stats.colors.add(f.hex);
  }
  if (node.stroke?.hex) stats.colors.add(node.stroke.hex);
  if (node.font?.family) stats.fonts.add(`${node.font.family}:${node.font.weight}:${node.font.size}`);
  for (const c of node.children ?? []) collectStats(c, stats);
}

const compMap = buildComponentMap(pageEntry);
console.log(`component map: ${Object.keys(compMap).length} entries`);

const indexLines = [];
indexLines.push("# Figma 와이어프레임 추출 결과 — 화면별 인덱스");
indexLines.push("");
indexLines.push("출처: `docs/figma/figma-tree.json` (Figma REST API 직접 fetch)");
indexLines.push("추출 스크립트: `scripts/figma-extract-screens.mjs`");
indexLines.push(`추출 시각: ${new Date().toISOString()}`);
indexLines.push("");
indexLines.push("좌표는 각 프레임 좌상단 기준 상대값. PNG 추측 0.");
indexLines.push("");

for (const screen of SCREENS) {
  const node = find(pageEntry, screen.id);
  if (!node) {
    console.error(`screen ${screen.id} not found`);
    continue;
  }
  const originBox = node.absoluteBoundingBox;
  const serialized = serializeNode(node, originBox);
  backfillComponentNames(serialized, compMap);

  const stats = { texts: [], colors: new Set(), fonts: new Set() };
  collectStats(serialized, stats);

  const out = {
    screen: { id: screen.id, slug: screen.slug, label: screen.label, w: serialized.box.w, h: serialized.box.h },
    stats: {
      textCount: stats.texts.length,
      uniqueColorCount: stats.colors.size,
      uniqueFontStyleCount: stats.fonts.size,
      colors: [...stats.colors].sort(),
      fonts: [...stats.fonts].sort(),
    },
    texts: stats.texts.sort((a, b) => (a.box?.y ?? 0) - (b.box?.y ?? 0) || (a.box?.x ?? 0) - (b.box?.x ?? 0)),
    tree: serialized,
  };

  const outPath = resolve(OUT_DIR, `${screen.slug}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  const sizeKB = (JSON.stringify(out).length / 1024).toFixed(1);
  console.log(`✓ ${screen.slug.padEnd(20)} ${serialized.box.w}×${serialized.box.h}  texts=${stats.texts.length}  colors=${stats.colors.size}  fonts=${stats.fonts.size}  → ${sizeKB}KB`);

  indexLines.push(`## ${screen.label} (\`${screen.slug}\`)`);
  indexLines.push("");
  indexLines.push(`- 노드 ID: \`${screen.id}\``);
  indexLines.push(`- 크기: ${serialized.box.w}×${serialized.box.h}`);
  indexLines.push(`- 텍스트 라벨: ${stats.texts.length}개`);
  indexLines.push(`- 사용 색: ${stats.colors.size}개`);
  indexLines.push(`- 폰트 스타일 (family:weight:size): ${stats.fonts.size}개`);
  indexLines.push(`- 추출본: [\`${screen.slug}.json\`](./${screen.slug}.json)`);
  indexLines.push("");
}

writeFileSync(resolve(OUT_DIR, "_index.md"), indexLines.join("\n"));
console.log(`✓ index → ${resolve(OUT_DIR, "_index.md")}`);
