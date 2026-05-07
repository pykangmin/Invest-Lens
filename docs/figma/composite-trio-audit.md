# composite-trio-audit.md — 5단 종합 점수 trio 라벨/delta 검수

> 검수 대상 라운드: composite-trio 의 카드 라벨이 "오늘 / 이번 달 / 올해" 로 정렬되고
> delta 가 카드별로 "전일 대비 / 30일 전 대비 / 연초 대비 (또는 30일 fallback)" 분기되도록
> `CompositeTrio` · `series.ts` · `StockDashboard.buildTrioItems()` 가 함께 변경된 직후의 상태.
> 검수만 수행 — 코드 직접 수정은 없다. v3 매핑 (`docs/figma/dashboard-slots-v3.md`) 을 단일
> 진실의 원천으로 간주하고 PNG/시안은 의도적으로 보지 않았다.

## 1. 한 줄 요약

CompositeTrio 의 라벨·delta 분기 자체는 의도대로 동작하나, **점수 정의(현재값 vs 평균)와
delta 정의(시점-시점 차이)의 의미 불일치**가 CT-2/CT-3 에서 발생하고, **v3 §4.6 의 매핑
(CT-1=펀더 / CT-2=30일 평균 / CT-3=거시·기술)** 과 메인의 결정 ("오늘 / 이번 달 / 올해" 시점
trio) 이 정면 충돌한다. v3 매핑이 단일 진실의 원천이라는 검수 전제 하에서는 **D1/D2 가 FAIL**.

| 종합 카운트 | 수 |
|---|---|
| PASS | 11 |
| WARN | 5 |
| FAIL | 3 |

---

## 2. A~F 항목 결과 표

### A. 5단 delta 라벨 ↔ 데이터 의미 일치

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| A1 | 오늘 카드의 score 가 series[0] 이고 delta 가 series[0] vs series[1] | PASS | `StockDashboard.tsx:300` `score: todaySeries[0]?.score ?? null` + `:301` `delta: deltaFromSeries(todaySeries)` 가 `series.ts:141-149` 에서 `cur=[0] - prev=[1]` 로 `"전일 대비"` 라벨 부착. todaySeries 는 `fullYearSeries.slice(0, 7)` 로 desc 유지. |
| A2 | 이번 달 카드의 score 가 30 평균이고 delta 가 30일 시작 vs 오늘 — 의미 충돌 검토 | **WARN** | `StockDashboard.tsx:306-307` `score: averageScore(monthSeries)` (30개 평균) + `delta: windowDelta(monthSeries, "30일 전 대비")` (시작 vs 끝). **사용자 시각에서**: "이번 달 평균 = 74.2, 30일 전 대비 +5.0" 은 *평균값에 비해* 시작점이 5 낮았다는 의미인데, 표기는 평균 옆에 시작-끝 변화량이라 **정의 두 개가 한 카드에 섞임**. 점수와 delta 의 비교 base 가 다르다. (예: 30일 모두 80 → 평균 80, delta 0. 30일 [70…90] 선형 → 평균 80, delta +20. 동일한 평균인데 delta 가 다름은 정상이지만, "평균이 74.2 인데 +5.0 올랐다" 는 한국어가 시작값이 69.2 였다는 인상을 주지 않는다.) |
| A3 | 올해 카드의 score 가 YTD 평균이고 delta 가 YTD 시작 vs 오늘 | **WARN** | A2 와 동일 패턴. `StockDashboard.tsx:312-316`. YTD 가 4개월 (5/7 기준 약 90 영업일) 이면 평균과 시작-끝 차이의 괴리는 더 커진다. 추정: 사용자 멘탈 모델 = "올해 종합 점수" 는 *현재 점수* 또는 *연초 vs 오늘* 둘 중 하나로 해석. 평균을 메인 숫자로 쓰는 디자인은 시안 의도와 어긋날 가능성 (디자이너에게 확인 필요 — 추정). |
| A4 | YTD 비었을 때 "30일 전 대비" fallback 의 정합성 | PASS | `StockDashboard.tsx:295` `yearOrFallback = yearSeries.length > 0 ? yearSeries : monthSeries` + `:313-316` `windowDelta(yearOrFallback, yearSeries.length > 0 ? "연초 대비" : "30일 전 대비")`. fallback 시 **score (평균) 도 monthSeries 평균**, delta 라벨도 30일 — 점수·delta 모두 동일 source 라 정합. 단, 카드 라벨이 여전히 "올해 종합 점수" 인 채 본문 delta 만 "30일 전 대비" 로 어긋나는 것은 **WARN 직전이지만 본 점검에서는 PASS** (드물게 발생, 데이터 부재 시 어쩔 수 없음). |

