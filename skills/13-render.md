---
version: 1.0.0
date: 2026-05-04
owner: dev
stage: 03
references:
  - 21-frontend-aesthetics.md
  - 03-insight.md
---

# 13-render.md — analysis result + slot spec → 차트 spec

> `12-analyze` 가 만든 `{metrics, insights}` 와 Figma 시안에서 추출한 슬롯 스펙을 받아 차트 spec 을 결정함. 시각 속성(색·타이포·간격·모션)은 본 스킬이 정의하지 않음. `21-frontend-aesthetics` 가 단일 진실의 원천.

---

## 책임 경계

| 한다 | 하지 않는다 |
|------|-------------|
| 데이터 종류 → 차트 종류 매핑 | 색상·타이포·간격 값 결정 |
| Figma 슬롯 ↔ metric/insight 바인딩 | Figma 레이아웃 자체 설계 |
| `severity` → 색 카테고리 매핑 | 모션·전환 정의 |
| 데이터-차트 호환성 검증 | 사용자 인터랙션·상태 머신 |

상호작용(호버 / 드릴다운 / 차트 전환)은 본 스킬 범위 밖. 정적 spec 산출까지.

---

## 입력

| 필드 | 타입 | 출처 |
|------|------|------|
| `analysis` | `AnalysisResult` | `12-analyze` 출력 (`{metrics, insights}`) |
| `slots` | `SlotSpec[]` | Figma 시안에서 추출한 슬롯 정의 |

### `SlotSpec`

| 필드 | 타입 | 설명 |
|------|------|------|
| `slot_id` | string | Figma 시안 내 식별자 |
| `data_intent` | enum | `time-series` / `categorical` / `scalar` / `multi-axis-scalar` / `distribution` / `ranking` |
| `chart_hint` | string \| null | Figma가 차트 종류를 고정한 경우의 힌트 (예: `line`). null이면 §차트 매핑 규칙으로 결정 |
| `entity_kind_filter` | string[] \| null | 이 슬롯이 받을 수 있는 entity 종류 |
| `metric_keys` | string[] \| null | 이 슬롯이 받을 수 있는 metric `key` 화이트리스트 |

`SlotSpec` 의 출처와 추출 절차는 `docs/guides/INIT.md` 에 기술. 본 스킬은 입력으로만 받음.

---

## 출력 — `RenderedSlot[]`

| 필드 | 타입 | 비고 |
|------|------|------|
| `slot_id` | string | 입력 그대로 |
| `chart_type` | enum | §차트 매핑 규칙으로 결정된 종류 |
| `bound_metrics` | `Metric[]` | 슬롯에 할당된 metric (0개 이상) |
| `bound_insights` | `Insight[]` | 슬롯에 할당된 insight (0개 이상) |
| `severity_color` | enum: `RED` / `YELLOW` / `BLUE_GREEN` / `NEUTRAL` | §심각도 색 매핑 |
| `style_ref` | string | `21-frontend-aesthetics` 의 적용 섹션 anchor (예: `§색상.의미 색 체계 (5색)`) |
| `quality_flags` | array | metric 에서 승계 |

`style_ref` 는 실제 색·타이포 값이 아니라 **참조 anchor**. 렌더 시점의 값은 `21-frontend-aesthetics` 가 결정.

---

## 차트 매핑 규칙

`SlotSpec.chart_hint` 가 있으면 그것을 우선. 없을 때만 본 표를 적용.

| `data_intent` | `chart_type` | 추가 조건 |
|---------------|--------------|-----------|
| `time-series` | `line` | 단일 계열 |
| `time-series` | `multi-line` | 2~5 계열 |
| `time-series` | `area` | 누적·비중 표현이 필요한 경우 |
| `categorical` | `bar` | 카테고리 ≤ 7 |
| `categorical` | `horizontal-bar` | 카테고리 8~20 |
| `categorical` | `treemap` | 카테고리 > 20 또는 비중 표현 |
| `scalar` | `kpi-card` | 단일 값 + 보조 비교 |
| `multi-axis-scalar` | `radar` | 축 3~6 (예: G/I/R) |
| `multi-axis-scalar` | `grouped-bar` | 축 > 6 |
| `distribution` | `histogram` | 빈 도수 |
| `distribution` | `box-plot` | 사분위 + 이상치 강조 |
| `ranking` | `horizontal-bar` | 정렬 강조 시 |

