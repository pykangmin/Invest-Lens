# dashboard-slots-v3.md — 개별 주식 화면 슬롯 명세

> **v3 — Figma tree 기반, PNG 추측 0.** 이 문서의 모든 결정은 `docs/figma/figma-tree.json` (root frame `ver2`, 1440×2170, absolute (3952, 9601)) 와 `docs/figma/slots.generated.json` 의 노드 좌표·이름·텍스트·fill 만을 근거로 한다. `images/*.png` 는 의도적으로 보지 않았다. v1·v2 는 PNG 추정으로 두 번 어긋남(G3 라벨 오기, 게이지 5개 오인, 환율 라벨 오인). 본 v3 가 그 두 가지를 바로잡은 결과.

---

## 0. 메타

| 항목 | 값 | 근거 |
|---|---|---|
| Figma file 명 | `[데이커] 투자 데이터 대시보드` | `figma-meta.json` |
| Root frame | `ver2` (id `251:4045`) | `figma-tree.json:13` |
| Root absolute box | (3952, 9601) · 1440×2170 | `figma-tree.json:15865` |
| Normalize 변환 | (x − 3952, y − 9601) | 모든 좌표는 root 좌상단 기준 |
| 추출 시각 | 2026-05-06T16:01:03Z | `slots.generated.json:source.extractedAt` |
| 슬롯 추출 결과 | 45 slots | `slots.generated.json:slots[]` |

---

## 1. 캔버스

| spec | 값 |
|---|---|
| width | 1440px (고정) |
| height | 2170px |
| background | `#ffffff` (root frame fill) — **본문은 카드 단위로 무채 흰색** |
| 좌우 좌측 콘텐츠 컬럼 시작 | x = 165 |
| 우측 컬럼 끝 | x = 1275 (1110 폭) |
| 외곽 양쪽 여백 | 165px (좌·우 동일) |

> **수정**: 기존 v2 가 가정했던 "라이트 그레이 배경 + 카드 흰색" 은 **틀림**. ver2 frame 자체가 `#ffffff` 흰색이고, 카드들은 white-on-white 로 stroke (`#003049` 라인) 또는 cornerRadius 만으로 구분된다. 옅은 그레이는 다른 페이지의 가정이거나 PNG 압축 추측이었다.

| CSS 변수 변경 필요 | 비고 |
|---|---|
| `--color-bg: #f4f6f8` → `#ffffff` | Figma 충실도. 또는 카드와 외곽을 분리하기 위한 ultra-light grey (`#fafbfc` — header/global frame fill 과 동일) 가 차선 |

---

## 2. 슬롯 트리 (의미 클러스터)

45 슬롯을 의미 단위 **7 클러스터** 로 묶는다. 각 클러스터의 좌표 박스는 **그 클러스터에 속한 모든 slot 의 union bbox**.

| cluster_id | 절대 좌표 (x, y, w, h) | 의미 (Figma 라벨) | 포함 slot_id (slots.generated.json) |
|---|---|---|---|
| `header` | (0, 0, 1440, 66) | `header/global` — 로고 + "오늘은 어떤 종목을 분석 해볼까요?" + 검색 pill | `headerglobal`, `search-bar`, `logo`, `search-icon` |
| `symbol-and-indices` | (165, 66, 1110, 112) | `Frame 4` (cornerRadius 30 카드) — **종목 헤더 + 시장 지수 4슬롯이 한 카드**에 가로 정렬 | `region-165-66`, `주가지수`, `text` (id `251:4050`), `text` (`251:4054`), `text` (`251:4058`), `text` (`251:4062`) |
| `gauges` | (165, 181, 1110, 148) | `Frame 18` — 게이지 카드 **4종** 가로 정렬: 기업 펀더멘털 / 원자재 영향 / 거시 경제 / 기술적 지표 | `region-165-181`, `region-445-181`, `region-726-181`, `region-1006-181`, `region-300-224`, `region-585-223`, `region-184-296`, `region-469-296`, `region-753-297`, `region-1034-297`, `progress`, 동명 `chevronright-regular` 들 |
| `chart` | (165, 1054, 550, 386) | `Group 88` 내 `Rectangle 76` (cornerRadius 10) — **차트 카드**. 카드 헤더 라벨: `차트` (193, 363) | (slots.generated.json 에는 차트 컨테이너가 region 으로 추출되지 않음 — `figma-tree.json:251:4068` Rectangle 76 / 라벨 텍스트 `251:4353`) |
| `events-and-fx` | (165, 1054, 1110, 386) | `Group 88` 내 우측 — **주요 이벤트 (좌)** + **환율 (우)** 가 한 행. 이벤트 카드 헤더: `주요 이벤트` (193, 1080); 환율 카드 헤더: `환율` (758, 1081) | `region-165-363` (Group 88 wrapper — 차트 라벨, 주요 이벤트 행, 환율 행 텍스트 모두 포함), `chevronright-regular` (`251:4109`) |
| `composite-trio` | (165, 1451, 1110, 147) | `Frame 17` — **3중 종합 카드 1개**. 좌→우 3 게이지: `오늘 종합 점수 74.2` / `이번 달 종합 점수 74.2` / `오늘 종합 점수 65.2` (각 + 전일 대비) | `region-165-1451`, `region-195-1560`, `region-573-1560`, `region-947-1554` |
| `top3-row` | (165, 1685, 1110, 151) | `Group 88` 내 하단 — **TOP 3 카드 4개** 가로. 헤더: 어제 가장 많이 오른 / 거래된 / 떨어진 / 점수가 좋았던 주식 TOP 3 | `region-196-1685`, `region-196-1744`, `region-196-1803`, `region-476-1685`, `region-476-1744`, `region-476-1803`, `region-469-1685`, `region-756-1685`, `region-756-1744`, `region-756-1803`, `region-1036-1744`, `region-1036-1803` |

