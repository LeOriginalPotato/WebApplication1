#!/bin/sh
set -e
mkdir -p /data/photos
if [ -z "$SESSION_SECRET" ]; then
  if [ -s /data/session-secret ]; then
    SESSION_SECRET=$(cat /data/session-secret)
  else
    SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")
    printf '%s' "$SESSION_SECRET" > /data/session-secret
    chmod 600 /data/session-secret
  fi
  export SESSION_SECRET
fi
exec node server.js