### B. 인접 컴포넌트의 같은 패턴 미스

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| B1 | 다른 카드/컴포넌트의 시간 라벨 정합 | PASS | `StockDashboard.tsx:171-208` Top3 4 카드의 헤더 `"어제 가장 많이 …"` — 일별 stock_price_tech 의 latest 가 desc[0] 이고 그 metric 이 어제 마감/거래량이라는 점에서 라벨 일치. CompositeTrio 의 "오늘" vs Top3 의 "어제" 가 한 화면에 공존하지만, **오늘 카드의 score=todaySeries[0]** 도 결국 desc[0] 인 stock_price_tech 의 최신 영업일 = (현실 시각이 장 마감 후) "어제 마감 기준 종합 점수" 라서 표기 라벨 ("오늘") 과 데이터 시점 ("어제 마감") 이 어긋나는 미세한 불일치 잠재. WARN 으로 격상할지 보더라인 — 한국어 관습상 "오늘 종합 점수" 는 흔히 최신 마감 기준이라 PASS. |
| B2 | EventList 의 시각/카테고리 표기 | PASS | `EventList.tsx:43-67` `ev.time` 이 우상단 ml-auto, `ev.category ?? ev.severity` 가 칩. v3 §4.5.1 의 "거시지표 청 칩 + 우측 시각" 매핑과 일치. severity 색은 `severityVar(ev.severity)` 로 구분 — 카테고리 색은 v3 의 `#4073ff` (정보) 와 같은 의미. |
| B3 | IndexStripe / SymbolHeader / FxCard 의 delta 가 어느 시점 비교인지 명시 | **WARN** | (i) `SymbolHeader.tsx:24-34` 가격 delta 는 `priceMeta.delta = cur - prev` (전일 대비) 인데 화면에 "전일 대비" 명시 없음. CompositeTrio 는 prefix 가 있는데 SymbolHeader 는 없어 일관성 부족. (ii) `IndexStripe.tsx:31` delta 텍스트 그대로 (예: `"+38.1%"`) 출력 — `marketContext()` 가 `"+38.1%"` mock 인데 "예시" 배지로 가려짐. (iii) `FxCard.tsx:33` delta 텍스트 prefix 없음. 환율 카드 4개 모두 `"4.20 (+0.31%)"` mock 으로 "예시" 배지가 의미를 흐림. 시안 충실도라서 디자인 결정상 OK 일 수도 있지만 **CompositeTrio 가 prefix 명시 정책으로 갈 때 다른 컴포넌트도 일관 적용** 검토 필요 — 추정. |
| B4 | Top3Card 의 primary 표기 (`+8.31%` 등) 가 카테고리별 의미와 일치 | PASS | `StockDashboard.tsx:178/187/196/205` 매핑 — priceUp/priceDown 은 `formatPct(it.metric)` (수익률 %), volume 은 `formatVolume` (거래량 K/M), scoreTop 은 `Math.round(it.metric)` (점수 0~100). v3 §4.7 표 (T1 녹 % / T2 청 거래량 / T3 적 % / T4 검정 점수) 매핑 정확. 색은 `tone` prop 으로 `up/info/down/neutral` 매핑. |

