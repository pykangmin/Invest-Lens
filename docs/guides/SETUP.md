# SETUP.md

이 문서는 개발 환경을 수동으로 세팅하거나 문제를 디버깅할 때 참조하는 실무 문서다. 대부분의 경우 `./init.sh` 하나만 실행하면 되며, 이 문서는 그 스크립트가 실패했을 때나 처음 환경을 구성할 때 활용한다. "왜 이 기술 스택인가"에 대한 설명은 [`tech-stack.md`](../tech-stack.md)를 참조.

---

## 요구 사항

- **Node.js 20.x LTS** — 하위 버전에서는 Vite 최신 버전이 동작하지 않을 수 있음
- **npm** — Node.js에 기본 포함
- **Git**

Node.js 설치 도구(nvm, volta 등)는 각자 선호에 따라 선택. 버전만 맞으면 무관하다.

---

## 최초 1회 세팅

레포를 처음 클론한 뒤 한 번만 실행한다. 이 단계의 결과물(`node_modules/` 제외)은 커밋되어 있어야 한다.

```bash
# 레포 클론
git clone <repository-url>
cd <repository-name>

# 의존성 설치
npm install
```

프로젝트 초기화(Vite 템플릿 생성 등)는 이미 완료된 상태로 가정한다. 레포에 `package.json`, `vite.config.ts`, `tsconfig.json`이 없다면 먼저 팀에 문의한다.

---

## 환경 변수

DB 연결 문자열은 서버 전용 비밀값이므로 브라우저 코드나 `VITE_` 환경변수에 넣지 않는다. 로컬 개발에서는 `.env.example`을 참고해 `.env.local`을 만들고, 아래 키만 설정한다.

```bash
DATABASE_URL=postgresql://...
```

현재 웹앱은 `invest_lens_readonly` DB role을 사용한다. 이 role은 `public` 스키마의 투자 데이터 테이블에 대한 `SELECT`만 허용하며, 쓰기 권한은 없다.

---

## 개발 서버 실행

```bash
npm run dev
```

기본적으로 `http://localhost:5173`에서 대시보드가 뜬다. 변경 사항은 저장 시 자동 반영된다(HMR).

---

## 구조 및 규칙 검증

코드 작성 후 커밋 전에 실행한다. `init.sh`가 이 검증들을 자동으로 호출하지만, 수동으로 개별 실행할 수도 있다.

```bash
# 레이어 의존성 검사
./verify-structure.sh

# Skills 규칙 준수 검사
./verify-skills.sh
```

둘 중 하나라도 실패하면 커밋하지 않는다. 에러 메시지에 교정 방향이 함께 출력되므로 그것을 먼저 따른다.

---

## 빌드

프로덕션 빌드를 생성한다.

```bash
npm run build
```

빌드 결과는 `dist/` 디렉토리에 생성된다. 로컬에서 빌드 결과를 미리 확인하려면:

```bash
npm run preview
```

---

## DB 연결 확인

서버 API에 연결하기 전, 로컬에서 DB 읽기 권한과 주요 테이블 데이터를 확인한다.

```bash
npm run db:smoke
```

이 명령은 비밀값을 출력하지 않고, 기업 수·샘플 기업·AAPL 최신 기술 지표·최신 거시 국면만 JSON으로 출력한다.

---

## 배포

Vercel을 기본 배포 플랫폼으로 사용한다. GitHub 저장소를 Vercel에 연결하면 이후 푸시할 때마다 자동 배포된다.

### 최초 연결

1. [vercel.com](https://vercel.com)에서 GitHub 계정으로 로그인
2. "New Project" → GitHub 저장소 선택
3. Framework Preset: **Vite** 자동 감지 (Build Command: `npm run build`, Output Directory: `dist`)
4. "Deploy" 클릭

### 이후 배포

- `main` 브랜치로 푸시하면 프로덕션 배포 자동 실행
- 다른 브랜치로 푸시하면 프리뷰 배포 자동 실행
- 각 배포의 URL은 Vercel 대시보드와 GitHub PR 코멘트에서 확인 가능

심사용 배포 URL은 Vercel이 자동 할당하는 프로덕션 URL을 사용한다.

---

## 트러블슈팅

<!-- 실제로 만난 문제와 해결 방법을 앞으로 여기에 기록한다. -->

(아직 기록된 이슈 없음)