> **이전 v2 와의 차이 (PNG → tree 정정)**
> 1. **시장 지수 4슬롯과 종목 헤더가 한 카드**다. 별도 카드가 아니다. cornerRadius 30 의 단일 frame `Frame 4` 안에 두 영역이 좌(종목 헤더) / 우(주가지수 4) 로 같이 들어 있다.
> 2. **게이지는 4개**다 (기업 펀더멘털 / 원자재 영향 / 거시 경제 / 기술적 지표). v2 가 가정한 "공포·탐욕 / 통화 G3 / G5" 는 잘못. EXTREME FEAR 는 **기술적 지표 카드 본문 표기**이고 별도 게이지가 아니다.
> 3. **사이드바 구조가 없다**. v2 가 가정한 "좌측 28~32% 사이드바 stack" 은 시안에 부재. 종목 헤더는 헤더 풀바도 아니고, **`Frame 4` 안 좌측**.
> 4. **3중 종합은 "3종 평균" 이 아니라 시점 비교**. 라벨이 `오늘 / 이번 달 / 오늘` 인데, 1·3 의 라벨이 동일하지만 색·점수 (74.2 녹 / 65.2 적) 가 다르므로 두 다른 도메인으로 추정됨 (디자이너 라벨 mock 의 placeholder 중복).
> 5. **환율 카드**는 4개 모두 라벨 `USD/KRW` + 부제 `미국 달러 → 원화` + 값 `1,530.50` + 변동 `4.20 (+0.31%)` 로 동일한 mock. 카드는 4개지만 시안 의도는 "통화·원자재 4슬롯".

---

## 3. 게이지 4종의 정확한 라벨 (트리 기준)

게이지 카드 헤더 텍스트 (Pretendard Variable / 15px / 600 / `#003049`) 4개를 `Frame 18` (id `251:4348`, 165, 181, 1110×148) 안에서 추출.

| # | slot_id (root frame) | 카드 헤더 라벨 | 본문 표기 (값/등급) | 본문 색 | 위치 (절대) |
|---|---|---|---|---|---|
| G1 | `region-165-181` (Group 80, id `251:4306`) | **기업 펀더멘털** | `GOOD` / 도넛 `60` / "/ 100" + `세부 지표 보기 〉` | 녹 `#60c846` | (165, 181) 268×148 |
| G2 | `region-445-181` (Group 82, id `251:4308`) | **원자재 영향** | `NEGATIVE` / 도넛 `32` / "/ 100" + `세부 지표 보기 〉` | 적 `#c1121f` | (445, 181) 269×148 |
| G3 | `region-726-181` (Group 81, id `251:4307`) | **거시 경제** | `SOFT\nLANDING` / `세부 지표 보기 〉` (도넛/점수 표기 없음 — 두 줄 라벨만) | 녹 `#60c846` | (726, 181) 269×148 |
| G4 | `region-1006-181` (Group 83, id `251:4309`) | **기술적 지표** | `EXTREME\nFEAR` / progress bar `23` / `세부 지표 보기 〉` | 적 `#c1121f` (값 `23` 은 검정 `#000000`) | (1006, 181) 269×148 |

> **PNG v2 정정 핵심**: G3 라벨이 `통화` 가 아니라 **`거시 경제`**, G4 가 `기술적` 도넛이 아니라 **`기술적 지표` + EXTREME FEAR + progress bar (도넛 아님)**. 또한 G2 가 v2 의 "통화 (DXY)" 가 아니라 **`원자재 영향`**. G5 (공포·탐욕) 는 시안에 **별도 카드로 존재하지 않으며** EXTREME FEAR 텍스트는 G4 안의 본문 표기.

> **추가 관찰**: G1·G2 는 도넛 (Group 57 / Group 58 — 85×86 정사각 group with 30px 점수), G3 는 큰 도넛/숫자 표기 없이 두 줄 텍스트만 (Group 81 안에는 점수 노드가 없다 — Figma 추정 후 디자이너에게 확인), G4 는 **도넛이 아니라 progress bar** (`progress` group `251:4111` — 113×59 cornerRadius 15 흰색). G1/G2 의 카드 우측 상단 / 좌측 상단 위치 추정.

---

## 4. 데이터 소스 매핑

각 클러스터의 슬롯 → DB·API 매핑. 미존재 데이터는 결정안과 함께.

### 4.1 `header`
| slot | 표시 | 소스 | 비고 |
|---|---|---|---|
| `headerglobal` (텍스트 `Invest Lens`) | 로고 + 카피 "오늘은 어떤 종목을 분석 해볼까요?" | n/a (정적) | Fugaz One 폰트 |
| `search-bar` | pill 검색창 | `/api/companies?q=` (`api/companies.ts`) | 입력 → company_master 503종 |
| `logo`, `search-icon` | 아이콘 | n/a | INSTANCE 노드 |

### 4.2 `symbol-and-indices` — Frame 4 (단일 카드, 한 줄)

