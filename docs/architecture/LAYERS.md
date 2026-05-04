# LAYERS.md

## 개요

이 문서는 `src/` 디렉토리의 레이어 구조와 의존성 방향을 정의하는 단일 진실의 원천이다. 에이전트는 코드를 작성하기 전에 이 문서를 참조하여 어떤 레이어에서 어떤 레이어를 import할 수 있는지 확인해야 한다. `verify-structure.sh`는 이 문서의 의존성 매트릭스를 기준으로 실제 코드의 import 관계를 검사한다.

레이어 의존성 규칙은 순방향 단일 방향으로만 흐른다. 이 제약은 에이전트가 기존 패턴을 복제할 때 잘못된 의존성이 확산되는 것을 막기 위한 구조적 장치다.

---

## 레이어 목록

시스템은 여섯 개의 레이어와 하나의 유틸리티 디렉토리로 구성된다.

### 1. types/

시스템 전체에서 사용하는 기본 타입을 정의한다. 숫자, 날짜, 통화, 비율 등 원자적 타입이 여기에 속한다. 외부 라이브러리 타입 외에는 어떤 내부 모듈에도 의존하지 않는다. 모든 상위 레이어가 이 레이어를 import할 수 있다.

### 2. schema/

투자 데이터의 구조를 정의한다. 종목 정보, 포트폴리오 구성, 재무 지표 등 도메인 데이터의 형태(shape)를 기술한다. `types/`만 import할 수 있다.

### 3. data-loader/

외부 데이터를 수집하고 파싱하는 코드를 담는다. CSV 파일 읽기, JSON 파싱, API 호출, 데이터 정규화 등이 여기에 속한다. `11-ingest.md`의 변환 파이프라인이 이 레이어로 구현되며, `01-data-profile.md`의 엔티티 스키마와 `00-assumptions.md`의 결측·이상치 규칙을 따른다. `types/`와 `schema/`를 import할 수 있다.

### 4. analysis/

지표 계산과 분석 로직을 담는다. 수익률 계산, 변동성 분석, 상관관계 계산, 롤링 통계 등이 여기에 속한다. `12-analyze.md`의 처리 파이프라인이 이 레이어로 구현되며, 계산식은 `02-data-analysis.md`, 인사이트 If-then 은 `03-insight.md` 정의를 따른다. `types/`, `schema/`, `data-loader/`를 import할 수 있다. 시각화나 레이아웃 레이어는 import할 수 없다.

### 5. visualization/

차트와 그래프를 렌더링하는 코드를 담는다. `analysis/`의 계산 결과를 시각적 요소로 변환한다. `13-render.md`의 차트 매핑 표(데이터 종류 → 차트 종류)와 심각도 색 매핑이 이 레이어로 구현된다. 색·타이포·간격 같은 시각 속성은 `21-frontend-aesthetics.md` 정의를 따른다. 앞선 네 레이어를 모두 import할 수 있다. `layout/`은 import할 수 없다.

### 6. layout/

대시보드의 최종 UI를 구성한다. `visualization/`의 차트 컴포넌트들을 배치하고, 사용자 인터랙션을 처리하고, 페이지 단위의 상태를 관리한다. 레이아웃 자체는 Figma 시안이 고정하며, 슬롯 ↔ 차트 바인딩 규칙은 `13-render.md`가 정의한다. 모든 앞선 레이어를 import할 수 있다.

### shared/ (레이어 아님)

레이어가 아닌 유틸리티 모음 디렉토리다. 여러 레이어에서 공통으로 쓰는 작은 도구(에러 바운더리, 공통 상수, 타입 가드 등)를 필요할 때 파일 단위로 추가한다. 모든 레이어가 `shared/`를 import할 수 있지만, `shared/`는 다른 레이어를 import하지 않는다. 비즈니스 로직은 절대 들어가지 않는다 — 자세한 규정은 아래 "shared/ 특별 규정" 섹션을 참조.

---

## 의존성 규칙

### 원칙

레이어 간 의존성은 오직 순방향으로만 흐른다. 레이어 번호가 낮은 쪽이 먼저 오고, 높은 쪽은 뒤에 온다. 뒤에 오는 레이어는 앞의 레이어를 import할 수 있지만, 그 반대는 금지된다.

```
types → schema → data-loader → analysis → visualization → layout
                                                                ↑
                                          shared ←── 모든 레이어가 import 가능
```

역방향 import는 그 자체로 빌드 실패의 원인이다. 예를 들어 `analysis/`가 `visualization/`을 import하는 순간 계층이 붕괴하고, 에이전트가 이 패턴을 복제하기 시작하면 레포 전체의 구조가 빠르게 망가진다.

### 의존성 매트릭스 (사람 판독용)

각 레이어가 import할 수 있는 대상을 표로 정리한다. ○는 허용, ✕는 금지.

| From ↓ / To → | types | schema | data-loader | analysis | visualization | layout | shared |
|---|---|---|---|---|---|---|---|
| types | — | ✕ | ✕ | ✕ | ✕ | ✕ | ○ |
| schema | ○ | — | ✕ | ✕ | ✕ | ✕ | ○ |
| data-loader | ○ | ○ | — | ✕ | ✕ | ✕ | ○ |
| analysis | ○ | ○ | ○ | — | ✕ | ✕ | ○ |
| visualization | ○ | ○ | ○ | ○ | — | ✕ | ○ |
| layout | ○ | ○ | ○ | ○ | ○ | — | ○ |
| shared | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | — |

