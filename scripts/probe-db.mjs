// 1회용 DB 스키마 진단 — DB 보강 변경점 자동 파악용.
// 실행: node --env-file=.env.local scripts/probe-db.mjs
import pg from "pg";

const { Pool } = pg;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function listTables() {
  const r = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
    ORDER BY table_name
  `);
  return r.rows.map((x) => x.table_name);
}

async function listCols(table) {
  const r = await pool.query(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position
    `,
    [table],
  );
  return r.rows;
}

async function countAndDates(table) {
  try {
    const has = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name='date'`,
      [table],
    );
    const hasDate = has.rows.length > 0;
    const sql = hasDate
      ? `SELECT count(*)::bigint AS rows, min(date)::text AS min_date, max(date)::text AS max_date FROM public.${table}`
      : `SELECT count(*)::bigint AS rows FROM public.${table}`;
    const r = await pool.query(sql);
    return r.rows[0];
  } catch (e) {
    return { error: e.message };
  }
}

const tables = await listTables();
console.log("=== TABLES ===");
console.log(tables.join("\n"));

console.log("\n=== PER-TABLE COLUMNS + COUNTS ===");
for (const t of tables) {
  const cols = await listCols(t);
  const meta = await countAndDates(t);
  console.log(`\n# ${t}`);
  console.log(`  meta:`, meta);
  for (const c of cols) {
    console.log(`  - ${c.column_name} (${c.data_type})`);
  }
}

await pool.end();
