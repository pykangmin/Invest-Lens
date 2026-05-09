// db-enumerate.mjs — DB 에 어떤 symbol/카테고리가 있는지 enumerate.
// 사용처: data-coverage 검증 (S&P/USD KRW/이벤트 등 실 데이터 가능성 확인).
// 실행: node scripts/db-enumerate.mjs
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && !process.env[line.slice(0, eq).trim()]) {
    process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete('sslmode');
const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  console.log('=== global_environment distinct symbol/category (top 50) ===');
  const r1 = await pool.query(
    "SELECT DISTINCT symbol, category, COUNT(*) AS n FROM global_environment GROUP BY symbol, category ORDER BY n DESC LIMIT 50"
  );
  for (const row of r1.rows)
    console.log('  ', String(row.symbol).padEnd(20), '|', String(row.category || '').padEnd(20), '|', row.n);

  console.log('\n=== 모든 public 테이블 (먼저) ===');
  const r6 = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  for (const row of r6.rows) console.log('  ', row.table_name);
  console.log();

  // 사용 가능한 테이블에서 검색
  console.log('=== stock_price_tech ticker 중 USD/KRW/FX/^ 패턴 ===');
  const r3 = await pool.query(
    "SELECT DISTINCT ticker FROM stock_price_tech WHERE ticker ILIKE '%USD%' OR ticker ILIKE '%KRW%' OR ticker ILIKE '%FX%' OR ticker LIKE '^%' OR ticker ILIKE '%=X' LIMIT 30"
  );
  for (const row of r3.rows) console.log('  ', row.ticker);
  if (r3.rows.length === 0) console.log('  (none)');

  console.log('\n=== commodity_prices distinct symbol ===');
  const r4 = await pool.query(
    "SELECT DISTINCT symbol, category, COUNT(*) AS n FROM commodity_prices GROUP BY symbol, category ORDER BY n DESC LIMIT 30"
  );
  for (const row of r4.rows)
    console.log('  ', String(row.symbol).padEnd(15), '|', String(row.category || '').padEnd(15), '|', row.n);

  console.log('\n=== events 류 테이블 존재 여부 ===');
  const r5 = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%event%' OR table_name ILIKE '%news%' OR table_name ILIKE '%earning%' OR table_name ILIKE '%calendar%')"
  );
  for (const row of r5.rows) console.log('  ', row.table_name);
  if (r5.rows.length === 0) console.log('  (none — 이벤트는 analysis 합성으로만)');

  console.log('\n=== company_master ticker 중 index 가능성 ===');
  const r7 = await pool.query(
    "SELECT ticker, name FROM company_master WHERE name ILIKE '%index%' OR ticker LIKE '^%' OR name ILIKE '%S&P%' OR name ILIKE '%Dow%' OR name ILIKE '%Nasdaq%' LIMIT 20"
  );
  for (const row of r7.rows) console.log('  ', String(row.ticker).padEnd(10), '|', row.name);
  if (r7.rows.length === 0) console.log('  (none)');

  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
