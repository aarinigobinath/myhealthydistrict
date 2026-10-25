#!/usr/bin/env bash
# Keeps MyHealthyDistrict running: checks every 10 seconds and restarts anything that stopped.
#   ./scripts/run_forever.sh            (Linux/macOS, Postgres already installed)
# App address: http://localhost:8000  (the API also serves the built website)
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
log() { echo "[$(date '+%H:%M:%S')] $*"; }

ensure_db() {
  if ! pg_isready -q -h localhost -p 5432; then
    log "starting PostgreSQL"
    (service postgresql start || pg_ctlcluster "$(ls /etc/postgresql | head -1)" main start) >/dev/null 2>&1
    sleep 3
  fi
}
ensure_web_build() {
  if [ ! -d frontend/dist ]; then
    log "building the website"
    (cd frontend && npm install --silent && npm run build --silent)
  fi
}
api_ok() { curl -fsS -m 3 http://localhost:8000/api/health >/dev/null 2>&1; }

ensure_web_build
while true; do
  ensure_db
  if ! api_ok; then
    log "starting API"
    fuser -k 8000/tcp >/dev/null 2>&1
    setsid nohup "$ROOT/scripts/start_api.sh" >> "$ROOT/api.log" 2>&1 < /dev/null &
    sleep 4
    api_ok && log "API is up" || log "API did not answer yet"
  fi
  sleep 10
done