좌측 (165, 96~) 종목 헤더:
| 라벨 | Figma 텍스트 | 소스 |
|---|---|---|
| 회사명 | `Apple Inc` (id `251:4047`, 25px, `#003049`) | `company_master.name` |
| 가격+변동 | `102.36$ +2.36$ (0.87%)` (40px, `#4c956c`) | `stock_price_tech.close` (latest) + delta vs prev |

우측 (921~1275, 99~160) 시장 지수 4슬롯 (`주가지수` frame `251:4049` + 3 형제):
| # | Figma 라벨 mock | 위치 | DB 부재 시 결정 (v2 와 동일) |
|---|---|---|---|
| H3-1 | `S&P 500 / 35.301$ / +38.1%` | (921, 100) | **VIX** (global_environment `^VIX`) |
| H3-2 | `S&P 500 / 35.301$ / +38.1%` | (1014, 100) | **DXY** (`DX-Y.NYB`) |
| H3-3 | `S&P 500 / 35.301$ / +38.1%` | (1100, 100) | **10Y** (`DGS10`) |
| H3-4 | `S&P 500 / 35.301$ / +38.1%` | (1195, 100) | **HY Spread** (`BAMLH0A0HYM2`) |

> 시안 라벨 4개가 모두 동일 (`S&P 500`) → mock 임이 명확. DB 에 인덱스 시계열이 없음 (v2 결정 그대로 유효). 단, **시안 충실도** 측면에서 `35.301$ / +38.1%` 표기 방식 (3자리 가격 + % delta) 을 그대로 따르기 위해 코드도 "값 + delta %" 두 줄.

#### 4.2.1 시장 지수 4슬롯 — 대체 옵션 3안 (v3 권고)

PNG 만 보고 "위험지표 4종으로 슬쩍 갈아낀" 일이 v2 에서 일어났다. v3 에서는 **명시적 옵션 3안 + 추천**으로 두어 코드가 임의로 결정하지 않도록 한다.

| 옵션 | 4슬롯 매핑 | 시안 충실도 | 데이터 충실도 | 비고 |
|---|---|---|---|---|
| **A. 위험지표 4종 (v2 결정)** | VIX / DXY / 10Y / HY Spread | 중 (시안 의도 "시장 컨텍스트" 보존, 라벨은 다름) | 상 (DB 보유) | 4 카테고리 모두 `global_environment` 에 있음 |
| **B. 거시 4 카테고리** | 통화(DXY) / 채권(10Y) / 변동성(VIX) / 신용(HY) | 중 | 상 | A 와 동일하나 **그루핑을 거시 카테고리 명**으로 표기 → 시안의 "S&P 500" 같은 추상화된 시장 컨텍스트 톤에 더 가까움 |
| **C. 인덱스 4종 (시안 그대로)** | S&P 500 / Dow / Nasdaq / Russell 2000 | 상 (시안 라벨 일치) | 하 (DB 부재 — 외부 야후/스투큐 의존 추가) | 본 마감(5/14) 안 외부 시계열 조달 가능 여부에 달림 |

**v3 권고: 옵션 B**. 사유: (i) DB 가용 — 마감 안 안전. (ii) 시안의 추상화된 "시장 컨텍스트 4슬롯" 의도를 살림. (iii) v2 의 단순 "VIX/DXY/10Y/HY" 라벨보다 **"통화·채권·변동성·신용"** 그루핑 라벨이 비전문 사용자에게 가독성이 높음. 라벨 세부는 13-render 가 결정.

### 4.3 `gauges` — Frame 18 (게이지 4종)

| # | 카드 헤더 | 본문 표기 산출 | 데이터 소스 | analysis 모듈 |
|---|---|---|---|---|
| G1 | 기업 펀더멘털 | `GOOD/NEUTRAL/POOR` 라벨 + 점수 `0~100` | `stock_fundamentals` 9 지표 | `analysis/fundamental.ts` |
| G2 | 원자재 영향 | `POSITIVE/NEUTRAL/NEGATIVE` 라벨 + 점수 `0~100` | `commodity_prices` (WTI/Gold/Copper) + 종목 산업 매핑 | `analysis/commodity-impact.ts` (**신규**) |
| G3 | 거시 경제 | regime 명 (예: `SOFT LANDING`) — 두 줄 텍스트 | `macro_regime_scores.dominant_regime` + confidence | `analysis/macro.ts` |
| G4 | 기술적 지표 | regime 명 (예: `EXTREME FEAR/OVERSOLD/NEUTRAL/OVERBOUGHT`) + progress bar value `0~100` | `stock_price_tech` (RSI/MACD/MA/Supertrend) + `global_environment` `^VIX` | `analysis/technical.ts` |

> **신규 모듈**: `commodity-impact.ts`. 종목별 commodity_prices 노출도 (산업 분류 → WTI/Gold/Copper 가중) 산출. v2 "통화 게이지" 와는 별개의 신규 산출 — 본 마감 전 산식 정의 필요.

> G3 가 점수가 아니라 **regime 명만** 두 줄로 표기되는 점에 주의. analysis layer 가 점수도 같이 산출하되, 카드 표기는 라벨 + chevron 뿐.

> G4 progress bar 의 점수 `23` 은 검정 (`#000000`) 텍스트로 표기 — 의미 색 미적용. **추정**: progress bar 자체가 색 (적색?) 으로 진행률을 표현하므로 텍스트는 무채. (디자이너 확인 필요)

### 4.4 `chart` — Group 88 내 차트 카드 (165, 1054, 550, 386)

