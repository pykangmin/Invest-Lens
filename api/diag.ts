// /api/diag — production 진단용. ENV / DB connect / error stack 모두 노출.
// 본 마감 후 제거.

import pg from "pg";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";

interface DiagResult {
  step: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const steps: DiagResult[] = [];

  // 1. ENV 존재 + 길이
  const url = process.env.DATABASE_URL;
  steps.push({
    step: "ENV.DATABASE_URL",
    ok: !!url,
    detail: url
      ? { length: url.length, prefix: url.slice(0, 20), suffix: url.slice(-15) }
      : "not set",
  });

  if (!url) {
    res.status(200).json({ data: { steps } });
    return;
  }

  // 2. URL parse
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
    steps.push({
      step: "URL.parse",
      ok: true,
      detail: {
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port,
        pathname: parsed.pathname,
        username: parsed.username ? "***" : "(empty)",
        passwordPresent: !!parsed.password,
        searchParams: parsed.search,
      },
    });
  } catch (e) {
    steps.push({
      step: "URL.parse",
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    res.status(200).json({ data: { steps } });
    return;
  }

  // 3. pg.Client connect 시도
  const conn = (() => {
    if (!parsed) return url;
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  })();

  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8_000,
  });

  try {
    const t0 = Date.now();
    await client.connect();
    steps.push({
      step: "pg.connect",
      ok: true,
      detail: { ms: Date.now() - t0 },
    });
  } catch (e) {
    steps.push({
      step: "pg.connect",
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    res.status(200).json({ data: { steps } });
    return;
  }

  // 4. 단순 query
  try {
    const r = await client.query<{ now: string; ver: string }>(
      "SELECT now()::text AS now, version() AS ver",
    );
    steps.push({
      step: "pg.simpleQuery",
      ok: true,
      detail: r.rows[0],
    });
  } catch (e) {
    steps.push({
      step: "pg.simpleQuery",
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
  }

  // 5. application schema query
  try {
    const r = await client.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM public.company_master",
    );
    steps.push({
      step: "pg.appQuery",
      ok: true,
      detail: r.rows[0],
    });
  } catch (e) {
    steps.push({
      step: "pg.appQuery",
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
  }

  await client.end().catch(() => {});

  res.status(200).json({ data: { steps } });
}
