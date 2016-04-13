#!/bin/bash
set -e
path=static/js
files=(
  'filehub.js'
  'filehub-admin.js'
)

for f in "${files[@]}"; do
  tf="${f%.js}.min.js"
  echo "writing $path/$tf ..."
  closure "$path/$f" > "$path/$tf"
done