| 라벨 | 텍스트 | 소스 |
|---|---|---|
| 카드 헤더 | `차트` (id `251:4353`, 193, 363 — wait 좌표가 1054 보다 위) | — |

> **혼란 정정**: figma-tree 의 `차트` 텍스트 absoluteBoundingBox 는 (4145, 9964) → normalize **(193, 363)**. 그러나 카드 영역 `Rectangle 76` 의 normalize 는 **(165, 1054)**. 두 좌표가 720px 차이가 난다. → **slots.generated.json 의 region-165-363 (Group 88) 좌표가 union 박스라서 (165, 363, 1110, 1496)** 로 들고 있다. 차트 라벨이 (193, 363) 이고 카드가 (165, 1054) 라는 것은 **시안에서 차트 라벨과 차트 카드 박스가 떨어져 있다**는 뜻이다 — 또는 (가능성 높음) 라벨 텍스트가 카드 위에 absolute 로 올라가 있고 좌표 정의가 카드 본체와 별개.

> **추정 (트리 분석으로 확정 불가)**: 차트 카드 헤더 라벨 `차트` (193, 363) 는 시안에서 **메인 영역 최상단** 의 라벨이고, 그 아래 (363+ y) 본문이 자리한다. Rectangle 76 (165, 1054) 는 다른 영역 (events-and-fx 의 배경 카드?) 일 가능성. **디자이너 확인 필요** (§미해결 1).

| slot | 데이터 | 산출 |
|---|---|---|
| 차트 본문 | timeseries (가격) | `stock_price_tech.close` (60/180/252 토글) |

소스: `data-loader/investmentData.ts` 의 `loadTechnicalHistory(symbol)` 로 이미 적재 중.

### 4.5 `events-and-fx`

#### 4.5.1 주요 이벤트 (좌, 165~660, 1080~)

| slot | Figma 텍스트 (행 1 mock) | 소스 |
|---|---|---|
| 카드 헤더 | `주요 이벤트` (193, 1080) | — |
| 더보기 chevron | `더보기 〉` (630, 1085) | — |
| 행 1: 일자 | `25` `APR` (218/208, 1117) | analysis events |
| 행 1: 제목 | `미국 1분기 GDP 예비치 발표` (286, 1125) | analysis events |
| 행 1: 카테고리 태그 | `거시지표` (`#4073ff` 정보색) (451, 1127) | analysis events `severity` |
| 행 1: 부제 | `예상: +2.1%/이전: +2.4%` (286, 1144) | analysis events |
| 행 1: 시각 | `금 08:30 ET` (603, 1125) | analysis events |
| 행 2/3 | (행 1 동일 mock 으로 반복 5번) | — |

이벤트 데이터 합성 (`analysis/events.ts`):
- `stock_price_tech.supertrend_signal` 전환일
- `stock_price_tech.macd × macd_signal` 교차 (골든/데드)
- `macro_regime_scores.dominant_regime` 변경일
- `stock_fundamentals.date` (분기 보고일)
- RSI 70/30 임계 돌파

> v2 의 4행에서 → **트리 기준 5행**. (날짜 텍스트 `25` 5번, 제목 텍스트 5번 출현)

#### 4.5.2 환율 (우, 758~1275, 1081~)

| 카드 헤더 | `환율` (758, 1081) | — |

카드 4개 (우측 4 칼럼). 각 카드 mock:
| 텍스트 | 위치 (1번 카드) | 폰트 / 색 |
|---|---|---|
| `USD/KRW` | (758, 1376) 추정 | Pretendard 16/600 `#003049` |
| `미국 달러 → 원화` | 그 아래 | Pretendard 13/600 `#7f7f7f` (muted) |
| `1,530.50` | 우측 정렬 | Pretendard 16/600 `#003049` |
| `4.20 (+0.31%)` | 우측 정렬 변동 | Freesentation 13/600 `#60c846` (녹) |
| sparkline (Line 21~24) | 우측 미니 차트 | stroke `#60c846` |

> 4개가 모두 `USD/KRW` 동일 mock. v2 의 "WTI / 금 / 구리 / DXY" 결정 그대로 유효 (DB 보유).

| # | 결정 매핑 | symbol | 출처 |
|---|---|---|---|
| FX-1 | WTI 원유 | `CL=F` | `commodity_prices` |
| FX-2 | 금 | `GC=F` | `commodity_prices` |
| FX-3 | 구리 | `HG=F` | `commodity_prices` |
| FX-4 | DXY (USD index) | `DX-Y.NYB` | `global_environment` |

> 시안 라벨이 `USD/KRW` 인데 DB 에 USDKRW 시계열 부재. **카드 헤더는 시안 라벨 무시하고 위 4종으로 교체** — 이는 §1 v2 회고에서 "코드가 슬쩍 갈아낀다" 사례를 본 문서가 명시적으로 결정함으로써 재발 방지.

### 4.6 `composite-trio` — Frame 17 (165, 1451, 1110×147)

> **v3.1 정정 (2026-05-07)**: 사용자 결정으로 *시점 trio* 로 확정. 시안 mock 라벨 1·3 의 중복(`오늘 종합 점수` 두 번) 을 *오늘 / 이번 달 / 올해* 시점 비교로 갱신. 카드 의미는 모두 동일 정의 (4 게이지 평균) 이고 차이는 시간 창 길이뿐 — 빈 그래프 발생 0.

