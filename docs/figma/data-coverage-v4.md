# data-coverage-v4.md — 슬롯별 REAL/EXAMPLE/STUB 분류

**기준 시안**: `dashboard-slots-v4.md` (Figma node `0:1` 4 화면)
**분류 일자**: 2026-05-11 (DB 보강 반영)
**분류 갱신 시 반영처**: `submission/SUBMISSION.md` 의 "데이터 상태" 표

> **2026-05 DB 보강 반영**: `stock_price_tech` 5 컬럼(`ma_20`, `macd_signal`, `supertrend_signal`, `supertrend_value`, `supertrend_days`) 추가. 신규 테이블 2종 (`fx_rates`, `market_index_prices`) 추가 → Yahoo Finance 프록시는 DB miss 시 fallback 으로 강등.

---

## 분류 기준

| 표기 | 의미 | UI 표시 |
|---|---|---|
| 🟢 **REAL** | DB·API 로 진짜 값 표시 | 배지 없음 |
| 🟡 **EXAMPLE** | DB 시계열 부재 → 시안 mock 그대로 | `<ExampleBadge tone="example">` ("예시") |
| 🔴 **STUB** | 흐름상 안 맞거나 기술 미구현 → 형태만 흉내 | `<ExampleBadge tone="stub">` ("미구현") |

EXAMPLE/STUB 슬롯은 **반드시** 화면 위에 배지를 부착해 채점자가 즉시 구분할 수 있게 한다.

---

## 1. home (진입화면)

| 슬롯 | 분류 | 출처 / 사유 |
|---|---|---|
| 배경 (네이비 + 이미지 오버레이) | 🟢 REAL | 정적 자산 |
| 로고 / 헤드라인 / 부제 | 🟢 REAL | 정적 카피 |
| 검색바 자동완성 | 🟢 REAL | `/api/companies?q=` (503 종목) |
| 인기 검색어 칩 (AAPL/MSFT/GOOGL/AMZN/NVDA/TSLA/META) | 🟢 REAL | 7개 모두 DB 종목 |

→ **home 은 모두 REAL**. 배지 부착 없음.

---

## 2. main (개별 주식화면)

### 2.1 헤더

| 슬롯 | 분류 | 출처 / 사유 |
|---|---|---|
| 로고 | 🟢 REAL | 정적 |
| 글로벌 검색 placeholder | 🟢 REAL | `/api/companies?q=` |

### 2.2 종목 행

| 슬롯 | 분류 | 출처 / 사유 |
|---|---|---|
| 종목명 (`Apple Inc`) | 🟢 REAL | `/api/company?ticker=` (companies 테이블) |
| 가격 (`102.36$ +2.36$ (0.87%)`) | 🟢 REAL | `stock_price_tech` latest non-null |
| 시장 컨텍스트 4슬롯 (S&P / Dow / Nasdaq / Russell) | 🟢 **REAL** | `/api/market-index` — **2026-05 DB 보강**: `market_index_prices` 직조회 우선, Yahoo fallback. `source: "db" \| "yahoo"` 응답 필드 |

### 2.3 사이드바 4 게이지

| 슬롯 | 분류 | 출처 |
|---|---|---|
| G1 기업 펀더멘털 (`GOOD 60`) | 🟢 REAL | `analysis/fundamental.ts` ← `stock_fundamentals` |
| G2 거시 경제 (`POSITIVE Soft Landing`) | 🟢 REAL | `analysis/macro.ts` ← `macro_regime_scores` (dominantRegime + confidence) |
| G3 원자재 영향 (`NEGATIVE 32`) | 🟡 **부분 EXAMPLE** | `analysis/commodityImpact.ts` — 종목 sector × 원자재 가중. **sector 데이터 누락 시 자동 EXAMPLE 처리** (게이지 카드 우상단에 배지) |
| G4 기술적 지표 (`FEAR 23`) | 🟢 REAL | `analysis/technical.ts` ← `stock_price_tech` |

### 2.4 차트

| 슬롯 | 분류 | 출처 |
|---|---|---|
| 가격 라인 차트 (180일 종가) | 🟢 REAL | `stock_price_tech` 180일 |

### 2.5 주요 이벤트 + 환율 (2-col)

| 슬롯 | 분류 | 출처 / 사유 |
|---|---|---|
| 주요 이벤트 5행 | 🟢 **REAL (부분)** | `analysis/events.ts` 가 (a) 분기 보고일 (b) RSI 70/30 임계 돌파 (c) **2026-05 보강**: Super Trend 추세 전환 (supertrendDays ≤ 5) (d) MACD signal선 근접 (\|diff\| < 0.5) 합성. 5행 채우기 충분 |
| 환율 5행 (USD/KRW · USD/JPY · USD/EUR · USD/CNY · EUR/USD) | 🟢 **REAL** | `/api/fx-rates` — **2026-05 DB 보강**: `fx_rates` 직조회 우선 (USDEUR 는 EUR/USD 역수), Yahoo fallback. `source` 필드로 출처 명시 |

