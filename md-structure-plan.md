---
doc_type: governance
authority: medium
status: active
scope: workflow
owner: team
last_updated: 2026-04-13
depends_on: [main.md]
consumes: [main.md, plan.md, rules.md, setup.md, logic.md, analyse.md, ui.md, log.md]
outputs: [markdown_system_design, authoring_rules, migration_plan, validation_checklist]
---

# Markdown Structure Plan

## Purpose

이 문서는 "정밀하게 구조화된 `.md`만으로 높은 확률의 한방 바이브코딩"을 가능하게 만들기 위한 문서 체계 설계안이다. 목표는 문서를 많이 만드는 것이 아니라, 문서 간 책임과 우선순위를 고정해 모델이 임의 추측 없이 구현 결정을 내리게 만드는 것이다.


## Success Criteria

- `main.md`만 읽어도 어떤 문서를 어떤 순서로 읽어야 하는지 알 수 있어야 한다.
- 각 문서는 하나의 책임만 가져야 하며 다른 문서의 역할을 침범하지 않아야 한다.
- 같은 질문에 대해 서로 다른 문서를 읽어도 상반된 결론이 나오지 않아야 한다.
- 모델이 추측 없이 구현할 수 있도록 규칙이 판정 가능 형태로 작성되어야 한다.
- 로그 문서와 규칙 문서가 분리되어 생성 컨텍스트 오염이 발생하지 않아야 한다.

## Canonical Document Roles

### `main.md`
- 문서 진입점
- 읽기 순서 정의
- 충돌 우선순위 정의
- 현재 활성 문서 목록 정의
- 최종 산출물 범위 요약

### `plan.md`
- 제품 목표와 범위
- 사용자 시나리오
- 페이지와 기능 우선순위
- 완료 조건과 제외 범위

### `setup.md`
- 기술 스택과 버전
- 실행, 빌드, 배포 명령
- 폴더 구조와 네이밍 규칙
- 외부 서비스 사용 기준

### `rules.md`
- 절대 금지 사항
- 추측 허용 범위
- 불확실성 처리 규칙
- 구현 시 반드시 지켜야 하는 하드 제약

### `logic.md`
- 데이터 스키마
- 지표 계산식
- 상태 전이
- 예외 처리와 fallback
- 정렬/필터/집계 규칙

### `analyse.md`
- 투자 해석 규칙
- 차트 선택 기준
- 인사이트 생성 규칙
- 경고/이상징후 판정 규칙

### `ui.md`
- 디자인 토큰
- 페이지 레이아웃
- 컴포넌트 계약
- 반응형 규칙
- 로딩/빈 상태/에러 상태

### `log.md`
- 작업 히스토리 저장
- 생성 근거가 아닌 기록 목적
- 기본적으로 구현 판단의 근거로 사용하지 않음

## Recommended Reading Order

구현 모델의 권장 읽기 순서는 아래와 같다.

1. `main.md`
2. `rules.md`
3. `setup.md`
4. `plan.md`
5. `logic.md`
6. `analyse.md`
7. `ui.md`
8. `log.md`는 필요 시에만 참고

## Common Header Standard

모든 활성 문서는 아래 헤더를 사용한다.

```md
---
doc_type: main | rules | setup | plan | logic | analyse | ui | log | governance
authority: critical | high | medium | low
status: draft | active | archived
scope: project | feature | workflow | reference
owner: team
last_updated: YYYY-MM-DD
depends_on: []
consumes: []
outputs: []
---
```

### Field Semantics

- `doc_type`: 문서 종류를 고정한다.
- `authority`: 충돌 시 문서의 결정력을 나타낸다.
- `status`: 현재 활성/폐기 상태를 나타낸다.
- `scope`: 문서가 다루는 범위를 제한한다.
- `depends_on`: 선행 참조 문서를 적는다.
- `consumes`: 입력으로 읽는 문서나 데이터 소스를 적는다.
- `outputs`: 이 문서가 확정하는 결정 결과를 적는다.

## Authoring Rules

### MUST