매핑되지 않는 조합은 ❌ 에러. 새 `data_intent` 추가는 §확장 규칙.

---

## 슬롯 ↔ 데이터 바인딩

| 단계 | 조건 | 처리 |
|------|------|------|
| 1. `metric_keys` 화이트리스트 적용 | 명시된 경우 | 해당 key 만 후보 |
| 1a. `entity_kind_filter` 적용 | 명시된 경우 | 해당 entity 만 후보 |
| 2. `data_intent` 호환성 | metric의 `value` 형태가 intent에 맞는지 | 불일치면 후보에서 제외 |
| 3. 다중 후보 발생 | 슬롯 1개에 metric 2개 이상 매칭 | `03-insight §1-2` 우선순위 채택. 동률이면 `metric.key` 사전순 |
| 4. 후보 0개 | 위 모두 적용 후 비어있음 | 슬롯은 빈 상태로 출력 + `quality_flags: ["unbound"]` |
| 5. insight 바인딩 | `bound_metrics` 의 `entity_kind` / `key` 와 매칭되는 insight | 해당 슬롯의 `bound_insights` 로 부착 |

빈 슬롯은 에러가 아님. Figma 슬롯 수가 데이터 가용량과 다를 수 있음을 허용.

---

## 심각도 → 색 매핑

| `severity` (인사이트 최고 등급) | `severity_color` | `21-frontend-aesthetics` 참조 |
|----------------------------------|------------------|-------------------------------|
| WARNING | `RED` | §색상.의미 색 체계 (5색) — 부정/하락 빨강 계열 |
| CAUTION | `YELLOW` | §색상.의미 색 체계 (5색) — 강조/주의 노랑·골드 계열 |
| INFO | `BLUE_GREEN` | §색상.의미 색 체계 (5색) — 중립/정보 파랑 또는 긍정/상승 녹색 계열 |
| (insight 없음) | `NEUTRAL` | §색상.의미 색 체계 (5색) — 무채색 계열 |

슬롯에 다중 insight 바인딩 시 최고 등급 1개로 결정 (`03-insight §1-2`). INFO 안에서 파랑/녹색 선택 기준은 `21-frontend-aesthetics §색상.의미 색 체계 (5색)` 의 적용 대상 정의에 위임.

---

## 우선순위 (규칙 충돌 시)

상위가 하위보다 우선.

1. `chart_hint` 명시 > §차트 매핑 규칙
2. 화이트리스트(`metric_keys` / `entity_kind_filter`) > `data_intent` 호환성
3. 다중 매칭 시 `severity` 우선 > 사전순
4. `21-frontend-aesthetics` 의 금지 목록 > 그 외 모든 시각 결정

---

## 새 차트 / 슬롯 / 심각도 확장 규칙

본 스킬 파일은 다음 변경에 **수정 없이** 또는 **표 한 행 추가만**으로 대응해야 함.

1. 새 `chart_type` 추가: §차트 매핑 규칙 표에 한 행 추가. 본문 다른 부분 수정 없음
2. 새 `data_intent` 추가: 표에 새 intent + 기본 chart_type 한 행. 슬롯 spec 입력 측에서 사용
3. 새 `severity` 등급: `03-insight §1-1` 갱신 후 §심각도 색 매핑 표에 한 행 추가
4. 새 시각 속성: `21-frontend-aesthetics` 가 정의. 본 스킬은 anchor 만 갱신

본 스킬은 차트 종류와 슬롯 종류를 enumerate 함에 의존하지 않음. 표는 매핑 규칙이지 enum 정의가 아님.

---

## 검증 (verify-skills.sh 대상)

| 항목 | 실패 조건 |
|------|-----------|
| `chart_type` 이 §차트 매핑 규칙 표에 없음 | ❌ |
| `data_intent` 와 `chart_type` 이 표 행 어디에도 매칭되지 않음 | ❌ |
| `severity_color` 가 §심각도 색 매핑 enum 외 값 | ❌ |
| `style_ref` 가 `21-frontend-aesthetics` 의 실재 섹션 anchor 가 아님 | ❌ |
| `bound_metrics` 가 `metric_keys` 화이트리스트를 위반 | ❌ |
| `21-frontend-aesthetics` §금지 목록 항목이 출력에 등장 | ❌ |