| # | 카드 위치 (절대 x) | 라벨 (현행) | 시간 창 | score 산출 | delta 산출 | 매핑 |
|---|---|---|---|---|---|---|
| CT-1 | 195 | `오늘 종합 점수` | 직전 7 영업일 | series[0] (오늘 값) | `전일 대비` (어제 vs 오늘) | 4 게이지 평균 |
| CT-2 | 573 | `이번 달 종합 점수` | 직전 30 영업일 | 30일 평균 | `30일 전 대비` (시작 vs 오늘) | 4 게이지 평균 |
| CT-3 | 947 | `올해 종합 점수` | 현재 연도 YTD | YTD 평균 | `연초 대비` (YTD 시작 vs 오늘) | 4 게이지 평균 |

> 시안 색 (CT-1 녹 / CT-3 적) 은 시점 trio 에서는 *점수 절대값* 에 따라 산출 (60↑ 녹 / 30↓ 적). 도메인 고정 톤은 폐기.

> 데이터 출처:
> - 펀더 (분기별) → 시점별 carry forward
> - 기술 (일별) → 직접
> - 거시 (월별) → carry forward
> - 원자재 (일별) → 직접
> 4 게이지 일별 점수의 산술 평균 = 그 시점의 종합 점수.

> 구현: `src/analysis/series.ts` (buildDailyComposite / overallSeries / windowDelta).

### 4.7 `top3-row` (165, 1685, 1110×151)

가로 4 카드.

| # | 카드 헤더 (시안) | 위치 (절대 x) | 정렬 기준 | 우측 표기 색 | 비고 |
|---|---|---|---|---|---|
| T1 | `어제 가장 많이 오른 주식 TOP 3` | 196 | `stock_price_tech` 일간 수익률 desc | 녹 `#60c846` (수익률 %) | `8.31%` mock |
| T2 | `어제 가장 많이 거래된 주식 TOP 3` | 476 | `stock_price_tech.volume` desc | 청 `#267bea` (거래량 %?) | 정보색 |
| T3 | `어제 가장 많이 떨어진 주식 TOP 3` | 756 | 수익률 asc | 적 `#c1121f` | |
| T4 | `어제 점수가 좋았던 주식 TOP 3` | 1036 | 종합 점수 desc | 검정 `#003049` (점수) | `90 / 87 / 92` 같이 점수 mock |

각 카드 행: `1/2/3` 순위 + 종목 티커 (`NVDA` mock) + 한글 회사명 (`엔비디아` mock) + 우측 수치.

API: `/api/screen?category={priceUp|volume|priceDown|scoreTop}&limit=3` — **신규 엔드포인트**. 본 마감 전 추가.

---

## 5. 컴포넌트 분해

LAYERS.md 기준 `visualization/` (차트·지표 카드) 와 `layout/` (배치) 분리. 기존 컴포넌트와 비교.

| 컴포넌트 | 책임 | 사용 위치 (v3 클러스터) | 기존 대비 |
|---|---|---|---|
| `visualization/Donut.tsx` | 점수 0~100 도넛 + 중앙 큰 숫자 | `gauges` G1, G2 | 기존 그대로 |
| `visualization/ProgressBar.tsx` (**신규**) | 0~100 가로 progress + 우측 큰 숫자 | `gauges` G4 | 신규 — Donut 으로 대체 못 함 |
| `visualization/RegimeBadge.tsx` (**신규**) | 두 줄 라벨 (`SOFT\nLANDING` 같은 regime 명) | `gauges` G3 본문 | 신규 — 게이지가 아니라 "regime 라벨 카드". 기존 GaugeCard 를 대체 또는 GaugeCard 를 mode 분기 |
| `visualization/GaugeCard.tsx` | 게이지 카드 wrapper (헤더 + 본문 + chevron) | `gauges` G1~G4 | mode prop 추가 (`donut` / `progress` / `regime`) |
| `visualization/Sparkline.tsx` | 미니 sparkline | `events-and-fx` FX 카드 | 기존 그대로 |
| `visualization/MiniStat.tsx` | 라벨 + 값 + delta | `symbol-and-indices` 시장 지수 4슬롯, `events-and-fx` FX 카드 본문 | 기존 그대로 |
| `visualization/EventList.tsx` | 이벤트 행 (날짜 박스 + 제목·부제 + 카테고리 태그 + 시각) | `events-and-fx` 좌 | props 추가 (5행, 시각 필드) |
| `visualization/Top3Card.tsx` | 1/2/3 순위 + 티커/회사명 + 우측 수치 | `top3-row` T1~T4 | 기존 그대로 — 색만 카드별 다름 |
| `visualization/CompositeTrio.tsx` | 종합 점수 시점 비교 (라벨 + 큰 숫자 + 전일 대비) ×3 | `composite-trio` | **의미 재정의**: 기존 "3 도넛" → "3 시점 비교" |
| `visualization/SymbolHeader.tsx` (**신규**) | 회사명 + 가격 + 변동 (헤더용 텍스트 블록) | `symbol-and-indices` 좌 | 신규 — Frame 4 안의 좌측 종목 헤더 전담 |
| `visualization/IndexStripe.tsx` (**신규**) | 시장 지수 4 미니 카드 가로 정렬 | `symbol-and-indices` 우 | 신규 (또는 MiniStat × 4 로 처리 가능) |
| `visualization/FxCard.tsx` (**신규**) | 통화/원자재 1 카드 (라벨+부제+값+delta+sparkline) | `events-and-fx` 우 (FX × 4) | 신규 (MiniStat + Sparkline 합성) |
| `layout/StockDashboard.tsx` | 7 클러스터 grid 배치 | 전체 | **재구성 필요** (§7) |

