#!/bin/bash
set -e

DEVDIR=_dev
ROOTDIR="$DEVDIR/folders"
SESSIONDIR="$DEVDIR/sessions"
USERPW="$DEVDIR/users.pwd"

if [[ "${1}" == "clean" ]]; then
  cat >&2 <<EOT
Cleaning up dev env files...
The following files/directories will be removed:
  $(realpath "$ROOTDIR")/
  $(realpath "$SESSIONDIR")/
  $(realpath "$USERPW")
EOT
  echo -n "Continue ? [yes/no] " >&2
  read answer
  if [[ "$answer" == "yes" ]]; then
    rm -rvf "$ROOTDIR"
    rm -rvf "$SESSIONDIR"
    rm -vf "$USERPW"
  fi
  exit 0
fi

echo "Bootstrapping filehub dev env..." >&2

if [[ ! -d "$ROOTDIR" ]]; then
  echo "  => Creating root data folder with sample data" >&2
  mkdir -p "$ROOTDIR"/{test1,test2/subdir}
  for i in 1 2; do
    echo '{"description":"Test directory '"$i"'"}' > "$ROOTDIR/test$i/.fhinfo"
  done
  echo "Some text file" > "$ROOTDIR/test1/File1.txt"
  echo "Another text file" > "$ROOTDIR/test2/File2.txt"
fi

if [[ ! -d "$SESSIONDIR" ]]; then
  echo "  => Creating sessions folder" >&2
  mkdir -p "$SESSIONDIR"
fi

if [[ ! -e "$USERPW" ]]; then
  cat >&2 <<EOT
  => Creating password file with default superadmin

       username: admin
       password: admin

     Sample users: admin1 admin2 contrib1 contrib2 visitor1 visitor2
EOT
  USERS=(\
    'admin su'
    'admin1 admin'
    'admin2 admin'
    'contrib1 contributor'
    'contrib2 contributor'
    'visitor1 visitor'
    'visitor2 visitor'
    )
  for u in "${USERS[@]}"; do
    uu=($u)
    node -e 'console.log("'"${uu[0]}"':"+require("crypt3")("'"${uu[0]}"'", "$6$abc123")+":'"${uu[1]}"':0:'"${uu[0]}"'@example.com")' >> "$USERPW"
  done
fi
echo -e "done.\n" >&2

exec node .
