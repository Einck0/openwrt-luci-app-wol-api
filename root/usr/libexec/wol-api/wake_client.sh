#!/bin/sh
set -eu

API_URL="${WOL_API_URL:-http://127.0.0.1:8037/api/wake}"
TOKEN="${WOL_API_TOKEN:-}"

usage() {
	cat <<'EOF'
Usage:
  wake_client.sh --name <device_name>
  wake_client.sh --mac <aa:bb:cc:dd:ee:ff>

Environment:
  WOL_API_URL    API endpoint, default http://127.0.0.1:8037/api/wake
  WOL_API_TOKEN  Bearer token, required
EOF
}

[ -n "$TOKEN" ] || { echo "WOL_API_TOKEN is required" >&2; exit 1; }

MODE=""
VALUE=""
while [ $# -gt 0 ]; do
	case "$1" in
		--name) MODE="name"; VALUE="${2:-}"; shift 2 ;;
		--mac) MODE="mac"; VALUE="${2:-}"; shift 2 ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
	esac
done

[ -n "$MODE" ] && [ -n "$VALUE" ] || { usage >&2; exit 1; }

JSON=$(printf '{"%s":"%s"}' "$MODE" "$VALUE")

exec curl -fsS -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$JSON"
