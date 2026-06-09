#!/usr/bin/env bash
set -euo pipefail

mkdir -p /data/resultados
: "${PORT:=8080}"
: "${RESULTS_DIR:=/data/resultados}"
: "${HA_URL:=http://supervisor/core}"
: "${HA_TOKEN:=${SUPERVISOR_TOKEN:-}}"
export PORT RESULTS_DIR HA_URL HA_TOKEN

cd /app
exec python3 /app/server.py