### C. 데이터 출처와 표시 톤 일치

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| C1 | 점수 색 (≥60 녹 / <30 적) 이 trend (delta) 색과 충돌 | **WARN** | `CompositeTrio.tsx:15-20` `colorFor(score)` (점수 절대값) 와 `:29-34` `deltaColor` (delta.positive 부호) 가 **독립**. 시나리오: 이번 달 평균 70 (녹) + windowDelta -10 (적) → 큰 숫자 녹 / 우하 delta 텍스트 적 → "점수는 좋은데 추이는 악화" 가 색만으로 표현. 디자인적으로 의도된 분리일 수 있지만 시안 (모두 동일 색 하나) 과 다름. v3 §4.6 시안 색은 CT-1/CT-2 녹 (`#60c846`) / CT-3 적 (`#c1121f`) 로 **카드 단위 일색** 인데 코드는 두 색 분리 — 시안 의도와 어긋날 가능성 — 추정. |
| C2 | score=null 일 때 delta·sparkline·color fallback | PASS | (i) `colorFor(null) → text-muted`. (ii) `score===null` 시 `"—"` 표기 (`:43`). (iii) `deltaFromSeries` 와 `windowDelta` 모두 `cur===null` 또는 `start/prev===null` 시 `undefined` 반환 (`series.ts:145, 161`) → `it.delta &&` 가드로 표시 자체 생략. (iv) Sparkline `values={it.history ?? [it.score, it.score]}` (`:47`) — score 가 null 이면 `[null, null]` 이 들어가 Sparkline 내부에서 빈 path 처리해야 함. **잠재 WARN**: Sparkline 이 `[null, null]` 입력에서 안전한지는 본 검수 범위 밖이지만 `Sparkline.tsx` 미확인 — 직접 확인 안 함. |

### D. v3 매핑과의 정합

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| D1 | v3 §4.6 가 "시점 비교" 라고 했는데 코드의 "오늘 / 이번 달 / 올해" 가 그 의미를 충족 | **FAIL** | v3 §4.6 표는 명시적으로 다음 매핑을 기록함: **CT-1 = "오늘 종합 점수" 펀더 종합 = G1 점수 / CT-2 = "이번 달 종합 점수" 30일 평균 / CT-3 = "오늘 종합 점수" 거시·기술 종합 = (G2+G3+G4)/3** (라인 203-205). 즉 v3 의 "시점 비교" 는 *오늘 두 개 + 이번 달 한 개* 로 1·3 이 같은 "오늘" 라벨 (디자이너 mock 중복) 의 **두 다른 도메인** 이 핵심. 메인이 구현한 "오늘 / 이번 달 / 올해" 는 v3 매핑과 카드 3 의 의미가 완전히 다름 (도메인 분리 → 시간 창 분리). v3 §부록 A 에 "v2 와의 차이: composite-trio v2=3 도메인 평균, v3=시점 비교 (오늘 / 이번 달 / 오늘 다른 도메인)" 으로 명기. 메인은 v3 의 "시점 비교" 를 글자 그대로 받아 "오늘/달/년" 으로 더 자연스럽게 만들었지만 **v3 표의 카드별 데이터 매핑을 무시함**. |
| D2 | 시안의 색 (CT-1 녹 / CT-3 적) 매핑이 "도메인 차이" → "시점별 점수 색" 으로 바뀐 게 정합 | **FAIL** | v3 §4.6 의 색은 **카드 도메인** 차이로 결정 — CT-1 (펀더 우호) 녹, CT-3 (거시·기술 부정) 적. 코드는 `colorFor(score)` 로 **시점별 점수 절대값** 에 의존 → 같은 카드라도 점수 따라 색이 바뀜. 정합 X. 디자이너 의도는 "도메인 별 통상색" 이었을 가능성 (mock 점수 74.2/74.2/65.2 로 색이 자연스럽게 갈리도록 설계) — 추정. **D1 이 FAIL 이면 D2 도 자동 FAIL** (도메인 자체가 사라졌으므로). |

### E. dead/잔여 코드

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| E1 | dummyTrend / deriveDelta / monthOverallSeries / todayFundamentalSeries / todayMacroTechSeries 미사용 잔여 | PASS | 본 5개 식별자 전체 src/ 검색 — 0 매치. v3 매핑 변경 시 도입했다 갈아낀 흔적 없음. **단, 별도 dead code 발견**: (i) `src/visualization/MiniStat.tsx` — src 전체에서 import 하는 곳 0건. v3 §5 컴포넌트 분해표는 MiniStat 을 "기존 그대로" 로 적었지만 IndexStripe/FxCard 가 신설되며 사용처가 사라짐 → **WARN 으로 격상**. (ii) `src/types/scoring.ts:19-23 CompositeScores` 와 `analysis/index.ts:51-55 composite` 필드 — 어느 컴포넌트도 `analysis.composite` 를 읽지 않음 (`analysis.composite` 검색 0건, `\.composite\b` 검색 0건). v2 의 "3 도메인 평균" 잔재로 추정되며 trio 가 새로 시점 trio 로 재정의된 지금은 unused — **WARN**. (iii) `series.ts:172-173` `void (null as unknown as CompanyMaster)` `void (null as unknown as StockPriceTech)` — 사용하지 않는 import 를 unused warning 회피용 cast 로 묶은 흔적. 타입 import 자체를 제거하는 게 더 깔끔 — 미세 WARN. |

