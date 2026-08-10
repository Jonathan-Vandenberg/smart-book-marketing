#!/usr/bin/env bash
# One-time Ghost install on the Smart Book Planner DigitalOcean droplet.
#
# Run ON THE SERVER (SSH as root):
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/smart-book-marketing/main/scripts/setup-ghost.sh | bash
# Or copy from repo:
#   scp scripts/setup-ghost.sh root@209.97.163.64:/tmp/
#   ssh root@209.97.163.64 'bash /tmp/setup-ghost.sh'
#
# Prerequisites:
#   - DNS A record: blog.smartbookplanner.com → 209.97.163.64
#   - Ports 80/443 open (already used by nginx)
#
set -euo pipefail

GHOST_DIR="/var/www/ghost"
GHOST_URL="${GHOST_URL:-https://blog.smartbookplanner.com}"
GHOST_DB_NAME="${GHOST_DB_NAME:-ghost_prod}"
GHOST_DB_USER="${GHOST_DB_USER:-ghost}"
GHOST_DB_PASS="${GHOST_DB_PASS:-$(openssl rand -hex 16)}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Ghost setup for Smart Book Planner ==="
echo "URL:      $GHOST_URL"
echo "Install:  $GHOST_DIR"
echo ""

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (or with sudo)."
  exit 1
fi

echo "→ Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx mysql-server curl

echo "→ Ensuring MySQL is running..."
systemctl enable mysql
systemctl start mysql

echo "→ Creating Ghost database..."
mysql -e "CREATE DATABASE IF NOT EXISTS \`${GHOST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${GHOST_DB_USER}'@'localhost' IDENTIFIED BY '${GHOST_DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${GHOST_DB_NAME}\`.* TO '${GHOST_DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "→ Installing Ghost CLI..."
if ! command -v ghost >/dev/null 2>&1; then
  npm install -g ghost-cli@latest
fi

mkdir -p "$GHOST_DIR"
cd "$GHOST_DIR"

if [[ -f "${GHOST_DIR}/config.production.json" ]]; then
  echo "Ghost already installed at $GHOST_DIR — skipping ghost install."
  echo "Run 'ghost restart' in $GHOST_DIR to apply changes."
else
  echo "→ Installing Ghost (this may take a few minutes)..."
  ghost install --no-prompt \
    --url "$GHOST_URL" \
    --admin-url "$GHOST_URL" \
    --db mysql \
    --dbhost 127.0.0.1 \
    --dbuser "$GHOST_DB_USER" \
    --dbpass "$GHOST_DB_PASS" \
    --dbname "$GHOST_DB_NAME" \
    --port 2368 \
    --no-setup-ssl \
    --no-start \
    || true

  ghost setup nginx --no-prompt || true
  ghost setup systemd --no-prompt || true
  ghost start || ghost restart
fi

echo "→ Installing nginx vhost (proxy to :2368)..."
if [[ -f "${REPO_DIR}/nginx-ghost.conf" ]]; then
  cp "${REPO_DIR}/nginx-ghost.conf" /etc/nginx/sites-available/blog-smartbookplanner
else
  echo "Warning: nginx-ghost.conf not found in repo — copy it manually."
fi

if [[ -f /etc/nginx/sites-available/blog-smartbookplanner ]]; then
  ln -sf /etc/nginx/sites-available/blog-smartbookplanner /etc/nginx/sites-enabled/
  nginx -t
  systemctl reload nginx
fi

echo ""
echo "=== Next steps (manual) ==="
echo ""
echo "1. DNS: blog.smartbookplanner.com A → $(curl -s ifconfig.me 2>/dev/null || echo '209.97.163.64')"
echo ""
echo "2. SSL:"
echo "   certbot --nginx -d blog.smartbookplanner.com"
echo ""
echo "3. Open $GHOST_URL/ghost and create your admin account (first visit)."
echo ""
echo "4. In Ghost Admin → Settings → Integrations → Add custom integration:"
echo "   - Name: Smart Book Marketing"
echo "   - Copy Admin API URL + Admin API Key → .env on marketing dashboard"
echo ""
echo "5. Configure email (Settings → Email newsletter):"
echo "   - Use Mailgun, Amazon SES, or SendGrid (free tiers available)"
echo ""
echo "6. Add webhook in Ghost (Settings → Advanced → Integrations):"
echo "   - Event: post.published"
echo "   - URL: https://marketing.smartbookplanner.com/api/webhooks/ghost?secret=YOUR_WEBHOOK_SECRET"
echo ""
echo "7. Add to smart-book-marketing .env:"
echo "   GHOST_URL=$GHOST_URL"
echo "   GHOST_ADMIN_API_KEY=<id:secret from step 4>"
echo "   GHOST_WEBHOOK_SECRET=<random string>"
echo ""
echo "MySQL credentials saved to: /root/ghost-db-credentials.txt"
echo "GHOST_DB_USER=$GHOST_DB_USER" > /root/ghost-db-credentials.txt
echo "GHOST_DB_PASS=$GHOST_DB_PASS" >> /root/ghost-db-credentials.txt
echo "GHOST_DB_NAME=$GHOST_DB_NAME" >> /root/ghost-db-credentials.txt
chmod 600 /root/ghost-db-credentials.txt
echo ""
echo "✓ Ghost setup script finished."
