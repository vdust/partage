#!/bin/bash
set -e
cookiefile=/tmp/filehub.cookies

method=GET
url="http://localhost:8080/api"

case "${1^^}" in
  CLEAR)
    echo "Remove cookies file $cookiefile" >&2
    rm -f "$cookiefile"
    exit 0
    ;;
  HEAD|GET|POST|DELETE|PUT|OPTIONS)
    method="${1^^}"
    shift
    ;;
esac

case "$1" in
  /*)
    url+="$1"
    shift
    ;;
  *)
    echo "Invalid path '$1'" >&2
    echo "Usage: ./api.sh [METHOD] path [json|@-]" >&2
    exit 1
    ;;
esac

args=(
  -c "$cookiefile"
  -b "$cookiefile"
)
if [[ "$method" == "HEAD" ]]; then
  args+=( -I )
else
  args+=( -D - -X "$method" )
fi

if [[ -n "$1" ]]; then
  args+=(\
    -H "Content-Type: application/json"
    --data-binary "$1"
  )
fi
curl "${args[@]}" "$url"
echo
