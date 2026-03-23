#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "UI smoke test"
echo "1. Confirm frontend directory exists"
test -d "$ROOT/Pyscript"

echo "2. List key frontend files"
find "$ROOT/Pyscript" -maxdepth 2 -type f | head -50

echo "UI smoke test completed."
echo "Add route-specific checks as your setup becomes more standardized."