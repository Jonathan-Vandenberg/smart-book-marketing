#!/usr/bin/env bash
# Deploy smart-book-marketing to DigitalOcean (same server as rogan-writer).
#
# Usage:
#   DO_HOST=209.97.163.64 DO_USER=root DO_KEY=~/.ssh/your_key ./scripts/deploy.sh
#
set -euo pipefail

DO_HOST="${DO_HOST:?Set DO_HOST (e.g. 209.97.163.64)}"
DO_USER="${DO_USER:-root}"
DO_KEY="${DO_KEY:-}"
REMOTE_DIR="/var/www/smart-book-marketing"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SSH_CMD=(ssh -o StrictHostKeyChecking=accept-new)
if [[ -n "$DO_KEY" ]]; then
  SSH_CMD+=(-i "$DO_KEY")
fi
RSYNC_SSH="${SSH_CMD[*]}"

echo "→ Building locally..."
cd "$LOCAL_DIR"
npm ci
npm run build

echo "→ Uploading to ${DO_USER}@${DO_HOST}:${REMOTE_DIR}"

rsync -avz -e "$RSYNC_SSH" --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude .env.local \
  --exclude data/agent-runs.json \
  "${LOCAL_DIR}/.next" \
  "${LOCAL_DIR}/config" \
  "${LOCAL_DIR}/package.json" \
  "${LOCAL_DIR}/package-lock.json" \
  "${LOCAL_DIR}/next.config.ts" \
  "${LOCAL_DIR}/ecosystem.config.js" \
  "${DO_USER}@${DO_HOST}:${REMOTE_DIR}/"

"${SSH_CMD[@]}" "${DO_USER}@${DO_HOST}" bash -s <<'EOF'
set -euo pipefail
cd /var/www/smart-book-marketing
echo "→ Installing deps on server (native modules must compile for Linux — do not rsync node_modules from Mac)..."
npm ci
mkdir -p data
fuser -k 3001/tcp || true
sleep 1
if pm2 describe smart-book-marketing >/dev/null 2>&1; then
  pm2 restart smart-book-marketing
else
  pm2 start ecosystem.config.js
fi
pm2 save
pm2 status smart-book-marketing
EOF

echo "✓ Deploy complete — https://marketing.smartbookplanner.com (after DNS + nginx)"
