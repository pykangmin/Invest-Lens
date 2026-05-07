import { existsSync, readFileSync } from "node:fs";
import { Client } from "pg";

if (existsSync(".env.local")) {
  const txt = readFileSync(".env.local", "utf8").replace(/^﻿/, "");
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing");
  process.exit(2);
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  const t0 = Date.now();
  await client.connect();
  const r = await client.query("SELECT current_database() AS db, current_user AS user, version() AS version");
  const ms = Date.now() - t0;
  console.log(JSON.stringify({ ok: true, latency_ms: ms, ...r.rows[0] }, null, 2));

  const t = await client.query(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name LIMIT 20",
  );
  console.log("public tables (top 20):");
  for (const row of t.rows) console.log(`  ${row.table_schema}.${row.table_name}`);
} catch (err) {
  console.error(JSON.stringify({ ok: false, message: err.message, code: err.code }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