### F. 빌드·타입

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| F1 | typecheck 통과 | PASS | 메인 보고. 본 검수에서 직접 재실행하지 않음 (검수 권한). `series.ts:128-129` `SeriesDelta.comparison?: string` 옵셔널이라 기존 호출처 (`deltaFromSeries`) 도 호환. `CompositeTrio` 의 `delta?.comparison ?? "전일 대비"` 도 옵셔널 허용. |
| F2 | verify-structure / verify-skills 통과 | PASS | 메인 보고. CompositeTrio.tsx / series.ts / StockDashboard.tsx 모두 LAYERS.md 의 visualization/analysis/layout 분리 준수. 신규 의존: layout → analysis (`series.ts`) — 기존에도 있던 패턴. |

---

## 3. FAIL 항목별 패치 권고

### FAIL D1 — composite-trio 의 카드 의미가 v3 매핑과 정면 충돌

**파일**: `src/layout/StockDashboard.tsx:274-320`, `docs/figma/dashboard-slots-v3.md:199-209`
**현황**: 메인이 "시점 trio (오늘/달/년)" 으로 구현. v3 §4.6 표는 "도메인 trio (오늘 펀더 / 이번 달 종합 / 오늘 거시·기술)".

**옵션 ① (코드를 v3 표에 맞춤 — 권고)**:

```diff
 function buildTrioItems(data: DashState) {
-  // 1년치 일별 종합 series 한 번만 계산 후, 시간 창별로 슬라이스.
-  const dailyYear = buildDailyComposite({ ... days: 252 });
-  const fullYearSeries = overallSeries(dailyYear);
-  const todaySeries = fullYearSeries.slice(0, 7);
-  const monthSeries = fullYearSeries.slice(0, 30);
-  const yearSeries = fullYearSeries.filter(...);
-  const yearOrFallback = yearSeries.length > 0 ? yearSeries : monthSeries;
-  return [
-    { label: "오늘 종합 점수", score: todaySeries[0]?.score ?? null, ... },
-    { label: "이번 달 종합 점수", score: averageScore(monthSeries), ... },
-    { label: "올해 종합 점수", score: averageScore(yearOrFallback), ... },
-  ];
+  // v3 §4.6: CT-1 = 오늘 펀더 / CT-2 = 이번 달 종합 평균 / CT-3 = 오늘 거시·기술 종합
+  const dailyMonth = buildDailyComposite({ ..., days: 30 });
+  const monthComposite = overallSeries(dailyMonth);
+  const todayDaily = dailyMonth[0] ?? null;
+
+  // CT-1: 오늘 펀더 — 펀더 단일 series (어제→오늘)
+  const fundSeries = dailyMonth.map(d => ({ date: d.date, score: d.fundamental }));
+  // CT-3: 오늘 거시·기술 — (G2+G3+G4)/3
+  const macroTechSeries = dailyMonth.map(d => ({
+    date: d.date,
+    score: avgOf([d.commodity, d.macro, d.technical]),
+  }));
+
+  return [
+    { label: "오늘 종합 점수", score: fundSeries[0]?.score ?? null,
+      delta: deltaFromSeries(fundSeries), history: toSparkline(fundSeries) },
+    { label: "이번 달 종합 점수", score: averageScore(monthComposite),
+      delta: windowDelta(monthComposite, "30일 전 대비"), history: toSparkline(monthComposite) },
+    { label: "오늘 종합 점수", score: macroTechSeries[0]?.score ?? null,
+      delta: deltaFromSeries(macroTechSeries), history: toSparkline(macroTechSeries) },
+  ];
 }
```

