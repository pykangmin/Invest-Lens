# INIT.md

이 문서는 작업 환경을 준비할 때 참조하는 실무 문서. 의존성 설치, 개발 서버 기동, DB 접속, 검증 스크립트 실행을 다룸. 대부분 `./init.sh` 하나로 처리되며, 이 문서는 스크립트가 실패했을 때나 처음 환경을 구성할 때 활용. "왜 이 기술 스택인가"는 [`tech-stack.md`](../tech-stack.md) 참조.

---

## 요구 사항

- **Node.js 20.x LTS** — 하위 버전에서는 Vite 최신 버전이 동작하지 않을 수 있음
- **npm** — Node.js에 기본 포함
- **Git**

Node.js 설치 도구(nvm, volta 등)는 각자 선호에 따라 선택. 버전만 맞으면 무관함.

---

## 최초 1회 세팅

레포를 처음 클론한 뒤 한 번만 실행. 결과물(`node_modules/` 제외)은 커밋되어 있어야 함.

```bash
git clone <repository-url>
cd <repository-name>
npm install
```

프로젝트 초기화(Vite 템플릿 생성 등)는 이미 완료된 상태로 가정. 레포에 `package.json`, `vite.config.ts`, `tsconfig.json`이 없으면 팀에 문의.

---

## DB 접속

`11-ingest` 가 입력으로 받는 DB 핸들의 접속 환경. 본 문서는 환경 사실만 기술하고 도메인 규칙(스키마·결측·이상치)은 `skills/01-data-profile.md` / `skills/00-assumptions.md` 가 정의.

환경 변수 (예시 — 실제 값은 팀 채널에서 공유):

| 변수 | 설명 |
|------|------|
| `DB_HOST` | DB 호스트명 |
| `DB_PORT` | 포트 |
| `DB_NAME` | 데이터베이스 이름 |
| `DB_USER` | 접속 계정 |
| `DB_PASSWORD` | 접속 비밀번호 |
| `DB_SCHEMA` | 스키마명 (현재 펀더멘털·기술적·거시·원자재 4개 엔티티가 동거) |

`.env` 파일에 두고 git에는 올리지 않음 (`.gitignore` 처리). 샘플 파일은 `.env.example` (TODO: 실제 운영 시 추가).

접속 확인:

```bash
# TODO: 접속 헬스체크 스크립트 (init.sh가 호출 예정)
```

---

## 개발 서버 실행

```bash
npm run dev
```

기본적으로 `http://localhost:5173` 에서 대시보드가 뜸. 변경 사항은 저장 시 자동 반영(HMR).

---

## 구조 및 규칙 검증

코드 작성 후 커밋 전에 실행. `init.sh` 가 이 검증들을 자동 호출하지만 수동 개별 실행도 가능.

```bash
./verify-structure.sh   # 레이어 의존성 검사
./verify-skills.sh      # Skills 규칙 준수 검사
```

둘 중 하나라도 실패하면 커밋하지 않음. 에러 메시지에 교정 방향이 함께 출력되므로 그것을 먼저 따름.

---

## 빌드

```bash
npm run build
```

빌드 결과는 `dist/` 디렉토리에 생성됨. 로컬에서 빌드 결과를 미리 확인하려면:

```bash
npm run preview
```

---

## 배포

Vercel을 기본 배포 플랫폼으로 사용. GitHub 저장소를 Vercel에 연결하면 이후 푸시할 때마다 자동 배포.

### 최초 연결

1. [vercel.com](https://vercel.com) 에서 GitHub 계정으로 로그인
2. "New Project" → GitHub 저장소 선택
3. Framework Preset: **Vite** 자동 감지 (Build Command: `npm run build`, Output Directory: `dist`)
4. "Deploy" 클릭

### 이후 배포

- `main` 브랜치로 푸시하면 프로덕션 배포 자동 실행
- 다른 브랜치로 푸시하면 프리뷰 배포 자동 실행
- 각 배포의 URL은 Vercel 대시보드와 GitHub PR 코멘트에서 확인 가능

심사용 배포 URL은 Vercel이 자동 할당하는 프로덕션 URL을 사용.

---

## 트러블슈팅

<!-- 실제로 만난 문제와 해결 방법을 앞으로 여기에 기록한다. -->

(아직 기록된 이슈 없음)
