// 새 컬럼 채움 패턴 + fx_rates pair 정확한 키 확인.
import pg from "pg";
const { Pool } = pg;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 1 });
const q = async (sql, vals = []) => (await pool.query(sql, vals)).rows;

console.log("=== AAPL 새 컬럼 채워진 범위 ===");
console.log(
  await q(`
    SELECT
      min(date) FILTER (WHERE ma_20 IS NOT NULL)::text AS ma20_min,
      max(date) FILTER (WHERE ma_20 IS NOT NULL)::text AS ma20_max,
      min(date) FILTER (WHERE supertrend_signal IS NOT NULL)::text AS st_min,
      max(date) FILTER (WHERE supertrend_signal IS NOT NULL)::text AS st_max,
      min(date) FILTER (WHERE macd_signal IS NOT NULL)::text AS macd_sig_min,
      max(date) FILTER (WHERE macd_signal IS NOT NULL)::text AS macd_sig_max,
      count(*) AS total
    FROM public.stock_price_tech
    WHERE ticker='AAPL'
  `),
);

console.log("\n=== 새 컬럼 분포 (전체 ticker 대비) ===");
console.log(
  await q(`
    SELECT
      count(DISTINCT ticker) FILTER (WHERE ma_20 IS NOT NULL) AS tickers_with_ma20,
      count(DISTINCT ticker) FILTER (WHERE supertrend_signal IS NOT NULL) AS tickers_with_st,
      count(DISTINCT ticker) FILTER (WHERE macd_signal IS NOT NULL) AS tickers_with_macd_sig,
      count(DISTINCT ticker) AS total_tickers
    FROM public.stock_price_tech
  `),
);

console.log("\n=== 새 컬럼이 채워진 ticker sample ===");
console.log(
  await q(`
    SELECT ticker, count(*) AS rows_with_st
    FROM public.stock_price_tech
    WHERE supertrend_signal IS NOT NULL
    GROUP BY ticker
    ORDER BY rows_with_st DESC LIMIT 5
  `),
);

console.log("\n=== AAPL ma_20 / supertrend 보유 row 5개 (최신) ===");
console.log(
  await q(`
    SELECT date, close, ma_20, ma_50, macd, macd_signal,
           supertrend_signal, supertrend_value, supertrend_days
    FROM public.stock_price_tech
    WHERE ticker='AAPL' AND (ma_20 IS NOT NULL OR supertrend_signal IS NOT NULL)
    ORDER BY date DESC LIMIT 5
  `),
);

console.log("\n=== fx_rates pair 키 정확히 (latest USD/KRW) ===");
console.log(
  await q(`
    SELECT pair, date, rate, source, is_filled
    FROM public.fx_rates
    WHERE pair='USD/KRW'
    ORDER BY date DESC LIMIT 3
  `),
);

console.log("\n=== market_index_prices null rate (^GSPC) ===");
console.log(
  await q(`
    SELECT count(*) FILTER (WHERE close IS NULL) AS n_null, count(*) AS total
    FROM public.market_index_prices
    WHERE symbol='^GSPC'
  `),
);

await pool.end();