### 2.6 종합 점수 3중

| 슬롯 | 분류 | 출처 / 사유 |
|---|---|---|
| 오늘 / 이번 달 / 올해 (값·sparkline·delta) | 🟢 REAL | `analysis/series.ts` `buildDailyComposite` 252 영업일 시계열. **단**, 4지표 → 종합 합산식이 시안에 미명시 → 단순 평균 사용 (코드 주석 명시) |

### 2.7 TOP 3 ×4

| 슬롯 | 분류 | 출처 |
|---|---|---|
| 오른 / 거래된 / 떨어진 / 점수 좋았던 주식 TOP 3 | 🟢 REAL | `/api/screen?category=priceUp/volume/priceDown/scoreTop` |

---

## 3. main-commodity (원자재 detail) — B 단계 작업

| 영역 | 분류 (예상) |
|---|---|
| Detail shell (header + breadcrumb + nav + title) | 🟢 REAL |
| 원자재 영향 점수 도넛 | 🟡 EXAMPLE (sector 누락 시) |
| 4 mini cards (리튬/금/WTI/금 상승) | 🟢 REAL (`commodities` API) |
| 8-card 가격 현황 그리드 | 🟢 REAL |
| 변동성-수익률 매트릭스 (scatter) | 🔴 STUB — scatter chart 컴포넌트 미구현 |
| 카테고리별 가격 추이 (3 line) | 🟢 REAL |
| 시장 이슈 분석 카드 (3) | 🟡 EXAMPLE — 본문은 시안 mock 텍스트 |
| 자산군 정규화 / WTI vs 천연가스 | 🟢 REAL (계산 가능) |

---

## 4. main-technical (기술 detail) — B 단계 작업

DB 컬럼: `close / volume / rsi_14 / macd / ma_50 / ma_200`. **2026-05 보강**: `ma_20`, `macd_signal`, `supertrend_signal`, `supertrend_value`, `supertrend_days`. 단 보강 컬럼은 close=NULL 인 별도 row (2026-04-22 ~ 2026-05-01) 에 들어옴 → `/api/company` 가 `latestSignals` 필드로 별도 노출.

| 영역 | 분류 | 출처 / 사유 |
|---|---|---|
| Detail shell | 🟢 REAL | DetailShell |
| Hero — 종합 점수 도넛 + 6 chip | 🟢 REAL | `analysis/technicalV4` 6-metric 가중 합산. `latestSignals` 있으면 본문에 Super Trend 현황 자동 추가 |
| 신호 등급 bar (Sell/Hold/Buy/Strong buy) | 🟢 REAL | 점수 → 등급 매핑 |
| 6-metric ContributionRow (Super Trend 20 / MA 20 / MACD 15 / RSI 15 / VIX 15 / Volume 15) | 🟢 REAL | **2026-05 보강 반영**: Super Trend 는 DB `supertrend_signal`/`days` 직값 (Buy/Sell + 추세 확신 비례 점수). MACD 는 `macd_signal` 비교로 cross 보너스 ±. 나머지는 기존 계산 |
| 종합 점수 추이 line | 🟡 EXAMPLE | 과거 종합 점수 저장 안 함 → 직전 60일 close 기반 6-metric 재계산. 보존된 값 아닌 *재계산값* 임을 배지로 표시 |
| Detail table 6행 (지표 / sparkline / 요약 / 점수) | 🟢 REAL | sparkline = 각 metric 의 정규화 값 60일 |
| 평균이동선 차트 (close + MA20·MA50·MA200) | 🟢 REAL | MA20 은 close 20일 SMA 로 계산 (DB ma_20 은 close=NULL row 라 차트 정렬 불가, latestSignals.ma20 만 보강 카드에 표시) |
| **신규** DB 보강 시그널 카드 (Super Trend · MA20 · MACD Signal 3 카드) | 🟢 REAL | `latestSignals` 직접 표시. 출처 일자 명시 |

---

## 4a. main-fundamental (펀더멘털 detail)

DB 컬럼 (16): `marketCap / per / pbr / roe / netProfitMargin / debtToEquity / revenueGrowth / epsGrowth / evEbitda / fcfYield / fcfMargin / ccc / grossMarginYoy / pbrZScore / forwardPerZScore`. `/api/company` 가 forward-fill 적용 (가장 최근 분기 결측 → 직전 분기 값).

