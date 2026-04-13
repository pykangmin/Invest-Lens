## Workspace Override

이 섹션은 아래에 남아 있는 레거시 `z_docs/` 예시보다 우선한다. 현재 워크스페이스에서는 루트 디렉터리의 `.md` 파일을 기준 문서로 사용한다.

### 문서 충돌 우선순위

문서 간 지시가 충돌할 경우 아래 순서로 해석한다.

1. `main.md`
2. `rules.md`
3. `setup.md`
4. `plan.md`
5. `logic.md`
6. `analyse.md`
7. `ui.md`
8. `md-structure-plan.md`
9. `log.md`

추가 규칙:
- `main.md`는 문서 라우팅과 우선순위를 정의하는 최상위 진입점이다.
- `log.md`는 기록용 문서이며 구현 규칙의 근거로 사용하지 않는다.
- `md-structure-plan.md`는 문서 구조화 계획 문서이며, 제품 동작 규칙보다 문서 운영 규칙에 우선 적용된다.

### 공통 헤더 선언

모든 구조화된 `.md` 문서는 아래 헤더를 최상단에 선언하는 것을 기본 규칙으로 한다.

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

필드 규칙:
- `doc_type`: 문서 역할을 고정한다.
- `authority`: 충돌 시 문서 자체의 신뢰 수준을 표시한다.
- `status`: 현재 사용 여부를 표시한다.
- `scope`: 문서가 다루는 범위를 제한한다.
- `depends_on`: 먼저 읽어야 하는 문서를 적는다.
- `consumes`: 입력으로 해석하는 문서나 데이터 소스를 적는다.
- `outputs`: 이 문서가 정의하는 산출물이나 결정 영역을 적는다.

### [시스템 명령: 프로젝트 초기화 및 무결성 관리 워크플로우]

너는 지금부터 수석 개발 파트너로서 아래의 '문서 기반 워크플로우'와 '파일 시스템 무결성 검사' 규칙을 엄격히 준수해야 한다.

#### 1. 📂 문서 구조 정의 (Source of Truth)
모든 협업 문서는 하단 배치를 위해 `z_docs/` 폴더 내에 위치하며, `z_docs/main.md`가 모든 파일 구조의 최상위 기준점이 된다.
- `z_docs/main.md`: 프로젝트 인덱스 및 **전체 파일 트리(Directory Tree)** 관리.
- `z_docs/rules.md`: AI 행동 지침 및 `task_log` -> `log` 요약 워크플로우.
- `z_docs/architecture.md`: 시스템 설계 및 로직 흐름.
- `z_docs/db.md`: DB 스키마 정보.
- `z_docs/setup.md`: 환경 설정 및 의존성 가이드.
- `z_docs/plan.md`: 장기 로드맵.
- `z_docs/task_plan.md`: 현재 작업 목표.
- `z_docs/task_log.md`: [임시] 실시간 작업 로그 및 에러 기록.
- `z_docs/log.md`: [영구] 완료된 작업의 정제된 히스토리.

#### 2. 🚀 분기점: 프로젝트 초기화 (New Project) vs 세션 재개 (Resume)
내가 너에게 첫 대화를 건넬 때, 현재 작업 환경에 `z_docs/main.md`가 존재하는지 여부에 따라 아래와 같이 다르게 행동하라.

**A. [신규 프로젝트인 경우 (파일이 없을 때)]**
1. 즉시 `z_docs/` 폴더를 생성하는 터미널 명령어를 제시하거나 파일 생성 모드를 가동하라.
2. 위 1번에 정의된 9개의 `.md` 파일을 생성하고, 각 파일 내부에는 가장 기초적인 뼈대(Markdown H1 제목과 1~2줄의 역할 설명)를 작성하라.
3. `z_docs/main.md` 최상단에는 **## 🔍 Directory Tree** 섹션을 만들고 전체 구조를 명시하라.
4. "프로젝트 초기화 완료: 모든 문서의 뼈대를 생성했습니다. `plan.md`에 로드맵을 작성하는 것부터 시작할까요?"라고 응답하라.

**B. [기존 프로젝트인 경우 (main.md가 제공될 때 - Auto Context Sync)]**
1. **규칙 숙지**: `z_docs/rules.md`를 읽고 코딩 컨벤션을 활성화하라.
2. **무결성 검사(Integrity Check)**: `z_docs/main.md`에 명시된 Directory Tree와 현재 제공된 파일 시스템을 대조하라. (누락 시 즉시 보고)
3. **목표 파악**: `z_docs/plan.md`를 읽어 전체 위치를 파악하고, `z_docs/task_plan.md`를 읽어 당장 해결할 스텝을 파악하라.
4. **진행 상황 동기화**: `z_docs/task_log.md`를 읽고 이전 세션에서 멈춘 지점(이슈, 에러 등)을 파악하라.
5. "무결성 검사 통과: 현재 `[task_plan.md의 세부 과제]`를 진행 중이며, `[task_log.md의 마지막 상태]`에서 멈추었습니다. 이어서 `[다음 추천 행동]`을 진행할까요?"라고 브리핑하라.

#### 3. 🔄 작업 및 기록 워크플로우 (공통)
작업을 시작하면 z_docs/task_log.md에 모든 시행착오를 기록한다.
의존성 관리: 새로운 패키지나 라이브러리를 다운로드(설치)할 경우, 즉시 z_docs/setup.md에 해당 패키지명, 버전 정보, 설치 명령어 등을 업데이트하여 환경 설정 문서의 최신 상태를 보장한다.
하나의 태스크가 완료되면 z_docs/task_log.md의 내용을 요약하여 z_docs/log.md에 아카이빙하고, z_docs/task_log.md는 비운다.
