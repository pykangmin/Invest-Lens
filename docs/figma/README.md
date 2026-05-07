# docs/figma — 디자인 시안 추출본

이 디렉토리는 디자이너가 전달한 PNG 시안에서 읽어낸 슬롯·카피·시각 토큰을 텍스트로 옮긴 것이다. **시안 자체가 단일 진실의 원천**이지만, PNG 는 코드가 직접 읽을 수 없으므로 여기 추출본이 있어야 `13-render` 의 입력 spec 으로 사용된다.

## 출처

- `images/진입 화면.png` — 검색 시작 페이지
- `images/개별 주식 화면.png` — 종목 선택 후 대시보드 (메인 평가 대상)
- `images/대시보드 플로우 참고용.png` — 분류·계산 흐름 작도

## 파일 구성

- [`landing.md`](landing.md) — 진입 화면 슬롯·카피·토큰
- [`dashboard-slots.md`](dashboard-slots.md) — 개별 주식 화면의 슬롯 13개 명세 표
- [`flow.md`](flow.md) — 플로우차트가 의미하는 분류·계산 enumeration

## 단일 진실의 원천 관계

- 시각 속성(색·타이포·모션·배경)의 **결정값**: [`skills/21-frontend-aesthetics.md`](../../skills/21-frontend-aesthetics.md)
- 시각 속성의 **시안 적용 사례**: 이 디렉토리
- 데이터·계산 정의: [`skills/02-data-analysis.md`](../../skills/02-data-analysis.md)
- 슬롯 → 차트 매핑 규칙: [`skills/13-render.md`](../../skills/13-render.md)

이 디렉토리의 문서는 **추출본** 이지 결정 문서가 아니다. 시안과 21-aesthetics 가 충돌하면 21-aesthetics 가 이긴다 (단일 진실의 원천). 시안과 데이터 정의가 충돌하면 02-data-analysis 가 이긴다.

## 불확실성 표기 규약

PNG 해상도로 인한 판독 한계가 있는 항목은 본문에서 다음 마커로 구분한다.

- ✅ **확정**: 시안에서 명확히 읽힘
- ⚠️ **추정**: 시안 해상도/가림 등으로 정확치 불명, 합리적 추정
- ❓ **미상**: 시안에서 판독 불가, 디자이너 확인 필요

확정값으로 보이더라도 hex 색상값은 PNG 픽셀 샘플링 추정이라 디자이너 원본(Figma) 확정값과 다를 수 있음.
