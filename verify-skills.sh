#!/usr/bin/env bash
# verify-skills.sh — Skills 파일 정합성 검사.
# 실제 검사 로직은 scripts/verify-skills.mjs (node ESM, 외부 라이브러리 없음).

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
node "$ROOT/scripts/verify-skills.mjs"
