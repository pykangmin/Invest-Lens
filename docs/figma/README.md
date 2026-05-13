# docs/figma — 디자인 시안 추출본

이 디렉토리는 Figma REST API 에서 직접 fetch 한 시안 노드 트리와 그로부터 추출한 슬롯·카피·시각 토큰을 담는다. **Figma 시안 자체가 단일 진실의 원천**이지만, 코드가 직접 읽을 수 없으므로 여기 추출본이 `13-render` 의 입력 spec 으로 사용된다.

## 출처

- Figma 노드 트리 → `scripts/figma-fetch.mjs` 로 자동 fetch → `figma-tree.json`
- 슬롯 자동 추출 → `scripts/figma-extract-slots.mjs` → `slots.generated.json`
- 화면별 추출 → `scripts/figma-extract-screens.mjs` → `screens/*.json`

## 파일 구성

- [`figma-tree.json`](figma-tree.json) — Figma REST API 응답 원본 (자동 fetch)
- [`figma-meta.json`](figma-meta.json) — fetch 메타 (timestamp, root frame id 등)
- [`slots.generated.json`](slots.generated.json) — 자동 추출 슬롯 리스트
- [`screens/`](screens/) — 화면별 슬롯 추출본 (`home.json`, `main.json`, `main-*.json`)
- [`dashboard-slots-v4.md`](dashboard-slots-v4.md) — 최종 시안 와이어프레임 spec (단일 진실의 원천)
- [`data-coverage-v4.md`](data-coverage-v4.md) — 슬롯 → DB 컬럼 매핑 커버리지

## 단일 진실의 원천 관계

- 시각 속성(색·타이포·모션·배경)의 **결정값**: [`skills/21-frontend-aesthetics.md`](../../skills/21-frontend-aesthetics.md)
- 시각 속성의 **시안 적용 사례**: 이 디렉토리
- 데이터·계산 정의: [`skills/02-data-analysis.md`](../../skills/02-data-analysis.md)
- 슬롯 → 차트 매핑 규칙: [`skills/13-render.md`](../../skills/13-render.md)

이 디렉토리의 문서는 **추출본** 이지 결정 문서가 아니다. 시안과 21-aesthetics 가 충돌하면 21-aesthetics 가 이긴다. 시안과 데이터 정의가 충돌하면 02-data-analysis 가 이긴다.
