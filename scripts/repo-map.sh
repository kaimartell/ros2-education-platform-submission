#!/usr/bin/env bash
set -euo pipefail

echo "== Repo map =="
echo
find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './build' -prune -o \
  -path './dist' -prune -o \
  -path './.next' -prune -o \
  -print | sed 's#^\./##' | sort