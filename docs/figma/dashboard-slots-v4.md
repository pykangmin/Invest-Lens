# dashboard-slots-v4.md — 최종 시안 와이어프레임 spec (단일 진실의 원천)

**출처**: Figma REST API (`figma-tree.json` 1.56MB · 4 화면 deep parse)
**추출 스크립트**: `scripts/figma-extract-screens.mjs`
**추출 시각**: 2026-05-09
**파일 키**: `UJoPeW9SMzwDqX8B44eMrc`
**페이지**: `0:1` "1. Reference & Design"
**폐기**: `dashboard-slots-v3.md` (임시 시안 251:4045 기반 — 보존하되 reference 안 함)

---

## 0. 개요

이 문서는 **Figma 노드 트리에서 직접 추출한** 와이어프레임 spec. PNG 추측 없음. 좌표·텍스트·hex·폰트 모두 트리 그대로.

**주요 축 3가지**:
1. 진입화면 (`home`) — 종목 검색
2. 개별 주식화면 (`main`) — 4지표 게이지·종합 점수·랭킹
3. 4지표 detail — `main-commodity` / `main-technical` (펀더·거시 detail은 시안 미완)

**4지표** (네이밍은 시안 컴포넌트명 그대로):
- 기업 펀더멘털
- 거시 경제
- 원자재 영향
- 기술적 지표 *(시안 컴포넌트명에는 "지술적 지표" 오타 존재 — 코드에는 정정 표기)*

상세 와이어프레임 데이터: [`screens/<slug>.json`](./screens/) — 화면별 1 파일.

---

## 1. 디자인 시스템 (4 화면 통합)

### 1.1 색 팔레트 (사용 빈도순, 5회 이상)

| 역할 | hex | 사용 |
|---|---|---|
| 브랜드 네이비 (PRIMARY) | `#003049` | 183× |
| 성공 그린 (UP / POSITIVE) | `#60c846` | 74× |
| 보더 그레이 (CARD STROKE) | `#e9e9e9` | 67× |
| 보조 텍스트 그레이 | `#7f7f7f` | 49× |
| 화이트 (CARD BG / TEXT) | `#ffffff` | 37× |
| 위험 레드 (DOWN / NEGATIVE) | `#c1121f` | 19× |
| 위험 레드 보조 (그라디언트 끝) | `#e06069` | 19× |
| 본문 다크 그레이 | `#4e4e4e` | 18× |
| 페이지 배경 (LIGHT BG) | `#fafbfc` | 13× |
| 그레이 보조 | `#747474` | 10× |
| 다크 그레이 | `#373737` | 9× |
| 그린 라이트 BG | `#e4ffdf` | 7× |
| 그린 미디엄 | `#b6f0ac` | 7× |
| 블랙 | `#000000` | 7× |
| 그린 다크 | `#43bb2e` | 6× |
| 로고 액센트 1 (딥 레드) | `#780000` | 5× |

**의미 색 매핑** (21-frontend-aesthetics 와 정합 필요):
- UP / POSITIVE → `#60c846` (그린 솔리드) · `#43bb2e` (그린 다크) · `#e4ffdf` (그린 BG)
- DOWN / NEGATIVE → `#c1121f` (레드 솔리드) · `#e06069` (레드 보조) · `#ffe8e8` (레드 BG)
- NEUTRAL / 카드 보더 → `#e9e9e9`
- 본문 텍스트 → `#003049` (강조) · `#4e4e4e` · `#7f7f7f`
- 페이지 BG → `#fafbfc`

### 1.2 폰트 카탈로그

| family | 용도 | weight | size |
|---|---|---|---|
| **Pretendard Variable** | 본문·헤더·UI 전반 | 400/500/600/700 | 10~60 |
| **Freesentation** | 수치 표기 보조 (특히 detail 화면 라벨) | 600 | 10/13/15/19/20 |
| **Fugaz One** | 로고 전용 ("Invest Lens") | 400 | 16/20 |

가장 빈번한 스타일 top 5:
1. `Pretendard Variable:600:13` — 80×
2. `Pretendard Variable:600:16` — 47×
3. `Pretendard Variable:600:15` — 44×
4. `Freesentation:600:13` — 16×
5. `Pretendard Variable:600:18` — 13×

### 1.3 컴포넌트 카탈로그 (재사용 단위)

페이지 0:1에 등록된 디자인 시스템 컴포넌트 (151개) 중 화면이 사용:

