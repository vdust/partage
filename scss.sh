#!/bin/bash
SCSS="$(which scss)" 2>/dev/null

if [[ ! -x "$SCSS" ]]; then
  echo "scss program not found in PATH." >&2
  exit 1
fi

mode="${1:-watch}"
case "$mode" in
  update|watch)
    ;;
  *)
    echo "Unknown mode '$mode'. Allowed: update, watch "
    exit 1
    ;;
esac

exec "$SCSS" --style compact --$mode scss:static/css
