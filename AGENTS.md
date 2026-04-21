# AGENTS.md

이 레포지토리는 투자 데이터 대시보드를 바이브 코딩으로 구현하기 위한 작업 환경이다. 당신은 매 세션마다 이전 세션의 기억 없이 시작하므로, 이 문서를 먼저 읽고 아래 절차에 따라 현재 상태를 파악한 뒤 기능 하나를 골라 구현하고 깨끗한 상태로 다음 세션에 넘긴다. 이 문서는 **목차일 뿐**이며, 각 항목의 상세는 해당 파일에 위임한다.

---

## 세션 시작

새 세션을 시작할 때 아래 순서를 따른다. 건너뛰지 않는다.

1. `pwd`로 현재 작업 디렉토리 확인
2. `git log --oneline -20`과 [`claude-progress.txt`](claude-progress.txt)를 읽어 이전 세션의 작업 내역 파악
3. [`feature_list.json`](feature_list.json)을 읽어 전체 기능 범위와 남은 작업 확인
4. `./init.sh` 실행 — 의존성 설치 확인, 개발 서버 기동, 헬스체크, 구조 검증, Skills 규칙 검증을 순차 수행
5. `init.sh`가 실패하면 그 에러를 **먼저 해결**한다. 새 기능 구현은 환경이 정상 동작한 이후에만 시작
6. `feature_list.json`에서 `passes: false`인 항목 중 하나를 골라 이번 세션의 작업으로 확정

---

## 기능 구현 시 참조

### 데이터 해석 규칙 (skills/)

- [`skills/data-profile.skill.md`](skills/data-profile.skill.md) — 들어온 데이터의 카테고리 판정 규칙
- [`skills/data-analysis.skill.md`](skills/data-analysis.skill.md) — 카테고리별 지표 계산 규칙
- [`skills/visualization.skill.md`](skills/visualization.skill.md) — 차트 타입 선택 규칙
- [`skills/insight.skill.md`](skills/insight.skill.md) — 인사이트 생성 기준
- [`skills/dashboard-layout.skill.md`](skills/dashboard-layout.skill.md) — UI 배치 규칙

이 파일들은 **반드시 따라야 하는 규칙**이다. 선택적 가이드가 아니며, `verify-skills.sh`가 준수 여부를 검증한다.

### 코드 구조

- [`docs/architecture/LAYERS.md`](docs/architecture/LAYERS.md) — 6개 레이어의 책임과 의존성 매트릭스. 코드를 쓰기 전에 어떤 레이어에 속하는지, 어떤 레이어를 import할 수 있는지 반드시 확인

### 기술 스택

- [`docs/tech-stack.md`](docs/tech-stack.md) — 사용 라이브러리(React, Vite, TypeScript, ECharts, PapaParse, lodash, dayjs, Vercel)와 선정 이유
- [`docs/guides/SETUP.md`](docs/guides/SETUP.md) — 개발 환경 세팅 절차

### 라이브러리 참고 문서

- [`docs/references/`](docs/references/) — ECharts, PapaParse, lodash, dayjs 공식 문서 캐시. 라이브러리 API를 기억으로 추론하지 말고 여기를 참조

---

## 세션 종료

기능 구현이 끝나면 아래 순서를 따른다.

1. [`docs/guides/TESTING.md`](docs/guides/TESTING.md)의 검증 절차 수행 — 헬스체크, 구조 검증, Skills 준수 검증, 기능 검증(`feature_list.json`의 steps)을 모두 통과해야 함
2. 통과한 기능의 `passes` 값을 `false` → `true`로 변경
3. [`.gitcommit-rules.md`](.gitcommit-rules.md)의 형식에 맞춰 git 커밋
4. [`claude-progress.txt`](claude-progress.txt)에 이번 세션 요약 추가 — 무엇을 했고, 어떤 문제가 있었고, 다음 세션이 주목할 지점은 무엇인지
5. 다음 세션이 정리 작업 없이 바로 새 기능에 착수할 수 있는 상태인지 확인

구현 도중 막히면 **절반의 상태로 커밋하지 말고** `git revert`로 마지막 정상 상태로 돌아간다. 깨끗한 되돌림이 반쯤 된 코드보다 낫다.

---

## 상태 추적 파일

- [`feature_list.json`](feature_list.json) — 전체 기능 목록과 완료 상태. 항목 추가·삭제·수정 금지, `passes` 값만 변경
- [`claude-progress.txt`](claude-progress.txt) — 세션 간 인수인계 로그
- [`.gitcommit-rules.md`](.gitcommit-rules.md) — 커밋 메시지 형식과 타이밍 규칙

---

## 절대 하지 말 것

- `feature_list.json`의 항목을 삭제하거나 내용을 수정하지 않는다. `passes` 값만 변경 가능
- 빌드가 깨진 상태에서 커밋하지 않는다
- 한 세션에 여러 기능을 동시에 구현하지 않는다 — 하나를 완성하고 다음으로 넘어간다
- Skills 파일의 규칙을 "합리적 판단"으로 우회하지 않는다 — 규칙에 문제가 있다면 Skills 파일 자체를 수정하고 그 변경을 별도로 커밋
- `src/shared/`에 비즈니스 로직을 넣지 않는다 — 지표 계산, 차트 선택, 데이터 파싱은 각 레이어에 귀속된다
