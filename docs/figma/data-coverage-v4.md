# data-coverage-v4.md — 슬롯별 REAL/EXAMPLE/STUB 분류

**기준 시안**: `dashboard-slots-v4.md` (Figma node `0:1` 4 화면)
**분류 일자**: 2026-05-09
**분류 갱신 시 반영처**: `submission/SUBMISSION.md` 의 "데이터 상태" 표

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
| 시장 컨텍스트 4슬롯 (S&P / Dow / Nasdaq / Russell) | 🟢 **REAL** | `/api/market-index` (Yahoo Finance 프록시). DB 부재 → 외부 API 도입. fetch 실패한 카드만 EXAMPLE 배지 |

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
| 주요 이벤트 5행 | 🟢 REAL (부분) / 🔴 STUB (부족분) | `analysis/events.ts` 가 분기 보고일 + RSI 임계 돌파를 합성. supertrend 전환·MACD 골든크로스·dominant_regime 변경 합성은 미구현. 5행 채우기 부족 시 카드 푸터에 **"이벤트 합성 일부 미구현" 배지** |
| 환율 5행 (USD/KRW · USD/JPY · USD/EUR · USD/CNY · EUR/USD) | 🟢 **REAL** | `/api/fx-rates` (Yahoo Finance 프록시). DB 부재 → 외부 API 도입. 실패한 통화쌍만 fallback (값 "—") |

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

| 영역 | 분류 (예상) |
|---|---|
| Detail shell | 🟢 REAL |
| 종합 점수 67/100 + 6 chip | 🟢 REAL (analysis/technical 6-metric 가중) |
| 신호 등급 bar (Sell/Hold/BUY/Strong buy) | 🟢 REAL (점수 → 등급 매핑) |
| 종합 점수 추이 line | 🟢 REAL |
| 지표별 기여도 (6+1 컬럼) | 🟢 REAL |
| Detail table 6행 (지표 sparkline + 설명 + 점수) | 🟢 REAL |
| 평균이동선 차트 (MA20/50/200) | 🟢 REAL (DB 컬럼 존재) |

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
| S&P 500 등 시장지수 가격 시계열 | DB 부재 | 외부 API (Alpha Vantage / Polygon) 도입 또는 DB 보강 |
| USD/KRW 환율 시계열 | DB 부재 | 외부 환율 API 도입 또는 정적 데이터 |
| supertrend / MACD 신호 변화 합성 | 미구현 | `analysis/events.ts` 에 추가 |
| 4지표 → 종합 합산식 | 단순 평균 (시안 미명시) | 02-data-analysis.md 에 가중치 표 정의 후 반영 |
| 원자재 영향 sector 매핑 | 일부 sector 미매핑 | 회사 sector ↔ 원자재 가중 매핑 보강 |

---

**원칙**: 새 슬롯 추가 시 이 표에 분류 행을 함께 추가. 분류 없이 구현 금지.