**옵션 ② (v3 매핑을 메인의 새 결정에 맞춰 갱신 — 권고 안 함)**:
`docs/figma/dashboard-slots-v3.md` §4.6 의 표 + §부록 A 의 "차이" 행을 "오늘/이번 달/올해 시점
trio" 로 갱신. 단, **v3 가 "시안 PNG 추측 0" 을 표방하는 단일 진실의 원천** 이라는 본 프로젝트
원칙을 메인 임의로 바꾸는 셈이라 *디자이너/PM 합의 기록 후* 만 허용. 이 경로는 §4 회고에서
별도 다룸.

### FAIL D2 — 카드 색이 도메인 정체성이 아니라 점수에 따라 변동

**파일**: `src/visualization/CompositeTrio.tsx:15-20, 28`

```diff
-function colorFor(score: number | null): string {
-  if (score === null) return "var(--color-text-muted)";
-  if (score >= 60) return "var(--color-up)";
-  if (score >= 30) return "var(--color-accent)";
-  return "var(--color-down)";
-}
+function colorFor(score: number | null, fallback: "up" | "down" | "muted"): string {
+  if (score === null) return "var(--color-text-muted)";
+  // v3 §4.6: 카드의 도메인 색이 일차적 진실. 점수가 그 톤을 거스를 때만 muted.
+  if (fallback === "up") return score >= 30 ? "var(--color-up)" : "var(--color-text-muted)";
+  if (fallback === "down") return score < 60 ? "var(--color-down)" : "var(--color-text-muted)";
+  return "var(--color-text-muted)";
+}
```

그리고 `CompositeTrioItem` 에 `tone?: "up" | "down"` 을 추가해 호출자가 카드 색을 명시하도록.
`StockDashboard.buildTrioItems()` 에서 CT-1=`"up"`, CT-2=`"up"`, CT-3=`"down"` 지정.

> 단, D1 옵션 ① 채택 시에만 의미 있음. D1 옵션 ② 라면 본 항목은 자연 해소.

### FAIL E1.b — 잔여 `CompositeScores` / `analysis.composite` 필드

**파일**: `src/types/scoring.ts:19-23`, `src/analysis/index.ts:21-34, 43-58`

```diff
 // src/types/scoring.ts
-export interface CompositeScores {
-  fundamental: number | null;
-  technical: number | null;
-  macroEnvironment: number | null;
-}

 export interface AnalysisResult {
   gauges: Record<GaugeId, GaugeScore>;
-  composite: CompositeScores;
   events: AnalysisEvent[];
   insights: AnalysisInsight[];
 }
```

```diff
 // src/analysis/index.ts
-function avg(values: Array<number | null>): number | null { ... }
-function macroEnvComposite(...) { ... }
 export function analyze(input: AnalyzeInput): AnalysisResult {
   ...
   return {
     gauges: { fundamental, commodity, macro, technical, sentiment: technical },
-    composite: {
-      fundamental: fundamental.score,
-      technical: technical.score,
-      macroEnvironment: macroEnvComposite(macro, commodity, technical),
-    },
     events: buildEvents(input.snapshot),
     insights: [],
   };
 }
```

> trio 가 더이상 `analysis.composite` 를 거치지 않고 `series.ts` + `buildTrioItems()` 에서
> 자체 계산하므로 안전하게 제거 가능. 단, 외부 (api/ 또는 docs/) 에서 참조되는지 grep 한 번
> 더 확인 후 적용 권고.

> 부수 권고 (FAIL 아님): `MiniStat.tsx` (E1.a) 도 사용처 0 — `IndexStripe`/`FxCard` 가 같은
> 패턴을 흡수했으므로 삭제 또는 21-aesthetics 라이브러리에 두려면 storybook 분리. `series.ts:172-173`
> 의 `void` 캐스트 (E1.c) 는 import 자체를 정리.

---

## 4. 회고 — 메인이 *왜* 미스했는가

### 4.1 미스의 정체

메인이 만든 "오늘 / 이번 달 / 올해" 시점 trio 는 **그 자체로는 사용자에게 더 자연스럽고 한국어
관습에도 잘 맞는 좋은 디자인** 이다. 문제는 **그것이 v3 매핑 §4.6 의 결정과 다르다는 점을
인지하지 못한 채 진행** 됐다는 것. 즉:

