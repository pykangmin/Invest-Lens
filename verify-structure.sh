#!/usr/bin/env bash
# verify-structure.sh — LAYERS.md 의 의존성 매트릭스를 src/ 코드와 대조.
# 실제 검사 로직은 scripts/verify-structure.mjs (node ESM, 외부 라이브러리 없음).

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
node "$ROOT/scripts/verify-structure.mjs"