- `logo` (94×94) — 좌상단 / 헤더 공용
- `header/global` (1440×70) — 글로벌 검색 pill 포함 헤더
- `chevron/right regular` — 게이지 카드의 ">" 아이콘 (5×)
- `zoom/search regular` — 검색 돋보기 아이콘
- `이전으로` — detail 화면의 좌상단 뒤로가기
- `Card/main-analysis` (281×608) — main의 사이드바 게이지 카드 (4개 variant)
- `Card/score` (402×521) — 종합 점수 3중 카드 (시점별 variant)
- `Card/ranking` (1180×290) — TOP 3 ×4 카드
- `Card/원자재/main-four` (296×524) — commodity detail의 4 mini-card 그리드
- `Card/원자재/주요 가격` (167×797) — commodity detail의 가격 현황 8-card
- `Card/원자재/주요 이슈` (385×404) — commodity detail의 섹터 이슈 카드
- `Card/기술/상승기여` (170×488) — technical detail의 기여도 카드
- `card/기술/신호 등급` (572×552) — technical detail의 BUY/SELL bar
- `card/기술/기여도` (156×748) — technical detail의 컬럼별 기여도
- `side menu` (281×608) — detail 화면 좌측 5-항목 nav

#### Variant 매핑 (시안 컴포넌트명에서 직접 추출)

**main 사이드바 4 게이지** (`State=` variant):
- `State=기업 펀더멘털` → 펀더 게이지 카드
- `State=거시 경제` → 거시 게이지 카드
- `State=원자재 영향` → 원자재 게이지 카드
- `State=지술적 지표` → 기술 게이지 카드 *(오타 — 정정해서 사용)*

**main 종합 점수 3중** (`점수 집계 기간=` variant):
- `점수 집계 기간=오늘 종합 점수`
- `점수 집계 기간=이번 달 종합 점수`
- `점수 집계 기간=올해 종합 점수`

**main TOP 3 ×4** (`ranking=` variant) — 코드의 `/api/screen` 4 카테고리와 정확히 일치:
- `ranking=오른 주식` → priceUp
- `ranking=거래된 주식` → volume
- `ranking=떨어진 주식` → priceDown
- `ranking=점수 좋았던 주식` → scoreTop

**Hover 상태**:
- `hover=원자재 영향` — 게이지 카드 hover 시 별도 variant
- `hover=기술적 흐름` — 동일

---

## 2. 화면 1: home (진입화면)

**노드**: `219:2558` · 1440×1024
**상세 데이터**: [`screens/home.json`](./screens/home.json)
**현재 코드**: `src/layout/Landing.tsx`

### 2.1 슬롯 spec

| ID | 위치 | 콘텐츠 | 비고 |
|---|---|---|---|
| `home.bg.base` | (0,0) 1440×1024 | 솔리드 `#003049` (네이비) | 베이스 레이어 |
| `home.bg.image` | (0,0) 1440×1024 | `images/진입 화면 배경.png` (3D 캔들차트) **opacity 0.15** | 오버레이 |
| `home.logo` | (652,186) 137×28 | logo + "Invest Lens" 16px Fugaz One white | logo 컴포넌트 |
| `home.headline` | (500,228) 440×122 | "투자의 시각, / 데이터로 ___ 하게" 60px Pretendard 600 white | 9 spaces 갭 |
| `home.headline.transparent` | (729,288) 104×66 | "투명" 60px — **fill opacity:0 + stroke white 1px** | **의도적 ghost text** (워드플레이) |
| `home.subtitle` | (363,376) 714×? | "기업의 펀더멘탈과 기술적 지표는 물론, 시장 국면과 원자재의 흐름까지 결합한 입체적 리스크 시그널로 투자 전략을 완성하세요." 20px Pretendard 600 white | **2026-05-09 사용자 갱신** — 두 줄 또는 한 줄 wrap |
| `home.search.bar` | (363,420) 714×49 | 흰 배경 + radius 60 pill + 좌측 돋보기 + 우측 go-icon | go-icon: `#003049` 원 + 흰 화살표 |
| `home.search.placeholder` | (443,430) | "주식 종목을 입력하세요." 18px Pretendard 500 `#a6a6a6` | |
| `home.popular.label` | (~,~) | 🔥 + "인기 검색어" 16px Pretendard 600 white | 🔥 아이콘은 GRADIENT_RADIAL 2단 |
| `home.popular.chips` | 7× 칩 | **AAPL · MSFT · GOOGL · AMZN · NVDA · TSLA · META** — radius 50 pill, fill `#002031` 20%, stroke white 1px | **2026-05-09 사용자 갱신** — 4→7개. 삼성전자 제거 |

