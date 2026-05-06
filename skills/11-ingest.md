---
version: 1.0.0
date: 2026-05-04
owner: dev
stage: 01
references:
  - 01-data-profile.md
  - 00-assumptions.md
---

# 11-ingest.md — DB raw → canonical 변환

> DB에서 받은 원시 레코드를 canonical form으로 변환함. 컬럼 정규화, 결측·이상치 처리, 메타 필드 부착까지. 지표 계산은 `12-analyze`, 차트 결정은 `13-render`에서 처리함. 본 스킬은 변환 단일 책임.

---

## 책임 경계

| 한다 | 하지 않는다 |
|------|-------------|
| 컬럼명 정규화 / 타입 캐스팅 | 지표 계산 |
| 결측·이상치 처리 적용 | 인사이트 생성 |
| `asset_class` 메타 부착 | 차트 선택 |
| 무결성 검증 | UI 렌더링 |

---

## 입력

| 필드 | 타입 | 비고 |
|------|------|------|
| `source` | DB connection handle | 접속은 `docs/guides/INIT.md` 참조 |
| `entity_kind` | enum | 현행 4종. 새 종류 추가는 §확장 규칙 |
| `as_of` | date \| null | null이면 최신 |

현행 `entity_kind`: `fundamental_score`, `technical_indicator`, `macro_regime`, `commodity_price`.

---

## 출력 — `CanonicalRecord`

| 필드 | 타입 | 값 결정 출처 |
|------|------|--------------|
| `entity_kind` | string | 입력 그대로 |
| `asset_class` | EQUITY \| COMMODITY \| MACRO | §asset_class 매핑 |
| `as_of` | date | 정규화 후 |
| `keys` | object | 엔티티별 식별자 (ticker / commodity_code / regime 등) |
| `fields` | object | 스키마는 `01-data-profile §1. 주요 엔티티 스키마` 정의 그대로 |
| `quality_flags` | array | `forward_filled` / `capped` / `outlier_warned` / `prob_normalized` 등 |

`fields` 자체의 키 집합·타입은 본 파일에서 다시 적지 않음. `01-data-profile §1`이 단일 진실의 원천.

---

## 처리 규칙

| 단계 | 조건 | 처리 | 근거 |
|------|------|------|------|
| 1. 컬럼명 매핑 | 대소문자·공백·언더스코어 차이 | 정규화 후 스키마 키와 매칭 | `01-data-profile §1` |
| 1a. 매칭 실패 (필수 키) | — | ❌ throw | `01-data-profile §2` |
| 1b. 매칭 실패 (선택 키) | — | drop, 진행 | — |
| 2. 날짜 캐스팅 | 모든 날짜 컬럼 | YYYY-MM-DD 또는 ISO 8601로 통일 | `00-assumptions §3. 기준일` |
| 3. 결측 처리 | NaN / NULL | 표 그대로 적용 (FF / NaN 유지 / 계산 생략) | `00-assumptions §4. 결측치 처리` |
| 4. 이상치 처리 | 음수 가격 / 음수 거래량 / 수익률 임계 / Z-score | `asset_class` 분기 표 그대로 | `00-assumptions §5. 이상치 처리` |
| 5. 점수 클램핑 | 총점 < 0 또는 > max | 0 / max 고정 | `01-data-profile §2` |
| 6. 확률 정규화 | 거시 국면 확률 합 ≠ 100 | 합=100으로 비례 보정 | `01-data-profile §2` |

각 단계 결과는 `quality_flags`에 표식으로 누적. 표식 없는 변환은 허용하지 않음.

---

## `asset_class` 매핑

| `entity_kind` | `asset_class` |
|---------------|---------------|
| `fundamental_score` | EQUITY |
| `technical_indicator` | EQUITY |
| `commodity_price` | COMMODITY |
| `macro_regime` | MACRO |

이 매핑은 §처리 규칙 4번(이상치 분기)의 분기 키로 쓰임.

---

## 우선순위 (규칙 충돌 시)

상위가 하위보다 우선. 예: 음수 거래량은 forward fill 대상에서 제외되고 drop이 적용됨.

1. 무결성 위반 (필수 키 누락 / 타입 캐스팅 실패) → throw, 중단
2. 이상치 처리 (`00-assumptions §5`) → drop 또는 ⚠️ 유지
3. 결측 처리 (`00-assumptions §4`) → forward fill / NaN
4. 점수·확률 보정 (`01-data-profile §2`)

---

## 새 엔티티 확장 규칙

새 `entity_kind` 추가 시 다음 4가지를 외부에서 정의해야 함. 본 스킬 파일은 수정하지 않음.

1. `01-data-profile §1` 에 엔티티 스키마 추가 (필수 키 / 선택 키 / 타입)
2. `asset_class` 매핑 추가. 새 asset_class가 필요하면 enum 확장
3. `00-assumptions §4·§5` 가 새 케이스를 커버하지 않으면 해당 표 확장
4. `01-data-profile §2` 에 새 엔티티의 무결성 규칙 추가

위 4개가 갖춰지면 본 스킬은 동일 파이프라인을 그대로 적용함. 즉 4개 엔티티는 **예시이고 하드코딩이 아님**.

---

## 검증 (verify-skills.sh 대상)

| 항목 | 실패 조건 |
|------|-----------|
| 필수 키 누락 | 입력에 스키마 필수 키가 없는데 throw 안 함 |
| 타입 캐스팅 실패 | 타입 불일치인데 통과 |
| `asset_class` enum 위반 | 매핑 결과가 enum 밖 |
| 점수·확률 범위 위반 | 보정 후에도 범위 밖 |
| `quality_flags` 누락 | 처리 적용했는데 표식 없음 |