- 규칙 문장은 판정 가능해야 한다.
- 수치, 임계값, 우선순위, fallback을 명시해야 한다.
- 문서 안에서 "좋게", "적절하게", "알아서" 같은 표현을 쓰지 않는다.
- 예시는 규칙을 보조해야 하며 규칙을 대체하면 안 된다.
- 문단형 설명보다 표, 목록, 템플릿을 우선한다.

### SHOULD

- 문서마다 `Inputs`, `Decision Rules`, `Outputs`, `Acceptance Checks` 섹션을 둔다.
- 페이지와 컴포넌트는 고유 ID나 이름으로 참조한다.
- 데이터 필드는 타입, 단위, null 처리, 예시를 함께 적는다.

### MUST NOT

- 동일 규칙을 여러 문서에서 중복 정의하지 않는다.
- 로그성 메모를 규칙 문서에 섞지 않는다.
- 서로 다른 문서에서 같은 용어를 다른 뜻으로 사용하지 않는다.

## Recommended Templates

### `plan.md`

```md
## Product Goal
## Users
## Core Scenarios
## Routes
## Features by Priority
## Out of Scope
## Acceptance Criteria
```

### `logic.md`

```md
## Entities
## Metrics
## Filters and Sorting
## State Rules
## Error and Empty States
## Fallback Rules
## Acceptance Checks
```

### `analyse.md`

```md
## Input Signals
## Interpretation Rules
## Chart Selection Matrix
## Insight Templates
## Warning Conditions
## Narrative Order
## Acceptance Checks
```

### `ui.md`

```md
## Design Tokens
## Layout Rules
## Page Contracts
## Component Contracts
## Responsive Rules
## Loading and Error States
## Acceptance Checks
```

## Decision Format Examples

좋은 규칙 예시:

```md
## metric: sharpe_ratio
inputs: [returns_series, risk_free_rate]
formula: (mean(returns_series) - risk_free_rate) / std(returns_series)
display_unit: decimal_2
fallback_if_missing: hide_card
```

```md
## chart_selection
- if data_shape == time_series and series_count == 1 -> line_chart
- if data_shape == categorical_comparison and category_count <= 12 -> bar_chart
- if data_shape == composition and category_count <= 8 -> donut_chart
- else -> sortable_table
```

```md
## page: dashboard_home
route: /
required_sections: [hero, filters, kpi_row, main_chart, holdings_table, insights_panel]
mobile_order: [hero, filters, kpi_row, main_chart, insights_panel, holdings_table]
empty_state: show_sample_guidance
```

## Anti-Patterns

- **구현 디테일이 없는 추상적 문장만 나열하는 것**
- 제약의 중복 작성 (`plan.md`와 `rules.md`에 같은 제약을 중복 작성하는 경우 등)
- `logic.md`에 디자인 서술을 섞는 것
- `ui.md`에 데이터 계산식을 넣는 것
- . . .

## Migration Plan For Current Files

### Phase 1

- `main.md`를 현재 루트 파일 기준 진입점으로 확정
- 문서 우선순위와 공통 헤더를 선언
- 새 구조화 계획 문서를 추가

### Phase 2

- `plan.md`를 제품 범위 문서로 재정렬
- `rules.md`를 협업 규칙과 금지 사항 중심으로 분리
- 빈 문서인 `setup.md`, `logic.md`, `analyse.md`, `ui.md`에 템플릿 삽입

### Phase 3

- 투자 대시보드 전용 규칙을 `logic.md`, `analyse.md`, `ui.md`에 구체화
- 실제 한방 생성 실험을 통해 누락 규칙을 보강

## Validation Checklist

- `main.md`가 활성 문서 목록과 읽기 순서를 제공하는가
- 각 문서에 공통 헤더가 존재하는가
- 충돌 시 우선순위가 명시되어 있는가
- 필수 규칙이 수치 또는 조건식으로 표현되어 있는가
- 데이터, 분석, UI 규칙이 문서별로 분리되어 있는가
- 로그 문서가 비권위 문서로 분리되어 있는가
