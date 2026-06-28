#!/usr/bin/env bash
# Stop the backend (:3333) and frontend (:2222). Works whether started by
# start.sh (PID files) or manually (port-based fallback), and handles
# uvicorn --reload (whose reloader parent respawns the worker).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$ROOT/.run"
PORTS=(3333 2222)
stopped=0

# 1) PIDs recorded by start.sh (kills children too)
for svc in backend frontend; do
  if [ -f "$RUN/$svc.pid" ]; then
    PID="$(cat "$RUN/$svc.pid")"
    pkill -P "$PID" 2>/dev/null || true
    kill "$PID" 2>/dev/null && { echo "■ Stopped $svc (pid $PID)"; stopped=1; }
    rm -f "$RUN/$svc.pid"
  fi
done

# 2) Port-based: kill each listener and its reloader parent (if python/node)
for port in "${PORTS[@]}"; do
  for pid in $(lsof -ti tcp:"$port" 2>/dev/null); do
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    pcomm="$(ps -o comm= -p "$ppid" 2>/dev/null)"
    case "$pcomm" in
      *[Pp]ython*|*node*|*uvicorn*) kill "$ppid" 2>/dev/null || true ;;
    esac
    kill "$pid" 2>/dev/null || true
    stopped=1
  done
done

# 3) Grace period, then force-kill anything still holding a port
sleep 1
for port in "${PORTS[@]}"; do
  rem="$(lsof -ti tcp:"$port" 2>/dev/null)"
  [ -n "$rem" ] && { kill -9 $rem 2>/dev/null || true; echo "■ Force-stopped lingering process on :$port"; }
done

[ "$stopped" -eq 0 ] && echo "· nothing was running on :3333 / :2222"
echo "✓ done"
