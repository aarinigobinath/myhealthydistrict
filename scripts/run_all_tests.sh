#!/usr/bin/env bash
# Runs every test: API flow (pytest), React (vitest), and the real-browser click-through (Playwright).
set -e
cd "$(dirname "$0")/.."
. .venv/bin/activate
echo "== API tests";      (cd backend && python -m pytest -q)
echo "== React tests";    (cd frontend && npx vitest run)
echo "== Build website";  (cd frontend && npm run build --silent)
echo "== Browser tests";  python -m pytest e2e -q
