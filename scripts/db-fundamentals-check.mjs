// 펀더멘탈 결측 패턴 확인 — AAPL/NVDA/MSFT/GOOGL/META 5종 최근 6분기 per/roe NULL 여부.
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
  console.log('=== stock_fundamentals 컬럼 목록 ===');
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='stock_fundamentals' AND table_schema='public' ORDER BY ordinal_position"
  );
  for (const r of cols.rows) console.log('  ', r.column_name);

  for (const ticker of ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'META']) {
    console.log(`\n=== ${ticker} 최근 6 분기 (per/roe/market_cap) ===`);
    const r = await pool.query(
      `SELECT date, per, roe, market_cap, ev_ebitda, gross_margin_yoy
       FROM stock_fundamentals
       WHERE ticker = $1
       ORDER BY date DESC
       LIMIT 6`,
      [ticker]
    );
    for (const row of r.rows) {
      const dateStr = (typeof row.date === 'string' ? row.date : row.date.toISOString()).slice(0, 10);
      console.log(
        `  ${dateStr}  per=${String(row.per).padEnd(8)} roe=${String(row.roe).padEnd(10)} mcap=${String(row.market_cap).padEnd(15)} ev=${String(row.ev_ebitda).padEnd(8)} gm=${row.gross_margin_yoy}`
      );
    }
  }

  console.log('\n=== 전체 stock_fundamentals 행 중 per/roe NULL 비율 ===');
  const total = await pool.query("SELECT COUNT(*) AS n FROM stock_fundamentals");
  const perNull = await pool.query("SELECT COUNT(*) AS n FROM stock_fundamentals WHERE per IS NULL");
  const roeNull = await pool.query("SELECT COUNT(*) AS n FROM stock_fundamentals WHERE roe IS NULL");
  const eitherNull = await pool.query("SELECT COUNT(*) AS n FROM stock_fundamentals WHERE per IS NULL OR roe IS NULL");
  const bothNotNull = await pool.query("SELECT COUNT(*) AS n FROM stock_fundamentals WHERE per IS NOT NULL AND roe IS NOT NULL");
  console.log(`  total          : ${total.rows[0].n}`);
  console.log(`  per IS NULL    : ${perNull.rows[0].n}`);
  console.log(`  roe IS NULL    : ${roeNull.rows[0].n}`);
  console.log(`  per OR roe NULL: ${eitherNull.rows[0].n}  ← "결측" 처리 대상`);
  console.log(`  per AND roe O  : ${bothNotNull.rows[0].n}  ← 완전 데이터`);

  console.log('\n=== 최근 1년 분기별 (4분기) 완전 비율 ===');
  const recentFull = await pool.query(`
    SELECT date_trunc('quarter', date) AS q, COUNT(*) AS total,
           SUM(CASE WHEN per IS NOT NULL AND roe IS NOT NULL THEN 1 ELSE 0 END) AS full
    FROM stock_fundamentals
    WHERE date >= NOW() - INTERVAL '15 months'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 8
  `);
  for (const row of recentFull.rows) {
    const dateStr = (typeof row.q === 'string' ? row.q : row.q.toISOString()).slice(0, 10);
    const pct = ((Number(row.full) / Number(row.total)) * 100).toFixed(1);
    console.log(`  ${dateStr}  ${row.full}/${row.total}  완전 ${pct}%`);
  }

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
