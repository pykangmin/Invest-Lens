// Peer 비교 + Regime 기여도 산출 가능성 실데이터로 확인.
import pg from "pg";
const { Pool } = pg;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 1 });
const q = async (sql, vals = []) => (await pool.query(sql, vals)).rows;

console.log("=== AAPL sector / sub_industry ===");
console.log(await q(`SELECT ticker, name, sector, sub_industry FROM company_master WHERE ticker='AAPL'`));

console.log("\n=== 같은 sector(Information Technology) 시총 상위 6 ===");
console.log(
  await q(`
    SELECT cm.ticker, cm.name, cm.sub_industry, sf.market_cap, sf.per, sf.roe, sf.pbr, sf.net_profit_margin
    FROM company_master cm
    JOIN LATERAL (
      SELECT *
      FROM stock_fundamentals
      WHERE ticker = cm.ticker AND market_cap IS NOT NULL
      ORDER BY date DESC LIMIT 1
    ) sf ON true
    WHERE cm.sector = 'Information Technology'
    ORDER BY sf.market_cap DESC NULLS LAST
    LIMIT 6
  `),
);

console.log("\n=== macro_regime_scores 분포 (월말 데이터 5개 sample) ===");
console.log(await q(`SELECT date, soft_landing_prob, hard_landing_prob, no_landing_prob, recovery_prob, dominant_regime FROM macro_regime_scores ORDER BY date DESC LIMIT 5`));

console.log("\n=== global_environment symbol 별 month-end value (latest 5) ===");
console.log(
  await q(`
    SELECT symbol, date, value
    FROM global_environment
    WHERE symbol IN ('^VIX', 'DX-Y.NYB', 'DGS10', 'BAMLH0A0HYM2')
      AND date IN (SELECT DISTINCT date FROM macro_regime_scores ORDER BY date DESC LIMIT 5)
    ORDER BY symbol, date DESC
  `),
);

console.log("\n=== month-end JOIN regime ↔ macro variables (10 rows) ===");
console.log(
  await q(`
    SELECT
      m.date,
      m.soft_landing_prob, m.hard_landing_prob, m.no_landing_prob, m.recovery_prob,
      (SELECT value FROM global_environment WHERE symbol='^VIX' AND date <= m.date ORDER BY date DESC LIMIT 1) AS vix,
      (SELECT value FROM global_environment WHERE symbol='DGS10' AND date <= m.date ORDER BY date DESC LIMIT 1) AS dgs10,
      (SELECT value FROM global_environment WHERE symbol='DX-Y.NYB' AND date <= m.date ORDER BY date DESC LIMIT 1) AS dxy,
      (SELECT value FROM global_environment WHERE symbol='BAMLH0A0HYM2' AND date <= m.date ORDER BY date DESC LIMIT 1) AS hy
    FROM macro_regime_scores m
    ORDER BY m.date DESC
    LIMIT 10
  `),
);

await pool.end();
