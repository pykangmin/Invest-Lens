# dashboard-slots.md — 개별 주식 화면 슬롯 명세

출처: `images/개별 주식 화면.png`

이 화면이 평가의 메인. 슬롯의 위치 / `data_intent` / `chart_hint` / `severity_color_role` / 데이터 소스를 표로 정의. `13-render` 가 입력으로 받는 spec 의 시안 버전이다.

> **2차 정정 (5/6 후반)**: 1차 매핑에서 종목 헤더(이름·가격·변동) 위치를 헤더 좌측으로 잘못 분류했음. 시안 실제 위치는 **사이드바 최상단**. 시장 지수 4슬롯의 데이터 출처도 DB 부재 시의 대체 매핑을 명시하지 못해 코드에서 슬쩍 갈아낀 일이 있었음. 본 문서는 그 두 가지를 바로잡은 결과.

---

## 화면 목적

종목 하나를 선택했을 때, 그 종목을 4개 도메인(펀더멘탈·기술·거시·통화/심리) 관점에서 한눈에 보여주고, 인사이트(03-insight)를 심각도 색으로 강조.

---

## 전체 구도 ✅

- ✅ **테마**: 라이트. 배경 옅은 그레이 (`#F4F6F8` 추정), 카드는 흰색
- ✅ **그리드**: 12 column 추정
- ✅ 구조는 **헤더 풀 바** + **2-column 본문** (사이드바 / 메인)

수직 영역 (위 → 아래):

1. **헤더 풀 바** — 로고 / 글로벌 검색 / 시장 지수 4슬롯
2. **사이드바 (좌, 약 28~32%)** — 종목 헤더 + 게이지 5종 stack
3. **메인 (우, 약 68~72%)** — 위쪽 큰 영역 + 중간 (이벤트 + 환율) + 3중 게이지 + TOP 3 ×4

---

## 헤더 풀 바 ✅

가로 풀 영역. 좌→우 3블록.

| 블록 | 시안 | 매핑 |
|---|---|---|
| H1 (좌) | `〉 Invest Lens` 로고 | 진입 화면과 동일 마크. 다크 톤 |
| H2 (중앙) | 글로벌 검색 pill (좁은 폭) | 다른 종목으로 즉시 재진입 |
| H3 (우) | 작은 카드 4개 | 시장 컨텍스트 4종 (아래 표) |

### H3 시장 지수 4슬롯 — 데이터 출처 결정

**시안의 텍스트**: 4슬롯 모두 `S&P 500 / 35,301$` 표기 — mock 임이 명백.

**DB 실측**: 503개 종목과 거시·원자재 12개 카테고리는 있으나 **시장 지수(S&P/Dow/Nasdaq/Russell) 가격 시계열이 없음**. `global_environment` 의 모든 symbol 을 enumerate 한 결과 ^GSPC / ^DJI / ^IXIC / ^RUT / KOSPI 어느 것도 부재.

**결정**: 시안의 라벨 의도(종목과 무관한 시장 컨텍스트 4슬롯)를 유지하되, 데이터로는 위험·시장 지표 4종으로 대체. 시장 가격 직접 조달은 본 마감(5/14) 안에서 외부 의존 추가 여부에 따라 재결정.

| # | 라벨 | 데이터 | severity 의미 |
|---|---|---|---|
| H3-1 | VIX | `global_environment` symbol=`^VIX` | 30↑ WARNING / 20~30 CAUTION / ↓ INFO |
| H3-2 | DXY | symbol=`DX-Y.NYB` | 100±5 INFO / 그 밖 CAUTION |
| H3-3 | 10Y Treasury | symbol=`DGS10` | 4.5↑ WARNING / 3~4.5 CAUTION |
| H3-4 | HY Spread | symbol=`BAMLH0A0HYM2` | 5↑ WARNING / 3~5 CAUTION |

→ 본 결정은 21-aesthetics 와 무관하고 **순전히 데이터 가용성**의 문제. dashboard-slots 에 명시적으로 박음으로써 "시안과 다른 데이터를 코드에서 슬쩍 갈아낀다" 가 재발하지 않도록.

---

## 사이드바 ✅ (좌, ~28~32%)

세로 stack. **종목 헤더가 최상단**. 그 아래 게이지 5종 카드.

### 사이드바 상단 — 종목 헤더 (slot SB1)

```
Apple Inc                                   ← 회사명 (작은 회색)
102.36$                                     ← 가격 (큰 검정 굵음)
+2.36$ (0.87%)                              ← 변동 (녹/적)
```

- 라벨 색: muted
- 가격 폰트: tabular-nums
- 변동 색: 21-aesthetics 의 의미 색 (상승=녹 / 하락=빨)