| 영역 | 분류 | 출처 / 사유 |
|---|---|---|
| Detail shell | 🟢 REAL | DetailShell |
| Hero — 종합 점수 도넛 + 본문·chip | 🟢 REAL | `analysis/fundamental` |
| 9 mini metric grid (FCF / ROE / 영업이익률 / Margin / PER / PBR / Debt / Growth / FCF Yield) | 🟢 REAL | `latestFundamentals` |
| 분기 추이 multi-line (Revenue Growth · EPS Growth · ROE 등) | 🟢 REAL | `fundamentalsHistory` (forward-filled) |
| 종합 스코어 합산 표 (지표 × 가중치 × 점수) | 🟢 REAL | `analysis/fundamental` 의 sub-score 노출 |
| 동종업계 비교 표 (peer N개) | 🟡 EXAMPLE | peers 데이터 부재 — 시안 mock |
| 핵심 강점 / 리스크 카드 (텍스트) | 🟡 EXAMPLE | 본문 mock |

---

## 4b. main-macro (거시 detail)

DB: `macro_regime_scores` (4 regime 확률 + dominantRegime + confidence). `global_environment` 시계열 4종 보유 (`^VIX / DX-Y.NYB / DGS10 / BAMLH0A0HYM2`). CPI / 실업률 / 산업생산 등 macro 변수 시계열은 DB 부재.

| 영역 | 분류 | 출처 / 사유 |
|---|---|---|
| Detail shell | 🟢 REAL | DetailShell |
| Hero — dominantRegime 라벨 + 도넛 | 🟢 REAL | `analysis/macro` |
| 4 regime 확률 카드 (Soft / Hard / No / Recovery) | 🟢 REAL | `MacroRegimeScore` 4 컬럼 |
| Regime 확률 추이 stack-area | 🟢 REAL | `macroRegime.history` 36행 |
| 거시 시계열 4 multi-line (VIX · DXY · 10Y · HY Spread) | 🟢 REAL | `global_environment` |
| Regime breakdown — 변수 → regime 기여도 표 | 🟡 EXAMPLE | DB 부재 (모델 내부 가중치 미공개) — 시안 mock |
| 경고 / 신호 카드 (텍스트) | 🟡 EXAMPLE | 본문 mock |

---

## 5. EXAMPLE 배지 부착 슬롯 사전 합계 (main 화면)

| # | 슬롯 | 배지 위치 | 이유 |
|---|---|---|---|
| 1 | 시장 컨텍스트 4슬롯 (조건부) | fetch 실패한 카드만 | Yahoo Finance rate limit / 차단 시 |
| 2 | 환율 5행 (조건부) | 헤더 (모두 실패 시) | Yahoo Finance 전체 실패 시 |
| 3 | G3 원자재 영향 (조건부) | 게이지 카드 우상단 | sector 누락 시 자동 |
| 4 | 주요 이벤트 5행 (조건부) | 카드 헤더 | RSI 임계만 잡혀 행 부족 시 |

→ Yahoo Finance 정상 동작 시 **항상 보이는 배지: 0개**
→ Yahoo 차단 시 최대 4 (시장지수) + 1 (환율 헤더) = 5개
→ **조건부 배지: 2개** (G3 / 이벤트 부족분)

---

## 6. 미해결 / 차후 보강 후보

| 항목 | 현재 상태 | 보강 방안 |
|---|---|---|
| ~~S&P 500 등 시장지수 가격 시계열~~ | ✅ **2026-05 DB 보강** | `market_index_prices` 16 종목 (^GSPC/^DJI/^IXIC/^RUT/^VIX + 11 sector ETF) |
| ~~USD/KRW 환율 시계열~~ | ✅ **2026-05 DB 보강** | `fx_rates` 7 pair (USD/JPY, USD/KRW, USD/CNY, EUR/USD, GBP/USD, EUR/KRW, JPY/KRW) |
| ~~supertrend / MACD 신호 변화 합성~~ | ✅ **2026-05 보강** | `analysis/events.ts` 에 supertrend_flip + macd_cross 합성 |
| 종합 점수 60일 history 저장 | DB 부재 | 재계산값 사용 중 — `score_history` 테이블 신규 필요 |
| 펀더멘털 동종업계 비교 | DB 부재 | peer 매핑 + 비교 지표 테이블 필요 |
| 거시 regime 변수 기여도 | DB 부재 | 모델 내부 가중치 노출 필요 |
| 4지표 → 종합 합산식 | 단순 평균 (시안 미명시) | 02-data-analysis.md 에 가중치 표 정의 후 반영 |

---

**원칙**: 새 슬롯 추가 시 이 표에 분류 행을 함께 추가. 분류 없이 구현 금지.
