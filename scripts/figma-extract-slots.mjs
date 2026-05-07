// figma-extract-slots.mjs — figma-tree.json 의 노드 트리를 슬롯 spec JSON 으로 변환.
// PNG 추측 없이 좌표 + 노드 이름 + 텍스트 + 색을 그대로 사용.
//
// 출력: docs/figma/slots.generated.json
//   - canvas: { width, height }
//   - slots: [{ id, nodeId, name, type, box, text?, fills?, fontSize?, children? }]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TREE_PATH = resolve(ROOT, "docs/figma/figma-tree.json");
const OUT_PATH = resolve(ROOT, "docs/figma/slots.generated.json");

const tree = JSON.parse(readFileSync(TREE_PATH, "utf8"));

// root node 가 들어있는 entry 자동 검출.
const entry = Object.values(tree.nodes ?? {})[0];
const root = entry?.document;
if (!root) {
  console.error("root document not found in figma-tree.json");
  process.exit(1);
}

const canvasOrigin = {
  x: root.absoluteBoundingBox?.x ?? 0,
  y: root.absoluteBoundingBox?.y ?? 0,
};

function relBox(box) {
  if (!box) return null;
  return {
    x: Math.round(box.x - canvasOrigin.x),
    y: Math.round(box.y - canvasOrigin.y),
    w: Math.round(box.width),
    h: Math.round(box.height),
  };
}

function rgbToHex(c) {
  if (!c) return null;
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to(c.r)}${to(c.g)}${to(c.b)}${c.a !== undefined && c.a < 1 ? to(c.a) : ""}`;
}

function pickFill(node) {
  const f = (node.fills ?? []).find((x) => x.type === "SOLID" && x.visible !== false);
  return f ? rgbToHex(f.color) : null;
}

// 휴리스틱 슬롯 ID 부여.
//   1) 노드 이름이 의미 라벨이면 그것을 slot_id 후보로 사용 (소문자·하이픈 변환).
//   2) 무명(Frame N) 은 좌표 영역으로 명명 ("region-x-y").
function autoSlotId(name, box) {
  if (name && !/^(Frame|Group|Rectangle|Vector|Ellipse|Line|Star|REGULAR_POLYGON)( \d+)?$/.test(name)) {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w가-힣가-힣ㄱ-ㅎㅏ-ㅣ\-$%+.]/g, "")
      .slice(0, 60);
  }
  return `region-${box?.x ?? 0}-${box?.y ?? 0}`;
}

// 가장 큰 단위 (자식이 있는 Frame/Group) 만 슬롯으로 export.
// TEXT 는 부모 슬롯의 텍스트 카탈로그로 흡수.
function isSlot(node) {
  return (
    (node.type === "FRAME" || node.type === "GROUP" || node.type === "INSTANCE") &&
    Array.isArray(node.children) &&
    node.children.length > 0
  );
}

function collectTexts(node, into) {
  if (node.type === "TEXT" && typeof node.characters === "string") {
    into.push({
      text: node.characters.replace(/\n+$/, ""),
      box: relBox(node.absoluteBoundingBox),
      fontSize: node.style?.fontSize,
      fontFamily: node.style?.fontFamily,
      fontWeight: node.style?.fontWeight,
      fill: pickFill(node),
      name: node.name,
    });
    return;
  }
  for (const c of node.children ?? []) collectTexts(c, into);
}

function nodeToSlot(node, parentId = null) {
  const box = relBox(node.absoluteBoundingBox);
  const id = autoSlotId(node.name, box);
  const texts = [];
  collectTexts(node, texts);
  return {
    id,
    nodeId: node.id,
    name: node.name,
    type: node.type,
    parentId,
    box,
    fill: pickFill(node),
    cornerRadius: node.cornerRadius ?? null,
    texts: texts.slice(0, 20),
  };
}

const slots = [];
function walk(node, parentId = null, depth = 0) {
  if (!node) return;
  // 너무 깊은 트리에서 무한 enumerate 회피 — 깊이 5 제한.
  if (depth > 5) return;
  if (isSlot(node) && node !== root) {
    slots.push(nodeToSlot(node, parentId));
  }
  const myId = isSlot(node) ? node.id : parentId;
  for (const c of node.children ?? []) walk(c, myId, depth + 1);
}
walk(root);

const result = {
  source: {
    fileKey: root.id,
    rootNodeId: root.id,
    rootName: root.name,
    canvas: { width: Math.round(root.absoluteBoundingBox.width), height: Math.round(root.absoluteBoundingBox.height) },
    extractedAt: new Date().toISOString(),
  },
  slots,
};

writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
console.log(`✓ ${slots.length} slots → ${OUT_PATH}`);

// 요약 출력
const topLevel = slots.filter((s) => s.parentId === root.id || s.parentId === null);
console.log(`\ntop-level slots (depth 1): ${topLevel.length}`);
for (const s of topLevel) {
  console.log(
    `  ${(s.id || "(empty)").padEnd(40)} @${String(s.box?.x).padStart(4)},${String(s.box?.y).padStart(4)}  ${s.box?.w}×${s.box?.h}  texts=${s.texts.length}`,
  );
}
