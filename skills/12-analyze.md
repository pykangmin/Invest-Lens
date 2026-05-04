---
version: 1.0.0
date: 2026-05-04
owner: dev
stage: 02
references:
  - 02-data-analysis.md
  - 03-insight.md
  - 00-assumptions.md
---

# 12-analyze.md — canonical → metrics + insights

> `11-ingest`가 만든 canonical record를 받아 지표를 계산하고 인사이트를 생성함. 본 스킬은 **계산식과 인사이트 본문을 정의하지 않음**. 도메인 정의는 모두 `02-data-analysis` / `03-insight`에 위임함. 본 파일은 적용 순서·입출력 명세·확장 규칙만 다룸.

---

## 책임 경계

| 한다 | 하지 않는다 |
|------|-------------|
| 지표 계산식 적용 | 계산식 정의 |
| 인사이트 If-then 적용 | 인사이트 메시지 작성 |
| `severity` 우선순위 결정 | 차트 종류 결정 |
| metric / insight 출력 형태 표준화 | UI 표시 |

---

## 입력

| 필드 | 타입 | 비고 |
|------|------|------|
| `records` | `CanonicalRecord[]` | `11-ingest` 출력. `entity_kind` 별로 그룹 가능 |
| `as_of` | date | 분석 기준일. 시계열 지표의 시점 정의 |

---

## 출력 — `AnalysisResult`

```
{
  metrics: Metric[],
  insights: Insight[]
}
```

### `Metric`

| 필드 | 타입 | 결정 출처 |
|------|------|-----------|
| `key` | string | 지표 식별자 (예: `fundamental_total`, `rsi_14`, `macro_g_score`) |
| `entity_kind` | string | 입력 그대로 |
| `value` | number \| object | 스칼라이거나 다축(예: `{G, I, R}`) |
| `as_of` | date | 시점 |
| `quality_flags` | array | 입력 record에서 승계 + 계산 단계에서 추가 |

지표 목록 / 계산식 / 단위는 `02-data-analysis.md` 의 §2·§3·§4 정의를 그대로 적용. 본 파일에 다시 적지 않음.

### `Insight`

| 필드 | 타입 | 결정 출처 |
|------|------|-----------|
| `key` | string | 인사이트 식별자 (예: `fundamental_total`, `rsi_14`, `macro_regime`) |
| `severity` | WARNING \| CAUTION \| INFO | `03-insight.md §1-1` 정의 |
| `message` | string | `03-insight` 의 If-then 본문 그대로 (포맷 보간 포함) |
| `entity_kind` | string | 입력 record의 종류 |
| `as_of` | date | 판정 시점 |

`severity` 등급·우선순위는 `03-insight §1-2` 정의(WARNING > CAUTION > INFO)를 따름.

---

## 처리 규칙

| 단계 | 입력 | 처리 | 근거 |
|------|------|------|------|
| 1. 지표 계산 (펀더멘털) | `entity_kind = fundamental_score` | 100점 합산 (현금흐름 40 / 수익성 25 / 가치평가 25 / 성장성 10) | `02-data-analysis §2` |
| 2. 지표 계산 (기술적·원자재) | `technical_indicator`, `commodity_price` | RSI / MACD / Super Trend / 변동성 | `02-data-analysis §3` |
| 3. 지표 계산 (거시) | `macro_regime` 의 원시 지표 | 36M Z-score 정규화 → G·I·R 가중 합산 → R 보정 | `02-data-analysis §4` |
| 4. 인사이트 생성 (펀더멘털) | metric 산출 후 | `03-insight §2` If-then 표 적용 | `03-insight §2` |
| 5. 인사이트 생성 (기술적) | RSI / MACD / MA / VIX | `03-insight §3` 적용 | `03-insight §3` |
| 6. 인사이트 생성 (원자재) | 변동성 등급 / 트렌드 | `03-insight §4` 적용 + 섹터 매핑 표 | `03-insight §4` |
| 7. 인사이트 생성 (거시) | 국면 확률 / 거시 이벤트 | `03-insight §5` 적용 | `03-insight §5` |
| 8. 정렬·우선순위 | 생성된 insight 집합 | `severity` 내림차순 (WARNING > CAUTION > INFO) | `03-insight §1-2` |

수익률·수익률 트랙(Internal vs Display)·기준일·단위는 `00-assumptions §2·§3·§6` 가 강제하는 값을 사용. 본 파일은 이를 다시 정의하지 않음.

---

## 우선순위 (규칙 충돌 시)

상위가 하위보다 우선.

1. 무결성 위반 (필수 metric 누락) → 해당 insight 생성 생략, `quality_flags` 에 표식
2. `severity` 우선 (`03-insight §1-2`): 같은 `key` 에 다중 룰 매칭 시 가장 높은 등급 채택
3. 같은 `key` · 같은 `severity` 다중 매칭 시 `03-insight` 내 정의 순서를 따름

---

## 새 entity / metric / insight 확장 규칙

본 스킬 파일은 다음 4가지 외부 변경에 **수정 없이** 반응해야 함.

1. 새 metric 추가: `02-data-analysis` 에 계산식·단위·`key` 정의
2. 새 insight 추가: `03-insight` 에 If-then 표 · `severity` · 메시지 정의
3. 새 entity_kind 추가: `11-ingest §확장 규칙` 절차 완료 후 본 스킬에 반영 (`metrics` / `insights` 배열에 자연 합류)
4. 새 severity 등급: `03-insight §1-1` 갱신 후 §1-2 우선순위 표 확장

본 파일은 metric/insight 의 **목록을 enumerate 하지 않음**. enum이 늘어나도 파이프라인은 동일.

---

## 검증 (verify-skills.sh 대상)

| 항목 | 실패 조건 |
|------|-----------|
| metric `key` 가 `02-data-analysis` 정의 집합 밖 | 발생 시 ❌ |
| insight `key` 가 `03-insight` 정의 집합 밖 | ❌ |
| `severity` enum 위반 | ❌ |
| 같은 `key` 에 다중 매칭인데 최고 등급이 채택되지 않음 | ❌ |
| 정렬 결과가 severity 내림차순이 아님 | ❌ |
| 02-data-analysis 의 정의된 모든 metric 이 산출 가능한 record 가 있을 때 누락 | ❌ |
