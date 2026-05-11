// 신규 컬럼/테이블 샘플 행 확인 — null 비율, distinct values 등.
import pg from "pg";
const { Pool } = pg;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 1 });

async function q(sql, vals = []) {
  const r = await pool.query(sql, vals);
  return r.rows;
}

console.log("=== stock_price_tech new cols (AAPL latest 3) ===");
console.log(
  await q(`
    SELECT date, close, ma_20, ma_50, ma_200, macd, macd_signal,
           supertrend_signal, supertrend_value, supertrend_days
    FROM public.stock_price_tech
    WHERE ticker='AAPL' AND close IS NOT NULL
    ORDER BY date DESC LIMIT 3
  `),
);

console.log("\n=== stock_price_tech null counts (new cols, AAPL) ===");
console.log(
  await q(`
    SELECT
      count(*) FILTER (WHERE ma_20 IS NULL) AS n_ma20_null,
      count(*) FILTER (WHERE macd_signal IS NULL) AS n_macd_signal_null,
      count(*) FILTER (WHERE supertrend_signal IS NULL) AS n_st_sig_null,
      count(*) FILTER (WHERE supertrend_value IS NULL) AS n_st_val_null,
      count(*) FILTER (WHERE supertrend_days IS NULL) AS n_st_days_null,
      count(*) AS total
    FROM public.stock_price_tech
    WHERE ticker='AAPL'
  `),
);

console.log("\n=== supertrend_signal distinct values ===");
console.log(
  await q(`
    SELECT supertrend_signal, count(*)::int AS n
    FROM public.stock_price_tech
    WHERE supertrend_signal IS NOT NULL
    GROUP BY supertrend_signal
    ORDER BY n DESC
  `),
);

console.log("\n=== fx_rates pairs ===");
console.log(
  await q(`
    SELECT pair, count(*) AS rows, min(date)::text AS min_d, max(date)::text AS max_d
    FROM public.fx_rates
    GROUP BY pair
    ORDER BY pair
  `),
);

console.log("\n=== fx_rates sample (USDKRW latest 3) ===");
console.log(
  await q(`
    SELECT pair, date, rate, open, high, low, source, is_filled
    FROM public.fx_rates
    WHERE pair='USDKRW'
    ORDER BY date DESC LIMIT 3
  `),
);

console.log("\n=== market_index_prices symbols ===");
console.log(
  await q(`
    SELECT symbol, name, count(*) AS rows, min(date)::text AS min_d, max(date)::text AS max_d
    FROM public.market_index_prices
    GROUP BY symbol, name
    ORDER BY symbol
  `),
);

console.log("\n=== market_index_prices sample (SPX latest 3) ===");
console.log(
  await q(`
    SELECT symbol, date, close, open, high, low, volume, source, is_filled
    FROM public.market_index_prices
    ORDER BY date DESC LIMIT 5
  `),
);

await pool.end();
