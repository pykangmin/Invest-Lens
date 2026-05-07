#!/usr/bin/env bash
# init.sh — 작업 환경 부팅. fail-fast 검증 시퀀스.
# 자세한 내용은 docs/guides/INIT.md 참조.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$1"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }

# ─── 1. Node.js / npm 존재 확인 ──────────────────────────────
step "1/6 Node.js / npm 확인"
command -v node >/dev/null 2>&1 || fail "node 가 PATH 에 없음. Node.js 20.x LTS 설치 필요."
command -v npm  >/dev/null 2>&1 || fail "npm 이 PATH 에 없음."
NODE_VER="$(node --version)"
ok "node $NODE_VER · npm $(npm --version)"

# ─── 2. package.json / 의존성 ────────────────────────────────
step "2/6 매니페스트 / 의존성"
[ -f package.json ]   || fail "package.json 부재. 팀 매니페스트 복구 필요."
[ -f tsconfig.json ]  || fail "tsconfig.json 부재."
[ -f vite.config.ts ] || fail "vite.config.ts 부재."
[ -d node_modules ]   || fail "node_modules 부재. 'npm ci' 또는 'npm install' 필요."

# Windows 에서 자주 깨지는 esbuild win32 바이너리 검증
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if [ ! -f node_modules/@esbuild/win32-x64/esbuild.exe ]; then
      fail "esbuild win32-x64 바이너리 누락. 'npm install esbuild --force --include=optional' 실행 필요. 자세한 내용은 docs/guides/INIT.md 트러블슈팅."
    fi
    ;;
esac
ok "매니페스트와 node_modules 정상"

# ─── 3. 환경 변수 ────────────────────────────────────────────
step "3/6 .env.local"
[ -f .env.local ] || fail ".env.local 부재. .env.example 을 복사해 DATABASE_URL 채울 것."
grep -q "^DATABASE_URL=" .env.local || fail ".env.local 에 DATABASE_URL 항목이 없음."
ok ".env.local 의 DATABASE_URL 발견"

# ─── 4. DB 헬스체크 ──────────────────────────────────────────
step "4/6 DB ping"
npm run --silent db:ping >/dev/null 2>&1 || fail "DB 연결 실패. 'npm run db:ping' 으로 직접 확인."
ok "DB 응답 정상"

# ─── 5. 구조 검증 ────────────────────────────────────────────
step "5/6 verify-structure.sh"
bash "$ROOT/verify-structure.sh" >/dev/null 2>&1 || fail "레이어 의존성 위반. 'bash verify-structure.sh' 로 직접 확인."
ok "src/ 레이어 의존성 정상"

# ─── 6. Skills 규칙 검증 ──────────────────────────────────────
step "6/6 verify-skills.sh"
bash "$ROOT/verify-skills.sh" >/dev/null 2>&1 || fail "Skills 규칙 위반. 'bash verify-skills.sh' 로 직접 확인."
ok "Skills 규칙 정상"

printf "\n\033[1;32m▣ 환경 준비 완료. 다음: 'npm run dev' 으로 개발 서버 기동.\033[0m\n"
