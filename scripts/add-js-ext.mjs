import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const re = /from\s+["'](\.\.?\/[^"']+)["']/g;

for (const file of walk("api")) {
  let src = readFileSync(file, "utf8");
  let changed = false;
  const next = src.replace(re, (whole, spec) => {
    if (spec.endsWith(".js") || spec.endsWith(".json")) return whole;
    changed = true;
    return whole.replace(spec, spec + ".js");
  });
  if (changed) {
    writeFileSync(file, next);
    console.log("  patched", file);
  }
}