### 사이드바 본문 — 게이지 5종 (slot SB2 ~ SB6)

각 항목: 도넛 + 라벨 + 한줄 평/점수 + 우측 chevron `〉`

| # | 라벨 | 시안 표기 | 데이터 소스 | 점수 산출 |
|---|---|---|---|---|
| SB2 (G1) | 기업 펀더멘탈 | `GOOD` / Score 60/100 | `stock_fundamentals` 9지표 | 12-analyze (`fundamental.ts`) |
| SB3 (G2) | 거시 경제 | `POSITIVE` / Soft Landing | `macro_regime_scores` | dominant_regime + confidence (`macro.ts`) |
| SB4 (G3) | 통화 | `NEGATIVE` / Score 32 | `global_environment` 통화 (DXY) | 95~105 정상 영역 (`environment.ts`) |
| SB5 (G4) | 기술적 | (시안 가려짐) | `stock_price_tech` (RSI/MACD/MA) | RSI + ma200 trend (`technical.ts`) |
| SB6 (G5) | 공포·탐욕 | `FEAR` 23 | `global_environment` 시장심리 (^VIX) | VIX 구간 매핑 (`environment.ts`) |

도넛 스타일은 시안 추정값 (외경 ~80px / 두께 ~8px / 진행률 점수 비례).

severity 매핑은 03-insight 의 WARNING/CAUTION/INFO 3등급 따름. 색은 21-aesthetics 가 단일 진실.

---

## 메인 영역 ✅ + ❓

세로 stack. 위→아래.

### M0 — 메인 위쪽 큰 영역 ❓

시안에서 사이드바 우측의 위쪽 절반 정도가 **빈 공간**. 정체 미상.

**옵션**:
- (a) 큰 가격 추세 차트 (라인) — 평가 배점상 자연스러움
- (b) 종목 요약 카드 grid (회사 설명 + 핵심 지표)
- (c) 시안 그대로 빈 padding

**결정 (5/6)**: **(a) 큰 가격 추세 차트**. 슬롯 ID `main.priceChart`. ECharts 라인 + 60일 / 180일 / 252일 토글. severity_color_role: up_down (구간별 추세 색).

### M1 — 주요 이벤트 (좌) ✅

- 카드 헤더: `주요 이벤트` + 우측 chevron `〉`
- 행 4개 (시안에서는 모두 `25 APR` mock)
- 행 구성: 좌 날짜 박스(일/월) · 중 제목+부제 · 우 카테고리 태그(옅은 배경 칩, severity 색)

데이터 소스 (12-analyze 의 이벤트 합성):
- `stock_price_tech.supertrend_signal` 전환일
- `stock_price_tech.macd` 와 `macd_signal` 교차 (골든/데드 크로스)
- `macro_regime_scores.dominant_regime` 변경일
- `stock_fundamentals.date` (분기 보고일)
- RSI 70/30 임계 돌파 (현재 첫 컷)

### M2 — 환율·원자재 (우) ✅

- 카드 4개 세로 배열
- 각 카드: 라벨 + 큰 숫자 + 변동률 + 미니 sparkline

**4종 결정**:

| # | 라벨 | symbol | 출처 |
|---|---|---|---|
| M2-1 | WTI 원유 | `CL=F` | `commodity_prices` |
| M2-2 | 금 | `GC=F` | `commodity_prices` |
| M2-3 | 구리 | `HG=F` | `commodity_prices` |
| M2-4 | DXY | `DX-Y.NYB` | `global_environment` 통화 |

(USD/KRW 는 DB 부재. DXY 로 대체 — 시안 라벨 `USD/KRW` 그대로는 못 씀.)

### M3 — 3중 종합 게이지 ✅ (정정)

**시안 정정**: 카드 **1개** 안에 게이지 3개가 가로 정렬 (1차 매핑은 카드 3개로 잘못 분리).

- 카드 헤더: `3종 평균 지수` 또는 비슷 (시안 정확한 제목 가려짐)
- 본문: 게이지 3개 가로
  - 1번 (74.2): **펀더 종합** (= G1 점수)
  - 2번 (74.2): **기술 종합** (= G4 점수)
  - 3번 (65.2): **거시 종합** (= G2 + G3 + G5 평균)

각 게이지: 큰 숫자 + sparkline (점수 추이).

### M4-M7 — TOP 3 ×4 ✅

가로 4개 카드. 각 카드: 헤더 + 1/2/3 순위 + 종목 + 보조 수치.

**4종 카테고리 결정**:
- M4: 펀더 TOP 3 (펀더 종합 점수 내림차순)
- M5: 기술 TOP 3 (기술 종합 점수 내림차순)
- M6: 거시 민감 TOP 3 (베타·변동성 등 — 본 마감 전 정의)
- M7: 통화 TOP 3 (해외 매출 비중·통화 노출 — 본 마감 전 정의)

