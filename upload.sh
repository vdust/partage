#!/bin/bash
set -e
cookiefile=/tmp/filehub.cookies

method=PUT
url="http://localhost:8080/api/repo/$1"

args=(
  -c "$cookiefile"
  -b "$cookiefile"
  -D - -X "$method"
  -H "Content-Type: application/octet-stream"
  --data-binary "@$2"
)

curl "${args[@]}" "$url"
echo
