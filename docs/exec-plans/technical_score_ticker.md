# `public.technical_score_ticker` — 종목별 일일 기술 점수

`/api/screen?category=scoreTop` 의 ranking 산식 `(펀더 점수 + 기술 점수) / 2` 에서
기술 점수 부분을 공급한다. 펀더 점수는 SQL 인라인으로 산출하지만 (`fundamentalNarrative.totalFromSections`
의 1:1 SQL 재구현, `api/screen.ts` 참조), 기술 점수는 시계열·VIX·MA·MACD·RSI·거래량
6 metric 의 복합 산식이라 매 호출 SQL 로 풀기엔 비효율 — **사전 적재 테이블** 로 분리.

## 산식 — 원본 TS 코드 1:1 동일

소스: `src/analysis/technicalV4.ts` — `technicalAnalysisV4(history, vixLatest, vixHistory, latestSignals)`.

- 6 metric × max 합 = 100
  - `superTrend` (max 20) — `stock_price_tech.supertrend_signal` 유무에 따라 DB 직값 / proxy
  - `movingAverage` (max 20) — close vs MA50/MA200 + 정렬
  - `macd` (max 15) — MACD 60일 |평균| 기반 정규화 + signal cross 보너스
  - `rsi` (max 15) — `stock_price_tech.rsi_14` 50 기준 거리
  - `vix` (max 15) — `global_environment.symbol='^VIX'` 60일 분포 분위
  - `volume` (max 15) — 거래량 vs SMA20 + 가격 동조
- `totalScore = round(Σ metric.score)`

자세한 산식은 `technicalV4.ts:90~398` 참조. 백필 스크립트 작성 시 위 TS 함수를 직접 호출하면
detail 페이지와 ranking 이 1:1 일치.

## 테이블 DDL

```sql
CREATE TABLE IF NOT EXISTS public.technical_score_ticker (
  ticker          TEXT      NOT NULL,
  date            DATE      NOT NULL,
  score           NUMERIC   NOT NULL,        -- 0~100, totalScore
  super_trend     NUMERIC,                   -- 0~20
  moving_average  NUMERIC,                   -- 0~20
  macd            NUMERIC,                   -- 0~15
  rsi             NUMERIC,                   -- 0~15
  vix             NUMERIC,                   -- 0~15
  volume          NUMERIC,                   -- 0~15
  available_count SMALLINT,                  -- 산출된 metric 수 (0~6)
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS technical_score_ticker_date_idx
  ON public.technical_score_ticker (date);
CREATE INDEX IF NOT EXISTS technical_score_ticker_ticker_date_idx
  ON public.technical_score_ticker (ticker, date DESC);
```

## 적재 범위

- **MVP (TOP3 ranking 만 필요)** — 각 종목의 latest close 일자 1 row.
- **확장 (history)** — 60일 daily score. detail 페이지 §2 종합점수 추이 차트의
  종목별 라인(현재 placeholder)을 채울 때 필요. `technical_score_market_avg` 와 동일 cadence.

## 사용처

- `api/screen.ts` — `scoreTop` SQL 에서 LEFT JOIN. 테이블 부재 시 펀더 단독으로 graceful fallback.
- (장래) `api/company.ts` — `latestTechnicalScore` 필드로 detail 페이지 hero 에 공급 가능.

## 검증 쿼리 (적재 후)

```sql
-- coverage
SELECT count(DISTINCT ticker), max(date) FROM public.technical_score_ticker;

-- top 10
SELECT t.ticker, cm.name, t.score, t.date
FROM (
  SELECT DISTINCT ON (ticker) ticker, date, score
  FROM public.technical_score_ticker
  ORDER BY ticker, date DESC
) t
LEFT JOIN public.company_master cm ON cm.ticker = t.ticker
ORDER BY t.score DESC LIMIT 10;
```