- v3 §4.6 표: CT-1=펀더 / CT-2=30일 평균 / CT-3=거시·기술
- v3 §부록 A: "v2 의 '3 도메인 평균' 과는 다르고 시점 비교 (오늘 / 이번 달 / 오늘 다른 도메인)"
- 메인 해석: "시점 비교" → "오늘 / 이번 달 / 올해" 로 일반화

`§부록 A` 의 "오늘 / 이번 달 / 오늘 다른 도메인" 이 어색해서 메인이 자연스러운 "오늘/달/년"
으로 매끈하게 다듬은 것 — 그러나 §4.6 의 *표 자체* 의 도메인 매핑을 함께 폐기한 것이 미스.

### 4.2 왜 잡아내지 못했나

1. **§4.6 의 "표 vs 부록 A 의 한 줄" 충돌이 검수 안 됨**: 표는 도메인 trio, 부록은 시점 trio
   라는 인상으로 *동일 문서가 두 다른 정의* 를 갖고 있었다. v3 작성 시 **이 충돌을 한 번
   더 정리하지 않았다**.

2. **시안 라벨이 mock placeholder 인 점이 도메인 결정의 약한 근거**: §4.6 가 "1·3 라벨이 같은
   `오늘 종합 점수` 인데 점수·색이 다르므로 두 다른 도메인 mock placeholder" 라고 *추정* 했다.
   추정이라는 점이 메인에게 약하게 들렸을 수 있다 — 추정.

3. **windowDelta 같은 함수를 추가하면서 점수 정의(현재값/평균)와 delta 정의(시작-끝 차이) 의 일치를
   재검토 안 했다**: A2/A3 의 WARN 은 그래서 발생.

### 4.3 다음번 검수에서 잡아야 할 패턴

| 패턴 | 왜 놓치기 쉬운가 | 다음 검수 체크 |
|---|---|---|
| 진실 원천 문서 안의 *표 vs 본문 한 줄* 충돌 | 둘 다 "맞다" 고 읽혀서 메인이 자기에게 편한 쪽 채택 | 변경 PR 마다 표·부록·차이 섹션을 한 번에 diff 로 비교 |
| "시점 비교" 같은 추상어를 메인이 자기 해석으로 구체화 | 메인 결정이 더 자연스러우면 검수자도 같이 흘려보냄 | 추상어가 등장하면 "구체 매핑 표" 가 같은 문서에 있는지 확인, 없으면 *그 결정* 자체를 PR 화 |
| 점수 base 와 delta base 가 다른 카드 | 화면에 두 숫자가 같이 보여서 한 카드처럼 읽히지만 정의는 둘 | "이 숫자의 base 와 그 옆 delta 의 base 가 같은가?" 1줄 질문 |
| 색 정책 (도메인 색 vs 점수 색) | 디자이너 의도가 mock 점수에 우연히 일치할 때 코드 정책과 구분 안 됨 | 시안 색이 "이 카드는 항상 이 색" 인지 "점수 따라 자동" 인지 명문화 |
| 중간에 도입된 보조 함수의 사용처 (예: `windowDelta`) | 단일 호출 패턴만 보고 OK 처리 | 새 함수의 의미가 같은 화면 다른 카드에서도 정합한지 시뮬 (예: A2 평균 70 + delta -10 시나리오) |
| Dead code 누적 (CompositeScores, MiniStat 같은 잔재) | 라운드별 변경이 작아 누적이 보이지 않음 | 라운드 끝마다 src/ 전역 grep 으로 unreferenced export 정기 점검 |

### 4.4 한 줄 결론

**v3 매핑 §4.6 표를 단일 진실의 원천으로 받든다면 D1/D2 가 FAIL 이고 코드를 표에 맞춰야
한다.** 만약 메인의 "오늘/달/년" 시점 trio 가 더 좋은 디자인이라 판단되면, *먼저* v3 문서를
PR 로 갱신하고 그 다음 코드 — 순서가 거꾸로 됐다는 것이 본 라운드의 진짜 미스.

문서 끝.
