# v3 Dashboard 보관소

이 폴더는 **임시 시안 기반 v1~v3 대시보드 산출물**을 보관한다. 코드와 시안 모두 **임시 시안**(Figma node `251:4045`)에서 추출한 것이며, **최종 시안**(node `0:1` 의 `home` / `main` / `main-commodity` / `main-technical` 4 프레임) 작업이 시작되면서 새 코드 트리는 이 폴더 내용을 import 하지 않는다.

## 보관 이유

1. **컨텍스트**: 새 detail 화면 구현(B 단계) 시 이전 슬롯 매핑·컴포넌트 패턴을 참고할 수 있도록 유지.
2. **인수인계**: 미래 세션에서 "왜 이런 구조였나" 질문에 답할 1차 자료.
3. **삭제 대신 격리**: src/ 와 docs/figma/ 트리가 v4 단일 진실의 원천만 따르도록, v3 파일을 격리 보관.

## 폴더 내용

| 파일 | 원래 위치 | 역할 |
|---|---|---|
| `StockDashboard.tsx.txt` | `src/layout/StockDashboard.tsx` | v3 대시보드 레이아웃 (코드, .txt 확장자로 import 차단) |
| `IndexStripe.tsx.txt` | `src/visualization/IndexStripe.tsx` | v3 헤더의 위험지표 4슬롯 컴포넌트 (v4 폐기) |
| `dashboard-slots-v1.md` | `docs/figma/dashboard-slots.md` | 1차 임시 시안 매핑 (PNG 텍스트 추출) |
| `dashboard-slots-v3.md` | `docs/figma/dashboard-slots-v3.md` | 3차 임시 시안 매핑 (Figma REST API 1차 fetch — node `251:4045`) |
| `flow.md` | `docs/figma/flow.md` | "대시보드 플로우 참고용" PNG 추출본 (12-analyze 작도) |
| `landing-v1.md` | `docs/figma/landing.md` | 진입 화면 1차 PNG 추출 |
| `composite-trio-audit.md` | `docs/figma/composite-trio-audit.md` | 시점 trio 의미 검수 보고서 |
| `v3-implementation-audit.md` | `docs/figma/v3-implementation-audit.md` | v3 구현 일치도 78% Reviewer agent 보고서 |
| `251_4045.png` | `images/figma/251_4045.png` | 임시 시안 PNG export (node `251:4045`, scale=2) |
| `개별-주식-화면.png` | `images/개별 주식 화면.png` | 사용자 제공 임시 시안 PNG (1차 화면) |
| `대시보드-플로우-참고용.png` | `images/대시보드 플로우 참고용.png` | 사용자 제공 임시 플로우 작도 PNG |
| `진입-화면.png` | `images/진입 화면.png` | 사용자 제공 임시 진입 화면 PNG |

## 새 작업의 단일 진실의 원천 (v4)

| 영역 | 파일 |
|---|---|
| 와이어프레임 spec | `docs/figma/dashboard-slots-v4.md` |
| 화면별 raw spec | `docs/figma/screens/{home,main,main-commodity,main-technical}.json` |
| 화면 PNG (참고용) | `images/figma/{219_2558,251_3523,271_561,327_456}.png` |
| 추출 스크립트 | `scripts/figma-extract-screens.mjs` |
| 노드 트리 | `docs/figma/figma-tree.json` (Figma REST API fetch) |

## 사용 규칙

- **import 금지**: `src/` 의 어떤 파일도 이 폴더에서 import 하지 않는다. `.tsx.txt` 로 확장자가 바뀐 코드는 TypeScript 가 인식 안 함.
- **참고만**: 새 detail 화면 작업 시 v3 컴포넌트 구조·prop 시그니처 참고.
- **수정 금지**: 보관소이므로 내용 갱신은 하지 않는다 (역사적 스냅샷).

## 폐기 시점

본 마감(2026-05-14) 통과 후 1~2 주 내 사용자 결정으로 일괄 삭제 가능. 그 전까지는 인수인계 자료로 보존.
