// scripts/ingest-market-data.ts
//
// Yahoo Finance 에서 시장지수 + 환율 시계열을 fetch 하여 DB 에 upsert.
// 실행: tsx scripts/ingest-market-data.ts [--days 60]
//
// 가드: write 가능한 DATABASE_URL 이 설정돼있을 때만 실행.
//   - 환경변수 DATABASE_URL_WRITE 우선, 없으면 DATABASE_URL 사용
//   - DATABASE_URL_WRITE 가 없으면 단순히 dry-run (fetch 만 하고 DB 적재 skip)
//
// 적재 테이블: 기존 global_environment 재사용
//   - symbol = '^GSPC' / '^DJI' / '^IXIC' / '^RUT' / 'KRW=X' / 'JPY=X' ...
//   - category = '시장지수' (지수) / '환율' (FX)
//   - value = close
//
// 사전 조건: global_environment 에 (symbol, date) UNIQUE 제약이 있어야 ON CONFLICT 동작.
// 부재 시 INSERT 만 진행 (중복 row 누적 가능 — DB 정정 권장).

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// .env.local 자동 로드 (process.env 가 없으면)
try {
  const envPath = resolve(ROOT, ".env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0 || line.startsWith("#")) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
} catch {
  // .env.local 부재 — CI/Vercel 환경
}

const args = process.argv.slice(2);
function arg(name: string, def: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? def) : def;
}

const DAYS = Number.parseInt(arg("days", "60"), 10);
const DRY_RUN = args.includes("--dry-run");

const SYMBOLS = [
  { yahoo: "^GSPC", category: "시장지수" },
  { yahoo: "^DJI", category: "시장지수" },
  { yahoo: "^IXIC", category: "시장지수" },
  { yahoo: "^RUT", category: "시장지수" },
  { yahoo: "KRW=X", category: "환율" },
  { yahoo: "JPY=X", category: "환율" },
  { yahoo: "EURUSD=X", category: "환율" },
  { yahoo: "CNY=X", category: "환율" },
];

interface FetchedPoint {
  symbol: string;
  category: string;
  date: string;
  value: number;
}

function rangeForDays(days: number): string {
  if (days <= 5) return "5d";
  if (days <= 30) return "1mo";
  if (days <= 90) return "3mo";
  if (days <= 180) return "6mo";
  return "1y";
}

async function fetchYahoo(yahoo: string, days: number): Promise<Array<{ date: string; close: number }>> {
  const range = rangeForDays(days);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=${range}&interval=1d`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; InvestLens/1.0)",
      Accept: "application/json",
    },
  });
  if (!r.ok) throw new Error(`yahoo ${yahoo}: HTTP ${r.status}`);
  const json = (await r.json()) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`yahoo ${yahoo}: invalid response`);
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: Array<{ date: string; close: number }> = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    points.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close: c,
    });
  }
  return points.slice(-days);
}

async function ingest(): Promise<void> {
  console.log(`[ingest] symbols=${SYMBOLS.length} days=${DAYS} dryRun=${DRY_RUN}`);

  // 1) Fetch 모두
  const all: FetchedPoint[] = [];
  for (const sym of SYMBOLS) {
    try {
      const points = await fetchYahoo(sym.yahoo, DAYS);
      console.log(`  ✓ ${sym.yahoo.padEnd(10)} ${points.length} points (${points[0]?.date} ~ ${points[points.length - 1]?.date})`);
      for (const p of points) {
        all.push({ symbol: sym.yahoo, category: sym.category, date: p.date, value: p.close });
      }
    } catch (e) {
      console.error(`  ✗ ${sym.yahoo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[ingest] fetched ${all.length} rows total`);

  // 2) DB 적재 가드
  const writeUrl = process.env.DATABASE_URL_WRITE ?? process.env.DATABASE_URL;
  if (!writeUrl) {
    console.log(`[ingest] no DATABASE_URL — skipping DB write (dry-run only)`);
    return;
  }
  if (DRY_RUN) {
    console.log(`[ingest] --dry-run flag — skipping DB write`);
    return;
  }
  if (!process.env.DATABASE_URL_WRITE) {
    console.warn(
      `[ingest] WARNING: DATABASE_URL_WRITE 미설정 — DATABASE_URL 사용 시 read-only 계정이면 권한 에러 발생.\n` +
        `         쓰기 권한 가진 별도 URL 을 .env.local 에 DATABASE_URL_WRITE 로 설정 권장.`,
    );
  }

  const url = new URL(writeUrl);
  url.searchParams.delete("sslmode");
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  let inserted = 0;
  let skipped = 0;
  let errored = 0;

  for (const row of all) {
    try {
      // ON CONFLICT 가 작동하려면 (symbol, date) UNIQUE 제약 필요.
      // 제약이 없으면 INSERT 만 — 중복 row 누적 가능.
      const r = await pool.query(
        `
          INSERT INTO public.global_environment (symbol, category, date, value)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (symbol, date) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category
        `,
        [row.symbol, row.category, row.date, row.value],
      );
      inserted += r.rowCount ?? 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("no unique or exclusion constraint")) {
        // ON CONFLICT 제약 부재 → fallback: 단순 INSERT (중복 가능)
        try {
          await pool.query(
            `INSERT INTO public.global_environment (symbol, category, date, value) VALUES ($1, $2, $3, $4)`,
            [row.symbol, row.category, row.date, row.value],
          );
          inserted++;
        } catch (e2) {
          errored++;
          if (errored <= 3) console.error(`  insert fail ${row.symbol}/${row.date}:`, e2);
        }
      } else {
        skipped++;
        if (skipped <= 3) console.error(`  upsert fail ${row.symbol}/${row.date}:`, msg);
      }
    }
  }

  console.log(`[ingest] inserted=${inserted} skipped=${skipped} errored=${errored}`);
  await pool.end();
}

ingest().catch((e) => {
  console.error("[ingest] fatal:", e);
  process.exit(1);
});