**전 종목 비교** 가 필요하므로 별도 API 필요: `/api/screen?category=fundamental&limit=3`. 본 마감 전 추가.

placeholder 정책: 데이터 없는 동안 카드 전체를 **비활성 톤** + "데이터 준비 중" 한 줄. 종목 자리에 "—" 채우지 않음.

---

## 슬롯 ID 정리 (13-render 입력 spec)

| slot_id | 위치 | data_intent | chart_hint | severity_color_role | 데이터 소스 |
|---|---|---|---|---|---|
| `header.logo` | H1 | brand | text | none | n/a |
| `header.search` | H2 | input | searchbar | none | `/api/companies?q=` |
| `header.context[1..4]` | H3 | latest_value | mini-stat | severity | global_environment 의 VIX/DXY/10Y/HY Spread |
| `sidebar.symbol` | SB1 | identifier | text | none | `company_master` |
| `sidebar.price` | SB1 | latest_value | text | none | `stock_price_tech.close` (latest non-null) |
| `sidebar.change` | SB1 | delta | text | up_down | technicalHistory[0].close − [1].close |
| `sidebar.gauge[1..5]` | SB2~SB6 | composite_score | donut | severity | analysis 레이어 산출 |
| `main.priceChart` | M0 | timeseries | line | up_down | technicalHistory.close |
| `main.events` | M1 | event_log | timeline list | severity per row | analysis.events |
| `main.fxCommodity[1..4]` | M2 | sparkline + value | mini-stat + sparkline | up_down | commodity_prices + global_environment |
| `main.compositeTrio` | M3 | composite_score (3) | gauges + sparklines | severity | analysis.composite |
| `main.top3[1..4]` | M4-M7 | ranking | list | none | `/api/screen` (예정) |

---

## 미해결 결정 (디자이너 / 기획팀 확정 필요)

| # | 항목 | 현재 결정 | 추후 합의 |
|---|---|---|---|
| 1 | 시장 지수 4슬롯 데이터 | 위험·시장 지표 4종 (VIX/DXY/10Y/HY Spread) 으로 대체 | S&P/Dow/Nasdaq 가격 외부 조달 가능성 검토 |
| 2 | M0 (메인 위쪽 영역) | 가격 추세 라인 차트 | 시안 디자이너 의도 확인 |
| 3 | M3 헤더 라벨 | "3종 평균 지수" 추정 | 시안 정확 텍스트 확인 |
| 4 | M6 거시 민감 TOP 정렬 기준 | 미정 | 베타 계수 또는 거시 변수 상관 |
| 5 | M7 통화 TOP 정렬 기준 | 미정 | 해외 매출 비중 (S&P 회사별 데이터 필요) |
| 6 | 인기 검색어 4칩 (랜딩) | 시안 그대로 (삼성전자 disabled) | 동적 TOP (S&P 거래량 기준) 으로 교체 검토 |
| 7 | G4 기술 게이지 시안 표기 | 가려짐 → "TRENDING/NEUTRAL/OVERBOUGHT" 자체 산출 | 디자이너 라벨 확인 |
| 8 | 부제의 ___ (랜딩) | "리스크 시그널" | 사용자 결정 |

---

## 구현 위치 (LAYERS.md 매핑)

- `src/layout/StockDashboard.tsx` — 마스터 레이아웃 (header + sidebar + main)
- `src/visualization/Donut.tsx` — SB2~SB6, M3 의 게이지
- `src/visualization/Sparkline.tsx` — M2, M3 sparkline, M0 가격 차트의 lo-fi 버전
- `src/visualization/MiniStat.tsx` — H3, M2
- `src/visualization/EventList.tsx` — M1
- `src/visualization/Top3Card.tsx` — M4-M7
- `src/visualization/CompositeTrio.tsx` (신규) — M3 단일 카드 안의 3-게이지
- `src/analysis/` — analysis 레이어가 SB2~SB6, M3 의 모든 점수 산출

---

## 1차 매핑의 회고 (재발 방지용)

1. 시안의 픽셀 위치를 따르지 않고 **의미 단위로 묶다가** 종목 헤더를 헤더 영역으로 잘못 분류했음. → 본 문서는 픽셀 위치 우선.
2. 데이터 미확보 만나자 **시안과 다른 데이터를 코드에서 슬쩍** 갈아낀 일 있었음 (헤더 시장 지수). → 본 문서가 명시적 대체 결정의 기록 위치. 코드는 본 문서를 따름.
3. 시안 빈 공간을 **즉흥적으로 채움** (M0 차트). → 본 문서가 빈 공간 처리 결정의 기록 위치.