표 읽는 법: From(왼쪽 열)이 To(위쪽 행)를 import할 수 있는지를 본다. 예를 들어 `analysis` 행의 `schema` 열은 ○이므로, `analysis/`에서 `schema/`를 import할 수 있다. 반대로 `schema` 행의 `analysis` 열은 ✕이므로, `schema/`에서 `analysis/`를 import하면 규칙 위반이다.

### 의존성 매트릭스 (기계 판독용)

`verify-structure.sh`가 파싱하는 블록이다. 위 표의 내용을 그대로 반영한다. **두 매트릭스는 항상 일치해야 하며, 한쪽을 수정할 때 다른 쪽도 반드시 함께 수정한다.**

```yaml
# verify-structure.sh가 이 블록을 파싱한다. 수정 시 위 표와 일치하도록 유지.
layers:
  - name: types
    can_import: [shared]
  - name: schema
    can_import: [types, shared]
  - name: data-loader
    can_import: [types, schema, shared]
  - name: analysis
    can_import: [types, schema, data-loader, shared]
  - name: visualization
    can_import: [types, schema, data-loader, analysis, shared]
  - name: layout
    can_import: [types, schema, data-loader, analysis, visualization, shared]
  - name: shared
    can_import: []
```

`can_import` 배열에 없는 레이어를 import하면 위반이다. 외부 라이브러리(React, ECharts, lodash 등)는 이 매트릭스의 제약을 받지 않는다.

---

## shared/ 특별 규정

`shared/`는 레이어가 아니다. 레이어 의존성 매트릭스에서 열과 행에 등장하긴 하지만, 이는 "누구나 import할 수 있는 공용 유틸리티"임을 명시하기 위한 것이지, `shared/`가 여섯 레이어와 같은 위상의 층이라는 뜻은 아니다.

### shared/에 들어갈 수 있는 것

- React 에러 바운더리 컴포넌트
- 공통 타입 가드 함수 (`isDefined`, `isNonEmptyArray` 등)
- 앱 전역에서 쓰는 상수 (앱 이름, 기본 로케일 등)
- 단순 유틸리티 함수 (문자열 정규화, 안전한 JSON 파싱 등)

### shared/에 들어가면 안 되는 것

- 지표 계산 로직 → `analysis/`
- 차트 선택 로직 → `visualization/`
- 데이터 파싱 로직 → `data-loader/`
- 특정 도메인 지식이 담긴 코드 (투자·금융 용어 포함)

판단 기준: **"이 코드가 특정 레이어의 책임 영역에 속하는가?"** 속한다면 그 레이어로 간다. 두 개 이상의 레이어에서 공통으로 쓰이지만 어느 레이어에도 귀속되지 않는 **도메인 무관한** 유틸리티만 `shared/`로 간다.

에이전트가 `shared/`에 코드를 추가하려 할 때는, 그 코드가 위 "들어가면 안 되는 것" 목록에 해당하지 않는지 스스로 점검해야 한다.

---

## 위반 예시와 교정

에이전트가 규칙을 위반했을 때 `verify-structure.sh`가 어떤 에러를 출력하고, 에이전트가 어떻게 대처해야 하는지 예시로 보인다. 에러 메시지에는 위반 위치와 교정 방향이 함께 담긴다.

### 예시 1 — 역방향 import

`src/analysis/returns.ts`에서 `src/visualization/chart-selector.ts`를 import한 경우:

```
ERROR: Layer dependency violation
  File: src/analysis/returns.ts:3
  Import: '../visualization/chart-selector'
  Problem: 'analysis' layer cannot import from 'visualization' layer
  Rule: visualization > analysis in layer order (순방향 규칙 위반)

  교정 방향:
  - 만약 returns.ts에 차트 관련 로직이 섞여 있다면, 그 로직을 visualization/으로 옮긴다
  - 만약 chart-selector.ts에 계산 로직이 있다면, 그 로직을 analysis/로 옮긴다
  - 두 레이어가 공유해야 하는 순수 데이터 타입이 필요하다면 types/에 정의한다
```

### 예시 2 — shared에 도메인 로직

`src/shared/portfolio-metrics.ts`에 샤프비율 계산 함수를 넣은 경우:

```
ERROR: shared/ should not contain domain logic
  File: src/shared/portfolio-metrics.ts
  Problem: 'portfolio-metrics'는 투자 도메인 지식(샤프비율, 변동성)을 담고 있다
  Rule: shared/는 도메인 무관한 유틸리티만 허용

  교정 방향:
  - 이 파일을 src/analysis/로 이동한다
  - 계산 공식은 02-data-analysis.md의 지표 정의와 일치해야 한다
```

### 예시 3 — 우회 import

`src/schema/`에서 `src/data-loader/`를 간접적으로 import한 경우 (예: `import { ... } from '../../data-loader/parser'`):

```
ERROR: Layer dependency violation
  File: src/schema/portfolio.ts:5
  Import: '../data-loader/parser'
  Problem: 'schema' layer cannot import from 'data-loader' layer
  Rule: schema의 can_import은 [types, shared]만 허용

  교정 방향:
  - schema는 "데이터의 형태"만 정의해야 하며, "데이터를 가져오는 방법"은 data-loader의 책임이다
  - parser의 결과 타입이 필요한 거라면, 그 타입을 schema에 직접 정의하고 data-loader가 그 타입을 따르게 한다
```

---

## 변경 관리

이 문서를 수정할 때는 다음을 반드시 지킨다.

1. **두 매트릭스의 일치.** 사람 판독용 표와 기계 판독용 YAML 블록이 서로 어긋나면 검증 스크립트와 실제 코드 작성이 어긋나게 된다.
2. **레이어 추가·삭제는 큰 건.** 레이