| 제거 후보 | 이유 |
|---|---|
| (없음) | 기존 컴포넌트는 모두 유지·확장 |

---

## 6. CSS 토큰 추출

`figma-tree.json` 에서 enumerate 한 색·폰트 → `src/shared/styles.css` CSS 변수 매핑.

### 6.1 색상

| Figma fill (hex) | 출현 컨텍스트 | 21-aesthetics 의미 색 | CSS 변수 매핑 |
|---|---|---|---|
| `#003049` | 주요 텍스트, 카드 헤더, 종목명 | 무채 (다크 네이비) | `--color-text` (현재 `#0b1e3f` → **변경 필요**) |
| `#7f7f7f` | 부제·muted 텍스트 (`엔비디아`, `예상: +2.1%`) | 무채 muted | `--color-text-muted` (현재 `#6b7589` → 변경) |
| `#a3a3a3` | 헤더 카피 ("오늘은 어떤 종목을 분석 해볼까요?") | 무채 ultra-muted | 신규 `--color-text-faint` |
| `#373737` | 시장 지수 슬롯 텍스트 (`S&P 500`, `35.301$`) | 무채 dark | 신규 `--color-text-strong` (또는 `--color-text` 와 통합) |
| `#60c846` | 상승·긍정 (delta 녹, `GOOD`, `74.2` 등) | **긍정/상승 — 녹** | `--color-up` (현재 `#2dba6e` → **#60c846 로 변경**) |
| `#4c956c` | 종목 헤더 가격 변동 녹 (`+2.36$ (0.87%)`) | 긍정 다크 변형 | 신규 `--color-up-strong` |
| `#c1121f` | 하락·부정 (`NEGATIVE`, `EXTREME FEAR`, `65.2`) | **부정/하락 — 적** | `--color-down` (현재 `#e34d5c` → **#c1121f 로 변경**) |
| `#4073ff` | 정보 카테고리 태그 (`거시지표`) | **정보 — 청** | `--color-info` (현재 `#3b82f6` → **#4073ff 로 변경**) |
| `#267bea` | TOP3 T2 거래량 % | 정보 변형 | 신규 `--color-info-alt` |
| `#fafbfc` | `header/global` frame 배경 | 무채 ultra-light | `--color-header-bg` (신규) |
| `#ffffff` | root frame, 카드 fill | 무채 base | `--color-card`, `--color-bg` |
| `#000000` | progress bar 점수 (`23`) | 무채 black | 신규 `--color-text-black` |

> **21-aesthetics 의미 색 5색 검증**: 트리에서 발견된 색은 4 의미만 사용 (긍정·부정·정보·무채). **강조/주의 (노랑/골드)** 는 시안에 등장하지 않는다 → 시안이 강조 색을 쓰지 않았으므로 본 화면에서는 강조 색 미사용 OK. styles.css 의 `--color-accent` 는 다른 화면용으로 보존.

### 6.2 폰트

| Figma fontFamily | 출현 빈도 (대략) | 용도 | 21-aesthetics 1순위 |
|---|---|---|---|
| `Pretendard Variable` | 다수 (~60%) — 한글·영문 본문 | 본문, 라벨, 헤더 | 21-aesthetics 1순위는 `Wanted Sans`. **시안은 Pretendard 사용** → styles.css 의 1순위를 Pretendard 로 유지 (시안 충실도 우선) |
| `Freesentation` | 다수 (~30%) — 영문/숫자 (`+38.1%`, `4.20 (+0.31%)`, `GOOD/NEGATIVE`) | 숫자·등급 라벨 | 21-aesthetics 미정 — 시안 추가 사용. `--font-numeric` 신규 변수 (Freesentation, Pretendard fallback) |
| `Fugaz One` | 1 — 로고 텍스트 `Invest Lens` | 브랜드 로고만 | 로고 전용 변수 `--font-brand` |

> **결론**: 21-aesthetics 1순위 `Wanted Sans` 는 Figma 에 적용되어 있지 **않음**. styles.css 의 `font-family` 가 이미 Pretendard 1순위로 되어 있어 일치. **Wanted Sans 추가 도입 불필요** — 시안 충실도 우선.

### 6.3 타이포 사이즈

Figma 에 출현한 fontSize 와 용도 매핑:

| px | 용도 | CSS 변수 (제안) |
|---|---|---|
| 10 | 카테고리 태그 (`거시지표`) | `--font-size-xxs: 10px` |
| 13 | 부제, 시각, 변동, `세부 지표 보기` | `--font-size-sm: 13px` |
| 14 | 이벤트 제목, 카드 본문 | `--font-size-base: 14px` |
| 15 | 카드 헤더, 부제 헤더 | `--font-size-md: 15px` |
| 16 | 본문 강조, sparkline 카드 값 | `--font-size-lg: 16px` |
| 18 | 게이지 본문 라벨 (`GOOD`, `EXTREME FEAR`) | `--font-size-xl: 18px` |
| 20 | 이벤트 일자, 시장 지수 값 | `--font-size-xl-num: 20px` |
| 25 | 종목명, progress bar 값 | `--font-size-2xl: 25px` |
| 30 | 게이지 도넛 중앙 숫자 (`60`, `32`) | `--font-size-3xl: 30px` |
| 40 | 종목 가격, 종합 점수 큰 숫자 | `--font-size-4xl: 40px` |

### 6.4 코너 라운드

| 출현 cornerRadius | 컨텍스트 | CSS 변수 |
|---|---|---|
| 30 | `Frame 4` (종목 + 시장 지수 카드) | `--radius-card-lg: 30px` (신규) |
| 15 | `search bar`, `progress` group | `--radius-pill: 15px` (현재 999px → 사실은 15px 의 'pill') |
| 10 | `Rectangle 76` (차트 카드?), 일반 카드 | `--radius-card: 10px` (현재 12px → 10 로 조정) |

> **수정 권고**: `--radius-pill` 을 999px (완전 캡슐) 가 아닌 시안의 15px 로 정정. 검색 pill 의 실제 모양은 캡슐이 아닌 둥근 사각형.

---

## 7. 메인 코드 변경 계획

| 파일 | 변경 |
|---|---|
| `src/layout/StockDashboard.tsx` | **재구성**: 7 클러스터 grid. row 1 (`Frame 4` 종목+지수, h=112), row 2 (`Frame 18` 게이지 4개, h=148), row 3 (차트 단독, h≈388 — 위치 미해결), row 4 (events 좌 + fx 우 ×4 우, h≈386), row 5 (`Frame 17` composite trio, h=147), row 6 (top3 ×4, h=151). 사이드바 패턴 제거. v2 의 좌측 사이드바 stack 코드 폐기. |
| `src/visualization/Donut.tsx` | 변경 없음. |
| `src/visualization/ProgressBar.tsx` | **신규**. width 113×59 라운드 사각형, value 0~100, value 텍스트 우측, 진행률 색 = severity. |
| `src/visualization/RegimeBadge.tsx` | **신규**. 두 줄 텍스트 라벨 (예: `SOFT\nLANDING`), 색은 severity, 18px 700 Freesentation. |
| `src/visualization/GaugeCard.tsx` | **mode prop 확장**: `mode: 'donut' | 'progress' | 'regime'` 으로 G1~G4 모두 흡수. 헤더는 공통. |
| `src/visualization/CompositeTrio.tsx` | **의미 재정의**: 3 도넛 → 3 시점 비교 (라벨 + 40px 숫자 + 전일 대비). |
| `src/visualization/SymbolHeader.tsx` | **신규**. 회사명 25px + 가격·변동 40px 한 블록. |
| `src/visualization/IndexStripe.tsx` | **신규** (또는 MiniStat 그대로 ×4 인라인). 시장 지수 4슬롯 가로 정렬. |
| `src/visualization/FxCard.tsx` | **신규**. 라벨 + 부제 + 값 + delta + sparkline 합성. |
| `src/visualization/EventList.tsx` | props 보강: 5행, 카테고리 태그, 시각 표기. |
| `src/visualization/Top3Card.tsx` | 카드별 우측 수치 색 prop 추가. |
| `src/visualization/MiniStat.tsx` | 변경 없음 (필요 시 sparkline 슬롯). |
| `src/visualization/severityColor.ts` | 색 토큰 변경 반영 (#60c846 / #c1121f / #4073ff). |
| `src/shared/styles.css` | §6 의 신규 변수 추가 (`--color-text-faint`, `--color-up-strong`, `--color-info-alt`, `--font-numeric`, `--font-brand`, `--font-size-*`, `--radius-card-lg`); 기존 `--color-up`/`--color-down`/`--color-info`/`--color-text`/`--color-text-muted` 값 시안 hex 로 변경; `--color-bg` 흰색으로. |
| `src/data-loader/investmentData.ts` | 추가 fetch: (i) `commodity-impact` 산출에 필요한 종목 산업 분류 join (company_master.industry 또는 sector — 스키마 확인 필요), (ii) `/api/screen` 신규 엔드포인트 호출. 차트·이벤트·환율·게이지 데이터는 이미 적재 중. |
| `src/analysis/commodity-impact.ts` | **신규**. G2 산출. |
| `src/analysis/events.ts` | 5행 mock 충족하도록 임계 5종 모두 산출. |
| `api/screen.ts` | **신규** API. category 별 TOP 3. |
| `src/layout/Landing.tsx` | 변경 없음 (랜딩과 무관). |

---

## 8. 트리 분석으로 판단 불가능했던 항목 — 디자이너 확인 필요

| # | 항목 | 트리에서 확인된 사실 | 디자이너에게 물을 것 |
|---|---|---|---|
| 1 | 차트 카드 본체 위치 | `차트` 라벨 (193, 363) ↔ `Rectangle 76` (165, 1054) 가 **691px 떨어져 있음** | 차트 카드 본체의 실제 좌표 영역은 어디인가? (193, 363) 라벨이 떠 있는 영역의 카드 box 가 별도인가, 또는 라벨이 다른 (위쪽) row 의 헤더인가? |
| 2 | G3 (거시 경제) 본문 도넛 유무 | Group 81 (`251:4307`) 안에 도넛 group / 점수 노드 부재 — `SOFT\nLANDING` 라벨 + 세부 지표 보기 만 | G3 가 진짜로 점수·도넛 없이 라벨만인가? 또는 `251:4307` 외부에 별도 시각 요소가 있는가? |
| 3 | composite-trio 라벨 | CT-1 / CT-3 모두 `오늘 종합 점수` 동일 라벨, 점수·색만 다름 | 1·3 의 정확한 라벨 (mock 중복 가능성). 의미상 어떤 두 도메인을 비교하는가? |
| 4 | M1 이벤트 행 수 | 트리에 이벤트 mock 5행 (날짜 텍스트 5×) | 5행 고정인가, 가변인가? |
| 5 | 시장 지수 4슬롯 라벨 의도 | 4개 모두 `S&P 500` 동일 mock | 4슬롯의 실제 의도된 카테고리 (S&P / Dow / Nasdaq / Russell / VIX / DXY 중 어느 4개?) — §4.2.1 옵션 B 권고로 진행 가능 여부 |
| 6 | 환율 카드 헤더 라벨 | 4개 모두 `USD/KRW` mock | 4 카드의 실제 의도 (USD/KRW / USD/JPY / USD/EUR / USD/CNY 같은 통화 4종 인가, 또는 통화 + 원자재 혼합 인가). v3 권고: WTI / Gold / Copper / DXY (DB 기준) |
| 7 | G4 progress bar 색 | progress group `251:4111` 의 fill `#ffffff` (흰색) — 진행률 색 미정 | progress bar 의 진행률 색은 severity (적/녹) 인가, 또는 단일 색? |
| 8 | T2 (거래된 TOP) 우측 수치 색 청 (`#267bea`) 의미 | 시안에 청색 사용 — 거래량 % 인지 점수인지 모호 | 거래량 변화율인가? 절대 거래량인가? 색이 정보 톤인 이유? |
| 9 | T4 (점수 좋은 TOP) 우측 수치 검정 (`#003049`) 의미 | 점수 `90/87/92` 같은 절대값 mock | 검정 = 점수 절대값이라는 의도 맞는가? |
| 10 | 헤더 풀바와 콘텐츠 카드 사이 여백 | header (0, 0, 1440×66) → Frame 4 (165, 66) 즉시 시작 — vertical 간격 0 | gutter 가 진짜 0px 인가 또는 카드 stroke 가 자체 간격 역할인가? |
| 11 | Frame 4 의 cornerRadius 30 + 종목 헤더 + 4 지수 칸이 정말 같은 카드 | tree 상 형제 children | 단일 카드 의도 맞는가? 시각적으로 분리되어 보이는 이유는 stroke / divider? |
| 12 | "차트" 라벨이 (193, 363) 으로 카드보다 윗쪽 — Group 88 의 내부 grid 좌표가 root 좌표로 그대로 박혀 있는데 차트가 그 위 692px 어딘가 | 트리 normalize 와 caption 위치 충돌 | Figma 좌표가 정확한가? slots.generated.json 의 Group 88 box (165, 363, 1110, 1496) 자체가 union 으로 잘못 잡힌 가능성 |

---

## 부록 A. v2 와의 차이 요약

| 항목 | v2 (PNG 추측) | v3 (Figma tree) |
|---|---|---|
| 게이지 수 | 5 (G1~G5) | **4** (G1~G4) |
| G2 라벨 | (v2 에서 `거시 경제`) | **`원자재 영향`** |
| G3 라벨 | (v2 에서 `통화`) | **`거시 경제`** |
| G4 라벨 | (가려짐 추정) | **`기술적 지표`** + EXTREME FEAR + progress bar |
| G5 (공포·탐욕) | 별도 카드 | **부재** — G4 본문에 흡수 |
| 사이드바 | 좌측 28~32% stack | **부재** — 종목 헤더는 Frame 4 안 좌측 |
| 종목 헤더 위치 | 사이드바 최상단 | **Frame 4 (cornerRadius 30 카드) 안 좌측** |
| 시장 지수 4 위치 | 헤더 풀바 우측 | **Frame 4 카드 우측 (한 카드 안 동거)** |
| composite-trio 의미 | 3 도메인 평균 (펀더/기술/거시) | **시점 비교** (오늘 / 이번 달 / 오늘 다른 도메인) |
| 환율 카드 라벨 | (v2 에서 WTI/금/구리/DXY 결정) | **시안 라벨 4개 모두 `USD/KRW`** mock — 코드 매핑은 v2 그대로 |
| 배경색 | `#F4F6F8` 라이트 그레이 | **`#ffffff` 흰색 (root frame)** |
| 차트 카드 위치 | M0 사이드바 우측 위 | **헤더 라벨 (193, 363) ↔ 카드 (165, 1054) 분리** — §미해결 1 |

## 부록 B. 슬롯 ID ↔ 클러스터 빠른 인덱스

slots.generated.json 의 45 slots 중 본 문서가 클러스터에 매핑한 항목.

```
header                : headerglobal, search-bar, logo, search-icon
symbol-and-indices    : region-165-66, 주가지수, text(251:4050), text(251:4054), text(251:4058), text(251:4062)
gauges                : region-165-181 (Frame 18), region-165-181(Group 80), region-300-224, region-184-296,
                        region-445-181, region-585-223, region-469-296,
                        region-726-181, region-753-297,
                        region-1006-181, region-1034-297, progress(251:4111), progress(251:4112),
                        chevronright-regular ×4 (251:4317/4331/4338/4343)
chart                 : (slots.generated.json 추출 누락 — figma-tree 의 Rectangle 76 (251:4068), 차트 텍스트 (251:4353))
events-and-fx         : region-165-363 (Group 88, union), chevronright-regular(251:4109)
composite-trio        : region-165-1451 (Frame 17), region-195-1560, region-573-1560, region-947-1554
top3-row              : region-196-1685, region-196-1744, region-196-1803,
                        region-476-1685, region-476-1744, region-476-1803, region-469-1685,
                        region-756-1685, region-756-1744, region-756-1803,
                        region-1036-1744, region-1036-1803
```

---

문서 끝.
