#!/usr/bin/env bash
# Stop the backend and frontend started by start.sh.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$ROOT/.run"

for svc in backend frontend; do
  if [ -f "$RUN/$svc.pid" ]; then
    PID="$(cat "$RUN/$svc.pid")"
    pkill -P "$PID" 2>/dev/null || true   # children (uvicorn reloader / vite worker)
    if kill "$PID" 2>/dev/null; then
      echo "■ Stopped $svc (pid $PID)"
    else
      echo "· $svc was not running"
    fi
    rm -f "$RUN/$svc.pid"
  else
    echo "· no $svc pid file"
  fi
done
