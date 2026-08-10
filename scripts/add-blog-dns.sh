#!/usr/bin/env bash
# Add blog.smartbookplanner.com DNS A record in DigitalOcean.
#
# Usage:
#   DO_TOKEN=dop_v1_xxx ./scripts/add-blog-dns.sh
#
set -euo pipefail

DO_TOKEN="${DO_TOKEN:-${DIGITALOCEAN_ACCESS_TOKEN:-}}"
IP="${IP:-209.97.163.64}"

if [[ -z "$DO_TOKEN" ]]; then
  echo "Set DO_TOKEN (DigitalOcean personal access token with read/write DNS)."
  echo "Create at: https://cloud.digitalocean.com/account/api/tokens"
  exit 1
fi

curl -sS -X POST "https://api.digitalocean.com/v2/domains/smartbookplanner.com/records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DO_TOKEN" \
  -d "{\"type\":\"A\",\"name\":\"blog\",\"data\":\"$IP\",\"ttl\":3600}" | python3 -m json.tool

echo "Waiting for propagation..."
for i in $(seq 1 12); do
  RES=$(dig +short blog.smartbookplanner.com @ns1.digitalocean.com | tail -1)
  if [[ "$RES" == "$IP" ]]; then
    echo "DNS ready: blog.smartbookplanner.com -> $IP"
    echo "Run on server: ssh smartbookplanner-do '/root/finish-blog-ssl.sh'"
    exit 0
  fi
  sleep 5
done
echo "DNS not propagated yet — check DigitalOcean networking panel."