### 2.2 코드 변경점 (현재 → v4)

- ✅ 헤드라인 wordplay — 현재는 "투명"이 골드 강조. **수정**: stroke-only ghost text로 변경
- ✅ 부제 — 사용자 지정 신규 문구로 교체
- ✅ 인기 검색어 칩 — 4개 → **7개** (AAPL · MSFT · GOOGL · AMZN · NVDA · TSLA · META)
- ✅ 배경 — `images/진입 화면 배경.png` 를 `#003049` 위에 opacity 0.15 로 오버레이
- ✅ go-icon — 현재 디자인 확인 후 spec 일치 검증
- 그 외 슬롯 위치·텍스트는 거의 일치

---

## 3. 화면 2: main (개별 주식화면)

**노드**: `251:3523` · 1440×1630
**상세 데이터**: [`screens/main.json`](./screens/main.json) (151 texts)
**현재 코드**: `src/layout/StockDashboard.tsx`

### 3.1 레이아웃 구조 (수직 단)

```
┌─ HEADER (y≈0~70) ────────────────────────────────────────────┐
│  Invest Lens ●           [오늘은 어떤 종목을 분석 해볼까요?]    │
└──────────────────────────────────────────────────────────────┘
┌─ TICKER + 시장 컨텍스트 (y=96~160) ───────────────────────────┐
│  Apple Inc                          S&P 500 ×4 (시안 mock)   │
│  102.36$ +2.36$ (0.87%)             각: 35.301$ / 변동률      │
└──────────────────────────────────────────────────────────────┘
┌─ 사이드바 4게이지 (x≈186) ──┐  ┌─ 차트 (y=199~720) ────────┐
│  G1 기업 펀더멘털  GOOD 60   │  │  "차트" 헤더 (x=441,y=199)│
│  G2 거시 경제  POSITIVE/SL  │  │  가격 라인 차트            │
│  G3 원자재 영향  NEG 32     │  │                            │
│  G4 기술적 지표  FEAR 23    │  │                            │
└────────────────────────────┘  └────────────────────────────┘
┌─ 주요 이벤트 (좌) ──────────┐  ┌─ 환율 (우) ────────────────┐
│  25 APR  GDP 예비치 발표    │  │  USD/KRW   1,530.50         │
│         거시지표 chip / ET  │  │  미국 달러→원화  +0.31% sp  │
│  ... 5행                    │  │  ... 5행                   │
└────────────────────────────┘  └────────────────────────────┘
┌─ 종합 점수 3중 (y=1152~1280) ────────────────────────────────┐
│  오늘 74.2 sp     이번 달 74.2 sp     올해 65.2 sp           │
│  전일 대비 4.20 (+0.31%) — 카드별 base 다름                 │
└──────────────────────────────────────────────────────────────┘
┌─ TOP 3 ×4 (y=1313~) ────────────────────────────────────────┐
│  오른 주식 │ 거래된 주식 │ 떨어진 주식 │ 점수 좋았던 주식    │
│  1 NVDA 8.31% / 2 NVDA 8.31% / 3 NVDA 8.31% (mock)          │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 슬롯 spec (위→아래)

#### 3.2.1 헤더 (y=0~70)

| ID | 위치 | 콘텐츠 |
|---|---|---|
| `main.header.logo` | (101,21) | logo + "Invest Lens" 20px Fugaz One |
| `main.header.search` | (391,23) | "오늘은 어떤 종목을 분석 해볼까요?" 15px placeholder pill |

→ **시장지수 4슬롯 없음**. 현재 코드의 `IndexStripe`(VIX/DXY/10Y/HY) 폐기.

#### 3.2.2 종목 헤더 + 시장 컨텍스트 (y=96~160)

| ID | 위치 | 콘텐츠 |
|---|---|---|
| `main.ticker.name` | (165,96) | "Apple Inc" 25/600 |
| `main.ticker.price` | (165,117) | "102.36$ +2.36$ (0.87%)" 40/500 |
| `main.market.context[0..3]` | (885/987/1089/1191, 96) | 4× "S&P 500" 15/600 + 가격 + 변동률 — **시안 mock 동일** |

→ 현재 코드는 헤더 안 IndexStripe. **재배치 필요** — 시장 컨텍스트 4슬롯은 **종목 행 우측**.

#### 3.2.3 사이드바 4 게이지 (x≈186, y=199~720)

| ID | y | label | 도넛/표기 |
|---|---|---|---|
| `main.gauge.fundamental` | 199 | 기업 펀더멘털 | GOOD 60 (그린 도넛) / Score 60/100 |
| `main.gauge.macro` | 339 | 거시 경제 | POSITIVE / Soft Landing (스파크라인) |
| `main.gauge.commodity` | 476 | 원자재 영향 | NEGATIVE 32 (레드 도넛) / Score 32/100 |
| `main.gauge.technical` | 613 | 기술적 지표 | FEAR 23 (레드 도넛) / Score 23/100 |

→ 각 카드 우측에 chevron `>` — **클릭 시 detail 화면 이동**.
→ **5종 아닌 4종**. 이전 임시 v3의 공포·탐욕 게이지 별도 표시 폐기 (시안에서 기술 게이지 안에 통합 — `FEAR 23`).

#### 3.2.4 차트 (사이드바 옆, y=199~720)

| ID | 위치 | 콘텐츠 |
|---|---|---|
| `main.chart.header` | (441,199) | "차트" 15/600 |
| `main.chart.line` | 그 아래 | 가격 라인 차트 (180일 종가) |

→ **사이드바와 같은 단**. 현재 코드의 별도 단 차트 배치 → 재배치.

#### 3.2.5 주요 이벤트 + 환율 (y=757~1100, 2-col)

| ID | 위치 | 콘텐츠 |
|---|---|---|
| `main.events.header` | (195,760) | "주요 이벤트" 15/600 |
| `main.events.more` | (632,762) | "더보기" 13/600 |
| `main.events.row[0..4]` | y=797~1072 | 5행: 날짜 박스 25 APR + 제목 + chip + 시간 + 부제 |
| `main.fx.header` | (757,757) | "환율" 15/600 |
| `main.fx.row[0..4]` | y=797~1072 | 5행: USD/KRW + 1,530.50 + sparkline + 변동률 |

→ 현재 코드는 한 단(1:1 가로) — **2-col 단 배치로 재구성**.

#### 3.2.6 종합 점수 3중 (y=1152~1280)

| ID | x | label | 값 |
|---|---|---|---|
| `main.composite.today` | 195 | 오늘 종합 점수 | 74.2 (40/600) + sparkline + 전일 대비 |
| `main.composite.month` | 568 | 이번 달 종합 점수 | 74.2 + sparkline + 전일 대비 |
| `main.composite.year` | 942 | 올해 종합 점수 | 65.2 + sparkline + 전일 대비 |

→ 코드의 `CompositeTrio` 그대로 유지. delta base는 카드별 분기 (전일 대비 / 30일 전 대비 / 연초 대비) — 시안 mock 은 모두 "전일 대비"이지만 코드 결정 유지.

#### 3.2.7 TOP 3 ×4 (y=1313~)

| ID | x | category | 행 |
|---|---|---|---|
| `main.top3.priceUp` | 190 | 오른 주식 TOP 3 | 1/2/3 + ticker + 한글명 + % |
| `main.top3.volume` | 470 | 거래된 주식 TOP 3 | (시안 라벨 mock 동일이지만 컴포넌트명은 `ranking=거래된 주식`) |
| `main.top3.priceDown` | 750 | 떨어진 주식 TOP 3 | (`ranking=떨어진 주식`) |
| `main.top3.scoreTop` | 1030 | 점수 좋았던 주식 TOP 3 | (`ranking=점수 좋았던 주식`) — 4번째 카드 mock 은 GOOGLE 92점 |

→ **코드의 4 카테고리(`/api/screen?category=priceUp/volume/priceDown/scoreTop`)와 정확히 일치**. 변경 0.

### 3.3 코드 변경점 (현재 → v4)

| 영역 | 현재 코드 | v4 시안 | 작업 |
|---|---|---|---|
| 헤더 | `IndexStripe` (VIX/DXY/10Y/HY) | 글로벌 검색만 | IndexStripe 제거, `GlobalSearch` 헤더에 배치 |
| 시장 컨텍스트 | 헤더 안 | 종목 행 우측 (S&P 500 ×4 mock) | 위치 이동, mock 카드 4개로 단순화 |
| 사이드바 게이지 | 4 (이미 일치) | 4 ✅ | 위치만 미세 조정 |
| 차트 | 별도 단 | 사이드바 옆 (가로 결합) | grid 재배치 |
| 이벤트/환율 | 한 단 1:1 | 2-col (좌 이벤트, 우 환율) | grid 재배치 |
| 종합 점수 3중 | 시점 trio (이미 일치) | ✅ | 변경 0 |
| TOP 3 ×4 | 4 카테고리 (이미 일치) | ✅ | 변경 0 |

---

## 4. 화면 3: main-commodity (원자재 영향 분석)

**노드**: `271:561` · 1440×2190
**상세 데이터**: [`screens/main-commodity.json`](./screens/main-commodity.json) (90 texts)
**현재 코드**: 미구현 — 신규 작성 필요

### 4.1 공통 detail shell

| ID | 위치 | 콘텐츠 |
|---|---|---|
| `detail.header.logo` | (116,22) | logo + "Invest Lens" 20px |
| `detail.header.search` | (423,28) | 글로벌 검색 placeholder |
| `detail.breadcrumb.back` | (71,89) | "이전으로" 12/500 |
| `detail.breadcrumb.path` | (202,89) | "GOOGLE > 원자재 영향 분석" 12/500 |
| `detail.breadcrumb.updated` | (1165,89) | "데이터 업데이트: 2026.04.30 09:42 (ET)" 12/500 |
| `detail.nav` | (68, 138~326) | 5-항목 세로 nav: 개요 / 펀더멘털 / 거시 경제 / **원자재 영향** (활성) / 기술적 흐름 |
| `detail.title` | (239,149) | "원자재 영향 분석" 20/700 |
| `detail.subtitle` | (239,190) | "Google의 주요 원자재 관련 비용 및 매출 영향과 시장 동향을 분석합니다." 14/500 |

### 4.2 commodity 고유 섹션

| 영역 | y | 콘텐츠 |
|---|---|---|
| 핵심 요약 | 250 | 좌: 본문 + 3 chip (비용 영향 부정적 / 공급 안정성 양호 / 향후 전망 중립) — 우: NEGATIVE 23 도넛 + "전날 대비 -2 (하락)" |
| 4 mini cards | 471~520 | 리튬 +134% / 금 $4,763 / WTI $93.3 / 금 +40% (`title=리튬/금/원유/금 상승` variants) |
| 주요 원자재 가격 현황 (좌) + 가격 변동률 비교 (우) | 586 | 8-card 그리드 (4×2) + bar chart |
| 원자재 시장 지표 요약 + 변동성-수익률 매트릭스 | 859 | scatter chart |
| 카테고리별 가격 추이 (3 line) | 1214 | 에너지 / 산업금속 / 귀금속 (3 line charts) |
| 주요 섹터별 시장 이슈 분석 | 1559 | 3 카드: 귀금속 (Overweight) / 산업금속&에너지 (Neutral) / 농산물 (Underweight) |
| 자산군 정규화 사이클 | 1765 | line chart (Base=100, 2021 Q2) |
| WTI vs 천연가스 괴리율 | 1765 | line + Long↑ / Short↓ 마커 |

### 4.3 데이터 분류 (REAL vs EXAMPLE)

- **REAL 가능**: WTI/Brent/Gold/Copper 가격 (`global_environment` 또는 외부 API), 종목 sector → 원자재 매핑
- **EXAMPLE**: 핵심 요약 본문 텍스트, 시장 이슈 분석 카드 본문 — 시안 mock 그대로 (LLM 합성 또는 정적 텍스트)

---

## 5. 화면 4: main-technical (기술적 흐름)

**노드**: `327:456` · 1440×1804
**상세 데이터**: [`screens/main-technical.json`](./screens/main-technical.json) (73 texts)
**현재 코드**: 미구현 — 신규 작성 필요

### 5.1 공통 detail shell

§4.1과 동일. 활성 nav 항목만 "기술적 흐름". breadcrumb path "GOOGLE > 기술적 지표 스코어카드".

### 5.2 technical 고유 섹션

| 영역 | y | 콘텐츠 |
|---|---|---|
| 종합 점수 요약 (좌) + 신호 등급 (우) | 252 | 67 도넛(그린) +4pt / 6 chip (이동평균선+2 / 거래량+2 / RIS+2 / Super Trend+2 / MA+2 / VIX+2) ⟶ Sell/Hold/**BUY**/Strong buy bar (현재 BUY) |
| 종합 점수 추이 | 490~820 | line chart |
| 지표별 기여도 (최근 1주일) | 821 | 7-column header + 큰 숫자 (Super Trend 17/20 / 이동평균선 14/20 / MACD 11/15 / RSI 11/15 / VIX 9/15 / 거래량 5/15 / **총합 67/100**) |
| 지표 detail table | 979~1380 | 4-col table (지표 / 최근 1주일 추이 sparkline / 요약 / 점수). 6행. |
| 평균이동선 차트 | 1386 | 주가 + MA20 + MA50 + MA200 line chart |

### 5.3 시안에서 확정된 가중치

| 지표 | 만점 | 시안 예시 점수 |
|---|---|---|
| Super Trend | 20 | 17 |
| 이동평균선 | 20 | 14 |
| MACD | 15 | 11 |
| RSI | 15 | 11 |
| VIX 지수 | 15 | 9 |
| 거래량 | 15 | 5 |
| **총합** | **100** | **67** |

→ **02-data-analysis 본문에 가중치 표 추가 필요**. 현재 코드의 `technical.ts`는 RSI 단일 기반 — 6 metric 가중 합산으로 재구현.

---

## 6. 미해결 / 시안 부재

### 6.1 펀더멘털 / 거시 경제 detail 화면 시안 미작성
- 좌 nav에는 5항목 다 있지만 프레임은 4개 (home + main + commodity + technical)
- **선택지**:
  - (a) commodity / technical detail 템플릿 재사용 — 펀더 9지표 / 거시 4 regime prob 로 채움
  - (b) 펀더·거시 detail 화면은 출시 보류, nav 항목 비활성 (회색 disabled)
  - (c) 디자이너에게 추가 시안 요청

### 6.2 시안 mock 텍스트 미완성
- 모든 4 TOP 3 카드 라벨이 동일 ("어제 가장 많이 오른 주식 TOP 3") — 컴포넌트 variant 명으로는 4 카테고리 명확 (`ranking=오른/거래된/떨어진/점수 좋았던`). 코드는 variant 명 따름.
- 컴포넌트 오타: `State=지술적 지표` → "기술적 지표" 정정해서 사용

### 6.3 종합 점수 산출 공식
- 시안에서 확인된 사실: 4지표 게이지 + 시점 trio 모두 0~100 점수, "전일 대비" delta 표기
- **공식 미명시**: 4지표 (펀더 60 · 거시 (POSITIVE) · 원자재 32 · 기술 23) → 종합 74.2 가 어떻게 합쳐지는지
- → **02-data-analysis 에 가중치 정의 필요** (기술 detail 의 6-metric 가중치는 확정. 4지표 → 종합은 미정)

---

## 7. 마이그레이션 체크리스트 (v3 → v4)

- [ ] `dashboard-slots-v3.md` 보존, reference 갱신 (코드는 v4 만 따름)
- [ ] `Landing.tsx` 미세 조정 — "투명" ghost text + 부제 빈 칸
- [ ] `StockDashboard.tsx` 재배치 (헤더/시장컨텍스트/차트/이벤트환율 grid 재구성)
- [ ] `IndexStripe` 제거 (시안 부재)
- [ ] `GlobalSearch` 헤더에 배치 (placeholder 텍스트 갱신)
- [ ] **신규 컴포넌트** — `DetailShell` (header + breadcrumb + left nav + page title 공통 5개 detail 화면용)
- [ ] **신규 화면** — `CommodityDetail.tsx` / `TechnicalDetail.tsx`
- [ ] **신규 라우팅** — `/dashboard/<TICKER>/commodity` `/dashboard/<TICKER>/technical`
- [ ] 게이지 카드 chevron 클릭 → detail 화면 라우팅
- [ ] `02-data-analysis` 가중치 보강 — technical 6-metric + composite 4지표
- [ ] `21-frontend-aesthetics` 색 팔레트 cross-check (브랜드 네이비 `#003049` / 그린 `#60c846` / 레드 `#c1121f`)
- [ ] verify-skills.sh 통과 / verify-structure.sh 통과 / typecheck 통과

---

**파악 끝**. 코드 변경 시 이 문서를 reference 로만 가리키고, 도메인 정의는 Skills 8개 파일에 위임.
