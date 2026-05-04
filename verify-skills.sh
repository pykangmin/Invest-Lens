#!/usr/bin/env bash
set -e

SKILLS_DIR="$(dirname "$0")/skills"

REQUIRED_FILES=(
  "00-assumptions.md"
  "11-ingest.md"
  "12-analyze.md"
  "13-render.md"
  "01-data-profile.md"
  "02-data-analysis.md"
  "03-insight.md"
  "21-frontend-aesthetics.md"
)

missing=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$SKILLS_DIR/$f" ]; then
    echo "MISSING: skills/$f"
    missing=1
  fi
done

if [ $missing -ne 0 ]; then
  echo "Skills check FAILED: required files missing"
  exit 1
fi

echo "TODO: dev skill body vs src implementation correspondence"
echo "TODO: 11-ingest checks (canonical schema, asset_class enum, quality_flags)"
echo "TODO: 12-analyze checks (metric/insight key sets, severity ordering)"
echo "TODO: 13-render checks (chart_type mapping, severity_color, style_ref anchors)"
echo "TODO: violation messages should include remediation hints"
echo "Skills check OK (skeleton stage)"
