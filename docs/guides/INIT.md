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

DB 는 Supabase 가 호스팅하는 PostgreSQL (Session Pooler 엔드포인트, `aws-1-ap-northeast-2`). 접속은 단일 연결 문자열로 이뤄지며 `node-postgres` (`pg`) 가 클라이언트.

### 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | `postgresql://<user>:<password>@<host>:5432/postgres?sslmode=require` 형식의 단일 연결 문자열 |

- `.env.local` 에 둔다. git 에는 올라가지 않음 (`.gitignore` 처리).
- 형식은 [`.env.example`](../../.env.example) 참조.
- `?sslmode=require` 파라미터는 끝에 붙여둘 것. 코드 쪽에서 `ssl: { rejectUnauthorized: false }` 로 보강하므로 빠져 있어도 동작은 하지만, URL 자체에 명시해 두는 편이 일관성 있음.
- `public` 스키마에 6개 테이블이 동거: `commodity_prices`, `company_master`, `global_environment`, `macro_regime_scores`, `stock_fundamentals`, `stock_price_tech`.

### 접속 확인

```bash
npm run db:ping
```

`scripts/db-ping.mjs` 가 `.env.local` 을 직접 로드해서 `pg` 로 접속하고, latency · DB 메타 · `public` 테이블 목록을 출력한다. tsx/esbuild 의존 없이 순수 ESM 으로 동작하므로 의존성 설치가 깨진 상태에서도 단독 실행 가능. 본격 스모크 테스트는 `npm run db:smoke` (`scripts/db-smoke.ts`) — 4개 엔티티 샘플 쿼리까지 돌리지만 `tsx` 가 필요.

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

### `node_modules` 가 다른 OS 에서 빌드된 상태

증상 — Windows 에서 `npm run dev` / `npm run db:smoke` / `npx tsx ...` 가 esbuild 또는 rolldown 의 네이티브 바이너리 누락 에러로 실패. `node_modules/.bin/tsx` 가 0바이트 심볼릭 링크로 보이고, `node_modules/@esbuild/` 하위에 `aix-ppc64` 같은 엉뚱한 플랫폼 디렉토리만 존재.

원인 — `node_modules` 가 Linux/WSL 에서 설치된 뒤 Windows 로 그대로 넘어와 네이티브 의존성이 호환되지 않음.

해결 — `node_modules/` 를 지우고 현재 OS 에서 다시 설치. PowerShell 의 `ExecutionPolicy` 때문에 `npm` 이 막힌다면 한 세션 동안 풀어주거나 cmd 셸을 사용:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

확인 — `npm run db:ping` 이 통과하면 `pg` 만 깔린 상태에서도 DB 가 살아있음을 알 수 있고, `npm run dev` 가 뜨면 vite 도 정상.
